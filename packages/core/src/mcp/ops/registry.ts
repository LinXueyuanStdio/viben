/**
 * MCP marketplace registry integration
 *
 * Uses @viben/api-client for API calls with proxy support.
 */
import { writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { VibenClient } from "@viben/api-client";
import { readToken, VIBEN_WEB_URL } from "../../auth";
import { ensureDir } from "../../config/yaml";
import { extractZipToDirectory } from "../../skill/ops/extract";
import type {
  MarketplaceSearchOptions,
  MarketplaceSearchResult,
  MarketplaceGetResult,
  MarketplaceMcp,
} from "./types";

// =============================================================================
// Client Factory
// =============================================================================

/**
 * Create a Viben API client with auth token
 */
async function createClient(): Promise<VibenClient> {
  const client = new VibenClient({
    baseUrl: VIBEN_WEB_URL,
  });

  // Set auth token if available
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
 * Search MCP packages in marketplace
 */
export async function searchMarketplace(
  options: MarketplaceSearchOptions
): Promise<MarketplaceSearchResult> {
  try {
    const client = await createClient();
    const response = await client.mcp.search(options.query, {
      page: options.page,
      limit: options.limit,
    });

    return {
      success: true,
      mcps: response.data.map(toMarketplaceMcp),
      total: response.pagination.total,
      page: response.pagination.page,
      total_pages: response.pagination.totalPages,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
      mcps: [],
      total: 0,
      page: 1,
      total_pages: 0,
    };
  }
}

/**
 * Get MCP package details from marketplace
 */
export async function getFromMarketplace(
  idOrSlug: string
): Promise<MarketplaceGetResult> {
  try {
    const client = await createClient();
    const response = await client.mcp.get(idOrSlug);

    return {
      success: true,
      mcp: toMarketplaceMcp(response.package),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Package not found",
    };
  }
}

/**
 * Download MCP package from marketplace
 *
 * @param idOrSlug - Package ID or slug
 * @param version - Optional version
 * @param targetDir - Directory to extract to
 */
export async function downloadFromMarketplace(
  idOrSlug: string,
  version: string | undefined,
  targetDir: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await createClient();
    const blob = await client.mcp.download(idOrSlug, version);

    // Ensure target directory exists
    await ensureDir(targetDir);

    // Write the zip file
    const zipPath = join(targetDir, "package.zip");
    const buffer = Buffer.from(await blob.arrayBuffer());
    await writeFile(zipPath, buffer);

    // Extract the zip
    await extractZipToDirectory({
      zipPath,
      targetDir,
      overwrite: true,
      validate: false, // MCP doesn't have SKILL.md
    });

    // Remove the zip file
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
// Helpers
// =============================================================================

/**
 * Convert API response to MarketplaceMcp
 */
function toMarketplaceMcp(pkg: {
  id: string;
  name: string;
  slug: string;
  version: string;
  description?: string | null;
  author?: { username: string; displayName: string } | null;
  downloadsCount: number;
  favoritesCount: number;
}): MarketplaceMcp {
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
  };
}
