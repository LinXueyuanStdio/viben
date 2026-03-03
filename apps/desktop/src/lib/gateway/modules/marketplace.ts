/**
 * Marketplace Module
 * 市场模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type { ProviderIndex, FlatSource } from "../types";

// ============================================================================
// Marketplace
// ============================================================================

/**
 * Get provider index
 */
export async function getProviderIndex(
  baseUrl: string,
  forceRefresh = false
): Promise<ProviderIndex> {
  const params = new URLSearchParams();
  if (forceRefresh) params.set("force_refresh", "true");

  const response = await fetch(
    `${baseUrl}/api/marketplace/index?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get provider index: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get flat sources list
 */
export async function getFlatSources(baseUrl: string): Promise<FlatSource[]> {
  const response = await fetch(`${baseUrl}/api/marketplace/sources`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get sources: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Clear provider cache
 */
export async function clearProviderCache(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/marketplace/cache`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to clear provider cache: ${errorMessage}`,
      response.status
    );
  }
}
