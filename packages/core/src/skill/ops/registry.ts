/**
 * Skill marketplace registry integration
 *
 * Uses @viben/api-client for API calls with proxy support.
 */
import { writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { VibenClient, VIBEN_WEB_URL } from "@viben/api-client";
import type { PaginatedResponse, SkillListParams, SkillPackage } from "@viben/api-client";
import { readToken } from "../../auth";
import { ensureDir } from "../../config/yaml";
import { extractZipToDirectory } from "./extract";
import { proxyFetch } from "../../http";

// =============================================================================
// Types
// =============================================================================

/**
 * Marketplace skill from registry
 */
export interface MarketplaceSkill {
  id: string;
  name: string;
  slug: string;
  version: string;
  description?: string;
  author?: {
    username: string;
    display_name: string;
  };
  downloads_count: number;
  favorites_count: number;
  skill_type: "command" | "prompt" | "agent";
}

/**
 * Options for searching marketplace
 */
export interface SkillRegistrySearchOptions {
  query: string;
  limit?: number;
  page?: number;
  type?: "command" | "prompt" | "agent";
}

/**
 * Options for listing marketplace skill packages
 */
export interface SkillRegistryListOptions {
  limit?: number;
  page?: number;
  sort?: "latest" | "popular" | "downloads";
  category?: string;
  type?: "command" | "prompt" | "agent";
}

/**
 * Result of marketplace search
 */
export interface SkillRegistrySearchResult {
  success: boolean;
  error?: string;
  skills: MarketplaceSkill[];
  total: number;
  page: number;
  total_pages: number;
}

/**
 * Result of marketplace get
 */
export interface SkillRegistryGetResult {
  success: boolean;
  error?: string;
  skill?: MarketplaceSkill;
}

/**
 * Result of platform marketplace skill package list/search
 */
export interface PlatformSkillRegistryResult {
  success: boolean;
  error?: string;
  data: SkillPackage[];
  pagination: PaginatedResponse<SkillPackage>["pagination"];
}

/**
 * Result of platform marketplace skill package get
 */
export interface PlatformSkillRegistryGetResult {
  success: boolean;
  error?: string;
  package?: SkillPackage;
}

export interface PlatformSkillFavoriteResult {
  success: boolean;
  error?: string;
  favorited: boolean;
}

export type ClawhubSkillSortOption = "updated" | "downloads" | "stars" | "trending";

export interface ClawhubPackageItem {
  name: string;
  displayName: string;
  summary?: string;
  family: "skill" | "code-plugin" | "bundle-plugin";
  channel: "official" | "community" | "private";
  isOfficial: boolean;
  executesCode: boolean;
  ownerHandle?: string;
  latestVersion?: string;
  createdAt: number;
  updatedAt: number;
  capabilityTags?: string[];
  runtimeId?: string | null;
  verificationTier?: string | null;
  stats?: {
    downloads?: number;
    installs?: number;
    stars?: number;
    versions?: number;
  };
}

export interface ClawhubPackageListResponse {
  items: ClawhubPackageItem[];
  nextCursor?: string | null;
}

export interface ClawhubOwner {
  handle: string;
  displayName?: string;
  image?: string | null;
}

export interface ClawhubSearchResult {
  score: number;
  slug: string;
  displayName: string;
  summary?: string;
  version?: string;
  updatedAt?: number;
  ownerHandle?: string;
  owner?: ClawhubOwner;
}

export interface ClawhubSearchResponse {
  results: ClawhubSearchResult[];
}

export interface ClawhubPackageListOptions {
  limit?: number;
  cursor?: string;
  sort?: ClawhubSkillSortOption;
}

export interface ClawhubSkillSearchOptions {
  query: string;
  limit?: number;
  nonSuspiciousOnly?: boolean;
}

// =============================================================================
// Client Factory
// =============================================================================

/**
 * Create a Viben API client with auth token
 */
async function createClient(): Promise<VibenClient> {
  const client = new VibenClient({
    baseUrl: VIBEN_WEB_URL,
    fetch: proxyFetch,
  });

  const token = await readToken();
  if (token) {
    client.setAccessToken(token);
  }

  return client;
}

// =============================================================================
// Search Operations
// =============================================================================

/**
 * List skill packages in the Viben marketplace.
 */
export async function listPlatformSkillRegistry(
  options: SkillRegistryListOptions = {}
): Promise<PlatformSkillRegistryResult> {
  try {
    const client = await createClient();
    const params: SkillListParams = {
      page: options.page,
      limit: options.limit,
      sort: options.sort,
      category: options.category,
      type: options.type,
    };
    const response = await client.skill.list(params);

    return {
      success: true,
      data: response.data,
      pagination: response.pagination,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "List failed",
      data: [],
      pagination: {
        page: options.page ?? 1,
        limit: options.limit ?? 20,
        total: 0,
        totalPages: 0,
      },
    };
  }
}

/**
 * Search skill packages in the Viben marketplace using the platform response shape.
 */
export async function searchPlatformSkillRegistry(
  options: SkillRegistrySearchOptions
): Promise<PlatformSkillRegistryResult> {
  try {
    const client = await createClient();
    const response = await client.skill.search(options.query, {
      page: options.page,
      limit: options.limit,
      type: options.type,
    });

    return {
      success: true,
      data: response.data,
      pagination: response.pagination,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
      data: [],
      pagination: {
        page: options.page ?? 1,
        limit: options.limit ?? 20,
        total: 0,
        totalPages: 0,
      },
    };
  }
}

/**
 * Get a skill package from the Viben marketplace using the platform response shape.
 */
export async function getPlatformSkillFromRegistry(
  idOrSlug: string
): Promise<PlatformSkillRegistryGetResult> {
  try {
    const client = await createClient();
    const response = await client.skill.get(idOrSlug);

    return {
      success: true,
      package: response.package,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Skill not found",
    };
  }
}

/**
 * Toggle a Viben marketplace skill favorite through Core/Gateway.
 */
export async function togglePlatformSkillFavorite(
  idOrSlug: string
): Promise<PlatformSkillFavoriteResult> {
  try {
    const client = await createClient();
    const response = await client.skill.toggleFavorite(idOrSlug);

    return {
      success: true,
      favorited: response.favorited,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Favorite update failed",
      favorited: false,
    };
  }
}

/**
 * Search skill packages in marketplace
 */
export async function searchSkillRegistry(
  options: SkillRegistrySearchOptions
): Promise<SkillRegistrySearchResult> {
  try {
    const client = await createClient();
    const response = await client.skill.search(options.query, {
      page: options.page,
      limit: options.limit,
      type: options.type,
    });

    return {
      success: true,
      skills: response.data.map(toMarketplaceSkill),
      total: response.pagination.total,
      page: response.pagination.page,
      total_pages: response.pagination.totalPages,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
      skills: [],
      total: 0,
      page: 1,
      total_pages: 0,
    };
  }
}

/**
 * Get skill package details from marketplace
 */
export async function getSkillFromRegistry(
  idOrSlug: string
): Promise<SkillRegistryGetResult> {
  try {
    const client = await createClient();
    const response = await client.skill.get(idOrSlug);

    return {
      success: true,
      skill: toMarketplaceSkill(response.package),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Skill not found",
    };
  }
}

/**
 * Download skill package from marketplace
 */
export async function downloadSkillFromRegistry(
  idOrSlug: string,
  version: string | undefined,
  targetDir: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await createClient();
    const blob = await client.skill.download(idOrSlug, version);

    await ensureDir(targetDir);

    const zipPath = join(targetDir, "package.zip");
    const buffer = Buffer.from(await blob.arrayBuffer());
    await writeFile(zipPath, buffer);

    await extractZipToDirectory({
      zipPath,
      targetDir,
      overwrite: true,
      validate: true,
    });

    await rm(zipPath, { force: true });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Download failed",
    };
  }
}

// =============================================================================
// ClaWHub Registry Operations
// =============================================================================

const CLAWHUB_API_URL = "https://clawhub.ai/api/v1";

/**
 * List skill packages from ClaWHub through Core/Gateway.
 */
export async function listClawhubSkillPackages(
  options: ClawhubPackageListOptions = {}
): Promise<ClawhubPackageListResponse> {
  const url = new URL(`${CLAWHUB_API_URL}/packages`);
  url.searchParams.set("family", "skill");
  url.searchParams.set("limit", String(Math.min(options.limit ?? 50, 100)));
  url.searchParams.set("sort", options.sort ?? "updated");
  if (options.cursor) {
    url.searchParams.set("cursor", options.cursor);
  }

  const response = await proxyFetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`ClaWHub API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as ClawhubPackageListResponse;
}

/**
 * Search skill packages from ClaWHub through Core/Gateway.
 */
export async function searchClawhubSkills(
  options: ClawhubSkillSearchOptions
): Promise<ClawhubSearchResponse> {
  const url = new URL(`${CLAWHUB_API_URL}/search`);
  url.searchParams.set("q", options.query);
  url.searchParams.set("limit", String(Math.min(options.limit ?? 20, 100)));
  if (options.nonSuspiciousOnly ?? true) {
    url.searchParams.set("nonSuspiciousOnly", "true");
  }

  const response = await proxyFetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`ClaWHub API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as ClawhubSearchResponse;
}

/**
 * Download skill from ClaWHub registry
 * ClaWHub download URL: GET /api/v1/packages/<name>/download → returns ZIP
 */
export async function downloadSkillFromClawhub(
  name: string,
  _version: string | undefined,
  targetDir: string
): Promise<{ success: boolean; error?: string; version?: string }> {
  try {
    await ensureDir(targetDir);

    // Fetch package info first to get version
    const infoRes = await proxyFetch(`${CLAWHUB_API_URL}/packages/${encodeURIComponent(name)}`, {
      headers: { Accept: "application/json" },
    });
    let resolvedVersion = _version || "1.0.0";
    if (infoRes.ok) {
      const info = await infoRes.json() as { package?: { latestVersion?: string } };
      if (info.package?.latestVersion) {
        resolvedVersion = info.package.latestVersion;
      }
    }

    // Download the ZIP
    const downloadUrl = `${CLAWHUB_API_URL}/packages/${encodeURIComponent(name)}/download`;
    const response = await proxyFetch(downloadUrl, {
      redirect: "follow",
    });

    if (!response.ok) {
      return {
        success: false,
        error: `ClaWHub download failed: ${response.status} ${response.statusText}`,
      };
    }

    const zipPath = join(targetDir, "package.zip");
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(zipPath, buffer);

    await extractZipToDirectory({
      zipPath,
      targetDir,
      overwrite: true,
      validate: true,
    });

    await rm(zipPath, { force: true });

    return { success: true, version: resolvedVersion };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "ClaWHub download failed",
    };
  }
}

// =============================================================================
// Helpers
// =============================================================================

function toMarketplaceSkill(pkg: {
  id: string;
  name: string;
  slug: string;
  version: string;
  description?: string | null;
  author?: { username: string; displayName: string } | null;
  downloadsCount: number;
  favoritesCount: number;
  skillType: "command" | "prompt" | "agent";
}): MarketplaceSkill {
  return {
    id: pkg.id,
    name: pkg.name,
    slug: pkg.slug,
    version: pkg.version,
    description: pkg.description ?? undefined,
    author: pkg.author
      ? {
          username: pkg.author.username,
          display_name: pkg.author.displayName,
        }
      : undefined,
    downloads_count: pkg.downloadsCount,
    favorites_count: pkg.favoritesCount,
    skill_type: pkg.skillType,
  };
}
