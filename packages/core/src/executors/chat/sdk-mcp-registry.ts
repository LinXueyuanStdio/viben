/**
 * SDK MCP Server Registry
 *
 * A registry of in-process MCP servers that can be activated by name.
 * When an agent config includes mcpServers: ["presentation", ...],
 * the SDK proxy looks up matching entries in this registry and creates
 * the corresponding SDK MCP server instances.
 *
 * This is a generic mechanism — specific server implementations are
 * registered as factory functions.
 */

import type * as ClaudeAgentSdk from "@anthropic-ai/claude-agent-sdk";

export type McpServerFactory = (sdk: typeof ClaudeAgentSdk) => ReturnType<typeof ClaudeAgentSdk.createSdkMcpServer>;

// Use a getter to avoid TDZ issues from circular imports in bundled output.
// When the bundle flattens modules, side-effect imports (presentation.ts)
// may run before `registry` is assigned. A lazy getter ensures the Map
// is created on first access regardless of module evaluation order.
let registry: Map<string, McpServerFactory> | undefined;
function getRegistry(): Map<string, McpServerFactory> {
  if (!registry) {
    registry = new Map<string, McpServerFactory>();
  }
  return registry;
}

/**
 * Register an SDK MCP server factory by name.
 * Call this at module initialization time.
 */
export function registerSdkMcpServer(name: string, factory: McpServerFactory): void {
  getRegistry().set(name, factory);
}

/**
 * Look up registered MCP server factories by name list.
 * Returns a Record suitable for passing to sdk.query({ mcpServers: ... }).
 */
export function resolveSdkMcpServers(
  sdk: typeof ClaudeAgentSdk,
  names: string[]
): Record<string, ReturnType<typeof ClaudeAgentSdk.createSdkMcpServer>> {
  const result: Record<string, ReturnType<typeof ClaudeAgentSdk.createSdkMcpServer>> = {};
  for (const name of names) {
    const factory = getRegistry().get(name);
    if (factory) {
      result[name] = factory(sdk);
    }
  }
  return result;
}

/**
 * Check if a name is a registered SDK MCP server.
 */
export function hasSdkMcpServer(name: string): boolean {
  return getRegistry().has(name);
}

/**
 * Get all registered SDK MCP server names.
 */
export function getRegisteredSdkMcpServerNames(): string[] {
  return Array.from(getRegistry().keys());
}

// ============================================================================
// Built-in SDK MCP Server registrations
// ============================================================================

// Import built-in servers (side-effect: registers into the registry)
import "./sdk-mcp-servers/presentation";
