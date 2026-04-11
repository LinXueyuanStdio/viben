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
