/**
 * Device REST routes
 *
 * Provides:
 * - GET /api/devices - list all registered devices
 * - GET /api/devices/qr - get QR code data for mobile pairing
 * - GET /api/devices/:id - get a specific device by ID
 * - POST /api/devices/message - send a cross-device message via mesh
 *
 * Note: /api/devices/qr is registered BEFORE /api/devices/:id
 * to avoid Fastify treating "qr" as a path parameter.
 */
import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { AppState } from "../state";

export function registerDeviceRoutes(fastify: FastifyInstance, state: AppState): void {
  const registry = (state as any).deviceRegistry;
  const mesh = (state as any).mesh;
  const discovery = (state as any).discovery;

  // --- QR code for mobile pairing (must be registered before :id) ---
  fastify.get("/api/devices/qr", async (_req: FastifyRequest, reply: FastifyReply) => {
    if (!discovery) {
      return reply.status(503).send({ error: "discovery not available" });
    }
    const qr_data_url = await discovery.getQrDataUrl();
    const payload = discovery.getQrPayload();
    return reply.send({ qr_data_url, payload });
  });

  // --- List all devices ---
  fastify.get("/api/devices", async (_req: FastifyRequest, reply: FastifyReply) => {
    const devices = registry.getAllDevices();
    return reply.send({ devices });
  });

  // --- Get device by ID ---
  fastify.get("/api/devices/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const device = registry.getDevice(id);
    if (!device) {
      return reply.status(404).send({ error: "device not found" });
    }
    return reply.send(device);
  });

  // --- Send cross-device message ---
  fastify.post("/api/devices/message", async (req: FastifyRequest, reply: FastifyReply) => {
    const { to_gateway, to_device, action, payload } = req.body as {
      to_gateway: string;
      to_device?: string;
      action: string;
      payload: unknown;
    };

    if (!to_gateway || !action) {
      return reply.status(400).send({ error: "to_gateway and action are required" });
    }

    const message_id = randomUUID();
    const msg = {
      id: message_id,
      from_gateway: registry.getGatewayId(),
      to_gateway,
      to_device,
      action,
      payload: payload ?? {},
    };

    const sent = mesh.sendDeviceMessage(msg);
    if (!sent) {
      return reply.status(502).send({ error: "peer_offline", message_id });
    }

    return reply.send({ message_id, status: "sent" });
  });
}
