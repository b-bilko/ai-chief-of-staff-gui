---
name: weekly-recap
description: Close out the week. Reads the week's daily notes, meeting notes, the tracker, and existing patterns, then writes a review covering wins, decisions made, what got done, a four bucket tracker pass, patterns that earned promotion, an honest score, and what carries into next week. Use when the user says "weekly recap", "close out the week", "how did my week go", or runs the weekly review directly. Writes reviews/YYYY-MM-DD-weekly.md and commits.
---

# Weekly Recap

Reads the week you actually had and gives it back to you straight. Wins,
decisions, what got done, what is still open, and an honest read on whether the
week moved in the direction the season says it should.

This is a synthesis, not a log replay. It writes one file and commits it.

## When this runs

End of week, on request. The user asks for a weekly recap, says close out the
week, or runs the skill by name.

It needs daily notes to work from. If the week has fewer than three, say so, run
the review anyway on what exists, and keep it short. Never fill a thin week with
invention.

## Dates and week boundaries

Get today from Bash: `date +%Y-%m-%d` and `date +%A`. Never read a weekday off an
ISO string. Use the timezone in `config/profile.md`.

The default window is the last seven days ending today, inclusive. If the user
names a week, compute those boundaries explicitly and say the range back to them
in one line before you start. State the range in the review itself, with weekday
names taken from `date`, so a reader in six months knows exactly what was
covered.

The output file is named for the last day in the window. If a review already
exists for that date, ask before replacing it.

## Sources (read in this order)

1. `tracker.md`. Drives the Open Loops and Tracker Review section, and the
   Completed (Archive) section feeds the wins list.
2. Every `daily/YYYY-MM-DD.md` in the window. Read the whole note: the entries,
   the End of Day Reflection, and the Decisions Made section if the wrap wrote
   one.
3. Every file in `meetings/` dated inside the window.
4. `patterns/`, so you build on themes already recognized instead of restating
   them as new.
5. `projects/` and `people/`, only when something in the notes points at them and
   you need the background to write one accurate sentence.
6. Calendar or email, only if a connector is live. A calendar can confirm what
   actually happened on a day with no note. An email thread can show a loop still
   waiting on the user. Both are optional. When neither is connected, work from
   the notes and say nothing about the absence.

If a day has no note, that is data. Note the gap in one clause if it matters,
then move on.

## Current season

Read `config/profile.md` and `config/season.md` before you write anything.

The profile gives you the life threads. Those are the threads the review reports
against, so a thread that went untouched all week is worth naming even when
nothing went wrong.

The season sets what counted as meaningful this week and feeds two sections
directly: Non-negotiables (question 4) and The Honest Score. If either config
file still has `{{placeholder}}` markers, stop and run the setup interview in
CLAUDE.md first.

## Before you compose

Two passes run before the review text gets written.

### 1. Tracker cleanup

Housekeeping on `tracker.md`, in this order:

1. Move completed `- [x]` items whose `captured:` date is more than 60 days old
   down to the Completed (Archive) section. Keep the outcome text and the close
   date intact.
2. Flag, do not delete, any unchecked item whose `due:` date is more than 30 days
   past. These get called out as long overdue in the review.
3. Sort out the oldest open items by `captured:` date. They feed the stale bucket
   below.

Never delete an item. Never rewrite the user's wording. Cleanup moves things and
flags things, nothing else.

### 2. Pattern promotion

Scan the trailing 90 days of `daily/` notes and anything in `reviews/` for
repeating themes. Look for:

- A feeling or a word the user keeps using across separate days.
- The same frustration or blocker surfacing again and again.
- An intention stated repeatedly with no action behind it.
- A person mentioned often and never actually contacted, or one who used to come
  up constantly and has gone quiet.
- A subject circled many times without a decision landing.
- Something the season says matters that almost never appears in the notes.

**The threshold is three or more confirming signals across two or more separate
days.** Below that, it is not a pattern.

For each theme that clears the bar, append to `patterns/<theme-slug>.md`. Look
for an existing file first with a loose name match, so "sleep-and-energy" does
not get a second file called "energy-dips."

Append only. Never rewrite or edit an existing entry, and never change the
frontmatter date on a file that already exists. A new file looks like this:

```markdown
---
type: pattern
date: YYYY-MM-DD
tags: ["#meta"]
---

# Theme name

## YYYY-MM-DD

Two to four sentences describing what you see. Cite the signals. Do not
interpret motive and do not suggest a fix.

Signals: 4 daily notes across 3 days
Evidence: [[2026-03-09]], [[2026-03-11]], [[2026-03-14]]
```

An append to an existing file is the same block, a new `## YYYY-MM-DD` heading
and its evidence, added at the bottom. If the theme has not changed since the
last entry, one line is enough: what is new, or that it is continuing.

Running the recap twice in the same week must not produce duplicate entries.
Check for an entry already dated inside this window before appending.

Anything below the threshold goes in the Watching subsection of the review and
nowhere else. No file, no append. Watching is where weak signals live until they
earn a home, and keeping `patterns/` thin is the point.

## What to include

Generate these in order. Skip any section with nothing real in it rather than
padding it out.

### The Week in Two Minutes

Four to six bullets on what the user actually did, thought about, and lived
through. Capture how the week felt, not a readout of what filled the calendar.
No timestamps, no day by day march.

### Wins This Week

Two to six. Stack ranked, most consequential first. A win can be a milestone, a
conversation that opened something up, a shift in thinking, a decision that felt
right, or a moment of clarity. Pull completed tracker items from this week too.

Write each as a natural phrase. Not a trophy label, not a performance review
line. If there is genuinely nothing worth naming, skip the section instead of
inventing a weak one.

### Decisions Made

Harvest the Decisions Made sections the daily wrap wrote into this week's daily
notes. Also pick up decisions stated plainly in meeting notes or in the entries
themselves, even when the wrap did not catch them.

Two to six items, one line each: what was decided, and why. Keep the user's own
reasoning rather than a cleaned up version of it.

- Moved the migration to April so Priya's team can finish testing first
- Said no to the Thursday standing meeting, it was costing a morning for a status
  update

If something was decided and then reversed inside the same week, say so on the
same line and name both days. Reversals are the most useful thing this section
produces, so do not smooth them over.

If no decisions appear anywhere in the week, write one line saying that. A week
with no decisions in it is worth knowing about.

### What Got Done

What the user completed, shipped, resolved, or moved forward beyond the headline
wins. Natural phrases, not task labels. Lead with what mattered most and group
the tail under a single "and a handful of smaller things" line when the list runs
long.

### Open Loops and Tracker Review

From `tracker.md`, every open item, grouped into four buckets in this order. Skip
any bucket that is empty.

1. **Overdue, handle these first.** `due:` before today, unchecked. Oldest at the
   top. Flag anything more than 30 days past due as long overdue.
2. **High priority, already on your radar.** `!high` items not yet overdue.
3. **Coming up in the next two weeks.** `due:` inside the next 14 days, sorted by
   date.
4. **Stale, so commit, defer, or delete.** Open items with no `due:` and no
   `!high`, oldest `captured:` date first. Cap at five to eight unless something
   further down genuinely matters.

Write each item in plain language rather than copying the raw markdown line, and
fold the timing in where it helps: "get back to Priya about the migration date,
due tomorrow and two weeks past the original target."

If an email connector is live, add a short subsection after the four buckets for
threads still waiting on a reply, one to three lines, who and what and how long.
Without a connector, leave it out entirely.

When the tracker is genuinely clean, say so in one line and move on.

### Ideas Worth Keeping

Two to five. Thoughts, observations, half formed ideas, things the user said they
wanted to think about more. These are seeds, not tasks. One or two sentences
each, and only the ones with a pulse.

### People on Your Radar

One to three people who came up this week in a way that suggests a follow up,
gratitude, repair, or reconnection. One sentence each on why they surfaced and
what the nudge is. Use `[[Name]]` so the review links back to `people/`.

### Pattern Alert

Up to three patterns promoted in the pass above. For each: one line naming it,
one or two sentences on what has been observed and what is new this week, and a
link to the file, `[[theme-slug]]`.

Then, if there are weak signals that did not clear the bar:

**Watching (not yet a pattern)**

One line each, three maximum. Say what you noticed and why it does not qualify
yet: "mood dipped two days this week, both after late nights, not enough to call
it a trend."

If nothing was promoted and nothing is worth watching, skip the whole section.

### Non-negotiables

**Only when `config/season.md` question 4 names them.** If that answer is blank
or skipped, omit this section entirely and never mention it.

When they exist, give a short factual read on how they held this week. Pull from
the wrap's check in the daily notes. Two to four bullets: how many days each one
held, where the misses landed, and whether they clustered on the hard days.

Report the inputs, do not prescribe. If something slipped, name it plainly and
stop there. What to do about it is the user's call.

### The Honest Score

Two or three bullets on how the week actually went against what the season calls
for. What they leaned into, what they let slide, whether the week moved them in
the direction they said they wanted.

Not a grade, not a judgment, and not a pep talk. If the week was bad, the review
says the week was bad and shows the evidence.

### Carry Into Next Week

Three items maximum. Things that deserve early attention next week because they
are time sensitive, because they have been deferred too long, or because the
season makes them worth more right now. An intentional short list, not a dump of
the tracker.

### One Thing to Sit With

A single closing line. A quote from the user's own words, a pattern that deserves
more room than a bullet gives it, or an observation that is true and worth
carrying. Something a friend who was paying attention would notice, not a generic
close.

## Output

Write `reviews/YYYY-MM-DD-weekly.md`, named for the last day in the window, with
this frontmatter:

```yaml
---
type: review
date: YYYY-MM-DD
tags: ["#meta"]
---
```

Title the file with the range, for example `# Week of Monday, 2026-03-09 through
Sunday, 2026-03-15`, then the sections in the order above.

End the file with a sources footer so the review can be audited later:

```markdown
---

**Sources:** [[2026-03-09]], [[2026-03-10]], [[2026-03-12]],
[[2026-03-14 - Migration sync with Priya]], tracker.md
```

List every daily note and meeting note actually read, and name the days with no
note. Then commit:

```
git add -A && git commit -m "weekly-recap: week of 2026-03-09"
```

Push only if a remote exists. If there is none, stop after the commit and say
nothing about it.

Confirm to the user in two or three lines: the file you wrote, any patterns
promoted, and anything the tracker cleanup moved or flagged. Do not reprint the
review, they just read it.

## Tone and format rules

Honest, plain, attentive. A friend who read everything you wrote this week and is
giving you the real version back. Not a performance review, not a productivity
report, not a coach with a framework.

Length target is four to six minutes of reading. A weekly earns more depth than a
daily brief, but cut anything not pulling its weight. A quiet week gets a short
review.

Format:

- Bullets are the default in every section, including The Honest Score. Short
  sentences, natural connective phrases, not a task app dump.
- The only prose line is the closing one. Any paragraph you cannot avoid stays
  at three or four sentences.
- Whitespace between sections. Bold section names, and write so they still work
  with the formatting stripped.
- No em dashes and no double hyphens anywhere in the review you write. Use
  commas, parentheses, or a new sentence. Markdown `---` rules are fine.
- Second person throughout.

What to avoid:

- Praise and filler. No "what a productive week", no "you crushed it", no "you
  should be proud". If the week was rough, say so.
- Filler openers. No "let's review", no "here is your weekly summary".
- Using the user's name more than once.
- Walking through the week day by day. This is synthesis.
- Sections that exist to fill space.
- Turning The Honest Score into encouragement.
- Wins, patterns, or insights the notes do not clearly support.
