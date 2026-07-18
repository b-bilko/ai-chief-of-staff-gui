---
name: annual-review
description: Write the year in review from that year's four quarterly recaps, or run a guided quarter-by-quarter interview when the quarterlies are not there. Use when the user asks for an annual review, a year in review, to close out the year, or what the year added up to. Covers the year's arc, how each thread traveled, decisions of the year, what the patterns now say, and a drafted opening season for next year. Writes reviews/YYYY-annual.md.
---

# Annual Review

You are writing the year in review. It runs one of two ways depending on what is
in `reviews/`, and the first thing you tell the user is which one and why.

A year is the only altitude where you can see which beliefs about yourself turned
out to be true. That is the work here, not a longer list of accomplishments.

## When this runs

At the end of a calendar year, or in the first weeks of the next one. The user can
also ask for a past year at any time.

Confirm the year before reading anything. Compute the boundaries and the run
weekday with `date` through Bash, never from an ISO string. Use the timezone in
`config/profile.md` for every date you write.

There is a work-only version of this, shaped for a performance review or a
promotion packet, at
<https://derrekyoung.com/agents/year-in-review-chief-of-staff/>. If the user says
they need this for their manager or a promo case rather than for themselves, point
them there instead. This skill reviews a life, not a job.

## Which mode you are in

Count the `reviews/YYYY-QN-quarterly.md` files for the year.

Four quarterlies means **Mode A**, a single synthesis pass over them.

One to three quarterlies also means **Mode A**. For each missing quarter, fall
back one rung to that quarter's `reviews/YYYY-MM-monthly.md` files and name the
gap in the review, one line saying which quarter lacked a quarterly and what you
read instead. Do not drop below the monthlies to fill it.

Zero quarterlies and no monthlies to fall back on means **Mode B**, the guided
interview. There is no spine to synthesize, so you build one with the user.

Say which mode you are running and why in one line before you start, for example:
"Running the interview version. There are no quarterly recaps for 2027 and only
two monthlies, so we build the year together rather than me summarizing files that
do not exist." Never run Mode A over thin sources and let it read as though the
record was complete.

## Sources (read in this order)

**Mode A:**

1. The year's `reviews/YYYY-QN-quarterly.md` files. These are the spine.
2. For any missing quarter, that quarter's `reviews/YYYY-MM-monthly.md` files.
3. `patterns/`, in full. The year is where patterns get judged rather than
   collected.
4. `tracker.md`, mostly the Completed archive, for what actually finished.
5. `config/season.md` and `config/profile.md` for the lens and the thread list.
   The season file has probably been rewritten once or twice during the year. The
   quarterlies record those rewrites, and the sequence of them is itself a
   finding.

**Never re-crawl `daily/` in Mode A.** Four levels of reduction already happened
below you. Do not re-run any sweep. Never invent content for a missing source.

**Mode B** is the one exception to the ladder rule, because there is no rung below
to stand on. Read whatever exists: `daily/`, `meetings/`, `tracker.md` including
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

## What to include

### Mode A: the synthesis pass

Write these sections in order. If a section has nothing real to say, leave it out.

**The Year's Arc.** Six to eight bullets. Where the year opened, the turns it took,
where it closed. Name the two or three moments the rest of the year bent around.
Not a quarter-by-quarter replay, and not a highlight reel. If the year had a
shape, say what the shape was.

**How Each Thread Traveled.** One bullet per thread in `config/profile.md`, each
tracing the thread across all four quarters. Start-state, the turns, end-state.
Distance covered and direction. A thread that quietly went dormant in the second
quarter and never came back is one of the more useful things a year can tell
someone, so name it as plainly as the threads that grew.

**Wins of the Year.** Stack-ranked, most impactful first. Elevated from the
quarterly wins, keeping only what still matters twelve months out. Six to ten
maximum. A win that has left no trace by December does not belong here regardless
of how it felt in March.

**Decisions of the Year.** Harvested from the quarterlies' Decisions of the Quarter
sections. Same four groupings, dropping any that are empty: held, walked back,
still open, and decision debt. At year altitude, add one thing the quarterlies
cannot see, which is the decision that turned out to matter most and whether the
user knew it at the time. Flag any decision that was walked back twice.

**What the Patterns Now Say.** The section only a year can produce. Go through
`patterns/` and sort it into what got confirmed and what should be retired. A
pattern that held all year is now a fact about how this person works, so say it
that way. A pattern that stopped producing signal after the spring was probably a
description of a rough stretch rather than a description of the user, so recommend
retiring it and say what replaced it. Where a belief the user held about
themselves at the start of the year did not survive the evidence, that is the most
valuable line in the review. Write it carefully and without drama. Recommend
retirements, do not edit the pattern files.

**People of the Year.** Who mattered across twelve months, who got invested in,
who went quiet, who carried the user through something. Year altitude, so five to
eight names at most. One line each on why they surfaced and what the nudge is.
Somebody worth thanking usually falls out of this section, so say who. Use
`[[Name]]` links.

**The Honest Score.** A candid read on the year against what the user said they
wanted at the start of it. Not a grade, not a pep talk. What got leaned into, what
got let slide, whether twelve months moved things. If the year was bad, say the
year was bad and show the evidence. Do not resolve it into a lesson. Some years do
not have one.

**Next Year's Opening Season.** A drafted `config/season.md` for the next three to
six months, built from the year's evidence, written out in full inside the review
and following the five questions in the current season file. Draft it, propose it,
and stop. Do not write the file. Say plainly that the quarterly recap is where a
season gets rewritten with the user's approval, and that this draft is a starting
point for that conversation rather than a decision. If the user asks you to write
it now, ask once for an explicit yes, then write and commit it separately with the
message `season: opening YYYY`.

**One Thing to Sit With.** A single closing line. A quote from the user's own
words, or something true that a year of evidence made visible and a quarter could
not. Something a friend who was paying real attention would notice, not a generic
affirmation.

### Mode B: the guided interview

Same destination, built through conversation because the files cannot carry it.

**Setup.** Ask these four, one at a time, and wait for each answer.

1. Which year are we reviewing, and did it run on the calendar or on some other
   shape, a school year, a fiscal year, a move, a recovery? Compute the four
   quarter ranges from the answer and read them back for confirmation before you
   start.
2. What did your life actually run on this year? `config/profile.md` names the
   current threads, so read them back and ask what to add or drop for the year
   being reviewed. A thread that ended in June still belongs in that year's
   review.
3. What can I actually read for this year? Say what you found in `daily/`,
   `meetings/`, `tracker.md`, and `patterns/`, and how thin or thick it is. Ask
   what else exists that you cannot see, such as a paper journal, photos, or
   messages, and offer to have them paste anything in per quarter.
4. What is this review for? Personal reckoning, a decision they are trying to
   make, or something they want to be able to hand to somebody. Weight the tone to
   the answer.

**Per-quarter passes.** For each quarter in order, read what is available scoped to
that quarter's dates, then ask the user two or three questions about what the
files clearly missed. Produce this for the quarter:

- The arc, in one or two sentences. What was this quarter for?
- The two or three things that actually mattered, with what happened, what the user
  did, and how it turned out. Name where you found each one so they can check it.
- How each thread moved that quarter.
- Decisions made, and any that got walked back inside the quarter.
- People who mattered.
- What was hard, what stalled, and what they would do differently.
- A carry-forward summary of four to six bullets covering the theme, the top
  outcomes, the decisions, and one lesson.

**Stop after every quarter.** Show the quarter, show the carry-forward summary,
and wait for the user to say continue. Do not run two quarters in one pass. Tell
them to keep the carry-forward summaries, because if the session runs out of
context they can paste all four back and the final synthesis still works.

**No fabrication, at any point.** If you cannot find evidence for something, say
so and ask. Do not fill a quiet quarter with plausible-sounding activity. A year
with two empty quarters is a real finding, and the review should say that rather
than invent a fuller year than the one that happened.

**Then the synthesis.** After the fourth quarter, write the same sections as Mode
A, built from the four carry-forward summaries and the interview answers instead
of from quarterlies. Note in the review that it was built by interview and which
quarters were thin.

## Output

1. Both modes write to `reviews/YYYY-annual.md`, for example
   `reviews/2027-annual.md`.

```yaml
---
type: review
date: YYYY-MM-DD          # last day of the reviewed year
tags: ["#meta"]
---
```

Add the user's own tags from `config/profile.md` alongside `#meta` where they fit
the year.

2. Title the body `# Year in Review: <Year>`.
3. End with a sources footer, in the same shape the lower rungs use. In Mode A,
   wikilink the quarterly recaps you read plus any substitute monthlies. In Mode
   B, say the review was built by interview on a given date and name what files
   backed it:

```markdown
---

**Sources:** [[2027-Q1-quarterly]], [[2027-Q2-quarterly]], [[2027-Q3-quarterly]],
[[2027-Q4-quarterly]], patterns/, tracker.md
```
4. Commit:

```
git add -A && git commit -m "annual-review: YYYY"
```

Then check for a remote and push if one exists. If there is no remote, stop after
the commit and say nothing about it.

5. Confirm with a short summary, the output path, and one line on the drafted
   opening season. Do not read the review back at the user.

In Mode B, commit after each quarter's pass as well, with the message
`annual-review: YYYY QN pass`, so a lost session does not cost the work.

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
- Manufacturing a win, decision, pattern, or insight the sources do not clearly
  support, and in Mode B, treating a guess as an interview answer.
