# THE DAILY — Phase 4 Plan

**Theme: from a dashboard you read to an assistant you talk to. Its name is
Dale.**

Phase 1 built a verified feed. Phase 2 made it personal and spoken. Phase 3
put video in it. Phase 4 gives it a **voice worth listening to**, a
**conversation** instead of a button, and **hands** — the ability to do the
small things aloud that today need a mouse.

**Delivery mode:** branch → review → `main`, as with Phase 3. Nothing merges
until `npm run lint && npm run typecheck && npm test && npm run build` pass,
and nothing reaches production without an explicit go-ahead.

## Baseline

Commit `95852ba` live · 300 tests · Gemini→Groq failover with a circuit
breaker · 34 sources including nine video channels · grounded chat with
citations, memories, alerts, audio briefings, browser speech in both
directions.

## Decisions taken

- **Name: Dale**, short for The Daily. It is the assistant's name, not a new
  product name; the masthead stays `THE·DAILY`.
- **English first.** Dale answers in English unless told otherwise — "in
  Cantonese", "講廣東話", "bilingual" — and then stays there until told
  again. The preference is remembered per device.
- **Everywhere:** desk browser, tablet, phone. Capability differs by device
  (below) and Dale says which mode it is in rather than failing silently.

## Measured before planning

**The robotic voice is the platform's, not ours.** `src/lib/voice/tts.ts`
already ranks voices and prefers neural/Online ones, but on Windows Chrome
the only voices installed are the old SAPI set (David, Mark, Zira). Edge
exposes Microsoft's "Natural" online voices, including `zh-HK`, and they
sound human. Voice quality is therefore a *sourcing* problem, not a tuning
one.

**Apple requires a tap for every spoken turn.** On iOS, `speak()` fires only
inside a user-gesture handler, and `SpeechRecognition.start()` likewise — a
page that starts either on its own is dropped silently. But audio unlocked
by one tap can keep playing afterwards. **This is the strongest argument for
a server voice**: Dale's speech becomes ordinary audio playback, which iOS
allows once unlocked, instead of a synthesiser call needing a fresh tap.

**Both directions already sit behind interfaces.** `TextToSpeechProvider`
and `SpeechRecognitionProvider` exist, and the audio pipeline already splits
scripts into short CJK-aware segments. A server voice is a new
implementation of an interface we have, not a rewrite.

**Free neural Cantonese is scarce.** Edge's `zh-HK` Natural voices are the
best free option found, and they are client-side.

### Measured on the live keys, 29 September 2026

Before writing any code, both server voices were called with the project's
own keys.

| Finding | Number |
|---|---|
| Gemini TTS free tier | **10 requests per day, per model** (`GenerateRequestsPerDayPerProjectPerModel-FreeTier=10`) |
| Gemini TTS latency | 2.2-3.9s for one short sentence |
| Gemini TTS output | `audio/wav`, ~130KB for 2.8s; English and Chinese both spoken |
| Groq Orpheus | refused: the model needs its terms accepted in the Groq console, and it is English-only |
| Groq Whisper (speech-to-text) | works today on the same key |

**This overturns the assumed design.** A server voice cannot carry a
conversation: ten requests a day is roughly four exchanges, and three
seconds to the first sound is twice the latency target. So:

- **The browser voice is Dale's live voice**, not the fallback. It is free,
  unlimited and immediate, and Edge's Natural voices -- English and `zh-HK`
  alike -- are good.
- **A server voice is a garnish, not the engine**: reserved for a handful of
  cached, high-value pieces a day, such as the morning briefing, where one
  generation is replayed by everyone. It stays behind the capacity gate and
  a hard daily counter.
- **Groq Orpheus is worth one click to evaluate** (terms acceptance is an
  account action). If its free limits are generous it becomes the English
  live voice, with the browser voice still carrying Cantonese.
- **Groq Whisper is the speech-to-text fallback** for devices where the
  browser's own recogniser is unreliable, iPhone Safari especially.

---

## P0 — Dale's voice and the conversation loop

The MVP. One loop, done properly.

### The voice chain

A provider chain with failover and cooling, mirroring
`src/lib/ai/providers.ts`:

1. **Browser neural voice** — Edge/Chrome "Natural"/"Online" voices, and
   Apple's premium voices on iOS. Free, unlimited, immediate. Dale's
   everyday voice, in both languages.
2. **Server neural voice** — better and identical everywhere, but rationed:
   used only for cached set pieces (the daily briefing) and only while the
   daily allowance lasts. Never for live conversation.
3. **Browser local voice** — last resort where no neural voice exists.
   Labelled honestly in settings as the basic voice.

Every spoken line is **cached by content hash + voice + language**, the same
pattern as summaries, so repeats cost nothing. A day's audio briefing is
generated once and reused.

**Capacity gate:** the existing `availableTokenCapacity()` check that hides
deep briefings also governs Dale. Below the threshold Dale drops to the
browser voice and shorter answers rather than starving Ask The Daily.

### The loop

```
tap / hold / wake → listening → transcript shown → grounded answer streams
→ spoken sentence by sentence → back to listening (conversation mode)
```

- **Barge-in:** speaking stops the moment the reader speaks.
- **Streamed speech:** the first sentence is spoken while the rest is still
  being written. Target **first sound ≤ 1.5s** after the reader stops.
- **Spoken length:** two or three sentences, then an offer of detail. Dale
  never reads an essay aloud.
- **Transcript stays visible and editable** — the Phase 2 rule holds: speech
  takes the identical server path as typing and cannot skip the grounding.

### Per-device honesty

| Device | Listening | Speaking |
|---|---|---|
| Desktop Chrome/Edge | Hold-to-talk or conversation mode | Edge/Chrome neural |
| Android Chrome | Same | Same |
| iPad / iPhone Safari | Tap per turn (Apple's rule) | Apple voices, spoken inside that same tap |

Dale states its mode ("tap to talk on this device") instead of appearing
broken.

### Modules

- `src/lib/voice/providers/` — the voice chain, cooling, failover.
- `src/app/api/speak/route.ts` — text in, cached audio out. Never returns
  anything not produced from text the server itself generated.
- `src/lib/voice/session.ts` — the state machine: idle → listening →
  thinking → speaking → listening, with barge-in and a hard stop.
- `src/lib/ai/persona.ts` — who Dale is (below), reusing the existing
  "write for the ear" rules.

### Who Dale is

Calm, brief, unhurried, never theatrical. Greets without using a name, as
the greeting rules already require. Offers the next step rather than
lecturing. **Never claims to be human**, and says so plainly if asked. When
the sources do not cover something: *"Information unavailable from the
currently connected sources."* The same honesty rules as every other AI
surface here — no invented facts, no invented causes for price moves, no
personalised advice.

---

## P1 — Dale's hands

Small, safe, spoken actions. Every call validated server-side with zod, and
every action recorded in an `assistant_actions` table, so there is a visible
record of what Dale did.

**Without asking** (read-only): search the news, read a section, quote a
watchlist symbol, open a page, recall a saved preference.

**Only after spoken confirmation** (writes): add or remove a watchlist
symbol, save an article, remember a preference, set an alert.

Never, in any phase: buying, selling, sending, posting, or anything else
irreversible.

## P2 — Wake word and proactive Dale

- **"Dale"** as an on-device wake word (Porcupine WASM, free personal
  tier). It is a short word and will false-trigger; measuring the false-wake
  rate is part of the increment, and a visible listening indicator plus a
  hard mute switch ship with it. Nothing is recorded before the wake word.
  Desktop and Android only — Apple's gesture rule rules iOS out.
- **Proactive, narrowly:** a spoken good-morning offer of the brief when the
  dashboard is opened in the morning, and alerts read aloud only when the
  page is open and the reader has enabled it. Dale never interrupts a quiet
  room.

## P3 — Continuity

Dale remembers what was discussed and what Tony prefers — already stored,
explicitly, through the memories API. "What did I ask you about Kai Tak last
week?" The Phase 2 memory rule holds: old conversation is what was
discussed, not what is true, and it never overrides fresh retrieval.

---

## Rules this phase adds

- **Raw microphone audio is never stored**, wake word included.
- **A generated voice is never passed off as a person's.** No cloning of
  Tony's voice, or any presenter's.
- **Dale never acts irreversibly**, and confirms every write aloud.
- **Speech does not bypass grounding**, in either direction.

## Testing and docs

Per increment: voice-chain failover and cooling, cache-key correctness,
persona and spoken-length rules, the session state machine including
barge-in, tool schemas and the confirmation flow, and a device matrix —
Chrome and Edge on desktop, Chrome on Android, Safari on iPad and iPhone.
Latency measured, not assumed. Cantonese pronunciation spot-checked against
real headlines before any Cantonese voice is called finished.

Docs: `ASSISTANT_POLICY.md` (new), `VOICE_ARCHITECTURE.md` (updated), and
`CLAUDE.md` gains an assistant rule beside the voice rule.

## Cost stance

Free tiers only, as always. Every provider's free tier is **verified in
practice before it is committed**, not assumed from documentation. Caching,
the capacity gate and the browser fallback mean Dale degrades to
free-and-decent rather than failing or spending.

## Deliberately excluded

Voice cloning. Phone calls. Smart-home control. Unattended or financial
actions. Storing audio. Any paid tier. Any suggestion that Dale is a person.
