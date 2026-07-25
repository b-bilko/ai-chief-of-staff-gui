/**
 * The device speech-to-text, wrapping `expo-speech-recognition` as a
 * `SpeechRecognizer`.
 *
 * On-device recognition is the whole point: `requiresOnDeviceRecognition` keeps
 * the audio of someone's evening wrap on their phone. It is the reason this
 * project is markdown rather than a web app, and shipping spoken journals to a
 * cloud transcriber would quietly undo it. The cost is weaker accuracy on names
 * and jargon, which the review-and-edit step upstream exists to catch.
 *
 * Not unit-tested — native, so exercised on a device.
 */

import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

import type { RecognizerHandlers, SpeechRecognizer } from "./types";

export interface ExpoRecognizerOptions {
  /** BCP-47 tag, e.g. "en-US". */
  lang?: string;
  /** Keep audio on the device. On by default, and the reason to prefer it. */
  onDevice?: boolean;
}

/**
 * Request microphone and speech-recognition permission.
 *
 * Call from onboarding, before the first wrap. `start` fails without it.
 */
export async function requestVoicePermissions(): Promise<boolean> {
  const response = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  return response.granted;
}

/** Whether the device can recognise speech at all (fails fast in onboarding). */
export function isRecognitionAvailable(): boolean {
  return ExpoSpeechRecognitionModule.isRecognitionAvailable();
}

export function createExpoRecognizer(options: ExpoRecognizerOptions = {}): SpeechRecognizer {
  let subscriptions: { remove(): void }[] = [];

  const clear = () => {
    for (const sub of subscriptions) sub.remove();
    subscriptions = [];
  };

  return {
    start(handlers: RecognizerHandlers): void {
      clear();

      subscriptions.push(
        ExpoSpeechRecognitionModule.addListener("result", (event) => {
          const text = event.results[0]?.transcript ?? "";
          if (event.isFinal) handlers.onFinal(text);
          else handlers.onPartial(text);
        }),
        ExpoSpeechRecognitionModule.addListener("speechstart", () => handlers.onSpeechStart()),
        ExpoSpeechRecognitionModule.addListener("error", (event) =>
          handlers.onError(event.message ?? event.error),
        ),
        ExpoSpeechRecognitionModule.addListener("end", () => {
          handlers.onEnd();
          clear();
        }),
      );

      // continuous + interimResults: the turn-taking machine decides when the
      // answer is done (via its silence timer), not the recognizer, so partials
      // stream and the final arrives when we call stop().
      ExpoSpeechRecognitionModule.start({
        lang: options.lang ?? "en-US",
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: options.onDevice ?? true,
        addsPunctuation: true,
      });
      // NOTE: the iOS audio-session category (play-and-record, keeping the
      // session alive for a screen-off ten-minute wrap) is a device-tuning
      // concern; set it here via `iosCategory` when validating on hardware.
    },

    stop(): void {
      ExpoSpeechRecognitionModule.stop();
    },

    abort(): void {
      ExpoSpeechRecognitionModule.abort();
      clear();
    },
  };
}
