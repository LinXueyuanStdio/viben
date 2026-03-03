/**
 * Official Registry Module
 * 官方注册表模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type { OfficialServerDisplay, OfficialServerListResponse } from "../types";

// ============================================================================
// Official Registry
// ============================================================================

/**
 * List official servers
 */
export async function listOfficialServers(
  baseUrl: string,
  params?: {
    cursor?: string;
    search?: string;
    limit?: number;
  }
): Promise<OfficialServerListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.cursor) searchParams.set("cursor", params.cursor);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.limit) searchParams.set("limit", String(params.limit));

  const response = await fetch(
    `${baseUrl}/api/official-registry/servers?${searchParams.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list official servers: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get a specific official server
 */
export async function getOfficialServer(
  baseUrl: string,
  name: string
): Promise<OfficialServerDisplay | null> {
  const response = await fetch(
    `${baseUrl}/api/official-registry/servers/${encodeURIComponent(name)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get official server: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get versions for a specific official server
 */
export async function getOfficialServerVersions(
  baseUrl: string,
  name: string
): Promise<string[]> {
  const response = await fetch(
    `${baseUrl}/api/official-registry/servers/${encodeURIComponent(name)}/versions`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    return [];
  }

  return response.json();
}

/**
 * Clear official registry cache
 */
export async function clearOfficialRegistryCache(
  baseUrl: string
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/official-registry/cache`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to clear official registry cache: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Invalidate cache for a specific official server
 */
export async function invalidateOfficialServerCache(
  baseUrl: string,
  name: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/official-registry/servers/${encodeURIComponent(name)}/cache`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to invalidate server cache: ${errorMessage}`,
      response.status
    );
  }
}
