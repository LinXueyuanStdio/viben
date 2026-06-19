import { defineConfig } from "tsup";
import { readFileSync } from "fs";
import * as fs from "fs/promises";
import * as path from "path";

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
    "acp/ops/client-side-mcp-server": "src/acp/ops/client-side-mcp-server.ts",
    "mcp/server/browse-mcp/mcp-server": "src/mcp/server/browse-mcp/mcp-server.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  // Optional dependencies that are dynamically imported at runtime
  // Note: fastify and ws must be external to avoid "Dynamic require of events is not supported" error
  // Note: yaml must be external because yaml@2.8+ uses CJS require("process") which breaks in ESM bundles
  // Note: archiver is external for pet export (dynamically imported)
  external: [
    "fastify",
    "@fastify/cors",
    "@fastify/multipart",
    "@fastify/swagger",
    "@fastify/websocket",
    "node-pty",
    "ws",
    "yaml",
    "archiver",
    "socket.io",
    "socket.io-client",
  ],
  // Inject version at build time
  define: {
    __VERSION__: JSON.stringify(VERSION),
  },
  onSuccess: async () => {
    // Add shebang to bin.js after build
    const binFiles = [
      "dist/acp/ops/client-side-mcp-server.js",
      "dist/acp/ops/client-side-mcp-server.cjs",
      "dist/mcp/server/browse-mcp/mcp-server.js",
      "dist/mcp/server/browse-mcp/mcp-server.cjs",
    ];
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

    // Copy page-sdk assets into dist/assets/ so CLI bundle can find them via fallback paths
    const pageSdkDir = path.resolve(process.cwd(), "../page-sdk");
    const distAssets = path.resolve(process.cwd(), "dist/assets");
    await fs.mkdir(distAssets, { recursive: true });
    const assetsToCopy = [
      { src: path.join(pageSdkDir, "dist/assets/viben-page-sdk.js"), dest: path.join(distAssets, "viben-page-sdk.js") },
      { src: path.join(pageSdkDir, "assets/viben-page-tokens.css"), dest: path.join(distAssets, "viben-page-tokens.css") },
    ];
    for (const { src, dest } of assetsToCopy) {
      try {
        await fs.copyFile(src, dest);
      } catch {
        // page-sdk might not be built yet in some CI steps
      }
    }
  },
});
