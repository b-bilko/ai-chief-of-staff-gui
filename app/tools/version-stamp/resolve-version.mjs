#!/usr/bin/env node
// Portable, dependency-free app-version resolver. Stack-agnostic — no npm
// install, no framework. Copy this folder into any repo (see README.md).
//
// Prints a version string of the form `<base>` or `<base>+build.<n>`:
//     1.4.0            base only (local/dev build, no build number)
//     1.4.0+build.42   release-cycle build #42
//
// Resolution precedence (so the value is decided once, then reused verbatim):
//   1. $APP_VERSION set  -> used as-is. A CI step resolves the version once and
//                           passes it downstream (e.g. a Docker build arg), so
//                           every consumer reports the exact same string.
//   2. otherwise         -> <base> from the first available source below, with
//                           the build number appended when one is present.
//
// Base-version sources, first hit wins:
//   - $VERSION_FILE (if set and readable)
//   - ./VERSION                  (a one-line file — recommended, stack-agnostic)
//   - ./package.json "version"   (Node projects)
//   - "0.0.0"                    (last-resort fallback)
//
// Build number: $BUILD_NUMBER, else $GITHUB_RUN_NUMBER (set by GitHub Actions).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readBase(env, cwd) {
  const fileCandidates = [env.VERSION_FILE, "VERSION"].filter(Boolean);
  for (const rel of fileCandidates) {
    try {
      const v = readFileSync(resolve(cwd, rel), "utf8").trim();
      if (v) return v;
    } catch {
      /* not present — try the next source */
    }
  }
  try {
    const pkg = JSON.parse(readFileSync(resolve(cwd, "package.json"), "utf8"));
    if (pkg.version) return String(pkg.version);
  } catch {
    /* no package.json / no version field */
  }
  return "0.0.0";
}

export function resolveVersion(env = process.env, cwd = process.cwd()) {
  const override = (env.APP_VERSION || "").trim();
  if (override) return override;

  const base = readBase(env, cwd);
  const build = (env.BUILD_NUMBER || env.GITHUB_RUN_NUMBER || "").trim();
  return build ? `${base}+build.${build}` : base;
}

// CLI: prints the resolved version with no trailing newline, so CI can capture
// it straight into a build arg or a step output.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(resolveVersion());
}
