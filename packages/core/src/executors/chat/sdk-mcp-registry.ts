/**
 * SDK MCP Server Registry
 *
 * A registry of in-process MCP servers that can be activated by name.
 * When an agent config includes mcpServers: ["presentation", ...],
 * the SDK proxy looks up matching entries in this registry and creates
 * the corresponding SDK MCP server instances.
 *
 * Also supports external MCP servers (stdio, sse, http) passed as
 * McpServerEntry objects — these are converted directly to SDK-compatible
 * McpServerConfig without needing a registry entry.
 */

import type * as ClaudeAgentSdk from "@anthropic-ai/claude-agent-sdk";
import type { AgentMcpServerEntry } from "../../types";

export type McpServerFactory = (sdk: typeof ClaudeAgentSdk, context?: { sessionId?: string }) => ReturnType<typeof ClaudeAgentSdk.createSdkMcpServer>;

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
 * SDK McpServerConfig type (union of stdio/sse/http/sdk configs).
 * We use a local type alias to avoid importing the full SDK types at top level.
 */
type SdkMcpServerConfig =
  | { type?: "stdio"; command: string; args?: string[]; env?: Record<string, string> }
  | { type: "sse"; url: string; headers?: Record<string, string> }
  | { type: "http"; url: string; headers?: Record<string, string> }
  | { type: "sdk"; name: string; instance: unknown };

/**
 * Look up and resolve MCP servers from a mixed array of names and entry objects.
 *
 * - String entries: looked up in the in-process registry (e.g., "presentation")
 * - McpServerEntry objects: converted directly to SDK-compatible configs
 *
 * Returns a Record suitable for passing to sdk.query({ mcpServers: ... }).
 */
export function resolveSdkMcpServers(
  sdk: typeof ClaudeAgentSdk,
  entries: (string | AgentMcpServerEntry)[],
  context?: { sessionId?: string }
): Record<string, SdkMcpServerConfig> {
  const result: Record<string, SdkMcpServerConfig> = {};
  for (const entry of entries) {
    if (typeof entry === "string") {
      // Existing behavior: in-process registry lookup by name
      const factory = getRegistry().get(entry);
      if (factory) {
        result[entry] = factory(sdk, context) as unknown as SdkMcpServerConfig;
      }
    } else if (entry.type === "stdio" && entry.command) {
      // External stdio server: pass as McpStdioServerConfig
      result[entry.name] = {
        type: "stdio",
        command: entry.command,
        args: entry.args,
        env: entry.env,
      };
    } else if (entry.type === "sse" && entry.url) {
      // External SSE server
      result[entry.name] = {
        type: "sse",
        url: entry.url,
        headers: entry.headers,
      };
    } else if (entry.type === "http" && entry.url) {
      // External HTTP server
      result[entry.name] = {
        type: "http",
        url: entry.url,
        headers: entry.headers,
      };
    } else if (entry.type === "builtin") {
      // Builtin: registry lookup by name
      const factory = getRegistry().get(entry.name);
      if (factory) {
        result[entry.name] = factory(sdk, context) as unknown as SdkMcpServerConfig;
      }
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
import "./sdk-mcp-servers/gui-action";
