import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EditMatchError, PathEscapesVaultError, Vault } from "./fs";
import { type GitFs, makeExpoGitFs, makeNodeGitFs } from "./gitfs";
import { MockExpoStore, makeMockExpo } from "../../test/support/mockExpoFs";

interface Backend {
  name: string;
  make(): Promise<{ fs: GitFs; cleanup: () => void }>;
}

const backends: Backend[] = [
  {
    name: "node",
    async make() {
      const root = mkdtempSync(join(tmpdir(), "vault-node-"));
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

describe.each(backends)("Vault: $name", ({ make }) => {
  let vault: Vault;
  let fs: GitFs;
  let cleanup: () => void;
  const dir = "/vault";

  beforeEach(async () => {
    ({ fs, cleanup } = await make());
    await fs.promises.mkdir(dir);
    vault = new Vault(fs, dir);
  });
  afterEach(() => cleanup());

  it("writes a file into a new directory, creating parents", async () => {
    await vault.writeText("daily/2026-07-25.md", "# 2026-07-25, Saturday\n");
    expect(await vault.readText("daily/2026-07-25.md")).toBe("# 2026-07-25, Saturday\n");
    expect(await vault.exists("daily/2026-07-25.md")).toBe(true);
    expect(await vault.exists("daily/2026-07-24.md")).toBe(false);
  });

  it("preserves content verbatim, including awkward characters", async () => {
    // "Their words stay theirs" — an apostrophe, an em dash, and a newline must
    // all round-trip untouched.
    const answer = "The whole day was a dumpster fire — Priya's call didn't help.\nStill mad.";
    await vault.writeText("daily/2026-07-25.md", answer);
    expect(await vault.readText("daily/2026-07-25.md")).toBe(answer);
  });

  it("edits exactly one occurrence", async () => {
    await vault.writeText("note.md", "## Entries\n\n## Decisions Made\n");
    await vault.edit("note.md", "## Entries\n", "## Entries\n\n- Talked to Priya.\n");
    expect(await vault.readText("note.md")).toBe(
      "## Entries\n\n- Talked to Priya.\n\n## Decisions Made\n",
    );
  });

  it("refuses an edit whose target is missing or ambiguous", async () => {
    await vault.writeText("note.md", "line\nline\n");
    await expect(vault.edit("note.md", "nope", "x")).rejects.toBeInstanceOf(EditMatchError);
    await expect(vault.edit("note.md", "line\n", "x")).rejects.toMatchObject({ matches: 2 });
  });

  it("lists a directory, sorted and without .git", async () => {
    await fs.promises.mkdir(`${dir}/.git`);
    await vault.writeText("daily/2026-07-24.md", "a");
    await vault.writeText("daily/2026-07-25.md", "b");
    expect(await vault.list("daily")).toEqual(["daily/2026-07-24.md", "daily/2026-07-25.md"]);
    expect(await vault.list()).not.toContain(".git");
  });

  it("lists recursively with a filter", async () => {
    await vault.writeText("meetings/2026-07-25 - roof.md", "x");
    await vault.writeText("notes/reading/agents.md", "y");
    await vault.writeText("notes/reading/notes.txt", "z");
    const md = await vault.list("", { recursive: true, match: /\.md$/ });
    expect(md).toContain("meetings/2026-07-25 - roof.md");
    expect(md).toContain("notes/reading/agents.md");
    expect(md).not.toContain("notes/reading/notes.txt");
  });

  it("lists a missing directory as empty", async () => {
    expect(await vault.list("does-not-exist")).toEqual([]);
  });

  it("searches free-text folders and reports path and line", async () => {
    await vault.writeText("daily/2026-07-25.md", "Talked to Priya about Saturday hours.\nEnd.");
    await vault.writeText("notes/roof.md", "Priya wants a decision by Friday.");
    await vault.writeText("meetings/2026-07-20 - kickoff.md", "No mention here.");

    const hits = await vault.search("priya");
    expect(hits).toHaveLength(2);
    expect(hits.map((h) => h.path).sort()).toEqual(["daily/2026-07-25.md", "notes/roof.md"]);
    expect(hits.find((h) => h.path.startsWith("daily"))!.line).toBe(1);
  });

  it("refuses paths that climb out of the vault", async () => {
    await expect(vault.readText("../secrets.md")).rejects.toBeInstanceOf(PathEscapesVaultError);
    await expect(vault.writeText("../../etc/passwd", "x")).rejects.toBeInstanceOf(
      PathEscapesVaultError,
    );
    await expect(vault.readText("daily/../../escape.md")).rejects.toBeInstanceOf(
      PathEscapesVaultError,
    );
  });

  it("allows internal .. that stays within the vault", async () => {
    await vault.writeText("daily/2026-07-25.md", "x");
    // daily/../daily/... normalises back inside the vault and is fine.
    expect(await vault.readText("daily/../daily/2026-07-25.md")).toBe("x");
  });
});
