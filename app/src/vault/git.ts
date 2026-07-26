/**
 * Git operations on the vault, and the guards that keep a life record from
 * ending up where it should not.
 *
 * isomorphic-git supplies the plumbing; this module supplies the policy the
 * vault's operating instructions demand:
 *
 * - **Stage exact paths, never `add -A`.** The user edits these files by hand
 *   and a desktop session writes to them too. A blanket stage sweeps whatever
 *   else is open into a commit named after a skill, and the history stops
 *   telling the truth about what changed.
 * - **Only ever a private, writable repo.** A push to a public or unowned
 *   repository is, in the words of the instructions, "the one mistake here that
 *   cannot be undone." The gate lives at setup; this module refuses to operate
 *   on a remote that has not passed it.
 * - **Never let a credential into the vault.** The API key and git token live
 *   in the device keystore. A pre-commit scan refuses to stage a file that
 *   looks like it carries one.
 * - **Fast-forward or stop.** Prose files do not merge cleanly on a phone, so a
 *   diverged remote is surfaced, not reconciled.
 */

import git, { type AuthCallback, type HttpClient } from "isomorphic-git";

import type { GitFs } from "./gitfs";

export interface RepoContext {
  fs: GitFs;
  http: HttpClient;
  /** Virtual directory the working tree lives in, e.g. "/vault". */
  dir: string;
  /** Remote HTTPS URL. */
  url: string;
  /** Supplies the git token; the token itself never leaves the keystore layer. */
  onAuth: AuthCallback;
  /** Written into commits; the profile name and a stable app identity. */
  author: { name: string; email: string };
  /** Progress/log sink for the caller's UI. */
  onMessage?: (message: string) => void;
}

// ---------------------------------------------------------------------------
// Repo safety gate
// ---------------------------------------------------------------------------

/** The fields of GitHub's repo API this gate reads. */
export interface RepoMetadata {
  private: boolean;
  permissions?: { push?: boolean };
  /** Full name, `owner/repo`, used only for message text. */
  full_name?: string;
}

export type GateFailure = "not-private" | "no-push-access";

export interface GateResult {
  ok: boolean;
  failures: GateFailure[];
  message: string;
}

/**
 * Decide whether a repo may back a vault.
 *
 * Two conditions, both required: the repo is private, and the authenticated
 * user can push to it. A public repo is not a warning to click past; it is a
 * dead end, because the record it would hold is not recoverable once exposed.
 * This also disposes of the "don't push to the public template" case for free:
 * the template is public, so it fails the private check.
 */
export function evaluateRepoGate(meta: RepoMetadata): GateResult {
  const failures: GateFailure[] = [];
  if (!meta.private) failures.push("not-private");
  if (meta.permissions?.push !== true) failures.push("no-push-access");

  const reasons: Record<GateFailure, string> = {
    "not-private":
      "the repository is public. A vault is a private record of a life and must live in a private repo.",
    "no-push-access": "you do not have push access to this repository.",
  };

  const message = failures.length
    ? `Cannot use ${meta.full_name ?? "this repository"}: ${failures.map((f) => reasons[f]).join(" ")}`
    : `${meta.full_name ?? "Repository"} is private and writable.`;

  return { ok: failures.length === 0, failures, message };
}

export class RepoGateError extends Error {
  constructor(readonly result: GateResult) {
    super(result.message);
    this.name = "RepoGateError";
  }
}

/** Throw unless the repo passes the gate. Call before clone and on remote change. */
export function assertRepoAllowed(meta: RepoMetadata): void {
  const result = evaluateRepoGate(meta);
  if (!result.ok) throw new RepoGateError(result);
}

// ---------------------------------------------------------------------------
// Secret scan
// ---------------------------------------------------------------------------

/**
 * Patterns for credentials that must never be committed.
 *
 * The two secrets this app holds are an Anthropic key and a git token; both
 * have recognisable prefixes. This is a backstop against a model or a stray
 * paste landing one in a note, not a general secret scanner.
 */
const SECRET_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "Anthropic API key", pattern: /sk-ant-[A-Za-z0-9_-]{8,}/ },
  { label: "GitHub token (classic)", pattern: /ghp_[A-Za-z0-9]{20,}/ },
  { label: "GitHub fine-grained token", pattern: /github_pat_[A-Za-z0-9_]{20,}/ },
  { label: "GitHub OAuth token", pattern: /gho_[A-Za-z0-9]{20,}/ },
];

export interface SecretHit {
  path: string;
  label: string;
}

/** Scan file contents for anything that looks like a stored credential. */
export function scanForSecrets(files: ReadonlyArray<{ path: string; content: string }>): SecretHit[] {
  const hits: SecretHit[] = [];
  for (const file of files) {
    for (const { label, pattern } of SECRET_PATTERNS) {
      if (pattern.test(file.content)) hits.push({ path: file.path, label });
    }
  }
  return hits;
}

export class SecretInVaultError extends Error {
  constructor(readonly hits: SecretHit[]) {
    super(
      `Refusing to commit: a credential was found in ${hits
        .map((h) => `${h.path} (${h.label})`)
        .join(", ")}. Secrets belong in the device keystore, never in the vault.`,
    );
    this.name = "SecretInVaultError";
  }
}

// ---------------------------------------------------------------------------
// Vault shape check
// ---------------------------------------------------------------------------

const VAULT_MARKERS = ["CLAUDE.md", "config/profile.md", "tracker.md"];

/**
 * Whether a cloned directory looks like a chief-of-staff vault.
 *
 * A connect-existing flow can point at any repo the user owns. Writing daily
 * notes into someone's unrelated project would be silent and confusing, so this
 * lets the UI warn before proceeding — without hard-blocking, since the user
 * may have a legitimately unusual layout.
 */
export async function looksLikeVault(ctx: Pick<RepoContext, "fs" | "dir">): Promise<boolean> {
  for (const marker of VAULT_MARKERS) {
    try {
      await ctx.fs.promises.stat(join(ctx.dir, marker));
    } catch {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export async function cloneVault(ctx: RepoContext): Promise<void> {
  await git.clone({
    fs: ctx.fs,
    http: ctx.http,
    dir: ctx.dir,
    url: ctx.url,
    onAuth: ctx.onAuth,
    singleBranch: true,
    depth: 1,
    onMessage: ctx.onMessage,
  });
}

export interface SyncResult {
  status: "up-to-date" | "fast-forwarded" | "diverged";
  /** On divergence, the message to surface; the app then goes read-only. */
  message?: string;
}

/**
 * Fetch and fast-forward the working branch, or report divergence.
 *
 * Never merges. If local and remote have both moved, prose files cannot be
 * reconciled on a phone, so the caller drops to read-only until it is sorted
 * out on the desktop.
 */
export async function fastForward(ctx: RepoContext): Promise<SyncResult> {
  const branch = await currentBranch(ctx);

  const before = await headOid(ctx, branch);
  await git.fetch({
    fs: ctx.fs,
    http: ctx.http,
    dir: ctx.dir,
    url: ctx.url,
    onAuth: ctx.onAuth,
    singleBranch: true,
    ref: branch,
    onMessage: ctx.onMessage,
  });
  const remote = await headOid(ctx, `refs/remotes/origin/${branch}`);

  if (remote === null || remote === before) return { status: "up-to-date" };

  // Fast-forward only: the remote must be a descendant of local HEAD.
  if (before !== null && !(await isAncestor(ctx, before, remote))) {
    return {
      status: "diverged",
      message:
        "This vault has changes on the server that don't build on what's here. " +
        "Resolve it on the desktop, then reopen the app. Editing is paused until then.",
    };
  }

  await git.merge({
    fs: ctx.fs,
    dir: ctx.dir,
    theirs: `refs/remotes/origin/${branch}`,
    fastForwardOnly: true,
    author: ctx.author,
  });
  await git.checkout({ fs: ctx.fs, dir: ctx.dir, ref: branch });
  return { status: "fast-forwarded" };
}

export interface CommitOptions {
  /** Exact working-tree-relative paths to stage. Never a wildcard. */
  paths: string[];
  message: string;
  /** Override the commit timestamp so it lands in the profile's day, not the device's. */
  committedAt?: Date;
}

/**
 * Stage the named paths, commit, and push.
 *
 * Staging is path-by-path by design. Each path is scanned for a credential
 * first; a hit aborts the whole commit rather than leaking a secret into
 * history where deletion does not truly remove it.
 */
export async function commitAndPush(
  ctx: RepoContext,
  options: CommitOptions,
): Promise<{ oid: string }> {
  await guardAgainstSecrets(ctx, options.paths);

  for (const path of options.paths) {
    if (await pathExists(ctx, path)) {
      await git.add({ fs: ctx.fs, dir: ctx.dir, filepath: path });
    } else {
      // A path the caller removed: stage the deletion explicitly.
      await git.remove({ fs: ctx.fs, dir: ctx.dir, filepath: path });
    }
  }

  const oid = await git.commit({
    fs: ctx.fs,
    dir: ctx.dir,
    message: options.message,
    author: { ...ctx.author, ...(options.committedAt ? { timestamp: unixSeconds(options.committedAt) } : {}) },
  });

  await pushCurrentBranch(ctx);
  return { oid };
}

export async function pushCurrentBranch(ctx: RepoContext): Promise<void> {
  const result = await git.push({
    fs: ctx.fs,
    http: ctx.http,
    dir: ctx.dir,
    url: ctx.url,
    onAuth: ctx.onAuth,
    onMessage: ctx.onMessage,
  });
  if (result.ok === false || result.error) {
    throw new Error(`Push rejected: ${result.error ?? "unknown reason"}`);
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function guardAgainstSecrets(ctx: RepoContext, paths: string[]): Promise<void> {
  const files: { path: string; content: string }[] = [];
  for (const path of paths) {
    if (!(await pathExists(ctx, path))) continue;
    try {
      const content = (await ctx.fs.promises.readFile(join(ctx.dir, path), "utf8")) as string;
      files.push({ path, content });
    } catch {
      // Unreadable-as-text (binary) files can't carry a pasted key; skip.
    }
  }
  const hits = scanForSecrets(files);
  if (hits.length > 0) throw new SecretInVaultError(hits);
}

async function pathExists(ctx: RepoContext, path: string): Promise<boolean> {
  try {
    await ctx.fs.promises.stat(join(ctx.dir, path));
    return true;
  } catch {
    return false;
  }
}

async function currentBranch(ctx: RepoContext): Promise<string> {
  const branch = await git.currentBranch({ fs: ctx.fs, dir: ctx.dir, fullname: false });
  if (!branch) throw new Error("Vault has no checked-out branch.");
  return branch;
}

async function headOid(ctx: RepoContext, ref: string): Promise<string | null> {
  try {
    return await git.resolveRef({ fs: ctx.fs, dir: ctx.dir, ref });
  } catch {
    return null;
  }
}

async function isAncestor(ctx: RepoContext, ancestor: string, descendant: string): Promise<boolean> {
  return git.isDescendent({ fs: ctx.fs, dir: ctx.dir, oid: descendant, ancestor });
}

function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/** Join a virtual dir and a working-tree-relative path. */
function join(dir: string, path: string): string {
  const base = dir.endsWith("/") ? dir.slice(0, -1) : dir;
  const rel = path.startsWith("/") ? path.slice(1) : path;
  return `${base}/${rel}`;
}
