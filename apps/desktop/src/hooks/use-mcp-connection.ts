import { useState, useCallback, useRef, useEffect } from "react";
import type { InspectorConnectionStatus, McpServerCapabilities, McpTool, McpResource, McpPrompt } from "@/types";

interface McpRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface McpResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface McpNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

interface UseMcpConnectionOptions {
  serverUrl: string;
  onNotification?: (method: string, params?: Record<string, unknown>) => void;
  onStdErrNotification?: (content: string) => void;
  enabled?: boolean;
}

interface UseMcpConnectionReturn {
  connectionStatus: InspectorConnectionStatus;
  serverCapabilities: McpServerCapabilities | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  makeRequest: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
  // Typed methods for common operations
  listTools: () => Promise<{ tools: McpTool[]; nextCursor?: string }>;
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  listResources: () => Promise<{ resources: McpResource[]; nextCursor?: string }>;
  readResource: (uri: string) => Promise<{ contents: Array<{ uri: string; mimeType?: string; text?: string; blob?: string }> }>;
  listPrompts: () => Promise<{ prompts: McpPrompt[]; nextCursor?: string }>;
  getPrompt: (name: string, args?: Record<string, string>) => Promise<{ description?: string; messages: Array<{ role: string; content: { type: string; text?: string } }> }>;
  ping: () => Promise<void>;
}

export function useMcpConnection({
  serverUrl,
  onNotification,
  onStdErrNotification,
  enabled = true,
}: UseMcpConnectionOptions): UseMcpConnectionReturn {
  const [connectionStatus, setConnectionStatus] = useState<InspectorConnectionStatus>("disconnected");
  const [serverCapabilities, setServerCapabilities] = useState<McpServerCapabilities | null>(null);

  const requestIdRef = useRef(0);
  const pendingRequestsRef = useRef<Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>>(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Generate unique request ID
  const getNextRequestId = useCallback(() => {
    requestIdRef.current += 1;
    return requestIdRef.current;
  }, []);

  // Send request to MCP server
  const sendRequest = useCallback(async (request: McpRequest): Promise<McpResponse> => {
    if (!serverUrl) {
      throw new Error("Server URL not configured");
    }

    const response = await fetch(`${serverUrl}/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionIdRef.current ? { "X-Session-Id": sessionIdRef.current } : {}),
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as McpResponse;
  }, [serverUrl]);

  // Make a request and wait for response
  const makeRequest = useCallback(async <T = unknown>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> => {
    if (connectionStatus !== "connected") {
      throw new Error("Not connected to MCP server");
    }

    const id = getNextRequestId();
    const request: McpRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    const response = await sendRequest(request);

    if (response.error) {
      throw new Error(response.error.message || "MCP request failed");
    }

    return response.result as T;
  }, [connectionStatus, getNextRequestId, sendRequest]);

  // Connect to MCP server
  const connect = useCallback(async () => {
    if (!enabled || !serverUrl) {
      return;
    }

    setConnectionStatus("connecting");

    try {
      // For SSE transport, establish EventSource connection
      const sseUrl = `${serverUrl}/sse`;

      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        // SSE connection opened successfully
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle session ID from endpoint event
          if (data.endpoint) {
            sessionIdRef.current = data.sessionId || null;
          }

          // Handle notifications
          if (data.method && !data.id) {
            const notification = data as McpNotification;
            if (notification.method === "notifications/stderr" && onStdErrNotification) {
              onStdErrNotification((notification.params as { content?: string })?.content || "");
            } else if (onNotification) {
              onNotification(notification.method, notification.params);
            }
          }

          // Handle responses to pending requests
          if (data.id && pendingRequestsRef.current.has(data.id)) {
            const pending = pendingRequestsRef.current.get(data.id);
            if (!pending) return; // Type guard - should not happen since we checked .has()
            pendingRequestsRef.current.delete(data.id);

            if (data.error) {
              pending.reject(new Error(data.error.message || "MCP request failed"));
            } else {
              pending.resolve(data.result);
            }
          }
        } catch (e) {
          console.error("Error parsing SSE message:", e);
        }
      };

      eventSource.onerror = (error) => {
        console.error("SSE error:", error);
        setConnectionStatus("error");
      };

      // Initialize connection with handshake
      const initRequest: McpRequest = {
        jsonrpc: "2.0",
        id: getNextRequestId(),
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {
            roots: { listChanged: true },
            sampling: {},
          },
          clientInfo: {
            name: "browse-mcp-inspector",
            version: "1.0.0",
          },
        },
      };

      const initResponse = await sendRequest(initRequest);

      if (initResponse.error) {
        throw new Error(initResponse.error.message || "Initialization failed");
      }

      // Extract server capabilities
      const result = initResponse.result as {
        capabilities?: McpServerCapabilities;
        protocolVersion?: string;
        serverInfo?: { name: string; version: string };
      };

      setServerCapabilities(result.capabilities || null);

      // Send initialized notification
      await sendRequest({
        jsonrpc: "2.0",
        id: getNextRequestId(),
        method: "notifications/initialized",
        params: {},
      });

      setConnectionStatus("connected");
    } catch (error) {
      console.error("Connection error:", error);
      setConnectionStatus("error");
      throw error;
    }
  }, [enabled, serverUrl, getNextRequestId, sendRequest, onNotification, onStdErrNotification]);

  // Disconnect from MCP server
  const disconnect = useCallback(async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Clear pending requests
    pendingRequestsRef.current.forEach((pending) => {
      pending.reject(new Error("Connection closed"));
    });
    pendingRequestsRef.current.clear();

    sessionIdRef.current = null;
    setConnectionStatus("disconnected");
    setServerCapabilities(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Typed helper methods
  const listTools = useCallback(async () => {
    return makeRequest<{ tools: McpTool[]; nextCursor?: string }>("tools/list", {});
  }, [makeRequest]);

  const callTool = useCallback(async (name: string, args: Record<string, unknown>) => {
    return makeRequest("tools/call", { name, arguments: args });
  }, [makeRequest]);

  const listResources = useCallback(async () => {
    return makeRequest<{ resources: McpResource[]; nextCursor?: string }>("resources/list", {});
  }, [makeRequest]);

  const readResource = useCallback(async (uri: string) => {
    return makeRequest<{ contents: Array<{ uri: string; mimeType?: string; text?: string; blob?: string }> }>(
      "resources/read",
      { uri }
    );
  }, [makeRequest]);

  const listPrompts = useCallback(async () => {
    return makeRequest<{ prompts: McpPrompt[]; nextCursor?: string }>("prompts/list", {});
  }, [makeRequest]);

  const getPrompt = useCallback(async (name: string, args?: Record<string, string>) => {
    return makeRequest<{ description?: string; messages: Array<{ role: string; content: { type: string; text?: string } }> }>(
      "prompts/get",
      { name, arguments: args }
    );
  }, [makeRequest]);

  const ping = useCallback(async () => {
    await makeRequest("ping", {});
  }, [makeRequest]);

  return {
    connectionStatus,
    serverCapabilities,
    connect,
    disconnect,
    makeRequest,
    listTools,
    callTool,
    listResources,
    readResource,
    listPrompts,
    getPrompt,
    ping,
  };
}
