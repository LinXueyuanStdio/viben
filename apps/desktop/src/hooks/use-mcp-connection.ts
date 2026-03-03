import { useState, useCallback, useRef, useEffect } from "react";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { InspectorConnectionStatus, McpServerCapabilities } from "@/types";

/**
 * MCP Server Configuration Types
 * Based on fastmcp's canonical MCP configuration format
 * @see https://gofastmcp.com
 */

/** Transport type for MCP connections */
export type McpTransportType = "stdio" | "sse" | "http" | "streamable-http";

/** Base configuration shared by all server types */
interface BaseMcpServerConfig {
  /** Transport type */
  transport?: McpTransportType;
  /** Alternative transport field name (for compatibility) */
  type?: McpTransportType;
  /** Maximum response time in milliseconds */
  timeout?: number;
  /** Human-readable server description */
  description?: string;
  /** Icon path or URL for UI display */
  icon?: string;
  /** Authentication configuration object */
  authentication?: Record<string, unknown>;
}

/** Configuration for STDIO transport */
export interface StdioMcpServerConfig extends BaseMcpServerConfig {
  transport?: "stdio";
  type?: "stdio";
  /** Command to execute */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory for command execution */
  cwd?: string;
}

/** Configuration for remote (HTTP/SSE) transport */
export interface RemoteMcpServerConfig extends BaseMcpServerConfig {
  transport?: "http" | "streamable-http" | "sse";
  type?: "http" | "streamable-http" | "sse";
  /** Server URL */
  url: string;
  /** HTTP headers to include in requests */
  headers?: Record<string, string>;
  /** Authentication: Bearer token string, "oauth", or custom auth config */
  auth?: string | "oauth" | Record<string, unknown>;
  /** SSE read timeout in milliseconds */
  sse_read_timeout?: number;
}

/** Union type for all MCP server configurations */
export type McpServerConfig = StdioMcpServerConfig | RemoteMcpServerConfig;

/** Full MCP configuration with multiple servers */
export interface McpConfig {
  mcpServers?: Record<string, McpServerConfig>;
}

/** Check if config is for remote transport */
function isRemoteConfig(config: McpServerConfig): config is RemoteMcpServerConfig {
  return "url" in config;
}

/** Check if config is for STDIO transport */
function isStdioConfig(config: McpServerConfig): config is StdioMcpServerConfig {
  return "command" in config;
}

/** Infer transport type from URL path */
function inferTransportFromUrl(url: string): "http" | "sse" {
  try {
    const parsedUrl = new URL(url);
    // Match /sse followed by /, ?, &, or end of string
    if (/\/sse(\/|\?|&|$)/.test(parsedUrl.pathname)) {
      return "sse";
    }
  } catch {
    // Invalid URL, default to http
  }
  return "http";
}

/** Get effective transport type from config */
function getEffectiveTransport(config: McpServerConfig): McpTransportType {
  // Check explicit transport field first
  const transport = config.transport || config.type;

  if (transport) {
    return transport;
  }

  // For remote configs, infer from URL
  if (isRemoteConfig(config)) {
    return inferTransportFromUrl(config.url);
  }

  // Default to stdio for command-based configs
  return "stdio";
}

interface UseMcpConnectionOptions {
  /** MCP server configuration object */
  config: McpServerConfig | null;
  /** Callback for MCP notifications */
  onNotification?: (method: string, params?: Record<string, unknown>) => void;
  /** Callback for stderr notifications (reserved for future use) */
  onStdErrNotification?: (content: string) => void;
  /** Whether the hook is enabled */
  enabled?: boolean;
}

interface UseMcpConnectionReturn {
  connectionStatus: InspectorConnectionStatus;
  serverCapabilities: McpServerCapabilities | null;
  connectionError: string | null;
  /** Connect to MCP server. Optional configOverride allows passing a fresh config (e.g., with updated auth token) */
  connect: (configOverride?: McpServerConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  makeRequest: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
}

export function useMcpConnection({
  config,
  onNotification,
  onStdErrNotification: _onStdErrNotification, // Reserved for future use
  enabled = true,
}: UseMcpConnectionOptions): UseMcpConnectionReturn {
  const [connectionStatus, setConnectionStatus] = useState<InspectorConnectionStatus>("disconnected");
  const [serverCapabilities, setServerCapabilities] = useState<McpServerCapabilities | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const clientRef = useRef<Client | null>(null);
  const transportRef = useRef<Transport | null>(null);

  // Make a request to the MCP server
  const makeRequest = useCallback(async <T = unknown>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> => {
    const client = clientRef.current;
    if (!client) {
      throw new Error("Not connected to MCP server");
    }

    try {
      // Use built-in SDK methods for standard MCP requests to avoid schema validation issues
      switch (method) {
        case "tools/list": {
          const result = await client.listTools();
          return result as T;
        }
        case "tools/call": {
          const result = await client.callTool({
            name: params?.name as string,
            arguments: params?.arguments as Record<string, unknown>,
          });
          return result as T;
        }
        case "resources/list": {
          const result = await client.listResources();
          return result as T;
        }
        case "resources/read": {
          const result = await client.readResource({
            uri: params?.uri as string,
          });
          return result as T;
        }
        case "prompts/list": {
          const result = await client.listPrompts();
          return result as T;
        }
        case "prompts/get": {
          const result = await client.getPrompt({
            name: params?.name as string,
            arguments: params?.arguments as Record<string, string>,
          });
          return result as T;
        }
        case "ping": {
          const result = await client.ping();
          return result as T;
        }
        default: {
          // For custom methods, use raw request
          const requestOptions: RequestOptions = {
            timeout: config?.timeout ?? 30000,
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await client.request({ method, params: params ?? {} } as any, undefined as never, requestOptions);
          return result as T;
        }
      }
    } catch (error) {
      console.error(`MCP request failed (${method}):`, error);
      throw error;
    }
  }, [config?.timeout]);

  // Connect to MCP server
  // Optional configOverride allows passing a fresh config (e.g., with updated auth token)
  const connect = useCallback(async (configOverride?: McpServerConfig) => {
    const effectiveConfig = configOverride || config;
    console.log("[useMcpConnection] connect() called", {
      hasConfigOverride: !!configOverride,
      hasHookConfig: !!config,
      hasEffectiveConfig: !!effectiveConfig,
      enabled,
    });

    if (!enabled || !effectiveConfig) {
      console.warn("[useMcpConnection] Cannot connect: hook disabled or no config", { enabled, effectiveConfig });
      return;
    }

    console.log("[useMcpConnection] Effective config:", {
      url: effectiveConfig.url,
      transport: effectiveConfig.transport,
      headers: effectiveConfig.headers ? Object.keys(effectiveConfig.headers) : [],
      headerValues: effectiveConfig.headers,
    });

    // Clear previous error
    setConnectionError(null);

    // STDIO not supported in browser
    if (isStdioConfig(effectiveConfig)) {
      const errorMsg = "STDIO transport is not supported in browser environment";
      console.warn(errorMsg);
      setConnectionError(errorMsg);
      setConnectionStatus("error");
      return;
    }

    if (!isRemoteConfig(effectiveConfig)) {
      const errorMsg = "Invalid config: missing url";
      console.warn(errorMsg);
      setConnectionError(errorMsg);
      setConnectionStatus("error");
      return;
    }

    // Disconnect existing connection
    if (clientRef.current) {
      try {
        await clientRef.current.close();
      } catch {
        // Ignore close errors
      }
      clientRef.current = null;
      transportRef.current = null;
    }

    setConnectionStatus("connecting");

    try {
      // Create MCP Client
      const client = new Client(
        {
          name: "browse-mcp-inspector",
          version: "1.0.0",
        },
        {
          capabilities: {
            roots: { listChanged: true },
            sampling: {},
          },
        }
      );

      // Set up notification handlers
      if (onNotification) {
        client.fallbackNotificationHandler = async (notification) => {
          onNotification(notification.method, notification.params as Record<string, unknown>);
        };
      }

      // Build headers from config
      const headers: Record<string, string> = {
        ...effectiveConfig.headers,
      };

      // Add auth header if specified
      if (effectiveConfig.auth && typeof effectiveConfig.auth === "string" && effectiveConfig.auth !== "oauth") {
        // Bearer token auth
        headers["Authorization"] = effectiveConfig.auth.startsWith("Bearer ")
          ? effectiveConfig.auth
          : `Bearer ${effectiveConfig.auth}`;
      }

      // Determine transport type
      const connTransport = getEffectiveTransport(effectiveConfig);

      console.log("[useMcpConnection] Creating transport:", {
        transportType: connTransport,
        url: effectiveConfig.url,
        headers: headers,
        hasXMcpProxyAuth: headers["X-MCP-Proxy-Auth"] ? `${headers["X-MCP-Proxy-Auth"].slice(0, 20)}...` : "no",
      });

      // Create transport based on type
      let transport: Transport;
      const url = new URL(effectiveConfig.url);

      if (connTransport === "sse") {
        console.log("[useMcpConnection] Creating SSEClientTransport");
        transport = new SSEClientTransport(url, {
          requestInit: {
            headers,
          },
        });
      } else {
        // Both "http" and "streamable-http" use StreamableHTTPClientTransport
        const finalHeaders = {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          ...headers,
        };
        console.log("[useMcpConnection] Creating StreamableHTTPClientTransport with headers:", finalHeaders);
        transport = new StreamableHTTPClientTransport(url, {
          requestInit: {
            headers: finalHeaders,
          },
        });
      }

      // Connect
      await client.connect(transport);

      // Get server capabilities
      const capabilities = client.getServerCapabilities();

      // Convert to our capability format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const caps = capabilities as any;
      const mcpCapabilities: McpServerCapabilities = {
        tools: caps?.tools ? {} : undefined,
        resources: caps?.resources ? {} : undefined,
        prompts: caps?.prompts ? {} : undefined,
        roots: caps?.roots ? {} : undefined,
        sampling: caps?.sampling ? {} : undefined,
      };

      clientRef.current = client;
      transportRef.current = transport;
      setServerCapabilities(mcpCapabilities);
      setConnectionStatus("connected");

      console.log("Connected to MCP server:", effectiveConfig.url);
      console.log("Server capabilities:", capabilities);

    } catch (error) {
      console.error("Connection error:", error);
      // Extract detailed error message
      let errorMsg = "Connection failed";
      if (error instanceof Error) {
        errorMsg = error.message;
        // Try to extract more details from the error
        if ("cause" in error && error.cause) {
          errorMsg += `: ${String(error.cause)}`;
        }
      } else if (typeof error === "object" && error !== null) {
        // Handle JSON-RPC error responses
        const errObj = error as Record<string, unknown>;
        if (errObj.error && typeof errObj.error === "object") {
          const rpcError = errObj.error as Record<string, unknown>;
          errorMsg = String(rpcError.message || rpcError.code || JSON.stringify(rpcError));
        } else {
          errorMsg = JSON.stringify(error);
        }
      } else {
        errorMsg = String(error);
      }
      setConnectionError(errorMsg);
      setConnectionStatus("error");
      setServerCapabilities(null);
      throw error;
    }
  }, [enabled, config, onNotification]);

  // Disconnect from MCP server
  const disconnect = useCallback(async () => {
    const client = clientRef.current;
    const transport = transportRef.current;

    if (transport && "terminateSession" in transport) {
      try {
        await (transport as StreamableHTTPClientTransport).terminateSession();
      } catch {
        // Ignore termination errors
      }
    }

    if (client) {
      try {
        await client.close();
      } catch {
        // Ignore close errors
      }
    }

    clientRef.current = null;
    transportRef.current = null;
    setConnectionStatus("disconnected");
    setServerCapabilities(null);
    setConnectionError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const client = clientRef.current;
      if (client) {
        client.close().catch(() => {
          // Ignore cleanup errors
        });
      }
    };
  }, []);

  // Disconnect when disabled
  useEffect(() => {
    if (!enabled && connectionStatus === "connected") {
      disconnect();
    }
  }, [enabled, connectionStatus, disconnect]);

  return {
    connectionStatus,
    serverCapabilities,
    connectionError,
    connect,
    disconnect,
    makeRequest,
  };
}

/**
 * Parse MCP server configuration from JSON string
 */
export function parseMcpConfig(jsonString: string): McpServerConfig {
  const config = JSON.parse(jsonString);

  // If it looks like a full MCPConfig with mcpServers, extract the first server
  if (config.mcpServers && typeof config.mcpServers === "object") {
    const serverNames = Object.keys(config.mcpServers);
    if (serverNames.length > 0) {
      return config.mcpServers[serverNames[0]] as McpServerConfig;
    }
  }

  // Otherwise treat as a single server config
  return config as McpServerConfig;
}

/**
 * Validate MCP server configuration
 */
export function validateMcpConfig(config: McpServerConfig): { valid: boolean; error?: string } {
  if (isStdioConfig(config)) {
    if (!config.command) {
      return { valid: false, error: "STDIO config requires 'command' field" };
    }
    return { valid: true };
  }

  if (isRemoteConfig(config)) {
    if (!config.url) {
      return { valid: false, error: "Remote config requires 'url' field" };
    }
    try {
      new URL(config.url);
    } catch {
      return { valid: false, error: `Invalid URL: ${config.url}` };
    }
    return { valid: true };
  }

  return { valid: false, error: "Config must have either 'command' (stdio) or 'url' (remote)" };
}

/**
 * Check if config can be used in browser environment
 */
export function isBrowserCompatible(config: McpServerConfig): boolean {
  return isRemoteConfig(config);
}
