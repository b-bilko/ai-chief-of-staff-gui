/**
 * Controllable fakes for the speech capabilities and the clock, so the
 * turn-taking machine can be tested without a device or real time.
 */

import type {
  RecognizerHandlers,
  SpeechRecognizer,
  SpeechSynthesizer,
  Timer,
} from "../../src/voice/types";

/** A synthesizer whose playback finishes only when the test says so. */
export class FakeSynth implements SpeechSynthesizer {
  spoken: string[] = [];
  stopped = 0;
  private resolveActive: (() => void) | null = null;

  speak(text: string): Promise<void> {
    this.spoken.push(text);
    return new Promise((resolve) => {
      this.resolveActive = resolve;
    });
  }

  stop(): void {
    this.stopped++;
    this.finish();
  }

  /** Simulate playback completing on its own. */
  finish(): void {
    const resolve = this.resolveActive;
    this.resolveActive = null;
    resolve?.();
  }
}

/** A recognizer the test drives by hand through the handler callbacks. */
export class FakeRecognizer implements SpeechRecognizer {
  started = 0;
  stopped = 0;
  aborted = 0;
  private handlers: RecognizerHandlers | null = null;

  start(handlers: RecognizerHandlers): void {
    this.started++;
    this.handlers = handlers;
  }

  stop(): void {
    this.stopped++;
    // A real recognizer emits a final (or end) after stop; model the final.
    this.handlers?.onEnd();
  }

  abort(): void {
    this.aborted++;
    this.handlers = null;
  }

  // Test-driving helpers.
  partial(text: string): void {
    this.handlers?.onPartial(text);
  }
  final(text: string): void {
    this.handlers?.onFinal(text);
  }
  speechStart(): void {
    this.handlers?.onSpeechStart();
  }
  error(message: string): void {
    this.handlers?.onError(message);
  }
}

/** A clock the test advances explicitly; nothing fires until `advance`. */
export class FakeTimer implements Timer {
  private next = 1;
  private readonly pending = new Map<number, { fn: () => void; at: number }>();
  private now = 0;

  set(fn: () => void, ms: number): unknown {
    const id = this.next++;
    this.pending.set(id, { fn, at: this.now + ms });
    return id;
  }

  clear(handle: unknown): void {
    this.pending.delete(handle as number);
  }

  /** Advance time, firing every timer whose deadline has passed, in order. */
  advance(ms: number): void {
    this.now += ms;
    const due = [...this.pending.entries()]
      .filter(([, t]) => t.at <= this.now)
      .sort((a, b) => a[1].at - b[1].at);
    for (const [id, t] of due) {
      this.pending.delete(id);
      t.fn();
    }
  }
}
