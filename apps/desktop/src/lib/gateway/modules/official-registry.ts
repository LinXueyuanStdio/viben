/**
 * Official Registry Module
 * 官方注册表模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type { OfficialServerDisplay, OfficialServerListResponse } from "../types";

// ============================================================================
// Transform helpers (gateway returns snake_case, frontend expects camelCase)
// ============================================================================

/**
 * Transform a single server from gateway snake_case to frontend camelCase
 */
function transformServer(raw: Record<string, unknown>): OfficialServerDisplay {
  return {
    id: raw.id as string,
    name: raw.name as string,
    slug: raw.slug as string,
    version: raw.version as string,
    description: (raw.description ?? null) as string | null,
    iconUrl: (raw.icon_url ?? null) as string | null,
    repositoryUrl: (raw.repository_url ?? null) as string | null,
    websiteUrl: (raw.website_url ?? null) as string | null,
    status: (raw.status ?? "active") as "active" | "deprecated" | "deleted",
    isLatest: (raw.is_latest ?? true) as boolean,
    publishedAt: (raw.published_at ?? new Date().toISOString()) as string,
    updatedAt: (raw.updated_at ?? new Date().toISOString()) as string,
    packageTypes: (raw.package_types ?? []) as OfficialServerDisplay["packageTypes"],
    hasRemotes: (raw.has_remotes ?? false) as boolean,
    _original: raw._original as OfficialServerDisplay["_original"],
  };
}

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

  const raw = await response.json();
  return {
    servers: (raw.servers ?? []).map(transformServer),
    nextCursor: raw.next_cursor ?? null,
    count: raw.count ?? 0,
  };
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

  const raw = await response.json();
  return transformServer(raw);
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
