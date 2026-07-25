/**
 * The capabilities the turn-taking machine runs on, as plain interfaces.
 *
 * The state machine in `turnTaking.ts` is where the interesting behaviour
 * lives — speak, listen, review, confirm, and the timing between them — and it
 * is written against these interfaces so it runs and is tested on Node. The
 * Expo-backed implementations (`expoSpeech.ts`, `expoRecognizer.ts`) are thin
 * and live at the edge, where only a device can exercise them.
 */

export type VoiceState =
  | "idle"
  | "speaking"
  | "listening"
  | "reviewing"
  | "done"
  | "cancelled";

/** Text-to-speech. `speak` resolves when playback finishes or is stopped. */
export interface SpeechSynthesizer {
  speak(text: string): Promise<void>;
  stop(): void;
}

export interface RecognizerHandlers {
  /** Best transcript so far; called repeatedly as the user speaks. */
  onPartial(text: string): void;
  /** The finalised transcript for this utterance. */
  onFinal(text: string): void;
  /** The recognizer heard speech begin (used for barge-in). */
  onSpeechStart(): void;
  /** The recognizer stopped, whether or not a final arrived. */
  onEnd(): void;
  onError(message: string): void;
}

/** Speech-to-text. Drives the handlers; `stop` requests a final, `abort` discards. */
export interface SpeechRecognizer {
  start(handlers: RecognizerHandlers): void;
  stop(): void;
  abort(): void;
}

/** An injectable scheduler, so silence and confirm timing are testable. */
export interface Timer {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export const realTimer: Timer = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export type VoiceEvent =
  | { type: "state"; state: VoiceState }
  | { type: "question"; text: string }
  | { type: "transcript"; text: string; isFinal: boolean }
  | { type: "error"; message: string };

export type VoiceEventSink = (event: VoiceEvent) => void;

export class VoiceCancelledError extends Error {
  constructor() {
    super("The voice turn was cancelled.");
    this.name = "VoiceCancelledError";
  }
}
