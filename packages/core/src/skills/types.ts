/**
 * Skill-specific types for Viben
 */
export type { Skill, InstalledSkill } from "../types";

/**
 * Installation target for skills
 */
export type SkillTarget = "agent" | "global" | "claude" | "custom";

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
  /** Executor name (e.g., "claude-code") - affects installation target */
  executor?: string;
}

/**
 * Result of skill installation
 */
export interface InstallSkillResult {
  success: boolean;
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
export interface UninstallSkillResult {
  success: boolean;
  name: string;
  message: string;
}

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
 * Agent skill configuration (enabled/disabled state)
 */
export interface AgentSkillConfig {
  skillName: string;
  enabled: boolean;
  agentId: string;
  enabledAt?: string;
}
