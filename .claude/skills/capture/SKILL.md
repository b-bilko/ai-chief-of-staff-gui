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

- Direct questions ("what do you think about this?", "who is Priya again?").
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

Get today's date in the profile timezone, and get the weekday from `date +%A`
through Bash. Never read a weekday off an ISO string.

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

If the entry records something the user decided, put it under a
`## Decisions Made` heading in the same file instead, creating that heading if it
is not there yet. The weekly recap harvests decisions by that heading name, so
the wording of the heading matters.

Wikilink every person, project, and company: `[[Priya Raman]]`, `[[Atlas
migration]]`. If the linked file does not exist, still write the link, and
mention in your confirmation that the note is missing.

Add tags to the note's frontmatter from the user's tag set in
`config/profile.md`. Do not invent a tag. If nothing fits, propose one in your
confirmation and wait.

### Meeting note

Create `meetings/YYYY-MM-DD - Descriptive Name.md`. Title case, spaces, no
slugs: `meetings/2026-03-14 - Migration sync with Priya.md`. If a file for that
conversation already exists, append rather than making a second one.

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

Then add one line to today's daily note under `## Entries`:

```
- Met with [[Priya Raman]] about the Atlas migration, see [[2026-03-14 - Migration sync with Priya]]
```

Apply the person rules below to each named attendee, and pull any commitment out
into `tracker.md`.

**Pasted note-taker exports.** Granola, Gong, and Zoom output all land here.
Signals: an attendee list at the top, speaker labels, timestamps, a block titled
summary or call brief, or the user saying "here are my notes from". Treat the
paste as a meeting note, not a daily entry.

- Keep the tool's summary, decisions, and action items as written. Drop only the
  product's own chrome, meaning banners, share links, and marketing footers.
- If a full transcript is pasted, keep it under a `## Transcript` heading at the
  bottom of the same file rather than throwing it away or making a second file.
- Pull every action item into `tracker.md` under the right thread, one line each,
  with the person wikilinked.
- If the export names attendees you have no file for, say so in the
  confirmation. Do not create person files for everyone in a large invite list.

### Person update

Look in `people/` for an existing file, matching loosely on the name. If it
exists, append a dated entry:

```markdown
## 2026-03-14

Moved from platform to the payments team. Owns the migration cutover now.
```

If a standing fact changed, also correct it at the top of the file. If there is
no file, create `people/Name.md`:

```markdown
---
type: person
date: 2026-03-14
tags: ["#work"]
---

# Priya Raman

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
- [ ] Send [[Priya Raman]] the cutover plan !high due:2026-03-20 <!-- captured: 2026-03-14 -->
```

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
- "by Friday" and other weekdays: the next occurrence of that weekday. Confirm
  the weekday with `date`, never by counting in your head.
- "this week" and "by EOW": the coming Friday. "next week": Friday of next week.
- "end of month": the last day of the current month.
- "in N days" or "in N weeks": today plus N days, or N times seven.
- `MM/DD`: this year if it has not passed, otherwise next year.

**Dedupe.** Before appending, scan the unchecked items in `tracker.md` for a
case insensitive substring match on the item text. If one is already there, skip
the write and say so in your confirmation. Do not create a near duplicate with
different wording.

Then add a line under `## Entries` in today's daily note pointing at the tracker,
so the day reads as a complete record without splitting the truth:

```
- [ ] Send [[Priya Raman]] the cutover plan, see [[tracker]]
```

## Output

One or two lines. What you wrote, where, and what you linked.

```
Captured -> daily/2026-03-14.md, linked [[Priya Raman]]
```

```
Captured -> meetings/2026-03-14 - Migration sync with Priya.md, 2 items to tracker.md, linked [[Priya Raman]]
```

```
Captured -> tracker.md under Work, !high due:2026-03-20
```

```
Already in tracker.md: "send the cutover plan". Nothing written.
```

If you made a call the user might disagree with, add one line and stop there:
`Assumption: filed as a daily entry, not a meeting. Say the word and I will move
it.`

Do not summarize the input back. Do not reflect on it. Do not coach. Ask at most
one question per capture, and ask it before you write, not after.

## Commit

After the writes:

```
git add -A && git commit -m "capture: migration sync with Priya"
```

The message is three to seven words describing what was captured. Then check for
a remote. If one exists, push. If not, say nothing about it.

## Tone and format rules

- Verbatim wins. If they wrote "this launch is a mess", the file says "this
  launch is a mess", not "the launch faced challenges". Their phrasing is the
  whole point of keeping the record.
- Never discard content. Everything they typed ends up somewhere.
- Cross link every route. A meeting note with no line in the daily note, or a
  person update that never surfaces, is a bug.
- Frontmatter stays at three fields: `type`, `date`, `tags`. Tags are a quoted
  inline array. Resist adding fields.
- Structure is the value, not length. Do not pad a two line thought into a
  section.
- No em dashes and no double hyphens in anything you write. Commas, parentheses,
  or a new sentence.
