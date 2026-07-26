/**
 * Turning the two event streams a flow produces — the agent loop's
 * `AgentEvent`s and the voice controller's `VoiceEvent`s — into the single
 * view state a screen renders.
 *
 * This is where the interview UX actually lives: the question counter, the live
 * transcript, whether the screen is speaking, listening, thinking, or waiting
 * for a confirm, and the running cost. It is a pure reducer so the mapping is
 * tested on Node; the screen is a thin projection of `FlowView` and holds no
 * logic of its own.
 */

import type { AgentEvent } from "../agent/types";
import type { VoiceEvent, VoiceState } from "../voice/types";

/** What the user is doing right now, for the big status indicator. */
export type Phase =
  | "idle"
  | "thinking" // the model is working (between the app and Anthropic)
  | "speaking" // a question is being read aloud
  | "listening" // waiting for / hearing the answer
  | "reviewing" // the answer is shown for confirmation
  | "done";

export interface FlowView {
  phase: Phase;
  /** The question currently being asked, spoken verbatim. */
  question: string | null;
  /** The live transcript of the current answer. */
  transcript: string;
  /** Whether the transcript is finalised (reviewing) or still forming. */
  transcriptFinal: boolean;
  /** How many questions have been asked so far. */
  questionNumber: number;
  /** Streaming assistant prose (used by the briefing, which just talks). */
  spokenText: string;
  /** Running cost in USD, shown so the user sees what they are spending. */
  costUsd: number;
  /** Set when the flow finishes. */
  finished: boolean;
  /** Set when something failed; the screen surfaces it. */
  error: string | null;
}

export function initialFlowView(): FlowView {
  return {
    phase: "idle",
    question: null,
    transcript: "",
    transcriptFinal: false,
    questionNumber: 0,
    spokenText: "",
    costUsd: 0,
    finished: false,
    error: null,
  };
}

const VOICE_TO_PHASE: Partial<Record<VoiceState, Phase>> = {
  speaking: "speaking",
  listening: "listening",
  reviewing: "reviewing",
};

/** Fold one agent event into the view. */
export function applyAgentEvent(view: FlowView, event: AgentEvent): FlowView {
  switch (event.type) {
    case "text-delta":
      // Streaming assistant prose — the briefing speaks this as it arrives.
      return { ...view, spokenText: view.spokenText + event.text, phase: "speaking" };
    case "thinking":
      // Only move to "thinking" from a settled phase, so it doesn't stomp an
      // active speaking/listening turn mid-stream.
      return view.phase === "idle" || view.phase === "done"
        ? { ...view, phase: "thinking" }
        : view;
    case "tool-call":
      // A tool call means the model handed off; it is working, not talking.
      return event.name === "next_question" ? view : { ...view, phase: "thinking" };
    case "usage":
      return { ...view, costUsd: event.costUsd };
    case "done":
      return { ...view, phase: "done", finished: true, costUsd: event.costUsd };
    case "tool-result":
      return event.isError ? { ...view, error: event.summary } : view;
    default:
      return view;
  }
}

/** Fold one voice event into the view. */
export function applyVoiceEvent(view: FlowView, event: VoiceEvent): FlowView {
  switch (event.type) {
    case "question":
      // A fresh question: bump the counter, clear the previous answer.
      return {
        ...view,
        question: event.text,
        questionNumber: view.questionNumber + 1,
        transcript: "",
        transcriptFinal: false,
      };
    case "transcript":
      return { ...view, transcript: event.text, transcriptFinal: event.isFinal };
    case "state": {
      const phase = VOICE_TO_PHASE[event.state];
      return phase ? { ...view, phase } : view;
    }
    case "error":
      return { ...view, error: event.message };
    default:
      return view;
  }
}
