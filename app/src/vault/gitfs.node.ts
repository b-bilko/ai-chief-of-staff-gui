/**
 * The Node backend for `GitFs`, kept in its own module.
 *
 * `node:fs` cannot be bundled for the device, and `gitfs.ts` reaches the device
 * bundle through `makeExpoGitFs`. So the Node backend lives here, imported only
 * by the headless test suite and any Node-side tooling — never by app code.
 *
 * It re-exports everything from `gitfs.ts` so tests import both backends and the
 * shared types from a single path.
 */

import { splitVirtual, wantsUtf8, type GitFs, type GitStats } from "./gitfs";

export * from "./gitfs";

/**
 * A GitFs backed by `node:fs`, rooted at a real directory.
 *
 * `node:fs` already throws errno errors of the right shape, so this backend is
 * close to a pass-through — it only reshapes stat into `GitStats` so both
 * backends return an identical object.
 */
export async function makeNodeGitFs(realRoot: string): Promise<GitFs> {
  const nodeFs = await import("node:fs/promises");
  const nodePath = await import("node:path");

  const resolve = (virtual: string): string => nodePath.join(realRoot, ...splitVirtual(virtual));

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
