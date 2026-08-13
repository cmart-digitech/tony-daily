import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { generateDailyBrief, getTodaysBrief, hkDateKey } from "@/lib/brief";
import { getArticles } from "@/lib/queries";
import { toContext } from "@/lib/retrieval";
import { aiModelId, buildSourceBlock, completeRaw, isAiConfigured } from "@/lib/ai";

/**
 * Tony Daily Audio (brief §11–19): news-anchor and podcast-style scripts,
 * generated ONLY from the day's verified brief articles and stored with
 * their source ids. Audio itself is synthesised client-side at playback
 * (browser TTS), so no audio is hosted and an old episode can never
 * masquerade as today's — the dateKey travels with the transcript.
 *
 * Copyright: scripts are Tony Daily's own grounded synthesis of headlines
 * and permitted excerpts — never article text read aloud (brief §13).
 */

export type AudioFormat = "quick" | "morning" | "deep" | "dialogue";
export type AudioLanguage = "en" | "zh-HK" | "bilingual";

export interface AudioSegment {
  speaker: string;
  lang: string; // BCP-47 for TTS: en-US | zh-HK
  text: string;
}

const FORMAT_SPECS: Record<AudioFormat, { words: string; style: string; title: string }> = {
  quick: {
    words: "about 260-320 words (~2 minutes)",
    style: "One anchor. Brisk but calm. Cover only the 4-5 most important items in one or two sentences each.",
    title: "Quick Brief",
  },
  morning: {
    words: "about 650-800 words (~5 minutes)",
    style: "One anchor. A professional morning news briefing moving through sections: markets, Hong Kong, property, architecture, then anything global that matters.",
    title: "Morning Brief",
  },
  deep: {
    words: "about 1300-1600 words (~10 minutes)",
    style: "One anchor. A considered deep briefing: context and detail from the sources for each major story, differences between sources noted.",
    title: "Deep Brief",
  },
  dialogue: {
    words: "about 650-850 words (~5-6 minutes)",
    style: "Two presenters, ANNA and BEN, in a natural conversational exchange. They hand over to each other, ask short questions, and keep a warm professional tone. Every line starts with 'ANNA:' or 'BEN:'.",
    title: "Morning Conversation",
  },
};

const AUDIO_RULES = `You write broadcast scripts for TONY DAILY, a private news briefing for Tony Wong, a retired Hong Kong architect.

ABSOLUTE RULES:
- Use ONLY the numbered sources provided. Every factual statement must come from them.
- Never invent causes for market moves, opinions of investors, or any detail not in the sources. If sources do not explain something, say so naturally ("the reports don't say why").
- If sources disagree, mention the disagreement.
- Preserve names, numbers, percentages and stock codes exactly.
- No greetings to an audience ("everyone", "folks") — this briefing is for one listener, Tony.
- Plain spoken prose. No Markdown, no headings, no citation markers like [1] — this will be read aloud.
- Do not read article headlines verbatim as a list; synthesise them into natural speech.`;

function langInstruction(language: AudioLanguage): string {
  if (language === "zh-HK") {
    return "Write the entire script in spoken Hong Kong Cantonese register using Traditional Chinese characters (廣東話口語，繁體字) — natural spoken phrasing (係/喺/嘅/啲), not formal written Chinese. Keep company names and figures accurate.";
  }
  if (language === "bilingual") {
    return "Alternate by SECTION between English and spoken Hong Kong Cantonese (廣東話口語，繁體字). Prefix every paragraph with [EN] or [粵] on its own to mark the language. Do not translate each sentence twice — each section appears once, in one language.";
  }
  return "Write in natural spoken English.";
}

/** Split a generated script into TTS-ready segments. */
export function parseScript(raw: string, format: AudioFormat): AudioSegment[] {
  const cleaned = raw.replace(/```[a-z]*|```/gi, "").trim();
  const segments: AudioSegment[] = [];
  const paragraphs = cleaned.split(/\n{1,}/).map((p) => p.trim()).filter(Boolean);

  for (const p of paragraphs) {
    let speaker = "ANCHOR";
    let text = p;
    if (format === "dialogue") {
      const m = p.match(/^(ANNA|BEN)\s*[:：]\s*(.*)$/i);
      if (m) {
        speaker = m[1].toUpperCase();
        text = m[2];
      }
    }
    let lang: string | null = null;
    const tag = text.match(/^\[(EN|粵|YUE|ZH)\]\s*(.*)$/i);
    if (tag) {
      lang = tag[1].toUpperCase() === "EN" ? "en-US" : "zh-HK";
      text = tag[2];
    }
    if (!text) continue;
    segments.push({
      speaker,
      lang: lang ?? (/[㐀-鿿]/.test(text) ? "zh-HK" : "en-US"),
      text,
    });
  }
  return segments;
}

export type AudioBriefRow = typeof schema.audioBriefs.$inferSelect;

export async function getAudioBrief(
  format: AudioFormat,
  language: AudioLanguage,
  dateKey = hkDateKey(),
): Promise<AudioBriefRow | null> {
  const db = await getDb();
  return (
    (await db
      .select()
      .from(schema.audioBriefs)
      .where(
        and(
          eq(schema.audioBriefs.dateKey, dateKey),
          eq(schema.audioBriefs.format, format),
          eq(schema.audioBriefs.language, language),
        ),
      )
      .orderBy(desc(schema.audioBriefs.id))
      .get()) ?? null
  );
}

export async function generateAudioBrief(options: {
  format: AudioFormat;
  language: AudioLanguage;
  regenerate?: boolean;
}): Promise<{ brief: AudioBriefRow | null; reason?: string }> {
  const { format, language, regenerate } = options;
  if (!isAiConfigured()) return { brief: null, reason: "ai-not-configured" };

  const dateKey = hkDateKey();
  if (!regenerate) {
    const cached = await getAudioBrief(format, language, dateKey);
    if (cached) return { brief: cached };
  }

  // Grounding material: today's brief articles only.
  let daily = await getTodaysBrief();
  if (!daily) {
    try {
      await generateDailyBrief();
      daily = await getTodaysBrief();
    } catch {
      daily = null;
    }
  }
  const sourceIds = daily?.content.sections.flatMap((s) => s.articleIds) ?? [];
  if (sourceIds.length === 0) return { brief: null, reason: "no-verified-stories" };

  const articles = await getArticles(sourceIds);
  const { block } = buildSourceBlock(articles.map(toContext));
  const spec = FORMAT_SPECS[format];

  let raw: string;
  try {
    raw = await completeRaw(
      AUDIO_RULES,
      `Write today's ${spec.title} for Tony, ${spec.words}.\n${spec.style}\n${langInstruction(language)}\nOpen with a one-sentence greeting appropriate to a morning briefing, and close with a single calm sign-off sentence.\n\nSOURCES:\n\n${block}`,
      format === "deep" ? 4000 : 2600,
    );
  } catch (err) {
    return {
      brief: null,
      reason: err instanceof Error ? err.message.slice(0, 300) : "generation-failed",
    };
  }

  const segments = parseScript(raw, format);
  if (segments.length === 0) return { brief: null, reason: "empty-script" };
  const wordCount = segments.reduce(
    (n, s) => n + (s.lang === "zh-HK" ? s.text.length : s.text.split(/\s+/).length),
    0,
  );

  const db = await getDb();
  await db
    .insert(schema.audioBriefs)
    .values({
      dateKey,
      format,
      language,
      title: `${spec.title} — ${dateKey}`,
      transcript: JSON.stringify(segments),
      sourceIds: JSON.stringify(sourceIds),
      model: aiModelId(),
      wordCount,
      createdAt: Date.now(),
    })
    .run();
  return { brief: await getAudioBrief(format, language, dateKey) };
}
