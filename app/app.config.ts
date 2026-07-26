/**
 * Dynamic Expo config: stamps every build with a version.
 *
 * The static config still lives in `app.json`; this layers the version-stamp
 * kit (`tools/version-stamp/`) on top of it so no build ships unversioned:
 *
 *   - `expo.version`            the base SemVer (X.Y.Z), what the stores show.
 *   - `android.versionCode`     the CI build number, integer and increasing.
 *   - `ios.buildNumber`         the same number as a string.
 *   - `extra.appVersion`        the full stamp (`X.Y.Z` or `X.Y.Z+build.<n>`),
 *                               surfaced in Settings so the running build is
 *                               observable without guessing at tags.
 *
 * The version is resolved by running the vendored `resolve-version.mjs` as a
 * subprocess rather than importing it: that script is ESM (`.mjs`) and the Expo
 * config loader evaluates this file as CommonJS, so a plain import would fail.
 * A subprocess is also exactly how the CI templates call it, so local and CI
 * builds resolve the version the same way.
 */

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import type { ConfigContext, ExpoConfig } from "expo/config";

function resolveVersion(): string {
  const script = resolve(__dirname, "tools/version-stamp/resolve-version.mjs");
  try {
    return execFileSync("node", [script], { cwd: __dirname, encoding: "utf8" }).trim();
  } catch {
    // The kit's own last-resort fallback, so a broken toolchain never blocks a build.
    return "0.0.0";
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const version = resolveVersion(); // "0.1.0" locally, "0.1.0+build.42" in CI
  const base = version.split("+")[0] ?? version; // stores reject build metadata
  const buildNumber = Number(process.env.BUILD_NUMBER ?? process.env.GITHUB_RUN_NUMBER ?? "1");

  return {
    ...config,
    name: config.name ?? "Chief of Staff",
    slug: config.slug ?? "ai-chief-of-staff-gui",
    version: base,
    android: { ...config.android, versionCode: buildNumber },
    ios: { ...config.ios, buildNumber: String(buildNumber) },
    extra: { ...config.extra, appVersion: version },
  };
};
