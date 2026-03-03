/**
 * Gateway Client Library - Main Entry Point
 * 网关客户端库 - 主入口
 *
 * This module provides a unified interface for interacting with the Viben Gateway API.
 * It exports types, modules, error handling, configuration, and utility functions.
 */

// ============================================================================
// Types
// ============================================================================

export * from "./types";

// ============================================================================
// Modules (API Functions)
// ============================================================================

export * from "./modules";

// ============================================================================
// Error Handling
// ============================================================================

export { GatewayError } from "./error";

// ============================================================================
// Configuration
// ============================================================================

export {
  // Constants
  DEFAULT_GATEWAY_PORT,
  DEFAULT_GATEWAY_URL,
  DISCOVERY_PORTS,

  // Functions
  getGatewayUrl,
  setGatewayUrl,
  discoverGateway,
} from "./config";

// ============================================================================
// Utilities
// ============================================================================

export {
  sseEventToAgentMessage,
  isAgentAvailable,
  getAvailabilityStatus,
} from "./utils";

// ============================================================================
// Gateway Client (Singleton)
// ============================================================================

/**
 * GatewayClient class - Main client for interacting with the Gateway API
 *
 * @todo This will be implemented by another agent
 *
 * Usage:
 * ```ts
 * import { getGatewayClient } from "@/lib/gateway";
 *
 * const client = getGatewayClient();
 * const agents = await client.agents.list();
 * ```
 */
export class GatewayClient {
  // Placeholder - will be implemented by another agent
  constructor() {
    throw new Error("GatewayClient not yet implemented");
  }
}

/**
 * Singleton instance holder
 */
let gatewayClientInstance: GatewayClient | null = null;

/**
 * Get or create the singleton GatewayClient instance
 *
 * @returns The singleton GatewayClient instance
 *
 * @example
 * ```ts
 * const client = getGatewayClient();
 * const workspaces = await client.workspaces.list();
 * ```
 */
export function getGatewayClient(): GatewayClient {
  if (!gatewayClientInstance) {
    gatewayClientInstance = new GatewayClient();
  }
  return gatewayClientInstance;
}
