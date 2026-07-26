/**
 * The device text-to-speech, wrapping `expo-speech` as a `SpeechSynthesizer`.
 *
 * Thin by design: `expo-speech` is fire-and-forget with callbacks, and all this
 * does is turn `speak` into a promise the turn-taking machine can await. Not
 * unit-tested — it is native, so it is exercised on a device.
 */

import * as Speech from "expo-speech";

import type { SpeechSynthesizer } from "./types";

export interface ExpoSynthOptions {
  /** BCP-47 tag, e.g. "en-US". Omit to use the system default voice. */
  language?: string;
  /** Slower than 1.0 reads more clearly; the wrap is not a race. */
  rate?: number;
  onError?: (error: Error) => void;
}

export function createExpoSynth(options: ExpoSynthOptions = {}): SpeechSynthesizer {
  let speaking = false;

  return {
    speak(text: string): Promise<void> {
      return new Promise<void>((resolve) => {
        speaking = true;
        const done = () => {
          speaking = false;
          resolve();
        };
        Speech.speak(text, {
          ...(options.language ? { language: options.language } : {}),
          ...(options.rate !== undefined ? { rate: options.rate } : {}),
          onDone: done,
          onStopped: done,
          onError: (error: Error) => {
            options.onError?.(error);
            // A speech failure must not strand the interview: fall through to
            // listening so the user can still answer.
            done();
          },
        });
      });
    },

    stop(): void {
      if (speaking) void Speech.stop();
    },
  };
}
