/**
 * mDNS Discovery Module
 *
 * Uses bonjour-service to publish and discover Viben gateways on the local network.
 * bonjour-service is an optional dependency -- if not available, mDNS features are disabled.
 */
import type Bonjour from "bonjour-service";
import type { ServiceInfo } from "./types";

const SERVICE_TYPE = "viben-gateway";

type BonjourInstance = InstanceType<typeof Bonjour>;
type BrowserInstance = ReturnType<BonjourInstance["find"]>;
type DiscoveredService = Parameters<NonNullable<Parameters<BonjourInstance["find"]>[1]>>[0];

// Lazy-loaded bonjour-service module
let BonjourClass: (new () => BonjourInstance) | null = null;
let loadAttempted = false;

async function loadBonjour(): Promise<(new () => BonjourInstance) | null> {
  if (loadAttempted) return BonjourClass;
  loadAttempted = true;
  try {
    const mod = await import("bonjour-service");
    BonjourClass = mod.Bonjour;
  } catch {
    BonjourClass = null;
  }
  return BonjourClass;
}

export class MdnsService {
  private instance: BonjourInstance | null = null;
  private browser: BrowserInstance | null = null;
  private published = false;
  private onDiscoverCallback: ((info: ServiceInfo) => void) | null = null;

  async start(localInfo: ServiceInfo): Promise<void> {
    const Ctor = await loadBonjour();
    if (!Ctor) return;

    this.instance = new Ctor();

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
    this.browser = this.instance.find({ type: SERVICE_TYPE }, (service: DiscoveredService) => {
      const txtRecord = service.txt || {};
      // Skip ourselves
      if (txtRecord.gateway_id === localInfo.gateway_id) return;

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
    if (this.browser) {
      this.browser.stop();
      this.browser = null;
    }
    if (this.instance) {
      this.instance.unpublishAll();
      this.instance.destroy();
      this.instance = null;
    }
    this.published = false;
  }

  async isAvailable(): Promise<boolean> {
    const Ctor = await loadBonjour();
    return Ctor !== null;
  }
}
