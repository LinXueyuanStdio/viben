/**
 * ClaWHub Registry Types
 *
 * Based on the ClaWHub API v1
 * See: https://clawhub.ai/api/v1/
 *
 * NOTE: ClaWHub API uses camelCase for all field names (e.g., displayName, createdAt).
 * This is an external API convention. Our internal convention per CLAUDE.md is to use
 * snake_case for API parameters and file storage, but we preserve camelCase here to
 * match the external ClaWHub API exactly.
 */

// ============================================================================
// Package Types
// ============================================================================

/**
 * Package item in list response (from /packages endpoint)
 */
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

// ============================================================================
// Search Types
// ============================================================================

/**
 * Owner info returned in search results
 */
export interface ClawhubOwner {
  handle: string;
  displayName?: string;
  image?: string | null;
}

/**
 * Search result item
 */
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

/**
 * Search response
 */
export interface ClawhubSearchResponse {
  results: ClawhubSearchResult[];
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response for listing packages
 */
export interface ClawhubPackageListResponse {
  items: ClawhubPackageItem[];
  nextCursor?: string | null;
}

// ============================================================================
// Transformed Types (for UI)
// ============================================================================

/**
 * Simplified skill info for display in UI
 */
export type ClawhubSkillSortOption = "updated" | "downloads" | "stars" | "trending";

export interface ClawhubSkillDisplay {
  /** Skill slug (used as ID) */
  id: string;
  /** Display name */
  name: string;
  /** Skill slug (URL-safe) */
  slug: string;
  /** Version string */
  version: string;
  /** Summary/Description */
  description: string | null;
  /** Owner handle */
  ownerHandle: string | null;
  /** Owner display name (from search results) */
  ownerName: string | null;
  /** Owner avatar URL (from search results) */
  ownerAvatar: string | null;
  /** Whether the skill is official */
  isOfficial: boolean;
  /** Whether the skill executes code */
  executesCode: boolean;
  /** Channel (official/community/private) */
  channel: string;
  /** Download count */
  downloads: number;
  /** Star count */
  stars: number;
  /** Created timestamp (ms) */
  createdAt: number;
  /** Updated timestamp (ms) */
  updatedAt: number;
}
