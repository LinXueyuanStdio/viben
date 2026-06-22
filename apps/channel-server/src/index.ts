import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  createBridgeEnvelope,
  isBridgePeerRole,
  parseBridgeEnvelope,
  type BridgeEnvelope,
  type BridgePeerRole
} from "./protocol.js";

interface BridgeClient {
  id: string;
  role: BridgePeerRole;
  bridgeSessionId: string;
  socket: WebSocket;
}

interface BridgeRoom {
  id: string;
  clients: Map<string, BridgeClient>;
}

const rooms = new Map<string, BridgeRoom>();
const port = Number(process.env.PORT ?? 17891);

function getRoom(bridgeSessionId: string): BridgeRoom {
  let room = rooms.get(bridgeSessionId);
  if (!room) {
    room = {
      id: bridgeSessionId,
      clients: new Map()
    };
    rooms.set(bridgeSessionId, room);
  }
  return room;
}

function sendJson(socket: WebSocket, envelope: BridgeEnvelope): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(envelope));
  }
}

function broadcastPresence(room: BridgeRoom): void {
  for (const client of room.clients.values()) {
    sendJson(
      client.socket,
      createBridgeEnvelope({
        type: "presence",
        bridge_session_id: room.id,
        source: "channel_server",
        target: client.role,
        payload: {
          role: client.role,
          client_id: client.id,
          connected: true,
          peer_count: room.clients.size
        }
      })
    );
  }
}

function routeEnvelope(room: BridgeRoom, sender: BridgeClient, envelope: BridgeEnvelope): void {
  const targetRole = envelope.target;
  for (const client of room.clients.values()) {
    if (client.id === sender.id) continue;
    if (targetRole && targetRole !== "channel_server" && client.role !== targetRole) continue;
    sendJson(client.socket, envelope);
  }
}

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }

  response.writeHead(404, { "content-type": "text/plain" });
  response.end("Not found");
});

const wss = new WebSocketServer({
  server,
  path: "/bridge"
});

wss.on("connection", (socket, request) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  const bridgeSessionId = url.searchParams.get("bridge_session_id")?.trim();
  const role = url.searchParams.get("role");
  const clientId = url.searchParams.get("client_id")?.trim() || crypto.randomUUID();

  if (!bridgeSessionId || !isBridgePeerRole(role)) {
    socket.close(1008, "bridge_session_id and valid role are required");
    return;
  }

  const room = getRoom(bridgeSessionId);
  const client: BridgeClient = {
    id: clientId,
    role,
    bridgeSessionId,
    socket
  };
  room.clients.set(client.id, client);

  sendJson(
    socket,
    createBridgeEnvelope({
      type: "hello",
      bridge_session_id: bridgeSessionId,
      source: "channel_server",
      target: role,
      payload: {
        role,
        client_id: client.id
      }
    })
  );
  broadcastPresence(room);

  socket.on("message", (data) => {
    try {
      const envelope = parseBridgeEnvelope(String(data));
      if (envelope.bridge_session_id !== client.bridgeSessionId) {
        throw new Error("Bridge session mismatch");
      }
      routeEnvelope(room, client, envelope);
    } catch (error) {
      sendJson(
        socket,
        createBridgeEnvelope({
          type: "action_error",
          bridge_session_id: client.bridgeSessionId,
          source: "channel_server",
          target: client.role,
          payload: {
            invocation_id: "server",
            action_id: "bridge.message",
            error: {
              code: "invalid_message",
              message: error instanceof Error ? error.message : "Invalid bridge message"
            }
          }
        })
      );
    }
  });

  socket.on("close", () => {
    room.clients.delete(client.id);
    if (room.clients.size === 0) {
      rooms.delete(room.id);
      return;
    }
    broadcastPresence(room);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[channel-server] listening on ws://127.0.0.1:${port}/bridge`);
});
