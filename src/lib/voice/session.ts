import type { SpeechRecognitionProvider, SpeechSession } from "./speech";
import type { SpeakHandle, TextToSpeechProvider, TtsSegment } from "./tts";
import { detectLanguageCommand, recognitionLanguage, type DaleLanguage } from "@/lib/ai/persona";

/**
 * The talking loop (docs/PHASE_4_PLAN.md).
 *
 * Four states and nothing else, because every bug in a voice assistant is a
 * state bug: a microphone that stays open after the answer, two voices
 * talking at once, an answer for a question that was abandoned. The
 * transitions are a pure function so they can be tested without a browser,
 * and the class below is only wiring.
 */
export type DaleState = "idle" | "listening" | "thinking" | "speaking";

export type DaleEvent =
  | { type: "start" }
  /** The recogniser produced a final transcript. */
  | { type: "heard" }
  /** The grounded answer came back. */
  | { type: "answer" }
  /** Dale finished the last segment. */
  | { type: "spoken" }
  /** The reader started talking while Dale was: barge-in. */
  | { type: "interrupt" }
  | { type: "stop" }
  | { type: "error" };

/**
 * `conversation` keeps the loop open after Dale finishes speaking, so a
 * reply can follow without pressing anything. Off, every turn is deliberate
 * -- which is also the only mode iOS allows, since Apple requires a gesture
 * for each recognition and each utterance.
 */
export function nextState(
  state: DaleState,
  event: DaleEvent,
  options: { conversation: boolean } = { conversation: false },
): DaleState {
  // Stopping and failing always win, from any state.
  if (event.type === "stop" || event.type === "error") return "idle";
  switch (state) {
    case "idle":
      return event.type === "start" ? "listening" : "idle";
    case "listening":
      // A second press while listening is a cancel, not a restart.
      if (event.type === "start") return "idle";
      return event.type === "heard" ? "thinking" : "listening";
    case "thinking":
      // Nothing is spoken until the grounded answer exists.
      return event.type === "answer" ? "speaking" : "thinking";
    case "speaking":
      if (event.type === "interrupt") return "listening";
      if (event.type === "spoken") return options.conversation ? "listening" : "idle";
      if (event.type === "start") return "idle";
      return "speaking";
    default:
      return "idle";
  }
}

/** True while the microphone is open — the UI must show this unmistakably. */
export function micIsOpen(state: DaleState): boolean {
  return state === "listening";
}

export interface DaleCallbacks {
  onState?: (state: DaleState) => void;
  /** Interim and final transcripts, shown as they form and always editable. */
  onTranscript?: (text: string, final: boolean) => void;
  /** A final transcript that is a question, not a language instruction. */
  onQuestion?: (text: string) => void;
  /** The reader asked Dale to change language. */
  onLanguage?: (language: DaleLanguage) => void;
  onError?: (message: string) => void;
}

export class DaleSession {
  private state: DaleState = "idle";
  private recogniser: SpeechSession | null = null;
  private speech: SpeakHandle | null = null;

  constructor(
    private readonly providers: {
      speech: SpeechRecognitionProvider;
      tts: TextToSpeechProvider;
    },
    private readonly callbacks: DaleCallbacks = {},
    private options: { conversation: boolean; language: DaleLanguage } = {
      conversation: false,
      language: "en",
    },
  ) {}

  get current(): DaleState {
    return this.state;
  }

  setLanguage(language: DaleLanguage): void {
    this.options = { ...this.options, language };
  }

  setConversation(conversation: boolean): void {
    this.options = { ...this.options, conversation };
  }

  supported(): boolean {
    return this.providers.speech.supported();
  }

  /** Press to talk. Pressing again cancels, as the state machine says. */
  listen(): void {
    if (this.state !== "idle") {
      this.stop();
      return;
    }
    this.transition({ type: "start" });
    this.recogniser = this.providers.speech.start({
      language: recognitionLanguage(this.options.language),
      onInterim: (text) => this.callbacks.onTranscript?.(text, false),
      onFinal: (text) => this.heard(text),
      onError: (message) => {
        this.callbacks.onError?.(message);
        this.transition({ type: "error" });
      },
      // The recogniser stopping on its own without a final transcript means
      // silence: return to idle rather than sit in a fake listening state.
      onEnd: () => {
        if (this.state === "listening") this.transition({ type: "stop" });
      },
    });
    if (!this.recogniser) this.transition({ type: "error" });
  }

  private heard(text: string): void {
    this.callbacks.onTranscript?.(text, true);
    const command = detectLanguageCommand(text);
    if (command) {
      // "Speak Cantonese" is an instruction to Dale, not a question for the
      // news index -- answering it from articles would be nonsense.
      this.setLanguage(command);
      this.transition({ type: "stop" });
      this.callbacks.onLanguage?.(command);
      return;
    }
    this.transition({ type: "heard" });
    this.callbacks.onQuestion?.(text);
  }

  /** The answer is ready: speak it. */
  say(segments: TtsSegment[], rate = 1): void {
    if (this.state !== "thinking") return;
    this.transition({ type: "answer" });
    this.speech = this.providers.tts.speak({
      segments,
      rate,
      onEnd: () => {
        this.speech = null;
        if (this.state !== "speaking") return;
        const continues = this.options.conversation;
        this.transition({ type: "spoken" });
        // Conversation mode: the loop reopens by itself.
        if (continues) {
          this.state = "idle";
          this.listen();
        }
      },
      onError: (message) => {
        this.callbacks.onError?.(message);
        this.transition({ type: "error" });
      },
    });
    if (!this.speech) this.transition({ type: "spoken" });
  }

  /** The question failed: never leave the loop stuck in "thinking". */
  failed(message?: string): void {
    if (message) this.callbacks.onError?.(message);
    this.transition({ type: "error" });
  }

  /** Barge-in: the reader speaks, Dale stops mid-sentence and listens. */
  interrupt(): void {
    if (this.state !== "speaking") return;
    this.speech?.stop();
    this.speech = null;
    this.transition({ type: "interrupt" });
    this.state = "idle";
    this.listen();
  }

  stop(): void {
    this.recogniser?.cancel();
    this.recogniser = null;
    this.speech?.stop();
    this.speech = null;
    this.transition({ type: "stop" });
  }

  private transition(event: DaleEvent): void {
    const next = nextState(this.state, event, { conversation: this.options.conversation });
    if (next === this.state) return;
    this.state = next;
    this.callbacks.onState?.(next);
  }
}
