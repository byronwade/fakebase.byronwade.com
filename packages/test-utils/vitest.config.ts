import { defineConfig } from "vitest/config";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@fakebase/core": resolve(__dirname, "../core/src/index.ts"),
      "@fakebase/adapter-memory": resolve(__dirname, "../adapter-memory/src/index.ts"),
    },
  },
  test: {
    environment: "node",
  },
});
