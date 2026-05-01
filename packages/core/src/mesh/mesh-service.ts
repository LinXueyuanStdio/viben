import type WebSocket from "ws";
import type { EventService } from "../services/events";
import type { DeviceRegistryService } from "../devices/device-registry";
import type { PeerInfo, MeshMessage, DeviceMessageData } from "./types";
import type { PeerStore } from "./peer-store";
import { PeerConnection } from "./peer-connection";

export class MeshService {
  private peers = new Map<string, PeerConnection>();
  private pendingMessages = new Map<
    string,
    {
      resolve: (v: unknown) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
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
    conn.on("error", () => {
      // Suppress unhandled error – reconnection is handled via the close event
    });
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
      }).catch(() => {/* persistence is best-effort */});
      this.broadcastToPeers(
        { type: "PeerJoined", data: info },
        info.gateway_id,
      );
    });
    conn.on("message", (msg: MeshMessage) => this.handleMessage(msg));
    conn.on("close", () => {
      const info = conn.getPeerInfo();
      if (info) {
        this.peers.delete(info.gateway_id);
        this.registry.unregisterPeer(info.gateway_id);
        this.broadcastToPeers({
          type: "PeerLeft",
          data: { gateway_id: info.gateway_id },
        });
      }
    });
    conn.connectTo(address);
  }

  /** Accept incoming WebSocket from remote gateway */
  acceptPeer(ws: WebSocket, remoteInfo: PeerInfo): void {
    if (this.peers.has(remoteInfo.gateway_id)) {
      ws.close(4001, "already_connected");
      return;
    }
    const conn = new PeerConnection(this.localInfo);
    conn.on("error", () => {
      // Suppress unhandled error – close event handles cleanup
    });
    conn.on("message", (msg: MeshMessage) => this.handleMessage(msg));
    conn.on("close", () => {
      this.peers.delete(remoteInfo.gateway_id);
      this.registry.unregisterPeer(remoteInfo.gateway_id);
      this.broadcastToPeers({
        type: "PeerLeft",
        data: { gateway_id: remoteInfo.gateway_id },
      });
    });
    const knownPeers = this.getPeers();
    conn.accept(ws, remoteInfo, knownPeers);
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
    }).catch(() => {/* persistence is best-effort */});
    this.broadcastToPeers(
      { type: "PeerJoined", data: remoteInfo },
      remoteInfo.gateway_id,
    );
  }

  /** Send a DeviceMessage to a target gateway */
  sendDeviceMessage(msg: DeviceMessageData): boolean {
    if (msg.to_gateway === "*") {
      this.broadcastToPeers({ type: "DeviceMessage", data: msg });
      return true;
    }
    const conn = this.peers.get(msg.to_gateway);
    if (conn) return conn.send({ type: "DeviceMessage", data: msg });
    // Target not directly connected — no blind relay to avoid silent drops
    return false;
  }

  /** Handle incoming DeviceMessage destined for this gateway */
  handleIncomingDeviceMessage(msg: DeviceMessageData): void {
    if (msg.reply_to) {
      this.resolveMessage(msg.reply_to, msg.payload);
      return;
    }
    if (this.localActionHandler) {
      this.localActionHandler(msg);
    }
  }

  onLocalAction(handler: (msg: DeviceMessageData) => void): void {
    this.localActionHandler = handler;
  }

  trackPendingMessage(messageId: string, timeoutMs = 30000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new Error("timeout"));
      }, timeoutMs);
      this.pendingMessages.set(messageId, { resolve, reject, timer });
    });
  }

  resolveMessage(messageId: string, payload: unknown): void {
    const pending = this.pendingMessages.get(messageId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingMessages.delete(messageId);
      pending.resolve(payload);
    }
  }

  async reconnectKnownPeers(): Promise<void> {
    const peers = await this.peerStore.load();
    for (const peer of peers) {
      if (peer.gateway_id === this.localInfo.gateway_id) continue;
      const address = peer.lan ?? peer.tunnel;
      if (address) this.connectToPeer(address);
    }
  }

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
        if (
          data.to_gateway === this.localInfo.gateway_id ||
          data.to_gateway === "*"
        ) {
          this.handleIncomingDeviceMessage(data);
        } else {
          // Relay to the target peer
          const target = this.peers.get(data.to_gateway);
          target?.send(msg);
        }
        break;
      }
      case "PeerJoined":
        this.events.broadcast({
          type: "mesh_peer_joined",
          data: {
            gateway_id: msg.data.gateway_id,
            name: msg.data.name,
            address: msg.data.address ?? "",
          },
        });
        break;
      case "PeerLeft":
        this.events.broadcast({
          type: "mesh_peer_left",
          data: { gateway_id: msg.data.gateway_id },
        });
        break;
      case "DeviceEvent": {
        const evt = msg.data;
        if (evt.type === "device_connected" && evt.device) {
          this.events.broadcast({ type: "device_connected", data: { device: evt.device } });
        } else if (evt.type === "device_disconnected" && evt.device_id) {
          this.events.broadcast({ type: "device_disconnected", data: { device_id: evt.device_id } });
        } else if (evt.type === "device_updated" && evt.device) {
          this.events.broadcast({ type: "device_updated", data: { device: evt.device } });
        }
        break;
      }
    }
  }

  private broadcastToPeers(
    msg: MeshMessage,
    excludeGatewayId?: string,
  ): void {
    for (const [gwId, conn] of this.peers) {
      if (gwId !== excludeGatewayId) {
        conn.send(msg);
      }
    }
  }
}
