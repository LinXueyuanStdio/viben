import { useState, useCallback, useRef, useEffect } from "react";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { InspectorConnectionStatus, McpServerCapabilities } from "@/types";

interface UseMcpConnectionOptions {
  /** Server URL for SSE/HTTP transport (e.g., http://localhost:3000) */
  serverUrl: string;
  /** Transport type: 'sse' or 'http' */
  transportType: "sse" | "http";
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
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  makeRequest: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
}

export function useMcpConnection({
  serverUrl,
  transportType = "sse",
  onNotification,
  onStdErrNotification: _onStdErrNotification, // Reserved for future use
  enabled = true,
}: UseMcpConnectionOptions): UseMcpConnectionReturn {
  const [connectionStatus, setConnectionStatus] = useState<InspectorConnectionStatus>("disconnected");
  const [serverCapabilities, setServerCapabilities] = useState<McpServerCapabilities | null>(null);

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

    const request = {
      method,
      params: params ?? {},
    };

    const requestOptions: RequestOptions = {
      timeout: 30000,
    };

    try {
      // Use the client's request method with dynamic result handling
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await client.request(request as any, undefined as never, requestOptions);
      return result as T;
    } catch (error) {
      console.error(`MCP request failed (${method}):`, error);
      throw error;
    }
  }, []);

  // Connect to MCP server
  const connect = useCallback(async () => {
    if (!enabled || !serverUrl) {
      console.warn("Cannot connect: hook disabled or no server URL");
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

      // Create transport based on type
      let transport: Transport;
      const url = new URL(serverUrl);

      if (transportType === "http") {
        // Streamable HTTP transport (MCP over HTTP)
        transport = new StreamableHTTPClientTransport(url, {
          requestInit: {
            headers: {
              "Content-Type": "application/json",
            },
          },
        });
      } else {
        // SSE transport (default)
        // SSE endpoint is typically at /sse
        const sseUrl = new URL("/sse", serverUrl);
        transport = new SSEClientTransport(sseUrl, {
          requestInit: {
            headers: {},
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

      console.log("Connected to MCP server:", serverUrl);
      console.log("Server capabilities:", capabilities);

    } catch (error) {
      console.error("Connection error:", error);
      setConnectionStatus("error");
      setServerCapabilities(null);
      throw error;
    }
  }, [enabled, serverUrl, transportType, onNotification]);

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
    connect,
    disconnect,
    makeRequest,
  };
}
