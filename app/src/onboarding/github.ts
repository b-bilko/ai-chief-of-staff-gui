/**
 * A small GitHub client for onboarding: authenticate, list the user's private
 * repos, read a repo's metadata, and create a private vault from the template.
 *
 * Authentication is the OAuth **device flow** — the app shows a code, the user
 * approves it in a browser, and no client secret is embedded (device flow uses
 * a public client id). That turns the README's multi-step "press Use this
 * template, set it Private, check the remote" into one approval, and the token
 * it returns also lists repos so choosing a vault is a picker, not a paste.
 *
 * `fetch` and `sleep` are injected so the poll loop is tested without real time
 * or a real network.
 */

import type { RepoMetadata } from "../vault/git";

export interface GitHubClientOptions {
  /** Public OAuth app client id (not a secret). */
  clientId: string;
  fetch?: typeof globalThis.fetch;
  /** Injectable delay for the device-flow poll; defaults to real time. */
  sleep?: (ms: number) => Promise<void>;
}

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  /** Seconds between polls, per GitHub. */
  interval: number;
  /** Seconds until the code expires. */
  expiresIn: number;
}

export interface RepoSummary {
  fullName: string;
  owner: string;
  name: string;
  private: boolean;
  cloneUrl: string;
  defaultBranch: string;
  pushedAt: string | null;
}

export class GitHubAuthError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "GitHubAuthError";
  }
}

const DEVICE_CODE_URL = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const API = "https://api.github.com";
const SCOPE = "repo"; // read+write to the user's repositories, public and private

export function createGitHubClient(options: GitHubClientOptions) {
  const doFetch = options.fetch ?? globalThis.fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  async function json<T>(response: Response): Promise<T> {
    const body = (await response.json()) as T;
    return body;
  }

  const apiHeaders = (token: string): Record<string, string> => ({
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  });

  return {
    /** Ask GitHub for a device code to show the user. */
    async startDeviceFlow(): Promise<DeviceCode> {
      const response = await doFetch(DEVICE_CODE_URL, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: options.clientId, scope: SCOPE }),
      });
      const body = await json<{
        device_code: string;
        user_code: string;
        verification_uri: string;
        interval: number;
        expires_in: number;
      }>(response);
      return {
        deviceCode: body.device_code,
        userCode: body.user_code,
        verificationUri: body.verification_uri,
        interval: body.interval,
        expiresIn: body.expires_in,
      };
    },

    /**
     * Poll until the user approves, then return the access token.
     *
     * Honours GitHub's back-off protocol: `authorization_pending` keeps waiting,
     * `slow_down` widens the interval, anything else is terminal.
     */
    async pollForToken(code: DeviceCode): Promise<string> {
      let interval = code.interval;
      // Elapsed wall-clock for the poll deadline, not a vault date.
      const deadline = Date.now() + code.expiresIn * 1000; // dates-guard-ok
      while (Date.now() < deadline) { // dates-guard-ok: elapsed poll time
        await sleep(interval * 1000);
        const response = await doFetch(ACCESS_TOKEN_URL, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: options.clientId,
            device_code: code.deviceCode,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          }),
        });
        const body = await json<{ access_token?: string; error?: string; interval?: number }>(response);

        if (body.access_token) return body.access_token;
        if (body.error === "authorization_pending") continue;
        if (body.error === "slow_down") {
          interval = body.interval ?? interval + 5;
          continue;
        }
        throw new GitHubAuthError(body.error ?? "unknown", `Device authorization failed: ${body.error}`);
      }
      throw new GitHubAuthError("expired_token", "The code expired before you approved it.");
    },

    /** The authenticated user's login. */
    async getViewerLogin(token: string): Promise<string> {
      const response = await doFetch(`${API}/user`, { headers: apiHeaders(token) });
      const body = await json<{ login: string }>(response);
      return body.login;
    },

    /** The user's private repositories, newest activity first. */
    async listPrivateRepos(token: string): Promise<RepoSummary[]> {
      const repos: RepoSummary[] = [];
      for (let page = 1; page <= 10; page++) {
        const url = `${API}/user/repos?visibility=private&affiliation=owner,collaborator&sort=pushed&per_page=100&page=${page}`;
        const response = await doFetch(url, { headers: apiHeaders(token) });
        const batch = await json<GitHubRepo[]>(response);
        for (const r of batch) repos.push(toSummary(r));
        if (batch.length < 100) break;
      }
      return repos;
    },

    /** Metadata for a specific repo, including the private/push fields the gate reads. */
    async getRepo(token: string, owner: string, name: string): Promise<RepoMetadata & RepoSummary> {
      const response = await doFetch(`${API}/repos/${owner}/${name}`, { headers: apiHeaders(token) });
      if (response.status === 404) {
        throw new GitHubAuthError("not_found", `No repository ${owner}/${name}, or the token cannot see it.`);
      }
      const r = await json<GitHubRepo>(response);
      return {
        ...toSummary(r),
        private: r.private,
        full_name: r.full_name,
        ...(r.permissions ? { permissions: r.permissions } : {}),
      };
    },

    /**
     * Create a private repo from the chief-of-staff template, one tap.
     *
     * `private: true` is not optional here — the whole app refuses a public
     * vault, so it is created private from the start.
     */
    async createFromTemplate(
      token: string,
      params: { templateOwner: string; templateRepo: string; owner: string; name: string; description?: string },
    ): Promise<RepoMetadata & RepoSummary> {
      const response = await doFetch(
        `${API}/repos/${params.templateOwner}/${params.templateRepo}/generate`,
        {
          method: "POST",
          headers: apiHeaders(token),
          body: JSON.stringify({
            owner: params.owner,
            name: params.name,
            private: true,
            description: params.description ?? "My chief of staff vault",
          }),
        },
      );
      if (!response.ok) {
        const body = await json<{ message?: string }>(response).catch(() => ({ message: undefined }));
        throw new GitHubAuthError("create_failed", body.message ?? `Could not create repository (HTTP ${response.status}).`);
      }
      const r = await json<GitHubRepo>(response);
      return {
        ...toSummary(r),
        private: r.private,
        full_name: r.full_name,
        ...(r.permissions ? { permissions: r.permissions } : {}),
      };
    },
  };
}

export type GitHubClient = ReturnType<typeof createGitHubClient>;

interface GitHubRepo {
  full_name: string;
  name: string;
  owner: { login: string };
  private: boolean;
  clone_url: string;
  default_branch: string;
  pushed_at: string | null;
  permissions?: { push?: boolean };
}

function toSummary(r: GitHubRepo): RepoSummary {
  return {
    fullName: r.full_name,
    owner: r.owner.login,
    name: r.name,
    private: r.private,
    cloneUrl: r.clone_url,
    defaultBranch: r.default_branch,
    pushedAt: r.pushed_at,
  };
}
