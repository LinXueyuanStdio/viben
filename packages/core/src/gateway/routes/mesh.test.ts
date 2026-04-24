/**
 * Mesh Routes Tests
 *
 * Tests for:
 * - WebSocket peer-to-peer gateway connections (GET /api/mesh/ws)
 * - REST peer listing (GET /api/mesh/peers)
 * - REST peer connect (POST /api/mesh/connect)
 * - Handshake protocol (Hello message requirement)
 * - Error handling (missing mesh service, plugin unavailable)
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import type { FastifyInstance } from "fastify";

vi.mock("@fastify/websocket", () => ({ default: vi.fn() }));

import { registerMeshRoutes } from "./mesh";
import type { AppState } from "../state";

interface MockSocket {
  send: Mock;
  on: Mock;
  close: Mock;
  removeListener: Mock;
}

function createMockSocket(): MockSocket {
  return { send: vi.fn(), on: vi.fn(), close: vi.fn(), removeListener: vi.fn() };
}

function createMockMeshService() {
  return {
    getLocalInfo: vi.fn(() => ({
      gateway_id: "local-gw",
      name: "Local",
      version: "1.0.0",
      capabilities: [],
      address: "http://127.0.0.1:18790",
    })),
    acceptPeer: vi.fn(),
    connectToPeer: vi.fn(),
    getPeers: vi.fn(() => []),
    sendDeviceMessage: vi.fn(() => true),
    trackPendingMessage: vi.fn(async () => ({ status: "ok" })),
    shutdown: vi.fn(),
  };
}

function createMockState(mesh = createMockMeshService()) {
  return {
    events: { subscribe: vi.fn(() => () => {}), broadcast: vi.fn() },
    mesh,
    deviceRegistry: {
      getAllDevices: vi.fn(() => []),
      getDevice: vi.fn(),
    },
  } as unknown as AppState;
}

function createMockFastify() {
  const routes: Array<{ method: string; path: string; options?: any; handler: any }> = [];
  return {
    get: vi.fn((path: string, ...args: any[]) => {
      const handler = args[args.length - 1];
      const options = args.length > 1 ? args[0] : {};
      routes.push({ method: "GET", path, options, handler });
    }),
    post: vi.fn((path: string, handler: any) => {
      routes.push({ method: "POST", path, handler });
    }),
    hasDecorator: vi.fn((name: string) => name === "websocketServer"),
    _routes: routes,
  } as unknown as FastifyInstance & { _routes: typeof routes };
}

describe("Mesh Routes", () => {
  let mockFastify: ReturnType<typeof createMockFastify>;
  let mockState: ReturnType<typeof createMockState>;

  beforeEach(() => {
    mockFastify = createMockFastify();
    mockState = createMockState();
    registerMeshRoutes(mockFastify, mockState);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Route Registration
  // ============================================================================

  describe("Route registration", () => {
    it("should register /api/mesh/ws as websocket route", () => {
      const wsRoute = mockFastify._routes.find((r) => r.path === "/api/mesh/ws");
      expect(wsRoute).toBeDefined();
      expect(wsRoute!.options.websocket).toBe(true);
    });

    it("should register GET /api/mesh/peers", () => {
      const route = mockFastify._routes.find(
        (r) => r.path === "/api/mesh/peers" && r.method === "GET",
      );
      expect(route).toBeDefined();
    });

    it("should register POST /api/mesh/connect", () => {
      const route = mockFastify._routes.find(
        (r) => r.path === "/api/mesh/connect" && r.method === "POST",
      );
      expect(route).toBeDefined();
    });

    it("should not register routes when websocket decorator is missing", () => {
      const noWsFastify = {
        hasDecorator: vi.fn(() => false),
        get: vi.fn(),
        post: vi.fn(),
      } as unknown as FastifyInstance;

      registerMeshRoutes(noWsFastify, mockState);

      expect(noWsFastify.get).not.toHaveBeenCalled();
      expect(noWsFastify.post).not.toHaveBeenCalled();
    });

    it("should not register routes when mesh service is not available", () => {
      const stateNoMesh = {
        events: { subscribe: vi.fn(() => () => {}), broadcast: vi.fn() },
      } as unknown as AppState;

      const freshFastify = createMockFastify();
      registerMeshRoutes(freshFastify, stateNoMesh);

      expect(freshFastify._routes).toHaveLength(0);
    });
  });

  // ============================================================================
  // WebSocket Handshake
  // ============================================================================

  describe("/api/mesh/ws handler", () => {
    it("should reject connection without Hello message", () => {
      const wsRoute = mockFastify._routes.find((r) => r.path === "/api/mesh/ws");
      const mockSocket = createMockSocket();
      wsRoute!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find(
        (c: any) => c[0] === "message",
      )?.[1];
      messageHandler(Buffer.from(JSON.stringify({ type: "Ping" })));

      expect(mockSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"Error"'),
      );
    });

    it("should accept peer on valid Hello", () => {
      const wsRoute = mockFastify._routes.find((r) => r.path === "/api/mesh/ws");
      const mockSocket = createMockSocket();
      wsRoute!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find(
        (c: any) => c[0] === "message",
      )?.[1];
      const hello = {
        type: "Hello",
        data: {
          gateway_id: "remote-gw",
          name: "Remote",
          version: "1.0.0",
          capabilities: [],
          address: "http://remote:18790",
        },
      };
      messageHandler(Buffer.from(JSON.stringify(hello)));

      expect((mockState as any).mesh.acceptPeer).toHaveBeenCalled();
    });

    it("should send error containing 'expected_hello' for non-Hello first message", () => {
      const wsRoute = mockFastify._routes.find((r) => r.path === "/api/mesh/ws");
      const mockSocket = createMockSocket();
      wsRoute!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find(
        (c: any) => c[0] === "message",
      )?.[1];
      messageHandler(Buffer.from(JSON.stringify({ type: "Ping" })));

      const sentMsg = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMsg.type).toBe("Error");
      expect(sentMsg.data.error).toBe("expected_hello");
    });

    it("should send parse_error for invalid JSON", () => {
      const wsRoute = mockFastify._routes.find((r) => r.path === "/api/mesh/ws");
      const mockSocket = createMockSocket();
      wsRoute!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find(
        (c: any) => c[0] === "message",
      )?.[1];
      messageHandler(Buffer.from("not valid json"));

      const sentMsg = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMsg.type).toBe("Error");
      expect(sentMsg.data.error).toBe("parse_error");
    });

    it("should register message, close, and error handlers on socket", () => {
      const wsRoute = mockFastify._routes.find((r) => r.path === "/api/mesh/ws");
      const mockSocket = createMockSocket();
      wsRoute!.handler(mockSocket);

      expect(mockSocket.on).toHaveBeenCalledWith("message", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("close", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("should pass the socket and peer info to acceptPeer", () => {
      const wsRoute = mockFastify._routes.find((r) => r.path === "/api/mesh/ws");
      const mockSocket = createMockSocket();
      wsRoute!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find(
        (c: any) => c[0] === "message",
      )?.[1];
      const peerInfo = {
        gateway_id: "remote-gw",
        name: "Remote",
        version: "1.0.0",
        capabilities: ["screen"],
        address: "http://remote:18790",
      };
      const hello = { type: "Hello", data: peerInfo };
      messageHandler(Buffer.from(JSON.stringify(hello)));

      expect((mockState as any).mesh.acceptPeer).toHaveBeenCalledWith(
        mockSocket,
        peerInfo,
      );
    });
  });

  // ============================================================================
  // REST: GET /api/mesh/peers
  // ============================================================================

  describe("GET /api/mesh/peers", () => {
    it("should return peers from mesh service", async () => {
      const peerList = [
        {
          gateway_id: "peer-1",
          name: "Peer 1",
          version: "1.0.0",
          capabilities: [],
          address: "http://peer1:18790",
        },
      ];
      (mockState as any).mesh.getPeers.mockReturnValue(peerList);

      const route = mockFastify._routes.find(
        (r) => r.path === "/api/mesh/peers" && r.method === "GET",
      );

      const mockReply = { send: vi.fn() };
      await route!.handler({} as any, mockReply as any);

      expect(mockReply.send).toHaveBeenCalledWith({ peers: peerList });
    });

    it("should return empty array when no peers", async () => {
      const route = mockFastify._routes.find(
        (r) => r.path === "/api/mesh/peers" && r.method === "GET",
      );

      const mockReply = { send: vi.fn() };
      await route!.handler({} as any, mockReply as any);

      expect(mockReply.send).toHaveBeenCalledWith({ peers: [] });
    });
  });

  // ============================================================================
  // REST: POST /api/mesh/connect
  // ============================================================================

  describe("POST /api/mesh/connect", () => {
    it("should call connectToPeer with the provided address", async () => {
      const route = mockFastify._routes.find(
        (r) => r.path === "/api/mesh/connect" && r.method === "POST",
      );

      const mockReq = { body: { address: "http://remote:18790" } };
      const mockReply = { send: vi.fn(), status: vi.fn().mockReturnThis() };
      await route!.handler(mockReq as any, mockReply as any);

      expect((mockState as any).mesh.connectToPeer).toHaveBeenCalledWith(
        "http://remote:18790",
      );
      expect(mockReply.send).toHaveBeenCalledWith({ status: "connecting" });
    });

    it("should return 400 when address is missing", async () => {
      const route = mockFastify._routes.find(
        (r) => r.path === "/api/mesh/connect" && r.method === "POST",
      );

      const mockReq = { body: {} };
      const mockReply = { send: vi.fn(), status: vi.fn().mockReturnThis() };
      await route!.handler(mockReq as any, mockReply as any);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({ error: "address is required" });
    });
  });
});
