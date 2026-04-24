import type { Device } from "../devices/types";

/** Identity of a gateway in the mesh */
export interface PeerInfo {
  gateway_id: string;
  name: string;
  version: string;
  capabilities: string[];
  address: string; // e.g., "http://192.168.1.100:18790"
}

/** Client -> Peer / Peer -> Peer message types */
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
  device?: Device;
}

/** Persisted peer entry in ~/.viben/mesh/peers.yaml */
export interface PersistedPeer {
  gateway_id: string;
  name: string;
  lan?: string;
  tunnel?: string;
  last_seen: string; // ISO timestamp
}
