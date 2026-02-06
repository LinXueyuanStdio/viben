import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    browser: "src/browser.ts",
    "agents/index": "src/agents/index.ts",
    "providers/index": "src/providers/index.ts",
    "models/index": "src/models/index.ts",
    "config/index": "src/config/index.ts",
  },
  format: ["cjs", "esm"],
  dts: {
    resolve: true,
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
