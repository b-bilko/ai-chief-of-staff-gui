/**
 * The tool surface the model acts through.
 *
 * These are the vault's file operations plus two flow-specific tools:
 * `commit`, which stages exact paths and pushes, and `next_question`, which
 * hands a question to the voice layer and blocks on the spoken answer. The
 * skills were written for a Claude Code session with Read/Write/Edit/Bash; this
 * is the smallest set that reproduces what they actually use.
 *
 * Every tool is bound to concrete dependencies (a `Vault`, an `askUser`, a
 * `commit`) so a flow decides which seams exist. A read-only flow like the
 * briefing simply does not build `commit` or `next_question`.
 */

import type { Vault } from "../vault/fs";
import type { Tool, ToolInput } from "./types";

export interface ToolDeps {
  vault: Vault;
  /**
   * Deliver a question to the user and resolve with their answer. In the app
   * this speaks the question and transcribes the reply; in tests it returns a
   * canned answer. The question text is passed through untouched.
   */
  askUser?: (question: string) => Promise<string>;
  /** Stage exact paths, commit, push. Refused paths and secrets throw. */
  commit?: (paths: string[], message: string) => Promise<void>;
}

function str(input: ToolInput, key: string): string {
  const value = input[key];
  if (typeof value !== "string") throw new Error(`Expected string "${key}"`);
  return value;
}

function optionalStr(input: ToolInput, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" ? value : undefined;
}

function strArray(input: ToolInput, key: string): string[] {
  const value = input[key];
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw new Error(`Expected string array "${key}"`);
  }
  return value as string[];
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

function readFileTool(deps: ToolDeps): Tool {
  return {
    definition: {
      name: "read_file",
      description:
        "Read a UTF-8 file from the vault. Path is relative to the vault root, e.g. " +
        "'tracker.md' or 'daily/2026-07-25.md'. Errors if the file does not exist.",
      input_schema: {
        type: "object",
        properties: { path: { type: "string", description: "Vault-relative path" } },
        required: ["path"],
      },
    },
    async execute(input) {
      return deps.vault.readText(str(input, "path"));
    },
  };
}

function writeFileTool(deps: ToolDeps): Tool {
  return {
    definition: {
      name: "write_file",
      description:
        "Create or overwrite a vault file with exact content. Creates parent directories " +
        "as needed. Writes content verbatim — do not reformat what the user said.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Vault-relative path" },
          content: { type: "string", description: "Full file content" },
        },
        required: ["path", "content"],
      },
    },
    async execute(input) {
      const path = str(input, "path");
      await deps.vault.writeText(path, str(input, "content"));
      return `Wrote ${path}`;
    },
  };
}

function editFileTool(deps: ToolDeps): Tool {
  return {
    definition: {
      name: "edit_file",
      description:
        "Replace one exact occurrence of old_text with new_text in a vault file. Use this to " +
        "append into a section (for example under '## Entries') without rewriting the file. " +
        "Fails if old_text is absent or appears more than once, so include enough surrounding " +
        "text to make it unique.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Vault-relative path" },
          old_text: { type: "string", description: "Exact text to replace (must be unique)" },
          new_text: { type: "string", description: "Replacement text" },
        },
        required: ["path", "old_text", "new_text"],
      },
    },
    async execute(input) {
      const path = str(input, "path");
      await deps.vault.edit(path, str(input, "old_text"), str(input, "new_text"));
      return `Edited ${path}`;
    },
  };
}

function listFilesTool(deps: ToolDeps): Tool {
  return {
    definition: {
      name: "list_files",
      description:
        "List files in a vault directory. Omit dir to list the vault root. Set recursive to " +
        "descend, and pattern to keep only matching filenames (a regular expression).",
      input_schema: {
        type: "object",
        properties: {
          dir: { type: "string", description: "Vault-relative directory, default root" },
          recursive: { type: "boolean" },
          pattern: { type: "string", description: "Regex matched against each filename" },
        },
      },
    },
    async execute(input) {
      const dir = optionalStr(input, "dir") ?? "";
      const pattern = optionalStr(input, "pattern");
      const files = await deps.vault.list(dir, {
        recursive: input.recursive === true,
        ...(pattern ? { match: new RegExp(pattern) } : {}),
      });
      return files.length ? files.join("\n") : "(no files)";
    },
  };
}

function searchTool(deps: ToolDeps): Tool {
  return {
    definition: {
      name: "search",
      description:
        "Case-insensitive substring search across the vault's free-text folders (daily, " +
        "meetings, notes by default). Returns matching lines with their path and line number.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string" },
          dirs: { type: "array", items: { type: "string" }, description: "Directories to search" },
        },
        required: ["query"],
      },
    },
    async execute(input) {
      const dirs = Array.isArray(input.dirs) ? strArray(input, "dirs") : undefined;
      const hits = await deps.vault.search(str(input, "query"), dirs ? { dirs } : {});
      if (!hits.length) return "(no matches)";
      return hits.map((h) => `${h.path}:${h.line}: ${h.text}`).join("\n");
    },
  };
}

function commitTool(deps: ToolDeps): Tool {
  return {
    definition: {
      name: "commit",
      description:
        "Save the exact files you changed to git and push. List every path you wrote, by name — " +
        "never a wildcard. Message follows the vault convention, e.g. 'daily-wrap: 2026-07-25'.",
      input_schema: {
        type: "object",
        properties: {
          paths: { type: "array", items: { type: "string" }, description: "Exact paths changed" },
          message: { type: "string" },
        },
        required: ["paths", "message"],
      },
    },
    async execute(input) {
      if (!deps.commit) throw new Error("Committing is not available in this flow.");
      const paths = strArray(input, "paths");
      await deps.commit(paths, str(input, "message"));
      return `Committed ${paths.length} file(s): ${paths.join(", ")}`;
    },
  };
}

function nextQuestionTool(deps: ToolDeps): Tool {
  return {
    definition: {
      name: "next_question",
      description:
        "Ask the user one question aloud and get their spoken answer back. Use this for every " +
        "interview question, one at a time. The exact text is spoken to the user, so phrase it " +
        "as you want it heard. Returns the user's answer verbatim.",
      input_schema: {
        type: "object",
        properties: { question: { type: "string", description: "The question to ask, spoken as written" } },
        required: ["question"],
      },
    },
    async execute(input) {
      if (!deps.askUser) throw new Error("Asking the user is not available in this flow.");
      return deps.askUser(str(input, "question"));
    },
  };
}

const REGISTRY: Record<string, (deps: ToolDeps) => Tool> = {
  read_file: readFileTool,
  write_file: writeFileTool,
  edit_file: editFileTool,
  list_files: listFilesTool,
  search: searchTool,
  commit: commitTool,
  next_question: nextQuestionTool,
};

export type ToolName = keyof typeof REGISTRY;

/** Build the named tools, bound to the flow's dependencies. */
export function buildTools(names: ToolName[], deps: ToolDeps): Tool[] {
  return names.map((name) => {
    const factory = REGISTRY[name];
    if (!factory) throw new Error(`Unknown tool: ${name}`);
    return factory(deps);
  });
}
