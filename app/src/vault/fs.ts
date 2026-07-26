/**
 * The app-facing view of the vault: vault-relative reads, writes, edits, listing
 * and search, over whichever `GitFs` backend is in play.
 *
 * Everything above this line in the stack (the agent tools, the flows) speaks in
 * paths relative to the vault root — `daily/2026-07-25.md`, `tracker.md` — and
 * never sees the virtual git root or the device URI. Every path is resolved and
 * checked to stay inside the vault, because the paths that reach `write` and
 * `edit` originate in model output.
 */

import { splitVirtual, type GitFs } from "./gitfs";

export class PathEscapesVaultError extends Error {
  constructor(readonly path: string) {
    super(`Path "${path}" resolves outside the vault and was refused.`);
    this.name = "PathEscapesVaultError";
  }
}

export class EditMatchError extends Error {
  constructor(
    readonly path: string,
    readonly matches: number,
  ) {
    super(
      matches === 0
        ? `The text to replace was not found in ${path}.`
        : `The text to replace appears ${matches} times in ${path}; it must be unique.`,
    );
    this.name = "EditMatchError";
  }
}

export interface ListOptions {
  /** Recurse into subdirectories. */
  recursive?: boolean;
  /** Keep only paths whose basename matches, e.g. /\.md$/. */
  match?: RegExp;
}

export interface SearchHit {
  path: string;
  line: number;
  text: string;
}

export class Vault {
  private readonly enc = new TextEncoder();
  private readonly dec = new TextDecoder();

  constructor(
    private readonly fs: GitFs,
    /** Virtual working-tree root, e.g. "/vault". */
    private readonly dir: string,
  ) {}

  /** Resolve a vault-relative path to a virtual git path, refusing escapes. */
  private resolve(path: string): string {
    const base = splitVirtual(this.dir);
    let segments: string[];
    try {
      segments = splitVirtual(`/${path}`);
    } catch {
      throw new PathEscapesVaultError(path);
    }
    // A leading ".." in the relative path would have thrown above; this catches
    // any way the combined path could still climb out.
    const combined = splitVirtual(`/${[...base, ...segments].join("/")}`);
    if (combined.length < base.length || base.some((seg, i) => combined[i] !== seg)) {
      throw new PathEscapesVaultError(path);
    }
    return `/${combined.join("/")}`;
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.fs.promises.stat(this.resolve(path));
      return true;
    } catch {
      return false;
    }
  }

  async readText(path: string): Promise<string> {
    const data = await this.fs.promises.readFile(this.resolve(path), "utf8");
    return typeof data === "string" ? data : this.dec.decode(data);
  }

  /** Write a file, creating any missing parent directories. */
  async writeText(path: string, content: string): Promise<void> {
    const resolved = this.resolve(path);
    await this.ensureParent(resolved);
    await this.fs.promises.writeFile(resolved, content);
  }

  /**
   * Replace exactly one occurrence of `oldStr` with `newStr`.
   *
   * Mirrors the edit tool: zero or multiple matches are an error, not a silent
   * partial write. This is how a capture appends into a note's `## Entries`
   * without rewriting the whole file, and how the wrap fills one section.
   */
  async edit(path: string, oldStr: string, newStr: string): Promise<void> {
    const content = await this.readText(path);
    const first = content.indexOf(oldStr);
    if (first === -1) throw new EditMatchError(path, 0);
    if (content.indexOf(oldStr, first + oldStr.length) !== -1) {
      const count = content.split(oldStr).length - 1;
      throw new EditMatchError(path, count);
    }
    await this.writeText(path, content.slice(0, first) + newStr + content.slice(first + oldStr.length));
  }

  /** List entries under a vault-relative directory. */
  async list(dir = "", options: ListOptions = {}): Promise<string[]> {
    const results: string[] = [];
    const walk = async (relative: string): Promise<void> => {
      let names: string[];
      try {
        names = await this.fs.promises.readdir(this.resolve(relative));
      } catch {
        return; // Missing directory lists as empty rather than throwing.
      }
      for (const name of names.sort()) {
        if (name === ".git") continue;
        const childRel = relative ? `${relative}/${name}` : name;
        const stat = await this.fs.promises.stat(this.resolve(childRel));
        if (stat.isDirectory()) {
          if (options.recursive) await walk(childRel);
        } else if (!options.match || options.match.test(name)) {
          results.push(childRel);
        }
      }
    };
    await walk(dir.replace(/\/$/, ""));
    return results;
  }

  /**
   * Substring search over the vault, the app's stand-in for grep.
   *
   * Defaults to the folders that hold free text — `daily`, `meetings`, `notes` —
   * since that is where the briefing and capture look for prior context.
   */
  async search(
    query: string,
    options: { dirs?: string[]; match?: RegExp } = {},
  ): Promise<SearchHit[]> {
    const dirs = options.dirs ?? ["daily", "meetings", "notes"];
    const match = options.match ?? /\.md$/;
    const needle = query.toLowerCase();
    const hits: SearchHit[] = [];

    for (const dir of dirs) {
      for (const path of await this.list(dir, { recursive: true, match })) {
        const content = await this.readText(path);
        content.split("\n").forEach((text, i) => {
          if (text.toLowerCase().includes(needle)) hits.push({ path, line: i + 1, text });
        });
      }
    }
    return hits;
  }

  /** Create every missing directory along a resolved path's parent chain. */
  private async ensureParent(resolved: string): Promise<void> {
    const segments = splitVirtual(resolved);
    segments.pop(); // drop the filename
    let prefix = "";
    for (const segment of segments) {
      prefix = `${prefix}/${segment}`;
      try {
        await this.fs.promises.mkdir(prefix);
      } catch (err) {
        // Already there is fine; anything else is real.
        if ((err as { code?: string }).code !== "EEXIST") throw err;
      }
    }
  }
}
