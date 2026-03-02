#!/usr/bin/env npx tsx
/**
 * Export OpenAPI specification from Viben Gateway
 *
 * This script starts the gateway, extracts the OpenAPI spec from Swagger,
 * and writes it to a JSON file for use with Docusaurus OpenAPI plugin.
 *
 * Usage:
 *   npx tsx scripts/export-openapi.ts
 *
 * Output:
 *   apps/docs/openapi/gateway-api.json
 */

import { createGateway } from "../packages/core/src/gateway/index.js";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("[export-openapi] Starting gateway to extract OpenAPI spec...");

  // Create gateway on random port (0 = auto-assign)
  const app = await createGateway({
    host: "127.0.0.1",
    port: 0,
    cors: false,
    telemetry: false,
  });

  // Wait for Fastify to be ready (plugins registered)
  await app.ready();

  // Get the OpenAPI spec from Swagger
  // @ts-expect-error - swagger method is added by @fastify/swagger plugin
  const spec = app.swagger?.();

  if (!spec) {
    console.error("[export-openapi] Failed to get OpenAPI spec - Swagger plugin may not be registered");
    await app.close();
    process.exit(1);
  }

  // Write spec to file
  const outputDir = join(__dirname, "..", "apps", "docs", "openapi");
  const outputPath = join(outputDir, "gateway-api.json");

  // Ensure directory exists
  await mkdir(outputDir, { recursive: true });

  // Write the spec
  await writeFile(outputPath, JSON.stringify(spec, null, 2), "utf-8");

  console.log(`[export-openapi] OpenAPI spec written to: ${outputPath}`);
  console.log(`[export-openapi] Spec version: ${spec.openapi}`);
  console.log(`[export-openapi] Paths: ${Object.keys(spec.paths || {}).length}`);

  // Close gateway
  await app.close();

  console.log("[export-openapi] Done!");
}

main().catch((err) => {
  console.error("[export-openapi] Error:", err);
  process.exit(1);
});
