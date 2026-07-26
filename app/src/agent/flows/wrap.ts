/**
 * The daily wrap: nine questions, one at a time, answers kept verbatim, then
 * the tracker check-in and the write into today's note.
 *
 * The flow itself is thin. The interview shape comes from the skill in the
 * system prompt; the pausing-between-questions comes from `next_question`
 * blocking on the spoken answer. All this module does is assemble the pieces
 * and kick the model off.
 */

import type { Vault } from "../../vault/fs";
import { runAgent, type RunResult } from "../session";
import { buildTools } from "../tools";
import type { AgentEventSink, CreateParams, LlmClient } from "../types";
import { buildContext } from "./context";

export interface WrapOptions {
  vault: Vault;
  client: LlmClient;
  /** Speak a question and return the transcribed answer. */
  askUser: (question: string) => Promise<string>;
  /** Stage exact paths, commit, push. */
  commit: (paths: string[], message: string) => Promise<void>;
  onEvent?: AgentEventSink;
  now?: Date;
  /**
   * The wrap is mostly reading a scripted question and recording a verbatim
   * answer, so it defaults low. Raise it if the write-up needs more care.
   */
  effort?: CreateParams["effort"];
}

export async function runDailyWrap(options: WrapOptions): Promise<RunResult> {
  const context = await buildContext(options.vault, "daily-wrap", options.now);

  const tools = buildTools(
    ["next_question", "read_file", "write_file", "edit_file", "list_files", "search", "commit"],
    { vault: options.vault, askUser: options.askUser, commit: options.commit },
  );

  const kickoff =
    "It's the evening and I'm ready to wrap up the day. Start the wrap now: ask question one " +
    "with the next_question tool. Don't greet me or explain what you're about to do first.";

  return runAgent({
    client: options.client,
    system: context.system,
    initialMessages: [{ role: "user", content: kickoff }],
    tools,
    effort: options.effort ?? "low",
    ...(options.onEvent ? { onEvent: options.onEvent } : {}),
  });
}
