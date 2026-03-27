import { defineConfig } from "tsup";
import { readFileSync } from "fs";

// Read version from package.json at build time
const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));
const VERSION = packageJson.version;

export default defineConfig({
  entry: {
    index: "src/index.ts",
    shared: "src/shared.ts",
    "agents/index": "src/agents/index.ts",
    "providers/index": "src/providers/index.ts",
    "models/index": "src/models/index.ts",
    "config/index": "src/config/index.ts",
    "telemetry/index": "src/telemetry/index.ts",
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
  // Inject version at build time
  define: {
    __VERSION__: JSON.stringify(VERSION),
  },
  onSuccess: async () => {
    const fs = await import("fs/promises");
    const path = await import("path");

    // Add shebang to bin.js after build
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

    // Copy prompt templates from templates/viben/ to dist/prompts/
    // templates/viben/ is the single source of truth for idea-types and reward-types
    const templatesDir = path.resolve(process.cwd(), "templates/viben");
    const distPromptsDir = path.resolve(process.cwd(), "dist/prompts");

    try {
      // Copy idea-types
      const ideaTypesDir = path.join(templatesDir, "idea-types");
      const distIdeaTypesDir = path.join(distPromptsDir, "idea-types");
      await fs.mkdir(distIdeaTypesDir, { recursive: true });
      await fs.cp(ideaTypesDir, distIdeaTypesDir, { recursive: true });

      // Copy reward-types
      const rewardTypesDir = path.join(templatesDir, "reward-types");
      const distRewardTypesDir = path.join(distPromptsDir, "reward-types");
      await fs.mkdir(distRewardTypesDir, { recursive: true });
      await fs.cp(rewardTypesDir, distRewardTypesDir, { recursive: true });

      console.log("Copied prompts from templates/viben/ to dist/prompts/");
    } catch (err) {
      // Templates directory might not exist
      console.warn("Could not copy prompts:", err);
    }
  },
});
