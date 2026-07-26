/**
 * The morning briefing: a short, honest read on the day built from the tracker,
 * yesterday's note, and the last week.
 *
 * Read-only by design. No commit tool, no write access — the skill writes
 * nothing, and neither does this flow. Its whole output is the spoken brief,
 * streamed to the voice layer as it is generated.
 */

import type { Vault } from "../../vault/fs";
import { runAgent, type RunResult } from "../session";
import { buildTools } from "../tools";
import type { AgentEventSink, CreateParams, LlmClient } from "../types";
import { buildContext } from "./context";

export interface BriefingOptions {
  vault: Vault;
  client: LlmClient;
  onEvent?: AgentEventSink;
  now?: Date;
  /** The briefing reasons over a week of notes, so it defaults high. */
  effort?: CreateParams["effort"];
}

export async function runDailyBriefing(options: BriefingOptions): Promise<RunResult> {
  const context = await buildContext(options.vault, "daily-briefing", options.now);

  // No commit, no write, no next_question — the briefing only reads.
  const tools = buildTools(["read_file", "list_files", "search"], { vault: options.vault });

  const kickoff = "Brief me on my day.";

  return runAgent({
    client: options.client,
    system: context.system,
    initialMessages: [{ role: "user", content: kickoff }],
    tools,
    effort: options.effort ?? "high",
    ...(options.onEvent ? { onEvent: options.onEvent } : {}),
  });
}
