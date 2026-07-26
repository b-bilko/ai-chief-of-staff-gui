import { defineConfig } from "vitest/config";

// The vault and agent layers are plain TypeScript with no React and no native
// dependency, so they run on Node. UI tests, if they ever exist, need a
// separate jest-expo project rather than being forced in here.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    globals: false,
  },
});
