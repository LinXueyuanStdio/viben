/**
 * ClaWHub Registry Types
 *
 * Based on the ClaWHub API v1
 * See: https://clawhub.ai/api/v1/
 */

// ============================================================================
// Skill Types
// ============================================================================

/**
 * Stats for a skill
 */
export interface ClawhubSkillStats {
  downloads?: number;
  stars?: number;
  installs?: number;
}

/**
 * Version information
 */
export interface ClawhubSkillVersion {
  version: string;
  createdAt: number;
  changelog?: string;
}

/**
 * Platform metadata
 */
export interface ClawhubSkillMetadata {
  /** OS restrictions (e.g., ["macos"], ["linux"]) */
  os?: string[] | null;
  /** Nix system targets (e.g., ["aarch64-darwin", "x86_64-linux"]) */
  systems?: string[] | null;
}

/**
 * Owner information
 */
export interface ClawhubSkillOwner {
  handle: string;
  displayName?: string;
  image?: string | null;
}

/**
 * Moderation information
 */
export interface ClawhubSkillModeration {
  isSuspicious: boolean;
  isMalwareBlocked: boolean;
  verdict: 'clean' | 'suspicious' | 'malicious';
  reasonCodes: string[];
  summary?: string | null;
  engineVersion?: string;
  updatedAt?: number;
}

/**
 * Skill tags (version mapping)
 */
export interface ClawhubSkillTags {
  latest?: string;
  [key: string]: string | undefined;
}

/**
 * Skill item in list response
 */
export interface ClawhubSkillListItem {
  slug: string;
  displayName: string;
  summary?: string;
  tags: ClawhubSkillTags;
  stats: ClawhubSkillStats;
  createdAt: number;
  updatedAt: number;
  latestVersion?: ClawhubSkillVersion;
  metadata?: ClawhubSkillMetadata | null;
}

/**
 * Full skill detail
 */
export interface ClawhubSkillDetail {
  slug: string;
  displayName: string;
  summary?: string;
  tags: ClawhubSkillTags;
  stats: ClawhubSkillStats;
  createdAt: number;
  updatedAt: number;
}

/**
 * Skill detail response
 */
export interface ClawhubSkillDetailResponse {
  skill: ClawhubSkillDetail;
  latestVersion?: ClawhubSkillVersion;
  metadata?: ClawhubSkillMetadata | null;
  owner?: ClawhubSkillOwner;
  moderation?: ClawhubSkillModeration;
}

// ============================================================================
// Search Types
// ============================================================================

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
 * Response for listing skills
 */
export interface ClawhubSkillListResponse {
  items: ClawhubSkillListItem[];
  nextCursor?: string | null;
}

/**
 * Sort options for skills list
 */
export type ClawhubSkillSortOption =
  | 'updated'
  | 'downloads'
  | 'stars'
  | 'rating'
  | 'installs'
  | 'installsCurrent'
  | 'installsAllTime'
  | 'trending';

/**
 * Query parameters for skills list endpoint
 */
export interface ClawhubSkillListParams {
  limit?: number;
  cursor?: string;
  sort?: ClawhubSkillSortOption;
  nonSuspiciousOnly?: boolean;
}

/**
 * Query parameters for search endpoint
 */
export interface ClawhubSearchParams {
  q: string;
  limit?: number;
  highlightedOnly?: boolean;
  nonSuspiciousOnly?: boolean;
}

// ============================================================================
// Transformed Types (for UI)
// ============================================================================

/**
 * Simplified skill info for display in UI
 */
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
  /** Owner display name */
  ownerName: string | null;
  /** Owner avatar URL */
  ownerAvatar: string | null;
  /** Download count */
  downloads: number;
  /** Star count */
  stars: number;
  /** Install count */
  installs: number;
  /** OS restrictions */
  os: string[] | null;
  /** System targets */
  systems: string[] | null;
  /** Created timestamp (ms) */
  createdAt: number;
  /** Updated timestamp (ms) */
  updatedAt: number;
  /** Moderation status */
  isSuspicious: boolean;
  /** Original data for detail page */
  _original?: ClawhubSkillListItem | ClawhubSkillDetailResponse;
}

// ============================================================================
// API Route Types
// ============================================================================

/**
 * Response from our API route for listing skills
 */
export interface ClawhubRegistryApiResponse {
  skills: ClawhubSkillDisplay[];
  nextCursor: string | null;
}

/**
 * Response from our API route for skill detail
 */
export interface ClawhubSkillApiResponse {
  skill: ClawhubSkillDisplay;
  content?: string;
}
