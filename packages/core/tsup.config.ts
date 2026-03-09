import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    shared: "src/shared.ts",
    "agents/index": "src/agents/index.ts",
    "providers/index": "src/providers/index.ts",
    "models/index": "src/models/index.ts",
    "config/index": "src/config/index.ts",
    "cli/index": "src/cli/index.ts",
    "cli/bin": "src/cli/bin.ts",
  },
  format: ["cjs", "esm"],
  dts: {
    resolve: true,
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Optional dependencies that are dynamically imported at runtime
  // Note: fastify and ws must be external to avoid "Dynamic require of events is not supported" error
  external: ["fastify", "@fastify/cors", "@fastify/websocket", "node-pty", "ws"],
  onSuccess: async () => {
    // Add shebang to bin.js after build
    const fs = await import("fs/promises");
    const path = await import("path");

    const binFiles = ["dist/cli/bin.js", "dist/cli/bin.cjs"];
    for (const file of binFiles) {
      try {
        const filePath = path.resolve(process.cwd(), file);
        const content = await fs.readFile(filePath, "utf-8");
        if (!content.startsWith("#!/usr/bin/env node")) {
          await fs.writeFile(filePath, `#!/usr/bin/env node\n${content}`);
        }
      } catch {
        // File might not exist (cjs/esm depending on format)
      }
    }
  },
});
