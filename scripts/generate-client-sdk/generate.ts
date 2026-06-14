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

async function downloadSpec(): Promise<Record<string, unknown>> {
  const url = `${GATEWAY_URL}/openapi.json`;
  console.log(`[generate-client-sdk] Downloading OpenAPI spec from ${url}...`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch OpenAPI spec: ${res.status} ${res.statusText}`);
  }

  return await res.json() as Record<string, unknown>;
}

function fixSpec(spec: Record<string, unknown>): Record<string, unknown> {
  let fixCount = 0;

  // Fix 1: Add missing `items` to arrays (OpenAPI 3.0.x requires items for arrays)
  function addMissingItems(obj: unknown): void {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const record = obj as Record<string, unknown>;
      if (record.type === "array" && !record.items) {
        record.items = {};
        fixCount++;
      }
      for (const value of Object.values(record)) {
        addMissingItems(value);
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        addMissingItems(item);
      }
    }
  }
  addMissingItems(spec);

  // Fix 2: Remove paths with invalid wildcard params like /api/mcp/tauri/{*}
  const paths = spec.paths as Record<string, unknown> | undefined;
  if (paths) {
    const invalidPaths: string[] = [];
    for (const path of Object.keys(paths)) {
      if (path.includes("{*}") || path.includes("{*path}")) {
        invalidPaths.push(path);
      }
    }
    for (const path of invalidPaths) {
      delete paths[path];
      fixCount++;
    }
    if (invalidPaths.length > 0) {
      console.log(`[generate-client-sdk] Removed invalid paths: ${invalidPaths.join(", ")}`);
    }
  }

  console.log(`[generate-client-sdk] Applied ${fixCount} spec fixes`);
  return spec;
}

async function writeGenYaml(target: "python" | "typescript", outputDir: string): Promise<void> {
  const config =
    target === "python"
      ? `python:
  version: 0.1.0
  author: Viben
  packageName: viben-client
  description: Viben Gateway Python Client SDK
generate:
  baseServerUrl: http://127.0.0.1:18790
`
      : `typescript:
  version: 0.1.0
  author: Viben
  packageName: "@viben/client-sdk"
  description: Viben Gateway TypeScript Client SDK
generate:
  baseServerUrl: http://127.0.0.1:18790
`;

  await writeFile(join(outputDir, "gen.yaml"), config, "utf-8");
}

async function runSpeakeasy(target: "python" | "typescript"): Promise<void> {
  const outputDir = join(OUTPUT_DIR, target);
  await mkdir(outputDir, { recursive: true });
  await writeGenYaml(target, outputDir);

  console.log(`\n[generate-client-sdk] Generating ${target} SDK...`);

  const cmd = [
    "speakeasy",
    "generate",
    "sdk",
    "--schema", SPEC_PATH,
    "--lang", target,
    "--out", outputDir,
  ].join(" ");

  execSync(cmd, { stdio: "inherit", cwd: ROOT });

  console.log(`[generate-client-sdk] ${target} SDK generated at: ${outputDir}`);
}

async function main() {
  const spec = await downloadSpec();
  const fixedSpec = fixSpec(spec);

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(SPEC_PATH, JSON.stringify(fixedSpec, null, 2), "utf-8");
  console.log(`[generate-client-sdk] Spec saved: ${SPEC_PATH} (${Object.keys((fixedSpec.paths as object) || {}).length} paths)`);

  await runSpeakeasy("typescript");
  await runSpeakeasy("python");
  console.log("\n[generate-client-sdk] Done! SDKs generated at packages/client-sdk/");
}

main().catch((err) => {
  console.error("[generate-client-sdk] Error:", err);
  process.exit(1);
});
