/**
 * Where the two secrets live: the Anthropic API key and the git token.
 *
 * Both stay in the device keystore (iOS Keychain, Android Keystore) and never
 * enter the vault — `git.ts` scans commits to enforce that from the other side.
 * The app talks to an interface so the store can be swapped for an in-memory
 * one in tests; the device implementation is a thin wrapper over
 * `expo-secure-store`.
 */

export const SECRET_KEYS = {
  anthropicKey: "anthropic_api_key",
  gitToken: "git_token",
} as const;

export type SecretKey = (typeof SECRET_KEYS)[keyof typeof SECRET_KEYS];

export interface SecretStore {
  get(key: SecretKey): Promise<string | null>;
  set(key: SecretKey, value: string): Promise<void>;
  delete(key: SecretKey): Promise<void>;
}

/** An in-memory store, for tests and for a run that opts out of persistence. */
export class MemorySecretStore implements SecretStore {
  private readonly values = new Map<SecretKey, string>();

  async get(key: SecretKey): Promise<string | null> {
    return this.values.get(key) ?? null;
  }
  async set(key: SecretKey, value: string): Promise<void> {
    this.values.set(key, value);
  }
  async delete(key: SecretKey): Promise<void> {
    this.values.delete(key);
  }
}
