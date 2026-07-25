import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  fillSlot,
  parseProfile,
  parseSeason,
  removeSlot,
  requiredAnswersPresent,
  setupState,
  unfilledSlots,
} from "./config";

const REPO_ROOT = resolve(__dirname, "../../..");
const SHIPPED_PROFILE = readFileSync(resolve(REPO_ROOT, "config/profile.md"), "utf8");
const SHIPPED_SEASON = readFileSync(resolve(REPO_ROOT, "config/season.md"), "utf8");
const DAILY_TEMPLATE = readFileSync(
  resolve(REPO_ROOT, "config/templates/daily-note.md"),
  "utf8",
);

/** The shipped profile, as it looks after a completed setup interview. */
const ANSWERED_PROFILE = SHIPPED_PROFILE.replace("{{name}}", "Bart")
  .replace("{{timezone}}", "Europe/Lisbon")
  .replace("- {{thread-1}}", "- Work")
  .replace("- {{thread-2}}", "- Family")
  .replace("- {{thread-3}}", "- Health")
  .replace("- {{thread-4-optional}}\n", "")
  .replace("- {{thread-5-optional}}\n", "")
  .replace("- {{thread-6-optional}}\n", "")
  .replace("{{tags}}", "`#work`, `#health`, `#family`, `#meta`");

const ANSWERED_SEASON = (() => {
  let out = SHIPPED_SEASON;
  const answers = [
    "Getting the house finished and staying employed while I do it.",
    "Roughly half on the house, a third on work, the rest on family.",
    "The roof project, and calling Dad on Sundays.",
    "Walk outside every day. Asleep by eleven.",
    "Did I do one thing today that only I could do?",
  ];
  for (const answer of answers) out = out.replace("{{answer}}", answer);
  return out;
})();

describe("the shipped config files", () => {
  it("read as unanswered", () => {
    const profile = parseProfile(SHIPPED_PROFILE);
    const season = parseSeason(SHIPPED_SEASON);

    expect(profile.answered).toBe(false);
    expect(profile.name).toBeNull();
    expect(profile.timezone).toBeNull();
    expect(season.answered).toBe(false);
  });

  it("reports an untouched vault so setup can run", () => {
    const state = setupState({
      profile: parseProfile(SHIPPED_PROFILE),
      season: parseSeason(SHIPPED_SEASON),
    });

    expect(state.complete).toBe(false);
    expect(state.untouched).toBe(true);
    expect(state.missing).toContain("timezone");
  });

  it("does not mistake the instruction comments for answer slots", () => {
    // Both files describe the slot shape in prose in order to explain
    // themselves. Counting those would report far more slots than exist.
    expect(unfilledSlots(SHIPPED_PROFILE)).toEqual([
      "name",
      "timezone",
      "thread-1",
      "thread-2",
      "thread-3",
      "thread-4-optional",
      "thread-5-optional",
      "thread-6-optional",
      "tags",
    ]);
    expect(unfilledSlots(SHIPPED_SEASON)).toEqual(["answer", "answer", "answer", "answer", "answer"]);
  });

  it("does not treat the daily-note template's markers as answer slots", () => {
    // config/templates ships markers that skills fill on every run. They are
    // not setup answers and must never hold the gate shut. They also appear
    // inline (`# {{date}}, {{weekday}}`) rather than on a line of their own,
    // which is precisely what distinguishes a template marker from an answer.
    expect(DAILY_TEMPLATE).toContain("{{date}}");
    expect(DAILY_TEMPLATE).toContain("{{weekday}}");
    expect(unfilledSlots(DAILY_TEMPLATE)).toEqual([]);

    const state = setupState({
      profile: parseProfile(ANSWERED_PROFILE),
      season: parseSeason(ANSWERED_SEASON),
    });
    expect(state.complete).toBe(true);
  });
});

describe("parseProfile on an answered file", () => {
  const profile = parseProfile(ANSWERED_PROFILE);

  it("reads name and canonical timezone", () => {
    expect(profile.name).toBe("Bart");
    expect(profile.timezone).toBe("Europe/Lisbon");
    expect(requiredAnswersPresent(profile)).toBe(true);
  });

  it("reads the life threads that were named, ignoring deleted slots", () => {
    expect(profile.threads).toEqual(["Work", "Family", "Health"]);
  });

  it("reads the tag set", () => {
    expect(profile.tags).toEqual(["#work", "#health", "#family", "#meta"]);
  });

  it("counts as answered", () => {
    expect(profile.answered).toBe(true);
  });
});

describe("timezone handling", () => {
  it("treats a garbled timezone as absent rather than trusting it", () => {
    // The vault's only fallback for a missing zone is to ask. A value that is
    // not a real zone has to reach that same question, never wrong dates.
    const profile = parseProfile(ANSWERED_PROFILE.replace("Europe/Lisbon", "GMT+1 probably"));
    expect(profile.timezone).toBeNull();
    expect(requiredAnswersPresent(profile)).toBe(false);
    expect(setupState({ profile, season: parseSeason(ANSWERED_SEASON) }).complete).toBe(false);
  });

  it("canonicalises an alias the user typed", () => {
    const profile = parseProfile(ANSWERED_PROFILE.replace("Europe/Lisbon", "PST"));
    expect(profile.timezone).toBe("America/Los_Angeles");
  });

  it("rejects a bare offset, which has no DST rules", () => {
    const profile = parseProfile(ANSWERED_PROFILE.replace("Europe/Lisbon", "+01:00"));
    expect(profile.timezone).toBeNull();
  });
});

describe("skipped answers", () => {
  it("counts as answered but carries no value", () => {
    const season = parseSeason(
      ANSWERED_SEASON.replace("Walk outside every day. Asleep by eleven.", "(skipped)").replace(
        "Did I do one thing today that only I could do?",
        "(skipped)",
      ),
    );

    expect(season.answered).toBe(true);
    expect(season.nonNegotiables).toBeNull();
    expect(season.customQuestion).toBeNull();
  });

  it("an unfilled optional thread slot holds the gate shut", () => {
    // "An unused slot left sitting here reads as an unanswered question."
    const withLeftoverSlot = ANSWERED_PROFILE.replace(
      "- Health",
      "- Health\n- {{thread-4-optional}}",
    );
    expect(parseProfile(withLeftoverSlot).answered).toBe(false);
  });
});

describe("parseSeason on an answered file", () => {
  const season = parseSeason(ANSWERED_SEASON);

  it("reads all five answers", () => {
    expect(season.about).toContain("house finished");
    expect(season.attention).toContain("half on the house");
    expect(season.trackedWithoutAsking).toContain("roof project");
    expect(season.nonNegotiables).toBe("Walk outside every day. Asleep by eleven.");
    expect(season.customQuestion).toBe("Did I do one thing today that only I could do?");
    expect(season.answered).toBe(true);
  });
});

describe("fillSlot", () => {
  it("replaces only the slot line and leaves the explanation alone", () => {
    const filled = fillSlot(SHIPPED_PROFILE, "name", "Bart");

    expect(filled).toContain("\nBart\n");
    expect(filled).not.toContain("{{name}}");
    // The explanatory prose under the heading survives untouched.
    expect(filled).toContain("What to call the user in briefings and reviews.");
    // Other slots are unaffected.
    expect(filled).toContain("{{timezone}}");
  });

  it("preserves a list bullet when filling a thread slot", () => {
    expect(fillSlot(SHIPPED_PROFILE, "thread-1", "Work")).toContain("- Work");
  });

  it("is a no-op when the slot is already filled", () => {
    expect(fillSlot(ANSWERED_PROFILE, "name", "Someone Else")).toBe(ANSWERED_PROFILE);
  });
});

describe("removeSlot", () => {
  it("deletes an unused optional thread line entirely", () => {
    const trimmed = removeSlot(SHIPPED_PROFILE, "thread-6-optional");
    expect(trimmed).not.toContain("{{thread-6-optional}}");
    expect(trimmed).toContain("{{thread-5-optional}}");
    // No blank line left behind where the bullet was.
    expect(trimmed).not.toMatch(/- \{\{thread-5-optional\}\}\n\n/);
  });
});
