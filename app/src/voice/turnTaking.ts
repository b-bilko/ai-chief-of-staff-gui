/**
 * The conversation loop that makes a wrap feel like talking, not filling in a
 * form: speak a question, listen for the answer, show it for a beat so a
 * mis-hearing can be fixed, then hand it back.
 *
 * This is the `askUser` seam the interview flows already expect. Each call to
 * `askUser` runs one question through four states:
 *
 *   speaking → listening → reviewing → done
 *
 * The review state is not ceremony. "Their words stay theirs" is the premise of
 * the whole vault, and on-device transcription mishears names and jargon most.
 * A wrong transcript committed becomes a permanent, wrong quote, so the answer
 * is shown before it is sent — with a short auto-confirm so a clean transcript
 * does not demand a tap after every one of nine questions, and any edit cancels
 * that countdown.
 *
 * All timing goes through an injected `Timer`, so silence detection and the
 * confirm countdown are tested deterministically rather than with real waits.
 */

import {
  VoiceCancelledError,
  realTimer,
  type RecognizerHandlers,
  type SpeechRecognizer,
  type SpeechSynthesizer,
  type Timer,
  type VoiceEvent,
  type VoiceEventSink,
  type VoiceState,
} from "./types";

export interface VoiceControllerOptions {
  synth: SpeechSynthesizer;
  recognizer: SpeechRecognizer;
  timer?: Timer;
  onEvent?: VoiceEventSink;
  /** Silence after the last partial that ends listening. */
  silenceMs?: number;
  /** Hard cap on a single answer, so a stuck recognizer cannot hang the wrap. */
  maxListenMs?: number;
  /** Auto-confirm a reviewed answer after this long untouched. 0 disables. */
  autoConfirmMs?: number;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(err: unknown): void;
}

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface ActiveTurn {
  transcript: string;
  cancelled: boolean;
  listening?: Deferred<void>;
  review?: Deferred<string>;
  silenceHandle?: unknown;
  maxListenHandle?: unknown;
  autoConfirmHandle?: unknown;
}

export class VoiceController {
  private readonly synth: SpeechSynthesizer;
  private readonly recognizer: SpeechRecognizer;
  private readonly timer: Timer;
  private readonly onEvent?: VoiceEventSink;
  private readonly silenceMs: number;
  private readonly maxListenMs: number;
  private readonly autoConfirmMs: number;

  private state: VoiceState = "idle";
  /** Screen-side subscribers, added and removed as a screen mounts/unmounts. */
  private readonly listeners = new Set<VoiceEventSink>();

  /** The turn in flight. Null between questions. */
  private turn: ActiveTurn | null = null;

  constructor(options: VoiceControllerOptions) {
    this.synth = options.synth;
    this.recognizer = options.recognizer;
    this.timer = options.timer ?? realTimer;
    if (options.onEvent) this.onEvent = options.onEvent;
    this.silenceMs = options.silenceMs ?? 2500;
    this.maxListenMs = options.maxListenMs ?? 60_000;
    this.autoConfirmMs = options.autoConfirmMs ?? 0;
  }

  getState(): VoiceState {
    return this.state;
  }

  /** Subscribe a screen to voice events; returns an unsubscribe. */
  subscribe(listener: VoiceEventSink): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: VoiceEvent): void {
    this.onEvent?.(event);
    for (const listener of this.listeners) listener(event);
  }

  private setState(state: VoiceState): void {
    this.state = state;
    this.emit({ type: "state", state });
  }

  /**
   * Ask one question aloud and resolve with the confirmed answer.
   *
   * This is passed to a flow as its `askUser`. It rejects with
   * `VoiceCancelledError` if the user backs out mid-question.
   */
  async askUser(question: string): Promise<string> {
    if (this.turn) throw new Error("A voice turn is already in progress.");
    const turn: ActiveTurn = { transcript: "", cancelled: false };
    this.turn = turn;

    try {
      // 1. Speak the question. `skipSpeaking` stops playback early.
      this.setState("speaking");
      this.emit({ type: "question", text: question });
      await this.synth.speak(question);
      this.throwIfCancelled();

      // 2. Listen. Partials refresh the transcript and reset the silence timer.
      this.setState("listening");
      turn.listening = defer<void>();
      this.recognizer.start(this.handlers());
      this.armMaxListen();
      await turn.listening.promise;
      this.throwIfCancelled();

      // 3. Review. Show the answer; auto-confirm if untouched, but any edit
      //    cancels that so the user always wins the race.
      this.setState("reviewing");
      this.emit({ type: "transcript", text: turn.transcript, isFinal: true });
      turn.review = defer<string>();
      this.armAutoConfirm();
      const answer = await turn.review.promise;

      this.setState("done");
      return answer;
    } finally {
      this.clearTimers();
      this.turn = null;
    }
  }

  // ------------------------------------------------------------------
  // UI-driven controls, acting on the turn in flight.
  // ------------------------------------------------------------------

  /** Barge-in: stop the question early and start listening now. */
  skipSpeaking(): void {
    if (this.state === "speaking") this.synth.stop();
  }

  /** End listening now (the user tapped "done"). */
  stopListening(): void {
    if (this.state === "listening") this.recognizer.stop();
  }

  /** The user edited the transcript; keep it and cancel any auto-confirm. */
  editTranscript(text: string): void {
    if (!this.turn) return;
    this.turn.transcript = text;
    this.clearAutoConfirm();
    this.emit({ type: "transcript", text, isFinal: true });
  }

  /** Accept the answer, optionally replacing it with edited text. */
  confirm(text?: string): void {
    const turn = this.turn;
    if (!turn?.review) return;
    this.clearAutoConfirm();
    turn.review.resolve(text ?? turn.transcript);
  }

  /** Back out of the whole question. Rejects `askUser`. */
  cancel(): void {
    const turn = this.turn;
    if (!turn) return;
    turn.cancelled = true;
    this.recognizer.abort();
    this.synth.stop();
    this.setState("cancelled");
    const err = new VoiceCancelledError();
    turn.listening?.reject(err);
    turn.review?.reject(err);
  }

  // ------------------------------------------------------------------
  // Recognizer handlers.
  // ------------------------------------------------------------------

  private handlers(): RecognizerHandlers {
    return {
      onPartial: (text) => {
        const turn = this.turn;
        if (!turn) return;
        turn.transcript = text;
        this.emit({ type: "transcript", text, isFinal: false });
        this.armSilence();
      },
      onFinal: (text) => {
        const turn = this.turn;
        if (!turn) return;
        if (text) turn.transcript = text;
        turn.listening?.resolve();
      },
      onSpeechStart: () => {
        // Speech began: hold off the silence timer until it pauses again.
        this.clearSilence();
      },
      onEnd: () => {
        // Recognizer stopped without a separate final; take what we have.
        this.turn?.listening?.resolve();
      },
      onError: (message) => {
        this.emit({ type: "error", message });
        // An error should not strand the wrap. Fall through to review with
        // whatever was heard, so the user can type the answer instead.
        this.turn?.listening?.resolve();
      },
    };
  }

  // ------------------------------------------------------------------
  // Timers.
  // ------------------------------------------------------------------

  private armSilence(): void {
    this.clearSilence();
    if (!this.turn) return;
    this.turn.silenceHandle = this.timer.set(() => this.recognizer.stop(), this.silenceMs);
  }

  private clearSilence(): void {
    if (this.turn?.silenceHandle !== undefined) {
      this.timer.clear(this.turn.silenceHandle);
      this.turn.silenceHandle = undefined;
    }
  }

  private armMaxListen(): void {
    if (!this.turn) return;
    this.turn.maxListenHandle = this.timer.set(() => this.recognizer.stop(), this.maxListenMs);
  }

  private armAutoConfirm(): void {
    if (!this.turn || this.autoConfirmMs <= 0) return;
    this.turn.autoConfirmHandle = this.timer.set(() => this.confirm(), this.autoConfirmMs);
  }

  private clearAutoConfirm(): void {
    if (this.turn?.autoConfirmHandle !== undefined) {
      this.timer.clear(this.turn.autoConfirmHandle);
      this.turn.autoConfirmHandle = undefined;
    }
  }

  private clearTimers(): void {
    this.clearSilence();
    this.clearAutoConfirm();
    if (this.turn?.maxListenHandle !== undefined) {
      this.timer.clear(this.turn.maxListenHandle);
      this.turn.maxListenHandle = undefined;
    }
  }

  private throwIfCancelled(): void {
    if (this.turn?.cancelled) throw new VoiceCancelledError();
  }
}
