/**
 * Client Tools Module
 * 客户端工具模块
 *
 * Handles client-side tool completion - resolves pending client-side tool calls
 * by posting results back to the gateway.
 */

import { getGatewayUrl } from "../config";

// ============================================================================
// Types
// ============================================================================

export interface ClientToolCompletePayload {
  tool_use_id: string;
  session_id: string;
  result: {
    content: Array<
      | { type: "text"; text: string }
      | { type: "image"; data: string; mimeType: string }
    >;
    isError?: boolean;
  };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * POST to /api/client-tools/complete to resolve a pending client-side tool call.
 */
export async function completeClientTool(
  params: ClientToolCompletePayload
): Promise<{ success: boolean }> {
  const url = `${getGatewayUrl()}/api/client-tools/complete`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ||
        `completeClientTool failed: ${res.status}`
    );
  }
  return res.json();
}
