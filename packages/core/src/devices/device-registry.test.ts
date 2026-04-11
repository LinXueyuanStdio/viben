import { describe, it, expect, beforeEach, vi } from "vitest";
import { DeviceRegistryService } from "./device-registry";
import type { EventService } from "../services/events";

function createMockEvents() {
  return { broadcast: vi.fn() } as unknown as EventService;
}

describe("DeviceRegistryService", () => {
  let registry: DeviceRegistryService;
  let events: EventService;

  beforeEach(() => {
    events = createMockEvents();
    registry = new DeviceRegistryService(events);
  });

  describe("registerClient", () => {
    it("should register a client and return a Device", () => {
      const device = registry.registerClient({
        name: "My Phone",
        platform: "mobile",
      });
      expect(device.type).toBe("client");
      expect(device.name).toBe("My Phone");
      expect(device.platform).toBe("mobile");
      expect(device.status).toBe("online");
    });

    it("should broadcast device_connected event", () => {
      registry.registerClient({ name: "Phone", platform: "mobile" });
      expect(events.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "device_connected" }),
      );
    });
  });

  describe("unregisterClient", () => {
    it("should remove client and broadcast device_disconnected", () => {
      const device = registry.registerClient({
        name: "Phone",
        platform: "mobile",
      });
      registry.unregisterClient(device.id);
      expect(registry.getDevice(device.id)).toBeUndefined();
      expect(events.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "device_disconnected" }),
      );
    });
  });

  describe("registerPeer", () => {
    it("should register a gateway peer", () => {
      const device = registry.registerPeer("gw-1", {
        gateway_id: "gw-1",
        name: "Desktop B",
        address: "http://192.168.1.101:18790",
      });
      expect(device.type).toBe("gateway");
      expect(device.status).toBe("online");
    });
  });

  describe("syncPeerDevices", () => {
    it("should replace devices for a peer gateway", () => {
      registry.registerPeer("gw-1", { gateway_id: "gw-1", name: "B" });
      registry.syncPeerDevices("gw-1", [
        {
          id: "d1",
          type: "client",
          name: "Phone",
          gateway_id: "gw-1",
          platform: "mobile",
          status: "online",
          capabilities: [],
          connected_at: new Date().toISOString(),
          last_seen: new Date().toISOString(),
        },
      ]);
      const devices = registry.getDevicesByGateway("gw-1");
      // 1 gateway device + 1 synced client
      expect(devices.length).toBe(2);
    });
  });

  describe("queries", () => {
    it("getAllDevices returns all devices", () => {
      registry.registerClient({ name: "A", platform: "desktop" });
      registry.registerPeer("gw-1", { gateway_id: "gw-1", name: "B" });
      expect(registry.getAllDevices().length).toBe(2);
    });

    it("getOnlineGateways returns only gateway type", () => {
      registry.registerClient({ name: "A", platform: "desktop" });
      registry.registerPeer("gw-1", { gateway_id: "gw-1", name: "B" });
      const gateways = registry.getOnlineGateways();
      expect(gateways.length).toBe(1);
      expect(gateways[0].type).toBe("gateway");
    });
  });
});
