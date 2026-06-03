import { defineConfig } from "vitest/config";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@byronwade/core": resolve(__dirname, "../core/src/index.ts"),
    },
  },
  test: {
    environment: "node",
  },
});
