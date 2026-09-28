/**
 * Dale — the voice of The Daily (docs/PHASE_4_PLAN.md).
 *
 * Dale is a way of *speaking*, not a second brain: every answer still comes
 * from the same grounded retrieval pipeline, with the same refusal to
 * invent. What changes is the shape of the reply. Written answers may run
 * to a paragraph with citation markers; a spoken answer has to land in a
 * couple of sentences, because a listener cannot skim, cannot hear a "[3]",
 * and will not sit through a recital.
 */

export const DALE_NAME = "Dale";

/** Languages Dale can be asked to speak in. */
export type DaleLanguage = "en" | "zh-HK" | "both";

/**
 * Extra rules appended to the grounded prompt when the answer will be
 * spoken aloud. They govern delivery only — the factual rules in
 * GROUNDING_RULES are untouched and still decide what may be said.
 */
export function spokenAnswerRules(language: DaleLanguage): string {
  const tongue =
    language === "zh-HK"
      ? "Answer in Traditional Chinese, Hong Kong Cantonese register."
      : language === "both"
        ? "Answer in English, then the same answer in Traditional Chinese."
        : "Answer in English.";
  return `THIS ANSWER WILL BE SPOKEN ALOUD BY ${DALE_NAME.toUpperCase()}, THE DAILY'S ASSISTANT.

${tongue}

- Two or three sentences. Stop there. If there is more worth saying, end by
  offering it: "There's more on that if you want it."
- Write for the ear: short sentences, no lists, no headings, no bullet
  characters, no Markdown, no emoji.
- Sixty spoken words at the very most. Brevity matters more than coverage:
  give the single most important thing, not a survey of three.
- Name the publisher inside the sentence — "RTHK reports...", "According to
  the Post..." — so the source is heard, not just seen.
- KEEP the [n] citation markers exactly as the rules above require. They are
  removed before the words are spoken, and they are what puts the sources on
  screen beside the answer.
- Round numbers the way a person says them aloud: "just over four thousand",
  "down about two per cent".
- Never say you are human, and never claim feelings or senses you lack. If
  asked what you are, say plainly that you are The Daily's assistant.
- If the sources do not cover it, say so in one sentence and stop. Never
  fill the gap.`;
}

// English needs an instruction in front of the language name, so a question
// that merely mentions a language is left alone.
const EN_CANTONESE = /\b(?:in|to|speak|switch to|use|answer in|reply in)\s+(?:cantonese|chinese)\b/i;
const EN_ENGLISH = /\b(?:in|to|speak|switch to|use|answer in|reply in)\s+english\b/i;
const EN_BOTH = /\b(?:bilingual|both languages|in both)\b/i;

// Chinese carries its own verb — 講 / 用 / 轉 / 改 — or is the bare name of
// the language on its own.
const ZH_CANTONESE = /(?:講|說|说|用|轉|转|改)(?:返|成|做)?\s*(?:廣東話|粵語|中文)/;
const ZH_ENGLISH = /(?:講|說|说|用|轉|转|改)(?:返|成|做)?\s*英文/;
const ZH_BOTH = /(?:雙語|中英|兩種語言)/;
const BARE_LANGUAGE =
  /^(廣東話|粵語|中文|英文|雙語|cantonese|english|bilingual)[\s啦呀吧喇。．！!？?,，]*$/i;

/**
 * A spoken instruction to change language, or null if the utterance is an
 * ordinary question.
 *
 * Deliberately narrow, because a false positive is expensive: Dale would
 * meet "what did that Cantonese opera review say?" by switching language
 * instead of answering. A language name on its own is an instruction;
 * inside a sentence it counts only with an instruction verb in front of it;
 * and a long sentence is always treated as a question.
 */
export function detectLanguageCommand(utterance: string): DaleLanguage | null {
  const text = utterance.trim();
  if (!text) return null;

  const bare = BARE_LANGUAGE.exec(text);
  if (bare) {
    const word = bare[1].toLowerCase();
    if (word === "英文" || word === "english") return "en";
    if (word === "雙語" || word === "bilingual") return "both";
    return "zh-HK";
  }

  if (/[一-鿿]/.test(text)) {
    // A whole sentence of Chinese is a question, verb or no verb.
    if (text.length > 12) return null;
    if (ZH_BOTH.test(text)) return "both";
    if (ZH_ENGLISH.test(text)) return "en";
    if (ZH_CANTONESE.test(text)) return "zh-HK";
    return null;
  }

  if (text.split(/\s+/).length > 8) return null;
  if (EN_BOTH.test(text)) return "both";
  if (EN_ENGLISH.test(text)) return "en";
  if (EN_CANTONESE.test(text)) return "zh-HK";
  return null;
}

/** What Dale says after being asked to change language. */
export function languageSwitchReply(language: DaleLanguage): string {
  if (language === "zh-HK") return "好，我而家講廣東話。";
  if (language === "both") return "Right — English first, then Chinese. 好，英文之後會講中文。";
  return "Right, back to English.";
}

/** BCP-47 tag for the speech recogniser, for each of Dale's languages. */
export function recognitionLanguage(language: DaleLanguage): string {
  return language === "zh-HK" ? "yue-Hant-HK" : "en-US";
}
