/**
 * Validating a pasted Anthropic API key before the app trusts it.
 *
 * A cheap `GET /v1/models` is enough: it needs a real key, returns quickly, and
 * costs nothing. The point is to catch a typo at setup rather than at the first
 * wrap, and to tell "wrong key" apart from "no network" so onboarding can say
 * the right thing.
 */

export type KeyValidation =
  | { ok: true }
  | { ok: false; reason: "invalid-key" | "network" | "unexpected"; detail: string };

export interface ValidateKeyOptions {
  /** Injectable for tests; defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
}

const MODELS_URL = "https://api.anthropic.com/v1/models?limit=1";

export async function validateAnthropicKey(
  key: string,
  options: ValidateKeyOptions = {},
): Promise<KeyValidation> {
  const doFetch = options.fetch ?? globalThis.fetch;

  if (!key.trim()) return { ok: false, reason: "invalid-key", detail: "The key is empty." };

  let response: Response;
  try {
    response = await doFetch(MODELS_URL, {
      method: "GET",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
    });
  } catch (err) {
    return {
      ok: false,
      reason: "network",
      detail: err instanceof Error ? err.message : "Could not reach api.anthropic.com.",
    };
  }

  if (response.ok) return { ok: true };

  // 401/403 mean the key itself is the problem — actionable at setup.
  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: "invalid-key", detail: "Anthropic rejected this key." };
  }

  return {
    ok: false,
    reason: "unexpected",
    detail: `Unexpected response from Anthropic (HTTP ${response.status}).`,
  };
}
