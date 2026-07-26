/**
 * The composition root: where the real device backends are instantiated and
 * wired into the layers built and tested in isolation.
 *
 * Every layer below took its dependencies as interfaces so it could be tested
 * on Node. This is the one place that reaches for the concrete Expo modules —
 * the file system, speech, secure storage, the network — and assembles them
 * into the objects the flows and screens use. It is typecheck-verified rather
 * than unit-tested: its whole job is to name real native modules, which only a
 * device can run.
 */

import * as ExpoFileSystem from "expo-file-system";
import gitHttp from "isomorphic-git/http/web";

import { makeAnthropicClient } from "../agent/anthropicClient";
import { runCapture } from "../agent/flows/capture";
import { runDailyBriefing } from "../agent/flows/briefing";
import { runDailyWrap } from "../agent/flows/wrap";
import { runSetup } from "../agent/flows/setup";
import type { AgentEventSink, LlmClient } from "../agent/types";
import { Vault } from "../vault/fs";
import { commitAndPush, type RepoContext } from "../vault/git";
import { makeExpoGitFs, type GitFs } from "../vault/gitfs";
import { createExpoRecognizer } from "../voice/expoRecognizer";
import { createExpoSynth } from "../voice/expoSpeech";
import { VoiceController } from "../voice/turnTaking";
import { createExpoSecretStore } from "../onboarding/expoSecretStore";
import { SECRET_KEYS, type SecretStore } from "../onboarding/secretStore";
import { VAULT_DIR, vaultBaseUri } from "./constants";

/** The clone target and identity the app persists after onboarding. */
export interface VaultBinding {
  /** Remote HTTPS URL, e.g. https://github.com/bart/my-vault.git */
  remoteUrl: string;
  defaultBranch: string;
  /** The user's GitHub login, used for the git author line. */
  gitLogin: string;
}

/** Everything the screens and flows need, assembled from real backends. */
export interface Services {
  vault: Vault;
  fs: GitFs;
  client: LlmClient;
  voice: VoiceController;
  secrets: SecretStore;
  /** Stage exact paths, commit, and push, using the stored git token. */
  commit(paths: string[], message: string): Promise<void>;
  // Flow launchers, pre-bound to this vault, client, voice, and committer.
  wrap(onEvent?: AgentEventSink): ReturnType<typeof runDailyWrap>;
  briefing(onEvent?: AgentEventSink): ReturnType<typeof runDailyBriefing>;
  capture(text: string, onEvent?: AgentEventSink): ReturnType<typeof runCapture>;
  setup(onEvent?: AgentEventSink): ReturnType<typeof runSetup>;
}

export interface CreateServicesInput {
  anthropicKey: string;
  gitToken: string;
  binding: VaultBinding;
  /** Override the secret store (tests); defaults to the device keystore. */
  secrets?: SecretStore;
}

export function createServices(input: CreateServicesInput): Services {
  const fs = makeExpoGitFs(ExpoFileSystem, vaultBaseUri());
  const vault = new Vault(fs, VAULT_DIR);
  const secrets = input.secrets ?? createExpoSecretStore();

  const client = makeAnthropicClient({ apiKey: input.anthropicKey });

  const voice = new VoiceController({
    synth: createExpoSynth(),
    recognizer: createExpoRecognizer({ onDevice: true }),
    // Give a spoken answer a couple of seconds of silence to settle, and a
    // generous cap so a long answer is never cut off mid-thought.
    silenceMs: 2500,
    maxListenMs: 120_000,
    // A clean transcript auto-confirms after a beat; any edit cancels it.
    autoConfirmMs: 6000,
  });

  const author = { name: input.binding.gitLogin, email: `${input.binding.gitLogin}@users.noreply.github.com` };

  const repoContext = (): RepoContext => ({
    fs,
    http: gitHttp,
    dir: VAULT_DIR,
    url: input.binding.remoteUrl,
    // The token authenticates git over HTTPS; it never leaves this closure.
    onAuth: () => ({ username: input.gitToken, password: "x-oauth-basic" }),
    author,
  });

  const commit = async (paths: string[], message: string): Promise<void> => {
    await commitAndPush(repoContext(), { paths, message });
  };

  return {
    vault,
    fs,
    client,
    voice,
    secrets,
    commit,
    wrap: (onEvent) => runDailyWrap({ vault, client, askUser: (q) => voice.askUser(q), commit, ...(onEvent ? { onEvent } : {}) }),
    briefing: (onEvent) => runDailyBriefing({ vault, client, ...(onEvent ? { onEvent } : {}) }),
    capture: (text, onEvent) => runCapture({ vault, client, text, commit, ...(onEvent ? { onEvent } : {}) }),
    setup: (onEvent) => runSetup({ vault, client, askUser: (q) => voice.askUser(q), commit, ...(onEvent ? { onEvent } : {}) }),
  };
}

export const SECRET = SECRET_KEYS;
