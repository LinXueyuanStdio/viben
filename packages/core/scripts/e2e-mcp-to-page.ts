#!/usr/bin/env tsx
/**
 * E2E Test: MCP Client → Gateway MCP Endpoint → Page Client
 *
 * Tests the full path:
 *   MCP Client (SDK) → POST /api/mcp-server/gui-action → GUI_execute tool
 *     → clientStoreExecutor → ClientSocketServer.executeAction
 *     → Socket.io emit → Page Client → action:result → MCP response
 *
 * Usage: tsx scripts/e2e-mcp-to-page.ts
 * Expects: e2e-page-client.ts to connect within 15 seconds
 */
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ClientSocketServer } from "../src/gateway/client-socket-server";
import { ClientStore } from "../src/gateway/client-store";
import { registerGuiActionMcpServerRoutes } from "../src/gateway/routes/mcp-server/gui-action-mcp-server";
import type { AppState } from "../src/gateway/state";

const TEST_PORT = 18791;
const TEST_HOST = "127.0.0.1";
const WAIT_TIMEOUT_MS = 15000;
const POLL_INTERVAL_MS = 200;

let passed = 0;
let failed = 0;

function log(msg: string) {
  console.log(`[mcp-client] ${msg}`);
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

async function waitForActions(clientStore: ClientStore, minCount: number, timeout: number): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const actions = clientStore.getAllActions();
    if (actions.length >= minCount) {
      return actions[0].clientId;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return null;
}

async function main() {
  log("starting minimal gateway with MCP routes...");

  const app = Fastify({ logger: false });
  await app.register(fastifyCors, { origin: true });

  const clientStore = new ClientStore();
  app.get("/health", async () => ({ status: "ok" }));

  // State object with clientSocketServer populated in onReady hook
  const fakeState = { clientStore, clientSocketServer: undefined as ClientSocketServer | undefined } as unknown as AppState;

  // Register MCP routes BEFORE listen (Fastify requires this)
  registerGuiActionMcpServerRoutes(app, fakeState);

  let clientSocketServer: ClientSocketServer;
  app.addHook("onReady", async () => {
    clientSocketServer = new ClientSocketServer(app.server, clientStore);
    (fakeState as unknown as { clientSocketServer: ClientSocketServer }).clientSocketServer = clientSocketServer;
  });

  await app.listen({ host: TEST_HOST, port: TEST_PORT });
  log(`gateway ready on http://${TEST_HOST}:${TEST_PORT}`);
  log("waiting for page client to connect and register actions...");

  const pageClientId = await waitForActions(clientStore, 2, WAIT_TIMEOUT_MS);

  if (!pageClientId) {
    log("ERROR: timeout waiting for page client actions");
    clientSocketServer.shutdown();
    clientStore.shutdown();
    await app.close();
    process.exit(1);
  }

  log(`page client connected: ${pageClientId}`);
  const allActions = clientStore.getAllActions();
  log(`registered actions: ${allActions.map((a) => `${a.namespace}.${a.name}`).join(", ")}`);

  // Connect MCP client to the GUI action endpoint
  const mcpUrl = `http://${TEST_HOST}:${TEST_PORT}/api/mcp-server/gui-action?session_id=e2e-test`;
  log(`\nconnecting MCP client to ${mcpUrl}`);

  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
  const mcpClient = new Client({ name: "e2e-mcp-test", version: "1.0.0" });
  await mcpClient.connect(transport);
  log("MCP session established");

  // List tools to verify GUI_execute is available
  const tools = await mcpClient.listTools();
  log(`tools: ${tools.tools.map((t) => t.name).join(", ")}`);
  assert(
    tools.tools.some((t) => t.name === "GUI_execute"),
    "GUI_execute tool should be available"
  );
  assert(
    tools.tools.some((t) => t.name === "ClientSideBash"),
    "ClientSideBash tool should be available"
  );

  // === Test 1: create_node via MCP (3-part cross-client addressing) ===
  log("\n--- Test 1: GUI_execute → create_node ---");
  const r1 = await mcpClient.callTool({
    name: "GUI_execute",
    arguments: {
      action: `${pageClientId}.canvas.create_node`,
      payload: { type: "image", content: "photo.png" },
    },
  });
  const t1 = (r1.content as Array<{ type: string; text?: string }>)[0]?.text ?? "";
  log(`result: ${t1}`);
  assert(!r1.isError, "create_node via MCP should succeed");
  assert(t1.startsWith("Created node:"), "response should start with 'Created node:'");

  // === Test 2: delete_node with valid nodeId ===
  log("\n--- Test 2: GUI_execute → delete_node (valid) ---");
  const r2 = await mcpClient.callTool({
    name: "GUI_execute",
    arguments: {
      action: `${pageClientId}.canvas.delete_node`,
      payload: { nodeId: "node_mcp_test_99" },
    },
  });
  const t2 = (r2.content as Array<{ type: string; text?: string }>)[0]?.text ?? "";
  log(`result: ${t2}`);
  assert(!r2.isError, "delete_node via MCP should succeed");
  assert(t2 === "Deleted node: node_mcp_test_99", "should confirm deletion with correct nodeId");

  // === Test 3: delete_node without nodeId (page client returns error) ===
  log("\n--- Test 3: GUI_execute → delete_node (error path) ---");
  const r3 = await mcpClient.callTool({
    name: "GUI_execute",
    arguments: {
      action: `${pageClientId}.canvas.delete_node`,
      payload: {},
    },
  });
  const t3 = (r3.content as Array<{ type: string; text?: string }>)[0]?.text ?? "";
  log(`result: ${t3}`);
  assert(r3.isError === true, "delete_node without nodeId should return isError");
  assert(t3 === "Error: nodeId is required", "error message should match page client response");

  // === Test 4: non-existent action ===
  log("\n--- Test 4: GUI_execute → non-existent action ---");
  const r4 = await mcpClient.callTool({
    name: "GUI_execute",
    arguments: {
      action: `${pageClientId}.canvas.does_not_exist`,
      payload: {},
    },
  });
  const t4 = (r4.content as Array<{ type: string; text?: string }>)[0]?.text ?? "";
  log(`result: ${t4}`);
  assert(r4.isError === true, "non-existent action should return isError");
  assert(t4.includes("not found"), "error should mention 'not found'");

  // === Test 5: non-existent client ===
  log("\n--- Test 5: GUI_execute → non-existent client ---");
  const r5 = await mcpClient.callTool({
    name: "GUI_execute",
    arguments: {
      action: "client_fake_000000.canvas.create_node",
      payload: { type: "text" },
    },
  });
  const t5 = (r5.content as Array<{ type: string; text?: string }>)[0]?.text ?? "";
  log(`result: ${t5}`);
  assert(r5.isError === true, "non-existent client should return isError");
  assert(t5.includes("not found"), "error should mention 'not found'");

  // === Test 6: invalid action format (1-part) ===
  log("\n--- Test 6: GUI_execute → invalid action format ---");
  const r6 = await mcpClient.callTool({
    name: "GUI_execute",
    arguments: {
      action: "single_part_action",
      payload: {},
    },
  });
  const t6 = (r6.content as Array<{ type: string; text?: string }>)[0]?.text ?? "";
  log(`result: ${t6}`);
  assert(r6.isError === true, "invalid action format should return isError");
  assert(t6.includes("Invalid action format"), "error should mention format issue");

  // === Summary ===
  log(`\n${"=".repeat(40)}`);
  log(`Results: ${passed} passed, ${failed} failed`);
  log(`${"=".repeat(40)}`);

  // Cleanup
  try { await mcpClient.close(); } catch {}
  (fakeState as unknown as { clientSocketServer?: ClientSocketServer }).clientSocketServer?.shutdown();
  clientStore.shutdown();
  await app.close();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  log(`FATAL: ${err.message}\n${err.stack}`);
  process.exit(1);
});
