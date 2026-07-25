/**
 * The message and event vocabulary the agent loop speaks.
 *
 * Deliberately independent of the Anthropic SDK's types. The loop, the tools,
 * and the flows are written against these, and only `anthropicClient.ts` knows
 * the SDK exists. That keeps the whole agent layer runnable under plain Node
 * (and testable with a scripted fake model) rather than requiring the SDK — and
 * insulates it from an SDK that behaves differently under Hermes.
 */

export type ToolInput = Record<string, unknown>;

/**
 * A block in an assistant turn.
 *
 * Thinking blocks carry their `signature`, and redacted thinking its opaque
 * `data`, because when the conversation continues on the same model these must
 * be echoed back exactly as received — the API rejects a turn whose thinking
 * has been altered or dropped. The loop passes assistant content straight back
 * into the transcript, so preserving the fields here is what keeps replay valid.
 */
export type AssistantBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string; signature?: string }
  | { type: "redacted_thinking"; data: string }
  | { type: "tool_use"; id: string; name: string; input: ToolInput };

/** A block sent back to the model in the following user turn. */
export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

/** A conversation message. Assistant content is always a block list. */
export type Message =
  | { role: "user"; content: string | ToolResultBlock[] }
  | { role: "assistant"; content: AssistantBlock[] };

export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "refusal" | "pause_turn";

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export function emptyUsage(): Usage {
  return {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };
}

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    cache_creation_input_tokens: a.cache_creation_input_tokens + b.cache_creation_input_tokens,
    cache_read_input_tokens: a.cache_read_input_tokens + b.cache_read_input_tokens,
  };
}

/** One completed assistant turn as the loop consumes it. */
export interface AssistantTurn {
  content: AssistantBlock[];
  stopReason: StopReason;
  usage: Usage;
}

/** A tool definition as the model sees it, plus its executor. */
export interface Tool {
  definition: {
    name: string;
    description: string;
    input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  };
  /** Run the tool. A thrown error becomes an `is_error` tool result. */
  execute(input: ToolInput): Promise<string>;
}

export interface CreateParams {
  system: string;
  messages: Message[];
  tools: Tool["definition"][];
  /** Thinking/token-spend dial: low for scripted interview turns, high for reasoning. */
  effort: "low" | "medium" | "high" | "xhigh" | "max";
}

export interface StreamCallbacks {
  onTextDelta?(text: string): void;
  onThinkingDelta?(text: string): void;
}

/**
 * The model, reduced to the one call the loop needs.
 *
 * The real implementation wraps the Anthropic SDK and streams; tests pass a
 * scripted fake. Streaming is surfaced through the callbacks so the loop can
 * feed text to the voice layer as it arrives, while still returning the full
 * turn for tool dispatch.
 */
export interface LlmClient {
  createMessage(params: CreateParams, callbacks?: StreamCallbacks): Promise<AssistantTurn>;
}

// ---------------------------------------------------------------------------
// Agent events — what a flow emits to the UI/voice layer.
// ---------------------------------------------------------------------------

export type AgentEvent =
  | { type: "thinking"; text: string }
  | { type: "text-delta"; text: string }
  | { type: "assistant-message"; text: string }
  | { type: "tool-call"; name: string; input: ToolInput }
  | { type: "tool-result"; name: string; isError: boolean; summary: string }
  | { type: "usage"; turn: Usage; total: Usage; costUsd: number }
  | { type: "done"; total: Usage; costUsd: number };

export type AgentEventSink = (event: AgentEvent) => void;
