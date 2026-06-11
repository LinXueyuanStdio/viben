#!/usr/bin/env tsx
/**
 * E2E Test: Main Window Client (ACP Caller)
 *
 * Starts a minimal gateway (Fastify + ClientSocketServer) in-process,
 * waits for the page client to connect and register actions,
 * then calls those actions via executeAction and verifies results.
 *
 * Usage: tsx scripts/e2e-main-client.ts
 * Expects: e2e-page-client.ts to connect within 15 seconds
 */
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import { ClientSocketServer } from "../src/gateway/client-socket-server";
import { ClientStore } from "../src/gateway/client-store";

const TEST_PORT = 18791;
const TEST_HOST = "127.0.0.1";
const WAIT_TIMEOUT_MS = 15000;
const POLL_INTERVAL_MS = 200;

let passed = 0;
let failed = 0;

function log(msg: string) {
  console.log(`[main-client] ${msg}`);
}

function assert(condition: boolean, description: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${description}`);
  } else {
    failed++;
    console.log(`  ❌ ${description}`);
  }
}

async function waitForActions(clientStore: ClientStore, timeout: number): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const actions = clientStore.getAllActions();
    if (actions.length >= 2) {
      return actions[0].clientId;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return null;
}

async function main() {
  log("starting test gateway...");

  const app = Fastify({ logger: false });
  await app.register(fastifyCors, { origin: true });

  const clientStore = new ClientStore();
  app.get("/health", async () => ({ status: "ok" }));

  await app.listen({ host: TEST_HOST, port: TEST_PORT });

  const clientSocketServer = new ClientSocketServer(app.server, clientStore);
  log(`gateway ready on http://${TEST_HOST}:${TEST_PORT}`);
  log("waiting for page client to connect and register actions...");

  const targetClientId = await waitForActions(clientStore, WAIT_TIMEOUT_MS);

  if (!targetClientId) {
    log("ERROR: timeout waiting for page client actions");
    clientSocketServer.shutdown();
    clientStore.shutdown();
    await app.close();
    process.exit(1);
  }

  log(`page client connected: ${targetClientId}`);
  const allActions = clientStore.getAllActions();
  log(`registered actions: ${allActions.map((a) => `${a.namespace}.${a.name}`).join(", ")}`);

  // === Test 1: Call create_node ===
  log("\n--- Test 1: create_node ---");
  const result1 = await clientSocketServer.executeAction(
    targetClientId,
    "canvas",
    "create_node",
    { type: "text", content: "Hello World" },
    { sessionId: "test-session", toolUseId: "tool-1", source: "mcp" }
  );

  assert(!result1.isError, "create_node should not return error");
  assert(
    result1.content[0]?.text?.startsWith("Created node:") === true,
    "create_node content should start with 'Created node:'"
  );
  assert(
    result1.structuredContent?.success === true,
    "create_node structuredContent.success should be true"
  );
  assert(
    result1.structuredContent?.type === "text",
    "create_node structuredContent.type should be 'text'"
  );

  // === Test 2: Call delete_node with valid nodeId ===
  log("\n--- Test 2: delete_node (valid) ---");
  const result2 = await clientSocketServer.executeAction(
    targetClientId,
    "canvas",
    "delete_node",
    { nodeId: "node_12345" },
    { sessionId: "test-session", toolUseId: "tool-2", source: "mcp" }
  );

  assert(!result2.isError, "delete_node should not return error");
  assert(
    result2.content[0]?.text === "Deleted node: node_12345",
    "delete_node content should confirm deletion"
  );
  assert(
    result2.structuredContent?.deleted === true,
    "delete_node structuredContent.deleted should be true"
  );

  // === Test 3: Call delete_node without nodeId (error case) ===
  log("\n--- Test 3: delete_node (missing nodeId) ---");
  const result3 = await clientSocketServer.executeAction(
    targetClientId,
    "canvas",
    "delete_node",
    {},
    { sessionId: "test-session", toolUseId: "tool-3", source: "mcp" }
  );

  assert(result3.isError === true, "delete_node without nodeId should return error");
  assert(
    result3.content[0]?.text === "Error: nodeId is required",
    "delete_node error message should mention nodeId"
  );

  // === Test 4: Call non-existent action on valid client ===
  log("\n--- Test 4: non-existent action ---");
  const result4 = await clientSocketServer.executeAction(
    targetClientId,
    "canvas",
    "non_existent",
    {},
    { sessionId: "test-session", toolUseId: "tool-4", source: "mcp" }
  );

  assert(result4.isError === true, "non-existent action should return error");
  assert(
    result4.content[0]?.text?.includes("not found") === true,
    "non-existent action error should mention 'not found'"
  );

  // === Test 5: Call action on non-existent client ===
  log("\n--- Test 5: non-existent client ---");
  const result5 = await clientSocketServer.executeAction(
    "client_nonexistent",
    "canvas",
    "create_node",
    { type: "text" },
    { sessionId: "test-session", toolUseId: "tool-5", source: "mcp" }
  );

  assert(result5.isError === true, "non-existent client should return error");
  assert(
    result5.content[0]?.text?.includes("not found") === true,
    "non-existent client error should mention 'not found'"
  );

  // === Summary ===
  log(`\n${"=".repeat(40)}`);
  log(`Results: ${passed} passed, ${failed} failed`);
  log(`${"=".repeat(40)}`);

  // Cleanup
  clientSocketServer.shutdown();
  clientStore.shutdown();
  await app.close();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  log(`FATAL: ${err.message}\n${err.stack}`);
  process.exit(1);
});
