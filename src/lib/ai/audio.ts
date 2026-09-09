import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { generateDailyBrief, getTodaysBrief, hkDateKey } from "@/lib/brief";
import { getArticles } from "@/lib/queries";
import { toContext } from "@/lib/retrieval";
import { aiModelId, buildSourceBlock, completeRaw, isAiConfigured } from "@/lib/ai";
import { availableTokenCapacity } from "@/lib/ai/providers";

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

/**
 * Token budgets are far above the visible word count on purpose: reasoning
 * models spend a large share of the budget thinking before emitting any
 * script, and an exhausted budget produces a briefing that stops
 * mid-sentence.
 */
const TOKEN_BUDGET: Record<AudioFormat, number> = {
  quick: 6000,
  morning: 10000,
  deep: 16000,
  dialogue: 10000,
};

/**
 * The share of a format's budget the AI must be able to serve before that
 * format is offered at all.
 *
 * A ten-minute briefing asks for 16,000 tokens. When Gemini is standing down
 * and Groq is carrying the work, its free tier serves 8,000 a minute — half
 * of what a Deep Brief needs — and the result stops early. Offering a button
 * that produces a half-finished briefing is worse than not offering it, so
 * below this share the format is hidden and the reason is stated.
 *
 * Above it, a briefing loses some headroom but still reads as a complete
 * piece: the budget is deliberately far larger than the visible word count,
 * and an unfinished trailing sentence is dropped rather than spoken.
 */
export const MIN_BUDGET_SHARE = 0.7;

export interface FormatAvailability {
  format: AudioFormat;
  /** Offer this format right now? */
  available: boolean;
  /** Servable, but with less headroom than usual — expect a shorter piece. */
  reduced: boolean;
}

/** What can be generated right now, given the AI capacity actually in hand. */
export function audioFormatAvailability(): FormatAvailability[] {
  const capacity = availableTokenCapacity();
  return (Object.keys(TOKEN_BUDGET) as AudioFormat[]).map((format) => {
    const need = TOKEN_BUDGET[format];
    return {
      format,
      available: capacity >= need * MIN_BUDGET_SHARE,
      reduced: capacity < need && capacity >= need * MIN_BUDGET_SHARE,
    };
  });
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

const AUDIO_RULES = `You write broadcast scripts for THE DAILY, a private news briefing for a retired Hong Kong architect who follows markets, property, architecture and urban development.

ABSOLUTE RULES:
- Use ONLY the numbered sources provided. Every factual statement must come from them.
- Never invent causes for market moves, opinions of investors, or any detail not in the sources. If sources do not explain something, say so naturally ("the reports don't say why").
- If sources disagree, mention the disagreement.
- Preserve names, numbers, percentages and stock codes exactly.
- This briefing is for one listener, so no address to a crowd ("everyone", "folks") — and do not use the listener's name either. "Good morning." is right; "Good morning, Tony." is not.
- Plain spoken prose. No Markdown, no headings, no citation markers like [1] — this will be read aloud.
- Do not read article headlines verbatim as a list; synthesise them into natural speech.

WRITE FOR THE EAR. A speech engine reads this, and it can only sound human if
the writing is how a person actually talks:
- Short sentences, one idea each. Long clause-stacked sentences come out flat
  and mechanical no matter how good the voice is.
- Use contractions the way people speak: "it's", "there's", "they've".
- Vary how sentences open. Three in a row starting the same way sounds like a
  machine reading a table.
- Punctuate for breath. Commas and full stops are the only pauses the voice
  has, so a sentence without them is delivered in one flat rush.
- Write figures as they are said, never as symbols: "three and a half percent",
  not "3.5%"; "eighty-one point two million Hong Kong dollars", not "HK$81.2m".
  The value stays exactly as the source has it — only the spelling changes.
- Digits that are part of a NAME stay as digits: "S&P 500", "Hang Seng Index",
  "Nasdaq 100", "Lee Garden Eight". Spell out quantities, never names --
  "the S&P 500 fell twenty-one points", never "the S&P five thousand".
- Spell out abbreviations: "versus" not "vs", "third quarter" not "Q3", "year
  on year" not "YoY", "roughly" not "approx.".
- Say a company's name, not its ticker: "Tencent", not "0700.HK".
- Hand the listener from one topic to the next in words ("over in property",
  "meanwhile") rather than leaving a bare jump.`;

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
    const segLang = lang ?? (/[㐀-鿿]/.test(text) ? "zh-HK" : "en-US");
    for (const chunk of splitForDelivery(text)) {
      segments.push({ speaker, lang: segLang, text: chunk });
    }
  }
  return dropTruncatedTail(segments);
}

/**
 * Break an over-long block into utterance-sized pieces at sentence ends.
 *
 * Segments normally follow the script's own paragraphs, but a model
 * sometimes returns the whole briefing as one unbroken block — one episode
 * in the library is 275 words in a single segment where its siblings have
 * seven. Read aloud that becomes one long flat stretch, and the player has
 * nothing to track progress against or resume from. Splitting on sentence
 * boundaries restores both without changing a word of the script.
 */
const MAX_SEGMENT_CHARS = 320;
/**
 * Chinese carries roughly a syllable per character, where English needs
 * five or six characters for one. Measuring both against 320 would leave a
 * Cantonese segment several times longer to speak than its English
 * counterpart, which is the flat-delivery problem this exists to avoid.
 */
const MAX_SEGMENT_CHARS_CJK = 120;

function isMostlyCjk(text: string): boolean {
  const cjk = text.match(/[㐀-鿿]/g)?.length ?? 0;
  return cjk > text.length / 4;
}

export function splitForDelivery(text: string, max?: number): string[] {
  const limit = max ?? (isMostlyCjk(text) ? MAX_SEGMENT_CHARS_CJK : MAX_SEGMENT_CHARS);
  return splitAtSentences(text, limit);
}

function splitAtSentences(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  // Keep the terminator with its sentence; CJK marks need no trailing space.
  const sentences = text.match(/[^.!?。！？]+(?:[.!?。！？]+["'」』)\]]*\s*|$)/g);
  if (!sentences) return [text];

  const out: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (current && (current + s).length > max) {
      out.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out.length ? out : [text];
}

/** A briefing that stops mid-sentence sounds broken read aloud. */
const SENTENCE_END = /[.!?。！？…"'」』)\]]\s*$/;

export function dropTruncatedTail(segments: AudioSegment[]): AudioSegment[] {
  if (segments.length === 0) return segments;
  const last = segments[segments.length - 1];
  if (SENTENCE_END.test(last.text)) return segments;

  // Keep whatever complete sentences the final paragraph does contain;
  // drop the paragraph entirely if none survive. A full stop inside a
  // figure ("15.87 billion") is not a sentence boundary, so require the
  // mark to be followed by whitespace or the end of the text.
  const boundary = /[.!?](?![0-9])(?=\s|$)|[。！？]/g;
  let cut = -1;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(last.text)) !== null) cut = match.index;

  if (cut > 40) {
    return [...segments.slice(0, -1), { ...last, text: last.text.slice(0, cut + 1) }];
  }
  return segments.slice(0, -1);
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
      `Write today's ${spec.title}, ${spec.words}.\n${spec.style}\n${langInstruction(language)}\nOpen with a one-sentence greeting appropriate to the hour — no name — and close with a single calm sign-off sentence.\n\nSOURCES:\n\n${block}`,
      TOKEN_BUDGET[format],
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
