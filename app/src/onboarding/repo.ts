/**
 * Choosing and preparing a vault repo — the safety-critical middle of setup.
 *
 * The one rule that cannot bend: the app only works with a **private** repo the
 * user can push to. That gate runs here, before any clone, for both paths —
 * connecting an existing repo and creating a new one from the template. A public
 * repo is a dead end, not a warning to click past, because a life record exposed
 * cannot be un-exposed. The gate also disposes of "don't push to the public
 * template" for free: the template is public, so it fails the same check.
 *
 * After a clone, `assessVault` decides what happens next: a populated vault goes
 * straight to the daily loop, an empty one runs the setup interview, and a repo
 * that is not a chief-of-staff vault at all is flagged rather than written into.
 */

import { assertRepoAllowed, looksLikeVault, type RepoMetadata } from "../vault/git";
import type { GitFs } from "../vault/gitfs";
import { Vault } from "../vault/fs";
import { parseProfile, parseSeason, setupState } from "../vault/config";
import type { GitHubClient, RepoSummary } from "./github";

/** Everything a clone needs, produced only after the gate passes. */
export interface CloneSpec {
  cloneUrl: string;
  defaultBranch: string;
  fullName: string;
}

function toCloneSpec(repo: RepoSummary): CloneSpec {
  return { cloneUrl: repo.cloneUrl, defaultBranch: repo.defaultBranch, fullName: repo.fullName };
}

/** The template the "create new" path forks from. */
export const TEMPLATE = { owner: "derrekyoung", repo: "ai-chief-of-staff" } as const;

/**
 * Prepare an existing repo for cloning, gating on private + push access.
 *
 * Throws `RepoGateError` (via `assertRepoAllowed`) if the repo is public or the
 * user cannot push. Nothing is cloned when it throws.
 */
export async function prepareExistingRepo(
  client: GitHubClient,
  token: string,
  owner: string,
  name: string,
): Promise<CloneSpec> {
  const repo = await client.getRepo(token, owner, name);
  assertRepoAllowed(repo as RepoMetadata);
  return toCloneSpec(repo);
}

/**
 * Create a fresh private vault from the template and prepare it for cloning.
 *
 * The gate still runs on the result — it should always pass (the repo is created
 * private), but a defence in depth against an API that returns something else.
 */
export async function prepareNewRepo(
  client: GitHubClient,
  token: string,
  owner: string,
  name: string,
): Promise<CloneSpec> {
  const repo = await client.createFromTemplate(token, {
    templateOwner: TEMPLATE.owner,
    templateRepo: TEMPLATE.repo,
    owner,
    name,
  });
  assertRepoAllowed(repo as RepoMetadata);
  return toCloneSpec(repo);
}

/** Only the private repos that are plausibly a chief-of-staff vault or empty. */
export function selectableRepos(repos: RepoSummary[]): RepoSummary[] {
  return repos.filter((r) => r.private);
}

export type VaultReadiness =
  | { kind: "ready" } // a configured vault: go to the daily loop
  | { kind: "needs-setup" } // a vault whose config is not filled in yet
  | { kind: "not-a-vault"; missing: string[] }; // warn before writing into it

/**
 * Look at a freshly cloned working tree and decide what the app should do.
 *
 * `dir` is the virtual git root the vault was cloned into.
 */
export async function assessVault(fs: GitFs, dir: string): Promise<VaultReadiness> {
  if (!(await looksLikeVault({ fs, dir }))) {
    return { kind: "not-a-vault", missing: ["CLAUDE.md / config/profile.md / tracker.md"] };
  }

  const vault = new Vault(fs, dir);
  const profile = parseProfile(await readOrEmpty(vault, "config/profile.md"));
  const season = parseSeason(await readOrEmpty(vault, "config/season.md"));
  const state = setupState({ profile, season });

  return state.complete ? { kind: "ready" } : { kind: "needs-setup" };
}

async function readOrEmpty(vault: Vault, path: string): Promise<string> {
  try {
    return await vault.readText(path);
  } catch {
    return "";
  }
}
