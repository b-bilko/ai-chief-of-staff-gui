/**
 * An in-memory stand-in for the `expo-file-system` `File`/`Directory`/`Paths`
 * surface, matching the structural contract in `gitfs.ts`.
 *
 * The real native module cannot load under Node, but the interesting logic in
 * the Expo backend is not the native calls — it is the path mapping and the
 * translation of Expo's existence checks into POSIX `ENOENT`/`EEXIST`. This
 * mock has exactly the same observable semantics the backend relies on, so the
 * conformance suite can run against the Expo backend headlessly and catch a
 * mapping bug before it reaches a device.
 */

import type { ExpoDirectory, ExpoFile, ExpoFileSystem } from "../../src/vault/gitfs";

type Node =
  | { kind: "file"; data: Uint8Array; mtime: number }
  | { kind: "dir" };

export class MockExpoStore {
  private readonly nodes = new Map<string, Node>();
  private clock = 1_000;

  constructor(rootUri: string) {
    this.nodes.set(normalize(rootUri), { kind: "dir" });
  }

  get(uri: string): Node | undefined {
    return this.nodes.get(normalize(uri));
  }

  set(uri: string, node: Node): void {
    this.nodes.set(normalize(uri), node);
  }

  remove(uri: string): void {
    const key = normalize(uri);
    // Directory delete is recursive in expo-file-system.
    for (const existing of [...this.nodes.keys()]) {
      if (existing === key || existing.startsWith(`${key}/`)) this.nodes.delete(existing);
    }
  }

  childrenOf(uri: string): string[] {
    const prefix = `${normalize(uri)}/`;
    const names: string[] = [];
    for (const key of this.nodes.keys()) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      if (!rest.includes("/")) names.push(rest);
    }
    return names;
  }

  tick(): number {
    return this.clock++;
  }
}

function normalize(uri: string): string {
  return uri.replace(/\/+$/, "");
}

function basename(uri: string): string {
  const clean = normalize(uri);
  const slash = clean.lastIndexOf("/");
  return slash === -1 ? clean : clean.slice(slash + 1);
}

function argToUri(segments: (string | { uri: string })[]): string {
  return segments
    .map((s) => (typeof s === "string" ? s : s.uri))
    .join("/")
    .replace(/\/+/g, "/");
}

/** The real File/Directory take string URIs; the mock keeps the {uri} form too. */
type Segment = string | { uri: string };

/** Build an `ExpoFileSystem` implementation over an in-memory store. */
export function makeMockExpo(store: MockExpoStore): ExpoFileSystem {
  class MockFile implements ExpoFile {
    readonly uri: string;
    constructor(...segments: Segment[]) {
      this.uri = argToUri(segments);
    }
    get exists(): boolean {
      return store.get(this.uri)?.kind === "file";
    }
    get size(): number | null {
      const node = store.get(this.uri);
      return node?.kind === "file" ? node.data.byteLength : null;
    }
    get lastModified(): number | null {
      const node = store.get(this.uri);
      return node?.kind === "file" ? node.mtime : null;
    }
    bytesSync(): Uint8Array {
      const node = store.get(this.uri);
      if (node?.kind !== "file") throw new Error(`no such file: ${this.uri}`);
      return node.data;
    }
    textSync(): string {
      return new TextDecoder().decode(this.bytesSync());
    }
    write(content: string | Uint8Array): void {
      const data = typeof content === "string" ? new TextEncoder().encode(content) : content;
      store.set(this.uri, { kind: "file", data, mtime: store.tick() });
    }
    create(options?: { overwrite?: boolean; intermediates?: boolean }): void {
      if (this.exists && !options?.overwrite) throw new Error(`exists: ${this.uri}`);
      store.set(this.uri, { kind: "file", data: new Uint8Array(), mtime: store.tick() });
    }
    delete(): void {
      store.remove(this.uri);
    }
  }

  class MockDirectory implements ExpoDirectory {
    readonly uri: string;
    constructor(...segments: Segment[]) {
      this.uri = argToUri(segments);
    }
    get exists(): boolean {
      return store.get(this.uri)?.kind === "dir";
    }
    create(options?: { intermediates?: boolean; idempotent?: boolean }): void {
      if (this.exists) {
        if (options?.idempotent) return;
        throw new Error(`exists: ${this.uri}`);
      }
      store.set(this.uri, { kind: "dir" });
    }
    delete(): void {
      store.remove(this.uri);
    }
    list(): (ExpoFile | ExpoDirectory)[] {
      return store.childrenOf(this.uri).map((name) => {
        const childUri = `${normalize(this.uri)}/${name}`;
        return store.get(childUri)?.kind === "dir"
          ? new MockDirectory({ uri: childUri })
          : new MockFile({ uri: childUri });
      });
    }
  }

  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: {
      join: (...segments: string[]) => segments.join("/").replace(/\/+/g, "/"),
      basename: (path: string) => basename(path),
    },
  };
}
