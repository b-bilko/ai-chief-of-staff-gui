/**
 * An empty module.
 *
 * Metro maps Node core builtins (`node:fs`, `node:crypto`, …) to this. They are
 * referenced only by dependencies' Node-only code paths that React Native never
 * reaches — chiefly the Anthropic SDK's file-based credential loading, which is
 * dead here because the app always passes an explicit API key. See
 * `metro.config.js`.
 */

export default {};
