import { describe, expect, it, vi } from "vitest";

import { validateAnthropicKey } from "./anthropic";

function jsonResponse(status: number): Response {
  return new Response(status === 200 ? '{"data":[]}' : '{"error":{}}', { status });
}

describe("validateAnthropicKey", () => {
  it("accepts a key the API answers for", async () => {
    const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => jsonResponse(200));
    const result = await validateAnthropicKey("sk-ant-real", { fetch });
    expect(result).toEqual({ ok: true });

    // Sanity: it sent the key and the API version, and asked for little.
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toContain("/v1/models");
    expect((init!.headers as Record<string, string>)["x-api-key"]).toBe("sk-ant-real");
  });

  it("calls a 401 an invalid key, not a network problem", async () => {
    const result = await validateAnthropicKey("sk-ant-wrong", { fetch: async () => jsonResponse(401) });
    expect(result).toEqual({ ok: false, reason: "invalid-key", detail: expect.any(String) });
  });

  it("distinguishes a network failure so setup can say the right thing", async () => {
    const result = await validateAnthropicKey("sk-ant-x", {
      fetch: async () => {
        throw new Error("getaddrinfo ENOTFOUND");
      },
    });
    expect(result).toMatchObject({ ok: false, reason: "network" });
  });

  it("rejects an empty key without a request", async () => {
    const fetch = vi.fn();
    const result = await validateAnthropicKey("   ", { fetch });
    expect(result).toMatchObject({ ok: false, reason: "invalid-key" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports an unexpected status distinctly", async () => {
    const result = await validateAnthropicKey("sk-ant-x", { fetch: async () => jsonResponse(500) });
    expect(result).toMatchObject({ ok: false, reason: "unexpected" });
  });
});
