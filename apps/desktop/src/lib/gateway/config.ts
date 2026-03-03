/**
 * Gateway Configuration
 * 网关配置管理
 *
 * URL management and port discovery.
 */

// ============================================================================
// Configuration Constants
// ============================================================================

/** Default Gateway port */
export const DEFAULT_GATEWAY_PORT = 18790;

/** Candidate ports to try when auto-discovering Gateway */
export const DISCOVERY_PORTS = [18790, 18791, 18800, 3790, 8790];

/** Default Gateway URL - use 127.0.0.1 to avoid proxy issues */
export const DEFAULT_GATEWAY_URL = `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}`;

// ============================================================================
// URL Management
// ============================================================================

/**
 * Get the Gateway base URL from localStorage or use default
 */
export function getGatewayUrl(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("viben_gateway_url") || DEFAULT_GATEWAY_URL;
  }
  return DEFAULT_GATEWAY_URL;
}

/**
 * Set the Gateway base URL
 */
export function setGatewayUrl(url: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("viben_gateway_url", url);
  }
}

// ============================================================================
// Port Discovery
// ============================================================================

/**
 * Ping a Gateway URL to check if it's reachable
 */
export async function pingGatewayUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${url}/health`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Auto-discover Gateway by probing known ports
 * Returns the first reachable Gateway URL or null if none found
 */
export async function discoverGateway(): Promise<string | null> {
  // First try the configured URL
  const configuredUrl = getGatewayUrl();
  if (await pingGatewayUrl(configuredUrl)) {
    return configuredUrl;
  }

  // Try discovery ports - use 127.0.0.1 to avoid proxy issues
  for (const port of DISCOVERY_PORTS) {
    const url = `http://127.0.0.1:${port}`;
    if (url !== configuredUrl && (await pingGatewayUrl(url))) {
      // Found a working Gateway, save it
      setGatewayUrl(url);
      return url;
    }
  }

  return null;
}
