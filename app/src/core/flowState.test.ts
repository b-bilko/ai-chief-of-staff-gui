import { describe, expect, it } from "vitest";

import { applyAgentEvent, applyVoiceEvent, initialFlowView, type FlowView } from "./flowState";
import type { AgentEvent } from "../agent/types";
import type { VoiceEvent } from "../voice/types";

/** Replay a mixed event stream through the reducers, as the app would. */
function reduce(events: (AgentEvent | VoiceEvent)[]): FlowView {
  return events.reduce((view, event) => {
    return isVoiceEvent(event) ? applyVoiceEvent(view, event) : applyAgentEvent(view, event);
  }, initialFlowView());
}

function isVoiceEvent(event: AgentEvent | VoiceEvent): event is VoiceEvent {
  return (
    event.type === "question" ||
    event.type === "transcript" ||
    event.type === "state" ||
    (event.type === "error" && "message" in event)
  );
}

describe("interview view state", () => {
  it("tracks the question counter across questions", () => {
    const view = reduce([
      { type: "question", text: "What was your biggest win today?" },
      { type: "state", state: "speaking" },
      { type: "state", state: "listening" },
      { type: "transcript", text: "Shipped the UI.", isFinal: true },
      { type: "question", text: "Any decisions?" },
    ]);
    expect(view.questionNumber).toBe(2);
    expect(view.question).toBe("Any decisions?");
    // A new question clears the previous answer.
    expect(view.transcript).toBe("");
  });

  it("follows the phase through a single question", () => {
    let view = initialFlowView();
    view = applyVoiceEvent(view, { type: "question", text: "Q" });
    view = applyVoiceEvent(view, { type: "state", state: "speaking" });
    expect(view.phase).toBe("speaking");
    view = applyVoiceEvent(view, { type: "state", state: "listening" });
    expect(view.phase).toBe("listening");
    view = applyVoiceEvent(view, { type: "transcript", text: "partial", isFinal: false });
    expect(view.transcriptFinal).toBe(false);
    view = applyVoiceEvent(view, { type: "state", state: "reviewing" });
    view = applyVoiceEvent(view, { type: "transcript", text: "final answer", isFinal: true });
    expect(view.phase).toBe("reviewing");
    expect(view.transcript).toBe("final answer");
    expect(view.transcriptFinal).toBe(true);
  });

  it("shows thinking between questions but not during a spoken turn", () => {
    // A stray thinking event mid-listening must not stomp the listening phase.
    let view = initialFlowView();
    view = applyVoiceEvent(view, { type: "state", state: "listening" });
    view = applyAgentEvent(view, { type: "thinking", text: "..." });
    expect(view.phase).toBe("listening");

    // But from idle it does move to thinking.
    view = applyAgentEvent(initialFlowView(), { type: "thinking", text: "..." });
    expect(view.phase).toBe("thinking");
  });

  it("treats a non-question tool call as the model working", () => {
    const working = applyAgentEvent(initialFlowView(), {
      type: "tool-call",
      name: "write_file",
      input: {},
    });
    expect(working.phase).toBe("thinking");

    // next_question is the interview handing a question to the UI, not working.
    const asking = applyAgentEvent(
      { ...initialFlowView(), phase: "listening" },
      { type: "tool-call", name: "next_question", input: {} },
    );
    expect(asking.phase).toBe("listening");
  });

  it("accumulates streamed prose for the briefing", () => {
    const view = reduce([
      { type: "text-delta", text: "Good morning. " },
      { type: "text-delta", text: "Three things are slipping." },
    ]);
    expect(view.spokenText).toBe("Good morning. Three things are slipping.");
    expect(view.phase).toBe("speaking");
  });

  it("carries the running cost from usage events", () => {
    const view = reduce([
      { type: "usage", turn: zeroUsage(), total: zeroUsage(), costUsd: 0.004 },
      { type: "usage", turn: zeroUsage(), total: zeroUsage(), costUsd: 0.011 },
    ]);
    expect(view.costUsd).toBeCloseTo(0.011, 6);
  });

  it("marks finished on done and keeps the final cost", () => {
    const view = reduce([{ type: "done", total: zeroUsage(), costUsd: 0.02 }]);
    expect(view.finished).toBe(true);
    expect(view.phase).toBe("done");
    expect(view.costUsd).toBe(0.02);
  });

  it("surfaces an error from either stream", () => {
    expect(applyVoiceEvent(initialFlowView(), { type: "error", message: "mic failed" }).error).toBe(
      "mic failed",
    );
    expect(
      applyAgentEvent(initialFlowView(), {
        type: "tool-result",
        name: "commit",
        isError: true,
        summary: "push rejected",
      }).error,
    ).toBe("push rejected");
  });
});

function zeroUsage() {
  return {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };
}
