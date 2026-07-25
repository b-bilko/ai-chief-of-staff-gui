import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as nodeJoin } from "node:path";

import git from "isomorphic-git";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  RepoGateError,
  SecretInVaultError,
  assertRepoAllowed,
  commitAndPush,
  evaluateRepoGate,
  looksLikeVault,
  scanForSecrets,
} from "./git";
import { type GitFs, makeExpoGitFs, makeNodeGitFs } from "./gitfs.node";
import { MockExpoStore, makeMockExpo } from "../../test/support/mockExpoFs";

const AUTHOR = { name: "Bart", email: "bart@example.com" };

// A push that would fail loudly if it were ever reached. Tests that exercise the
// secret guard rely on it aborting *before* the network is touched.
const EXPLODING_HTTP = {
  request() {
    throw new Error("network should not be reached in this test");
  },
};

interface Backend {
  name: string;
  make(): Promise<{ fs: GitFs; cleanup: () => void }>;
}

const backends: Backend[] = [
  {
    name: "node",
    async make() {
      const root = mkdtempSync(nodeJoin(tmpdir(), "git-node-"));
      return {
        fs: await makeNodeGitFs(root),
        cleanup: () => rmSync(root, { recursive: true, force: true }),
      };
    },
  },
  {
    name: "expo (mock)",
    async make() {
      const base = "/root";
      const store = new MockExpoStore(base);
      return { fs: makeExpoGitFs(makeMockExpo(store), base), cleanup: () => {} };
    },
  },
];

/**
 * The load-bearing test: drive real isomorphic-git through the adapter.
 *
 * A full init → write → add → commit → log → checkout lifecycle hammers every
 * method of the GitFs with git's own internals. If the adapter is subtly wrong,
 * this breaks here rather than on a device. Running it on both backends proves
 * the Expo adapter satisfies the same contract the Node one does.
 */
describe.each(backends)("isomorphic-git lifecycle through the adapter: $name", ({ make }) => {
  let fs: GitFs;
  let cleanup: () => void;
  const dir = "/vault";

  beforeEach(async () => {
    ({ fs, cleanup } = await make());
    await fs.promises.mkdir(dir);
    await git.init({ fs, dir, defaultBranch: "main" });
  });
  afterEach(() => cleanup());

  it("commits a file and reads it back through the log", async () => {
    await fs.promises.writeFile(`${dir}/tracker.md`, "# Tracker\n");
    await git.add({ fs, dir, filepath: "tracker.md" });
    const oid = await git.commit({ fs, dir, message: "capture: first item", author: AUTHOR });

    const log = await git.log({ fs, dir });
    expect(log).toHaveLength(1);
    expect(log[0]!.oid).toBe(oid);
    expect(log[0]!.commit.message).toBe("capture: first item\n");
    expect(log[0]!.commit.author.name).toBe("Bart");
  });

  it("builds nested directories the way a daily note needs", async () => {
    await fs.promises.mkdir(`${dir}/daily`);
    await fs.promises.writeFile(`${dir}/daily/2026-07-25.md`, "# 2026-07-25, Saturday\n");
    await git.add({ fs, dir, filepath: "daily/2026-07-25.md" });
    await git.commit({ fs, dir, message: "daily-wrap: 2026-07-25", author: AUTHOR });

    const files = await git.listFiles({ fs, dir, ref: "HEAD" });
    expect(files).toContain("daily/2026-07-25.md");
  });

  it("tracks a second commit and checks an earlier version back out", async () => {
    await fs.promises.writeFile(`${dir}/note.md`, "first\n");
    await git.add({ fs, dir, filepath: "note.md" });
    const first = await git.commit({ fs, dir, message: "one", author: AUTHOR });

    await fs.promises.writeFile(`${dir}/note.md`, "second\n");
    await git.add({ fs, dir, filepath: "note.md" });
    await git.commit({ fs, dir, message: "two", author: AUTHOR });

    expect((await git.log({ fs, dir })).map((c) => c.commit.message)).toEqual(["two\n", "one\n"]);

    const { blob } = await git.readBlob({ fs, dir, oid: first, filepath: "note.md" });
    expect(new TextDecoder().decode(blob)).toBe("first\n");
  });

  it("stages a deletion", async () => {
    await fs.promises.writeFile(`${dir}/temp.md`, "x");
    await git.add({ fs, dir, filepath: "temp.md" });
    await git.commit({ fs, dir, message: "add temp", author: AUTHOR });

    await fs.promises.unlink(`${dir}/temp.md`);
    await git.remove({ fs, dir, filepath: "temp.md" });
    await git.commit({ fs, dir, message: "drop temp", author: AUTHOR });

    expect(await git.listFiles({ fs, dir, ref: "HEAD" })).not.toContain("temp.md");
  });

  it("computes ancestry, the primitive the fast-forward check depends on", async () => {
    await fs.promises.writeFile(`${dir}/a.md`, "a");
    await git.add({ fs, dir, filepath: "a.md" });
    const first = await git.commit({ fs, dir, message: "a", author: AUTHOR });

    await fs.promises.writeFile(`${dir}/b.md`, "b");
    await git.add({ fs, dir, filepath: "b.md" });
    const second = await git.commit({ fs, dir, message: "b", author: AUTHOR });

    // A fast-forward is exactly "remote descends from local HEAD".
    expect(await git.isDescendent({ fs, dir, oid: second, ancestor: first })).toBe(true);
    expect(await git.isDescendent({ fs, dir, oid: first, ancestor: second })).toBe(false);
  });

  it("recognises a chief-of-staff vault by its markers", async () => {
    for (const marker of ["CLAUDE.md", "config/profile.md", "tracker.md"]) {
      const slash = marker.lastIndexOf("/");
      if (slash !== -1) await fs.promises.mkdir(`${dir}/${marker.slice(0, slash)}`);
      await fs.promises.writeFile(`${dir}/${marker}`, "x");
    }
    expect(await looksLikeVault({ fs, dir })).toBe(true);
  });

  it("does not mistake an unrelated repo for a vault", async () => {
    await fs.promises.writeFile(`${dir}/README.md`, "# Some other project");
    expect(await looksLikeVault({ fs, dir })).toBe(false);
  });
});

// The secret-guard abort is verified on the node backend, where a real write
// tree is simplest to set up.
describe("commitAndPush secret guard", () => {
  let fs: GitFs;
  let cleanup: () => void;
  const dir = "/vault";

  beforeEach(async () => {
    const root = mkdtempSync(nodeJoin(tmpdir(), "git-secret-"));
    fs = await makeNodeGitFs(root);
    cleanup = () => rmSync(root, { recursive: true, force: true });
    await fs.promises.mkdir(dir);
    await fs.promises.mkdir(`${dir}/daily`);
    await git.init({ fs, dir, defaultBranch: "main" });
  });
  afterEach(() => cleanup());

  it("refuses to commit a file containing an Anthropic key, without touching the network", async () => {
    await fs.promises.writeFile(
      `${dir}/daily/2026-07-25.md`,
      "Note to self: sk-ant-api03-ABCDEFGHIJKLMNOPQRST",
    );

    await expect(
      commitAndPush(
        { fs, http: EXPLODING_HTTP, dir, url: "https://example/x.git", onAuth: () => ({}), author: AUTHOR },
        { paths: ["daily/2026-07-25.md"], message: "daily-wrap: 2026-07-25" },
      ),
    ).rejects.toBeInstanceOf(SecretInVaultError);
  });
});

describe("evaluateRepoGate", () => {
  it("passes a private, writable repo", () => {
    const result = evaluateRepoGate({
      private: true,
      permissions: { push: true },
      full_name: "bart/my-vault",
    });
    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("fails a public repo, whatever the permissions", () => {
    const result = evaluateRepoGate({ private: false, permissions: { push: true } });
    expect(result.ok).toBe(false);
    expect(result.failures).toContain("not-private");
    expect(result.message).toContain("private repo");
  });

  it("fails the upstream public template for free", () => {
    // The template is public, so the private check disposes of the
    // "don't push to someone else's repo" case with no special handling.
    const result = evaluateRepoGate({
      private: false,
      permissions: { push: false },
      full_name: "derrekyoung/ai-chief-of-staff",
    });
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(expect.arrayContaining(["not-private", "no-push-access"]));
  });

  it("fails a private repo the user cannot push to", () => {
    const result = evaluateRepoGate({ private: true, permissions: { push: false } });
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(["no-push-access"]);
  });

  it("treats missing permissions as no push access", () => {
    expect(evaluateRepoGate({ private: true }).failures).toContain("no-push-access");
  });

  it("assertRepoAllowed throws on a failing repo", () => {
    expect(() => assertRepoAllowed({ private: false, permissions: { push: true } })).toThrow(
      RepoGateError,
    );
    expect(() => assertRepoAllowed({ private: true, permissions: { push: true } })).not.toThrow();
  });
});

describe("scanForSecrets", () => {
  it("catches each credential shape", () => {
    const hits = scanForSecrets([
      { path: "daily/a.md", content: "leak sk-ant-api03-ABCDEFGHIJKLMNOP here" },
      { path: "notes/b.md", content: "token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345" },
      { path: "notes/c.md", content: "github_pat_ABCDEFGHIJ1234567890KLMNOP" },
      { path: "clean.md", content: "just a normal note about the roof" },
    ]);
    expect(hits.map((h) => h.path)).toEqual(["daily/a.md", "notes/b.md", "notes/c.md"]);
    expect(hits[0]!.label).toContain("Anthropic");
  });

  it("passes clean content", () => {
    expect(
      scanForSecrets([{ path: "daily/a.md", content: "Talked to Priya about Saturday hours." }]),
    ).toEqual([]);
  });
});
