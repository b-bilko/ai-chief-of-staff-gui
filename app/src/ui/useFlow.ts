/**
 * The bridge from a flow to a screen.
 *
 * A flow emits two streams — the agent loop's events and, for interviews, the
 * voice controller's events. This hook folds both into a single `FlowView`
 * (via the tested reducers) and exposes the handful of controls a screen wires
 * to buttons: confirm, edit, skip, stop, cancel. The screen itself stays a
 * dumb projection of `view`.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { applyAgentEvent, applyVoiceEvent, initialFlowView, type FlowView } from "../core/flowState";
import type { AgentEvent } from "../agent/types";
import type { RunResult } from "../agent/session";
import type { VoiceController } from "../voice/turnTaking";
import { VoiceCancelledError } from "../voice/types";

export interface UseFlowOptions {
  /** Start the flow, passing along an agent-event sink. */
  start: (onEvent: (event: AgentEvent) => void) => Promise<RunResult>;
  /** Present for interview flows (wrap, setup); absent for briefing/capture. */
  voice?: VoiceController;
}

export interface FlowControls {
  confirm: (text?: string) => void;
  edit: (text: string) => void;
  skip: () => void;
  stopListening: () => void;
  cancel: () => void;
}

export interface UseFlow {
  view: FlowView;
  running: boolean;
  begin: () => void;
  controls: FlowControls;
}

export function useFlow(options: UseFlowOptions): UseFlow {
  const [view, setView] = useState<FlowView>(initialFlowView);
  const [running, setRunning] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Always clean up the voice subscription if the screen unmounts mid-flow.
  useEffect(() => () => unsubscribeRef.current?.(), []);

  const begin = useCallback(() => {
    if (running) return;
    setView(initialFlowView());
    setRunning(true);

    if (options.voice) {
      unsubscribeRef.current = options.voice.subscribe((event) =>
        setView((v) => applyVoiceEvent(v, event)),
      );
    }

    options
      .start((event) => setView((v) => applyAgentEvent(v, event)))
      .catch((err: unknown) => {
        // A user cancel is not an error to surface.
        if (err instanceof VoiceCancelledError) return;
        const message = err instanceof Error ? err.message : String(err);
        setView((v) => ({ ...v, error: message }));
      })
      .finally(() => {
        unsubscribeRef.current?.();
        unsubscribeRef.current = null;
        setRunning(false);
      });
  }, [options, running]);

  const controls: FlowControls = {
    confirm: (text) => options.voice?.confirm(text),
    edit: (text) => options.voice?.editTranscript(text),
    skip: () => options.voice?.skipSpeaking(),
    stopListening: () => options.voice?.stopListening(),
    cancel: () => options.voice?.cancel(),
  };

  return { view, running, begin, controls };
}
