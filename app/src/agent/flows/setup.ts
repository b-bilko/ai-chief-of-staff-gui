/**
 * First-run setup, by voice: the interview that fills `config/profile.md` and
 * `config/season.md` so the rest of the system has a name, a timezone, and a
 * season to work from.
 *
 * This is what lets someone go from a freshly cloned empty vault to a working
 * setup without ever opening a terminal. It reuses the same turn-taking machine
 * the wrap uses — the interview is the same shape, one question at a time.
 */

import type { Vault } from "../../vault/fs";
import { runAgent, type RunResult } from "../session";
import { buildTools } from "../tools";
import type { AgentEventSink, CreateParams, LlmClient } from "../types";
import { buildSetupContext } from "./context";

export interface SetupOptions {
  vault: Vault;
  client: LlmClient;
  askUser: (question: string) => Promise<string>;
  commit: (paths: string[], message: string) => Promise<void>;
  onEvent?: AgentEventSink;
  /** Resolving a spoken city to an IANA zone takes some reasoning; default medium. */
  effort?: CreateParams["effort"];
}

export async function runSetup(options: SetupOptions): Promise<RunResult> {
  // No buildContext here: setup is what creates the config buildContext requires.
  const system = buildSetupContext();

  const tools = buildTools(["next_question", "read_file", "write_file", "edit_file", "commit"], {
    vault: options.vault,
    askUser: options.askUser,
    commit: options.commit,
  });

  const kickoff =
    "Set me up. Start the first-run interview now: ask the first question with the " +
    "next_question tool. Don't greet me or explain first.";

  return runAgent({
    client: options.client,
    system,
    initialMessages: [{ role: "user", content: kickoff }],
    tools,
    effort: options.effort ?? "medium",
    ...(options.onEvent ? { onEvent: options.onEvent } : {}),
  });
}
