/**
 * Marketplace Types
 * 市场类型定义
 */

// ============================================================================
// Marketplace Category Types
// ============================================================================

/** Marketplace category */
export interface MarketplaceCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  plugin_count: number;
  source_count: number;
}

// ============================================================================
// Marketplace Plugin Types
// ============================================================================

/** Marketplace plugin */
export interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  version?: string;
  author_name: string;
  author_email?: string;
  author_url?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  categories: string[];
  builtin: boolean;
  package?: string;
  source_count: number;
  sources: string[];
}

/** Provider index */
export interface ProviderIndex {
  version: string;
  updated_at?: string;
  categories: MarketplaceCategory[];
  plugins: MarketplacePlugin[];
}

/** Flat source for UI display */
export interface FlatSource {
  id: string;
  source_name: string;
  plugin_id: string;
  name: string;
  description: string;
  category?: string;
  api_key_type: "none" | "optional" | "required";
  documentation?: string;
  plugin_name: string;
}

// ============================================================================
// ============================================================================
// Official Registry Types
// ============================================================================

export type {
  OfficialServerDisplay,
  OfficialPackage,
  OfficialPackageRegistryType,
} from "@/types/official-registry";

import type { OfficialServerDisplay } from "@/types/official-registry";

/** Response for listing official servers */
export interface OfficialServerListResponse {
  servers: OfficialServerDisplay[];
  nextCursor: string | null;
  count: number;
}
