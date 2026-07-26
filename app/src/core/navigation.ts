/**
 * Which screen the app should show, given what it knows so far.
 *
 * Onboarding is a sequence of preconditions — a key, a git token, a chosen and
 * cloned repo, a configured vault — and the app shows the first one that is not
 * yet satisfied. Keeping that as a pure function (rather than scattering the
 * decision across screens) means the "stranger test" path (install → wrap,
 * never a terminal) can be reasoned about and tested without a device.
 */

export type Screen =
  | "onboarding-key" // no valid Anthropic key yet
  | "onboarding-git" // no GitHub token yet
  | "onboarding-repo" // token, but no vault repo chosen and cloned
  | "onboarding-not-a-vault" // cloned a repo that is not a chief-of-staff vault
  | "setup" // vault cloned but not configured (name/timezone missing)
  | "home"; // ready for the daily loop

export interface AppState {
  hasAnthropicKey: boolean;
  hasGitToken: boolean;
  /** A repo has been chosen and cloned into local storage. */
  vaultCloned: boolean;
  /** The clone is a chief-of-staff vault (has the marker files). */
  isVault: boolean;
  /** Name and timezone are present, so dated writes are safe. */
  vaultConfigured: boolean;
}

export function resolveScreen(state: AppState): Screen {
  if (!state.hasAnthropicKey) return "onboarding-key";
  if (!state.hasGitToken) return "onboarding-git";
  if (!state.vaultCloned) return "onboarding-repo";
  if (!state.isVault) return "onboarding-not-a-vault";
  if (!state.vaultConfigured) return "setup";
  return "home";
}

/** True once onboarding is fully behind the user. */
export function isOnboarded(state: AppState): boolean {
  return resolveScreen(state) === "home";
}
