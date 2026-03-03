/**
 * Core Module - Basic HTTP Operations
 * 核心模块 - 基础 HTTP 操作
 */

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse error message from response
 * Handles nested error objects and provides JSON fallback for debugging
 */
export async function parseErrorMessage(response: Response): Promise<string> {
  let errorMessage = response.statusText;
  try {
    const errorBody = await response.json();
    errorMessage =
      errorBody?.error?.message ||
      errorBody?.message ||
      JSON.stringify(errorBody);
  } catch {
    // Keep statusText as fallback
  }
  return errorMessage;
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
      "/api/agents",
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
    const wsEndpoints = [
      "/ws",           // Main event WebSocket
      "/api/agent/ws", // Agent interaction WebSocket
      "/api/terminal", // Terminal PTY WebSocket
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
 */
async function testWebSocketEndpoint(baseUrl: string, path: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const wsUrl = baseUrl.replace(/^http/, "ws") + path;
      const ws = new WebSocket(wsUrl);
      let resolved = false;

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          ws.close();
        }
      };

      const timeout = setTimeout(() => {
        cleanup();
        resolve(false);
      }, 3000);

      ws.onopen = () => {
        clearTimeout(timeout);
        cleanup();
        resolve(true);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        cleanup();
        resolve(false);
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
