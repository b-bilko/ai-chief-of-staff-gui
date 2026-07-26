// Metro configuration.
//
// Some dependencies reference Node core builtins (`node:fs`, `node:crypto`, …)
// from code paths that only run on a server. The Anthropic SDK, for instance,
// lazily `import('node:fs')` when loading credentials from a file — which never
// happens here, because the app always passes an explicit API key. React Native
// has no Node builtins, so those specifiers are redirected to an empty module to
// let the bundle build. If one were ever actually executed at runtime it would
// throw on device, which is the correct, visible failure rather than a silent one.

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const emptyModule = path.resolve(__dirname, "src/shims/empty.ts");
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "node:fs" || moduleName.startsWith("node:")) {
    return { type: "sourceFile", filePath: emptyModule };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
