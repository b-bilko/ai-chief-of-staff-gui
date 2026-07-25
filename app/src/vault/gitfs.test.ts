import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FsError, type GitFs, makeExpoGitFs, makeNodeGitFs, splitVirtual } from "./gitfs";
import { MockExpoStore, makeMockExpo } from "../../test/support/mockExpoFs";

/**
 * One conformance suite, both backends.
 *
 * The whole point of the two-backend design is that the Node backend can be
 * trusted to stand in for the Expo one, so the suite that proves the contract
 * runs against both. A mapping or error-translation bug in the Expo adapter
 * fails here, on Node, rather than on a device.
 */

interface Backend {
  name: string;
  make(): Promise<{ fs: GitFs; cleanup: () => void }>;
}

const backends: Backend[] = [
  {
    name: "node",
    async make() {
      const root = mkdtempSync(join(tmpdir(), "gitfs-node-"));
      return { fs: await makeNodeGitFs(root), cleanup: () => rmSync(root, { recursive: true, force: true }) };
    },
  },
  {
    name: "expo (mock)",
    async make() {
      // A plain-path base rather than a file:// URI: the scheme is not part of
      // what this backend touches (it treats baseUri as an opaque string to
      // join under), and it keeps the mock's path joining honest.
      const base = "/root";
      const store = new MockExpoStore(base);
      return { fs: makeExpoGitFs(makeMockExpo(store), base), cleanup: () => {} };
    },
  },
];

describe.each(backends)("GitFs conformance: $name", ({ make }) => {
  let fs: GitFs;
  let cleanup: () => void;

  beforeEach(async () => {
    ({ fs, cleanup } = await make());
  });
  afterEach(() => cleanup());

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  it("writes and reads bytes round-trip", async () => {
    const bytes = enc.encode("nine questions, verbatim");
    await fs.promises.writeFile("/note.md", bytes);
    const read = await fs.promises.readFile("/note.md");
    expect(read).toBeInstanceOf(Uint8Array);
    expect(dec.decode(read as Uint8Array)).toBe("nine questions, verbatim");
  });

  it("reads text when utf8 is requested, in both option shapes", async () => {
    await fs.promises.writeFile("/note.md", "hello");
    expect(await fs.promises.readFile("/note.md", "utf8")).toBe("hello");
    expect(await fs.promises.readFile("/note.md", { encoding: "utf8" })).toBe("hello");
  });

  it("throws ENOENT for a missing file — the probe isomorphic-git relies on", async () => {
    await expect(fs.promises.readFile("/nope.md")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.promises.stat("/nope.md")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.promises.readdir("/nope")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.promises.unlink("/nope.md")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("stat distinguishes files from directories", async () => {
    await fs.promises.mkdir("/daily");
    await fs.promises.writeFile("/daily/2026-07-25.md", "x");

    const dir = await fs.promises.stat("/daily");
    expect(dir.isDirectory()).toBe(true);
    expect(dir.isFile()).toBe(false);
    expect(dir.type).toBe("dir");

    const file = await fs.promises.stat("/daily/2026-07-25.md");
    expect(file.isFile()).toBe(true);
    expect(file.isDirectory()).toBe(false);
    expect(file.size).toBe(1);
    expect(file.isSymbolicLink()).toBe(false);
  });

  it("mkdir throws EEXIST on an existing directory", async () => {
    await fs.promises.mkdir("/daily");
    await expect(fs.promises.mkdir("/daily")).rejects.toMatchObject({ code: "EEXIST" });
  });

  it("mkdir throws ENOENT when the parent is missing (single-level contract)", async () => {
    await expect(fs.promises.mkdir("/a/b/c")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("readdir lists names, not paths", async () => {
    await fs.promises.mkdir("/people");
    await fs.promises.writeFile("/people/Priya.md", "x");
    await fs.promises.writeFile("/people/Dana.md", "y");
    await fs.promises.mkdir("/people/archive");

    expect((await fs.promises.readdir("/people")).sort()).toEqual([
      "Dana.md",
      "Priya.md",
      "archive",
    ]);
  });

  it("unlink removes a file", async () => {
    await fs.promises.writeFile("/tmp.md", "x");
    await fs.promises.unlink("/tmp.md");
    await expect(fs.promises.stat("/tmp.md")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rmdir removes a directory", async () => {
    await fs.promises.mkdir("/gone");
    await fs.promises.rmdir("/gone");
    await expect(fs.promises.stat("/gone")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("overwrites an existing file in place", async () => {
    await fs.promises.writeFile("/note.md", "first");
    await fs.promises.writeFile("/note.md", "second");
    expect(await fs.promises.readFile("/note.md", "utf8")).toBe("second");
  });

  it("supports nested directory trees like .git", async () => {
    await fs.promises.mkdir("/.git");
    await fs.promises.mkdir("/.git/refs");
    await fs.promises.mkdir("/.git/refs/heads");
    await fs.promises.writeFile("/.git/refs/heads/main", "sha\n");
    expect(await fs.promises.readFile("/.git/refs/heads/main", "utf8")).toBe("sha\n");
    expect(await fs.promises.readdir("/.git")).toContain("refs");
  });
});

describe("splitVirtual", () => {
  it("normalises segments and drops noise", () => {
    expect(splitVirtual("/vault/daily/2026-07-25.md")).toEqual([
      "vault",
      "daily",
      "2026-07-25.md",
    ]);
    expect(splitVirtual("//vault//./daily/")).toEqual(["vault", "daily"]);
  });

  it("refuses to climb above the root", () => {
    expect(() => splitVirtual("/vault/../../etc/passwd")).toThrow(/escapes/);
  });
});

describe("FsError", () => {
  it("carries the errno code isomorphic-git branches on", () => {
    const err = new FsError("ENOENT", "/x", "open");
    expect(err.code).toBe("ENOENT");
    expect(err.message).toContain("ENOENT");
    expect(err.message).toContain("/x");
  });
});
