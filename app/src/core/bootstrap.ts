/**
 * The device-side lifecycle around a vault: clone it, work out its readiness,
 * read the greeting facts for the home screen, and persist the binding so the
 * app knows on next launch which repo it is bound to.
 *
 * All native (file system, network), so typecheck-verified rather than tested.
 */

import * as ExpoFileSystem from "expo-file-system";
import gitHttp from "isomorphic-git/http/web";

import { VAULT_DIR, vaultBaseUri } from "./constants";
import type { VaultBinding } from "./services";
import { today, todayWeekday } from "../vault/dates";
import { Vault } from "../vault/fs";
import { cloneVault } from "../vault/git";
import { makeExpoGitFs } from "../vault/gitfs";
import { parseProfile } from "../vault/config";
import { assessVault, type CloneSpec, type VaultReadiness } from "../onboarding/repo";

const BINDING_FILE = "binding.json";

function fs() {
  return makeExpoGitFs(ExpoFileSystem, vaultBaseUri());
}

function author(login: string) {
  return { name: login, email: `${login}@users.noreply.github.com` };
}

/** Clone the chosen repo into device storage and return the binding to persist. */
export async function cloneVaultRepo(input: {
  spec: CloneSpec;
  token: string;
  login: string;
  onMessage?: (m: string) => void;
}): Promise<VaultBinding> {
  await cloneVault({
    fs: fs(),
    http: gitHttp,
    dir: VAULT_DIR,
    url: input.spec.cloneUrl,
    onAuth: () => ({ username: input.token, password: "x-oauth-basic" }),
    author: author(input.login),
    ...(input.onMessage ? { onMessage: input.onMessage } : {}),
  });
  return { remoteUrl: input.spec.cloneUrl, defaultBranch: input.spec.defaultBranch, gitLogin: input.login };
}

/** Is the cloned tree a vault, and is it configured? */
export async function assessClonedVault(): Promise<VaultReadiness> {
  return assessVault(fs(), VAULT_DIR);
}

/** The name and weekday the home screen greets with, in the profile timezone. */
export async function greetingFacts(): Promise<{ name: string; weekday: string }> {
  const vault = new Vault(fs(), VAULT_DIR);
  const profile = parseProfile(await vault.readText("config/profile.md"));
  const name = profile.name ?? "there";
  const zone = profile.timezone;
  if (!zone) return { name, weekday: "" };
  return { name, weekday: `${todayWeekday(zone)}, ${today(zone)}` };
}

// --- Persisted binding -----------------------------------------------------

function bindingFile() {
  return new ExpoFileSystem.File(ExpoFileSystem.Paths.join(ExpoFileSystem.Paths.document.uri, BINDING_FILE));
}

export async function loadBinding(): Promise<VaultBinding | null> {
  const file = bindingFile();
  if (!file.exists) return null;
  try {
    return JSON.parse(file.textSync()) as VaultBinding;
  } catch {
    return null;
  }
}

export async function saveBinding(binding: VaultBinding): Promise<void> {
  const file = bindingFile();
  if (!file.exists) file.create({ overwrite: true });
  file.write(JSON.stringify(binding));
}
