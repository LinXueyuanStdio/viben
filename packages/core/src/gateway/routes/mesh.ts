/**
 * Mesh WebSocket and REST routes
 *
 * Provides:
 * - WebSocket endpoint for peer-to-peer gateway connections (GET /api/mesh/ws)
 * - REST endpoint to list connected peers (GET /api/mesh/peers)
 * - REST endpoint to initiate connection to a remote peer (POST /api/mesh/connect)
 *
 * The WebSocket handshake requires the connecting peer to send a Hello message
 * as its first message. Non-Hello messages before handshake are rejected.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { AppState } from "../state";
import type { MeshMessage } from "../../mesh/types";

export function registerMeshRoutes(fastify: FastifyInstance, state: AppState): void {
  if (!fastify.hasDecorator("websocketServer")) return;

  const mesh = state.mesh;
  if (!mesh) return;

  // --- WebSocket: peer-to-peer gateway connections ---
  fastify.get("/api/mesh/ws", { websocket: true }, (socket: any) => {
    let authenticated = false;

    const timeout = setTimeout(() => {
      if (!authenticated) {
        socket.send(JSON.stringify({ type: "Error", data: { error: "handshake_timeout" } }));
        socket.close(4000, "handshake_timeout");
      }
    }, 10000);

    socket.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as MeshMessage;

        if (!authenticated) {
          if (msg.type !== "Hello") {
            socket.send(JSON.stringify({ type: "Error", data: { error: "expected_hello" } }));
            return;
          }
          clearTimeout(timeout);
          authenticated = true;
          mesh.acceptPeer(socket, msg.data);
          return;
        }

        // Post-handshake messages are handled by MeshService via PeerConnection
      } catch {
        socket.send(JSON.stringify({ type: "Error", data: { error: "parse_error" } }));
      }
    });

    socket.on("close", () => clearTimeout(timeout));
    socket.on("error", () => clearTimeout(timeout));
  });

  // --- REST: list peers ---
  fastify.get("/api/mesh/peers", async (_req: FastifyRequest, reply: FastifyReply) => {
    const peers = mesh.getPeers();
    return reply.send({ peers });
  });

  // --- REST: connect to a peer ---
  fastify.post("/api/mesh/connect", async (req: FastifyRequest, reply: FastifyReply) => {
    const { address } = req.body as { address: string };
    if (!address) {
      return reply.status(400).send({ error: "address is required" });
    }
    mesh.connectToPeer(address);
    return reply.send({ status: "connecting" });
  });
}
