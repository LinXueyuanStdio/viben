import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

vi.mock("@fastify/websocket", () => ({ default: vi.fn() }));

import { registerWebSocketRoutes } from "./ws";
import type { AppState } from "../state";

interface MockWebSocket {
  send: Mock;
  on: Mock;
  close: Mock;
}

function createMockSocket(): MockWebSocket {
  return { send: vi.fn(), on: vi.fn(), close: vi.fn() };
}

function createMockState() {
  return {
    events: {
      subscribe: vi.fn(() => () => {}),
      sessionMessage: vi.fn(),
    },
    deviceRegistry: {
      registerClient: vi.fn((info: any) => ({
        id: "generated-uuid",
        type: "client",
        name: info.name,
        gateway_id: "gw-local",
        platform: info.platform,
        status: "online",
        capabilities: info.capabilities ?? [],
        connected_at: "2026-04-14T00:00:00Z",
        last_seen: "2026-04-14T00:00:00Z",
      })),
      registerClientWithId: vi.fn((id: string, info: any) => ({
        id,
        type: "client",
        name: info.name,
        gateway_id: "gw-local",
        platform: info.platform,
        status: "online",
        capabilities: info.capabilities ?? [],
        connected_at: "2026-04-14T00:00:00Z",
        last_seen: "2026-04-14T00:00:00Z",
      })),
      unregisterClient: vi.fn(),
      getGatewayId: vi.fn(() => "gw-local"),
    },
  } as unknown as AppState;
}

describe("WS Register protocol", () => {
  let socket: MockWebSocket;
  let state: AppState;
  let messageHandler: (data: Buffer) => void;
  let closeHandler: () => void;

  beforeEach(() => {
    socket = createMockSocket();
    state = createMockState();

    // Capture the route handler
    const mockFastify = {
      hasDecorator: vi.fn(() => true),
      get: vi.fn((_path: string, _opts: any, handler: any) => {
        handler(socket);
      }),
    };
    registerWebSocketRoutes(mockFastify as any, state);

    // Extract message and close handlers
    for (const call of socket.on.mock.calls) {
      if (call[0] === "message") messageHandler = call[1];
      if (call[0] === "close") closeHandler = call[1];
    }
  });

  it("responds with Registered on Register (no device_id)", () => {
    messageHandler(Buffer.from(JSON.stringify({
      type: "Register",
      data: { name: "iPhone", platform: "mobile" },
    })));

    expect(state.deviceRegistry.registerClient).toHaveBeenCalledWith({
      name: "iPhone",
      platform: "mobile",
      capabilities: undefined,
    });

    const sent = JSON.parse(socket.send.mock.calls.at(-1)[0]);
    expect(sent.type).toBe("Registered");
    expect(sent.data.device_id).toBe("generated-uuid");
    expect(sent.data.gateway_id).toBe("gw-local");
  });

  it("uses registerClientWithId when device_id provided", () => {
    messageHandler(Buffer.from(JSON.stringify({
      type: "Register",
      data: { name: "iPhone", platform: "mobile", device_id: "existing-id" },
    })));

    expect(state.deviceRegistry.registerClientWithId).toHaveBeenCalledWith(
      "existing-id",
      { name: "iPhone", platform: "mobile", capabilities: undefined },
    );

    const sent = JSON.parse(socket.send.mock.calls.at(-1)[0]);
    expect(sent.type).toBe("Registered");
    expect(sent.data.device_id).toBe("existing-id");
  });

  it("unregisters device on WS close", () => {
    // First register
    messageHandler(Buffer.from(JSON.stringify({
      type: "Register",
      data: { name: "iPhone", platform: "mobile" },
    })));

    // Then close
    closeHandler();

    expect(state.deviceRegistry.unregisterClient).toHaveBeenCalledWith("generated-uuid");
  });

  it("does not unregister if never registered", () => {
    closeHandler();
    expect(state.deviceRegistry.unregisterClient).not.toHaveBeenCalled();
  });
});
