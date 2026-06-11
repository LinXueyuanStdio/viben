import { build } from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

await build({
  entryPoints: [resolve(rootDir, "src/assets/viben-page-sdk.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  globalName: "VibenPageSDK",
  outfile: resolve(rootDir, "dist/assets/viben-page-sdk.js"),
  platform: "browser",
  target: ["es2020"],
  external: [],
});

console.log("viben-page-sdk.js built successfully");
