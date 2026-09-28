# Voice Architecture

## Principle (brief §7)

Speech never bypasses the grounded pipeline:

```
Microphone → speech-to-text → transcript SHOWN AND EDITABLE → same /api/chat
retrieval → grounded answer + citations → optional text-to-speech
```

A spoken question and a typed question take the identical server path; the
factuality rules cannot be side-stepped by voice.

## Providers

Both directions sit behind abstractions so vendors can change without
touching product code.

### `SpeechRecognitionProvider` (src/lib/voice/speech.ts)
- **BrowserSpeechProvider** (production today, free): Web Speech API.
  Languages: `en-US`, `yue-Hant-HK` (Hong Kong Cantonese — supported in
  Chromium). Explicit start only, visible listening state, editable
  transcript, permission errors surfaced, **no audio ever stored**.
- Upgrade path: Google Cloud Speech-to-Text implements the same interface
  server-side. Requires a GCP project + billing → paid decision per §76;
  verify current models/pricing at implementation time.

### `TextToSpeechProvider` (src/lib/voice/tts.ts)
- **BrowserTtsProvider** (production today, free): speechSynthesis with
  zh-HK voice preference for Cantonese text, per-speaker voice variation for
  dialogue, 0.75–1.5× speed persisted. Synthesised at playback — no audio
  files exist, so old audio cannot circulate and nothing copyrighted is
  recorded.
- Upgrade path: any neural TTS (Google, ElevenLabs, …) behind the same
  interface — paid decision per §76.

## Audio briefs (src/lib/ai/audio.ts)

Scripts (quick/morning/deep/dialogue × EN/廣東話/雙語) are generated only from
the day's verified brief articles, stored with dateKey + source ids + model
in `audio_briefs`, and replayed through the TTS provider. The mini-player
labels any episode whose dateKey is not today. Skipping is per segment — the
honest equivalent of ±15 s for on-device synthesis.

## Known limitations
- Web Speech API requires Chromium-family browsers for Cantonese; the mic
  button hides itself where unsupported.
- Device voices vary in quality by OS; the paid TTS path exists for when
  that matters enough to fund.
- Mixed-language *recognition* within one utterance is browser-dependent;
  the language toggle (EN/粵) selects the recognition model explicitly.

## Dale — the talking loop (Phase 4)

Dale is a way of speaking, not a second brain. A spoken question takes the
same path as a typed one; only the shape of the answer changes.

```
press → listening → transcript (shown, editable) → /api/chat with spoken:<lang>
→ grounded answer + citations → citation markers stripped for the ear
→ spoken segment by segment → idle, or listening again in hands-free mode
```

- **`src/lib/voice/session.ts`** — four states (idle, listening, thinking,
  speaking) as a pure transition function, so the loop can be tested without
  a browser. Barge-in returns to listening; stop and failure always return
  to idle, so the microphone is never left open.
- **`src/lib/ai/persona.ts`** — `spokenAnswerRules()` (two or three
  sentences, sixty words, publisher named aloud, no Markdown, never claims
  to be human) and `detectLanguageCommand()`, which tells "speak Cantonese"
  apart from a question that merely mentions Cantonese.
- **`src/components/DaleBar.tsx`** — the control. Shows state, language and
  hands-free, and hides hands-free on iOS, where Apple requires a gesture
  per turn.
- **Citations**: the written answer keeps its `[n]` markers and its source
  list; `speechText()` removes them before speaking, because a listener
  cannot hear a marker.
- **The voice itself is the browser's.** Measured 29 Sept 2026: Gemini's
  server voice allows ten requests per day per model on the free tier and
  takes 2-4s per sentence, so it cannot carry a conversation. See
  docs/PHASE_4_PLAN.md.
