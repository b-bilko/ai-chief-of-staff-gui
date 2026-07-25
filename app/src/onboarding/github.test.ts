import { describe, expect, it, vi } from "vitest";

import { GitHubAuthError, createGitHubClient } from "./github";

const noSleep = async () => {};

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

/** A fetch mock that returns queued responses by URL substring. */
function router(routes: { match: string; responses: Response[] }[]): typeof globalThis.fetch {
  const queues = routes.map((r) => ({ match: r.match, queue: [...r.responses] }));
  return (async (url: string | URL) => {
    const href = String(url);
    for (const route of queues) {
      if (href.includes(route.match)) {
        const next = route.queue.shift();
        if (next) return next;
      }
    }
    throw new Error(`No mock response for ${href}`);
  }) as typeof globalThis.fetch;
}

describe("device flow", () => {
  it("returns a code to show the user", async () => {
    const fetch = router([
      {
        match: "device/code",
        responses: [
          ok({ device_code: "dev123", user_code: "WXYZ-1234", verification_uri: "https://github.com/login/device", interval: 5, expires_in: 900 }),
        ],
      },
    ]);
    const client = createGitHubClient({ clientId: "cli", fetch, sleep: noSleep });
    const code = await client.startDeviceFlow();
    expect(code.userCode).toBe("WXYZ-1234");
    expect(code.deviceCode).toBe("dev123");
    expect(code.interval).toBe(5);
  });

  it("polls through pending and slow_down, then returns the token", async () => {
    const fetch = router([
      {
        match: "oauth/access_token",
        responses: [
          ok({ error: "authorization_pending" }),
          ok({ error: "slow_down", interval: 10 }),
          ok({ access_token: "gho_thetoken" }),
        ],
      },
    ]);
    const client = createGitHubClient({ clientId: "cli", fetch, sleep: noSleep });
    const token = await client.pollForToken({
      deviceCode: "dev123",
      userCode: "X",
      verificationUri: "u",
      interval: 5,
      expiresIn: 900,
    });
    expect(token).toBe("gho_thetoken");
  });

  it("surfaces a terminal device-flow error", async () => {
    const fetch = router([{ match: "oauth/access_token", responses: [ok({ error: "access_denied" })] }]);
    const client = createGitHubClient({ clientId: "cli", fetch, sleep: noSleep });
    await expect(
      client.pollForToken({ deviceCode: "d", userCode: "X", verificationUri: "u", interval: 1, expiresIn: 900 }),
    ).rejects.toBeInstanceOf(GitHubAuthError);
  });
});

describe("repos", () => {
  const repo = (over: Record<string, unknown> = {}) => ({
    full_name: "bart/my-vault",
    name: "my-vault",
    owner: { login: "bart" },
    private: true,
    clone_url: "https://github.com/bart/my-vault.git",
    default_branch: "main",
    pushed_at: "2026-07-20T00:00:00Z",
    permissions: { push: true },
    ...over,
  });

  it("lists private repos and normalises the shape", async () => {
    const fetch = router([{ match: "/user/repos", responses: [ok([repo(), repo({ full_name: "bart/other", name: "other" })])] }]);
    const client = createGitHubClient({ clientId: "cli", fetch });
    const repos = await client.listPrivateRepos("tok");
    expect(repos).toHaveLength(2);
    expect(repos[0]).toMatchObject({ fullName: "bart/my-vault", owner: "bart", cloneUrl: expect.stringContaining(".git") });
  });

  it("reads a repo with the fields the gate needs", async () => {
    const fetch = router([{ match: "/repos/bart/my-vault", responses: [ok(repo())] }]);
    const client = createGitHubClient({ clientId: "cli", fetch });
    const meta = await client.getRepo("tok", "bart", "my-vault");
    expect(meta.private).toBe(true);
    expect(meta.permissions?.push).toBe(true);
    expect(meta.full_name).toBe("bart/my-vault");
  });

  it("raises a clear error on a 404", async () => {
    const fetch = router([{ match: "/repos/bart/missing", responses: [new Response("{}", { status: 404 })] }]);
    const client = createGitHubClient({ clientId: "cli", fetch });
    await expect(client.getRepo("tok", "bart", "missing")).rejects.toBeInstanceOf(GitHubAuthError);
  });

  it("creates from the template as private", async () => {
    const captured: { body?: string } = {};
    const fetch = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      captured.body = init?.body as string;
      return ok(repo({ full_name: "bart/new-vault", name: "new-vault" }));
    }) as unknown as typeof globalThis.fetch;

    const client = createGitHubClient({ clientId: "cli", fetch });
    const meta = await client.createFromTemplate("tok", {
      templateOwner: "derrekyoung",
      templateRepo: "ai-chief-of-staff",
      owner: "bart",
      name: "new-vault",
    });

    expect(meta.full_name).toBe("bart/new-vault");
    // The private flag is not optional in the request.
    expect(JSON.parse(captured.body!)).toMatchObject({ private: true, name: "new-vault", owner: "bart" });
  });
});
