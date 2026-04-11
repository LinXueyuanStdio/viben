/**
 * Discovery Service
 *
 * Orchestrates mDNS auto-discovery and QR code generation for gateway pairing.
 * Provides a unified interface for discovering peer gateways on the LAN
 * and generating connection QR codes for mobile/desktop clients.
 */
import type { EventService } from "../services/events";
import type { ServiceInfo, QrPayload } from "./types";
import { MdnsService } from "./mdns";
import { generateQrDataUrl } from "./qr";

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

  async start(): Promise<void> {
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

    await this.mdns.start(serviceInfo);
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
      lan: this.config.lan_address
        ? `http://${this.config.lan_address}:${this.config.port}`
        : undefined,
      tunnel: this.config.tunnel_url,
    };
  }

  async getQrDataUrl(): Promise<string> {
    return generateQrDataUrl(this.getQrPayload());
  }

  async isMdnsAvailable(): Promise<boolean> {
    return this.mdns.isAvailable();
  }
}
