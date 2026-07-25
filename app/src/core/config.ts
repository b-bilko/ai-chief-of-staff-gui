/**
 * Build-time configuration.
 *
 * The GitHub OAuth **app client id** is public by design (device flow uses no
 * client secret), so it is safe to ship. The project must register its own
 * OAuth app and set `EXPO_PUBLIC_GITHUB_CLIENT_ID`; the placeholder only exists
 * so the app compiles before that is done.
 */

export const GITHUB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID ?? "REPLACE_WITH_OAUTH_APP_CLIENT_ID";
