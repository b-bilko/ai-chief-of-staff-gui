/**
 * Reading and writing `tracker.md`, the vault's single to-do list.
 *
 * Two rules from the file itself drive the whole design:
 *
 * 1. **Items live only in thread sections below `## Sections`.** Everything
 *    above that heading documents the format, and one of those lines has the
 *    exact shape of an unchecked item without being one. A naive scan for
 *    `- [ ]` reports a phantom to-do called `{item text}` on every fresh vault,
 *    which is the first thing a new user would see.
 * 2. **Lines holding a `{placeholder}` are not items**, wherever they appear.
 *
 * Writes are line-surgical. The user edits this file by hand and a desktop
 * Claude Code session writes to it too, so anything this module does not
 * deliberately change comes back out byte-for-byte — including comments,
 * blank lines, and whatever formatting they chose.
 */

import { type VaultDate, ageInDays, isBeforeToday, isValidDate } from "./dates";

export type Priority = "high" | "med" | "low";

export interface TrackerItem {
  /** The item's own text, with wikilinks intact and metadata stripped off. */
  text: string;
  checked: boolean;
  priority: Priority | null;
  due: VaultDate | null;
  captured: VaultDate | null;
  /** The `## Thread` heading this item sits under. */
  thread: string;
  /** A `### Subsection` inside the thread, such as "Today / imminent". */
  subsection: string | null;
  /** True when the item sits under `## Completed (Archive)`. */
  archived: boolean;
  /** Indentation of the original line, preserved on rewrite. */
  indent: string;
  /** 0-based index into the file's lines. The handle for edits. */
  line: number;
}

export interface Tracker {
  items: TrackerItem[];
  /** Every line of the file, so untouched content round-trips exactly. */
  lines: string[];
  /** Whether the file has a `## Sections` heading at all. */
  hasSections: boolean;
  /** Line index of `## Completed (Archive)`, or -1. */
  archiveLine: number;
  /** Trailing newline presence, so serialisation does not add or drop one. */
  trailingNewline: boolean;
}

const HEADING = /^(#{2,3})\s+(.*?)\s*$/;
const ITEM = /^(\s*)- \[([ xX])\]\s?(.*)$/;
const PLACEHOLDER = /\{[^}]*\}/;
const CAPTURED = /\s*<!--\s*captured:\s*(\d{4}-\d{2}-\d{2})\s*-->\s*$/;
const DUE = /(?:^|\s)due:(\d{4}-\d{2}-\d{2})(?=\s|$)/;
const PRIORITY = /(?:^|\s)!(high|med|low)(?=\s|$)/;

const SECTIONS_HEADING = "sections";

function isArchiveHeading(text: string): boolean {
  return text.toLowerCase().startsWith("completed");
}

/**
 * Parse `tracker.md`.
 *
 * Returns no items — not an error — for a tracker that has no thread sections
 * yet. Saying "nothing on the list" about a fresh vault is the correct answer.
 */
export function parseTracker(content: string): Tracker {
  const trailingNewline = content.endsWith("\n");
  const lines = content.split("\n");
  if (trailingNewline) lines.pop();

  const items: TrackerItem[] = [];
  let belowSections = false;
  let hasSections = false;
  let archiveLine = -1;
  let thread = "";
  let subsection: string | null = null;
  let archived = false;
  let inFence = false;

  lines.forEach((line, index) => {
    // The format documentation is shown in a fenced code block containing a
    // line shaped exactly like an item. Never read inside a fence.
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    const heading = HEADING.exec(line);
    if (heading) {
      const [, hashes, text] = heading;
      if (hashes === "##") {
        if (text!.toLowerCase() === SECTIONS_HEADING) {
          belowSections = true;
          hasSections = true;
          thread = "";
          subsection = null;
          archived = false;
          return;
        }
        if (isArchiveHeading(text!)) {
          archiveLine = index;
          archived = true;
          thread = text!;
          subsection = null;
          return;
        }
        thread = text!;
        subsection = null;
        archived = false;
        return;
      }
      // A `###` subsection such as "Today / imminent".
      subsection = text!;
      return;
    }

    if (!belowSections) return;

    const item = ITEM.exec(line);
    if (!item) return;

    const [, indent, box, rest] = item;
    // A line still holding a `{placeholder}` is documentation, not an item.
    if (PLACEHOLDER.test(rest!)) return;

    items.push({
      ...extractMetadata(rest!),
      checked: box !== " ",
      thread,
      subsection,
      archived,
      indent: indent!,
      line: index,
    });
  });

  return { items, lines, hasSections, archiveLine, trailingNewline };
}

function extractMetadata(rest: string): {
  text: string;
  priority: Priority | null;
  due: VaultDate | null;
  captured: VaultDate | null;
} {
  let text = rest;
  let captured: VaultDate | null = null;
  let due: VaultDate | null = null;
  let priority: Priority | null = null;

  const capturedMatch = CAPTURED.exec(text);
  if (capturedMatch) {
    captured = capturedMatch[1]!;
    text = text.slice(0, capturedMatch.index);
  }

  const dueMatch = DUE.exec(text);
  if (dueMatch && isValidDate(dueMatch[1]!)) {
    due = dueMatch[1]!;
    text = text.slice(0, dueMatch.index) + text.slice(dueMatch.index + dueMatch[0].length);
  }

  const priorityMatch = PRIORITY.exec(text);
  if (priorityMatch) {
    priority = priorityMatch[1] as Priority;
    text =
      text.slice(0, priorityMatch.index) +
      text.slice(priorityMatch.index + priorityMatch[0].length);
  }

  return { text: text.trim(), priority, due, captured };
}

/** Render an item back to its canonical single-line form. */
export function formatItem(item: {
  text: string;
  checked: boolean;
  priority?: Priority | null;
  due?: VaultDate | null;
  captured?: VaultDate | null;
  indent?: string;
}): string {
  const parts = [`${item.indent ?? ""}- [${item.checked ? "x" : " "}] ${item.text.trim()}`];
  if (item.priority) parts.push(`!${item.priority}`);
  if (item.due) parts.push(`due:${item.due}`);
  let line = parts.join(" ");
  if (item.captured) line += ` <!-- captured: ${item.captured} -->`;
  return line;
}

/** Serialise back to file content, preserving every untouched byte. */
export function serializeTracker(tracker: Tracker): string {
  return tracker.lines.join("\n") + (tracker.trailingNewline ? "\n" : "");
}

/**
 * Apply changes to one item, returning a new tracker.
 *
 * Only the item's own line is rewritten. Passing `text` replaces the item text;
 * the metadata suffixes are rebuilt from the merged values either way.
 */
export function updateItem(
  tracker: Tracker,
  line: number,
  changes: Partial<Pick<TrackerItem, "text" | "checked" | "priority" | "due" | "captured">>,
): Tracker {
  const item = tracker.items.find((i) => i.line === line);
  if (!item) throw new Error(`No tracker item at line ${line}`);

  const merged = { ...item, ...changes };
  const lines = [...tracker.lines];
  lines[line] = formatItem(merged);

  return {
    ...tracker,
    lines,
    items: tracker.items.map((i) => (i.line === line ? { ...merged } : i)),
  };
}

/**
 * Close an item, recording a short outcome and the date it closed.
 *
 * The file asks for both: "Check the box to complete. Add a short outcome and
 * the date it closed."
 */
export function completeItem(
  tracker: Tracker,
  line: number,
  outcome: string,
  closedOn: VaultDate,
): Tracker {
  const item = tracker.items.find((i) => i.line === line);
  if (!item) throw new Error(`No tracker item at line ${line}`);
  const suffix = outcome.trim() ? ` — ${outcome.trim()} (${closedOn})` : ` (${closedOn})`;
  return updateItem(tracker, line, { checked: true, text: item.text + suffix });
}

/**
 * Add an item under a thread heading, creating the heading if it is missing.
 *
 * Thread sections "get created after setup, when the first item for a thread
 * arrives", so a vault whose `## Sections` is still just a placeholder comment
 * is the normal starting state rather than an error.
 */
export function addItem(
  tracker: Tracker,
  item: {
    text: string;
    thread: string;
    priority?: Priority | null;
    due?: VaultDate | null;
    captured: VaultDate;
  },
): Tracker {
  if (!tracker.hasSections) {
    throw new Error(
      "tracker.md has no `## Sections` heading, so there is nowhere to file an item. " +
        "The vault may not be a chief-of-staff vault.",
    );
  }

  const lines = [...tracker.lines];
  const rendered = formatItem({ ...item, checked: false, priority: item.priority ?? null });

  const threadLine = findThreadHeading(lines, item.thread);
  if (threadLine === -1) {
    // New thread: append a heading before the archive, or at the end.
    const anchor = tracker.archiveLine === -1 ? lines.length : tracker.archiveLine;
    const block = [`## ${item.thread}`, "", rendered, ""];
    lines.splice(anchor, 0, ...block);
  } else {
    lines.splice(lastLineOfSection(lines, threadLine) + 1, 0, rendered);
  }

  return parseTracker(lines.join("\n") + (tracker.trailingNewline ? "\n" : ""));
}

function findThreadHeading(lines: string[], thread: string): number {
  const wanted = thread.trim().toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    const heading = HEADING.exec(lines[i]!);
    if (heading && heading[1] === "##" && heading[2]!.trim().toLowerCase() === wanted) return i;
  }
  return -1;
}

/** Index of the last content line belonging to a section, ignoring trailing blanks. */
function lastLineOfSection(lines: string[], headingLine: number): number {
  let end = lines.length - 1;
  for (let i = headingLine + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i]!)) {
      end = i - 1;
      break;
    }
  }
  while (end > headingLine && lines[end]!.trim() === "") end--;
  return end;
}

// ---------------------------------------------------------------------------
// The four groups the evening wrap and morning briefing surface.
// ---------------------------------------------------------------------------

/** Open items, excluding anything already filed under the archive. */
export function openItems(tracker: Tracker): TrackerItem[] {
  return tracker.items.filter((i) => !i.checked && !i.archived);
}

/** Past their due date and still open. */
export function overdue(tracker: Tracker, timezone: string, now?: Date): TrackerItem[] {
  return openItems(tracker).filter(
    (i) => i.due !== null && isBeforeToday(i.due, timezone, now),
  );
}

/** Due within the next `days` days, inclusive of today. */
export function dueSoon(
  tracker: Tracker,
  timezone: string,
  days = 3,
  now?: Date,
): TrackerItem[] {
  return openItems(tracker).filter((i) => {
    if (i.due === null) return false;
    const age = ageInDays(i.due, timezone, now);
    return age <= 0 && age >= -days;
  });
}

/**
 * `!high`, open, with no due date.
 *
 * These are the items that fall through: nothing else catches them, and the
 * morning briefing keeps asking for them until someone closes them.
 */
export function highPriorityUndated(tracker: Tracker): TrackerItem[] {
  return openItems(tracker).filter((i) => i.priority === "high" && i.due === null);
}

/**
 * Captured fourteen or more days ago, no due date, not high priority.
 *
 * Fourteen *or more*, not more than fourteen — an item sitting at exactly
 * fourteen days is caught here rather than falling between two definitions.
 * The weekly recap draws the same line at the same number.
 */
export function stale(tracker: Tracker, timezone: string, now?: Date): TrackerItem[] {
  return openItems(tracker).filter(
    (i) =>
      i.due === null &&
      i.priority !== "high" &&
      i.captured !== null &&
      ageInDays(i.captured, timezone, now) >= 14,
  );
}
