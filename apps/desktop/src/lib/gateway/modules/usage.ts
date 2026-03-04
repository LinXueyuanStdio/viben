/**
 * Usage Module
 * 使用统计模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type { UsageStats, ApiKeyUsage } from "../types";

// ============================================================================
// Usage Tracking
// ============================================================================

/**
 * Initialize usage tracking
 */
export async function initUsage(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/usage/init`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to initialize usage: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Get usage statistics
 */
export async function getUsageStats(baseUrl: string): Promise<UsageStats> {
  const response = await fetch(`${baseUrl}/api/usage/stats`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get usage stats: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Record a usage event
 */
export async function recordUsage(
  baseUrl: string,
  serverId: string,
  sourceId: string,
  apiKeyId?: string
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/usage/record`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      server_id: serverId,
      source_id: sourceId,
      api_key_id: apiKeyId,
    }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to record usage: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Get usage for a specific API key
 */
export async function getApiKeyUsage(
  baseUrl: string,
  keyId: string
): Promise<ApiKeyUsage> {
  const response = await fetch(
    `${baseUrl}/api/usage/api-key/${encodeURIComponent(keyId)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get API key usage: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get usage for a specific server
 */
export async function getServerUsage(
  baseUrl: string,
  serverId: string
): Promise<number> {
  const response = await fetch(
    `${baseUrl}/api/usage/server/${encodeURIComponent(serverId)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get server usage: ${errorMessage}`,
      response.status
    );
  }

  const result = await response.json();
  return result.usage_count;
}

/**
 * Get usage for a specific source
 */
export async function getSourceUsage(
  baseUrl: string,
  sourceId: string
): Promise<number> {
  const response = await fetch(
    `${baseUrl}/api/usage/source/${encodeURIComponent(sourceId)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get source usage: ${errorMessage}`,
      response.status
    );
  }

  const result = await response.json();
  return result.usage_count;
}
