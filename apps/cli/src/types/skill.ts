/**
 * Skill Service Types
 *
 * Type definitions for skills in Viben CLI.
 */

/**
 * Installed skill entry in installed.yaml
 */
export interface InstalledSkill {
  /** Skill version */
  version: string;
  /** Installation timestamp (ISO 8601 format) */
  installed_at: string;
  /** Optional description */
  description?: string;
}

/**
 * Skill with id populated (for display/operations)
 */
export interface Skill extends InstalledSkill {
  /** Skill identifier/name */
  id: string;
}

/**
 * Skills configuration file structure
 * Stored in ~/.viben/skills/installed.yaml
 */
export interface SkillsConfig {
  version: number;
  skills: Record<string, InstalledSkill>;
}

/**
 * Available skill from marketplace (for --available option)
 */
export interface AvailableSkill {
  /** Skill identifier/name */
  id: string;
  /** Display name */
  name: string;
  /** Latest version */
  version: string;
  /** Short description */
  description: string;
}

/**
 * Default skills configuration
 */
export const DEFAULT_SKILLS_CONFIG: SkillsConfig = {
  version: 1,
  skills: {},
};

/**
 * Skills config file name
 */
export const SKILLS_CONFIG_FILE = 'installed.yaml';

/**
 * Skills directory name under ~/.viben
 */
export const SKILLS_DIR = 'skills';
