/**
 * A scripted stand-in for the model, for driving the agent loop headlessly.
 *
 * Each `createMessage` call returns the next scripted turn. Turns can carry
 * text deltas so streaming callbacks are exercised too. This is how a whole
 * flow runs in a test with no network and no SDK.
 */

import type {
  AssistantBlock,
  AssistantTurn,
  CreateParams,
  LlmClient,
  StreamCallbacks,
  Usage,
} from "../../src/agent/types";

export function usage(partial: Partial<Usage> = {}): Usage {
  return {
    input_tokens: partial.input_tokens ?? 100,
    output_tokens: partial.output_tokens ?? 20,
    cache_creation_input_tokens: partial.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: partial.cache_read_input_tokens ?? 0,
  };
}

export function textTurn(text: string, deltas?: string[]): ScriptedTurn {
  return {
    content: [{ type: "text", text }],
    stopReason: "end_turn",
    usage: usage(),
    ...(deltas ? { deltas } : {}),
  };
}

export function toolTurn(
  name: string,
  input: Record<string, unknown>,
  id = `tool_${Math.random().toString(36).slice(2, 8)}`,
): ScriptedTurn {
  return {
    content: [{ type: "tool_use", id, name, input }],
    stopReason: "tool_use",
    usage: usage(),
  };
}

export interface ScriptedTurn extends AssistantTurn {
  /** Text chunks to feed to onTextDelta before the turn resolves. */
  deltas?: string[];
}

/** A model that returns a fixed sequence of turns, ignoring its input. */
export function scriptedModel(turns: ScriptedTurn[]): LlmClient & { calls: CreateParams[] } {
  const queue = [...turns];
  const calls: CreateParams[] = [];
  return {
    calls,
    async createMessage(params, callbacks) {
      // Snapshot: the loop mutates its messages array in place after this call,
      // so a reference would show the final state, not the state at call time.
      calls.push(structuredClone(params));
      const turn = queue.shift();
      if (!turn) throw new Error("scriptedModel ran out of turns");
      if (turn.deltas) for (const d of turn.deltas) callbacks?.onTextDelta?.(d);
      return turn;
    },
  };
}

/**
 * A model driven by a function of the running message list.
 *
 * Used where the response has to depend on what came before — the wrap, where
 * the note is assembled from the answers gathered in earlier turns.
 */
export function reactiveModel(
  respond: (params: CreateParams, callIndex: number) => AssistantTurn,
  callbacks?: (turn: AssistantTurn, cb?: StreamCallbacks) => void,
): LlmClient & { calls: CreateParams[] } {
  const calls: CreateParams[] = [];
  return {
    calls,
    async createMessage(params, cb) {
      const turn = respond(params, calls.length);
      calls.push(structuredClone(params));
      callbacks?.(turn, cb);
      return turn;
    },
  };
}

/** Pull every tool_result content out of the transcript, in order. */
export function toolResultsIn(params: CreateParams): string[] {
  const results: string[] = [];
  for (const message of params.messages) {
    if (message.role === "user" && Array.isArray(message.content)) {
      for (const block of message.content) results.push(block.content);
    }
  }
  return results;
}

/** Pull every tool_use block out of the transcript, in order. */
export function toolUsesIn(params: CreateParams): Extract<AssistantBlock, { type: "tool_use" }>[] {
  const uses: Extract<AssistantBlock, { type: "tool_use" }>[] = [];
  for (const message of params.messages) {
    if (message.role === "assistant") {
      for (const block of message.content) if (block.type === "tool_use") uses.push(block);
    }
  }
  return uses;
}
