---
name: annual-review
description: Write the year in review from whatever recaps the year left behind, quarterlies first, then monthlies, then weeklies, or run a guided quarter-by-quarter interview when reviews/ holds nothing for the year at all. Use when the user asks for an annual review, a year in review, to close out the year, or what the year added up to. Covers the year's arc, how each thread traveled, wins and gaps, decisions of the year, what the patterns now say, what carries into next year, and a drafted opening season. Writes reviews/YYYY-annual.md.
---

# Annual Review

You are writing the year in review. It runs one of two ways depending on what is
in `reviews/`, and the first thing you tell the user is which one and why.

A year is the only altitude where you can see which beliefs about yourself turned
out to be true. That is the work here, not a longer list of accomplishments.

## When this runs

At the end of a calendar year, or in the first weeks of the next one. The user can
also ask for a past year at any time, or for the year they are currently in, which
runs as a year to date and is covered below.

Confirm the year before reading anything. Compute the boundaries and the run
weekday through Bash, with the timezone from `config/profile.md` set on the command
itself: `TZ=Europe/Lisbon date +%Y-%m-%d` and `TZ=Europe/Lisbon date +%A`,
substituting the user's actual zone. A bare `date` reads the machine clock, which
is not necessarily the clock the user lives on. Never read a weekday off an ISO
string.

Backing up from today is not portable between systems, so use the form that
matches the machine: `TZ=Europe/Lisbon date -v-1y +%Y` on macOS,
`TZ=Europe/Lisbon date -d '1 year ago' +%Y` on GNU. Try one and fall back to the
other when it errors, and keep `TZ=` on whichever you end up using.

If `config/profile.md` carries no timezone, stop and ask the user for theirs
rather than guessing or reading the machine zone. Setup collects it, so this
should not happen, and if it has then something is wrong with the file.

### When the year has not finished yet

Compare the year being reviewed against today's date in the user's zone. If they
are the same year, the year is still running and this is not a year in review. It
is a year to date, and every part of the output has to say so.

Say it before you read anything, in one line: "It is July 18, so 2026 has about
five months left in it. I can run this as a year to date review through today,
covering what exists so far." Then wait for a yes. Do not present a partial year
as a finished one and do not quietly widen the window to twelve months.

When you run it:

- Set the end boundary to today, not December 31. Everything downstream, the
  coverage counts, the fallback logic, the mode choice, uses that boundary.
- Title the body `# Year to Date: <Year>, through <Month> <Day>`, for example
  `# Year to Date: 2026, through July 18`. Do not title it Year in Review.
- Set `date:` in the frontmatter to the last day actually covered, which is
  today's date computed in the user's zone. Never December 31 of a year that has
  not reached it. A future date on a review is wrong on its face and it sorts the
  file ahead of every real one.
- Say in the first line of the body what the review covers and what it does not,
  including how many weeks or months of the year are in it. Seven weeks of notes
  inside a seven month stretch is a very different thing from seven months of
  coverage, and the opening line is where that gets stated.
- Hold the year altitude sections to what a partial year can support. The Year's
  Arc describes the arc so far. How Each Thread Traveled reports distance covered
  to date rather than a full year of travel. What the Patterns Now Say is the
  section most likely to overreach, because a pattern needs a year to be judged
  as a fact about someone, so where the evidence has not had time to accumulate,
  say that instead of ruling on it.
- Close by offering to run it again once the year actually ends, and say that the
  later run will replace this file.

The same applies to a fiscal or school year that has not reached its end date. It
is the end boundary that matters, not the calendar.

### Do not overwrite an existing annual

If `reviews/YYYY-annual.md` already exists for the year you are about to write,
stop and ask before replacing it. Say when it was written, which mode built it,
what it was built from, whether any of those sources carried `coverage: thin`,
and whether the existing file is a year to date rather than a finished year. Then
let the user choose: replace it, write this one under a different name, or cancel.
An annual assembled from four quarterlies is the richest file in this folder, and
an interview run started on a quiet afternoon should never overwrite it without
the user saying so.

The one case where replacing is the obvious answer is a year to date file being
superseded by a run over the closed year. Say that is what you are looking at,
recommend replacing it, and still wait for the yes.

There is a work-only version of this, shaped for a performance review, a promotion
packet, or any year-end account of the work that somebody else reads, at
<https://derrekyoung.com/agents/year-in-review-chief-of-staff/>. If that is what
the user is after, point them there instead. This skill reviews a life, and plenty
of the people running it have no manager to hand anything to.

## Which mode you are in

Look in `reviews/` for the year at three levels, in this order: quarterlies, then
monthlies, then weeklies. The highest level that exists is your spine.

**Mode A** is a synthesis pass, and it runs whenever any of those three levels has
something in it.

- Four quarterlies: a single pass over them.
- One to three quarterlies: same pass, and for each missing quarter fall back one
  rung to that quarter's `reviews/YYYY-MM-monthly.md` files.
- No quarterlies, but monthlies: build the spine from the monthlies, taking them
  three at a time to get quarter-level reads.
- No quarterlies and no monthlies, but weeklies: build the spine from the weeklies,
  grouping them into months with the monthly skill's straddle rule and the months
  into quarters. Four weeklies is thin cover for a year, so say what the coverage
  actually is and where it runs out. Finished synthesis sitting on disk beats an
  interview that pretends it is not there.

Name every fallback in the review itself, one line per stretch, saying what was
missing and what you read instead. Do not drop below the level you landed on.

**Mode B**, the guided interview, is the last resort. It runs only when the year
has no quarterly, no monthly, and no weekly. There is no spine to synthesize, so
you build one with the user.

Say which mode you are running and why in one line before you start:

- "Running the synthesis pass off weeklies. There are no quarterly or monthly
  recaps for 2027, but `reviews/` has eleven weeklies, so the year gets built from
  those and I will name the stretches they do not cover."
- "Running the interview version. There are no quarterly, monthly, or weekly recaps
  for 2027 at all, so we build the year together rather than me summarizing files
  that do not exist."

Never run Mode A over thin sources and let it read as though the record was
complete.

## Sources (read in this order)

**Mode A:**

1. The year's `reviews/YYYY-QN-quarterly.md` files. These are the spine.
2. For any missing quarter, that quarter's `reviews/YYYY-MM-monthly.md` files.
3. For any month those do not cover either, that month's
   `reviews/YYYY-MM-DD-weekly.md` files, grouped by the monthly skill's straddle
   rule.
4. `patterns/`, in full. The year is where patterns get judged rather than
   collected.
5. `tracker.md`, mostly the Completed archive, for what actually finished.
6. `config/season.md` and `config/profile.md` for the lens and the thread list.
   The season file has probably been rewritten once or twice during the year. The
   quarterlies record those rewrites, and the sequence of them is itself a
   finding.

**Never re-crawl `daily/` in Mode A.** Whichever of the three review levels you
landed on, do not drop below it. The reduction has already been done and re-reading
raw days throws it away. `patterns/` and `tracker.md` are read directly here, but
that is a lateral read rather than a step down the ladder: both are running records
that every rung reads for itself, not summaries of the rung below.

Do not re-run any sweep. Never invent content for a missing source.

### Recaps marked thin

A recap carries `coverage: thin` in its frontmatter when it was built on very
little: a weekly from fewer than three daily notes, a monthly or quarterly where
half its sources or more came in thin. Check that field on every file you read,
whichever level you landed on.

Weight a thin recap as partial. Twelve weeklies where seven are thin is not a
year of coverage, and the review says which stretches of the year are actually
backed and which are barely there. A thin source never carries a year altitude
claim on its own, and that matters most in Wins of the Year, Gaps, and What the
Patterns Now Say, where the whole point is what survived twelve months. Something
that appears once inside a thin week has not survived anything yet.

Say the coverage in plain terms near the top, next to the mode line: how much of
the year has real backing and how much does not. If half the year or more came
from thin sources, carry `coverage: thin` into this review's own frontmatter too.
Where a stretch is thin enough that you cannot say what happened, ask the user
rather than filling it, the same way Mode B does.

**Mode B** is the one exception to the ladder rule, because there is no rung below
to stand on. Read whatever exists, starting with `reviews/`. Even in Mode B that
folder can hold finished work the mode count missed, a recap filed under an odd
name, a review that spans the year boundary, an annual from the year before that
sets the starting state. Read it first and use it, because completed synthesis is
better evidence than raw notes. Then `daily/`, `meetings/`, `tracker.md` including
the archive, `patterns/`, and `projects/`. Scope every read to the quarter you are
working on. Where the files are thin or absent, ask the user to fill the gap in
their own words rather than reconstructing a plausible year. An interview answer
is evidence. A guess is not.

## Current season

Read `config/season.md` for where the user stands now, and take the life threads
from `config/profile.md`. Use the threads the user named there, in their order.
Never assume a thread they did not write down.

A year usually spans two or three seasons. Read the season the user is in now as
the endpoint of the story, not as the lens the whole year should be judged
against. Judging January against a season that started in October is unfair and
produces a false read.

### When the config is not fully filled

Judge the answer slots, not the file text. Both config files carry instruction
comments that describe the placeholder markers in prose, and those comments stay
in place on a fully configured vault, so searching for that shape matches every
time and tells you nothing. Look at what sits under each numbered heading.

A slot counts as filled when it holds anything the user put there, and
`(skipped)` is something the user put there. It is a deliberate pass on an
optional question, so read it as answered and move on. A skipped season question
never blocks this review.

Then degrade rather than stop:

- Every slot still unfilled, nothing written anywhere: the user has not been set
  up. Say so in one line, offer the setup interview in CLAUDE.md, and stop. Mode
  B is not a way around this. An interview about the year is a different
  conversation from setup, and running it first leaves you with no threads to
  organize the answers under.
- Some filled, some not: run the review on what is there. No season means no
  season lens, so report The Honest Score against the profile's life threads
  instead and say nothing about the missing file. Next Year's Opening Season
  becomes a first season draft rather than a replacement, and it is still only a
  draft.

A partly filled config is a normal state, not an error.

## What to include

The shape is the same either way. Mode A builds it out of the recaps, Mode B builds
it through conversation. Write the sections in the order below, and leave out any
section with nothing real to say.

## Mode A: the synthesis pass

### The Year's Arc

Six to eight bullets. Where the year opened, the turns it took, where it closed.
Name the two or three moments the rest of the year bent around. Not a
quarter-by-quarter replay, and not a highlight reel. If the year had a shape, say
what the shape was.

### How Each Thread Traveled

One bullet per thread in `config/profile.md`, each tracing the thread across all
four quarters. Start-state, the turns, end-state. Distance covered and direction. A
thread that quietly went dormant in the second quarter and never came back is one
of the more useful things a year can tell someone, so name it as plainly as the
threads that grew.

### Wins of the Year

Stack-ranked, most impactful first. Elevated from the quarterly wins, keeping only
what still matters twelve months out. Six to ten maximum. A win that has left no
trace by December does not belong here regardless of how it felt in March.

### Decisions of the Year

Harvested from the quarterlies' Decisions of the Quarter sections. Same four
groupings, dropping any that are empty: held, walked back, still open, and decision
debt. At year altitude, add one thing the quarterlies cannot see, which is the
decision that turned out to matter most and whether the user knew it at the time.
Flag any decision that was walked back twice.

### Gaps

The matched counterpart to Wins, at year altitude. Honest self-assessment across
twelve months: judgment calls that went wrong, things dropped and never picked back
up, avoidance that ran for a season or longer, intentions stated in January that
were dead by March. Elevate from the quarterly Gaps sections and apply the same
test Wins gets, keeping only what still matters at a year's distance.

Honest, not harsh. Do not resolve a gap into a lesson, and do not pair each one
with a fix. Naming it accurately is the whole job. Skip the section only if there
is genuinely nothing real, which over twelve months is rare, and a Wins list with
no Gaps beside it is a sign you flinched rather than a sign of a clean year.

<!-- Note for the composer: Gaps is a this-year self-assessment, and it is about
the user's own performance rather than circumstance. What the Patterns Now Say,
below, is cross-time recurrence, threshold-gated and neutral. A gap that recurred
in three of four quarters will usually also show up there. Naming it in both, from
each section's angle, is correct. -->

### What the Patterns Now Say

The section only a year can produce. Go through `patterns/` and sort it into what
got confirmed and what should be retired. A pattern that held all year is now a
fact about how this person works, so say it that way. A pattern that stopped
producing signal after the spring was probably a description of a rough stretch
rather than a description of the user, so recommend retiring it and say what
replaced it. Where a belief the user held about themselves at the start of the year
did not survive the evidence, that is the most valuable line in the review. Write
it carefully and without drama. Recommend retirements, do not edit the pattern
files.

### People of the Year

Who mattered across twelve months, who got invested in, who went quiet, who carried
the user through something. Year altitude, so five to eight names at most. One line
each on why they surfaced and what the nudge is. Somebody worth thanking usually
falls out of this section, so say who. Use `[[Name]]` links.

### Non-negotiables

**Only when `config/season.md` question 4 names them.** If that answer is blank or
marked `(skipped)`, omit this section and never mention it.

A year usually spans two or three seasons, and the floor may have been redefined
with each one. Read each set against the stretch it actually covered, using the
quarterly floor reads rather than recounting days yourself. Say which
non-negotiables held across the whole year, which held only while one season was
running, and which were named and then never really met. A floor that survived two
or three season rewrites is something the user has settled, so say so. One that got
quietly dropped at every rewrite was never a floor, and naming that is more useful
than another attempt at holding it.

Report the inputs. What to do about them is the user's call.

### The Evening Question

**Only when `config/season.md` question 5 names one.** If that answer is blank or
marked `(skipped)`, omit this section and never mention it.

The question has probably changed once or twice along with the season. For each
version, say what a year of answers shows: what stayed constant, what shifted and
roughly when, and where the answers thinned out or stopped coming. Two to four
bullets. If one version of the question pulled noticeably better answers than the
others, say which, and say it is worth keeping.

### The Honest Score

A candid read on the year against what the user said they wanted at the start of
it. Not a grade, not a pep talk. What got leaned into, what got let slide, whether
twelve months moved things. If the year was bad, say the year was bad and show the
evidence. Do not resolve it into a lesson. Some years do not have one.

### Next Year's Opening Season

A drafted `config/season.md` for the next three to six months, built from the year's
evidence, written out in full inside the review and following the five questions in
the current season file. Draft it, propose it, and stop. Do not write the file. Say
plainly that the quarterly recap is where a season gets rewritten with the user's
approval, and that this draft is a starting point for that conversation rather than
a decision.

On a year to date run this section covers the months left in the year rather than
the next one, so title it The Rest of the Year and say that is what it is. If the
year to date coverage is thin, skip the draft and say why. A season proposed off
seven weeks of notes is a guess wearing a review's clothes.

If the user asks you to write it now, ask once for an explicit yes, then write it
and commit it on its own, separately from the review:

```
git add config/season.md
git commit -m "season: opening YYYY"
```

### Carry Into Next Year

Three to five items, maximum. What genuinely deserves attention in the first weeks
of the year: time sensitive, deferred across more than one quarter, or unusually
high impact given where the year ended. Not a to-do dump and not a resolution list.
If something has been carried forward from three or four quarterlies without
moving, either say why it is still here or recommend dropping it for good. Carrying
something untouched for a year is itself the answer.

### One Thing to Sit With

A single closing line. A quote from the user's own words, or something true that a
year of evidence made visible and a quarter could not. Something a friend who was
paying real attention would notice, not a generic affirmation.

## Mode B: the guided interview

Same destination, built through conversation because the files cannot carry it.

### Setup

Ask these four, one at a time, and wait for each answer.

1. Which year are we reviewing, and did it run on the calendar or on some other
   shape, a school year, a fiscal year, a move, a recovery? Compute the four
   quarter ranges from the answer and read them back for confirmation before you
   start.
2. What did your life actually run on this year? `config/profile.md` names the
   current threads, so read them back and ask what to add or drop for the year
   being reviewed. A thread that ended in June still belongs in that year's
   review.
3. What can I actually read for this year? Say what you found in `reviews/`,
   `daily/`, `meetings/`, `tracker.md`, and `patterns/`, and how thin or thick it
   is. Lead with anything in `reviews/`, since a finished recap you can read is
   worth more than an hour of questions. Ask what else exists that you cannot see,
   such as a paper journal, photos, or messages, and offer to have them paste
   anything in per quarter.
4. What is this review for? Personal reckoning, a decision they are trying to
   make, or something they want to be able to hand to somebody. Weight the tone to
   the answer.

### Per-quarter passes

For each quarter in order, read what is available scoped to that quarter's dates,
then ask the user two or three questions about what the files clearly missed.
Produce this for the quarter:

- The arc, in one or two sentences. What was this quarter for?
- The two or three things that actually mattered, with what happened, what the user
  did, and how it turned out. Name where you found each one so they can check it.
- How each thread moved that quarter.
- Decisions made, and any that got walked back inside the quarter.
- People who mattered.
- What was hard, what stalled, and what they would do differently.
- A carry-forward summary of four to six bullets covering the theme, the top
  outcomes, the decisions, and one lesson.

Then write that carry-forward summary to disk as `reviews/YYYY-QN-annual-pass.md`
before you move on, with the same three frontmatter fields the other reviews use
and the date set to the last day of the quarter. Say in the first line of the file
that it came out of an annual-review interview, so nobody later mistakes it for a
quarterly recap. It is a working file, not a rung on the ladder.

### Stop after every quarter

Show the quarter, show the carry-forward summary, and wait for the user to say
continue. Do not run two quarters in one pass.

Commit the pass file before you ask, so the work exists outside the conversation.
That commit is the recovery point: if the session dies during the third quarter,
the first two passes are on disk and the next run reads them back instead of
asking the same questions again. Tell the user that once, at the first stop, and
do not repeat it.

### No fabrication, at any point

If you cannot find evidence for something, say so and ask. Do not fill a quiet
quarter with plausible-sounding activity. A year with two empty quarters is a real
finding, and the review should say that rather than invent a fuller year than the
one that happened.

### Then the synthesis

After the fourth quarter, write the same sections as Mode A, built from the four
pass files and the interview answers instead of from quarterlies. Read the pass
files back off disk rather than working from what is still in the conversation, so
a session that was resumed partway through produces the same review as one that
ran straight through. Note in the review that it was built by interview and which
quarters were thin.

## Output

1. Both modes write to `reviews/YYYY-annual.md`, for example
   `reviews/2027-annual.md`.

```yaml
---
type: review
date: YYYY-MM-DD          # last day actually covered
tags: ["#meta"]
---
```

`date` is the last day the review actually covers. For a finished year that is
December 31. For a year still running it is today, computed in the user's zone,
and never December 31 of a year that has not got there yet.

Add the user's own tags from `config/profile.md` alongside `#meta` where they fit
the year. Add `coverage: thin` when half the year or more came from thin sources,
using that exact lowercase value.

2. Title the body `# Year in Review: <Year>` for a finished year, or
   `# Year to Date: <Year>, through <Month> <Day>` for one still running.
3. End with a sources footer, in the same shape the lower rungs use. In Mode A,
   wikilink the quarterly recaps you read plus any substitute monthlies or
   weeklies, and name the stretches nothing covered. In Mode B, wikilink the four
   pass files, say the review was built by interview on a given date, and name what
   files backed it:

```markdown
---

**Sources:** [[2027-Q1-quarterly]], [[2027-Q2-quarterly]], [[2027-Q3-quarterly]],
[[2027-Q4-quarterly]], patterns/, tracker.md
```
4. Commit, staging the file by its own path:

```
git add reviews/YYYY-annual.md
git commit -m "annual-review: YYYY"
```

On a year to date run, say so in the message: `annual-review: 2026 year to date`.
The history should not claim a finished year either.

Never `git add -A`. A season file the user approved is its own commit, as above,
and anything else sitting in the tree is not yours to commit.

Then check for a remote. Push only to a remote the user owns. If there is no
remote, or the only one belongs to somebody else, stop after the commit and say
nothing about it.

5. Confirm with a short summary, the output path, and one line on the drafted
   opening season. Do not read the review back at the user. On a year to date
   run, add one line offering to run it again once the year closes, and say the
   later run replaces this file.

In Mode B, commit each quarter's pass file as you finish it, before you ask whether
to continue:

```
git add reviews/YYYY-QN-annual-pass.md
git commit -m "annual-review: YYYY QN pass"
```

The pass files stay in `reviews/` after the annual is written. They are the audit
trail for a review that has no recaps behind it, and the sources footer names them.

## Tone and format rules

Honest, warm, specific. Someone who read a year of the user's life and is giving
back the real version. Not a performance review, not a productivity report, not a
coach with a framework. A year is long enough that the temptation to make it mean
something is strong. Resist it. Report what happened.

Length lands around twelve to fifteen minutes of reading. The extra depth belongs
in The Year's Arc, Decisions of the Year, and What the Patterns Now Say. Longer is
not better.

Bullets are the default for every section. The only prose sections are the closing
line and any place where a year-long turn genuinely needs two or three sentences to
hold together. The Next Year's Opening Season draft follows the shape of the season
file itself. Use whitespace between sections.

No em dashes and no double hyphens anywhere in the review you generate, and none in
the proposed season file either. Use commas, parentheses, or a new sentence.

Avoid:

- Filler and flattery. No "what a year", no "you crushed it", no "you should be
  proud".
- Filler openers like "here is your year in review". Start on substance.
- Using the user's name more than once.
- Replaying the four quarters in order. This is a synthesis, not a concatenation.
- Redemption arcs. If a hard year did not resolve, leave it unresolved.
- Sections that exist to fill space.
- Turning The Honest Score into encouragement.
- Manufacturing a win, gap, decision, pattern, or insight the sources do not
  clearly support, and in Mode B, treating a guess as an interview answer.
- Writing Wins of the Year and then skipping Gaps.
