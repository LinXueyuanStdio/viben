/**
 * Skill-specific types (re-exports from main types for convenience)
 */
export type { Skill, InstalledSkill } from "../types";

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
}
