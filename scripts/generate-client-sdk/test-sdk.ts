#!/usr/bin/env npx tsx
/**
 * Test the generated TypeScript client SDK against a running gateway.
 *
 * Prerequisites:
 *   - Gateway running at http://127.0.0.1:18790
 *   - SDK already generated (pnpm generate-client-sdk)
 *
 * Usage:
 *   npx tsx scripts/generate-client-sdk/test-sdk.ts
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Bypass HTTP proxy for local gateway
process.env.NO_PROXY = "127.0.0.1,localhost";
process.env.no_proxy = "127.0.0.1,localhost";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SDK_PATH = join(__dirname, "..", "..", "packages", "client-sdk", "typescript", "src");

async function main() {
  const GATEWAY_URL = process.env.GATEWAY_URL || "http://127.0.0.1:18790";

  console.log("=== Viben Client SDK Test ===\n");
  console.log(`Gateway: ${GATEWAY_URL}`);
  console.log(`SDK path: ${SDK_PATH}\n`);

  // Dynamic import of the generated SDK
  const { SDK } = await import(join(SDK_PATH, "index.ts"));

  const client = new SDK({ serverURL: GATEWAY_URL });

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ ${name}`);
      console.log(`    Error: ${msg}`);
      failed++;
    }
  }

  // --- Health ---
  console.log("\n[Health]");
  await test("GET /health", async () => {
    const res = await client.health.getHealth();
    assert(res.status === "ok", `expected status "ok", got "${res.status}"`);
    assert(typeof res.version === "string", `expected version string, got ${typeof res.version}`);
    console.log(`    version: ${res.version}, uptime: ${res.uptime}s`);
  });

  // --- Agents ---
  console.log("\n[Agents]");
  await test("GET /api/agent (list agents)", async () => {
    const res = await client.agents.getApiAgent();
    assert(res && typeof res === "object", `expected object/array, got ${typeof res}`);
    const agents = Array.isArray(res) ? res : (res as Record<string, unknown>).agents;
    if (Array.isArray(agents)) {
      console.log(`    found ${agents.length} agent(s)`);
      if (agents.length > 0) {
        const first = agents[0] as Record<string, unknown>;
        console.log(`    first: ${first.name || first.id}`);
      }
    } else {
      console.log(`    response keys: ${Object.keys(res as object).join(", ")}`);
    }
  });

  // --- Models ---
  console.log("\n[Models]");
  await test("GET /api/models (list models)", async () => {
    const res = await client.models.getApiModels();
    assert(res && typeof res === "object", `expected object, got ${typeof res}`);
    const models = (res as Record<string, unknown>).models;
    if (Array.isArray(models)) {
      console.log(`    found ${models.length} model(s)`);
    } else {
      console.log(`    response keys: ${Object.keys(res as object).join(", ")}`);
    }
  });

  // --- Providers ---
  console.log("\n[Providers]");
  await test("GET /api/providers (list providers)", async () => {
    const res = await client.providers.getApiProviders();
    assert(res && typeof res === "object", `expected object, got ${typeof res}`);
    const providers = Array.isArray(res) ? res : (res as Record<string, unknown>).providers;
    if (Array.isArray(providers)) {
      console.log(`    found ${providers.length} provider(s)`);
    } else {
      console.log(`    response keys: ${Object.keys(res as object).join(", ")}`);
    }
  });

  // --- Sessions ---
  console.log("\n[Sessions]");
  await test("GET /api/sessions (list sessions)", async () => {
    const res = await client.sessions.getApiSessions();
    assert(res && typeof res === "object", `expected object/array, got ${typeof res}`);
    const sessions = Array.isArray(res) ? res : (res as Record<string, unknown>).sessions;
    if (Array.isArray(sessions)) {
      console.log(`    found ${sessions.length} session(s)`);
    } else {
      console.log(`    response keys: ${Object.keys(res as object).join(", ")}`);
    }
  });

  // --- Cron ---
  console.log("\n[Cron]");
  await test("GET /api/cron (list cron jobs)", async () => {
    const res = await client.cron.getApiCron();
    assert(res && typeof res === "object", `expected object, got ${typeof res}`);
    const jobs = Array.isArray(res) ? res : (res as Record<string, unknown>).jobs;
    if (Array.isArray(jobs)) {
      console.log(`    found ${jobs.length} job(s)`);
    } else {
      console.log(`    response keys: ${Object.keys(res as object).join(", ")}`);
    }
  });

  // --- Summary ---
  console.log(`\n${"=".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);

  if (failed > 0) {
    process.exit(1);
  }

  console.log("\n✓ All tests passed! SDK is working correctly.");
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
