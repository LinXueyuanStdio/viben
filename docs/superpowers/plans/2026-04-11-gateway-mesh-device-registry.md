# Gateway Mesh + Device Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build gateway-to-gateway mesh networking with device registry and cross-device messaging primitives.

**Architecture:** Each gateway exposes `/api/mesh/ws` for peer connections. Gateways discover each other via mDNS on LAN or manual pairing. A `DeviceRegistryService` tracks all peers and clients. Cross-device messages are relayed through the mesh via `DeviceMessage` protocol.

**Tech Stack:** Fastify WebSocket, bonjour-service (mDNS), qrcode (QR generation), vitest (tests)

---

## File Structure

### New files (packages/core)

| File | Responsibility |
|---|---|
| `src/mesh/types.ts` | Mesh protocol message types, DeviceMessage, PeerInfo |
| `src/mesh/peer-connection.ts` | Single peer WebSocket connection lifecycle |
| `src/mesh/mesh-service.ts` | MeshService — manages all peers, routing, relay |
| `src/mesh/peer-store.ts` | Persist known peers to `~/.viben/mesh/peers.yaml` |
| `src/mesh/index.ts` | Re-exports |
| `src/devices/types.ts` | Device, DeviceEvent, ClientInfo types |
| `src/devices/device-registry.ts` | DeviceRegistryService — in-memory device tracking |
| `src/devices/index.ts` | Re-exports |
| `src/discovery/types.ts` | ServiceInfo, DiscoveryEvent types |
| `src/discovery/mdns.ts` | mDNS advertise/browse via bonjour-service |
| `src/discovery/qr.ts` | QR code generation |
| `src/discovery/index.ts` | DiscoveryService — orchestrates mDNS + QR |
| `src/gateway/routes/mesh.ts` | `/api/mesh/ws`, `/api/mesh/peers`, `/api/mesh/connect` |
| `src/gateway/routes/devices.ts` | `/api/devices`, `/api/devices/:id`, `/api/devices/qr`, `/api/devices/message` |

### New test files

| File | Tests |
|---|---|
| `src/devices/device-registry.test.ts` | DeviceRegistryService unit tests |
| `src/mesh/mesh-service.test.ts` | MeshService unit tests |
| `src/mesh/peer-store.test.ts` | PeerStore unit tests |
| `src/gateway/routes/mesh.test.ts` | Mesh WebSocket + REST route tests |
| `src/gateway/routes/devices.test.ts` | Device REST route tests |

### Modified files

| File | Change |
|---|---|
| `src/gateway/state.ts` | Add MeshService, DeviceRegistryService, DiscoveryService to AppState |
| `src/gateway/routes/index.ts` | Register mesh and device routes |
| `src/services/events.ts` | Add device_* and mesh_* GatewayEvent variants |
| `src/gateway/routes/ws.ts` | Add `"devices"` and `"mesh"` channel mapping |

### New files (apps/desktop)

| File | Responsibility |
|---|---|
| `src/stores/device-store.ts` | Zustand store for device list |
| `src/hooks/use-device-websocket.ts` | Subscribe to `"devices"` WebSocket channel |
| `src/lib/gateway/modules/devices.ts` | GatewayClient device API methods |

---

## Task 1: Shared Types

**Files:**
- Create: `packages/core/src/mesh/types.ts`
- Create: `packages/core/src/devices/types.ts`
- Create: `packages/core/src/discovery/types.ts`
- Create: `packages/core/src/mesh/index.ts`
- Create: `packages/core/src/devices/index.ts`
- Create: `packages/core/src/discovery/index.ts`

- [ ] **Step 1: Create mesh protocol types**

```typescript
// packages/core/src/mesh/types.ts

/** Identity of a gateway in the mesh */
export interface PeerInfo {
  gateway_id: string;
  name: string;
  version: string;
  capabilities: string[];
  address: string; // e.g., "http://192.168.1.100:18790"
}

/** Client → Peer / Peer → Peer message types */
export type MeshMessage =
  | { type: "Hello"; data: PeerInfo }
  | { type: "Welcome"; data: PeerInfo & { peers: PeerInfo[] } }
  | { type: "Ping" }
  | { type: "Pong" }
  | { type: "PeerJoined"; data: PeerInfo }
  | { type: "PeerLeft"; data: { gateway_id: string } }
  | { type: "DeviceMessage"; data: DeviceMessageData }
  | { type: "DeviceEvent"; data: DeviceEventData }
  | { type: "Error"; data: { error: string } };

/** Cross-device message payload */
export interface DeviceMessageData {
  id: string;
  from_gateway: string;
  to_gateway: string; // "*" = broadcast
  from_device?: string;
  to_device?: string;
  action: string; // "ping" | "navigate" | "notify"
  payload: unknown;
  reply_to?: string;
}

/** Device state change broadcast */
export interface DeviceEventData {
  type: "device_connected" | "device_disconnected" | "device_updated";
  device_id: string;
  gateway_id: string;
  device?: import("../devices/types").Device;
}

/** Persisted peer entry in ~/.viben/mesh/peers.yaml */
export interface PersistedPeer {
  gateway_id: string;
  name: string;
  lan?: string;
  tunnel?: string;
  last_seen: string; // ISO timestamp
}
```

- [ ] **Step 2: Create device types**

```typescript
// packages/core/src/devices/types.ts

/** A device in the mesh (gateway or connected client) */
export interface Device {
  id: string;
  type: "gateway" | "client";
  name: string;
  gateway_id: string;
  platform: "desktop" | "mobile" | "web" | "cli";
  status: "online" | "offline";
  address?: string;
  capabilities: string[];
  connected_at: string;
  last_seen: string;
}

/** Info provided when a client connects */
export interface ClientInfo {
  name: string;
  platform: Device["platform"];
  capabilities?: string[];
}

/** Info provided when a peer gateway connects */
export interface GatewayInfo {
  gateway_id: string;
  name: string;
  address?: string;
  capabilities?: string[];
}
```

- [ ] **Step 3: Create discovery types**

```typescript
// packages/core/src/discovery/types.ts

/** mDNS service info */
export interface ServiceInfo {
  gateway_id: string;
  name: string;
  version: string;
  host: string;
  port: number;
  addresses: string[];
}

/** QR code connection payload */
export interface QrPayload {
  type: "viben-gateway";
  gateway_id: string;
  name: string;
  lan?: string;
  tunnel?: string;
}
```

- [ ] **Step 4: Create index barrel files**

```typescript
// packages/core/src/mesh/index.ts
export * from "./types";

// packages/core/src/devices/index.ts
export * from "./types";

// packages/core/src/discovery/index.ts
export * from "./types";
```

- [ ] **Step 5: Verify types compile**

Run: `cd /root/viben && pnpm --filter @viben/core typecheck`
Expected: PASS (no type errors in new files)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/mesh/ packages/core/src/devices/ packages/core/src/discovery/
git commit -m "feat(mesh): add shared types for mesh protocol, devices, and discovery"
```

## Task 2: DeviceRegistryService

**Files:**
- Create: `packages/core/src/devices/device-registry.ts`
- Create: `packages/core/src/devices/device-registry.test.ts`
- Modify: `packages/core/src/devices/index.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/core/src/devices/device-registry.test.ts
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
        expect.objectContaining({ type: "device_connected" })
      );
    });
  });

  describe("unregisterClient", () => {
    it("should remove client and broadcast device_disconnected", () => {
      const device = registry.registerClient({ name: "Phone", platform: "mobile" });
      registry.unregisterClient(device.id);
      expect(registry.getDevice(device.id)).toBeUndefined();
      expect(events.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "device_disconnected" })
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
        { id: "d1", type: "client", name: "Phone", gateway_id: "gw-1", platform: "mobile", status: "online", capabilities: [], connected_at: new Date().toISOString(), last_seen: new Date().toISOString() },
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /root/viben && pnpm --filter @viben/core test -- src/devices/device-registry.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement DeviceRegistryService**

```typescript
// packages/core/src/devices/device-registry.ts
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
    this.events.broadcast({ type: "device_connected", data: { device } } as any);
    return device;
  }

  unregisterClient(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (!device) return;
    this.devices.delete(deviceId);
    this.events.broadcast({ type: "device_disconnected", data: { device_id: deviceId } } as any);
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
    this.events.broadcast({ type: "device_connected", data: { device } } as any);
    return device;
  }

  unregisterPeer(peerId: string): void {
    // Remove peer gateway device
    this.devices.delete(peerId);
    // Remove all synced client devices from this peer
    const clientIds = this.peerDevices.get(peerId);
    if (clientIds) {
      for (const id of clientIds) {
        this.devices.delete(id);
      }
      this.peerDevices.delete(peerId);
    }
    this.events.broadcast({ type: "device_disconnected", data: { device_id: peerId } } as any);
  }

  syncPeerDevices(peerId: string, devices: Device[]): void {
    // Remove old synced devices for this peer
    const oldIds = this.peerDevices.get(peerId);
    if (oldIds) {
      for (const id of oldIds) {
        this.devices.delete(id);
      }
    }
    // Add new ones
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
    return this.getAllDevices().filter((d) => d.type === "gateway" && d.status === "online");
  }

  /** Get local client devices (directly connected to this gateway) */
  getLocalClients(): Device[] {
    return this.getAllDevices().filter((d) => d.type === "client" && d.gateway_id === this.gatewayId);
  }
}
```

- [ ] **Step 4: Update devices/index.ts**

```typescript
// packages/core/src/devices/index.ts
export * from "./types";
export { DeviceRegistryService } from "./device-registry";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /root/viben && pnpm --filter @viben/core test -- src/devices/device-registry.test.ts`
Expected: PASS (all 7 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/devices/
git commit -m "feat(devices): add DeviceRegistryService with tests"
```

## Task 3: PeerStore (YAML Persistence)

**Files:**
- Create: `packages/core/src/mesh/peer-store.ts`
- Create: `packages/core/src/mesh/peer-store.test.ts`
- Modify: `packages/core/src/mesh/index.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/core/src/mesh/peer-store.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PeerStore } from "./peer-store";
import type { PersistedPeer } from "./types";

// Mock config/yaml
vi.mock("../config/yaml", () => ({
  readYaml: vi.fn(),
  writeYaml: vi.fn(),
}));

import { readYaml, writeYaml } from "../config/yaml";

describe("PeerStore", () => {
  let store: PeerStore;

  beforeEach(() => {
    store = new PeerStore("/tmp/test-peers.yaml");
    vi.clearAllMocks();
  });

  it("should load peers from YAML", async () => {
    const peers: PersistedPeer[] = [
      { gateway_id: "gw-1", name: "Desktop B", lan: "http://192.168.1.101:18790", last_seen: "2026-04-11T00:00:00Z" },
    ];
    vi.mocked(readYaml).mockResolvedValue({ peers });
    const result = await store.load();
    expect(result).toHaveLength(1);
    expect(result[0].gateway_id).toBe("gw-1");
  });

  it("should return empty array if file missing", async () => {
    vi.mocked(readYaml).mockResolvedValue(undefined);
    const result = await store.load();
    expect(result).toEqual([]);
  });

  it("should save peers to YAML", async () => {
    const peer: PersistedPeer = { gateway_id: "gw-1", name: "B", lan: "http://192.168.1.101:18790", last_seen: "2026-04-11T00:00:00Z" };
    await store.save([peer]);
    expect(writeYaml).toHaveBeenCalledWith("/tmp/test-peers.yaml", { peers: [peer] });
  });

  it("should upsert a peer", async () => {
    vi.mocked(readYaml).mockResolvedValue({ peers: [
      { gateway_id: "gw-1", name: "Old", last_seen: "2026-01-01T00:00:00Z" },
    ] });
    await store.upsert({ gateway_id: "gw-1", name: "New", lan: "http://new:18790", last_seen: "2026-04-11T00:00:00Z" });
    expect(writeYaml).toHaveBeenCalledWith("/tmp/test-peers.yaml", {
      peers: [expect.objectContaining({ gateway_id: "gw-1", name: "New" })],
    });
  });

  it("should remove a peer", async () => {
    vi.mocked(readYaml).mockResolvedValue({ peers: [
      { gateway_id: "gw-1", name: "B", last_seen: "2026-01-01T00:00:00Z" },
    ] });
    await store.remove("gw-1");
    expect(writeYaml).toHaveBeenCalledWith("/tmp/test-peers.yaml", { peers: [] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /root/viben && pnpm --filter @viben/core test -- src/mesh/peer-store.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement PeerStore**

```typescript
// packages/core/src/mesh/peer-store.ts
import { join } from "node:path";
import { homedir } from "node:os";
import { readYaml, writeYaml } from "../config/yaml";
import type { PersistedPeer } from "./types";

interface PeerStoreData {
  peers: PersistedPeer[];
}

const DEFAULT_PATH = join(homedir(), ".viben", "mesh", "peers.yaml");

export class PeerStore {
  constructor(private path: string = DEFAULT_PATH) {}

  async load(): Promise<PersistedPeer[]> {
    const data = await readYaml<PeerStoreData>(this.path);
    return data?.peers ?? [];
  }

  async save(peers: PersistedPeer[]): Promise<void> {
    await writeYaml(this.path, { peers });
  }

  async upsert(peer: PersistedPeer): Promise<void> {
    const peers = await this.load();
    const idx = peers.findIndex((p) => p.gateway_id === peer.gateway_id);
    if (idx >= 0) {
      peers[idx] = peer;
    } else {
      peers.push(peer);
    }
    await this.save(peers);
  }

  async remove(gatewayId: string): Promise<void> {
    const peers = await this.load();
    await this.save(peers.filter((p) => p.gateway_id !== gatewayId));
  }
}
```

- [ ] **Step 4: Update mesh/index.ts**

```typescript
// packages/core/src/mesh/index.ts
export * from "./types";
export { PeerStore } from "./peer-store";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /root/viben && pnpm --filter @viben/core test -- src/mesh/peer-store.test.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/mesh/
git commit -m "feat(mesh): add PeerStore for YAML-based peer persistence"
```

## Task 4: MeshService

**Files:**
- Create: `packages/core/src/mesh/peer-connection.ts`
- Create: `packages/core/src/mesh/mesh-service.ts`
- Create: `packages/core/src/mesh/mesh-service.test.ts`
- Modify: `packages/core/src/mesh/index.ts`

- [ ] **Step 1: Implement PeerConnection**

Manages a single WebSocket connection to a remote gateway peer.

```typescript
// packages/core/src/mesh/peer-connection.ts
import { EventEmitter } from "node:events";
import WebSocket from "ws";
import type { MeshMessage, PeerInfo } from "./types";

export interface PeerConnectionEvents {
  message: [msg: MeshMessage];
  close: [code: number, reason: string];
  error: [err: Error];
  ready: [info: PeerInfo];
}

export class PeerConnection extends EventEmitter {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private peerInfo: PeerInfo | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;

  constructor(
    private localInfo: PeerInfo,
    private maxReconnectDelay = 60000,
  ) {
    super();
  }

  /** Connect as initiator to a remote gateway */
  connectTo(url: string): void {
    this.manualClose = false;
    const wsUrl = url.replace(/^http/, "ws") + "/api/mesh/ws";
    this.ws = new WebSocket(wsUrl);

    this.ws.on("open", () => {
      this.send({ type: "Hello", data: this.localInfo });
      this.startHeartbeat();
    });

    this.ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as MeshMessage;
        if (msg.type === "Pong") return;
        if (msg.type === "Welcome") {
          this.peerInfo = { gateway_id: msg.data.gateway_id, name: msg.data.name, version: msg.data.version, capabilities: msg.data.capabilities, address: msg.data.address };
          this.reconnectAttempts = 0;
          this.emit("ready", this.peerInfo);
        }
        this.emit("message", msg);
      } catch { /* ignore parse errors */ }
    });

    this.ws.on("close", (code, reason) => {
      this.stopHeartbeat();
      this.emit("close", code, reason.toString());
      if (!this.manualClose) this.scheduleReconnect(url);
    });

    this.ws.on("error", (err) => {
      this.emit("error", err);
    });
  }

  /** Accept an incoming WebSocket (server side) */
  accept(ws: WebSocket, remoteInfo: PeerInfo): void {
    this.manualClose = false;
    this.ws = ws;
    this.peerInfo = remoteInfo;

    // Send Welcome with our info
    const welcomeData = { ...this.localInfo, peers: [] as PeerInfo[] };
    this.send({ type: "Welcome", data: welcomeData });
    this.startHeartbeat();

    ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as MeshMessage;
        if (msg.type === "Pong") return;
        this.emit("message", msg);
      } catch { /* ignore */ }
    });

    ws.on("close", (code, reason) => {
      this.stopHeartbeat();
      this.emit("close", code, reason.toString());
    });

    ws.on("error", (err) => this.emit("error", err));

    this.emit("ready", remoteInfo);
  }

  send(msg: MeshMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  getPeerInfo(): PeerInfo | null {
    return this.peerInfo;
  }

  close(): void {
    this.manualClose = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close(1000);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: "Ping" });
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(url: string): void {
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, this.maxReconnectDelay);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connectTo(url), delay);
  }
}
```

- [ ] **Step 2: Write MeshService tests**

```typescript
// packages/core/src/mesh/mesh-service.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MeshService } from "./mesh-service";
import type { EventService } from "../services/events";
import type { DeviceRegistryService } from "../devices/device-registry";
import type { PeerStore } from "./peer-store";
import type { PeerInfo, DeviceMessageData } from "./types";

function createMockEvents(): EventService {
  return { broadcast: vi.fn() } as unknown as EventService;
}

function createMockRegistry(): DeviceRegistryService {
  return {
    getGatewayId: vi.fn(() => "local-gw"),
    registerPeer: vi.fn((id: string, info: any) => ({ id, type: "gateway", name: info.name, gateway_id: id, platform: "desktop", status: "online", capabilities: [], connected_at: "", last_seen: "" })),
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
    registry = createMockRegistry() as any;
    peerStore = createMockPeerStore() as any;
    service = new MeshService(events, registry as any, peerStore as any, {
      gateway_id: "local-gw",
      name: "Local",
      version: "1.0.0",
      capabilities: ["navigate", "notify", "ping"],
      address: "http://127.0.0.1:18790",
    });
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
    // Register pending, then resolve
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
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /root/viben && pnpm --filter @viben/core test -- src/mesh/mesh-service.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement MeshService**

```typescript
// packages/core/src/mesh/mesh-service.ts
import type { EventService } from "../services/events";
import type { DeviceRegistryService } from "../devices/device-registry";
import type { PeerInfo, MeshMessage, DeviceMessageData } from "./types";
import type { PeerStore } from "./peer-store";
import { PeerConnection } from "./peer-connection";

export class MeshService {
  private peers = new Map<string, PeerConnection>();
  private pendingMessages = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private localActionHandler: ((msg: DeviceMessageData) => void) | null = null;

  constructor(
    private events: EventService,
    private registry: DeviceRegistryService,
    private peerStore: PeerStore,
    private localInfo: PeerInfo,
  ) {}

  getLocalInfo(): PeerInfo {
    return this.localInfo;
  }

  getPeers(): PeerInfo[] {
    const result: PeerInfo[] = [];
    for (const conn of this.peers.values()) {
      const info = conn.getPeerInfo();
      if (info) result.push(info);
    }
    return result;
  }

  /** Connect to a remote gateway as initiator */
  connectToPeer(address: string): void {
    const conn = new PeerConnection(this.localInfo);
    conn.on("ready", (info: PeerInfo) => {
      this.peers.set(info.gateway_id, conn);
      this.registry.registerPeer(info.gateway_id, {
        gateway_id: info.gateway_id,
        name: info.name,
        address: info.address,
        capabilities: info.capabilities,
      });
      this.peerStore.upsert({
        gateway_id: info.gateway_id,
        name: info.name,
        lan: info.address,
        last_seen: new Date().toISOString(),
      });
      // Broadcast PeerJoined to other peers
      this.broadcastToPeers({ type: "PeerJoined", data: info }, info.gateway_id);
    });
    conn.on("message", (msg: MeshMessage) => this.handleMessage(msg));
    conn.on("close", () => {
      const info = conn.getPeerInfo();
      if (info) {
        this.peers.delete(info.gateway_id);
        this.registry.unregisterPeer(info.gateway_id);
        this.broadcastToPeers({ type: "PeerLeft", data: { gateway_id: info.gateway_id } });
      }
    });
    conn.connectTo(address);
  }

  /** Accept incoming WebSocket from remote gateway */
  acceptPeer(ws: import("ws"), remoteInfo: PeerInfo): void {
    if (this.peers.has(remoteInfo.gateway_id)) {
      ws.close(4001, "already_connected");
      return;
    }
    const conn = new PeerConnection(this.localInfo);
    conn.on("message", (msg: MeshMessage) => this.handleMessage(msg));
    conn.on("close", () => {
      this.peers.delete(remoteInfo.gateway_id);
      this.registry.unregisterPeer(remoteInfo.gateway_id);
      this.broadcastToPeers({ type: "PeerLeft", data: { gateway_id: remoteInfo.gateway_id } });
    });
    // Enrich Welcome with known peers
    const welcomeData = { ...this.localInfo, peers: this.getPeers() };
    conn.accept(ws, remoteInfo);
    // Override the Welcome to include peer list
    conn.send({ type: "Welcome", data: welcomeData });
    this.peers.set(remoteInfo.gateway_id, conn);
    this.registry.registerPeer(remoteInfo.gateway_id, {
      gateway_id: remoteInfo.gateway_id,
      name: remoteInfo.name,
      address: remoteInfo.address,
      capabilities: remoteInfo.capabilities,
    });
    this.peerStore.upsert({
      gateway_id: remoteInfo.gateway_id,
      name: remoteInfo.name,
      lan: remoteInfo.address,
      last_seen: new Date().toISOString(),
    });
    this.broadcastToPeers({ type: "PeerJoined", data: remoteInfo }, remoteInfo.gateway_id);
  }

  /** Send a DeviceMessage to a target gateway */
  sendDeviceMessage(msg: DeviceMessageData): boolean {
    if (msg.to_gateway === "*") {
      // Broadcast to all peers
      this.broadcastToPeers({ type: "DeviceMessage", data: msg });
      return true;
    }
    const conn = this.peers.get(msg.to_gateway);
    if (conn) return conn.send({ type: "DeviceMessage", data: msg });
    // Try 1-hop relay: find a peer that knows the target
    for (const [, peerConn] of this.peers) {
      if (peerConn.send({ type: "DeviceMessage", data: msg })) return true;
    }
    return false;
  }

  /** Handle incoming DeviceMessage destined for this gateway */
  handleIncomingDeviceMessage(msg: DeviceMessageData): void {
    // Check if this is a reply to a pending message
    if (msg.reply_to) {
      this.resolveMessage(msg.reply_to, msg.payload);
      return;
    }
    // Dispatch to local action handler
    if (this.localActionHandler) {
      this.localActionHandler(msg);
    }
  }

  /** Register handler for actions targeting this gateway */
  onLocalAction(handler: (msg: DeviceMessageData) => void): void {
    this.localActionHandler = handler;
  }

  /** Track a sent message for response correlation */
  trackPendingMessage(messageId: string, timeoutMs = 30000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new Error("timeout"));
      }, timeoutMs);
      this.pendingMessages.set(messageId, { resolve, reject, timer });
    });
  }

  /** Resolve a pending message with a reply payload */
  resolveMessage(messageId: string, payload: unknown): void {
    const pending = this.pendingMessages.get(messageId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingMessages.delete(messageId);
      pending.resolve(payload);
    }
  }

  /** Reconnect to previously known peers on startup */
  async reconnectKnownPeers(): Promise<void> {
    const peers = await this.peerStore.load();
    for (const peer of peers) {
      if (peer.gateway_id === this.localInfo.gateway_id) continue;
      const address = peer.lan ?? peer.tunnel;
      if (address) this.connectToPeer(address);
    }
  }

  /** Shutdown all peer connections */
  shutdown(): void {
    for (const conn of this.peers.values()) {
      conn.close();
    }
    this.peers.clear();
    for (const pending of this.pendingMessages.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("shutdown"));
    }
    this.pendingMessages.clear();
  }

  private handleMessage(msg: MeshMessage): void {
    switch (msg.type) {
      case "DeviceMessage": {
        const data = msg.data;
        if (data.to_gateway === this.localInfo.gateway_id || data.to_gateway === "*") {
          this.handleIncomingDeviceMessage(data);
        } else {
          // Relay to target
          const target = this.peers.get(data.to_gateway);
          target?.send(msg);
        }
        break;
      }
      case "PeerJoined":
        this.events.broadcast({ type: "mesh_peer_joined", data: msg.data } as any);
        break;
      case "PeerLeft":
        this.events.broadcast({ type: "mesh_peer_left", data: msg.data } as any);
        break;
      case "DeviceEvent":
        this.events.broadcast({ type: "device_" + msg.data.type.replace("device_", ""), data: msg.data } as any);
        break;
    }
  }

  private broadcastToPeers(msg: MeshMessage, excludeGatewayId?: string): void {
    for (const [gwId, conn] of this.peers) {
      if (gwId !== excludeGatewayId) {
        conn.send(msg);
      }
    }
  }
}
```

- [ ] **Step 5: Update mesh/index.ts**

```typescript
// packages/core/src/mesh/index.ts
export * from "./types";
export { PeerStore } from "./peer-store";
export { PeerConnection } from "./peer-connection";
export { MeshService } from "./mesh-service";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /root/viben && pnpm --filter @viben/core test -- src/mesh/mesh-service.test.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/mesh/
git commit -m "feat(mesh): add PeerConnection and MeshService for gateway mesh"
```

## Task 5: Mesh WebSocket Route

**Files:**
- Create: `packages/core/src/gateway/routes/mesh.ts`
- Create: `packages/core/src/gateway/routes/mesh.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/core/src/gateway/routes/mesh.test.ts
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import type { FastifyInstance } from "fastify";

vi.mock("@fastify/websocket", () => ({ default: vi.fn() }));

import { registerMeshRoutes } from "./mesh";
import type { AppState } from "../state";

interface MockSocket { send: Mock; on: Mock; close: Mock; }

function createMockSocket(): MockSocket {
  return { send: vi.fn(), on: vi.fn(), close: vi.fn() };
}

function createMockMeshService() {
  return {
    getLocalInfo: vi.fn(() => ({
      gateway_id: "local-gw", name: "Local", version: "1.0.0",
      capabilities: [], address: "http://127.0.0.1:18790",
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
      const options = args.length > 2 ? args[0] : {};
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

  afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

  it("should register /api/mesh/ws as websocket route", () => {
    const wsRoute = mockFastify._routes.find((r) => r.path === "/api/mesh/ws");
    expect(wsRoute).toBeDefined();
    expect(wsRoute!.options.websocket).toBe(true);
  });

  it("should register GET /api/mesh/peers", () => {
    const route = mockFastify._routes.find((r) => r.path === "/api/mesh/peers" && r.method === "GET");
    expect(route).toBeDefined();
  });

  it("should register POST /api/mesh/connect", () => {
    const route = mockFastify._routes.find((r) => r.path === "/api/mesh/connect" && r.method === "POST");
    expect(route).toBeDefined();
  });

  describe("/api/mesh/ws handler", () => {
    it("should reject connection without Hello message", () => {
      const wsRoute = mockFastify._routes.find((r) => r.path === "/api/mesh/ws");
      const mockSocket = createMockSocket();
      wsRoute!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((c: any) => c[0] === "message")?.[1];
      messageHandler(Buffer.from(JSON.stringify({ type: "Ping" })));

      // Should send Error because no Hello received first
      expect(mockSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"Error"')
      );
    });

    it("should accept peer on valid Hello", () => {
      const wsRoute = mockFastify._routes.find((r) => r.path === "/api/mesh/ws");
      const mockSocket = createMockSocket();
      wsRoute!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((c: any) => c[0] === "message")?.[1];
      const hello = {
        type: "Hello",
        data: { gateway_id: "remote-gw", name: "Remote", version: "1.0.0", capabilities: [], address: "http://remote:18790" },
      };
      messageHandler(Buffer.from(JSON.stringify(hello)));

      expect((mockState as any).mesh.acceptPeer).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /root/viben && pnpm --filter @viben/core test -- src/gateway/routes/mesh.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement mesh routes**

```typescript
// packages/core/src/gateway/routes/mesh.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { AppState } from "../state";
import type { MeshMessage, PeerInfo } from "../../mesh/types";

export function registerMeshRoutes(fastify: FastifyInstance, state: AppState): void {
  if (!fastify.hasDecorator("websocketServer")) return;

  const mesh = (state as any).mesh;
  if (!mesh) return;

  // --- WebSocket: peer-to-peer gateway connections ---
  fastify.get("/api/mesh/ws", { websocket: true }, (socket) => {
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /root/viben && pnpm --filter @viben/core test -- src/gateway/routes/mesh.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/gateway/routes/mesh.ts packages/core/src/gateway/routes/mesh.test.ts
git commit -m "feat(gateway): add /api/mesh/ws WebSocket and REST routes for mesh"
```

## Task 6: Device REST Routes + Cross-Device Messaging

> Merged original Task 6 (Mesh REST) and Task 7 (Device REST) since mesh REST was already included in Task 5.

**Files:**
- Create: `packages/core/src/gateway/routes/devices.ts`
- Create: `packages/core/src/gateway/routes/devices.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/core/src/gateway/routes/devices.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { registerDeviceRoutes } from "./devices";
import type { AppState } from "../state";
import type { Device } from "../../devices/types";

const mockDevice: Device = {
  id: "d1", type: "client", name: "Phone", gateway_id: "gw-1",
  platform: "mobile", status: "online", capabilities: ["navigate"],
  connected_at: "2026-04-11T00:00:00Z", last_seen: "2026-04-11T00:00:00Z",
};

function createMockState() {
  return {
    deviceRegistry: {
      getAllDevices: vi.fn(() => [mockDevice]),
      getDevice: vi.fn((id: string) => id === "d1" ? mockDevice : undefined),
      getGatewayId: vi.fn(() => "local-gw"),
    },
    mesh: {
      getLocalInfo: vi.fn(() => ({
        gateway_id: "local-gw", name: "Local", version: "1.0.0",
        capabilities: [], address: "http://127.0.0.1:18790",
      })),
      sendDeviceMessage: vi.fn(() => true),
      trackPendingMessage: vi.fn(async () => ({ status: "ok" })),
    },
    discovery: {
      getQrDataUrl: vi.fn(async () => "data:image/png;base64,abc"),
      getQrPayload: vi.fn(() => ({
        type: "viben-gateway", gateway_id: "local-gw", name: "Local",
        lan: "http://192.168.1.1:18790",
      })),
    },
  } as unknown as AppState;
}

function createMockFastify() {
  const routes: Array<{ method: string; path: string; handler: any }> = [];
  return {
    get: vi.fn((path: string, handler: any) => routes.push({ method: "GET", path, handler })),
    post: vi.fn((path: string, handler: any) => routes.push({ method: "POST", path, handler })),
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

  afterEach(() => { vi.restoreAllMocks(); });

  it("GET /api/devices returns all devices", async () => {
    const route = fastify._routes.find((r) => r.path === "/api/devices");
    const reply = mockReply();
    await route!.handler({} as any, reply);
    expect(reply.send).toHaveBeenCalledWith({ devices: [mockDevice] });
  });

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

  it("GET /api/devices/qr returns QR data", async () => {
    const route = fastify._routes.find((r) => r.path === "/api/devices/qr");
    const reply = mockReply();
    await route!.handler({} as any, reply);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ qr_data_url: "data:image/png;base64,abc" }));
  });

  it("POST /api/devices/message sends and returns message_id", async () => {
    const route = fastify._routes.find((r) => r.path === "/api/devices/message");
    const reply = mockReply();
    await route!.handler({
      body: { to_gateway: "remote-gw", action: "ping", payload: {} },
    } as any, reply);
    expect(state.mesh.sendDeviceMessage).toHaveBeenCalled();
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ status: "sent" }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /root/viben && pnpm --filter @viben/core test -- src/gateway/routes/devices.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement device routes**

```typescript
// packages/core/src/gateway/routes/devices.ts
import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { AppState } from "../state";

export function registerDeviceRoutes(fastify: FastifyInstance, state: AppState): void {
  const registry = (state as any).deviceRegistry;
  const mesh = (state as any).mesh;
  const discovery = (state as any).discovery;

  // Must register /api/devices/qr BEFORE /api/devices/:id to avoid route conflict
  fastify.get("/api/devices/qr", async (_req: FastifyRequest, reply: FastifyReply) => {
    if (!discovery) return reply.status(503).send({ error: "discovery not available" });
    const qr_data_url = await discovery.getQrDataUrl();
    const payload = discovery.getQrPayload();
    return reply.send({ qr_data_url, payload });
  });

  fastify.get("/api/devices", async (_req: FastifyRequest, reply: FastifyReply) => {
    const devices = registry.getAllDevices();
    return reply.send({ devices });
  });

  fastify.get("/api/devices/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const device = registry.getDevice(id);
    if (!device) return reply.status(404).send({ error: "device not found" });
    return reply.send(device);
  });

  fastify.post("/api/devices/message", async (req: FastifyRequest, reply: FastifyReply) => {
    const { to_gateway, to_device, action, payload } = req.body as {
      to_gateway: string; to_device?: string; action: string; payload: unknown;
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /root/viben && pnpm --filter @viben/core test -- src/gateway/routes/devices.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/gateway/routes/devices.ts packages/core/src/gateway/routes/devices.test.ts
git commit -m "feat(gateway): add /api/devices REST routes for device listing and messaging"
```

## Task 7: DiscoveryService (mDNS + QR)

> Merged original Tasks 7, 8, 9 since QR and mDNS are both part of DiscoveryService.

**Files:**
- Create: `packages/core/src/discovery/mdns.ts`
- Create: `packages/core/src/discovery/qr.ts`
- Create: `packages/core/src/discovery/discovery-service.ts`
- Modify: `packages/core/src/discovery/index.ts`

**Prerequisites:** Install dependencies first.

- [ ] **Step 1: Install dependencies**

```bash
cd /root/viben && pnpm --filter @viben/core add bonjour-service qrcode && pnpm --filter @viben/core add -D @types/qrcode
```

- [ ] **Step 2: Implement mDNS module**

```typescript
// packages/core/src/discovery/mdns.ts
import type { ServiceInfo } from "./types";

// bonjour-service is optional — may not be available in all environments
let Bonjour: any;
try {
  Bonjour = require("bonjour-service").Bonjour;
} catch {
  Bonjour = null;
}

const SERVICE_TYPE = "viben-gateway";

export class MdnsService {
  private instance: any = null;
  private browser: any = null;
  private published = false;
  private onDiscoverCallback: ((info: ServiceInfo) => void) | null = null;

  start(localInfo: ServiceInfo): void {
    if (!Bonjour) return;
    this.instance = new Bonjour();

    // Publish our service
    this.instance.publish({
      name: localInfo.name,
      type: SERVICE_TYPE,
      port: localInfo.port,
      txt: {
        gateway_id: localInfo.gateway_id,
        name: localInfo.name,
        version: localInfo.version,
      },
    });
    this.published = true;

    // Browse for other gateways
    this.browser = this.instance.find({ type: SERVICE_TYPE }, (service: any) => {
      const txtRecord = service.txt || {};
      if (txtRecord.gateway_id === localInfo.gateway_id) return; // skip self
      const info: ServiceInfo = {
        gateway_id: txtRecord.gateway_id || "",
        name: txtRecord.name || service.name,
        version: txtRecord.version || "unknown",
        host: service.host,
        port: service.port,
        addresses: service.addresses || [],
      };
      this.onDiscoverCallback?.(info);
    });
  }

  onDiscover(callback: (info: ServiceInfo) => void): void {
    this.onDiscoverCallback = callback;
  }

  stop(): void {
    if (this.browser) { this.browser.stop(); this.browser = null; }
    if (this.instance) { this.instance.unpublishAll(); this.instance.destroy(); this.instance = null; }
    this.published = false;
  }

  isAvailable(): boolean {
    return Bonjour !== null;
  }
}
```

- [ ] **Step 3: Implement QR module**

```typescript
// packages/core/src/discovery/qr.ts
import type { QrPayload } from "./types";

let qrcode: any;
try {
  qrcode = require("qrcode");
} catch {
  qrcode = null;
}

export async function generateQrDataUrl(payload: QrPayload): Promise<string> {
  if (!qrcode) throw new Error("qrcode package not available");
  const json = JSON.stringify(payload);
  return qrcode.toDataURL(json, { width: 256, margin: 2 });
}
```

- [ ] **Step 4: Implement DiscoveryService**

```typescript
// packages/core/src/discovery/discovery-service.ts
import { MdnsService } from "./mdns";
import { generateQrDataUrl } from "./qr";
import type { ServiceInfo, QrPayload } from "./types";
import type { EventService } from "../services/events";

export interface DiscoveryServiceConfig {
  gateway_id: string;
  name: string;
  version: string;
  port: number;
  lan_address?: string;
  tunnel_url?: string;
}

export class DiscoveryService {
  private mdns = new MdnsService();
  private config: DiscoveryServiceConfig;
  private onPeerDiscoveredCallback: ((address: string) => void) | null = null;

  constructor(
    private events: EventService,
    config: DiscoveryServiceConfig,
  ) {
    this.config = config;
  }

  start(): void {
    const serviceInfo: ServiceInfo = {
      gateway_id: this.config.gateway_id,
      name: this.config.name,
      version: this.config.version,
      host: "0.0.0.0",
      port: this.config.port,
      addresses: [],
    };

    this.mdns.onDiscover((info) => {
      const address = `http://${info.addresses[0] || info.host}:${info.port}`;
      this.onPeerDiscoveredCallback?.(address);
    });

    this.mdns.start(serviceInfo);
  }

  onPeerDiscovered(callback: (address: string) => void): void {
    this.onPeerDiscoveredCallback = callback;
  }

  stop(): void {
    this.mdns.stop();
  }

  getQrPayload(): QrPayload {
    return {
      type: "viben-gateway",
      gateway_id: this.config.gateway_id,
      name: this.config.name,
      lan: this.config.lan_address ? `http://${this.config.lan_address}:${this.config.port}` : undefined,
      tunnel: this.config.tunnel_url,
    };
  }

  async getQrDataUrl(): Promise<string> {
    return generateQrDataUrl(this.getQrPayload());
  }

  isMdnsAvailable(): boolean {
    return this.mdns.isAvailable();
  }
}
```

- [ ] **Step 5: Update discovery/index.ts**

```typescript
// packages/core/src/discovery/index.ts
export * from "./types";
export { MdnsService } from "./mdns";
export { generateQrDataUrl } from "./qr";
export { DiscoveryService } from "./discovery-service";
export type { DiscoveryServiceConfig } from "./discovery-service";
```

- [ ] **Step 6: Verify it compiles**

Run: `cd /root/viben && pnpm --filter @viben/core typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/discovery/
git commit -m "feat(discovery): add mDNS auto-discovery and QR code generation"
```

## Task 8: AppState + GatewayEvent Wiring

**Files:**
- Modify: `packages/core/src/gateway/state.ts`
- Modify: `packages/core/src/gateway/routes/index.ts`
- Modify: `packages/core/src/services/events.ts`
- Modify: `packages/core/src/gateway/routes/ws.ts`

- [ ] **Step 1: Add device/mesh events to GatewayEvent union**

Add these variants to the `GatewayEvent` type in `packages/core/src/services/events.ts` (after the MCP events block around line 77):

```typescript
  // Device mesh events
  | { type: "device_connected"; data: { device: import("../devices/types").Device } }
  | { type: "device_disconnected"; data: { device_id: string } }
  | { type: "device_updated"; data: { device: import("../devices/types").Device } }
  | { type: "mesh_peer_joined"; data: { gateway_id: string; name: string; address: string } }
  | { type: "mesh_peer_left"; data: { gateway_id: string } }
```

> Note: This uses inline `import()` for the type only to avoid circular dependency from events.ts → devices/types.ts. The rest of the codebase uses explicit imports per CLAUDE.md, but events.ts is the root dependency that everything imports — adding an import from devices/ here would create a cycle. The `import()` form is acceptable in type position only for this specific case.

- [ ] **Step 2: Add channel mapping in ws.ts**

In `packages/core/src/gateway/routes/ws.ts`, add to `eventToChannel()` function (before the default return):

```typescript
  // Device/mesh events
  if (eventType.startsWith("device") || eventType.startsWith("mesh")) {
    return "devices";
  }
```

- [ ] **Step 3: Add services to AppState interface**

In `packages/core/src/gateway/state.ts`, add imports and interface fields:

```typescript
// Add imports at top
import { DeviceRegistryService } from "../devices/device-registry";
import { MeshService } from "../mesh/mesh-service";
import { PeerStore } from "../mesh/peer-store";
import { DiscoveryService } from "../discovery/discovery-service";

// Add to AppState interface
  /** Device registry for tracking all mesh devices */
  deviceRegistry: DeviceRegistryService;
  /** Mesh service for gateway-to-gateway connections */
  mesh: MeshService;
  /** Discovery service for mDNS and QR code */
  discovery: DiscoveryService;
```

- [ ] **Step 4: Instantiate services in createAppState()**

Add to `createAppState()` in `packages/core/src/gateway/state.ts`, before the return statement:

```typescript
  // Create device registry
  const deviceRegistry = new DeviceRegistryService(events);
  const gatewayId = deviceRegistry.getGatewayId();

  // Create peer store for YAML persistence
  const peerStore = new PeerStore();

  // Create mesh service
  const localInfo = {
    gateway_id: gatewayId,
    name: `viben-${gatewayId.slice(0, 8)}`,
    version: "1.0.0",
    capabilities: ["navigate", "notify", "ping"],
    address: "http://127.0.0.1:18790",
  };
  const mesh = new MeshService(events, deviceRegistry, peerStore, localInfo);

  // Create discovery service
  const discovery = new DiscoveryService(events, {
    gateway_id: gatewayId,
    name: localInfo.name,
    version: "1.0.0",
    port: 18790,
  });

  // Wire mDNS discovery to mesh auto-connect
  discovery.onPeerDiscovered((address) => {
    mesh.connectToPeer(address);
  });
```

Add `deviceRegistry`, `mesh`, `discovery` to the return object.

- [ ] **Step 5: Register routes in routes/index.ts**

Add to `packages/core/src/gateway/routes/index.ts`:

```typescript
import { registerMeshRoutes } from "./mesh";
import { registerDeviceRoutes } from "./devices";

// In registerRoutes():
  registerMeshRoutes(fastify, state);
  registerDeviceRoutes(fastify, state);

// At bottom, add re-exports:
export { registerMeshRoutes } from "./mesh";
export { registerDeviceRoutes } from "./devices";
```

- [ ] **Step 6: Verify it compiles**

Run: `cd /root/viben && pnpm --filter @viben/core typecheck`
Expected: PASS

- [ ] **Step 7: Run all tests**

Run: `cd /root/viben && pnpm --filter @viben/core test`
Expected: All existing + new tests pass

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/gateway/state.ts packages/core/src/gateway/routes/index.ts packages/core/src/services/events.ts packages/core/src/gateway/routes/ws.ts
git commit -m "feat(gateway): wire mesh, devices, and discovery into AppState and routes"
```

## Task 9: Desktop Frontend — Device Store, Hook, Gateway Client

**Files:**
- Create: `apps/desktop/src/stores/device-store.ts`
- Create: `apps/desktop/src/hooks/use-device-websocket.ts`
- Create: `apps/desktop/src/lib/gateway/modules/devices.ts`
- Modify: `apps/desktop/src/lib/gateway/client.ts`

- [ ] **Step 1: Create device gateway client module**

```typescript
// apps/desktop/src/lib/gateway/modules/devices.ts
import type { DeviceInfo } from "../../../stores/device-store";

export interface DeviceListResponse {
  devices: DeviceInfo[];
}

export interface QrResponse {
  qr_data_url: string;
  payload: {
    type: string;
    gateway_id: string;
    name: string;
    lan?: string;
    tunnel?: string;
  };
}

export interface SendMessageRequest {
  to_gateway: string;
  to_device?: string;
  action: string;
  payload: unknown;
}

export interface SendMessageResponse {
  message_id: string;
  status: string;
}

export async function getDevices(baseUrl: string): Promise<DeviceListResponse> {
  const res = await fetch(`${baseUrl}/api/devices`);
  return res.json();
}

export async function getDevice(baseUrl: string, id: string): Promise<DeviceInfo> {
  const res = await fetch(`${baseUrl}/api/devices/${id}`);
  return res.json();
}

export async function getDeviceQr(baseUrl: string): Promise<QrResponse> {
  const res = await fetch(`${baseUrl}/api/devices/qr`);
  return res.json();
}

export async function sendDeviceMessage(baseUrl: string, req: SendMessageRequest): Promise<SendMessageResponse> {
  const res = await fetch(`${baseUrl}/api/devices/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return res.json();
}

export async function getMeshPeers(baseUrl: string): Promise<{ peers: unknown[] }> {
  const res = await fetch(`${baseUrl}/api/mesh/peers`);
  return res.json();
}

export async function connectMeshPeer(baseUrl: string, address: string): Promise<{ status: string }> {
  const res = await fetch(`${baseUrl}/api/mesh/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  return res.json();
}
```

- [ ] **Step 2: Add methods to GatewayClient**

In `apps/desktop/src/lib/gateway/client.ts`, add imports and methods:

```typescript
// Add import
import {
  getDevices, getDevice, getDeviceQr, sendDeviceMessage,
  getMeshPeers, connectMeshPeer,
  type DeviceListResponse, type QrResponse, type SendMessageRequest, type SendMessageResponse,
} from "./modules/devices";

// Add methods to GatewayClient class
  async getDevices(): Promise<DeviceListResponse> { return getDevices(this.baseUrl); }
  async getDevice(id: string) { return getDevice(this.baseUrl, id); }
  async getDeviceQr(): Promise<QrResponse> { return getDeviceQr(this.baseUrl); }
  async sendDeviceMessage(req: SendMessageRequest): Promise<SendMessageResponse> { return sendDeviceMessage(this.baseUrl, req); }
  async getMeshPeers() { return getMeshPeers(this.baseUrl); }
  async connectMeshPeer(address: string) { return connectMeshPeer(this.baseUrl, address); }
```

- [ ] **Step 3: Create device Zustand store**

```typescript
// apps/desktop/src/stores/device-store.ts
import { create } from "zustand";

export interface DeviceInfo {
  id: string;
  type: "gateway" | "client";
  name: string;
  gateway_id: string;
  platform: string;
  status: "online" | "offline";
  address?: string;
  capabilities: string[];
  connected_at: string;
  last_seen: string;
}

interface DeviceState {
  devices: DeviceInfo[];
  setDevices: (devices: DeviceInfo[]) => void;
  addDevice: (device: DeviceInfo) => void;
  removeDevice: (deviceId: string) => void;
  updateDevice: (deviceId: string, updates: Partial<DeviceInfo>) => void;
  getDevice: (id: string) => DeviceInfo | undefined;
  getGateways: () => DeviceInfo[];
}

export const useDeviceStore = create<DeviceState>()((set, get) => ({
  devices: [],
  setDevices: (devices) => set({ devices }),
  addDevice: (device) => set((s) => ({ devices: [...s.devices, device] })),
  removeDevice: (deviceId) => set((s) => ({ devices: s.devices.filter((d) => d.id !== deviceId) })),
  updateDevice: (deviceId, updates) => set((s) => ({
    devices: s.devices.map((d) => d.id === deviceId ? { ...d, ...updates } : d),
  })),
  getDevice: (id) => get().devices.find((d) => d.id === id),
  getGateways: () => get().devices.filter((d) => d.type === "gateway"),
}));
```

- [ ] **Step 4: Create device WebSocket hook**

```typescript
// apps/desktop/src/hooks/use-device-websocket.ts
import { useCallback, useRef, useEffect } from "react";
import { useGatewayWebSocket, type GatewayEventPayload } from "./use-gateway-websocket";
import { useDeviceStore } from "../stores/device-store";

type DeviceEventType =
  | "DeviceConnected"
  | "DeviceDisconnected"
  | "DeviceUpdated"
  | "MeshPeerJoined"
  | "MeshPeerLeft";

interface UseDeviceWebSocketOptions {
  enabled?: boolean;
  updateStore?: boolean;
}

export function useDeviceWebSocket(options: UseDeviceWebSocketOptions = {}) {
  const { enabled = true, updateStore = true } = options;

  const addDevice = useDeviceStore((s) => s.addDevice);
  const removeDevice = useDeviceStore((s) => s.removeDevice);
  const updateDevice = useDeviceStore((s) => s.updateDevice);

  const addDeviceRef = useRef(addDevice);
  const removeDeviceRef = useRef(removeDevice);
  const updateDeviceRef = useRef(updateDevice);

  addDeviceRef.current = addDevice;
  removeDeviceRef.current = removeDevice;
  updateDeviceRef.current = updateDevice;

  const handleEvent = useCallback((channel: string, payload: GatewayEventPayload) => {
    if (channel !== "devices") return;
    if (!updateStore) return;

    const eventType = payload.type as DeviceEventType;
    const data = payload.data as any;

    switch (eventType) {
      case "DeviceConnected":
        if (data.device) addDeviceRef.current(data.device);
        break;
      case "DeviceDisconnected":
        if (data.device_id) removeDeviceRef.current(data.device_id);
        break;
      case "DeviceUpdated":
        if (data.device) updateDeviceRef.current(data.device.id, data.device);
        break;
      case "MeshPeerJoined":
        addDeviceRef.current({
          id: data.gateway_id,
          type: "gateway",
          name: data.name,
          gateway_id: data.gateway_id,
          platform: "desktop",
          status: "online",
          address: data.address,
          capabilities: [],
          connected_at: new Date().toISOString(),
          last_seen: new Date().toISOString(),
        });
        break;
      case "MeshPeerLeft":
        if (data.gateway_id) removeDeviceRef.current(data.gateway_id);
        break;
    }
  }, [updateStore]);

  const { isConnected, state } = useGatewayWebSocket({
    channels: ["devices"],
    onEvent: handleEvent,
    enabled,
  });

  return { isConnected, state };
}
```

- [ ] **Step 5: Verify desktop compiles**

Run: `cd /root/viben && pnpm --filter viben-desktop typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/stores/device-store.ts apps/desktop/src/hooks/use-device-websocket.ts apps/desktop/src/lib/gateway/modules/devices.ts apps/desktop/src/lib/gateway/client.ts
git commit -m "feat(desktop): add device store, WebSocket hook, and gateway client for mesh"
```

---

## Task 10: Gateway Startup — Discovery + Mesh Reconnect

**Files:**
- Modify: `packages/core/src/gateway/index.ts`

- [ ] **Step 1: Start discovery and mesh reconnect on gateway boot**

In `packages/core/src/gateway/index.ts`, after the `registerRoutes(app, state)` call and before `return app`, add:

```typescript
  // Start mDNS discovery (advertise + browse)
  state.discovery.start();

  // Reconnect to previously known mesh peers
  state.mesh.reconnectKnownPeers().catch((err) => {
    log.warn({ err }, "Failed to reconnect known peers");
  });

  // Graceful shutdown: stop discovery and mesh
  app.addHook("onClose", async () => {
    state.discovery.stop();
    state.mesh.shutdown();
  });
```

- [ ] **Step 2: Verify gateway starts**

Run: `cd /root/viben && pnpm gateway:restart`
Then: `curl http://127.0.0.1:18790/health`
Expected: `{"status":"ok",...}`

Then: `curl http://127.0.0.1:18790/api/devices`
Expected: `{"devices":[]}`

Then: `curl http://127.0.0.1:18790/api/mesh/peers`
Expected: `{"peers":[]}`

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/gateway/index.ts
git commit -m "feat(gateway): start discovery and mesh reconnect on boot"
```

---

## Task 11: Integration Test — Two Gateways Mesh

**Files:**
- Create: `packages/core/src/mesh/mesh.integration.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// packages/core/src/mesh/mesh.integration.test.ts
import { describe, it, expect, afterEach } from "vitest";

describe("Mesh Integration (two gateways)", () => {
  let gateway1: any;
  let gateway2: any;

  afterEach(async () => {
    if (gateway1) await gateway1.close();
    if (gateway2) await gateway2.close();
  });

  it("should connect two gateways and list each other as peers", async () => {
    // This test requires dynamic import to avoid loading fastify in unit test context
    const { createGateway } = await import("../gateway/index");

    gateway1 = await createGateway({ port: 19001, host: "127.0.0.1", cors: true, telemetry: false });
    await gateway1.listen({ port: 19001, host: "127.0.0.1" });

    gateway2 = await createGateway({ port: 19002, host: "127.0.0.1", cors: true, telemetry: false });
    await gateway2.listen({ port: 19002, host: "127.0.0.1" });

    // Connect gateway2 to gateway1 via REST
    const connectRes = await fetch("http://127.0.0.1:19002/api/mesh/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: "http://127.0.0.1:19001" }),
    });
    expect(connectRes.ok).toBe(true);

    // Wait for connection handshake
    await new Promise((r) => setTimeout(r, 2000));

    // Check peers on gateway1
    const peers1Res = await fetch("http://127.0.0.1:19001/api/mesh/peers");
    const peers1 = await peers1Res.json();
    expect(peers1.peers.length).toBeGreaterThanOrEqual(1);

    // Check devices on gateway2 (should see gateway1 as a device)
    const devices2Res = await fetch("http://127.0.0.1:19002/api/devices");
    const devices2 = await devices2Res.json();
    expect(devices2.devices.length).toBeGreaterThanOrEqual(1);
  }, 15000);
});
```

- [ ] **Step 2: Run integration test**

Run: `cd /root/viben && pnpm --filter @viben/core test -- src/mesh/mesh.integration.test.ts --timeout 20000`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/mesh/mesh.integration.test.ts
git commit -m "test(mesh): add integration test for two-gateway mesh connection"
```

---

## Task 12: Full Build Verification

- [ ] **Step 1: Run full typecheck**

Run: `cd /root/viben && pnpm typecheck`
Expected: All packages compile without errors

- [ ] **Step 2: Run all core tests**

Run: `cd /root/viben && pnpm --filter @viben/core test`
Expected: All tests pass

- [ ] **Step 3: Run full build**

Run: `cd /root/viben && pnpm build`
Expected: All packages build successfully

- [ ] **Step 4: Final commit (if any remaining changes)**

```bash
git add -A
git commit -m "chore: fix any build issues from mesh integration"
```
