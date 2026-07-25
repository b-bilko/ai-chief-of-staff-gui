import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The vault's date rule is only as good as its weakest call site.
 *
 * `dates.ts` derives everything from the profile's IANA zone, but that is worth
 * nothing if some screen later reaches for `new Date().toISOString()` because it
 * is quicker. That bug is invisible in review and in testing on a device whose
 * clock happens to agree with the profile — it surfaces months later as a wrap
 * filed under the wrong day, correctly formatted, with nothing saying so.
 *
 * So the rule is mechanical: date formatting and clock reads live in dates.ts
 * and nowhere else. Everything else takes a `VaultDate` or a timezone.
 */

const SRC = resolve(__dirname, "..");

/** Where clock reads and date formatting are allowed to live. */
const ALLOWED = new Set([
  "vault/dates.ts",
  // Tests construct fixed instants deliberately; they are not shipped code.
]);

const FORBIDDEN: ReadonlyArray<{ pattern: RegExp; why: string }> = [
  {
    pattern: /new Date\(\s*\)/,
    why: "reads the machine clock — take a timezone and call today() instead",
  },
  {
    pattern: /Date\.now\(\)/,
    why: "reads the machine clock — take a timezone and call today() instead",
  },
  {
    pattern: /Intl\.DateTimeFormat/,
    why: "formats dates directly — use the helpers in vault/dates.ts",
  },
  {
    pattern: /\.toISOString\(\)/,
    why: "formats a date in UTC, not the profile zone — use vault/dates.ts",
  },
  {
    pattern: /\.toLocale(Date|Time)?String\(/,
    why: "formats a date in the device locale and zone — use vault/dates.ts",
  },
];

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
      continue;
    }
    if (!entry.endsWith(".ts") && !entry.endsWith(".tsx")) continue;
    if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) continue;
    if (entry.endsWith(".gen.ts")) continue;
    found.push(full);
  }
  return found;
}

describe("date handling is confined to vault/dates.ts", () => {
  it("no other source file reads the clock or formats a date", () => {
    const violations: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const rel = relative(SRC, file);
      if (ALLOWED.has(rel)) continue;

      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        // Allow an explicit, reviewed exemption on the offending line.
        if (line.includes("dates-guard-ok")) return;
        for (const { pattern, why } of FORBIDDEN) {
          if (pattern.test(line)) {
            violations.push(`${rel}:${index + 1} ${why}\n    ${line.trim()}`);
          }
        }
      });
    }

    expect(violations, `\n${violations.join("\n")}\n`).toEqual([]);
  });
});
