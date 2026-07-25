import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runSetup } from "./setup";
import { buildSetupContext } from "./context";
import { Vault } from "../../vault/fs";
import { makeNodeGitFs, type GitFs } from "../../vault/gitfs.node";
import { parseProfile, requiredAnswersPresent } from "../../vault/config";
import type { AssistantTurn, CreateParams } from "../types";
import { reactiveModel, usage } from "../../../test/support/fakeModel";

const REPO_ROOT = resolve(__dirname, "../../../..");

/**
 * A scripted setup "model": ask the two required questions, fill their slots in
 * the real template with edit_file, then commit. Deliberately minimal — the
 * point is that the flow composes (setup context builds with no config, the
 * questions reach askUser, edit_file fills slots, commit fires), not that it
 * reproduces the full interview, which is the skill's job on a device.
 */
function setupModel() {
  const NAME_Q = "What should I call you?";
  const TZ_Q = "What timezone are you in?";
  return reactiveModel((params: CreateParams, call: number): AssistantTurn => {
    switch (call) {
      case 0:
        return tool("read_file", { path: "config/profile.md" }, "r");
      case 1:
        return tool("next_question", { question: NAME_Q }, "q1");
      case 2:
        return tool("edit_file", { path: "config/profile.md", old_text: "{{name}}", new_text: "Bart" }, "e1");
      case 3:
        return tool("next_question", { question: TZ_Q }, "q2");
      case 4:
        // The user said a city; the model writes the resolved IANA name.
        return tool(
          "edit_file",
          { path: "config/profile.md", old_text: "{{timezone}}", new_text: "Europe/Lisbon" },
          "e2",
        );
      case 5:
        return tool("commit", { paths: ["config/profile.md"], message: "setup: profile" }, "c");
      default:
        return { content: [{ type: "text", text: "You're set up, Bart, in Europe/Lisbon." }], stopReason: "end_turn", usage: usage() };
    }
  });
}

function tool(name: string, input: Record<string, unknown>, id: string): AssistantTurn {
  return { content: [{ type: "tool_use", id, name, input }], stopReason: "tool_use", usage: usage() };
}

describe("buildSetupContext", () => {
  it("does not require a configured vault", () => {
    const system = buildSetupContext();
    expect(system).toContain("first-run setup");
    // It must carry the timezone-resolution rule, the one thing setup can't get wrong.
    expect(system).toContain("Never write a bare UTC offset");
  });
});

describe("runSetup end-to-end (headless)", () => {
  let fs: GitFs;
  let vault: Vault;
  let cleanup: () => void;

  beforeEach(async () => {
    const root = mkdtempSync(join(tmpdir(), "setup-"));
    cleanup = () => rmSync(root, { recursive: true, force: true });
    fs = await makeNodeGitFs(root);
    await fs.promises.mkdir("/vault");
    vault = new Vault(fs, "/vault");
    // A freshly cloned, unconfigured vault: the shipped template files.
    await vault.writeText("config/profile.md", readFileSync(join(REPO_ROOT, "config/profile.md"), "utf8"));
    await vault.writeText("config/season.md", readFileSync(join(REPO_ROOT, "config/season.md"), "utf8"));
  });
  afterEach(() => cleanup());

  it("asks for name and timezone and writes them into the profile slots", async () => {
    const askUser = vi.fn(async (q: string) => (q.includes("call you") ? "Bart" : "I'm in Lisbon"));
    const commit = vi.fn(async () => {});

    await runSetup({ vault, client: setupModel(), askUser, commit });

    expect(askUser).toHaveBeenCalledTimes(2);

    const profile = parseProfile(await vault.readText("config/profile.md"));
    expect(profile.name).toBe("Bart");
    expect(profile.timezone).toBe("Europe/Lisbon");
    expect(requiredAnswersPresent(profile)).toBe(true);

    // The slots are gone; the explanation around them survives.
    const raw = await vault.readText("config/profile.md");
    expect(raw).not.toContain("{{name}}");
    expect(raw).not.toContain("{{timezone}}");
    expect(raw).toContain("What to call the user in briefings and reviews.");

    expect(commit).toHaveBeenCalledWith(["config/profile.md"], "setup: profile");
  });
});
