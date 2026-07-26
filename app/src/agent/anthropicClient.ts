/**
 * The one file that knows the Anthropic SDK exists.
 *
 * Everything else in the agent layer is written against `LlmClient` and runs
 * under plain Node with a scripted model. This adapter maps that interface onto
 * `@anthropic-ai/sdk`: it streams (so the voice layer speaks as text arrives),
 * caches the system prompt (the wrap sends the same large prefix nine times in
 * a row, and the user pays for every token), and translates content blocks and
 * usage in both directions.
 *
 * It is not unit-tested here — it needs a network and a key, so it is verified
 * on device and in integration. The type checker is the gate that it lines up
 * with the SDK.
 */

import Anthropic from "@anthropic-ai/sdk";

import type {
  AssistantBlock,
  AssistantTurn,
  CreateParams,
  LlmClient,
  Message,
  StopReason,
  StreamCallbacks,
  Usage,
} from "./types";

const MODEL = "claude-opus-4-8";

export interface AnthropicClientOptions {
  apiKey: string;
  /** Streaming keeps this well clear of HTTP timeouts; interview turns are tiny. */
  maxTokens?: number;
  /**
   * React Native is not a browser, but some RN runtimes trip the SDK's
   * environment check. Set this if the client throws about browser use.
   */
  dangerouslyAllowBrowser?: boolean;
}

export function makeAnthropicClient(options: AnthropicClientOptions): LlmClient {
  const client = new Anthropic({
    apiKey: options.apiKey,
    ...(options.dangerouslyAllowBrowser ? { dangerouslyAllowBrowser: true } : {}),
  });
  const maxTokens = options.maxTokens ?? 16000;

  return {
    async createMessage(params: CreateParams, callbacks?: StreamCallbacks): Promise<AssistantTurn> {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: maxTokens,
        // Adaptive thinking is the recommended mode on Opus 4.8; the app never
        // guesses a fixed budget. Effort is the intelligence/cost dial per flow.
        thinking: { type: "adaptive" },
        output_config: { effort: params.effort },
        // A single cache breakpoint on the whole system prompt. The prefix is
        // byte-identical across a flow's turns, so after the first write every
        // later turn reads it back at a fraction of the cost.
        system: [{ type: "text", text: params.system, cache_control: { type: "ephemeral" } }],
        tools: params.tools,
        messages: params.messages.map(toSdkMessage),
      });

      stream.on("text", (delta) => callbacks?.onTextDelta?.(delta));
      stream.on("thinking", (delta) => callbacks?.onThinkingDelta?.(delta));

      const message = await stream.finalMessage();
      return {
        content: message.content.map(fromSdkBlock),
        stopReason: (message.stop_reason ?? "end_turn") as StopReason,
        usage: fromSdkUsage(message.usage),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Mapping between the loop's types and the SDK's.
// ---------------------------------------------------------------------------

function toSdkMessage(message: Message): Anthropic.MessageParam {
  if (message.role === "user") {
    if (typeof message.content === "string") return { role: "user", content: message.content };
    return {
      role: "user",
      content: message.content.map((block) => ({
        type: "tool_result" as const,
        tool_use_id: block.tool_use_id,
        content: block.content,
        ...(block.is_error ? { is_error: true } : {}),
      })),
    };
  }

  return {
    role: "assistant",
    content: message.content.map(toSdkBlock),
  };
}

function toSdkBlock(block: AssistantBlock): Anthropic.ContentBlockParam {
  switch (block.type) {
    case "text":
      return { type: "text", text: block.text };
    case "thinking":
      // Signature must survive the round trip untouched.
      return { type: "thinking", thinking: block.thinking, signature: block.signature ?? "" };
    case "redacted_thinking":
      return { type: "redacted_thinking", data: block.data };
    case "tool_use":
      return { type: "tool_use", id: block.id, name: block.name, input: block.input };
  }
}

function fromSdkBlock(block: Anthropic.ContentBlock): AssistantBlock {
  switch (block.type) {
    case "text":
      return { type: "text", text: block.text };
    case "thinking":
      return { type: "thinking", thinking: block.thinking, signature: block.signature };
    case "redacted_thinking":
      return { type: "redacted_thinking", data: block.data };
    case "tool_use":
      return {
        type: "tool_use",
        id: block.id,
        name: block.name,
        input: (block.input ?? {}) as Record<string, unknown>,
      };
    default:
      // Server-tool blocks and the like should not occur with this tool set;
      // fold anything unexpected into text rather than dropping it silently.
      return { type: "text", text: "" };
  }
}

function fromSdkUsage(usage: Anthropic.Usage): Usage {
  return {
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
  };
}
