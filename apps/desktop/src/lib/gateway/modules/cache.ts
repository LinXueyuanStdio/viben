/**
 * Cache Module
 * 缓存/离线管理模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type { CacheInfo, CacheSettings } from "../types";

// ============================================================================
// Cache / Offline
// ============================================================================

/**
 * Check if offline
 */
export async function isOffline(baseUrl: string): Promise<boolean> {
  const response = await fetch(`${baseUrl}/api/cache/offline`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return true; // Assume offline if we can't check
  }

  const data = await response.json();
  return data.offline;
}

/**
 * Get cache info
 */
export async function getCacheInfo(baseUrl: string): Promise<CacheInfo> {
  const response = await fetch(`${baseUrl}/api/cache/info`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get cache info: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get cache settings
 */
export async function getCacheSettings(
  baseUrl: string
): Promise<CacheSettings> {
  const response = await fetch(`${baseUrl}/api/cache/settings`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get cache settings: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Update cache settings
 */
export async function setCacheSettings(
  baseUrl: string,
  settings: Partial<CacheSettings>
): Promise<CacheSettings> {
  const response = await fetch(`${baseUrl}/api/cache/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to set cache settings: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Refresh cache
 */
export async function refreshCache(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/cache/refresh`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to refresh cache: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Clear cache
 */
export async function clearCache(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/cache`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to clear cache: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Check if cache should be refreshed
 */
export async function shouldRefreshCache(baseUrl: string): Promise<boolean> {
  const response = await fetch(`${baseUrl}/api/cache/should-refresh`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return false;
  }

  const data = await response.json();
  return data.should_refresh;
}
