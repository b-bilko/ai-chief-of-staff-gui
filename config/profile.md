<!--
Claude: this file holds who the user is. Each section below has one answer slot,
written as a field name wrapped in double curly braces. If a slot is still
sitting where an answer should be, the user has not been set up: stop and run
the setup interview in CLAUDE.md before doing anything else. Ask one question at
a time and write each answer into this file as it arrives, replacing the slot.
Name and Timezone are required and cannot be skipped: if the user passes on
either, ask again once, say why in one line, and never write (skipped) into
those two slots. If they skip anything else, write (skipped) and move on. Read
the slots, do not pattern match the whole file: this comment describes the slot
shape and would match itself.
-->

# Profile

## Name

{{name}}

What to call the user in briefings and reviews. Required, so this slot never
holds `(skipped)`.

## Timezone

{{timezone}}

Every date and time written into this folder uses this, not the clock on the
machine Claude happens to be running on. IANA name required, for example
`Europe/Lisbon`, `America/Chicago`, or `Pacific/Auckland`.

Required, so this slot never holds `(skipped)`. If it is ever empty, Claude stops
and asks rather than reading the machine clock or guessing a zone.

## Life threads

Three to six threads this life actually runs on. These become the sections in
every weekly, monthly, and quarterly review, so keep them few and keep them
real. Work, health, a marriage, a class you teach, a house you are rebuilding,
a business you own.

- {{thread-1}}
- {{thread-2}}
- {{thread-3}}
- {{thread-4-optional}}
- {{thread-5-optional}}
- {{thread-6-optional}}

Three of these are required and three are optional. Whichever the user does not
name, delete the whole line. An unused slot left sitting here reads as an
unanswered question and holds the setup gate shut.

## Tags

Used in frontmatter on every note. Start with these, then cut what you do not
use and add what you do. Fewer tags beats more.

{{tags}}

Starter set: `#work`, `#health`, `#family`, `#ideas`, `#growth`, `#meta`
