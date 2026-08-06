import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
    // UI component tests opt into jsdom per-file with a
    // `// @vitest-environment jsdom` docblock (Vitest 4 dropped
    // environmentMatchGlobs); everything else stays in node.
  },
  resolve: {
    alias: {
      "@": path.resolve(srcDir, "src"),
    },
  },
});
