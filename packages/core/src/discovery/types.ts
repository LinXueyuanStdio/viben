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
