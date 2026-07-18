# AI Chief of Staff

A Claude Code project that runs your day, your week, and your year from plain
markdown files you own. You talk to it in normal sentences and it writes things
down: a passing thought becomes a dated entry, a to-do lands in the tracker, the
evening wrap asks you nine questions and records your answers in your words, and
the next morning hands them back to you. Each level up reads the level below it,
so your weeks are built from your days and your year is built from your quarters.
Everything is local markdown. No database, no web app, no lock-in.

## The altitude ladder

Every level reads only one level down. That constraint is the whole design: it
keeps each pass cheap, and it means a bad week cannot quietly rewrite your year.

```
  capture  ─────►  daily/YYYY-MM-DD.md        your day, in your words
                        │
      daily-wrap  ──────┤  closes today: nine questions, answers kept verbatim
                        │
  daily-briefing  ──────┘  opens tomorrow: reads the tracker and the last few days
                        │
                        ▼
    weekly-recap      reads the last seven daily notes
                        │                   ──►  reviews/YYYY-MM-DD-weekly.md
                        ▼
   monthly-recap      reads that month's weeklies
                        │                   ──►  reviews/YYYY-MM-monthly.md
                        ▼
 quarterly-recap      reads the three monthlies
                        │                   ──►  reviews/YYYY-QN-quarterly.md
                        ▼
   annual-review      reads the four quarterlies
                                            ──►  reviews/YYYY-annual.md
```

Wins, decisions, and open threads move up one rung at a time. By the time
something reaches the annual review it has survived four passes, which is a
better filter than memory.

## Quickstart

1. Install [Claude Code](https://claude.com/claude-code).
2. Get your own copy. On
   [github.com/derrekyoung/ai-chief-of-staff](https://github.com/derrekyoung/ai-chief-of-staff),
   press **Use this template** and set the new repository to **Private**. That
   gives you a repo under your own account, which is the remote the skills expect
   to push to.

   If you would rather clone, drop the inherited remote in the same breath.
   Otherwise `origin` points at a public repository you cannot push to, and every
   skill that commits keeps trying to push your life record to it:
   ```
   git clone https://github.com/derrekyoung/ai-chief-of-staff.git
   cd ai-chief-of-staff
   git remote remove origin
   ```
   Add your own private remote later with `git remote add origin <your-repo>`, or
   add none at all and keep everything on this machine.
3. Open the folder in Claude Code:
   ```
   cd ai-chief-of-staff
   claude
   ```
4. Say **"set me up"**. Claude runs a short interview, one question at a time:
   your name, your timezone, the three to six threads your life actually runs on,
   and your tags. Then it walks you through `config/season.md`, which is the lens
   every other skill reads. Ten minutes, once.
5. Capture something. Just type it:
   ```
   Talked to Priya about moving the Saturday hours. She wants a decision by Friday.
   ```
   No command needed. It lands in today's note, with the to-do in `tracker.md`.
6. Tonight, run `/daily-wrap`. Tomorrow morning, run `/daily-briefing`. That loop
   is the whole system. The higher rungs only work once you have days on the ground,
   so give it a week before you run `/weekly-recap`.

## The seven skills

| Skill | What it does |
|---|---|
| `/capture` | Routes a thought, note, meeting, or to-do to the right file. Runs on its own when you type something that reads like a note instead of a question. |
| `/daily-briefing` | A two to three minute read on your morning: what is slipping, today's three priorities, open loops, who is waiting on you. |
| `/daily-wrap` | Nine questions at the end of the day, including what you decided. Your answers go in verbatim, and the tracker gets a check-in. |
| `/weekly-recap` | Reads the week's daily notes. Wins, decisions made, gaps, a four-bucket pass over the tracker, and any pattern that has earned promotion. |
| `/monthly-recap` | Reads the month's weeklies. How each thread moved, decisions that held or got walked back, trend lines, and a check on whether your season is still true. |
| `/quarterly-recap` | Reads the three monthlies. The long arc, plus a proposed rewrite of `config/season.md` you accept, edit, or reject. |
| `/annual-review` | Reads the four quarterlies. The year's arc, decisions of the year, what the patterns now say, and next year's opening season. Falls back to a guided interview if the quarterlies are not there. |

Every skill writes plain markdown you can read without Claude, edit by hand, and
search with anything.

## How it stays honest

Most journaling tools flatter you. This one is built not to.

- Your words go in as you said them. The wrap does not smooth your answers into
  better prose, because next month's review is only useful if it sounds like you.
- No pep talks. When a week was bad, the recap says the week was bad and shows
  you the evidence. There is no encouragement layer.
- Patterns have to earn it, and the bar is deliberately high. A theme reaches
  `patterns/` only when three things hold at once: three or more signals across
  three or more days, coming from at least two distinct subjects, with thirty days
  of notes behind them. One worry raised on three consecutive days is a single
  signal recorded three times, not a theme. Everything under the bar sits in a
  Watching list you can ignore. Expect almost nothing to qualify in your first
  month, which is the design working rather than failing.
- Scores are real. Every recap ends with an honest score, and a 4 stays a 4. If
  three threads went untouched for a month, you read that in plain language.
- Empty sections get skipped, not padded. A quiet week produces a short recap.

## Privacy

Everything lives in this folder as plain files on your machine. Nothing is
uploaded, synced, or sent anywhere by the skills themselves. Your conversation
with Claude goes to Anthropic the same way any Claude Code session does, so read
[the privacy docs](https://privacy.claude.com) if that matters for what you plan
to write here.

If you push this repo anywhere, **make it private**. This is a record of your
life, your work, and the people around you. Committing it to a public remote is
a mistake that is hard to take back. Git history keeps what you delete.

Run `git remote -v` once before you capture anything. It should show a repository
under your own account, or nothing at all. If it still shows the template you
copied from, see step 2.

## Connect your tools

The skills work with nothing connected. Connect a source and they use it; leave it
disconnected and they carry on without it. Nothing breaks either way.

### Email and calendar

Claude Code talks to Gmail, Google Calendar, and Outlook through MCP connectors.
In a session, run `/mcp` to see what is connected and to add a server, or add one
to your project settings and restart. Anthropic's
[connector directory](https://docs.claude.com/en/docs/claude-code/mcp) lists the
current options and setup steps for each.

What you get once a connector is live:

- **Calendar.** `/daily-briefing` gains a Today's Schedule section and stops
  guessing at your day. `/daily-wrap` offers a pass over today's meetings so you
  can capture what happened while it is fresh.
- **Email.** `/daily-briefing` can flag threads waiting on your reply. `/capture`
  can resolve a person's address when you mention them by first name.

The skills read. They do not send mail, accept invites, or change anything in
your calendar. If you want something sent, you write it and send it yourself.

### Meeting note-takers

The pattern is the same for all of them: get the notes out of the tool, drop the
file into `meetings/`, and let capture route it. Name the file
`YYYY-MM-DD - Descriptive name.md`: sentence case, real spaces, no punctuation
beyond the separator, for example
`meetings/2026-03-14 - Saturday hours with Priya.md`. Then tell Claude "process
the meeting note I just dropped in" and it files the attendees, the decisions,
and the action items where they belong.

**Granola.** Notes and transcripts live in the Granola app, one card per meeting.
The worked example is the
[Granola Meeting Export](https://derrekyoung.com/agents/granola-export/) skill,
which pulls the summary and the full transcript straight into your editor and can
write the file for you. Otherwise, open the meeting, copy the notes panel, and
paste it into a new file in `meetings/`.

**Gong.** Open the call in Gong and use the call brief, which carries the summary,
the topics, and the action items. Copy it out of the call page, or pull it with the
Gong API (`/v2/calls/transcript` for the transcript, `/v2/calls/extensive` for the
brief) if you have API access on your workspace. Paste into `meetings/` with the
same filename shape.

**Zoom.** If AI Companion is on, the meeting summary shows up in the Zoom web
portal under Meetings, then Meeting Summary, and it is usually also emailed to the
host. Open the summary and copy it, or download the `.vtt` transcript from the
cloud recording and save that instead. Transcripts are long and raw, so the summary
is the better input unless you need exact quotes.

## More

- The full write-up:
  [Your AI Chief of Staff](https://derrekyoung.com/posts/2026/your-ai-chief-of-staff/)
- Every skill, individually downloadable:
  [the agents gallery](https://derrekyoung.com/agents/)
- Issues and pull requests are welcome on
  [the repo](https://github.com/derrekyoung/ai-chief-of-staff).

---

Built by [Derrek Young](https://derrekyoung.com). MIT licensed, so fork it and
make it yours.
