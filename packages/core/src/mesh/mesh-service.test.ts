import { describe, it, expect, beforeEach, vi } from "vitest";
import { MeshService } from "./mesh-service";
import type { EventService } from "../services/events";
import type { DeviceRegistryService } from "../devices/device-registry";
import type { PeerStore } from "./peer-store";
import type { DeviceMessageData } from "./types";

function createMockEvents(): EventService {
  return { broadcast: vi.fn() } as unknown as EventService;
}

function createMockRegistry(): DeviceRegistryService {
  return {
    getGatewayId: vi.fn(() => "local-gw"),
    registerPeer: vi.fn(
      (id: string, info: { name: string; capabilities?: string[] }) => ({
        id,
        type: "gateway",
        name: info.name,
        gateway_id: id,
        platform: "desktop",
        status: "online",
        capabilities: info.capabilities ?? [],
        connected_at: "",
        last_seen: "",
      }),
    ),
    unregisterPeer: vi.fn(),
    syncPeerDevices: vi.fn(),
    getLocalClients: vi.fn(() => []),
    getAllDevices: vi.fn(() => []),
  } as unknown as DeviceRegistryService;
}

function createMockPeerStore(): PeerStore {
  return {
    load: vi.fn(async () => []),
    upsert: vi.fn(),
    remove: vi.fn(),
  } as unknown as PeerStore;
}

describe("MeshService", () => {
  let service: MeshService;
  let events: EventService;
  let registry: ReturnType<typeof createMockRegistry>;
  let peerStore: ReturnType<typeof createMockPeerStore>;

  beforeEach(() => {
    events = createMockEvents();
    registry = createMockRegistry();
    peerStore = createMockPeerStore();
    service = new MeshService(
      events,
      registry as unknown as DeviceRegistryService,
      peerStore as unknown as PeerStore,
      {
        gateway_id: "local-gw",
        name: "Local",
        version: "1.0.0",
        capabilities: ["navigate", "notify", "ping"],
        address: "http://127.0.0.1:18790",
      },
    );
  });

  it("should return local peer info", () => {
    expect(service.getLocalInfo().gateway_id).toBe("local-gw");
  });

  it("should track peers", () => {
    expect(service.getPeers()).toEqual([]);
  });

  it("should route DeviceMessage to local handler if to_gateway matches", () => {
    const handler = vi.fn();
    service.onLocalAction(handler);
    const msg: DeviceMessageData = {
      id: "m1",
      from_gateway: "remote-gw",
      to_gateway: "local-gw",
      action: "navigate",
      payload: { path: "/settings" },
    };
    service.handleIncomingDeviceMessage(msg);
    expect(handler).toHaveBeenCalledWith(msg);
  });

  it("should store pending message and resolve on reply", async () => {
    const msg: DeviceMessageData = {
      id: "m1",
      from_gateway: "local-gw",
      to_gateway: "remote-gw",
      action: "ping",
      payload: {},
    };
    const promise = service.trackPendingMessage(msg.id, 5000);
    service.resolveMessage(msg.id, { status: "ok" });
    const result = await promise;
    expect(result).toEqual({ status: "ok" });
  });

  it("should timeout pending message after delay", async () => {
    vi.useFakeTimers();
    const promise = service.trackPendingMessage("m2", 100);
    vi.advanceTimersByTime(150);
    await expect(promise).rejects.toThrow("timeout");
    vi.useRealTimers();
  });

  it("should resolve reply_to messages instead of calling local handler", () => {
    const handler = vi.fn();
    service.onLocalAction(handler);

    // Track a pending message
    const pendingPromise = service.trackPendingMessage("m1", 5000);

    // Incoming message with reply_to should resolve the pending, not call handler
    const msg: DeviceMessageData = {
      id: "m1-reply",
      from_gateway: "remote-gw",
      to_gateway: "local-gw",
      action: "ping",
      payload: { status: "pong" },
      reply_to: "m1",
    };
    service.handleIncomingDeviceMessage(msg);
    expect(handler).not.toHaveBeenCalled();
    return expect(pendingPromise).resolves.toEqual({ status: "pong" });
  });

  it("should clean up pending messages on shutdown", () => {
    const promise = service.trackPendingMessage("m3", 30000);
    service.shutdown();
    return expect(promise).rejects.toThrow("shutdown");
  });
});
