import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const npmEntryExternal = ["@noble/ed25519", "socket.io-client"];

await rm(resolve(rootDir, "dist"), { force: true, recursive: true });

await build({
  entryPoints: [resolve(rootDir, "src/index.ts")],
  bundle: true,
  format: "esm",
  outfile: resolve(rootDir, "dist/index.js"),
  platform: "browser",
  target: ["es2020"],
  sourcemap: true,
  external: npmEntryExternal,
});

await build({
  entryPoints: [resolve(rootDir, "src/index.ts")],
  bundle: true,
  format: "cjs",
  outfile: resolve(rootDir, "dist/index.cjs"),
  platform: "browser",
  target: ["es2020"],
  sourcemap: true,
  external: npmEntryExternal,
});

await build({
  entryPoints: [resolve(rootDir, "src/browser.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  globalName: "VibenPageSDK",
  outfile: resolve(rootDir, "dist/assets/viben-page-sdk.js"),
  platform: "browser",
  target: ["es2020"],
  external: [],
});

console.log("page-sdk build completed");
