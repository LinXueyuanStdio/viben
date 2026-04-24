/**
 * Device Routes Tests
 *
 * Tests for:
 * - GET /api/devices - list all devices
 * - GET /api/devices/:id - get device by ID
 * - GET /api/devices/qr - get QR code for mobile pairing
 * - POST /api/devices/message - send cross-device message
 * - Error handling (404, 400, 502, 503)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { registerDeviceRoutes } from "./devices";
import type { AppState } from "../state";
import type { Device } from "../../devices/types";

const mockDevice: Device = {
  id: "d1",
  type: "client",
  name: "Phone",
  gateway_id: "gw-1",
  platform: "mobile",
  status: "online",
  capabilities: ["navigate"],
  connected_at: "2026-04-11T00:00:00Z",
  last_seen: "2026-04-11T00:00:00Z",
};

function createMockState() {
  return {
    deviceRegistry: {
      getAllDevices: vi.fn(() => [mockDevice]),
      getDevice: vi.fn((id: string) => (id === "d1" ? mockDevice : undefined)),
      getGatewayId: vi.fn(() => "local-gw"),
    },
    mesh: {
      getLocalInfo: vi.fn(() => ({
        gateway_id: "local-gw",
        name: "Local",
        version: "1.0.0",
        capabilities: [],
        address: "http://127.0.0.1:18790",
      })),
      sendDeviceMessage: vi.fn(() => true),
      trackPendingMessage: vi.fn(async () => ({ status: "ok" })),
    },
    discovery: {
      getQrDataUrl: vi.fn(async () => "data:image/png;base64,abc"),
      getQrPayload: vi.fn(() => ({
        type: "viben-gateway",
        gateway_id: "local-gw",
        name: "Local",
        lan: "http://192.168.1.1:18790",
      })),
    },
  } as unknown as AppState;
}

function createMockFastify() {
  const routes: Array<{ method: string; path: string; handler: any }> = [];
  return {
    get: vi.fn((path: string, handler: any) =>
      routes.push({ method: "GET", path, handler }),
    ),
    post: vi.fn((path: string, handler: any) =>
      routes.push({ method: "POST", path, handler }),
    ),
    _routes: routes,
  } as unknown as FastifyInstance & { _routes: typeof routes };
}

function mockReply() {
  const reply = { send: vi.fn(), status: vi.fn() } as any;
  reply.status.mockReturnValue(reply);
  return reply as FastifyReply;
}

describe("Device Routes", () => {
  let fastify: ReturnType<typeof createMockFastify>;
  let state: ReturnType<typeof createMockState>;

  beforeEach(() => {
    fastify = createMockFastify();
    state = createMockState();
    registerDeviceRoutes(fastify, state);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // GET /api/devices
  // ============================================================================

  it("GET /api/devices returns all devices", async () => {
    const route = fastify._routes.find((r) => r.path === "/api/devices");
    const reply = mockReply();
    await route!.handler({} as any, reply);
    expect(reply.send).toHaveBeenCalledWith({ devices: [mockDevice] });
  });

  // ============================================================================
  // GET /api/devices/:id
  // ============================================================================

  it("GET /api/devices/:id returns device", async () => {
    const route = fastify._routes.find((r) => r.path === "/api/devices/:id");
    const reply = mockReply();
    await route!.handler({ params: { id: "d1" } } as any, reply);
    expect(reply.send).toHaveBeenCalledWith(mockDevice);
  });

  it("GET /api/devices/:id returns 404 for unknown", async () => {
    const route = fastify._routes.find((r) => r.path === "/api/devices/:id");
    const reply = mockReply();
    await route!.handler({ params: { id: "nope" } } as any, reply);
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  // ============================================================================
  // GET /api/devices/qr
  // ============================================================================

  it("GET /api/devices/qr returns QR data", async () => {
    const route = fastify._routes.find((r) => r.path === "/api/devices/qr");
    const reply = mockReply();
    await route!.handler({} as any, reply);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ qr_data_url: "data:image/png;base64,abc" }),
    );
  });

  it("GET /api/devices/qr returns 503 when discovery is not available", async () => {
    const stateNoDiscovery = {
      ...state,
      discovery: undefined,
    } as unknown as AppState;
    const freshFastify = createMockFastify();
    registerDeviceRoutes(freshFastify, stateNoDiscovery);

    const route = freshFastify._routes.find(
      (r) => r.path === "/api/devices/qr",
    );
    const reply = mockReply();
    await route!.handler({} as any, reply);
    expect(reply.status).toHaveBeenCalledWith(503);
  });

  // ============================================================================
  // POST /api/devices/message
  // ============================================================================

  it("POST /api/devices/message sends and returns message_id", async () => {
    const route = fastify._routes.find(
      (r) => r.path === "/api/devices/message",
    );
    const reply = mockReply();
    await route!.handler(
      {
        body: { to_gateway: "remote-gw", action: "ping", payload: {} },
      } as any,
      reply,
    );
    expect(state.mesh.sendDeviceMessage).toHaveBeenCalled();
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent" }),
    );
  });

  it("POST /api/devices/message returns 400 when to_gateway is missing", async () => {
    const route = fastify._routes.find(
      (r) => r.path === "/api/devices/message",
    );
    const reply = mockReply();
    await route!.handler(
      {
        body: { action: "ping" },
      } as any,
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(400);
  });

  it("POST /api/devices/message returns 400 when action is missing", async () => {
    const route = fastify._routes.find(
      (r) => r.path === "/api/devices/message",
    );
    const reply = mockReply();
    await route!.handler(
      {
        body: { to_gateway: "remote-gw" },
      } as any,
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(400);
  });

  it("POST /api/devices/message returns 502 when peer is offline", async () => {
    (state.mesh.sendDeviceMessage as any).mockReturnValue(false);
    const route = fastify._routes.find(
      (r) => r.path === "/api/devices/message",
    );
    const reply = mockReply();
    await route!.handler(
      {
        body: { to_gateway: "remote-gw", action: "ping", payload: {} },
      } as any,
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(502);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: "peer_offline" }),
    );
  });
});
