import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { assessVault, prepareExistingRepo, prepareNewRepo } from "./repo";
import { RepoGateError } from "../vault/git";
import { Vault } from "../vault/fs";
import { makeNodeGitFs, type GitFs } from "../vault/gitfs.node";
import type { GitHubClient } from "./github";

/** A GitHub client stub returning whatever repo metadata a test wants. */
function stubClient(overrides: Partial<Record<"getRepo" | "createFromTemplate", unknown>>): GitHubClient {
  return {
    getRepo: overrides.getRepo,
    createFromTemplate: overrides.createFromTemplate,
  } as unknown as GitHubClient;
}

const privateRepo = {
  fullName: "bart/my-vault",
  owner: "bart",
  name: "my-vault",
  private: true,
  cloneUrl: "https://github.com/bart/my-vault.git",
  defaultBranch: "main",
  pushedAt: null,
  permissions: { push: true },
  full_name: "bart/my-vault",
};

describe("prepareExistingRepo — the private gate", () => {
  it("returns a clone spec for a private, writable repo", async () => {
    const client = stubClient({ getRepo: async () => privateRepo });
    const spec = await prepareExistingRepo(client, "tok", "bart", "my-vault");
    expect(spec).toEqual({
      cloneUrl: "https://github.com/bart/my-vault.git",
      defaultBranch: "main",
      fullName: "bart/my-vault",
    });
  });

  it("refuses a public repo before anything is cloned", async () => {
    const client = stubClient({ getRepo: async () => ({ ...privateRepo, private: false }) });
    await expect(prepareExistingRepo(client, "tok", "bart", "my-vault")).rejects.toBeInstanceOf(RepoGateError);
  });

  it("refuses a repo the token cannot push to", async () => {
    const client = stubClient({ getRepo: async () => ({ ...privateRepo, permissions: { push: false } }) });
    await expect(prepareExistingRepo(client, "tok", "bart", "my-vault")).rejects.toBeInstanceOf(RepoGateError);
  });

  it("refuses the public upstream template for free", async () => {
    const client = stubClient({
      getRepo: async () => ({
        ...privateRepo,
        private: false,
        permissions: { push: false },
        full_name: "derrekyoung/ai-chief-of-staff",
      }),
    });
    await expect(prepareExistingRepo(client, "tok", "derrekyoung", "ai-chief-of-staff")).rejects.toBeInstanceOf(
      RepoGateError,
    );
  });
});

describe("prepareNewRepo", () => {
  it("creates a private repo from the template and returns a clone spec", async () => {
    const client = stubClient({
      createFromTemplate: async () => ({ ...privateRepo, fullName: "bart/new", name: "new", full_name: "bart/new" }),
    });
    const spec = await prepareNewRepo(client, "tok", "bart", "new");
    expect(spec.fullName).toBe("bart/new");
  });
});

describe("assessVault", () => {
  let fs: GitFs;
  let cleanup: () => void;
  const dir = "/vault";

  beforeEach(async () => {
    const root = mkdtempSync(join(tmpdir(), "assess-"));
    cleanup = () => rmSync(root, { recursive: true, force: true });
    fs = await makeNodeGitFs(root);
    await fs.promises.mkdir(dir);
  });
  afterEach(() => cleanup());

  async function seed(vault: Vault, opts: { configured: boolean; isVault: boolean }): Promise<void> {
    if (!opts.isVault) {
      await vault.writeText("README.md", "# some other project");
      return;
    }
    await vault.writeText("CLAUDE.md", "# Operating Instructions");
    await vault.writeText("tracker.md", "# Tracker\n\n## Sections\n");
    if (opts.configured) {
      await vault.writeText(
        "config/profile.md",
        "# Profile\n\n## Name\n\nBart\n\n## Timezone\n\nEurope/Lisbon\n\n## Life threads\n\n- Work\n\n## Tags\n\n`#work`\n",
      );
      await vault.writeText(
        "config/season.md",
        "# This Season\n\n## 1. About\n\nx\n\n## 2. Attention\n\nx\n\n## 3. Tracked\n\nx\n\n## 4. Non-negotiables\n\n(skipped)\n\n## 5. Custom\n\n(skipped)\n",
      );
    } else {
      await vault.writeText(
        "config/profile.md",
        "# Profile\n\n## Name\n\n{{name}}\n\n## Timezone\n\n{{timezone}}\n",
      );
      await vault.writeText("config/season.md", "# This Season\n\n## 1. About\n\n{{answer}}\n");
    }
  }

  it("a configured vault is ready for the daily loop", async () => {
    const vault = new Vault(fs, dir);
    await seed(vault, { configured: true, isVault: true });
    expect(await assessVault(fs, dir)).toEqual({ kind: "ready" });
  });

  it("an empty vault needs the setup interview", async () => {
    const vault = new Vault(fs, dir);
    await seed(vault, { configured: false, isVault: true });
    expect(await assessVault(fs, dir)).toEqual({ kind: "needs-setup" });
  });

  it("an unrelated repo is flagged rather than written into", async () => {
    const vault = new Vault(fs, dir);
    await seed(vault, { configured: false, isVault: false });
    expect(await assessVault(fs, dir)).toMatchObject({ kind: "not-a-vault" });
  });
});
