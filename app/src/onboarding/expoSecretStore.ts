/**
 * The device-backed `SecretStore`, over `expo-secure-store`.
 *
 * Thin edge adapter, not unit-tested (native). The keys are the same short
 * identifiers everywhere; the values are the secrets, held in the platform
 * keystore rather than anywhere the vault or a backup could reach.
 */

import * as SecureStore from "expo-secure-store";

import type { SecretKey, SecretStore } from "./secretStore";

// Require the device to be unlocked, and don't sync secrets to iCloud Keychain.
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export function createExpoSecretStore(): SecretStore {
  return {
    get: (key: SecretKey) => SecureStore.getItemAsync(key, OPTIONS),
    set: (key: SecretKey, value: string) => SecureStore.setItemAsync(key, value, OPTIONS),
    delete: (key: SecretKey) => SecureStore.deleteItemAsync(key, OPTIONS),
  };
}
