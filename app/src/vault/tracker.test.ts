import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  addItem,
  completeItem,
  dueSoon,
  formatItem,
  highPriorityUndated,
  openItems,
  overdue,
  parseTracker,
  serializeTracker,
  stale,
  updateItem,
} from "./tracker";

const REPO_ROOT = resolve(__dirname, "../../..");
const SHIPPED_TRACKER = readFileSync(resolve(REPO_ROOT, "tracker.md"), "utf8");

const NOW = new Date("2026-07-25T02:00:00Z"); // 2026-07-25 in Europe/Lisbon
const TZ = "Europe/Lisbon";

/** A tracker with real thread sections, of the shape the vault produces. */
const POPULATED = `---
type: note
tags: ["#meta"]
---

# Tracker

## Item syntax

One line per item. The line below is the reference shape, not an item.

\`\`\`
- [ ] {item text} !{priority} due:{YYYY-MM-DD} <!-- captured: YYYY-MM-DD -->
\`\`\`

## Sections

## Work

### Today / imminent
- [ ] Send the roof estimate to [[Dana Whitfield]] !high due:2026-07-20 <!-- captured: 2026-07-01 -->
- [ ] Draft the Q3 plan !high <!-- captured: 2026-07-24 -->

- [ ] Chase the gutter quote due:2026-07-26 <!-- captured: 2026-07-10 -->
- [ ] Read the zoning bylaw <!-- captured: 2026-07-11 -->
- [ ] Look into the shed permit !low <!-- captured: 2026-07-20 -->

## Family

- [ ] Book Dad's follow-up appointment due:2026-07-25 <!-- captured: 2026-07-15 -->

## Completed (Archive)

- [x] Measure the roof — done, 42 sq m (2026-07-05) <!-- captured: 2026-07-01 -->
`;

describe("the shipped tracker.md", () => {
  it("reports no items on a fresh vault", () => {
    // The file documents its own format using a line with the exact shape of an
    // unchecked item. A naive `- [ ]` scan reports a phantom to-do called
    // "{item text}" — which would be the first thing every new user sees.
    const tracker = parseTracker(SHIPPED_TRACKER);

    expect(tracker.items).toEqual([]);
    expect(tracker.hasSections).toBe(true);
  });

  it("round-trips byte-for-byte", () => {
    expect(serializeTracker(parseTracker(SHIPPED_TRACKER))).toBe(SHIPPED_TRACKER);
  });
});

describe("parseTracker", () => {
  const tracker = parseTracker(POPULATED);

  it("reads items only from below the Sections heading", () => {
    // Six real items; the fenced reference line is not one of them.
    expect(tracker.items).toHaveLength(7);
    expect(tracker.items.map((i) => i.text)).not.toContain("{item text}");
  });

  it("extracts priority, due date, and capture date", () => {
    const roof = tracker.items[0]!;
    expect(roof.text).toBe("Send the roof estimate to [[Dana Whitfield]]");
    expect(roof.priority).toBe("high");
    expect(roof.due).toBe("2026-07-20");
    expect(roof.captured).toBe("2026-07-01");
    expect(roof.checked).toBe(false);
  });

  it("keeps wikilinks intact in the item text", () => {
    expect(tracker.items[0]!.text).toContain("[[Dana Whitfield]]");
  });

  it("records the thread and subsection each item sits under", () => {
    expect(tracker.items[0]!.thread).toBe("Work");
    expect(tracker.items[0]!.subsection).toBe("Today / imminent");
    const family = tracker.items.find((i) => i.thread === "Family")!;
    expect(family.subsection).toBeNull();
  });

  it("marks archived items", () => {
    const archived = tracker.items.filter((i) => i.archived);
    expect(archived).toHaveLength(1);
    expect(archived[0]!.checked).toBe(true);
    expect(archived[0]!.text).toContain("Measure the roof");
  });

  it("handles items with no priority and no due date", () => {
    const bylaw = tracker.items.find((i) => i.text.includes("zoning bylaw"))!;
    expect(bylaw.priority).toBeNull();
    expect(bylaw.due).toBeNull();
    expect(bylaw.captured).toBe("2026-07-11");
  });

  it("round-trips byte-for-byte", () => {
    expect(serializeTracker(tracker)).toBe(POPULATED);
  });

  it("returns no items when there is no Sections heading at all", () => {
    const tracker = parseTracker("# Tracker\n\n- [ ] Not in a section\n");
    expect(tracker.items).toEqual([]);
    expect(tracker.hasSections).toBe(false);
  });
});

describe("openItems", () => {
  it("excludes checked and archived items", () => {
    const open = openItems(parseTracker(POPULATED));
    expect(open).toHaveLength(6);
    expect(open.every((i) => !i.checked && !i.archived)).toBe(true);
  });
});

describe("the four groups the wrap surfaces", () => {
  const tracker = parseTracker(POPULATED);

  it("overdue is past due and still open", () => {
    const items = overdue(tracker, TZ, NOW);
    expect(items.map((i) => i.due)).toEqual(["2026-07-20"]);
  });

  it("due today is not overdue", () => {
    // Dad's appointment is due 2026-07-25, which is today in Lisbon.
    expect(overdue(tracker, TZ, NOW).some((i) => i.text.includes("Dad"))).toBe(false);
    expect(dueSoon(tracker, TZ, 3, NOW).some((i) => i.text.includes("Dad"))).toBe(true);
  });

  it("due soon covers the next three days inclusive of today", () => {
    const items = dueSoon(tracker, TZ, 3, NOW).map((i) => i.due);
    expect(items).toContain("2026-07-25");
    expect(items).toContain("2026-07-26");
    expect(items).not.toContain("2026-07-20"); // already overdue, not upcoming
  });

  it("high priority undated catches what nothing else does", () => {
    const items = highPriorityUndated(tracker);
    expect(items.map((i) => i.text)).toEqual(["Draft the Q3 plan"]);
  });

  it("stale is fourteen or more days, not more than fourteen", () => {
    // Captured 2026-07-11 is exactly fourteen days before 2026-07-25. It must
    // be caught here rather than falling between two definitions.
    const items = stale(tracker, TZ, NOW);
    expect(items.map((i) => i.text)).toContain("Read the zoning bylaw");
    // Captured five days ago, low priority: too fresh to be stale.
    expect(items.map((i) => i.text)).not.toContain("Look into the shed permit");
    // High priority and dated items belong to the other groups.
    expect(items.every((i) => i.priority !== "high" && i.due === null)).toBe(true);
  });
});

describe("updateItem", () => {
  it("rewrites only the item's own line", () => {
    const before = parseTracker(POPULATED);
    const target = before.items.find((i) => i.text.includes("gutter quote"))!;
    const after = updateItem(before, target.line, { due: "2026-08-01" });

    const beforeLines = before.lines;
    const afterLines = after.lines;
    expect(afterLines).toHaveLength(beforeLines.length);

    const changed = afterLines.filter((line, i) => line !== beforeLines[i]);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toContain("due:2026-08-01");
  });

  it("preserves the captured comment when changing priority", () => {
    const before = parseTracker(POPULATED);
    const target = before.items.find((i) => i.text.includes("zoning bylaw"))!;
    const after = updateItem(before, target.line, { priority: "high" });
    expect(after.lines[target.line]).toBe(
      "- [ ] Read the zoning bylaw !high <!-- captured: 2026-07-11 -->",
    );
  });
});

describe("completeItem", () => {
  it("checks the box and records outcome and closing date", () => {
    const before = parseTracker(POPULATED);
    const target = before.items.find((i) => i.text.includes("roof estimate"))!;
    const after = completeItem(before, target.line, "sent, she confirmed", "2026-07-25");

    expect(after.lines[target.line]).toBe(
      "- [x] Send the roof estimate to [[Dana Whitfield]] — sent, she confirmed (2026-07-25) " +
        "!high due:2026-07-20 <!-- captured: 2026-07-01 -->",
    );
  });

  it("records the date even with no outcome text", () => {
    const before = parseTracker(POPULATED);
    const target = before.items.find((i) => i.text.includes("zoning bylaw"))!;
    const after = completeItem(before, target.line, "", "2026-07-25");
    expect(after.lines[target.line]).toContain("- [x] Read the zoning bylaw (2026-07-25)");
  });
});

describe("addItem", () => {
  it("appends to an existing thread", () => {
    const before = parseTracker(POPULATED);
    const after = addItem(before, {
      text: "Call the surveyor",
      thread: "Work",
      priority: "med",
      captured: "2026-07-25",
    });

    expect(after.items).toHaveLength(8);
    const added = after.items.find((i) => i.text === "Call the surveyor")!;
    expect(added.thread).toBe("Work");
    expect(added.priority).toBe("med");
    expect(added.captured).toBe("2026-07-25");
    // Landed inside Work, above the Family heading.
    expect(after.lines[added.line + 1]!.startsWith("- [")).toBe(false);
  });

  it("creates a thread section when the thread is new", () => {
    const before = parseTracker(POPULATED);
    const after = addItem(before, {
      text: "Book the climbing gym induction",
      thread: "Health",
      captured: "2026-07-25",
    });

    expect(after.lines).toContain("## Health");
    const added = after.items.find((i) => i.thread === "Health")!;
    expect(added.text).toBe("Book the climbing gym induction");
    // New threads go above the archive, not after it.
    expect(added.line).toBeLessThan(after.archiveLine);
  });

  it("refuses when the file has no Sections heading", () => {
    const tracker = parseTracker("# Tracker\n");
    expect(() =>
      addItem(tracker, { text: "x", thread: "Work", captured: "2026-07-25" }),
    ).toThrow(/no `## Sections` heading/);
  });
});

describe("formatItem", () => {
  it("orders metadata canonically", () => {
    expect(
      formatItem({
        text: "Chase the permit",
        checked: false,
        priority: "high",
        due: "2026-08-01",
        captured: "2026-07-25",
      }),
    ).toBe("- [ ] Chase the permit !high due:2026-08-01 <!-- captured: 2026-07-25 -->");
  });

  it("omits absent metadata rather than writing empty markers", () => {
    expect(formatItem({ text: "Plain item", checked: false, captured: "2026-07-25" })).toBe(
      "- [ ] Plain item <!-- captured: 2026-07-25 -->",
    );
  });
});
