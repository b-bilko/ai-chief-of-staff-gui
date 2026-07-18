---
name: capture
description: Route a free-form thought, note, observation, meeting fragment, idea, person or project update, or to-do into the right file in this folder. Runs on its own whenever the user types something that reads like a note rather than a question, including pasted meeting exports from Granola, Gong, or Zoom, and also runs on the explicit /capture command. One pass, no inbox, the user's own words preserved.
---

# Capture

Take whatever the user just typed and file it, in one pass, in their words. There
is no inbox and no second sort. By the time you reply, the note is in its final
home, linked, and committed.

## When this runs

Two triggers, same logic.

**Ambient.** Any message that reads like a thought, an observation, a meeting
fragment, an idea, or a to-do routes here automatically. No command needed.

**Explicit.** `/capture <text>` forces this path even on a message that could
read as a question.

Do not capture:

- Direct questions ("what do you think about this?", "who is Nadia again?").
  Answer them. Afterward you can ask whether to save anything from the exchange.
- Slash commands.
- Edit instructions ("change that heading", "add this line to the tracker").
- Conversation about how this system works.

If a message carries both a question and a note, answer the question first, then
ask whether to capture the rest.

When you genuinely cannot tell, ask one short question and wait: "Capture this,
or are you asking me something?" Do not guess, and do not do both.

## Before you start

Read `config/profile.md` for the user's name, timezone, life threads, and tag
set. Read `config/season.md` for what this stretch is about, which tells you
whether a passing mention belongs to something they are actively tracking.

Get the timezone out of `config/profile.md` and pass it to `date` through Bash,
so the clock on the machine never decides what day it is. With
`Europe/Lisbon` in the profile:

```
TZ=Europe/Lisbon date +%Y-%m-%d
TZ=Europe/Lisbon date +%A
```

Substitute whatever zone the profile names. Bare `date +%A` is wrong. Never read
a weekday off an ISO string.

## Backdating

Most captures are about today. When the input says otherwise ("yesterday",
"Monday night", "this happened on the 3rd"), write it to that day's note instead
of today's.

- Resolve the phrase with the same timezone aware `date` call, never by counting
  in your head.
- For "yesterday" or an outright date, just write it. For anything loose ("last
  week", "a few days ago"), say the resolved date back in one line first and wait.
- If `daily/YYYY-MM-DD.md` for that day does not exist, create it from the
  template with that day's date and weekday.
- Everything else in this skill works the same. Cross links point at that day's
  note, not today's.
- On a tracker item, the `captured:` stamp keeps the real date you wrote it. Only
  the daily note moves.

## Step 1: classify

Pick exactly one primary destination. If two are equally plausible, ask one
question.

| Type | Signal | Goes to |
|---|---|---|
| Daily entry | A thought, an observation, a thing that happened. The default when nothing else fits. | `daily/YYYY-MM-DD.md` |
| Meeting note | "Just got off a call with", "met with", or a pasted export from a note-taker. | `meetings/YYYY-MM-DD - Name.md` |
| Person update | New standing context about someone: a role change, what they are working on, how they think. | `people/Name.md` |
| Project update | Movement on something with a finish line: state, a decision, a next step. | `projects/<project>.md` |
| Reference or idea | A link, a quote, a seed of an idea with no date and no owner. | `notes/<slug>.md` |
| Action item | Something the user has to do. A verb phrase. "I need to", "remind me to", "follow up with". | `tracker.md` |

Rule of thumb: if it happened today or the user thought it today, the daily note
is the primary home and everything else gets a cross-link. Route away from the
daily note only when the content is a standing asset, meaning something worth
reading a year from now outside the day it arrived.

One input can produce more than one write. A meeting note that contains a
commitment produces a meeting file, a tracker item, and a line in the daily note.
That is normal.

## Step 2: route

### Daily entry

Find or create `daily/YYYY-MM-DD.md` from `config/templates/daily-note.md`,
filling `{{date}}` and `{{weekday}}`. Append the content verbatim under
`## Entries`, newest at the bottom.

If the entry records something the user decided, put it under `## Decisions Made`
instead. That heading is a top level section of the daily note and it sits
directly after the `## End of Day Reflection` section, before `## Non-negotiables`
if that one exists. Create it there if it is not there yet, and append to it if it
is. Never open a second one. The weekly recap harvests decisions by that exact
heading name, so both the wording and the position matter.

Wikilink every person, project, and company: `[[Nadia Okonkwo]]`, `[[kitchen
remodel]]`. If the linked file does not exist, still write the link, and mention
in your confirmation that the note is missing. Do not wikilink the user
themselves.

Add tags to the note's frontmatter from the user's tag set in
`config/profile.md`. Do not invent a tag. If nothing fits, propose one in your
confirmation and wait.

### Meeting note

Create `meetings/YYYY-MM-DD - Descriptive name.md`. Sentence case, meaning you
capitalize the first word and any proper nouns and nothing else. Spaces, no
slugs: `meetings/2026-03-14 - Roof estimate with Dana Whitfield.md`. If a file
for that conversation already exists, append rather than making a second one.

```yaml
---
type: meeting
date: 2026-03-14
tags: ["#work"]
---
```

In the body, keep the user's text verbatim under whatever structure is already
there. If the input has no structure, one heading is enough. Useful headings when
the content supports them: `## What was discussed`, `## Decisions`,
`## Next steps`. Wikilink every attendee in the body. Attendees live in the body,
not in frontmatter.

Never wikilink the user. They were at their own meeting, and `people/` is for
other people. If a pasted export lists them in the attendee line, leave their
name as plain text.

Then add one line to today's daily note under `## Entries`:

```
- Met with [[Dana Whitfield]] about the roof estimate, see [[2026-03-14 - Roof estimate with Dana Whitfield]]
```

Apply the person rules below to each named attendee, and pull the user's own
commitments out into `tracker.md`.

**Pasted note-taker exports.** Granola, Gong, and Zoom output all land here.
Signals: an attendee list at the top, speaker labels, timestamps, a block titled
summary or call brief, or the user saying "here are my notes from". Treat the
paste as a meeting note, not a daily entry.

- Keep the tool's summary, decisions, and action items as written. Drop only the
  product's own chrome, meaning banners, share links, and marketing footers.
- If a full transcript is pasted, keep it under a `## Transcript` heading at the
  bottom of the same file rather than throwing it away or making a second file.
- Pull only the action items the user owns into `tracker.md`, one line each, with
  any other person wikilinked. `tracker.md` is the user's to-do list and nothing
  else. An item belongs to the user when they said they would do it, when the
  export assigns it to them by name, or when it is unassigned and clearly theirs
  from the context.
- Everyone else's action items stay in the meeting note, under the export's own
  heading, exactly as written. They are still a record, they are just not the
  user's work. Say which ones you left there in your confirmation, for example
  "2 items to tracker.md, 3 left in the note as other people's".
- When ownership is genuinely unclear on an item, leave it in the note and name
  it in your confirmation. Better a missed to-do the user can see than a tracker
  they stop trusting.
- If the export names attendees you have no file for, say so in the
  confirmation. Do not create person files for everyone in a large invite list.

### Person update

Look in `people/` for an existing file, matching loosely on the name. If it
exists, append a dated entry:

```markdown
## 2026-03-14

Moved off the day shift to nights. Runs the triage rotation now.
```

If a standing fact changed, also correct it at the top of the file. If there is
no file, create `people/Name.md`:

```markdown
---
type: person
date: 2026-03-14
tags: ["#work"]
---

# Nadia Okonkwo

Where they work, what they do, how the user knows them. Only what is known.

## 2026-03-14

[The captured content, in the user's words.]
```

Fill in what you were told and nothing else. An empty line beats an invented one.

Then surface a line in today's daily note under `## Entries` so the day stays a
complete record.

When an email connector is present and the user names someone by first name only,
you may check recent threads to work out who they mean. If one person clearly
matches, use the full name. If two might, ask. Never write an address into a file
unless the user gave it to you or the match was unambiguous.

### Project update

Append to `projects/<project>.md`, or to `status.md` and `decisions.md` if that
project already uses a folder. State goes in the status section; a decision gets
its own dated entry with one to three sentences of reasoning, because in six
months the reasoning is the part worth having.

Surface a line in today's daily note. If the content implies a project that does
not exist yet, flag it and ask before creating anything. Do not create top level
folders on your own.

### Reference or idea

A reusable reference goes to `notes/<slug>.md` with `type: note`, the date, and
tags. A fleeting idea goes under `## Entries` in today's daily note instead. Do
not create a file per stray thought.

### Action item

Append to `tracker.md` under the thread section that fits, using the thread names
from `config/profile.md`. Create a section only when a thread has its first item.

```
- [ ] Send [[Dana Whitfield]] the roof measurements !high due:2026-03-20 <!-- captured: 2026-03-14 -->
```

Only the user's own to-dos go here. If the input names something someone else
owes them, that is a fact for the person note or the meeting note, not a line in
`tracker.md`.

**Priority.** Use what the user said. If they did not say, infer from the words
they used, and prefer no marker over a wrong one.

- `!high`: important, critical, urgent, asap, must do, cannot forget, blocking,
  deadline, high priority, or "need to" plus today, tomorrow, or this week.
- `!med`: should do, need to get to, would like to, plus a near term timeframe.
- `!low`: someday, maybe, would be nice, if I get time, no rush, eventually.
- No marker: everything else.

**Due dates.** Resolve relative phrases against today's date, then delete the
phrase from the item text so the line reads cleanly.

- today, tomorrow: today, today plus one.
- "by Friday" and other weekdays: the next occurrence of that weekday. Confirm it
  with the timezone aware `date` call above, never by counting in your head.
- "this week" and "by EOW": the coming Friday. "next week": Friday of next week.
- "end of month": the last day of the current month.
- "in N days" or "in N weeks": today plus N days, or N times seven.
- `MM/DD`: this year if it has not passed, otherwise next year.

**Dedupe.** Before appending, compare the new item against every unchecked item
in `tracker.md`. A raw text match does not work here, because the stored line
carries wikilinks and metadata the user never typed. Normalize both sides first:

1. Strip `[[` and `]]`, so `[[Dana Whitfield]]` becomes `Dana Whitfield`.
2. Strip the metadata, meaning `!high`, `!med`, `!low`, `due:...`, the checkbox,
   and the `<!-- captured: ... -->` comment.
3. Lowercase, drop punctuation, and drop filler words (a, an, the, to, for, my,
   about, on).

Compare what is left as a set of content words. If one set contains the other,
it is the same item: skip the write and say so in your confirmation. So "send
dana the roof measurements" reduces to `send dana roof measurements`, the stored
line reduces to `send dana whitfield roof measurements`, and the first is
contained in the second, so it is a duplicate. Do not create a near duplicate
with different wording. When two items share a verb and a person but nothing
else, they are different items, so write the new one.

Then add a line under `## Entries` in today's daily note pointing at the tracker,
so the day reads as a complete record without splitting the truth:

```
- [ ] Send [[Dana Whitfield]] the roof measurements, see [[tracker]]
```

## Output

One or two lines. What you wrote, where, and what you linked.

```
Captured -> daily/2026-03-14.md, linked [[Nadia Okonkwo]]
```

```
Captured -> meetings/2026-03-14 - Roof estimate with Dana Whitfield.md, 1 item to tracker.md, 2 left in the note as other people's
```

```
Captured -> tracker.md under Home, !high due:2026-03-20
```

```
Already in tracker.md: "send Dana the roof measurements". Nothing written.
```

```
Captured -> daily/2026-03-13.md (yesterday), linked [[Nadia Okonkwo]]
```

If you made a call the user might disagree with, add one line and stop there:
`Assumption: filed as a daily entry, not a meeting. Say the word and I will move
it.`

Do not summarize the input back. Do not reflect on it. Do not coach. Ask at most
one question per capture, and ask it before you write, not after.

## Commit

After the writes:

Stage the files you actually touched, by path. Never `git add -A`, because it
sweeps up whatever else is sitting in the folder:

```
git add daily/2026-03-14.md meetings/2026-03-14\ -\ Roof\ estimate\ with\ Dana\ Whitfield.md tracker.md
git commit -m "capture: roof estimate with Dana"
```

The message is three to seven words describing what was captured. Then check for
a remote. Push only to a remote the user owns, and if there is none, say nothing
about it.

## Tone and format rules

- Verbatim wins. If they wrote "today was a slog", the file says "today was a
  slog", not "the day presented some challenges". Their phrasing is the whole
  point of keeping the record.
- Never discard content. Everything they typed ends up somewhere.
- Cross link every route. A meeting note with no line in the daily note, or a
  person update that never surfaces, is a bug.
- Frontmatter stays at three fields: `type`, `date`, `tags`. Tags are a quoted
  inline array. Resist adding fields.
- Structure is the value, not length. Do not pad a two line thought into a
  section.
- No em dashes and no double hyphens in anything you write. Commas, parentheses,
  or a new sentence.
