/**
 * Skill module type definitions
 *
 * This is the single source of truth for all skill-related types.
 * All other modules should import types from here.
 */

// Re-export core types
export type { Skill, InstalledSkill } from "../../types/index";

// =============================================================================
// Target Types
// =============================================================================

/**
 * Installation target for skills
 * - "agent": Install to ~/.viben/agents/<id>/skills/
 * - "global": Install to ~/.viben/skills/
 * - "claude": Install to ~/.claude/skills/
 * - "custom": Install to specified customPath
 */
export type SkillTarget = "agent" | "global" | "claude" | "custom";

// =============================================================================
// Base Result Type
// =============================================================================

/**
 * Base result type following task ops pattern
 */
export interface SkillResult {
  success: boolean;
  error?: string;
}

// =============================================================================
// Installation Types
// =============================================================================

/**
 * Options for installing a skill
 */
export interface InstallSkillOptions {
  /** Skill name (or name@version) */
  name: string;
  /** Installation target */
  target: SkillTarget;
  /** Agent ID when target is "agent" */
  agentId?: string;
  /** Custom path when target is "custom" */
  customPath?: string;
  /** Force reinstall if already exists */
  force?: boolean;
  /** Skill version (extracted from name@version or specified separately) */
  version?: string;
  /** Source path for local skills */
  sourcePath?: string;
  /** Zip file path for packaged skills */
  zipPath?: string;
  /** Progress callback for installation */
  onProgress?: (progress: number) => void;
  /** Executor name (e.g., "CLAUDE_CODE") - affects installation target */
  executor?: string;
  /** Conflict resolution strategy for file conflicts (default: "fail") */
  conflictResolution?: "skip" | "overwrite" | "fail";
}

/**
 * Result of skill installation
 */
export interface InstallSkillResult extends SkillResult {
  name: string;
  version: string;
  path: string;
  target: SkillTarget;
  message: string;
}

/**
 * Options for uninstalling a skill
 */
export interface UninstallSkillOptions {
  /** Skill name */
  name: string;
  /** Installation target */
  target: SkillTarget;
  /** Agent ID when target is "agent" */
  agentId?: string;
  /** Custom path when target is "custom" */
  customPath?: string;
}

/**
 * Result of skill uninstallation
 */
export interface UninstallSkillResult extends SkillResult {
  name: string;
  message: string;
}

// =============================================================================
// List/Query Types
// =============================================================================

/**
 * Options for listing installed skills
 */
export interface ListSkillsOptions {
  /** Filter by target */
  target?: SkillTarget;
  /** Agent ID when target is "agent" */
  agentId?: string;
  /** Custom path when target is "custom" */
  customPath?: string;
}

/**
 * Installed skill info for list results
 */
export interface InstalledSkillInfo {
  name: string;
  version: string;
  path: string;
  installedAt: string;
  source?: "local" | "marketplace";
}

/**
 * Result of listing installed skills
 */
export interface ListSkillsResult extends SkillResult {
  skills: InstalledSkillInfo[];
  count: number;
}

/**
 * Skill info for get results
 */
export interface SkillInfo {
  id: string;
  name: string;
  description?: string;
  version: string;
  path: string;
  source: "local" | "marketplace";
}

/**
 * Result of getting skill details
 */
export interface GetSkillResult extends SkillResult {
  skill?: SkillInfo;
}

// =============================================================================
// Enable/Disable Types
// =============================================================================

/**
 * Result of enabling/disabling a skill
 */
export interface EnableSkillResult extends SkillResult {
  skillName: string;
  agentId: string;
  enabled: boolean;
  enabledAt?: string;
}

/**
 * Agent skill configuration (enabled/disabled state)
 */
export interface AgentSkillConfig {
  skillName: string;
  enabled: boolean;
  agentId: string;
  enabledAt?: string;
}

// =============================================================================
// Metadata Types
// =============================================================================

/**
 * Installed skills tracking file
 */
export interface InstalledSkillsFile {
  installed: InstalledSkillEntry[];
}

/**
 * Installed skill entry
 */
export interface InstalledSkillEntry {
  name: string;
  version: string;
  path: string;
  source: "local" | "marketplace";
  installedAt: string;
}

/**
 * Skill metadata from SKILL.md frontmatter
 */
export interface SkillMetadata {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  tags?: string[];
  triggers?: string[];
  tools?: string[];
}

// =============================================================================
// Marketplace Types
// =============================================================================

/**
 * Available skill from registry
 */
export interface AvailableSkill {
  name: string;
  version: string;
  description?: string;
  author?: string;
  tags?: string[];
  downloadUrl?: string;
}

/**
 * Options for searching marketplace
 */
export interface MarketplaceSearchOptions {
  /** Search query */
  query?: string;
  /** Filter by tags */
  tags?: string[];
  /** Filter by author */
  author?: string;
  /** Maximum results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Result of marketplace operations
 */
export interface MarketplaceResult extends SkillResult {
  skills: AvailableSkill[];
  total: number;
}
