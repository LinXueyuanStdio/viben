/**
 * Core Module - Basic HTTP Operations
 * 核心模块 - 基础 HTTP 操作
 */

import { GatewayError } from "../error";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse error message from response
 */
export async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const json = await response.json();
    return json.error || json.message || response.statusText;
  } catch {
    return response.statusText;
  }
}

// ============================================================================
// Health and Diagnostics
// ============================================================================

/**
 * Ping Gateway to check if it's alive
 */
export async function ping(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get detailed diagnostics from Gateway
 */
export async function diagnose(
  baseUrl: string
): Promise<{
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  uptime: number;
  components: Record<string, { status: string; message?: string }>;
}> {
  const response = await fetch(`${baseUrl}/api/health`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get diagnostics: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}
