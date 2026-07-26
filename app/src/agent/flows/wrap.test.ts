import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runDailyWrap } from "./wrap";
import { VaultNotConfiguredError } from "./context";
import { Vault } from "../../vault/fs";
import { makeNodeGitFs, type GitFs } from "../../vault/gitfs.node";
import type { AssistantTurn, CreateParams } from "../types";
import { reactiveModel, toolResultsIn, usage } from "../../../test/support/fakeModel";

const REPO_ROOT = resolve(__dirname, "../../../..");

/** The shipped config, answered, so the flow has a name, a zone, and a season. */
function answeredProfile(): string {
  return readFileSync(join(REPO_ROOT, "config/profile.md"), "utf8")
    .replace("{{name}}", "Bart")
    .replace("{{timezone}}", "Europe/Lisbon")
    .replace("- {{thread-1}}", "- Work")
    .replace("- {{thread-2}}", "- Family")
    .replace("- {{thread-3}}", "- Health")
    .replace("- {{thread-4-optional}}\n", "")
    .replace("- {{thread-5-optional}}\n", "")
    .replace("- {{thread-6-optional}}\n", "")
    .replace("{{tags}}", "`#work`, `#health`, `#family`, `#meta`");
}

function answeredSeason(): string {
  let out = readFileSync(join(REPO_ROOT, "config/season.md"), "utf8");
  for (const a of [
    "Finish the house.",
    "Half house, third work, rest family.",
    "The roof project.",
    "(skipped)",
    "(skipped)",
  ]) {
    out = out.replace("{{answer}}", a);
  }
  return out;
}

/** The nine standard questions, in the skill's order. */
const QUESTIONS = [
  "What was your biggest win today?",
  "What frustrated you most, or felt like a block?",
  "Did you pick up anything new?",
  "Any conversations or people worth remembering?",
  "Did you make any decisions today, even small ones?",
  "Anything unfinished or still on your mind?",
  "What's the one thing you want to carry into tomorrow?",
  "What are you grateful for today?",
  "How did the day feel overall?",
];

/** Canned spoken answers, including one deliberately awkward to type. */
const ANSWERS = [
  "Shipped the git adapter.",
  "The whole afternoon was a dumpster fire — Priya's callback never came.\nStill annoyed.",
  "Learned that Intl accepts fake zones.",
  "Talked to Priya about the Saturday hours.",
  "Dropped the Saturday market stall.",
  "The permit call is still open.",
  "Get the roof estimate out.",
  "A quiet evening.",
  "Tired but okay, maybe a 6.",
];

/**
 * A scripted wrap "model": asks the nine questions one at a time, then writes
 * the note from the answers it gathered, then commits, then signs off. It reads
 * the answers back out of the transcript so this exercises the real path the
 * data takes — question out through `next_question`, answer back as a tool
 * result — rather than hard-coding them into the write.
 */
function wrapModel() {
  return reactiveModel((params: CreateParams, call: number): AssistantTurn => {
    const answers = toolResultsIn(params).filter((r) => !r.startsWith("Wrote ") && !r.startsWith("Committed "));

    if (call < QUESTIONS.length) {
      return {
        content: [{ type: "tool_use", id: `q${call}`, name: "next_question", input: { question: QUESTIONS[call] } }],
        stopReason: "tool_use",
        usage: usage(),
      };
    }

    if (call === QUESTIONS.length) {
      // Assemble the note from the gathered answers, verbatim.
      const note = [
        "---",
        "type: daily",
        "date: 2026-07-25",
        'tags: ["#work"]',
        "---",
        "",
        "# 2026-07-25, Saturday",
        "",
        "## Decisions Made",
        "",
        `- ${answers[4]}`,
        "",
        "## End of Day Reflection",
        "",
        "### Biggest Win",
        answers[0],
        "",
        "### Biggest Frustration",
        answers[1],
        "",
        "### What I Learned",
        answers[2],
        "",
        "### People Worth Remembering",
        answers[3],
        "",
        "### Still On My Mind",
        answers[5],
        "",
        "### Carry Into Tomorrow",
        answers[6],
        "",
        "### Grateful For",
        answers[7],
        "",
        "### How the Day Felt",
        answers[8],
        "",
      ].join("\n");
      return {
        content: [
          { type: "tool_use", id: "w", name: "write_file", input: { path: "daily/2026-07-25.md", content: note } },
        ],
        stopReason: "tool_use",
        usage: usage(),
      };
    }

    if (call === QUESTIONS.length + 1) {
      return {
        content: [
          { type: "tool_use", id: "c", name: "commit", input: { paths: ["daily/2026-07-25.md"], message: "daily-wrap: 2026-07-25" } },
        ],
        stopReason: "tool_use",
        usage: usage(),
      };
    }

    return { content: [{ type: "text", text: "Wrap saved -> daily/2026-07-25.md" }], stopReason: "end_turn", usage: usage() };
  });
}

describe("runDailyWrap end-to-end (headless)", () => {
  let fs: GitFs;
  let vault: Vault;
  let cleanup: () => void;
  const NOW = new Date("2026-07-25T20:00:00Z"); // evening of the 25th in Lisbon

  beforeEach(async () => {
    const root = mkdtempSync(join(tmpdir(), "wrap-"));
    cleanup = () => rmSync(root, { recursive: true, force: true });
    fs = await makeNodeGitFs(root);
    await fs.promises.mkdir("/vault");
    vault = new Vault(fs, "/vault");
    await vault.writeText("config/profile.md", answeredProfile());
    await vault.writeText("config/season.md", answeredSeason());
    await vault.writeText("tracker.md", "# Tracker\n\n## Sections\n");
  });
  afterEach(() => cleanup());

  it("asks nine questions one at a time and writes the answers verbatim", async () => {
    const askUser = vi.fn(async (q: string) => ANSWERS[QUESTIONS.indexOf(q)]!);
    const commit = vi.fn(async () => {});

    const result = await runDailyWrap({ vault, client: wrapModel(), askUser, commit, now: NOW });

    // One question at a time, in order.
    expect(askUser).toHaveBeenCalledTimes(9);
    expect(askUser.mock.calls.map((c) => c[0])).toEqual(QUESTIONS);

    // The note landed in the right day's file.
    expect(await vault.exists("daily/2026-07-25.md")).toBe(true);
    const note = await vault.readText("daily/2026-07-25.md");

    // Every answer is present, byte-for-byte — including the awkward one with an
    // em dash, an apostrophe, and a line break.
    for (const answer of ANSWERS) expect(note).toContain(answer);

    // The heading the weekly recap harvests by name is spelled exactly.
    expect(note).toContain("## Decisions Made");
    expect(note).toContain("## End of Day Reflection");

    expect(result.text).toContain("Wrap saved");
  });

  it("commits exactly the file it wrote, with the conventional message", async () => {
    const askUser = vi.fn(async (q: string) => ANSWERS[QUESTIONS.indexOf(q)]!);
    const commit = vi.fn(async () => {});

    await runDailyWrap({ vault, client: wrapModel(), askUser, commit, now: NOW });

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(["daily/2026-07-25.md"], "daily-wrap: 2026-07-25");
  });

  it("puts today's resolved date into the system prompt, not a guess", async () => {
    const askUser = vi.fn(async (q: string) => ANSWERS[QUESTIONS.indexOf(q)]!);
    const client = wrapModel();

    await runDailyWrap({ vault, client, askUser, commit: vi.fn(async () => {}), now: NOW });

    expect(client.calls[0]!.system).toContain("Today is Saturday, 2026-07-25");
    expect(client.calls[0]!.system).toContain("timezone Europe/Lisbon");
  });

  it("refuses to run against an unconfigured vault", async () => {
    await vault.writeText("config/profile.md", readFileSync(join(REPO_ROOT, "config/profile.md"), "utf8"));
    await expect(
      runDailyWrap({ vault, client: wrapModel(), askUser: vi.fn(), commit: vi.fn(), now: NOW }),
    ).rejects.toBeInstanceOf(VaultNotConfiguredError);
  });
});
