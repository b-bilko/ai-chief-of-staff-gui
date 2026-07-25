import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VoiceController } from "./turnTaking";
import type { VoiceEvent } from "./types";
import { FakeRecognizer, FakeSynth, FakeTimer } from "../../test/support/fakeVoice";
import { runDailyWrap } from "../agent/flows/wrap";
import { Vault } from "../vault/fs";
import { makeNodeGitFs } from "../vault/gitfs";
import type { AssistantTurn, CreateParams } from "../agent/types";
import { reactiveModel, toolResultsIn, usage } from "../../test/support/fakeModel";

const REPO_ROOT = resolve(__dirname, "../../..");

/**
 * The whole vertical, headless: the voice controller's `askUser` drives the
 * wrap flow's `next_question` tool, the agent loop threads the answers back, and
 * the note lands in the vault. This is the seam the app hangs everything on, so
 * it is worth proving the pieces actually compose rather than only testing them
 * apart.
 *
 * Only three questions — the composition is what is under test, not the
 * nine-question script (that lives in the wrap flow's own test).
 */

const QUESTIONS = ["Biggest win?", "Any decisions?", "How did the day feel?"];
const ANSWERS = ["Shipped the voice layer.", "Kept it on-device.", "Tired but good."];

function threeQuestionModel() {
  return reactiveModel((params: CreateParams, call: number): AssistantTurn => {
    if (call < QUESTIONS.length) {
      return {
        content: [{ type: "tool_use", id: `q${call}`, name: "next_question", input: { question: QUESTIONS[call] } }],
        stopReason: "tool_use",
        usage: usage(),
      };
    }
    if (call === QUESTIONS.length) {
      const answers = toolResultsIn(params);
      const note = `# 2026-07-25, Saturday\n\n## Decisions Made\n\n- ${answers[1]}\n\n## End of Day Reflection\n\n### Biggest Win\n${answers[0]}\n\n### How the Day Felt\n${answers[2]}\n`;
      return {
        content: [{ type: "tool_use", id: "w", name: "write_file", input: { path: "daily/2026-07-25.md", content: note } }],
        stopReason: "tool_use",
        usage: usage(),
      };
    }
    if (call === QUESTIONS.length + 1) {
      return {
        content: [{ type: "tool_use", id: "c", name: "commit", input: { paths: ["daily/2026-07-25.md"], message: "daily-wrap: 2026-07-25" } }],
        stopReason: "tool_use",
        usage: usage(),
      };
    }
    return { content: [{ type: "text", text: "Wrap saved." }], stopReason: "end_turn", usage: usage() };
  });
}

describe("wrap driven through the real voice controller", () => {
  let vault: Vault;
  let cleanup: () => void;
  const NOW = new Date("2026-07-25T20:00:00Z");

  beforeEach(async () => {
    const root = mkdtempSync(join(tmpdir(), "wrapvoice-"));
    cleanup = () => rmSync(root, { recursive: true, force: true });
    const fs = await makeNodeGitFs(root);
    await fs.promises.mkdir("/vault");
    vault = new Vault(fs, "/vault");

    const profile = readFileSync(join(REPO_ROOT, "config/profile.md"), "utf8")
      .replace("{{name}}", "Bart")
      .replace("{{timezone}}", "Europe/Lisbon")
      .replace("- {{thread-1}}", "- Work")
      .replace("- {{thread-2}}", "- Family")
      .replace("- {{thread-3}}", "- Health")
      .replace("- {{thread-4-optional}}\n", "")
      .replace("- {{thread-5-optional}}\n", "")
      .replace("- {{thread-6-optional}}\n", "")
      .replace("{{tags}}", "`#work`");
    let season = readFileSync(join(REPO_ROOT, "config/season.md"), "utf8");
    for (const a of ["Ship it.", "Work.", "The roof.", "(skipped)", "(skipped)"]) {
      season = season.replace("{{answer}}", a);
    }
    await vault.writeText("config/profile.md", profile);
    await vault.writeText("config/season.md", season);
    await vault.writeText("tracker.md", "# Tracker\n\n## Sections\n");
  });
  afterEach(() => cleanup());

  it("speaks each question, transcribes the spoken answer, and writes the note", async () => {
    const synth = new FakeSynth();
    const recognizer = new FakeRecognizer();
    const timer = new FakeTimer();

    // Auto-driver: react to the controller's own state changes to play the part
    // of the phone — finish speaking, speak an answer, confirm the review.
    let answerIndex = 0;
    const spokenQuestions: string[] = [];
    const controller = new VoiceController({
      synth,
      recognizer,
      timer,
      onEvent: (event: VoiceEvent) => {
        if (event.type === "question") spokenQuestions.push(event.text);
        if (event.type !== "state") return;
        if (event.state === "speaking") setImmediate(() => synth.finish());
        else if (event.state === "listening") {
          const answer = ANSWERS[answerIndex++]!;
          setImmediate(() => recognizer.final(answer));
        } else if (event.state === "reviewing") setImmediate(() => controller.confirm());
      },
    });

    const commit = vi.fn(async () => {});
    const result = await runDailyWrap({
      vault,
      client: threeQuestionModel(),
      askUser: (q) => controller.askUser(q),
      commit,
      now: NOW,
    });

    // Every question was spoken, in order.
    expect(spokenQuestions).toEqual(QUESTIONS);

    // The transcribed answers reached the note verbatim.
    const note = await vault.readText("daily/2026-07-25.md");
    for (const answer of ANSWERS) expect(note).toContain(answer);
    expect(note).toContain("## Decisions Made");

    // And it committed exactly the file it wrote.
    expect(commit).toHaveBeenCalledWith(["daily/2026-07-25.md"], "daily-wrap: 2026-07-25");
    expect(result.text).toContain("Wrap saved");
  });
});
