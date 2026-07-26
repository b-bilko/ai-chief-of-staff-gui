/**
 * Capture: take one spoken thought and file it, in the user's words, in one
 * pass. No inbox, no second sort — by the time the flow returns, the note is in
 * its home and committed.
 */

import type { Vault } from "../../vault/fs";
import { runAgent, type RunResult } from "../session";
import { buildTools } from "../tools";
import type { AgentEventSink, CreateParams, LlmClient } from "../types";
import { buildContext } from "./context";

export interface CaptureOptions {
  vault: Vault;
  client: LlmClient;
  /** The transcribed thought, exactly as the user said it. */
  text: string;
  commit: (paths: string[], message: string) => Promise<void>;
  onEvent?: AgentEventSink;
  now?: Date;
  effort?: CreateParams["effort"];
}

export async function runCapture(options: CaptureOptions): Promise<RunResult> {
  const context = await buildContext(options.vault, "capture", options.now);

  const tools = buildTools(
    ["read_file", "write_file", "edit_file", "list_files", "search", "commit"],
    { vault: options.vault, commit: options.commit },
  );

  // The user spoke this, so it is a note to file, not a question to answer.
  // Pass it through untouched and let the skill route it.
  const kickoff = `Capture this. My exact words:\n\n${options.text}`;

  return runAgent({
    client: options.client,
    system: context.system,
    initialMessages: [{ role: "user", content: kickoff }],
    tools,
    effort: options.effort ?? "low",
    ...(options.onEvent ? { onEvent: options.onEvent } : {}),
  });
}
