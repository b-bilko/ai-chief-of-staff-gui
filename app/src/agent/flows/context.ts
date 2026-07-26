/**
 * Assembling the system prompt a flow runs under.
 *
 * The prompt is three layers: the vault's own operating instructions and the
 * relevant skill (generated verbatim from the desktop's `.claude` so the two
 * clients cannot drift), then a short app-adaptation preamble, then the runtime
 * facts the desktop would gather with a shell and file reads.
 *
 * That last layer is load-bearing. The skills tell a Claude Code session to run
 * `TZ=<zone> date` and read `config/`. There is no shell here, and — the rule
 * this whole codebase is built around — the date must come from the profile
 * timezone, never a device clock. So the app resolves the date and the profile
 * up front and hands them to the model as fact, and the preamble tells it to
 * use them rather than reach for tools it does not have.
 */

import { today, todayWeekday, type VaultDate } from "../../vault/dates";
import { Vault } from "../../vault/fs";
import {
  parseProfile,
  parseSeason,
  requiredAnswersPresent,
  type Profile,
  type Season,
} from "../../vault/config";
import { OPERATING_INSTRUCTIONS, SKILLS, type SkillName } from "../../prompts/skills.gen";

export class VaultNotConfiguredError extends Error {
  constructor(readonly missing: string[]) {
    super(
      `The vault is not set up (${missing.join(", ")}). Run setup before this flow. ` +
        "Name and timezone are required; the date and filenames depend on the zone.",
    );
    this.name = "VaultNotConfiguredError";
  }
}

export interface FlowContext {
  system: string;
  profile: Profile;
  season: Season;
  timezone: string;
  today: VaultDate;
  weekday: string;
}

/**
 * Read and resolve everything a flow needs, and build its system prompt.
 *
 * Throws `VaultNotConfiguredError` when name or timezone is missing, because a
 * flow cannot honestly write a dated note without them.
 */
export async function buildContext(
  vault: Vault,
  skill: SkillName,
  now: Date = new Date(), // dates-guard-ok: the single injection point for the clock
): Promise<FlowContext> {
  const profile = parseProfile(await readOrEmpty(vault, "config/profile.md"));
  const season = parseSeason(await readOrEmpty(vault, "config/season.md"));

  if (!requiredAnswersPresent(profile)) {
    const missing: string[] = [];
    if (!profile.name) missing.push("name");
    if (!profile.timezone) missing.push("timezone");
    throw new VaultNotConfiguredError(missing);
  }

  const timezone = profile.timezone!;
  const date = today(timezone, now);
  const weekday = todayWeekday(timezone, now);

  const system = [
    OPERATING_INSTRUCTIONS,
    DIVIDER,
    SKILLS[skill],
    DIVIDER,
    appPreamble(),
    runtimeContext({ profile, season, timezone, date, weekday }),
  ].join("\n\n");

  return { system, profile, season, timezone, today: date, weekday };
}

/**
 * The system prompt for the first-run setup interview.
 *
 * Setup is the one flow that cannot use `buildContext`: it is what fills in the
 * name and timezone, so it must run before either exists. There is no dedicated
 * setup skill either — the interview lives in the operating instructions' "First
 * run" section — so the prompt is those instructions plus a preamble that adapts
 * the interview to voice and to the phone's tools.
 */
export function buildSetupContext(): string {
  return [OPERATING_INSTRUCTIONS, DIVIDER, setupPreamble()].join("\n\n");
}

function setupPreamble(): string {
  return [
    "## You are running first-run setup, by voice, in the mobile app",
    "",
    "The vault is not set up yet — that is why you are here. Run the first-run interview",
    "described above, adapted to this app:",
    "",
    "- **No shell, no greeting.** Ask the first question straight away.",
    "- **Ask one question at a time with the `next_question` tool.** Its text is spoken",
    "  aloud, so word each question the way you want it heard, and it returns the spoken",
    "  answer. Wait for each answer before asking the next.",
    "- **Name and timezone are required and cannot be skipped.** For the timezone, the",
    "  user may say a city or region rather than an IANA name. Convert it to the IANA",
    "  name and write that: 'Lisbon' becomes 'Europe/Lisbon', 'Pacific time' becomes",
    "  'America/Los_Angeles'. Never write a bare UTC offset like '+01:00' — it has no",
    "  daylight-saving rules and every date written through it would eventually be wrong.",
    "  If you cannot resolve what they said to a real zone, ask again.",
    "- **Write answers into the files as they arrive.** Read `config/profile.md` and",
    "  `config/season.md` with `read_file` to see each answer slot (a name in double",
    "  curly braces), then replace the slot with the answer using `edit_file`. Fill the",
    "  profile first, then the season.",
    "- For the optional life-thread slots the user does not name, delete the whole line",
    "  rather than leaving an empty slot behind.",
    "- `(skipped)` is a complete answer to any optional question. Write it exactly, in",
    "  lowercase, in round brackets. Never write it for the name or the timezone.",
    "- **When both files are filled, commit them** with the `commit` tool, listing",
    "  `config/profile.md` and `config/season.md`. Then confirm in two or three lines",
    "  what you now know, and stop.",
  ].join("\n");
}

const DIVIDER = "\n---\n";

async function readOrEmpty(vault: Vault, path: string): Promise<string> {
  try {
    return await vault.readText(path);
  } catch {
    return "";
  }
}

function appPreamble(): string {
  return [
    "## You are running inside the mobile app, not a terminal",
    "",
    "Everything above describes how you behave as this person's chief of staff. It was",
    "written for a desktop Claude Code session. A few things differ here, and where they",
    "conflict, this section wins:",
    "",
    "- **You have no shell.** Do not try to run `date`, `git`, or any command. The tools",
    "  listed for this conversation are all you have.",
    "- **The date is already resolved for you**, in the user's timezone, in the runtime",
    "  context below. Use it. Never compute or guess a date, and never read a device clock.",
    "- **The user is talking, not typing.** Their answers reach you as transcribed speech,",
    "  so expect the odd misheard word. Their words are still theirs: write them down as",
    "  given, do not tidy grammar or upgrade phrasing.",
    "- **Ask one question at a time with the `next_question` tool.** Its text is spoken",
    "  aloud exactly as written, and it returns the user's answer. Do not batch questions",
    "  into one turn.",
    "- **Save your work with the `commit` tool** when a skill says to commit, listing the",
    "  exact files you wrote. There is no automatic save.",
  ].join("\n");
}

function runtimeContext(ctx: {
  profile: Profile;
  season: Season;
  timezone: string;
  date: VaultDate;
  weekday: string;
}): string {
  const { profile, season } = ctx;
  const lines = [
    "## Runtime context (resolved by the app — treat as fact)",
    "",
    `- Today is ${ctx.weekday}, ${ctx.date} (timezone ${ctx.timezone}).`,
    `- Today's daily note is daily/${ctx.date}.md.`,
    `- Call the user: ${profile.name}.`,
  ];
  if (profile.threads.length) lines.push(`- Life threads: ${profile.threads.join(", ")}.`);
  if (profile.tags.length) lines.push(`- Tags in use: ${profile.tags.join(", ")}.`);
  if (season.about) lines.push(`- This season: ${season.about}`);
  if (season.nonNegotiables) lines.push(`- Non-negotiables: ${season.nonNegotiables}`);
  if (season.customQuestion) {
    lines.push(`- Custom evening question for this season: ${season.customQuestion}`);
  }
  return lines.join("\n");
}
