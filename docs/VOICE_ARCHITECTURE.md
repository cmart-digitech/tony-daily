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
