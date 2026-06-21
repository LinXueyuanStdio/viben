/**
 * Core Module - Basic HTTP Operations
 * 核心模块 - 基础 HTTP 操作
 */

// ============================================================================
// URL Building Helpers
// ============================================================================

/**
 * Options for building URLs with query parameters
 */
export interface BuildUrlOptions {
  /** Workspace path parameter */
  workspacePath?: string;
  /** Include global flag */
  includeGlobal?: boolean;
  /** Additional custom parameters */
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Build a URL with query parameters
 * Handles common patterns for workspace_path and other parameters
 *
 * @param baseUrl - Gateway base URL
 * @param path - API path (e.g., "/api/agent")
 * @param options - URL options including workspacePath and custom params
 * @returns Fully constructed URL string
 *
 * @example
 * ```ts
 * // Simple path
 * buildUrl("http://localhost:8080", "/api/agent")
 * // => "http://localhost:8080/api/agent"
 *
 * // With workspace path
 * buildUrl("http://localhost:8080", "/api/agent", { workspacePath: "/path/to/project" })
 * // => "http://localhost:8080/api/agent?workspace_path=%2Fpath%2Fto%2Fproject"
 *
 * // With custom params
 * buildUrl("http://localhost:8080", "/api/sessions", {
 *   workspacePath: "/path",
 *   params: { limit: 10, active: true }
 * })
 * // => "http://localhost:8080/api/sessions?workspace_path=%2Fpath&limit=10&active=true"
 * ```
 */
export function buildUrl(
  baseUrl: string,
  path: string,
  options?: BuildUrlOptions
): string {
  const params = new URLSearchParams();

  if (options?.workspacePath) {
    params.set("workspace_path", options.workspacePath);
  }

  if (options?.includeGlobal !== undefined) {
    params.set("include_global", String(options.includeGlobal));
  }

  if (options?.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined) {
        params.set(key, String(value));
      }
    }
  }

  const query = params.toString();
  return query ? `${baseUrl}${path}?${query}` : `${baseUrl}${path}`;
}

// ============================================================================
// Error Handling Helpers
// ============================================================================

/**
 * Parse error message from response
 * Handles nested error objects and provides JSON fallback for debugging
 */
export async function parseErrorMessage(response: Response): Promise<string> {
  let errorMessage = response.statusText;
  try {
    const errorBody = await response.json();
    const primaryMessage = getErrorBodyMessage(errorBody, "primary");
    const detailsMessage = getErrorBodyMessage(errorBody?.details, "details");

    if (primaryMessage && detailsMessage && primaryMessage !== detailsMessage) {
      errorMessage = `${primaryMessage}: ${detailsMessage}`;
    } else {
      errorMessage =
        primaryMessage ||
        detailsMessage ||
        JSON.stringify(errorBody);
    }
  } catch {
    // Keep statusText as fallback
  }
  return errorMessage;
}

function getErrorBodyMessage(
  value: unknown,
  mode: "primary" | "details"
): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value !== "object") {
    return String(value);
  }

  const body = value as Record<string, unknown>;
  if (mode === "details") {
    return getErrorBodyMessage(body.details, "details") ||
      getErrorBodyMessage(body.error, "primary") ||
      getErrorBodyMessage(body.message, "primary");
  }

  return getErrorBodyMessage(body.error, "primary") ||
    getErrorBodyMessage(body.message, "primary") ||
    getErrorBodyMessage(body.details, "details");
}

// ============================================================================
// Health and Diagnostics
// ============================================================================

/**
 * Ping Gateway to check if it's alive
 */
export async function ping(baseUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${baseUrl}/health`, {
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
 * Get detailed diagnostics from Gateway
 * Tests connectivity and available endpoints
 */
export async function diagnose(
  baseUrl: string
): Promise<{
  reachable: boolean;
  healthCheck: boolean;
  version: string | null;
  service: string | null;
  timestamp: string | null;
  url: string;
  endpoints: { path: string; available: boolean }[];
  websockets: { path: string; available: boolean }[];
}> {
  const result = {
    reachable: false,
    healthCheck: false,
    version: null as string | null,
    service: null as string | null,
    timestamp: null as string | null,
    url: baseUrl,
    endpoints: [] as { path: string; available: boolean }[],
    websockets: [] as { path: string; available: boolean }[],
  };

  // Test health endpoint and extract detailed info
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const healthResponse = await fetch(`${baseUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    result.healthCheck = healthResponse.ok;
    result.reachable = true;

    if (healthResponse.ok) {
      try {
        const healthData = await healthResponse.json();
        result.version = healthData.version || null;
        result.service = healthData.service || null;
        result.timestamp = healthData.timestamp || null;
      } catch {
        // JSON parsing failed, but health check still passed
      }
    }
  } catch {
    result.reachable = false;
  }

  // Add health endpoint to the list
  result.endpoints.push({ path: "/health", available: result.healthCheck });

  // Only test other endpoints if health check passed
  if (result.healthCheck) {
    // Test specific HTTP endpoints - comprehensive list
    const testEndpoints = [
      "/api/agent",
      "/api/sessions",
      "/api/cron",
      "/api/group-chats",
      "/api/models",
      "/api/providers",
      "/api/channels",
      "/api/executors",
      "/api/workspaces",
      "/api/mcp/servers",
      "/api/packages",
    ];

    for (const path of testEndpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(`${baseUrl}${path}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        result.endpoints.push({ path, available: response.ok || response.status < 500 });
      } catch {
        result.endpoints.push({ path, available: false });
      }
    }

    // Test WebSocket endpoints
    // Note: These paths must match the actual gateway routes
    const wsEndpoints = [
      "/ws",             // Main event WebSocket
      "/ws/agent/run",   // Agent interaction WebSocket (not /api/agent/ws)
      "/ws/terminal",    // Terminal PTY WebSocket (not /api/terminal)
    ];

    for (const path of wsEndpoints) {
      const available = await testWebSocketEndpoint(baseUrl, path);
      result.websockets.push({ path, available });
    }
  }

  return result;
}

/**
 * Test if a WebSocket endpoint is available
 *
 * Note: We must resolve the promise BEFORE calling ws.close() to avoid
 * the "WebSocket is closed before the connection is established" error.
 * Calling ws.close() synchronously inside onopen can trigger this error
 * in some browser/Electron WebSocket implementations.
 */
async function testWebSocketEndpoint(baseUrl: string, path: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const wsUrl = baseUrl.replace(/^http/, "ws") + path;
      const ws = new WebSocket(wsUrl);
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.close();
          resolve(false);
        }
      }, 3000);

      ws.onopen = () => {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          resolve(true);
          // Close after resolving to avoid race condition
          // Use close code 1000 (normal closure) to be explicit
          ws.close(1000);
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          ws.close();
          resolve(false);
        }
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      };
    } catch {
      resolve(false);
    }
  });
}
