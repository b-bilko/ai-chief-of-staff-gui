/**
 * The one place the vault's location on the device is defined, so the running
 * services and the onboarding bootstrap cannot disagree about where it is.
 */

import * as ExpoFileSystem from "expo-file-system";

/** The virtual git root the vault is cloned into. */
export const VAULT_DIR = "/vault";

/** The real device directory the virtual root maps to. */
export function vaultBaseUri(): string {
  return ExpoFileSystem.Paths.join(ExpoFileSystem.Paths.document.uri, "vault");
}
