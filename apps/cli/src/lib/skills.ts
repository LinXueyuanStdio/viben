/**
 * Skills Management for Viben CLI
 *
 * Handles reading/writing skills configuration and managing skill installations.
 * Uses NAPI bindings to viben-core for all operations.
 */

import {
  skillList,
  skillGet,
  skillIsInstalled,
  skillInstall,
  skillUninstall,
  skillValidateId,
  skillParseName,
  skillGetAvailable,
  skillGetDir,
  type NativeSkill,
  type NativeAvailableSkill,
  type ParsedSkillName,
} from './native';

// Re-export types with CLI-friendly names
export type { NativeSkill as Skill, NativeAvailableSkill as AvailableSkill };

/**
 * Installed skill entry (for compatibility)
 */
export interface InstalledSkill {
  version: string;
  installed_at: string;
  description?: string;
}

/**
 * Get the skills directory path
 */
export function getSkillsDir(): string {
  return skillGetDir();
}

/**
 * Get a skill by ID
 * Returns the full Skill with id populated, or null if not found
 */
export function getSkill(id: string): NativeSkill | null {
  return skillGet(id);
}

/**
 * List all installed skills
 * Returns array of Skill objects with id populated
 */
export function listSkills(): NativeSkill[] {
  return skillList();
}

/**
 * Check if a skill is installed
 */
export function isSkillInstalled(id: string): boolean {
  return skillIsInstalled(id);
}

/**
 * Parse skill name with optional version
 * Supports formats: "skill-name" or "skill-name@version"
 */
export function parseSkillName(nameWithVersion: string): { name: string; version?: string } {
  const result = skillParseName(nameWithVersion);
  return {
    name: result.name,
    version: result.version ?? undefined,
  };
}

/**
 * Install a skill
 *
 * Creates the skill directory structure and adds to installed.yaml.
 */
export function installSkill(name: string, version?: string): NativeSkill {
  return skillInstall(name, version);
}

/**
 * Uninstall a skill
 *
 * Removes the skill directory and entry from installed.yaml.
 * Returns true if the skill was uninstalled, false if it wasn't installed.
 */
export function uninstallSkill(name: string): boolean {
  return skillUninstall(name);
}

/**
 * Get available skills from marketplace
 */
export function getAvailableSkills(): NativeAvailableSkill[] {
  return skillGetAvailable();
}

/**
 * Validate skill ID format
 * Throws an error if invalid
 */
export function validateSkillId(id: string): void {
  skillValidateId(id);
}
