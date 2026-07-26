#!/usr/bin/env node
// Bump the *base* version (major | minor | patch) and print the new value.
// Stack-agnostic companion to resolve-version.mjs — used by the Release
// workflow template. Writes the `VERSION` file, and keeps `package.json`'s
// version field in sync when a package.json is present.
//
// Usage: node bump-version.mjs <major|minor|patch>   (default: patch)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const part = (process.argv[2] || "patch").toLowerCase();
if (!["major", "minor", "patch"].includes(part)) {
  console.error(`Unknown bump "${part}" — expected major, minor, or patch.`);
  process.exit(1);
}

const cwd = process.cwd();
const versionFile = resolve(cwd, process.env.VERSION_FILE || "VERSION");
const pkgFile = resolve(cwd, "package.json");

function currentBase() {
  if (existsSync(versionFile)) {
    const v = readFileSync(versionFile, "utf8").trim();
    if (v) return v;
  }
  if (existsSync(pkgFile)) {
    const v = JSON.parse(readFileSync(pkgFile, "utf8")).version;
    if (v) return String(v);
  }
  return "0.0.0";
}

const base = currentBase();
const m = base.match(/^(\d+)\.(\d+)\.(\d+)/);
if (!m) {
  console.error(`Base version "${base}" isn't semver (expected X.Y.Z).`);
  process.exit(1);
}
let [major, minor, patch] = m.slice(1, 4).map(Number);
if (part === "major") [major, minor, patch] = [major + 1, 0, 0];
else if (part === "minor") [minor, patch] = [minor + 1, 0];
else patch += 1;
const next = `${major}.${minor}.${patch}`;

writeFileSync(versionFile, next + "\n");
if (existsSync(pkgFile)) {
  const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
  pkg.version = next;
  writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + "\n");
}

process.stdout.write(next);
