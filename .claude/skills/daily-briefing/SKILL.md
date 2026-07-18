---
name: daily-briefing
description: Give the user a two to three minute morning brief built from their tracker, yesterday's note, and the last week. Covers what slipped, today's three priorities, open loops, who is waiting on them, and what is coming this week. Use when the user says "brief me", "good morning", "what does my day look like", "what should I focus on today", or runs the briefing directly. Chat output only, it writes no files.
---

# Daily Briefing

Opens the day. Reads the tracker, yesterday's note, and the last week, then hands
back a short, honest read on what is slipping, what matters today, and who is
waiting on you.

This skill writes nothing. No file, no commit, no message sent anywhere.

## When this runs

In the morning, on request. The user asks to be briefed, says good morning, asks
what the day looks like, or runs the skill by name.

Nothing needs to exist for it to work. If yesterday has no note, say that in one
line and keep going. If the tracker is empty, the brief gets shorter, not padded.

## Sources (read in this order)

1. `tracker.md`. The to-do list. It drives Top of Mind Today, Today's Priorities,
   Open Loops, and Coming Up This Week. Read it before anything else.
2. Yesterday's daily note, `daily/YYYY-MM-DD.md`. Look for the End of Day
   Reflection and the Decisions Made section the wrap writes.
3. The last seven daily notes. Texture, unresolved threads, anything repeating.
4. Recent files in `meetings/`, roughly the last two weeks. What was agreed, and
   what has not moved since.
5. `patterns/`. Existing themes, so a Pattern Alert continues a known thread
   instead of announcing it as new.
6. `people/`, for anyone you are about to name.
7. Calendar, only if a connector is live. See Today's Schedule below.

If a source is missing or empty, skip it. Do not invent content to fill a
section, and do not narrate the absence more than once.

## Dates

Get today from Bash: `date +%Y-%m-%d` for the date and `date +%A` for the
weekday. Never read a weekday off an ISO string. For past days, compute the same
way (`date -v-1d +%A` on macOS, `date -d yesterday +%A` on GNU) or copy the
weekday out of the daily note's own heading.

Use the timezone in `config/profile.md` for every time you state. If a day you
want to reference cannot be pinned down, say "a few days ago" rather than
guessing a weekday.

## Reading the tracker

Parse every item for three markers:

- priority: `!high`, `!med`, `!low`
- due date: `due:YYYY-MM-DD`
- capture date: `<!-- captured: YYYY-MM-DD -->`

Then bucket each open `- [ ]` item:

- **Overdue.** `due:` is before today.
- **Due today.** `due:` is today.
- **Due this week.** `due:` falls after today and within seven days.
- **High priority, no date.** `!high` with no `due:`.
- **Everything else.** Including undated, unprioritized items.

Skip `- [x]` items and the Completed (Archive) section, unless something closed
yesterday is worth a line in Yesterday in 30 Seconds.

The `captured:` date matters here too. An undated item that has been sitting for
six weeks is a candidate for What's Slipping even though nothing is technically
overdue.

## Current season

Read `config/profile.md` and `config/season.md` before you write a word. The
profile gives you the user's name, timezone, and life threads. The season gives
you the lens.

Use the season to decide what to emphasize, what to downplay, and what counts as
relevant this morning. When two things compete for a priority slot, the one the
season points at wins. If `config/season.md` names things to track without being
asked, check for them in the last week's notes even when the user has not
mentioned them.

If either file still has `{{placeholder}}` markers, stop and run the setup
interview in CLAUDE.md first.

## What to include

Generate these in order. If a section has nothing real to say, leave it out. A
short brief is a good brief.

### Yesterday in 30 Seconds

Three to five bullets on what the user did, decided, or felt yesterday. Write it
like a friend catching you up, not a log replay. No timestamps. If the wrap ran,
lean on the reflection and the decisions. If yesterday's note is missing, one
line saying so, then move on.

### Top of Mind Today

From the tracker, in this order:

1. Overdue items, prefixed with OVERDUE.
2. Items due today.
3. High priority items with no due date that are not already listed above.

Cap it at five. If there are more, name the count and surface the ones that
carry the most weight. If all three buckets are empty, skip the section.

### What's Slipping

One to three things quietly falling off. There is no gap report to read, so scan
for it yourself across the last seven daily notes and the tracker:

- Action items written into a daily note that never made it to the tracker.
- Tracker items whose `captured:` date is more than three weeks old with no
  movement in the notes.
- A thread from a meeting note with an owner and no follow up.
- Someone the user said they would contact, in the notes, with no sign they did.
- Anything the season says to track that has not appeared in a week.

Curate hard. Three items land, ten items get ignored. Say what is slipping and
since when, not what to do about it.

### Today's Schedule

**Only when a calendar connector is available.** Check for one before you write
this section. If there is no calendar tool in the session, omit the section
silently. Do not say the calendar is not connected, do not suggest connecting
one, and never guess at the day's events from the notes.

When a calendar is live, pull today's events in the user's timezone and lay them
out simply: time, what it is, who is in it. Flag anything that needs preparation
the user has not done, for example a meeting with someone whose `people/` note
shows an open thread from last time. If the calendar returns nothing for today,
omit the section. Silence reads better than "no meetings today."

### Today's Priorities

Three items maximum. Pull from, in order:

1. Anything already in Top of Mind Today.
2. Tracker items due in the next two days that did not make that cut.
3. What the user said about today in their most recent notes.
4. What today's schedule implies, if you have a calendar.

If more than three feel urgent, the season breaks the tie. Write each as a thing
to do, not a category. "Send Priya the migration decision" beats "project work."

### Open Loops

Always a bullet list. Tracker items due in the next seven days that are not
already above, plus unresolved threads from recent daily notes that never made it
to the tracker. Order by urgency. Write each as a natural phrase rather than a
task label.

Shape it like this:

- Get back to Priya about the migration date
- Renew the studio membership before it lapses on Friday
- Decide whether the Tuesday class is still worth the commute

If there are more than six, group the tail under one "also on the list" line.

### Coming Up This Week

Two to four items, blended from tracker items due seven to fourteen days out,
anything on the calendar later in the week that needs preparation now, and
deadlines the user flagged in recent notes.

Only include what is genuinely significant or needs a head start today. Skip
routine recurring events unless the user called one out.

### Pattern Alert

Only when there is something real. A pattern needs at least three data points
across recent days. Worth naming:

- A feeling the user keeps reporting and never addresses.
- Someone they keep saying they will contact and have not.
- A habit they said mattered that has been missing for a week.
- Energy or mood trending in one direction.

Check `patterns/` first. If the theme already has a file, say it is continuing
rather than presenting it as a discovery. If there is no real pattern, skip the
section. Never manufacture one to have something to say.

### People on Your Radar

One to three people, only if someone came up recently in a way that suggests a
follow up, a thank you, or a repair. One sentence each on why they surfaced. Use
`[[Name]]` so the brief connects back to `people/`.

If an email connector is live, this is where a thread waiting on the user's reply
belongs. One line, who and what. Without a connector, work from the notes.

### One Thing to Remember

A single closing line. A quote from the user's own words, something they wrote
that is worth hearing back, or a plain observation that fits this morning. It
should sound like a friend who noticed something, not an affirmation generator.

## Output

Chat only. Print the brief and stop.

Do not write to `daily/`, do not write to `reviews/`, do not commit, and do not
send the brief anywhere. If the user wants a copy they will ask, and even then
the answer is to save it themselves.

## Tone and format rules

Conversational, direct, warm enough to be readable. A smart friend who has read
all your notes and has two minutes to give you the download. Not a dashboard, not
a coach, not a productivity app.

Length target is two to three minutes read aloud. Err shorter.

For text to speech compatibility:

- Write out abbreviations, "Monday" not "Mon"
- Use digits for numbers, "3" not "three"
- Prefer bullets, short sentences, and natural connective phrases
- No special characters or symbols
- No em dashes and no double hyphens anywhere, use commas, parentheses, or a new
  sentence
- No spoken headers, transitions between sections should sound natural rather
  than announced
- Avoid parenthetical asides that read badly out loud

For readability on screen:

- Three to four sentences per paragraph, maximum
- Whitespace between sections
- Bold the section name where formatting exists, but write so each section still
  works when the formatting is stripped

What to avoid:

- Filler openers. No "Great news", no "Here is your daily brief", no "Let's get
  into it"
- Praise and encouragement. No "you're doing great"
- Using the user's name more than once
- Listing everything in the notes, curate aggressively
- Any section that exists only to exist. Nothing real to say means skip it
