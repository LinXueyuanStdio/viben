/**
 * Skill operations module
 *
 * Re-exports all skill-related operations for use by commands and other modules.
 *
 * Module structure:
 * - types.ts       - Type definitions (SkillTarget, Result types, etc.)
 * - paths.ts       - Path resolution utilities
 * - crud.ts        - Create, Read, Update, Delete operations
 * - config.ts      - Agent skill configuration (enable/disable)
 * - marketplace.ts - Marketplace listing and search
 * - extract.ts     - ZIP extraction utilities
 */

// =============================================================================
// Types - re-export everything from types.ts
// =============================================================================

export type {
  // Core types from types/index.ts
  Skill,
  InstalledSkill,
  // Target types
  SkillTarget,
  // Base result type
  SkillResult,
  // Installation types
  InstallSkillOptions,
  InstallSkillResult,
  UninstallSkillOptions,
  UninstallSkillResult,
  // List/Query types
  ListSkillsOptions,
  InstalledSkillInfo,
  ListSkillsResult,
  SkillInfo,
  GetSkillResult,
  // Enable/Disable types
  EnableSkillResult,
  AgentSkillConfig,
  // Metadata types
  InstalledSkillsFile,
  InstalledSkillEntry,
  SkillMetadata,
  // Marketplace types
  AvailableSkill,
  MarketplaceSearchOptions,
  MarketplaceResult,
} from "./types";

// =============================================================================
// Path utilities
// =============================================================================

export {
  getSkillsBaseDir,
  getSharedSkillsDir,
  getClaudeSkillsDir,
  getAgentSkillsDir,
  getSkillDir,
  getInstalledYamlPath,
  resolveTargetDir,
  validateTargetOptions,
} from "./paths";

// =============================================================================
// CRUD operations
// =============================================================================

export {
  installSkill,
  uninstallSkill,
  listSkills,
  getSkill,
} from "./crud";

// =============================================================================
// Config operations
// =============================================================================

export {
  enableSkill,
  disableSkill,
  getEnabledSkills,
} from "./config";

// =============================================================================
// Marketplace operations
// =============================================================================

export {
  listAvailableSkills,
  searchSkills,
} from "./marketplace";

// =============================================================================
// Registry operations (uses @viben/api-client)
// =============================================================================

export {
  listPlatformSkillRegistry,
  searchPlatformSkillRegistry,
  getPlatformSkillFromRegistry,
  togglePlatformSkillFavorite,
  searchSkillRegistry,
  getSkillFromRegistry,
  downloadSkillFromRegistry,
  listClawhubSkillPackages,
  searchClawhubSkills,
} from "./registry";
export type {
  MarketplaceSkill,
  SkillRegistrySearchOptions,
  SkillRegistryListOptions,
  SkillRegistrySearchResult,
  SkillRegistryGetResult,
  PlatformSkillRegistryResult,
  PlatformSkillRegistryGetResult,
  PlatformSkillFavoriteResult,
  ClawhubSkillSortOption,
  ClawhubPackageItem,
  ClawhubPackageListResponse,
  ClawhubOwner,
  ClawhubSearchResult,
  ClawhubSearchResponse,
  ClawhubPackageListOptions,
  ClawhubSkillSearchOptions,
} from "./registry";

// =============================================================================
// Extract utilities
// =============================================================================

export type {
  ProgressCallback,
  ConflictResolution,
  FileConflict,
  ExtractZipOptions,
  ExtractZipResult,
  SkillMetadataFromContent,
} from "./extract";

export {
  extractZipToDirectory,
  parseSkillMetadataFromContent,
  getZipRootDirectory,
} from "./extract";
