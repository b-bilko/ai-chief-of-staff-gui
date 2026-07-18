---
name: daily-wrap
description: Close out the day. Ask nine reflection questions one at a time, keep the answers verbatim, run a check-in on the tracker, and write it all into today's daily note. Use when the user says they are wrapping up, done for the day, ready to reflect, want to close out the day, or runs /daily-wrap.
---

# Daily Wrap

Ask the user nine questions about their day, one at a time, and write their
answers into today's daily note in their own words. This is a capture session,
not a coaching session. Ask, listen, write, confirm.

## When this runs

In the evening, on `/daily-wrap` or when the user says they are wrapping up.
Once per day. If today's note already has an End of Day Reflection, say so
and ask whether to add to it or replace it.

Start immediately. Do not explain what you are about to do, do not ask if they
are ready, and do not open with a greeting. Ask question one.

## Before you start

Read `config/profile.md` for the name, timezone, and life threads. Read
`config/season.md` and note two things before the interview begins:

- **Non-negotiables** (question 4 of the season file). If the user named any, you
  will write a status line for each at the end. If the answer is blank or
  `(skipped)`, skip that section entirely and never mention it.
- **The custom evening question** (question 5). If there is one, you ask it last.
  If not, the interview is nine questions.

Get the timezone out of `config/profile.md` and pass it to `date` through Bash,
so the machine clock never decides what day it is. With `Europe/Lisbon` in the
profile:

```
TZ=Europe/Lisbon date +%Y-%m-%d
TZ=Europe/Lisbon date +%A
```

Substitute whatever zone the profile names. Bare `date +%A` is wrong. Never infer
a weekday from a date string.

Check whether a calendar connector is available. If one is, you will offer a pass
over today's meetings after the interview. If not, the wrap runs exactly the same
without it. Do not mention connectors you do not have.

## The interview

Rules:

- One question at a time. Wait for the answer before asking the next.
- Warm and casual. This is a conversation, not a form.
- Take short answers as complete. Push once only when a single word lands on a
  question that clearly wanted more, such as "fine" as the whole answer to how
  the day felt.
- If they skip ("nothing", "skip", "n/a"), move on and leave that section out of
  the note. Do not write "nothing" into the file.
- Do not analyze, reflect back, quote their answer approvingly, or offer an
  opinion mid interview. A brief acknowledgment, then the next question.

Ask in this order:

1. "What was your biggest win today?"
2. "What frustrated you most, or felt like a block?"
3. "Did you pick up anything new? An insight, something that clicked, anything
   that surprised you?"
4. "Any conversations or people worth remembering?"
5. "Did you make any decisions today, even small ones?"
6. "Anything unfinished or still on your mind that you don't want to lose?"
7. "What's the one thing you want to carry into tomorrow?"
8. "What are you grateful for today?"
9. "Last one, how did the day feel overall? Energy, mood, anything."

Then, if `config/season.md` defines a custom evening question, ask it last,
worded the way the user wrote it.

Question 5 does most of the work in this system. Small decisions count: what they
said no to, what they picked between, what they stopped doing. If the answer is a
single decision, that is fine. If they say none, leave the section out.

### The non-negotiables sweep

Only when `config/season.md` names non-negotiables. This is the one question you
are allowed to add, and you ask it after the last question, including the custom
one.

Read back through the answers they just gave. Some non-negotiables will already
be settled, because "got out for a walk at lunch" answers the walk. Take those as
answered and do not ask again. Then ask about whatever is left, all of it in a
single question:

> "Two quick ones before I write this up: did you get outside today, and were you
> in bed by eleven?"

One question, however many items are unresolved. Never one question per item, and
never ask about something they already covered. If everything is covered, ask
nothing at all and say nothing about it. If they wave it off, that is fine too,
write those lines as "not asked" and move on.

This is a checkbox sweep, not an opening. Take the yes or no, do not follow up,
do not comment on the answer.

## After the interview

### 1. Today's meetings, when a calendar connector is present

Read today's events. For any meeting that has ended and that has no note in
`meetings/`, list them and ask once: "You had three meetings today with no notes.
Want to capture anything from them?"

Take whatever they give you and route it through the capture skill, one meeting
note per meeting. If they pass, move on and do not ask again.

With no calendar connector, skip this step silently.

### 2. Tracker check-in

Read `tracker.md`. Surface at most five items total, grouped, one consolidated
question per group. Never go item by item.

Never check a box the user did not tell you to check. A meeting note is evidence
that a meeting happened, not evidence that their work around it is done, and a
wrongly closed item disappears from every future briefing and review. So when a
note in `meetings/` is dated today and the item's own text names preparation or
follow up for that specific meeting, say so and ask anyway, as part of the
group's one question:

> "Prep for the roof estimate, and there is a note from it, so I assume that one
> is done. Close it?"

Take the yes, then close it. If the item merely shares a person or a project with
today's meeting, that is not evidence of anything, so treat it like any other
item and ask plainly.

1. **Overdue** (`due:` before today, unchecked): "These slipped past their due
   date. Done, pushed, or dropped?"
2. **Due in the next three days**: "Coming up: ..." Ask only if they want to move
   anything.
3. **High priority with no due date**: `!high`, unchecked, no `due:`. These are
   the items that fall through, because nothing else in this list catches them
   and the morning briefing keeps asking for them until someone closes them.
   "Still open, still urgent?"
4. **Stale**: two or three items with `captured:` more than fourteen days ago, no
   `due:`, not `!high`. "Still doing these?"

Apply their answer to `tracker.md` directly: check the box with a short outcome
and the date, edit the text if the scope changed, add or move `due:`, change
priority, or delete what they drop.

One more pass before you move on. If a win or a decision they described in the
interview matches an open item, that item is done and they will not think to say
so. Name it and ask: "Sounds like the permit call is done, close it?" This is
where an undated to-do finally gets closed, so do not skip it.

If nothing is overdue, due soon, high priority and undated, or stale, and nothing
in the interview matched an open item, skip this step without comment.

### 3. Write into today's daily note

Find or create `daily/YYYY-MM-DD.md` from `config/templates/daily-note.md`,
filling `{{date}}` and `{{weekday}}`. Fill the `## End of Day Reflection` section:

```markdown
## End of Day Reflection

### Biggest Win
[answer]

### Biggest Frustration
[answer]

### What I Learned
[answer]

### People Worth Remembering
[answer]

### Still On My Mind
[answer]

### Carry Into Tomorrow
[answer]

### Grateful For
[answer]

### How the Day Felt
[answer]
```

Then the decisions from question 5 go in their own section. `## Decisions Made`
is a top level section of the daily note and it sits directly after the
`## End of Day Reflection` section, before `## Non-negotiables` if that one
exists. Create it there if it is not there yet, and append to it if it is,
because a capture earlier in the day may have opened it already. Never open a
second one.

```markdown
## Decisions Made

- Dropped the Saturday market stall. Two months in and it never covered the gas.
- Told [[Dana Whitfield]] the roof work moves to April, rather than starting it in the rain.
```

Keep that heading spelled exactly `## Decisions Made`. The weekly recap harvests
the section by name, and the monthly and quarterly reviews are built on what the
weekly finds. A renamed heading breaks the ladder quietly.

If the season file defines a custom question, its answer goes in a final
subsection of the reflection, titled with a short phrase from the question
itself.

Write every answer **verbatim**. Do not paraphrase, tidy the grammar, or upgrade
their word choice. Leave out any section they skipped. While writing, wikilink
every person and project mentioned, and add tags to the note's frontmatter from
the set in `config/profile.md`.

### 4. Non-negotiables check

Only if `config/season.md` names non-negotiables. If it does not, this section
does not exist and you never bring it up.

Append to today's daily note, below the decisions:

```markdown
## Non-negotiables
- Walked outside: yes, got the dog out before the first appointment
- Asleep by 11: no, "up past one with the baby"
- Dinner at the table: not asked
```

Each line comes from something they said, either in the interview or in the
sweep. Do not guess and do not infer a yes from silence. Use "not asked" when the
sweep did not get to it or they waved it off, and it is better than a wrong yes.
Record, do not advise. Three nights of "no" is the weekly recap's business, not
yours.

### 5. Commit

Stage the files you actually touched, by path. Never `git add -A`, because it
sweeps up whatever else is sitting in the folder:

```
git add daily/2026-03-14.md tracker.md
git commit -m "daily-wrap: 2026-03-14"
```

Then check for a remote. Push only to a remote the user owns. If there is none,
stop after the commit and say nothing about it.

## Output

Three to five lines. Nothing else.

```
Wrap saved -> daily/2026-03-14.md
Decisions: 2 recorded
Tracker: closed the roof measurements and the permit call, pushed the gutter quote to 2026-03-20
```

Do not summarize the day back at them. Do not tell them it sounds like a good
day, a hard day, or any kind of day. Do not offer a suggestion for tomorrow. They
just spent ten minutes telling you what happened, and they were there for it.

If they want to add something after the wrap is saved, treat it as a new capture
rather than reopening the interview.

## Tone and format rules

- Their words stay theirs. "The whole day was a dumpster fire" does not become
  "the day had its setbacks." A year from now the value of this file is that it
  still sounds like them.
- No coaching, no affirmations, no encouragement layer, during or after.
- Skipped questions produce no section. A quiet day produces a short note.
- Frontmatter stays at three fields: `type`, `date`, `tags`, tags as a quoted
  inline array.
- No em dashes and no double hyphens in anything you write. Commas, parentheses,
  or a new sentence.
