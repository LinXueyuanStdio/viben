/**
 * Path resolution utilities for skills
 *
 * Pure functions, no side effects.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import {
  getStateDir,
  getAgentSkillsDir as getAgentSkillsDirFromConfig,
  getSharedSkillsDir as getSharedSkillsDirFromConfig,
} from "../../config/paths";
import type { SkillTarget } from "./types";

// =============================================================================
// Base Directory Paths
// =============================================================================

/**
 * Get the skills base directory path
 * Default: ~/.viben/skills
 */
export function getSkillsBaseDir(): string {
  return join(getStateDir(), "skills");
}

/**
 * Get the shared skills directory path
 * Default: ~/.viben/skills (same as base)
 */
export function getSharedSkillsDir(): string {
  return getSharedSkillsDirFromConfig();
}

/**
 * Get the Claude skills directory path
 * Default: ~/.claude/skills (Claude Code's skill directory)
 */
export function getClaudeSkillsDir(): string {
  return join(homedir(), ".claude", "skills");
}

/**
 * Get the skills directory for a specific agent
 * Default: ~/.viben/agents/<id>/skills
 */
export function getAgentSkillsDir(agentId: string): string {
  return getAgentSkillsDirFromConfig(agentId);
}

// =============================================================================
// Skill-Specific Paths
// =============================================================================

/**
 * Get the directory path for a specific skill
 *
 * @param target - Target location type
 * @param skillName - Name of the skill
 * @param agentId - Agent ID (required when target is "agent")
 * @param customPath - Custom directory (required when target is "custom")
 * @returns Path to the skill directory
 */
export function getSkillDir(
  target: SkillTarget,
  skillName: string,
  agentId?: string,
  customPath?: string
): string {
  const targetDir = resolveTargetDir(target, agentId, customPath);
  return join(targetDir, skillName);
}

/**
 * Get the path to installed.yaml in a target directory
 *
 * @param targetDir - Target directory path
 * @returns Path to installed.yaml
 */
export function getInstalledYamlPath(targetDir: string): string {
  return join(targetDir, "installed.yaml");
}

/**
 * Get the path to skills_config.yaml for an agent
 *
 * @param agentId - Agent ID
 * @returns Path to skills_config.yaml
 */
export function getAgentSkillsConfigPath(agentId: string): string {
  const agentDir = join(getStateDir(), "agents", agentId);
  return join(agentDir, "skills_config.yaml");
}

// =============================================================================
// Target Resolution
// =============================================================================

/**
 * Resolve target directory based on target type
 *
 * @param target - Target location type
 * @param agentId - Agent ID (required when target is "agent")
 * @param customPath - Custom directory (required when target is "custom")
 * @returns Resolved directory path
 * @throws Error if required parameters are missing
 */
export function resolveTargetDir(
  target: SkillTarget,
  agentId?: string,
  customPath?: string
): string {
  switch (target) {
    case "agent":
      if (!agentId) {
        throw new Error("Agent ID is required for agent target");
      }
      return getAgentSkillsDir(agentId);
    case "global":
      return getSharedSkillsDir();
    case "claude":
      return getClaudeSkillsDir();
    case "custom":
      if (!customPath) {
        throw new Error("Custom path is required for custom target");
      }
      return customPath;
    default:
      throw new Error(`Unknown target: ${target}`);
  }
}

/**
 * Validate target options
 *
 * @param target - Target location type
 * @param agentId - Agent ID (required when target is "agent")
 * @param customPath - Custom directory (required when target is "custom")
 * @returns Object with isValid and error message
 */
export function validateTargetOptions(
  target: SkillTarget,
  agentId?: string,
  customPath?: string
): { isValid: boolean; error?: string } {
  if (target === "agent" && !agentId) {
    return { isValid: false, error: "Agent ID is required when target is 'agent'" };
  }
  if (target === "custom" && !customPath) {
    return { isValid: false, error: "Custom path is required when target is 'custom'" };
  }
  return { isValid: true };
}
