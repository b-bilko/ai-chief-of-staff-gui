/**
 * The agent loop: send a turn, run any tools the model asked for, repeat until
 * it stops. A hand-written loop rather than the SDK's beta tool runner, because
 * it is fully mockable (a scripted model drives a whole flow headlessly) and
 * carries no beta dependency that might behave differently under Hermes.
 *
 * The one subtlety worth naming: a tool's `execute` may block. The interview
 * flows use that on purpose — the `next_question` tool speaks a question and
 * waits for the spoken answer, so the loop naturally pauses between questions
 * without any special casing here.
 */

import { costOf, type ModelPricing } from "./cost";
import {
  addUsage,
  emptyUsage,
  type AgentEventSink,
  type CreateParams,
  type LlmClient,
  type Message,
  type Tool,
  type ToolResultBlock,
  type Usage,
} from "./types";

export interface RunOptions {
  client: LlmClient;
  system: string;
  /** The opening turn(s). Usually a single user message. */
  initialMessages: Message[];
  tools: Tool[];
  effort?: CreateParams["effort"];
  onEvent?: AgentEventSink;
  pricing?: ModelPricing;
  /** Safety valve against a model that never stops calling tools. */
  maxTurns?: number;
}

export interface RunResult {
  /** Concatenated assistant text across the run. */
  text: string;
  /** Full transcript, so a flow can resume or inspect it. */
  messages: Message[];
  usage: Usage;
  costUsd: number;
}

export class MaxTurnsExceededError extends Error {
  constructor(readonly turns: number) {
    super(`Agent did not finish within ${turns} turns.`);
    this.name = "MaxTurnsExceededError";
  }
}

const DEFAULT_MAX_TURNS = 40;

export async function runAgent(options: RunOptions): Promise<RunResult> {
  const { client, system, tools, onEvent } = options;
  const effort = options.effort ?? "high";
  const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
  const definitions = tools.map((t) => t.definition);
  const byName = new Map(tools.map((t) => [t.definition.name, t]));

  const messages: Message[] = [...options.initialMessages];
  let total = emptyUsage();
  const textParts: string[] = [];

  for (let turn = 0; turn < maxTurns; turn++) {
    const assistant = await client.createMessage({ system, messages, tools: definitions, effort }, {
      onTextDelta: (text) => onEvent?.({ type: "text-delta", text }),
      onThinkingDelta: (text) => onEvent?.({ type: "thinking", text }),
    });

    total = addUsage(total, assistant.usage);
    onEvent?.({ type: "usage", turn: assistant.usage, total, costUsd: costOf(total, options.pricing) });

    messages.push({ role: "assistant", content: assistant.content });

    const turnText = assistant.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (turnText) {
      textParts.push(turnText);
      onEvent?.({ type: "assistant-message", text: turnText });
    }

    if (assistant.stopReason !== "tool_use") {
      onEvent?.({ type: "done", total, costUsd: costOf(total, options.pricing) });
      return { text: textParts.join("\n"), messages, usage: total, costUsd: costOf(total, options.pricing) };
    }

    const toolUses = assistant.content.filter(
      (b): b is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
        b.type === "tool_use",
    );

    const results: ToolResultBlock[] = [];
    for (const use of toolUses) {
      onEvent?.({ type: "tool-call", name: use.name, input: use.input });
      const tool = byName.get(use.name);
      if (!tool) {
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: `No such tool: ${use.name}`,
          is_error: true,
        });
        onEvent?.({ type: "tool-result", name: use.name, isError: true, summary: "unknown tool" });
        continue;
      }
      try {
        const content = await tool.execute(use.input);
        results.push({ type: "tool_result", tool_use_id: use.id, content });
        onEvent?.({ type: "tool-result", name: use.name, isError: false, summary: firstLine(content) });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ type: "tool_result", tool_use_id: use.id, content: message, is_error: true });
        onEvent?.({ type: "tool-result", name: use.name, isError: true, summary: message });
      }
    }

    messages.push({ role: "user", content: results });
  }

  throw new MaxTurnsExceededError(maxTurns);
}

function firstLine(text: string): string {
  const line = text.split("\n", 1)[0] ?? "";
  return line.length > 120 ? `${line.slice(0, 117)}...` : line;
}
