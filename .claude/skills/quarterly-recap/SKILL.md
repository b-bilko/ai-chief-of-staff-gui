---
name: quarterly-recap
description: Write the end-of-quarter review from that quarter's three monthly recaps, then propose a rewrite of config/season.md from what the quarter actually showed. Use when the user asks for a quarterly recap, a quarter in review, how the quarter went, or to close out Q1, Q2, Q3, or Q4. Writes reviews/YYYY-QN-quarterly.md.
---

# Quarterly Recap

You are writing an end-of-quarter review built on the quarter's three monthly
recaps. The job is to find the arc no single month could see: where the quarter
opened versus where it closed, which decisions held and which got walked back,
which patterns hardened into something real. Then you propose what the next season
should be.

## When this runs

At the end of a calendar quarter, or in the first days of the next one. The user
can also ask for a past quarter at any time.

Confirm which quarter before reading anything. Q1 runs January first through March
thirty-first, Q2 April first through June thirtieth, Q3 July first through
September thirtieth, Q4 October first through December thirty-first. Compute the
boundaries and the run weekday with `date` through Bash, never from an ISO string.
Use the timezone in `config/profile.md` for every date you write. Title the review
by quarter and year, for example "Q3 2027".

If the quarter has no monthly recaps and no weeklies either, say so and stop. A
quarterly built on nothing is fiction.

## Sources (read in this order)

1. `reviews/YYYY-MM-monthly.md` for each of the quarter's three months. These are
   the spine of the whole review.
2. For any month with no monthly recap, fall back one rung to that month's
   `reviews/YYYY-MM-DD-weekly.md` files. Name the gap in the review itself, one
   line saying which month lacked a monthly and what you read instead. Do not
   paper over it, and do not drop to daily notes to fill it.
3. `tracker.md` for what stalled across ninety days. An item that survived two or
   three separate monthly stale lists is stronger signal than one that went stale
   once. The Completed archive shows what actually closed.
4. `patterns/` for which patterns were promoted, strengthened, or appended across
   the quarter, and which watched items resolved or fizzled.
5. `projects/` decision records, for the Decisions of the Quarter section only.
6. `config/season.md` and `config/profile.md` for the lens and the thread list.

**Never re-crawl `daily/`.** Three levels of reduction already happened below you.
Do not re-run any sweep. Never invent content for a missing source. If a month was
thin, say it was thin.

Connectors are not part of this pass. Everything a calendar or an inbox had to say
reached the daily and weekly rungs months ago.

## Current season

Read `config/season.md` for the lens, and take the life threads from
`config/profile.md`. Use the threads the user named there, in their order. Never
assume a thread they did not write down.

Ninety days is long enough that the season may have shifted underneath the file.
If the evidence says the season named there no longer matches how the quarter was
actually lived, that is the central finding of the review, and Season Rewrite is
where it goes.

## What to include

Write the sections in this order. If a section has nothing real to say, leave it
out rather than padding it.

### Season Lens

One or two bullets naming the lens this review is read through, from
`config/season.md`. This sets what counts as meaningful across three months.

### The Quarter in the Rearview

Five to seven bullets on the arc and texture of the quarter across every thread.
Where it opened, where it closed, what it actually felt like to live through. Not
a chronological replay of three months. The version a friend gives after reading
everything.

### How the Quarter Moved

One bullet per thread in `config/profile.md`. Start-state versus end-state,
direction, and distance. This is the section that earns the quarterly its place.
Name the movement a single month cannot see, including the slow drifts that only
register at ninety days. A thread that went untouched for three months gets a
bullet saying exactly that.

### Wins of the Quarter

Stack-ranked, most impactful first. Elevated and de-duplicated from the monthly
wins, keeping only what still matters at quarter altitude. A win that felt large
in the first month and left no trace by the third does not belong here. Write each
as a natural phrase, not a trophy label. Skip the section rather than manufacture
a weak win.

### Decisions of the Quarter

Harvested from the monthlies' Decisions of the Month sections and from decision
records in `projects/`. Four to ten items total, grouped four ways. Drop any group
that is empty.

- Held, meaning decided and still standing at quarter end. One line each on what it
  bought or what it cost.
- Walked back, meaning decided and then reversed or quietly abandoned. Say what
  changed where the sources support it. Flag reversals plainly rather than
  softening them.
- Still open, meaning named as a decision to make and still unmade. Note how long
  it has been sitting, in months if that is the honest unit.
- Decision debt, meaning choices being made by default because nobody made them on
  purpose. These are the expensive ones. Call them out even when the sources only
  imply them.

A decision that appeared as held in month one and walked back in month three
belongs in Walked back, with the arc stated in the line.

### Gaps

The matched counterpart to Wins. Honest self-assessment across the quarter:
judgment calls, dropped balls, avoidance, missed follow-ups, habits worth
correcting. Use stalled-thread evidence as support, especially tracker items that
went stale in two or three separate months, but frame it as performance rather
than circumstance. Honest, not harsh. Skip it if there is genuinely nothing real.

<!-- Note for the composer: Gaps is a this-quarter self-assessment. It is
point-in-time and it can be true the first time it happens. Patterns, further
down, is cross-time recurrence, threshold-gated and neutral. A gap that recurred
all quarter may also appear as a hardened pattern below. Naming it in both, from
each section's angle, is correct. -->

### The Main Thing

`config/season.md` names what this season is primarily about. At quarter altitude
this section tells the full arc of that one thing, with named specifics
throughout.

Cover what entered over the three months and where it came from, what advanced and
how far it got, what died and at what stage, what went quiet without ever formally
ending, and what is live at quarter end with its next step. Then say what shape the
quarter had. Ninety days is long enough to show where the trouble sits: at the
start of things, in the middle, or at the finish. If the same failure point
repeats across several attempts, name it.

If the main thing barely moved in three months, say that plainly. It is the most
useful sentence in the section.

### Trend Lines

Energy and mood across the quarter, plus any rhythm the notes actually track.
Describe the shape across three months: steady, climbing, sawtooth, a recovery
that held or did not. If `config/season.md` names non-negotiables, read the floor
against them explicitly and say whether it held. Tie shape to cause only where the
sources support the link.

### Patterns: What Hardened, What Faded

Consolidation over `patterns/`. Review only, and do not run the pattern sweep.
Cover which patterns were promoted or strengthened this quarter with links to the
files, which watched items became real patterns and which fizzled, and retirement
candidates. A pattern with no confirming signal in a full quarter has probably
stopped being true, so name it and recommend retiring it. Recommend only. Do not
edit or delete a pattern file.

If the patterns did not move this quarter, say so in one line.

### People and Relationships

Who mattered across the quarter, who got invested in, who went quiet, who deserves
a reconnect or a thank-you. Quarter altitude, so only the names with weight. One
line each on why they surfaced and what the nudge is. Three months of silence from
someone who was central in the first month is worth naming. Use `[[Name]]` links.

### The Honest Score

A candid quarter-level read against what the season calls for. Not a grade, not a
pep talk. What got leaned into, what got let slide, whether ninety days moved
things toward what was actually wanted. If the quarter was rough, say so plainly
and do not soften it into a lesson.

### Season Rewrite

This is the headline ritual of the quarterly. A quarter is the right interval to
ask whether `config/season.md` still describes real life, and the answer comes
from evidence rather than from how the user feels on the day they run this.

Start with the read: what the season file says this stretch is for, versus what
the three months actually show. Attention allocation is the sharpest test. If the
file says a third of the user's energy goes to one thread and the quarter shows it
went untouched for six weeks, that gap is the finding.

Then draft a proposed replacement `config/season.md`, written out in full inside
the review, following the five questions in the current file: what the season is
about, where attention should go, what gets tracked without being asked, the
non-negotiables, and the optional evening-wrap question. Write the draft in the
user's own language wherever the sources give it to you. Keep every proposed
answer short enough to be answerable, and hold the same punctuation rules as the
rest of the review.

Then walk the user through it, one choice at a time:

- Accept the draft as written.
- Edit it, in which case ask which of the five answers they want to change and
  work through only those.
- Keep the current season, in which case say what evidence they are choosing
  against, once, and drop it.

**Write `config/season.md` only after the user says yes.** Not when the case looks
obvious, not when they say the draft reads well, not when they go quiet. An
explicit yes, then write the file and commit it separately with the message
`season: updated after YYYY-QN`. If the season still fits, say so in a line and
skip the draft entirely.

### Carry Into Next Quarter

Three to five items, maximum. What genuinely deserves early attention: time
sensitive, deferred too long, or unusually high impact given the season. Not
a to-do dump. If something has been carried forward from two prior monthlies
without moving, either say why it is still here or recommend dropping it.

### One Thing to Sit With

A single closing line. A quote from the user's own words, a pattern that deserves
more reflection than a bullet holds, or an observation worth carrying into the
next ninety days. Something a friend who was paying real attention would notice,
not a generic affirmation.

## Output

1. Write to `reviews/YYYY-QN-quarterly.md`, for example
   `reviews/2027-Q3-quarterly.md`.

```yaml
---
type: review
date: YYYY-MM-DD          # last day of the reviewed quarter
tags: ["#meta"]
---
```

Add the user's own tags from `config/profile.md` alongside `#meta` where they fit
the quarter.

2. Title the body `# Quarterly Recap: <Quarter> <Year>`.
3. End with a sources footer, in the same shape the weekly and monthly use,
   wikilinking the monthly recaps you read plus the substitute weeklies for any
   month that had no monthly:

```markdown
---

**Sources:** [[2027-07-monthly]], [[2027-08-monthly]], [[2027-09-06-weekly]],
[[2027-09-13-weekly]], tracker.md
```
4. Commit:

```
git add -A && git commit -m "quarterly-recap: YYYY-QN"
```

Then check for a remote and push if one exists. If there is no remote, stop after
the commit and say nothing about it.

5. Confirm with a short summary and the output path, and state where the season
   question landed: accepted, edited, or kept. Do not read the review back at the
   user.

## Tone and format rules

Honest, warm, specific. Someone who read three months of notes and is giving back
the real version. Not a performance review, not a productivity report, not a coach
with a framework.

Length lands around eight to ten minutes of reading, a notch above the monthly
because a quarter earns more depth. The extra length belongs in Decisions, The
Main Thing, and Season Rewrite rather than spread evenly. Longer is not better.

Bullets are the default for every section. The only prose section is the closing
line, though the Season Rewrite draft follows the shape of the season file itself.
Even the longer sections are bullets, written as short sentences with natural
connective phrasing so they read like a person talking. Keep any unavoidable
paragraph to three or four sentences. Use whitespace between sections.

No em dashes and no double hyphens anywhere in the review you generate, and none
in the proposed season file either. Use commas, parentheses, or a new sentence.

Avoid:

- Filler and flattery. No "what a quarter", no "you crushed it", no "you should be
  proud".
- Filler openers like "here is your quarterly summary". Start on substance.
- Using the user's name more than once.
- Summarizing the three months in order. This is a synthesis across the monthlies,
  not a replay of them.
- Sections that exist to fill space.
- Turning The Honest Score into encouragement.
- Manufacturing a win, gap, decision, pattern, or insight the source recaps do not
  clearly support.
- Writing to `config/season.md` without an explicit yes.
