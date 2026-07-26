import { describe, expect, it, vi } from "vitest";

import { MaxTurnsExceededError, runAgent } from "./session";
import type { AgentEvent, Tool } from "./types";
import { scriptedModel, textTurn, toolTurn, usage } from "../../test/support/fakeModel";

/** A tool that records its inputs and returns a canned string. */
function recordingTool(name: string, result = "ok"): Tool & { inputs: unknown[] } {
  const inputs: unknown[] = [];
  return {
    inputs,
    definition: { name, description: `test ${name}`, input_schema: { type: "object", properties: {} } },
    async execute(input) {
      inputs.push(input);
      return result;
    },
  };
}

function collect(): { events: AgentEvent[]; onEvent: (e: AgentEvent) => void } {
  const events: AgentEvent[] = [];
  return { events, onEvent: (e) => events.push(e) };
}

describe("runAgent", () => {
  it("dispatches a tool then finishes, threading results back to the model", async () => {
    const tool = recordingTool("write_file", "Wrote note.md");
    const client = scriptedModel([
      toolTurn("write_file", { path: "note.md", content: "x" }, "t1"),
      textTurn("Done."),
    ]);

    const result = await runAgent({
      client,
      system: "sys",
      initialMessages: [{ role: "user", content: "go" }],
      tools: [tool],
    });

    expect(tool.inputs).toEqual([{ path: "note.md", content: "x" }]);
    expect(result.text).toBe("Done.");

    // The second call must carry the tool result as a user message.
    const secondCall = client.calls[1]!;
    const lastMessage = secondCall.messages[secondCall.messages.length - 1]!;
    expect(lastMessage).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "t1", content: "Wrote note.md" }],
    });
  });

  it("turns a tool error into an is_error result and lets the model recover", async () => {
    const failing: Tool = {
      definition: { name: "boom", description: "x", input_schema: { type: "object", properties: {} } },
      async execute() {
        throw new Error("path escapes the vault");
      },
    };
    const client = scriptedModel([toolTurn("boom", {}, "t1"), textTurn("Recovered.")]);

    const result = await runAgent({
      client,
      system: "s",
      initialMessages: [{ role: "user", content: "go" }],
      tools: [failing],
    });

    const secondCall = client.calls[1]!;
    const lastMessage = secondCall.messages[secondCall.messages.length - 1]!;
    expect(lastMessage).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "t1", content: "path escapes the vault", is_error: true }],
    });
    expect(result.text).toBe("Recovered.");
  });

  it("reports an unknown tool as an error rather than crashing", async () => {
    const client = scriptedModel([toolTurn("nonexistent", {}, "t1"), textTurn("ok")]);
    const { events, onEvent } = collect();

    await runAgent({
      client,
      system: "s",
      initialMessages: [{ role: "user", content: "go" }],
      tools: [],
      onEvent,
    });

    const toolResult = events.find((e) => e.type === "tool-result");
    expect(toolResult).toMatchObject({ isError: true });
  });

  it("accumulates usage and reports cost", async () => {
    const client = scriptedModel([
      { ...toolTurn("noop", {}, "t1"), usage: usage({ input_tokens: 1000, output_tokens: 200 }) },
      { ...textTurn("done"), usage: usage({ input_tokens: 500, output_tokens: 100 }) },
    ]);
    const { events, onEvent } = collect();

    const result = await runAgent({
      client,
      system: "s",
      initialMessages: [{ role: "user", content: "go" }],
      tools: [recordingTool("noop")],
      onEvent,
    });

    expect(result.usage.input_tokens).toBe(1500);
    expect(result.usage.output_tokens).toBe(300);
    // 1500 in @ $5/M + 300 out @ $25/M = 0.0075 + 0.0075 = 0.015.
    expect(result.costUsd).toBeCloseTo(0.015, 6);

    const done = events.find((e) => e.type === "done");
    expect(done).toMatchObject({ costUsd: expect.any(Number) });
  });

  it("forwards streaming text deltas to the voice layer", async () => {
    const client = scriptedModel([textTurn("Hello there.", ["Hello ", "there."])]);
    const onText = vi.fn();

    await runAgent({
      client,
      system: "s",
      initialMessages: [{ role: "user", content: "go" }],
      tools: [],
      onEvent: (e) => {
        if (e.type === "text-delta") onText(e.text);
      },
    });

    expect(onText.mock.calls.map((c) => c[0])).toEqual(["Hello ", "there."]);
  });

  it("stops runaway loops with MaxTurnsExceededError", async () => {
    // A model that only ever calls tools would loop forever without the guard.
    const client = {
      async createMessage() {
        return toolTurn("noop", {}, "t");
      },
    };

    await expect(
      runAgent({
        client,
        system: "s",
        initialMessages: [{ role: "user", content: "go" }],
        tools: [recordingTool("noop")],
        maxTurns: 5,
      }),
    ).rejects.toBeInstanceOf(MaxTurnsExceededError);
  });

  it("runs multiple tool calls in one turn and returns all results together", async () => {
    const a = recordingTool("read_file", "content-a");
    const b = recordingTool("list_files", "content-b");
    const client = scriptedModel([
      {
        content: [
          { type: "tool_use", id: "t1", name: "read_file", input: { path: "a" } },
          { type: "tool_use", id: "t2", name: "list_files", input: {} },
        ],
        stopReason: "tool_use",
        usage: usage(),
      },
      textTurn("both done"),
    ]);

    await runAgent({
      client,
      system: "s",
      initialMessages: [{ role: "user", content: "go" }],
      tools: [a, b],
    });

    const secondCall = client.calls[1]!;
    const lastMessage = secondCall.messages[secondCall.messages.length - 1]!;
    expect(lastMessage).toEqual({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "t1", content: "content-a" },
        { type: "tool_result", tool_use_id: "t2", content: "content-b" },
      ],
    });
  });
});
