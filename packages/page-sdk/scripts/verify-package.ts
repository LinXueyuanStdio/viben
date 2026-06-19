import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFile(path: string): void {
  assert(existsSync(resolve(rootDir, path)), `Missing expected package file: ${path}`);
}

const packageJson = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf-8")) as {
  name: string;
  main?: string;
  module?: string;
  types?: string;
  unpkg?: string;
  jsdelivr?: string;
  exports?: Record<string, unknown>;
};

assert(packageJson.name === "@viben/page-sdk", "Package name must be @viben/page-sdk");
assert(packageJson.main === "./dist/index.cjs", "main must point to CJS npm entry");
assert(packageJson.module === "./dist/index.js", "module must point to ESM npm entry");
assert(packageJson.types === "./dist/index.d.ts", "types must point to declaration entry");
assert(packageJson.unpkg === "./dist/assets/viben-page-sdk.js", "unpkg must point to CDN bundle");
assert(packageJson.jsdelivr === "./dist/assets/viben-page-sdk.js", "jsdelivr must point to CDN bundle");
assert(Boolean(packageJson.exports?.["."]), "Package must export the npm root entry");
assert(
  Boolean(packageJson.exports?.["./assets/viben-page-sdk.js"]),
  "Package must export CDN script subpath",
);
assert(
  Boolean(packageJson.exports?.["./assets/viben-page-tokens.css"]),
  "Package must export CSS token subpath",
);

assertFile("dist/index.js");
assertFile("dist/index.cjs");
assertFile("dist/index.d.ts");
assertFile("dist/assets/viben-page-sdk.js");
assertFile("assets/viben-page-tokens.css");

execFileSync(process.execPath, [
  "--input-type=module",
  "--eval",
  [
    'import { VibenPageSDK, createVibenPage } from "@viben/page-sdk";',
    'if (typeof VibenPageSDK !== "function") throw new Error("VibenPageSDK export missing");',
    'if (typeof createVibenPage !== "function") throw new Error("createVibenPage export missing");',
    'if ("window" in globalThis) throw new Error("SSR import unexpectedly created window");',
  ].join("\n"),
], {
  cwd: rootDir,
  stdio: "inherit",
});

execFileSync(process.execPath, [
  "--eval",
  [
    'const sdk = require("@viben/page-sdk");',
    'if (typeof sdk.VibenPageSDK !== "function") throw new Error("CJS VibenPageSDK export missing");',
    'if (typeof sdk.createVibenPage !== "function") throw new Error("CJS createVibenPage export missing");',
  ].join("\n"),
], {
  cwd: rootDir,
  stdio: "inherit",
});

console.log("page-sdk package exports verified");
