/**
 * Skill marketplace registry integration
 *
 * Uses @viben/api-client for API calls.
 */
import { writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { VibenClient } from "@viben/api-client";
import { readToken, VIBEN_WEB_URL } from "../../auth";
import { ensureDir } from "../../config/yaml";
import { extractZipToDirectory } from "./extract";

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
