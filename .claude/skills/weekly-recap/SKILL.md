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

### Mark a thin week as thin

A review built on one or two daily notes still lands in `reviews/` as a file
named like any other, and the monthly, quarterly, and annual rungs read it as a
week of coverage. On a vault that is a few days old that is how two days of notes
turn into a permanent rung nobody questions later.

So say it in the file. When the window holds fewer than three daily notes, add a
fourth frontmatter field and a line under the title:

```yaml
---
type: review
date: 2026-03-18
tags: ["#meta"]
coverage: thin
---
```

```markdown
Built from 2 daily notes out of 7 days. Thin coverage, so read the sections below
as a partial week rather than a full one.
```

Use the exact value `coverage: thin`, lowercase, because the rungs above look for
that string. Count actual daily notes, not days in the window. Leave the field out
entirely at three notes or more rather than writing `coverage: full`.

The review itself gets shorter, not softer. Skip more sections, keep the ones with
real material, and do not stretch two days into a week's worth of observations.

## Dates and week boundaries

Read the timezone out of `config/profile.md` first, then attach it to every date
command. A bare `date` reads the machine clock, which is a different day from the
user's whenever they are travelling or the machine is set to something else, and
a week boundary computed in the wrong zone silently drops a day.

With `Europe/Lisbon` in the profile:

- `TZ=Europe/Lisbon date +%Y-%m-%d` for today's date
- `TZ=Europe/Lisbon date +%A` for the weekday

Never read a weekday off an ISO string. Compute the window boundaries the same
way, zone attached. Past date arithmetic is not portable, so pick the form that
matches the machine: `TZ=Europe/Lisbon date -v-6d +%Y-%m-%d` on macOS,
`TZ=Europe/Lisbon date -d '6 days ago' +%Y-%m-%d` on GNU. If you do not know
which you are on, try one and fall back to the other when it errors. Never drop
the `TZ=` to make a command work.

If `config/profile.md` has no timezone in it, stop and ask the user for theirs
before you compute a single date. Do not fall back to the machine zone and do not
guess from anything else. A boundary computed in the wrong zone drops or adds a
day and nothing in the finished review says it happened. Setup collects the
timezone, so this should never come up, and if it does the file is broken and
worth fixing before the recap runs.

### The window is a rolling seven days

The default window is the last seven days ending today, inclusive. It is not a
calendar week and it does not start on Monday. Run on a Wednesday and you get
Thursday through Wednesday. If the user names a week instead, compute those
boundaries explicitly and say the range back to them in one line before you
start.

Whatever the window turns out to be, the review has to carry it in a place nobody
can miss. Put the full range with weekday names in the title, and repeat it in
the first line of the body along with the fact that it is a rolling window rather
than a calendar week:

```markdown
# Week of Thursday, 2026-03-12 through Wednesday, 2026-03-18

Covers the seven days ending Wednesday, 2026-03-18. This is a rolling week, not a
Monday to Sunday one.
```

Take every weekday name from a zone-attached `date` call, never from reading the
ISO string. Someone opening this file in six months should not have to work out
what was covered.

### Do not overwrite an existing review

The output file is named for the last day in the window. Before you write, check
whether `reviews/` already holds a file for that date.

If one is there, stop and ask. Say when it was written and what it was built
from, its title, its range, how many daily notes backed it, and whether it is
marked `coverage: thin`. Then let them choose: replace it, write this one under a
different name, or cancel. A review built from six daily notes should not be
silently replaced by a rerun that can only see two. Never overwrite a review
without an explicit yes, and never merge the two silently. Reviews are what the
monthly, quarterly, and annual rungs are built from, so a lost weekly quietly
takes a piece out of every review above it.

## Sources (read in this order)

1. `tracker.md`. Drives the Open Loops and Tracker Review section, and the
   Completed (Archive) section feeds the wins list.
2. Every `daily/YYYY-MM-DD.md` in the window. Read the whole note: the entries,
   the End of Day Reflection, and the `## Decisions Made` section if the wrap
   wrote one, matching that heading exactly.
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

The season sets what counted as meaningful this week and feeds three sections
directly: Non-negotiables (question 4), Your Evening Question (question 5), and
The Honest Score.

### When the config is not fully filled

Check the answer slots, not the file text. Both config files carry instruction
comments that name the placeholder markers in prose, and those comments stay
there forever, so a plain search for that string matches on a fully configured
vault every time. Look at what sits under each numbered heading instead.

A slot counts as filled when it holds anything the user put there, and
`(skipped)` is something the user put there. It is a deliberate pass on an
optional question, so read it as a filled answer and move on. A skipped season
question must never block the recap. Questions 4 and 5 are optional by design,
and skipping one only means the section it feeds does not get written.

Then degrade rather than stop:

- Every slot still unfilled, nothing written anywhere: the user has not been set
  up. Say so in one line, offer the setup interview in CLAUDE.md, and stop.
- Some filled, some not: run the recap on what is there. No season means no
  season lens, so The Honest Score reports against the profile's life threads
  instead and the recap says nothing about the missing file.

A partly filled config is a normal state, not an error.

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

- A feeling or a word the user keeps reaching for in unrelated contexts.
- The same kind of frustration surfacing in different places, rather than one
  problem retold.
- Intentions stated and left alone, where the not acting is the through line and
  no single task is.
- A person mentioned often and never actually contacted, or one who used to come
  up constantly and has gone quiet.
- A subject circled from several angles without a decision landing.
- Something the season says matters that almost never appears in the notes.

**The threshold. All three parts have to hold. Miss any one and it is not a
pattern.**

1. **Volume.** Three or more confirming signals, on three or more separate days.
2. **Independence.** Those signals come from at least two distinct subjects or
   occasions. One thing brought up again and again is a single signal recorded
   repeatedly, not a theme. The same unsent email raised on Monday, Tuesday, and
   Wednesday counts once, no matter how many notes it appears in. The same
   avoidance showing up around an unsent email, a postponed dentist appointment,
   and a call home nobody made counts as three.
3. **History.** At least 30 days of daily notes exist, and the confirming signals
   span 14 days or more. A vault two weeks old has no past to compare against,
   so it cannot tell a pattern from an ordinary bad week.

Why it is this strict: `patterns/` is permanent and append-only, so a theme
promoted in week one is still sitting there a year later whether or not it ever
recurred. A file that never earns a second entry is noise the annual review has
to clean up. Early on, almost nothing clears this bar, and that is the design
working. If the user asks why the section keeps coming up empty, tell them
plainly that there is not enough history yet and roughly when there will be.

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

Signals: 4 across 3 days, 3 separate occasions
Evidence: [[2026-03-09]], [[2026-03-11]], [[2026-03-14]]
```

Record the occasion count, not just the signal count. It is the line that shows
a later reader the theme cleared the independence bar rather than being one
worry counted several times.

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

Harvest the `## Decisions Made` sections the daily wrap wrote into this week's
daily notes, matching that heading exactly. Also pick up decisions stated plainly
in meeting notes or in the entries themselves, even when the wrap did not catch
them.

Two to six items, one line each: what was decided, and why. Keep the user's own
reasoning rather than a cleaned up version of it.

- Pushed the kitchen tile start to April so the crew is not sitting idle waiting
  on a back order
- Said no to the Thursday evening class, it was costing the only night at home
  all week

If something was decided and then reversed inside the same week, say so on the
same line and name both days. Reversals are the most useful thing this section
produces, so do not smooth them over.

If no decisions appear anywhere in the week, write one line saying that. A week
with no decisions in it is worth knowing about.

### What Got Done

What the user completed, finished, resolved, or moved forward beyond the headline
wins. Natural phrases, not task labels. Lead with what mattered most and group
the tail under a single "and a handful of smaller things" line when the list runs
long.

### Open Loops and Tracker Review

From `tracker.md`, every open item, grouped into four buckets in this order. Skip
any bucket that is empty. Take items only from the thread sections below the
`## Sections` heading, and skip any line holding a placeholder in curly braces,
since the format documentation above that heading contains a line shaped like an
unchecked item.

1. **Overdue, handle these first.** `due:` before today, unchecked. Oldest at the
   top. Flag anything more than 30 days past due as long overdue.
2. **High priority, already on your radar.** `!high` items not yet overdue.
3. **Coming up in the next two weeks.** `due:` inside the next 14 days, sorted by
   date.
4. **Stale, so commit, defer, or delete.** Open items with no `due:`, not
   `!high`, and a `captured:` date 14 or more days ago. Oldest first. Cap at
   five to eight unless something further down genuinely matters.

   The 14 day floor is deliberate and it matches the daily wrap's check in, so
   the two rungs mean the same thing by stale. Both count day 14 itself as
   stale. Write the boundary as 14 or more, never as more than 14, or an item
   sitting at exactly fourteen days falls through the gap between the two rungs
   on the one day it would have surfaced. An item captured this week is new, not
   stale. It stays out of this bucket even though it has no date and no priority
   marker, and it is not evidence of anything yet.

Write each item in plain language rather than copying the raw markdown line, and
fold the timing in where it helps: "call the vet back about Rosie's dental, due
tomorrow and two weeks past when you said you would."

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

One line each, three maximum. Say what you noticed and which part of the bar it
missed, so the user sees the reasoning instead of a verdict:

- Mood dipped two days this week, both after late nights, not enough days yet
- The unsent email came up three days running, but that is one thing repeated
  rather than three separate occasions
- Money came up twice in a way that felt heavier than usual, and there are only
  3 weeks of notes to compare against so far

If nothing was promoted and nothing is worth watching, skip the whole section.

### Non-negotiables

**Only when `config/season.md` question 4 names them.** If that answer is blank
or reads `(skipped)`, omit this section entirely and never mention it.

When they exist, give a short factual read on how they held this week. Pull from
the wrap's check in the daily notes. Two to four bullets: how many days each one
held, where the misses landed, and whether they clustered on the hard days.

Report the inputs, do not prescribe. If something slipped, name it plainly and
stop there. What to do about it is the user's call.

### Your Evening Question

**Only when `config/season.md` question 5 defines one.** If it is blank or reads
`(skipped)`, this section does not exist and you never mention it.

The wrap has been asking that question every night and filing the answer in a
subsection of each reflection. This is the first thing that reads them back.
Open with the question as the user worded it, then two to four bullets on the
week's answers: what came up more than once, where an answer changed across the
week, and any night that landed well outside the rest. Quote their own phrasing
where a phrase repeats, since the repeat is the finding.

Same register as Non-negotiables. Report what they said and stop. Do not
interpret it, do not score it, and do not suggest a better question. If only one
or two nights have an answer, one line saying so is the whole section.

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

Add `coverage: thin` as a fourth field when the window held fewer than three
daily notes, as described above. That is the only case where this file carries a
fourth field.

Title the file with the range, for example `# Week of Monday, 2026-03-09 through
Sunday, 2026-03-15`. Then the window line, then the thin-coverage line if the
week earned one, then the sections in the order above.

End the file with a sources footer so the review can be audited later:

```markdown
---

**Sources:** [[2026-03-09]], [[2026-03-10]], [[2026-03-12]],
[[2026-03-14 - Walkthrough with the roofer]], tracker.md
```

List every daily note and meeting note actually read, and name the days with no
note. Then commit.

Stage by path, naming only the files this run actually touched. That is the
review, plus `tracker.md` if cleanup moved or flagged anything, plus any pattern
file you appended to:

```
git add reviews/2026-03-15-weekly.md tracker.md patterns/sleep-and-energy.md
git commit -m "weekly-recap: week of 2026-03-09"
```

Never use `git add -A`. It sweeps in whatever else is sitting uncommitted in the
folder, including half-written notes the user has not decided about, and it puts
them in a commit labelled as a recap.

Push only when a remote exists and it is one the user owns. If there is no
remote, or the remote is a repository they cannot push to (a clone of someone
else's template still points at the original), stop after the commit and say
nothing about it. Do not add a remote and do not offer to.

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
- Whitespace between sections. Section names are `###` headings in the file you
  write, spelled the way this spec spells them, which is what the monthly,
  quarterly, and annual rungs use too. Bold is for sub-labels inside a section,
  not for section names. Write so each section still reads with the formatting
  stripped.
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
