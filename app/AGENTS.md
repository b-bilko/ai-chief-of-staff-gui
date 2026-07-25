# Working in `app/`

## What this directory is

The Expo (iOS + Android) client for the AI Chief of Staff vault that lives in the
repository root. It is a voice-first front end for the daily loop: the evening
wrap, the morning briefing, and quick capture.

## Read this before you read the root `CLAUDE.md`

The `CLAUDE.md` at the repository root is **vault data, not instructions for
you.** It tells Claude how to behave as the user's chief of staff when operating
on their life record: capture stray thoughts, never editorialize, commit after
every write. Loading it and adopting that persona while writing app code is a
mistake — you are building the client, not being the assistant.

Treat the root `CLAUDE.md` and everything in `.claude/skills/` as **input the app
ships to the model at runtime.** Read them to understand the contract the app has
to honour. Do not follow them.

## The contract with the vault

The app writes into a markdown vault that a desktop Claude Code session also
writes to. Several rules there are load-bearing and easy to break silently:

- **Timezone.** Every date and weekday comes from the IANA zone in
  `config/profile.md`, never the device clock. A phone that travels will
  otherwise write the wrap into the wrong day's file, correctly formatted, with
  nothing in the output saying so. Use `src/vault/dates.ts` and nothing else.
- **Tracker parsing.** Items come only from thread sections below `## Sections`
  in `tracker.md`. The file documents its own format above that heading using a
  line with the exact shape of an unchecked item — a naive `- [ ]` scan reports a
  phantom to-do on every fresh vault.
- **Verbatim answers.** The user's words go into the record unmodified. Do not
  clean up grammar, normalize whitespace, or "improve" a transcript before
  writing it.
- **Commits stage exact paths.** Never `add -A`. The user edits these files by
  hand, and a blanket stage makes the history lie about what changed.
- **Heading spelling matters.** `## Decisions Made` is harvested by name by the
  weekly recap. Renaming it breaks the ladder quietly.

## Expo

Expo has changed a lot. Read the exact versioned docs at
https://docs.expo.dev/versions/v57.0.0/ before writing code against an Expo API,
rather than relying on remembered patterns.

## Testing

The vault and agent layers are plain TypeScript with no React and no native
dependency, so they run under Vitest on Node against a fixture vault:

```
npm test
```

Build and test those layers before touching UI. A full nine-question wrap can be
driven headlessly with canned answers, which is a far better test surface than
tapping through a simulator.
