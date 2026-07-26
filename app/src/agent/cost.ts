/**
 * Turning token usage into dollars.
 *
 * The user pays Anthropic directly, so the app shows them the running cost
 * rather than hiding it. Seeing the number build trust; a surprise on the
 * monthly bill does the opposite.
 */

import type { Usage } from "./types";

/** Per-million-token prices, in USD. */
export interface ModelPricing {
  input: number;
  output: number;
  /** Cache writes cost more than input; reads cost far less. */
  cacheWriteMultiplier: number;
  cacheReadMultiplier: number;
}

/** Claude Opus 4.8 list pricing (per 1M tokens). */
export const OPUS_4_8: ModelPricing = {
  input: 5,
  output: 25,
  cacheWriteMultiplier: 1.25,
  cacheReadMultiplier: 0.1,
};

export function costOf(usage: Usage, pricing: ModelPricing = OPUS_4_8): number {
  const perToken = pricing.input / 1_000_000;
  const outPerToken = pricing.output / 1_000_000;
  return (
    usage.input_tokens * perToken +
    usage.output_tokens * outPerToken +
    usage.cache_creation_input_tokens * perToken * pricing.cacheWriteMultiplier +
    usage.cache_read_input_tokens * perToken * pricing.cacheReadMultiplier
  );
}
