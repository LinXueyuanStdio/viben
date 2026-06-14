#!/usr/bin/env npx tsx
/**
 * Generate Python + TypeScript client SDKs from Viben Gateway OpenAPI spec
 * using Speakeasy CLI.
 *
 * Prerequisites:
 *   - Gateway running at GATEWAY_URL (default: http://127.0.0.1:18790)
 *   - Speakeasy CLI installed and authenticated
 *
 * Usage:
 *   pnpm generate-client-sdk
 */

import { execSync } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const OUTPUT_DIR = join(ROOT, "packages", "client-sdk");
const SPEC_PATH = join(OUTPUT_DIR, "openapi.json");
const GATEWAY_URL = process.env.GATEWAY_URL || "http://127.0.0.1:18790";

async function downloadSpec(): Promise<void> {
  const url = `${GATEWAY_URL}/openapi.json`;
  console.log(`[generate-client-sdk] Downloading OpenAPI spec from ${url}...`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch OpenAPI spec: ${res.status} ${res.statusText}`);
  }

  const spec = await res.json();
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(SPEC_PATH, JSON.stringify(spec, null, 2), "utf-8");

  console.log(`[generate-client-sdk] OpenAPI spec saved: ${SPEC_PATH}`);
  console.log(`[generate-client-sdk] Paths: ${Object.keys(spec.paths || {}).length}`);
}

function runSpeakeasy(target: "python" | "typescript"): void {
  const outputDir = join(OUTPUT_DIR, target);
  const sdkName = "viben";
  const packageName = target === "python" ? "viben-client" : "@viben/client-sdk";

  console.log(`\n[generate-client-sdk] Generating ${target} SDK...`);

  const cmd = [
    "speakeasy",
    "generate",
    "sdk",
    "-s", SPEC_PATH,
    "-t", target,
    "-o", outputDir,
    "-n", sdkName,
    "-p", packageName,
  ].join(" ");

  execSync(cmd, { stdio: "inherit", cwd: ROOT });

  console.log(`[generate-client-sdk] ${target} SDK generated at: ${outputDir}`);
}

async function main() {
  await downloadSpec();
  runSpeakeasy("python");
  runSpeakeasy("typescript");
  console.log("\n[generate-client-sdk] Done! SDKs generated at packages/client-sdk/");
}

main().catch((err) => {
  console.error("[generate-client-sdk] Error:", err);
  process.exit(1);
});
