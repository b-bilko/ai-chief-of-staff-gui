/**
 * The filesystem isomorphic-git runs on.
 *
 * isomorphic-git needs a Node-shaped promise filesystem: `readFile`,
 * `writeFile`, `unlink`, `readdir`, `mkdir`, `rmdir`, `stat`, `lstat`. Expo
 * gives us `File` and `Directory` classes rooted at a `file://` URI instead.
 * This module bridges the two, and it is the single riskiest piece of the app —
 * if the bridge is wrong, git is silently broken. So it is written against one
 * interface with two interchangeable backends, and a conformance suite proves
 * both behave identically. The Node backend runs that suite headlessly today;
 * the Expo backend runs the same suite on a device.
 *
 * Both backends present a **virtual filesystem rooted at `/`**. isomorphic-git
 * is handed a virtual `dir` (for example `/vault`) and never sees the real
 * `file://` URI or temp path underneath. That keeps git paths portable across
 * backends and keeps the whole tree confined to one root.
 *
 * The load-bearing subtlety is error codes. isomorphic-git probes for files by
 * catching `ENOENT` — that is how it decides whether a repo is already there.
 * A backend that throws a differently shaped error for a missing file makes git
 * misbehave in ways that look like corruption. Every "not found" path here
 * throws a real `ENOENT`, and the conformance suite checks it.
 */

/** A POSIX-style errno error, the shape isomorphic-git branches on. */
export class FsError extends Error {
  constructor(
    readonly code: "ENOENT" | "EEXIST" | "ENOTDIR" | "EISDIR" | "ENOTEMPTY" | "EINVAL" | "EPERM",
    readonly path: string,
    syscall: string,
  ) {
    super(`${code}: ${syscall} '${path}'`);
    this.name = "FsError";
  }
}

const enoent = (path: string, syscall: string) => new FsError("ENOENT", path, syscall);
const eexist = (path: string, syscall: string) => new FsError("EEXIST", path, syscall);
const einval = (path: string, syscall: string) => new FsError("EINVAL", path, syscall);

/** The subset of `fs.Stats` isomorphic-git reads. */
export interface GitStats {
  type: "file" | "dir";
  mode: number;
  size: number;
  ino: number;
  mtimeMs: number;
  ctimeMs: number;
  uid: number;
  gid: number;
  dev: number;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

type ReadFileOptions = { encoding?: "utf8" | null } | "utf8" | null | undefined;

/** The promise filesystem isomorphic-git consumes: pass this as `{ fs }`. */
export interface GitFs {
  promises: {
    readFile(path: string, options?: ReadFileOptions): Promise<Uint8Array | string>;
    writeFile(
      path: string,
      data: Uint8Array | string,
      options?: { mode?: number; encoding?: string } | string,
    ): Promise<void>;
    unlink(path: string): Promise<void>;
    readdir(path: string): Promise<string[]>;
    mkdir(path: string, options?: { mode?: number }): Promise<void>;
    rmdir(path: string): Promise<void>;
    stat(path: string): Promise<GitStats>;
    lstat(path: string): Promise<GitStats>;
    // isomorphic-git binds these unconditionally. A markdown vault has no
    // symlinks, so they exist to satisfy the binding and are never meant to
    // succeed: readlink reports "not a symlink", symlink reports "unsupported".
    readlink(path: string): Promise<string>;
    symlink(target: string, path: string): Promise<void>;
  };
}

const FILE_MODE = 0o100644;
const DIR_MODE = 0o040000;

function makeStats(kind: "file" | "dir", size: number, mtimeMs: number): GitStats {
  return {
    type: kind,
    mode: kind === "file" ? FILE_MODE : DIR_MODE,
    size,
    ino: 0,
    mtimeMs,
    ctimeMs: mtimeMs,
    uid: 0,
    gid: 0,
    dev: 0,
    isFile: () => kind === "file",
    isDirectory: () => kind === "dir",
    // No symlinks in a markdown vault; not offering symlink methods on the fs
    // tells isomorphic-git not to attempt them.
    isSymbolicLink: () => false,
  };
}

function wantsUtf8(options: ReadFileOptions): boolean {
  if (options === "utf8") return true;
  if (options && typeof options === "object") return options.encoding === "utf8";
  return false;
}

// ---------------------------------------------------------------------------
// Virtual path handling, shared by both backends.
// ---------------------------------------------------------------------------

/**
 * Split a virtual absolute path into clean segments.
 *
 * Rejects any `..` that would climb above the root, which cannot come from
 * isomorphic-git in normal use but must never be honoured if it does.
 */
export function splitVirtual(path: string): string[] {
  const segments: string[] = [];
  for (const raw of path.split("/")) {
    if (raw === "" || raw === ".") continue;
    if (raw === "..") {
      if (segments.length === 0) {
        throw new Error(`Path "${path}" escapes the filesystem root`);
      }
      segments.pop();
      continue;
    }
    segments.push(raw);
  }
  return segments;
}

// ---------------------------------------------------------------------------
// Node backend — used by the headless conformance suite and the CLI harness.
// ---------------------------------------------------------------------------

/**
 * A GitFs backed by `node:fs`, rooted at a real directory.
 *
 * This is not shipped to the device; it exists so the git operations and the
 * conformance suite run on Node without a simulator.
 */
export async function makeNodeGitFs(realRoot: string): Promise<GitFs> {
  const nodeFs = await import("node:fs/promises");
  const nodePath = await import("node:path");

  const resolve = (virtual: string): string =>
    nodePath.join(realRoot, ...splitVirtual(virtual));

  // node:fs already throws errno errors of the right shape, so the Node backend
  // is close to a pass-through. It only reshapes stat into GitStats so both
  // backends return an identical object.
  const toStats = (s: import("node:fs").Stats): GitStats => ({
    type: s.isDirectory() ? "dir" : "file",
    mode: s.mode,
    size: s.size,
    ino: Number(s.ino),
    mtimeMs: s.mtimeMs,
    ctimeMs: s.ctimeMs,
    uid: s.uid,
    gid: s.gid,
    dev: Number(s.dev),
    isFile: () => s.isFile(),
    isDirectory: () => s.isDirectory(),
    isSymbolicLink: () => s.isSymbolicLink(),
  });

  return {
    promises: {
      async readFile(path, options) {
        const data = await nodeFs.readFile(resolve(path));
        return wantsUtf8(options) ? data.toString("utf8") : new Uint8Array(data);
      },
      async writeFile(path, data) {
        await nodeFs.writeFile(resolve(path), data);
      },
      async unlink(path) {
        await nodeFs.unlink(resolve(path));
      },
      async readdir(path) {
        return nodeFs.readdir(resolve(path));
      },
      async mkdir(path) {
        await nodeFs.mkdir(resolve(path));
      },
      async rmdir(path) {
        await nodeFs.rmdir(resolve(path));
      },
      async stat(path) {
        return toStats(await nodeFs.stat(resolve(path)));
      },
      async lstat(path) {
        return toStats(await nodeFs.lstat(resolve(path)));
      },
      async readlink(path) {
        return nodeFs.readlink(resolve(path));
      },
      async symlink(target, path) {
        await nodeFs.symlink(target, resolve(path));
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Expo backend — the real device filesystem.
// ---------------------------------------------------------------------------

/**
 * The slice of `expo-file-system` this backend needs.
 *
 * Declared structurally so the backend, its types, and its unit tests do not
 * import the native module — which cannot load under Node. The device passes
 * the real `File`, `Directory`, and `Paths` in.
 */
export interface ExpoFileSystem {
  File: new (...segments: (string | { uri: string })[]) => ExpoFile;
  Directory: new (...segments: (string | { uri: string })[]) => ExpoDirectory;
  Paths: { join(...segments: string[]): string; basename(path: string): string };
}

export interface ExpoFile {
  readonly uri: string;
  readonly exists: boolean;
  readonly size: number | null;
  readonly lastModified: number | null;
  bytesSync(): Uint8Array;
  textSync(): string;
  write(content: string | Uint8Array, options?: { encoding?: string }): void;
  create(options?: { overwrite?: boolean; intermediates?: boolean }): void;
  delete(): void;
}

export interface ExpoDirectory {
  readonly uri: string;
  readonly exists: boolean;
  create(options?: { overwrite?: boolean; intermediates?: boolean; idempotent?: boolean }): void;
  delete(): void;
  list(): (ExpoFile | ExpoDirectory)[];
}

/**
 * A GitFs backed by expo-file-system, rooted under a base directory URI.
 *
 * `baseUri` is a real `file://` directory, typically `${Paths.document.uri}` or
 * a `vault` subdirectory of it. The virtual root `/` maps to `baseUri`.
 *
 * expo-file-system throws its own errors rather than POSIX errnos and reports
 * existence through an `exists` property, so this backend checks existence
 * explicitly and raises the `ENOENT`/`EEXIST` that isomorphic-git expects.
 */
export function makeExpoGitFs(expo: ExpoFileSystem, baseUri: string): GitFs {
  const { File, Directory, Paths } = expo;

  const uriFor = (virtual: string): string => Paths.join(baseUri, ...splitVirtual(virtual));
  const fileAt = (virtual: string): ExpoFile => new File({ uri: uriFor(virtual) });
  const dirAt = (virtual: string): ExpoDirectory => new Directory({ uri: uriFor(virtual) });
  const parentDir = (virtual: string): ExpoDirectory => {
    const segments = splitVirtual(virtual);
    segments.pop();
    return new Directory({ uri: Paths.join(baseUri, ...segments) });
  };

  return {
    promises: {
      async readFile(path, options) {
        const file = fileAt(path);
        if (!file.exists) throw enoent(path, "open");
        return wantsUtf8(options) ? file.textSync() : file.bytesSync();
      },

      async writeFile(path, data) {
        const file = fileAt(path);
        if (!file.exists) {
          if (!parentDir(path).exists) throw enoent(path, "open");
          file.create({ overwrite: true });
        }
        file.write(data);
      },

      async unlink(path) {
        const file = fileAt(path);
        if (!file.exists) throw enoent(path, "unlink");
        file.delete();
      },

      async readdir(path) {
        const dir = dirAt(path);
        if (!dir.exists) throw enoent(path, "scandir");
        return dir.list().map((entry) => Paths.basename(entry.uri));
      },

      async mkdir(path) {
        const dir = dirAt(path);
        if (dir.exists) throw eexist(path, "mkdir");
        if (!parentDir(path).exists) throw enoent(path, "mkdir");
        // intermediates:false so this mirrors POSIX single-level mkdir, which is
        // the contract isomorphic-git's recursive mkdir helper is written for.
        dir.create({ intermediates: false });
      },

      async rmdir(path) {
        const dir = dirAt(path);
        if (!dir.exists) throw enoent(path, "rmdir");
        dir.delete();
      },

      async stat(path) {
        return statVirtual(path);
      },

      async lstat(path) {
        // No symlinks in a vault, so lstat and stat coincide.
        return statVirtual(path);
      },

      async readlink(path) {
        // Nothing here is a symlink. Report EINVAL ("not a symlink") for an
        // existing path, ENOENT for a missing one — the POSIX contract git
        // expects, so it never treats a regular file as a link.
        if (fileAt(path).exists || dirAt(path).exists) throw einval(path, "readlink");
        throw enoent(path, "readlink");
      },

      async symlink(_target, path) {
        throw new FsError("EPERM", path, "symlink");
      },
    },
  };

  function statVirtual(path: string): GitStats {
    const dir = dirAt(path);
    if (dir.exists) return makeStats("dir", 0, 0);
    const file = fileAt(path);
    if (file.exists) return makeStats("file", file.size ?? 0, file.lastModified ?? 0);
    throw enoent(path, "stat");
  }
}
