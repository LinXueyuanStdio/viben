/**
 * Test script for browse-mcp-proxy
 *
 * This script tests the proxy server by:
 * 1. Starting the browse-mcp server (HTTP mode)
 * 2. Starting the proxy server
 * 3. Connecting to browse-mcp through the proxy using MCP SDK
 *
 * Usage:
 *   npx tsx test-proxy.ts
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { spawn, ChildProcess } from "child_process";

// Configuration
const BROWSE_MCP_PORT = 8765;
const PROXY_PORT = 6279;
const BROWSE_MCP_URL = `http://127.0.0.1:${BROWSE_MCP_PORT}/mcp`;
const PROXY_URL = `http://127.0.0.1:${PROXY_PORT}/mcp`;

let browseMcpProcess: ChildProcess | null = null;
let proxyProcess: ChildProcess | null = null;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startBrowseMcp(): Promise<void> {
  console.log("🚀 Starting browse-mcp server...");

  browseMcpProcess = spawn("python", [
    "-m", "browse_mcp",
    "--transport", "streamable-http",
    "--host", "127.0.0.1",
    "--port", String(BROWSE_MCP_PORT),
    "--stateless"  // Important: stateless mode for browser clients
  ], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  browseMcpProcess.stdout?.on("data", (data) => {
    console.log(`[browse-mcp] ${data.toString().trim()}`);
  });

  browseMcpProcess.stderr?.on("data", (data) => {
    console.log(`[browse-mcp:err] ${data.toString().trim()}`);
  });

  // Wait for server to start (browse-mcp takes a while to load plugins)
  await sleep(5000);
  console.log(`✅ browse-mcp server started on port ${BROWSE_MCP_PORT}`);
}

async function startProxy(): Promise<string> {
  console.log("🚀 Starting proxy server...");

  // Generate auth token - use fixed token for testing
  const authToken = "test-auth-token-12345";

  proxyProcess = spawn("python", [
    "-m", "browse_mcp_proxy",
    "serve",
    "--host", "127.0.0.1",
    "--port", String(PROXY_PORT),
    "--auth-token", authToken,
    "--log-level", "debug"
  ], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  proxyProcess.stdout?.on("data", (data) => {
    console.log(`[proxy] ${data.toString().trim()}`);
  });

  proxyProcess.stderr?.on("data", (data) => {
    console.log(`[proxy:err] ${data.toString().trim()}`);
  });

  // Wait for server to start
  await sleep(3000);
  console.log(`✅ Proxy server started on port ${PROXY_PORT}`);
  console.log(`   Auth token: ${authToken}`);

  return authToken;
}

async function testDirectConnection(): Promise<void> {
  console.log("\n📡 Test 1: Direct connection to browse-mcp (no proxy)...");

  const client = new Client({
    name: "test-client-direct",
    version: "1.0.0",
  }, {
    capabilities: {},
  });

  try {
    const transport = new StreamableHTTPClientTransport(new URL(BROWSE_MCP_URL), {
      requestInit: {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
        },
      },
    });

    await client.connect(transport);

    const capabilities = client.getServerCapabilities();
    console.log("✅ Direct connection successful!");
    console.log("   Server capabilities:", JSON.stringify(capabilities, null, 2));

    // List tools
    const tools = await client.listTools();
    console.log(`   Tools available: ${tools.tools.length}`);
    tools.tools.forEach((tool) => {
      console.log(`     - ${tool.name}`);
    });

    await client.close();
  } catch (error) {
    console.error("❌ Direct connection failed:", error);
  }
}

async function testProxyConnection(authToken: string): Promise<void> {
  console.log("\n📡 Test 2: Connection through proxy...");

  // Build proxy URL with target URL as query parameter
  const proxyUrlWithTarget = new URL(PROXY_URL);
  proxyUrlWithTarget.searchParams.set("url", BROWSE_MCP_URL);
  proxyUrlWithTarget.searchParams.set("transport_type", "streamable-http");

  console.log(`   Proxy URL: ${proxyUrlWithTarget.toString()}`);

  const client = new Client({
    name: "test-client-proxy",
    version: "1.0.0",
  }, {
    capabilities: {},
  });

  try {
    const transport = new StreamableHTTPClientTransport(proxyUrlWithTarget, {
      requestInit: {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          "X-MCP-Proxy-Auth": `Bearer ${authToken}`,
        },
      },
    });

    await client.connect(transport);

    const capabilities = client.getServerCapabilities();
    console.log("✅ Proxy connection successful!");
    console.log("   Server capabilities:", JSON.stringify(capabilities, null, 2));

    // List tools
    const tools = await client.listTools();
    console.log(`   Tools available: ${tools.tools.length}`);
    tools.tools.forEach((tool) => {
      console.log(`     - ${tool.name}`);
    });

    // Try calling a tool (browse_search)
    console.log("\n   Testing tool call: browse_search...");
    try {
      const result = await client.callTool({
        name: "browse_search",
        arguments: {
          query_list: [
            { searcher: "arxiv", query: "machine learning", max_results: 2 }
          ]
        }
      });
      console.log("   ✅ Tool call successful!");
      console.log("   Result preview:", JSON.stringify(result).substring(0, 200) + "...");
    } catch (toolError) {
      console.log("   ⚠️ Tool call failed (this might be expected):", toolError);
    }

    await client.close();
  } catch (error) {
    console.error("❌ Proxy connection failed:", error);
    throw error;
  }
}

async function cleanup(): Promise<void> {
  console.log("\n🧹 Cleaning up...");

  if (proxyProcess) {
    proxyProcess.kill();
    console.log("   Proxy server stopped");
  }

  if (browseMcpProcess) {
    browseMcpProcess.kill();
    console.log("   browse-mcp server stopped");
  }
}

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("MCP Proxy Test Script");
  console.log("=".repeat(60));

  try {
    // Start servers
    await startBrowseMcp();
    const authToken = await startProxy();

    // Run tests
    await testDirectConnection();
    await testProxyConnection(authToken);

    console.log("\n" + "=".repeat(60));
    console.log("✅ All tests completed!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ Test failed:", error);
  } finally {
    await cleanup();
  }
}

// Handle Ctrl+C
process.on("SIGINT", async () => {
  await cleanup();
  process.exit(0);
});

main();
