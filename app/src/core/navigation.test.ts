import { describe, expect, it } from "vitest";

import { isOnboarded, resolveScreen, type AppState } from "./navigation";

const base: AppState = {
  hasAnthropicKey: false,
  hasGitToken: false,
  vaultCloned: false,
  isVault: false,
  vaultConfigured: false,
};

describe("resolveScreen", () => {
  it("walks onboarding in order as each precondition is met", () => {
    expect(resolveScreen(base)).toBe("onboarding-key");
    expect(resolveScreen({ ...base, hasAnthropicKey: true })).toBe("onboarding-git");
    expect(resolveScreen({ ...base, hasAnthropicKey: true, hasGitToken: true })).toBe(
      "onboarding-repo",
    );
  });

  it("flags a clone that is not a chief-of-staff vault", () => {
    expect(
      resolveScreen({
        ...base,
        hasAnthropicKey: true,
        hasGitToken: true,
        vaultCloned: true,
        isVault: false,
      }),
    ).toBe("onboarding-not-a-vault");
  });

  it("routes a cloned but unconfigured vault to setup", () => {
    expect(
      resolveScreen({
        hasAnthropicKey: true,
        hasGitToken: true,
        vaultCloned: true,
        isVault: true,
        vaultConfigured: false,
      }),
    ).toBe("setup");
  });

  it("reaches home only when everything is satisfied", () => {
    const ready: AppState = {
      hasAnthropicKey: true,
      hasGitToken: true,
      vaultCloned: true,
      isVault: true,
      vaultConfigured: true,
    };
    expect(resolveScreen(ready)).toBe("home");
    expect(isOnboarded(ready)).toBe(true);
    expect(isOnboarded(base)).toBe(false);
  });
});
