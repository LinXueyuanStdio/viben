import { randomUUID } from "node:crypto";
import type { EventService } from "../services/events";
import type { Device, ClientInfo, GatewayInfo } from "./types";

export class DeviceRegistryService {
  private devices = new Map<string, Device>();
  private peerDevices = new Map<string, Set<string>>(); // gateway_id -> device IDs from that peer
  private gatewayId: string;

  constructor(
    private events: EventService,
    gatewayId?: string,
  ) {
    this.gatewayId = gatewayId ?? randomUUID();
  }

  getGatewayId(): string {
    return this.gatewayId;
  }

  registerClient(info: ClientInfo): Device {
    const device: Device = {
      id: randomUUID(),
      type: "client",
      name: info.name,
      gateway_id: this.gatewayId,
      platform: info.platform,
      status: "online",
      capabilities: info.capabilities ?? [],
      connected_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    };
    this.devices.set(device.id, device);
    this.events.broadcast({
      type: "device_connected",
      data: { device },
    });
    return device;
  }

  registerClientWithId(deviceId: string, info: ClientInfo): Device {
    // Check if device already exists (reconnecting)
    const existing = this.devices.get(deviceId);
    if (existing) {
      existing.status = "online";
      existing.last_seen = new Date().toISOString();
      existing.name = info.name;
      existing.platform = info.platform;
      existing.capabilities = info.capabilities ?? existing.capabilities;
      this.events.broadcast({
        type: "device_connected",
        data: { device: existing },
      });
      return existing;
    }

    // New registration with client-provided ID
    const device: Device = {
      id: deviceId,
      type: "client",
      name: info.name,
      gateway_id: this.gatewayId,
      platform: info.platform,
      status: "online",
      capabilities: info.capabilities ?? [],
      connected_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    };
    this.devices.set(device.id, device);
    this.events.broadcast({
      type: "device_connected",
      data: { device },
    });
    return device;
  }

  unregisterClient(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (!device) return;
    this.devices.delete(deviceId);
    this.events.broadcast({
      type: "device_disconnected",
      data: { device_id: deviceId },
    });
  }

  registerPeer(peerId: string, info: GatewayInfo): Device {
    const device: Device = {
      id: peerId,
      type: "gateway",
      name: info.name,
      gateway_id: peerId,
      platform: "desktop",
      status: "online",
      address: info.address,
      capabilities: info.capabilities ?? [],
      connected_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    };
    this.devices.set(device.id, device);
    this.peerDevices.set(peerId, new Set());
    this.events.broadcast({
      type: "device_connected",
      data: { device },
    });
    return device;
  }

  unregisterPeer(peerId: string): void {
    this.devices.delete(peerId);
    const clientIds = this.peerDevices.get(peerId);
    if (clientIds) {
      for (const id of clientIds) {
        this.devices.delete(id);
      }
      this.peerDevices.delete(peerId);
    }
    this.events.broadcast({
      type: "device_disconnected",
      data: { device_id: peerId },
    });
  }

  syncPeerDevices(peerId: string, devices: Device[]): void {
    const oldIds = this.peerDevices.get(peerId);
    if (oldIds) {
      for (const id of oldIds) {
        this.devices.delete(id);
      }
    }
    const newIds = new Set<string>();
    for (const d of devices) {
      this.devices.set(d.id, d);
      newIds.add(d.id);
    }
    this.peerDevices.set(peerId, newIds);
  }

  updateLastSeen(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.last_seen = new Date().toISOString();
    }
  }

  getAllDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  getDevice(id: string): Device | undefined {
    return this.devices.get(id);
  }

  getDevicesByGateway(gatewayId: string): Device[] {
    return this.getAllDevices().filter((d) => d.gateway_id === gatewayId);
  }

  getOnlineGateways(): Device[] {
    return this.getAllDevices().filter(
      (d) => d.type === "gateway" && d.status === "online",
    );
  }

  getLocalClients(): Device[] {
    return this.getAllDevices().filter(
      (d) => d.type === "client" && d.gateway_id === this.gatewayId,
    );
  }
}
