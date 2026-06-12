#!/usr/bin/env tsx
/**
 * E2E Test: Fake Page Client
 *
 * Simulates a page iframe connecting to Gateway via Socket.io,
 * registering actions, and handling execution requests.
 *
 * Usage: tsx scripts/e2e-page-client.ts [gateway-url]
 * Default gateway: http://127.0.0.1:18791
 */
import { io, type Socket } from "socket.io-client";
import { generateKeyPair, sign } from "../src/utils/crypto";

const GATEWAY_URL = process.argv[2] || process.env.GATEWAY_URL || "http://127.0.0.1:18791";
const PAGE_UID = "0612-e2e-page";

const { publicKey, privateKey } = generateKeyPair();
const clientId = `client_page_${publicKey.slice(0, 12)}`;

function log(msg: string) {
  console.log(`[page-client] ${msg}`);
}

log(`clientId: ${clientId}`);
log(`connecting to ${GATEWAY_URL}...`);

const socket: Socket = io(GATEWAY_URL, {
  path: "/socket.io/client",
  transports: ["websocket"],
  reconnection: false,
});

socket.on("connect", async () => {
  log("socket connected, sending client:connect...");

  const timestamp = Date.now();
  const message = `${clientId}:${timestamp}`;
  const signature = await sign(message, privateKey);

  socket.emit(
    "client:connect",
    {
      clientId,
      source: "page_iframe",
      pageUid: PAGE_UID,
      publicKey,
      signature,
      timestamp,
    },
    (ack: { success: boolean; error?: string }) => {
      if (!ack.success) {
        log(`ERROR: client:connect failed: ${ack.error}`);
        process.exit(1);
      }
      log("authenticated successfully");
      registerActions();
    }
  );
});

socket.on("client:init", (data) => {
  log(`received client:init: theme=${data.theme}`);
});

socket.on("disconnect", () => {
  log("disconnected");
});

socket.on("connect_error", (err) => {
  log(`connect_error: ${err.message}`);
  process.exit(1);
});

function registerActions() {
  const actions = {
    create_node: {
      description: "Create a node on the canvas",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["text", "image", "shape"] },
          content: { type: "string" },
        },
        required: ["type"],
      },
    },
    delete_node: {
      description: "Delete a node from the canvas",
      inputSchema: {
        type: "object",
        properties: {
          nodeId: { type: "string" },
        },
        required: ["nodeId"],
      },
    },
  };

  socket.emit("action:register", { namespace: "canvas", actions });
  log("actions registered: canvas.create_node, canvas.delete_node");

  // Write clientId to stdout for the test script to capture
  console.log(`CLIENT_ID=${clientId}`);
}

// Handle action execution requests from Gateway
socket.on(
  "action:execute",
  (data: {
    requestId: string;
    namespace: string;
    action: string;
    payload: unknown;
    context: { sessionId: string; toolUseId: string; source: string };
  }) => {
    log(`execute: ${data.namespace}.${data.action} (requestId=${data.requestId})`);

    const payload = data.payload as Record<string, unknown>;
    let result: {
      content: Array<{ type: string; text: string }>;
      structuredContent?: Record<string, unknown>;
      isError?: boolean;
    };

    if (data.namespace === "canvas" && data.action === "create_node") {
      const nodeId = `node_${Date.now()}`;
      result = {
        content: [{ type: "text", text: `Created node: ${nodeId}` }],
        structuredContent: {
          nodeId,
          type: payload.type ?? "text",
          content: payload.content ?? "",
          success: true,
        },
      };
      log(`  -> created node ${nodeId}`);
    } else if (data.namespace === "canvas" && data.action === "delete_node") {
      if (!payload.nodeId) {
        result = {
          content: [{ type: "text", text: "Error: nodeId is required" }],
          isError: true,
        };
        log("  -> error: missing nodeId");
      } else {
        result = {
          content: [{ type: "text", text: `Deleted node: ${payload.nodeId}` }],
          structuredContent: { nodeId: payload.nodeId, deleted: true },
        };
        log(`  -> deleted node ${payload.nodeId}`);
      }
    } else {
      result = {
        content: [{ type: "text", text: `Unknown action: ${data.namespace}.${data.action}` }],
        isError: true,
      };
      log(`  -> unknown action`);
    }

    socket.emit("action:result", { requestId: data.requestId, result });
  }
);

// Graceful shutdown
process.on("SIGTERM", () => {
  log("received SIGTERM, disconnecting...");
  socket.disconnect();
  process.exit(0);
});

process.on("SIGINT", () => {
  log("received SIGINT, disconnecting...");
  socket.disconnect();
  process.exit(0);
});
