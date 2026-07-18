---
type: note
date: {{date}}
tags: ["#meta"]
---

# Tracker

The one to-do list. Everything actionable lands here, whether you typed it
yourself or it fell out of a capture, a wrap, or a meeting note.

## Item syntax

```
- [ ] {item text} !{priority} due:{YYYY-MM-DD} <!-- captured: YYYY-MM-DD -->
```

- Priority is `!high`, `!med`, or `!low`. Omit it if the item has none.
- `due:` is optional. Omit it if there is no real date.
- `captured:` is always written. It drives the age sort in the weekly review, so
  an item that has been sitting for six weeks cannot hide.
- Use `[[Name]]` inline for people, projects, and companies.
- Check the box to complete: `- [x]`. Add a short outcome and the date it closed.

An item with no priority and no due date is still valid. It just will not be
flagged as urgent.

## Sections

Sections are keyed to the life threads in `config/profile.md`, one heading per
thread, so this list stays legible as it grows. They get created after setup,
when the first item for a thread arrives. Add a `### Today / imminent`
subsection under any thread that needs one.

<!-- Thread sections go here. -->

## Completed (Archive)

Closed items move down here at the weekly review. Keep them. The weekly and
monthly recaps read this section to build the wins list, and a year of finished
work is worth more than a clean file.
