/**
 * API Keys Module
 * API 密钥管理模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";

// ============================================================================
// API Key Management
// ============================================================================

/**
 * Set API key for provider
 */
export async function setApiKey(
  baseUrl: string,
  providerId: string,
  apiKey: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/providers/${encodeURIComponent(providerId)}/api-key`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ api_key: apiKey }),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to set API key: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Clear API key for provider
 */
export async function clearApiKey(
  baseUrl: string,
  providerId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/providers/${encodeURIComponent(providerId)}/api-key`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to clear API key: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Verify API key for provider
 */
export async function verifyApiKey(
  baseUrl: string,
  providerId: string
): Promise<boolean> {
  const response = await fetch(
    `${baseUrl}/api/providers/${encodeURIComponent(providerId)}/api-key/verify`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    return false;
  }

  const result = await response.json();
  return result.valid;
}
