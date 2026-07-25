/**
 * Reading `config/profile.md` and `config/season.md`.
 *
 * Both files are prose documents with exactly one answer slot per section: a
 * field name in double curly braces sitting where the user's answer belongs.
 * Filling in the answer replaces the slot; the surrounding explanation stays.
 *
 * The subtlety, and the reason this module is careful: **judge the slots, not
 * the file text.** Both files describe the slot shape in their own instruction
 * comments in order to explain themselves, and `config/templates/` ships slots
 * that skills fill on every run. A naive search for the marker shape matches all
 * of that and keeps the setup gate shut forever on a fully configured vault.
 *
 * Locating an answer once the slot is gone is positional, and therefore coupled
 * to the shipped template. That coupling is made safe by refusing to guess: a
 * read that does not produce a plausible value returns `null` and the caller
 * asks the user, which is what the vault instructions require for the timezone
 * ("Ask, write the IANA name into the profile, then carry on") and is the right
 * behaviour for everything else too.
 */

import { canonicalizeTimezone } from "./dates";

/** A line that is nothing but an unfilled slot, optionally a list bullet. */
const EMPTY_SLOT = /^\s*(?:-\s+)?\{\{[a-z0-9-]+\}\}\s*$/i;

/** The literal the vault writes for a deliberately skipped optional answer. */
const SKIPPED = "(skipped)";

export interface Profile {
  name: string | null;
  /** Canonical IANA zone, or null if absent or not a real zone. */
  timezone: string | null;
  threads: string[];
  tags: string[];
  /** True when no answer slot is left unfilled. */
  answered: boolean;
}

export interface Season {
  about: string | null;
  attention: string | null;
  trackedWithoutAsking: string | null;
  /** Drives the wrap's non-negotiables sweep and the reviews' floor read. */
  nonNegotiables: string | null;
  /** Asked last in the wrap, in the user's own wording, when present. */
  customQuestion: string | null;
  answered: boolean;
}

export interface VaultConfig {
  profile: Profile;
  season: Season;
}

// ---------------------------------------------------------------------------
// Document structure
// ---------------------------------------------------------------------------

interface Section {
  heading: string;
  /** Blank-line-separated blocks of the section body, in order. */
  paragraphs: string[][];
}

/**
 * Split a config document into `##` sections and paragraphs.
 *
 * HTML comments are dropped wholesale: they are instructions to Claude, never
 * answers, and they are exactly what a naive scan would trip over.
 */
function sections(content: string): Section[] {
  const withoutComments = content.replace(/<!--[\s\S]*?-->/g, "");
  const result: Section[] = [];
  let current: Section | null = null;
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length > 0 && current) current.paragraphs.push(paragraph);
    paragraph = [];
  };

  for (const line of withoutComments.split("\n")) {
    const heading = /^##\s+(.*?)\s*$/.exec(line);
    if (heading) {
      flush();
      current = { heading: heading[1]!, paragraphs: [] };
      result.push(current);
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    paragraph.push(line);
  }
  flush();

  return result;
}

function findSection(all: Section[], matcher: (heading: string) => boolean): Section | null {
  return all.find((s) => matcher(s.heading.toLowerCase())) ?? null;
}

/** True if the paragraph is an unfilled answer slot. */
function isEmptySlot(paragraph: string[]): boolean {
  return paragraph.every((line) => EMPTY_SLOT.test(line));
}

/**
 * Read an answer paragraph.
 *
 * Returns `undefined` when the slot is still unfilled (the setup gate is open),
 * and `null` when the user deliberately skipped it — a finished answer that
 * simply has no value.
 */
function readAnswer(paragraph: string[] | undefined): string | null | undefined {
  if (!paragraph) return undefined;
  if (isEmptySlot(paragraph)) return undefined;
  const text = paragraph.join("\n").trim();
  if (text === "" ) return undefined;
  if (text.toLowerCase() === SKIPPED) return null;
  return text;
}

// ---------------------------------------------------------------------------
// profile.md
// ---------------------------------------------------------------------------

export function parseProfile(content: string): Profile {
  const all = sections(content);
  let answered = true;

  const nameSection = findSection(all, (h) => h === "name");
  const name = readAnswer(nameSection?.paragraphs[0]);
  if (name === undefined) answered = false;

  const tzSection = findSection(all, (h) => h === "timezone");
  const rawTimezone = readAnswer(tzSection?.paragraphs[0]);
  if (rawTimezone === undefined) answered = false;
  // A timezone that is not a real IANA zone is treated as absent. The vault's
  // entire fallback for a missing zone is to ask, and never to guess — so a
  // garbled value has to degrade into the same question, not into wrong dates.
  const timezone = typeof rawTimezone === "string" ? canonicalizeTimezone(rawTimezone) : null;

  const threadsSection = findSection(all, (h) => h.startsWith("life thread"));
  const threadParagraph = threadsSection?.paragraphs.find((p) =>
    p.some((line) => line.trim().startsWith("-")),
  );
  const threads: string[] = [];
  if (threadParagraph) {
    for (const line of threadParagraph) {
      const bullet = /^\s*-\s+(.*?)\s*$/.exec(line);
      if (!bullet) continue;
      // Unfilled optional thread slots are meant to be deleted, not left
      // sitting: "an unused slot left sitting here reads as an unanswered
      // question and holds the setup gate shut". Honour that literally.
      if (EMPTY_SLOT.test(line)) {
        answered = false;
        continue;
      }
      const value = bullet[1]!.trim();
      if (value && value.toLowerCase() !== SKIPPED) threads.push(value);
    }
  } else {
    answered = false;
  }

  const tagsSection = findSection(all, (h) => h === "tags");
  const tagParagraph = tagsSection?.paragraphs.find(
    (p) => isEmptySlot(p) || p.some((line) => line.includes("#")),
  );
  const rawTags = readAnswer(tagParagraph);
  if (rawTags === undefined) answered = false;
  const tags =
    typeof rawTags === "string"
      ? (rawTags.match(/#[\w-]+/g) ?? []).map((t) => t.trim())
      : [];

  return {
    name: typeof name === "string" ? name : null,
    timezone,
    threads,
    tags,
    answered,
  };
}

// ---------------------------------------------------------------------------
// season.md
// ---------------------------------------------------------------------------

/** In season.md the answer slot is always the section's final paragraph. */
function readSeasonAnswer(section: Section | null): string | null | undefined {
  if (!section) return undefined;
  return readAnswer(section.paragraphs[section.paragraphs.length - 1]);
}

export function parseSeason(content: string): Season {
  const all = sections(content);
  let answered = true;

  const read = (n: number): string | null => {
    const section = findSection(all, (h) => h.startsWith(`${n}.`));
    const value = readSeasonAnswer(section);
    if (value === undefined) {
      answered = false;
      return null;
    }
    return value;
  };

  return {
    about: read(1),
    attention: read(2),
    trackedWithoutAsking: read(3),
    nonNegotiables: read(4),
    customQuestion: read(5),
    answered,
  };
}

// ---------------------------------------------------------------------------
// The setup gate
// ---------------------------------------------------------------------------

export interface SetupState {
  /** True once every slot in both files holds an answer or `(skipped)`. */
  complete: boolean;
  /** Nothing answered at all: the user has never been set up. */
  untouched: boolean;
  /** Human-readable reasons the gate is still shut. */
  missing: string[];
}

/**
 * Decide whether the vault has been set up.
 *
 * A partly filled profile is a normal state, not an error — skills "degrade
 * rather than stop". This returns enough detail for the caller to make that
 * distinction rather than collapsing it to a boolean.
 */
export function setupState(config: VaultConfig): SetupState {
  const { profile, season } = config;
  const missing: string[] = [];

  if (!profile.name) missing.push("name");
  if (!profile.timezone) missing.push("timezone");
  if (profile.threads.length === 0) missing.push("life threads");
  if (!profile.answered) missing.push("profile has unfilled slots");
  if (!season.answered) missing.push("season has unfilled slots");

  const nothingAnswered = !profile.name && !profile.timezone && profile.threads.length === 0;

  return {
    complete: profile.answered && season.answered && profile.timezone !== null,
    untouched: nothingAnswered,
    missing,
  };
}

/**
 * The two answers nothing can run without.
 *
 * Name and timezone cannot be skipped: every date, filename, and review
 * boundary is written in the user's zone, and their name goes on everything
 * handed back. A flow that needs either and does not have it must ask, never
 * fall back to the device.
 */
export function requiredAnswersPresent(profile: Profile): boolean {
  return profile.name !== null && profile.timezone !== null;
}

// ---------------------------------------------------------------------------
// Writing answers back during setup
// ---------------------------------------------------------------------------

/**
 * Replace one named slot with the user's answer.
 *
 * Slot-targeted rather than section-targeted, so this only ever touches the
 * line the answer belongs on and leaves the surrounding explanation alone.
 * Returns the content unchanged if the slot is already filled.
 */
export function fillSlot(content: string, slot: string, answer: string): string {
  const pattern = new RegExp(`^(\\s*)(-\\s+)?\\{\\{${slot}\\}\\}\\s*$`, "im");
  const match = pattern.exec(content);
  if (!match) return content;
  const indent = match[1] ?? "";
  const bullet = match[2] ?? "";
  return content.replace(pattern, `${indent}${bullet}${answer.trim()}`);
}

/**
 * Remove an optional slot line entirely.
 *
 * The profile asks for unused thread slots to be deleted rather than left
 * behind, because a slot sitting there reads as an unanswered question.
 */
export function removeSlot(content: string, slot: string): string {
  const pattern = new RegExp(`^\\s*(?:-\\s+)?\\{\\{${slot}\\}\\}\\s*\\n`, "im");
  return content.replace(pattern, "");
}

/** Every unfilled slot name still present in a document, in order. */
export function unfilledSlots(content: string): string[] {
  const withoutComments = content.replace(/<!--[\s\S]*?-->/g, "");
  const found: string[] = [];
  for (const line of withoutComments.split("\n")) {
    if (!EMPTY_SLOT.test(line)) continue;
    const name = /\{\{([a-z0-9-]+)\}\}/i.exec(line);
    if (name) found.push(name[1]!);
  }
  return found;
}
