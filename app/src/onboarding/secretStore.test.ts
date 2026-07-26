import { describe, expect, it } from "vitest";

import { MemorySecretStore, SECRET_KEYS, maskSecret } from "./secretStore";

describe("maskSecret", () => {
  it("shows a prefix and suffix for a long secret, hiding the middle", () => {
    const masked = maskSecret("sk-ant-api03-abcdefghijklmnop-XYZ9");
    expect(masked).toBe("sk-ant…XYZ9");
    // The revealing middle is gone.
    expect(masked).not.toContain("abcdefgh");
  });

  it("fully hides a short secret behind dots", () => {
    expect(maskSecret("short")).toBe("•••••");
  });

  it("returns empty for an unset value so the UI can say 'not set'", () => {
    expect(maskSecret("")).toBe("");
    expect(maskSecret("   ")).toBe("");
  });
});

describe("MemorySecretStore", () => {
  it("round-trips, overwrites, and deletes a secret", async () => {
    const store = new MemorySecretStore();
    expect(await store.get(SECRET_KEYS.anthropicKey)).toBeNull();

    await store.set(SECRET_KEYS.anthropicKey, "sk-ant-one");
    expect(await store.get(SECRET_KEYS.anthropicKey)).toBe("sk-ant-one");

    await store.set(SECRET_KEYS.anthropicKey, "sk-ant-two");
    expect(await store.get(SECRET_KEYS.anthropicKey)).toBe("sk-ant-two");

    await store.delete(SECRET_KEYS.anthropicKey);
    expect(await store.get(SECRET_KEYS.anthropicKey)).toBeNull();
  });
});
