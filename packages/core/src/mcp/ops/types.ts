/**
 * MCP ops module type definitions
 *
 * Mirrors skill/ops/types.ts structure for consistency.
 */

// Re-export core types
export type { McpServer, InstalledMcp } from "../../types/index";

// =============================================================================
// Target Types
// =============================================================================

/**
 * Installation target for MCP packages
 * - "project": Install to .viben/mcp/ (default)
 * - "global": Install to ~/.viben/mcp/
 */
export type McpTarget = "project" | "global";

// =============================================================================
// Base Result Type
// =============================================================================

/**
 * Base result type following task ops pattern
 */
export interface McpResult {
  success: boolean;
  error?: string;
}

// =============================================================================
// Installation Types
// =============================================================================

/**
 * Install spec parsed result
 */
export interface ParsedInstallSpec {
  /** Package name */
  name: string;
  /** Version (from @version or explicit) */
  version?: string;
  /** Source type */
  source: "marketplace" | "github" | "local";
  /** GitHub owner (for gh: source) */
  github_owner?: string;
  /** GitHub repo (for gh: source) */
  github_repo?: string;
  /** GitHub ref - tag/branch/commit (for gh: source) */
  github_ref?: string;
  /** Local path (for local source) */
  local_path?: string;
}

/**
 * Options for installing an MCP package
 */
export interface InstallMcpOptions {
  /** Install spec (name, name@version, gh:user/repo, ./path) */
  spec: string;
  /** Installation target */
  target: McpTarget;
  /** Force reinstall if already exists */
  force?: boolean;
  /** Progress callback for installation */
  on_progress?: (progress: number) => void;
}

/**
 * Result of MCP installation
 */
export interface InstallMcpResult extends McpResult {
  name: string;
  version: string;
  path: string;
  target: McpTarget;
  source: "marketplace" | "github" | "local";
  message: string;
}

/**
 * Options for uninstalling an MCP package
 */
export interface UninstallMcpOptions {
  /** Package name */
  name: string;
  /** Installation target */
  target: McpTarget;
}

/**
 * Result of MCP uninstallation
 */
export interface UninstallMcpResult extends McpResult {
  name: string;
  message: string;
}

// =============================================================================
// List/Query Types
// =============================================================================

/**
 * Options for listing installed MCPs
 */
export interface ListMcpOptions {
  /** Filter by target (if not specified, list all) */
  target?: McpTarget;
  /** Include both project and global */
  all?: boolean;
}

/**
 * Installed MCP info for list results
 */
export interface InstalledMcpInfo {
  name: string;
  version: string;
  path: string;
  installed_at: string;
  source?: "marketplace" | "github" | "local";
  spec?: string;
  target: McpTarget;
}

/**
 * Result of listing installed MCPs
 */
export interface ListMcpResult extends McpResult {
  mcps: InstalledMcpInfo[];
  count: number;
}

/**
 * MCP info for get results
 */
export interface McpInfo {
  name: string;
  version: string;
  description?: string;
  path: string;
  source: "marketplace" | "github" | "local";
  target: McpTarget;
}

/**
 * Result of getting MCP details
 */
export interface GetMcpResult extends McpResult {
  mcp?: McpInfo;
}

// =============================================================================
// Marketplace Types
// =============================================================================

/**
 * Options for searching marketplace
 */
export interface MarketplaceSearchOptions {
  /** Search query */
  query: string;
  /** Maximum results */
  limit?: number;
  /** Page number */
  page?: number;
}

/**
 * MCP package from marketplace
 */
export interface MarketplaceMcp {
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
}

/**
 * Result of marketplace search
 */
export interface MarketplaceSearchResult extends McpResult {
  mcps: MarketplaceMcp[];
  total: number;
  page: number;
  total_pages: number;
}

/**
 * Result of marketplace get
 */
export interface MarketplaceGetResult extends McpResult {
  mcp?: MarketplaceMcp;
}

// =============================================================================
// Installed File Types
// =============================================================================

/**
 * Installed MCPs tracking file (installed.yaml)
 */
export interface InstalledMcpsFile {
  installed: InstalledMcpEntry[];
}

/**
 * Installed MCP entry
 */
export interface InstalledMcpEntry {
  name: string;
  version: string;
  path: string;
  source: "marketplace" | "github" | "local";
  installed_at: string;
  spec?: string;
}
