/**
 * API Keys Module
 * API 密钥管理模块
 *
 * Note: API key operations are performed through the Provider API.
 * setApiKey and clearApiKey use updateProvider internally.
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import { updateProvider } from "./providers";

// ============================================================================
// API Key Management
// ============================================================================

/**
 * Set API key for provider
 * Uses updateProvider internally to set the api_key field
 */
export async function setApiKey(
  baseUrl: string,
  providerId: string,
  apiKey: string
): Promise<void> {
  await updateProvider(baseUrl, providerId, { apiKey });
}

/**
 * Clear API key for provider (delete)
 * Uses updateProvider internally to set api_key to empty string
 */
export async function clearApiKey(
  baseUrl: string,
  providerId: string
): Promise<void> {
  await updateProvider(baseUrl, providerId, { apiKey: "" });
}

/**
 * Validate an API key for a provider
 * Tests if the provided API key is valid for the specified provider
 */
export async function validateApiKey(
  baseUrl: string,
  providerId: string,
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
  const response = await fetch(`${baseUrl}/api/providers/validate-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ provider_id: providerId, api_key: apiKey }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to validate API key: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get all API keys (masked)
 * Returns a map of provider_id -> masked_api_key
 */
export async function getAllApiKeys(
  baseUrl: string
): Promise<Record<string, string>> {
  const response = await fetch(`${baseUrl}/api/providers/api-keys/all`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get all API keys: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Verify API key for provider (simple boolean check)
 * @deprecated Use validateApiKey for more detailed response
 */
export async function verifyApiKey(
  baseUrl: string,
  providerId: string,
  apiKey: string
): Promise<boolean> {
  try {
    const result = await validateApiKey(baseUrl, providerId, apiKey);
    return result.valid;
  } catch {
    return false;
  }
}
