---
name: monthly-recap
description: Write the end-of-month review from that month's weekly recaps. Use when the user asks for a monthly recap, a month in review, how the month went, or to close out the month. Covers how each life thread moved, decisions that held or got walked back, gaps, trend lines, and whether the current season still fits. Writes reviews/YYYY-MM-monthly.md.
---

# Monthly Recap

You are writing an end-of-month review built on the month's weekly recaps. The
job is to find the arc no single week could see: where the month opened, where it
closed, what kept slipping, and which decisions held.

## When this runs

At the end of a calendar month, or in the first few days of the next one. The
user can also ask for a past month at any time.

Confirm which month you are reviewing before you read anything. Compute the first
day, the last day, and the run weekday through Bash, with the timezone from
`config/profile.md` set on the command itself: `TZ=Europe/Lisbon date +%Y-%m-%d`
and `TZ=Europe/Lisbon date +%A`, substituting the user's actual zone. A bare
`date` reads the machine clock, which is not necessarily the clock the user lives
on. Never infer a weekday from an ISO string. Title the review by month name and
year, for example "April 2027".

If the month has fewer than two weekly recaps in `reviews/`, say so and ask
whether to continue anyway. One weekly is not a month, and a review built on it
will read like a padded week.

If `reviews/YYYY-MM-monthly.md` already exists for the month you are about to
write, stop and ask before replacing it. Say when it was written and what it was
built from. A review assembled from four weeklies should not be silently
overwritten by a thinner run.

## Sources (read in this order)

1. `reviews/YYYY-MM-DD-weekly.md` for every week counted in this month, decided by
   the straddle rule below. This is the spine of the whole review. The weeklies
   already reduced the daily noise, so your work is synthesis across them, not
   re-reading the raw days.
2. `tracker.md` for what stalled across the whole month. An item that showed up in
   two or three separate weekly stale lists is real signal and worth more than one
   that went stale once. Read the Completed archive too, since it holds what
   actually closed.
3. `patterns/` to see which patterns got promoted or appended during the month and
   which watched items became real or fizzled.
4. `config/season.md` and `config/profile.md` for the lens and the thread list.

**Never re-crawl `daily/`.** Those notes were already read by the weeklies. If a
week inside the month has no weekly recap, fall back one rung and read that week's
daily notes to fill the hole, then name the gap in the review itself, one line
saying which week lacked a recap and what you read instead. Do not drop below
that, do not skip the gap quietly, and never invent content for a source that is
not there. If a week was thin, the review says the week was thin.

Do not re-run any sweep. Pattern promotion, connection checks, and anything else
that runs daily or weekly has already run. This review consumes their output.

Connectors are not part of this pass. Calendar and email already fed the daily and
weekly rungs, so nothing here needs them.

## Weeks that straddle the month boundary

Weeks do not line up with months. A weekly dated the fifth usually covers five
days of the month before it. Sort weeklies by filename and those days either get
counted in the wrong month or fall out of both.

The rule: **a week is counted in the month that holds most of its days.** A week
running March 30 through April 5 has five days in April, so it belongs to April.
A week running March 27 through April 2 has five days in March, so it belongs to
March. A short or partial week that splits evenly is counted in the month its file
is dated in. Whole weeks only. A week is never split across two reviews, and never
read into both.

Do not leave that arithmetic invisible. Name the straddle in one line near the top
of the review, in the user's terms:

- "The week of March 30 through April 5 counts here, so the last two days of March
  are in this review."
- "March 30 and 31 sit inside a week counted in April. They are covered there, not
  here."

If a week counted in this month has no weekly yet, either because the month ended
partway through it or because you are running early and the week has not closed,
the fallback above applies: read that week's daily notes, and say in the review
which days you read raw and which had not happened yet. Do not reach into `daily/`
for a week that belongs to a neighboring month. Those days are that month's to
report.

## Current season

Read `config/season.md` before you write a word. It names what this stretch of the
user's life is for, where their attention is supposed to go, what should be tracked
without them asking, and their non-negotiables. That file decides what counts as
meaningful this month.

The life threads come from `config/profile.md`. Use the threads the user actually
named there, in the order they named them. Never assume a thread they did not
write down, and never carry a thread over from another user's setup.

## What to include

Write the sections in this order. If a section has nothing real to say, leave it
out rather than padding it.

### Season Lens

One or two bullets naming the lens this review is read through, drawn from
`config/season.md`. This sets the bar for everything below it.

### The Month in Five Minutes

Four to six bullets on the arc and texture of the month across every thread. Where
it opened, where it closed, what it actually felt like to live. Not a
week-by-week replay. This is the version a friend who read everything gives back.

### How the Month Moved

One bullet per thread in `config/profile.md`. Start-state versus end-state,
direction, and distance. This is the section that earns the monthly its place, so
name the movement a single week cannot see. A thread that did not move gets a
bullet saying it did not move.

### Wins of the Month

Stack-ranked, most impactful first. Elevated and de-duplicated from the weekly
wins, keeping only what still matters at month altitude. A win that felt large in
week one and left no trace by week four does not belong here. Write each as a
natural phrase, not a trophy label. Skip the section rather than manufacture a
weak win.

### Decisions of the Month

Harvested from the `### Decisions Made` sections in the weeklies, plus anything the
weeklies surfaced out of project files. Four to ten items total, grouped four
ways. Drop any group that is empty.

- Held, meaning decided and still standing at month end. One line each on what it
  bought or what it cost.
- Walked back, meaning decided and then reversed or quietly dropped. Say what
  changed where the weeklies support it. Flag the reversal plainly instead of
  softening it.
- Still open, meaning named as a decision to make and still unmade. Note how long
  it has been sitting.
- Decision debt, meaning choices being made by default because nobody made them on
  purpose. These are the expensive ones. Call them out even when the sources only
  imply them.

### What Moved Forward

Progress beyond the headline wins: things finished, delivered, resolved, or
advanced. Lead with the most meaningful. If the list runs long, group the small
items under a single closing bullet.

### Gaps

The matched counterpart to Wins. Honest self-assessment across the month: judgment
calls, dropped balls, avoidance, missed follow-ups, habits worth correcting. Use
the stalled-tracker evidence as support, but frame it as the user's performance
rather than as circumstance. Honest, not harsh. Skip it if there is genuinely
nothing real.

<!-- Note for the composer: Gaps is a this-month self-assessment. It is
point-in-time and it can be true the first time it happens. Patterns, further
down, is cross-time recurrence, threshold-gated and neutral. A gap that recurred
all month may also appear as a hardened pattern below. Naming it in both, from
each section's angle, is correct. Most gaps in a given month will not be
patterns. -->

### The Main Thing

`config/season.md` names what this season is primarily about. This section gives
that one thing a concrete movement read for the month, with the same specificity a
progress report would carry.

Cover what entered, what advanced, what stalled, and what ended. Name the actual
things, not categories. If the season's primary focus is a book, say which chapters
got drafted and which stalled. If it is getting a practice off the ground, say which
clients came in and which referrals went cold. If it is a renovation, say which
rooms are finished and which are still open to the studs. If it is recovering from a
hard year, say what the month's evidence shows about that.

If the main thing barely moved in thirty days, say so plainly. That is usually the
most useful sentence in the review.

### Trend Lines

Energy and mood across the month, plus any rhythm the notes actually track, such
as sleep, exercise, or reading. Describe the shape: steady, climbing, volatile, a
recovery that held or did not. Tie shape to cause only where the sources support
the link.

If `config/season.md` question 4 names non-negotiables, read the floor against them
explicitly: how many days each one held across the month, where the misses landed,
and whether they clustered. Report the inputs, do not prescribe. If that answer is
blank or marked `(skipped)`, skip the floor read entirely and do not mention it.

### The Evening Question

**Only when `config/season.md` question 5 names one.** If that answer is blank or
marked `(skipped)`, omit this section and never mention it.

The wrap asks that question every night, so a month holds around thirty answers
and nothing below this rung has read them together. Give back what a single night
could not show: what the answers keep circling, where they turned, and any stretch
where they went flat or went unanswered. Two to four bullets, quoting two or three
of the user's own answers rather than paraphrasing all of them.

### Patterns: What Hardened, What Faded

Consolidation over `patterns/`. Review only, and do not run the pattern sweep.
Cover which patterns were promoted or strengthened this month with links to the
files, which watched items became real or fizzled, and any pattern that now looks
stale enough to retire. Recommend retirement, do not edit or delete the file.

If the patterns did not move this month, say so in one line.

### People and Relationships

Who mattered this month, who got invested in, who went quiet, who deserves a
reconnect or a thank-you. Month altitude, so only the names with weight, not
everyone who appeared. One line each on why they surfaced and what the nudge is.
Use `[[Name]]` links.

### Ideas Worth Keeping

Seeds from the weeklies that still have a pulse a month later. Two to five max,
one or two sentences each. Drop anything that was interesting in the moment and
clearly went nowhere.

### The Honest Score

A candid month-level read against what the season calls for. Not a grade, not a
pep talk. What got leaned into, what got let slide, whether the month moved things
toward what the user said they wanted. If the month was rough, say so plainly and
do not round it up to be kind.

### Season Check

Whether `config/season.md` still describes real life. If the month's evidence says
it does, one line is enough.

If it does not, propose the specific edits inside the review and stop there. Show
what you would change and why the month says so. Do not write to
`config/season.md` in this run, even when the case looks obvious. The quarterly is
where a full rewrite gets proposed. The monthly only flags drift.

### Carry Into Next Month

Three to five items, maximum. What genuinely deserves early attention: time
sensitive, deferred too long, or unusually high impact given the season. Not
a to-do dump.

### One Thing to Sit With

A single closing line. A quote from the user's own words, a pattern that deserves
more reflection than a bullet holds, or something true that is worth carrying.
Something a friend who was paying real attention would notice, not a generic
affirmation.

## Output

1. Write to `reviews/YYYY-MM-monthly.md`, for example `reviews/2027-04-monthly.md`.

```yaml
---
type: review
date: YYYY-MM-DD          # last day of the reviewed month
tags: ["#meta"]
---
```

Add the user's own tags from `config/profile.md` alongside `#meta` where they fit
the month.

2. Title the body `# Monthly Recap: <Month> <Year>`.
3. End with a sources footer, in the same shape the weekly uses, wikilinking the
   weekly recaps you read, naming any week you had to fill from daily notes, and
   naming the straddling week at either end and which month it counted in:

```markdown
---

**Sources:** [[2027-04-05-weekly]], [[2027-04-12-weekly]], [[2027-04-19-weekly]],
[[2027-04-26-weekly]], tracker.md
```
4. Commit, staging the file by its own path:

```
git add reviews/YYYY-MM-monthly.md
git commit -m "monthly-recap: YYYY-MM"
```

Never `git add -A`. This folder is a working record, so there is usually unrelated
work sitting in the tree, and a review run has no business committing it.

Then check for a remote. Push only to a remote the user owns. If there is no
remote, or the only one belongs to somebody else, stop after the commit and say
nothing about it.

5. Confirm with a short summary and the output path. Do not read the review back
   at the user.

## Tone and format rules

Honest, warm, specific. Someone who read a month of notes and is giving back the
real version. Not a performance review, not a productivity report, not a coach
with a framework.

Length lands around six to eight minutes of reading, a notch above the weekly
because a month earns more depth. Cut anything that does not pull its weight.

Bullets are the default for every section. The only prose section is the closing
line. Even the longer sections are bullets, written as short sentences with
natural connective phrasing so they read like a person talking. Keep any
unavoidable paragraph to three or four sentences. Use whitespace between sections.

No em dashes and no double hyphens anywhere in the review you generate. Use
commas, parentheses, or a new sentence. This applies to any season edits you
propose as well.

Avoid:

- Filler and flattery. No "what a month", no "you crushed it", no "you should be
  proud".
- Filler openers like "here is your monthly summary". Start on substance.
- Using the user's name more than once.
- Replaying the weeks in order. This is a synthesis across the weeklies, not a
  concatenation of them.
- Sections that exist to fill space.
- Turning The Honest Score into encouragement.
- Manufacturing a win, gap, decision, pattern, or insight the weeklies do not
  clearly support.
