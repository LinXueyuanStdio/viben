/**
 * Agent skill configuration operations
 *
 * Enable/disable skills for agents.
 * Pure functions following the task/ops pattern.
 */
import { join } from "node:path";
import { readYaml, writeYaml, fileExists } from "../../config/yaml";
import { getAgentDir } from "../../config/paths";
import { getAgentSkillsConfigPath, getSharedSkillsDir, getClaudeSkillsDir } from "./paths";
import type {
  EnableSkillResult,
  AgentSkillConfig,
  SkillMetadata,
} from "./types";

// =============================================================================
// Enable/Disable Operations
// =============================================================================

/**
 * Enable a skill for an agent
 *
 * @param skillName - Name of the skill to enable
 * @param agentId - Agent ID
 * @returns Enable result
 */
export async function enableSkill(
  skillName: string,
  agentId: string
): Promise<EnableSkillResult> {
  try {
    // Verify agent exists
    const agentDir = getAgentDir(agentId);
    if (!fileExists(agentDir)) {
      return {
        success: false,
        error: `Agent "${agentId}" not found`,
        skillName,
        agentId,
        enabled: false,
      };
    }

    // Verify skill exists (check global and claude)
    const skillExists = await verifySkillExists(skillName);
    if (!skillExists) {
      return {
        success: false,
        error: `Skill "${skillName}" not found`,
        skillName,
        agentId,
        enabled: false,
      };
    }

    // Get agent skills config
    const configPath = getAgentSkillsConfigPath(agentId);
    const config = await readAgentSkillsConfig(configPath);

    // Check if already enabled
    const existingIndex = config.findIndex((c) => c.skillName === skillName);
    if (existingIndex >= 0 && config[existingIndex].enabled) {
      // Already enabled, just return the config
      return {
        success: true,
        skillName,
        agentId,
        enabled: true,
        enabledAt: config[existingIndex].enabledAt,
      };
    }

    // Update or add config
    const enabledAt = new Date().toISOString();
    const skillConfig: AgentSkillConfig = {
      skillName,
      enabled: true,
      agentId,
      enabledAt,
    };

    if (existingIndex >= 0) {
      config[existingIndex] = skillConfig;
    } else {
      config.push(skillConfig);
    }

    await writeYaml(configPath, { skills: config });

    return {
      success: true,
      skillName,
      agentId,
      enabled: true,
      enabledAt,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      skillName,
      agentId,
      enabled: false,
    };
  }
}

/**
 * Disable a skill for an agent
 *
 * @param skillName - Name of the skill to disable
 * @param agentId - Agent ID
 * @returns Disable result
 */
export async function disableSkill(
  skillName: string,
  agentId: string
): Promise<EnableSkillResult> {
  try {
    // Verify agent exists
    const agentDir = getAgentDir(agentId);
    if (!fileExists(agentDir)) {
      return {
        success: false,
        error: `Agent "${agentId}" not found`,
        skillName,
        agentId,
        enabled: false,
      };
    }

    // Get agent skills config
    const configPath = getAgentSkillsConfigPath(agentId);
    const config = await readAgentSkillsConfig(configPath);

    // Find existing config
    const existingIndex = config.findIndex((c) => c.skillName === skillName);
    if (existingIndex < 0) {
      return {
        success: false,
        error: `Skill "${skillName}" is not configured for agent "${agentId}"`,
        skillName,
        agentId,
        enabled: false,
      };
    }

    // Update config
    config[existingIndex].enabled = false;

    await writeYaml(configPath, { skills: config });

    return {
      success: true,
      skillName,
      agentId,
      enabled: false,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      skillName,
      agentId,
      enabled: false,
    };
  }
}

/**
 * Get enabled skills for an agent
 *
 * @param agentId - Agent ID
 * @returns Array of enabled skill configurations
 */
export async function getEnabledSkills(agentId: string): Promise<AgentSkillConfig[]> {
  const agentDir = getAgentDir(agentId);
  if (!fileExists(agentDir)) {
    return [];
  }

  const configPath = getAgentSkillsConfigPath(agentId);
  const config = await readAgentSkillsConfig(configPath);

  return config.filter((c) => c.enabled);
}

/**
 * Get all skill configurations for an agent (enabled and disabled)
 *
 * @param agentId - Agent ID
 * @returns Array of all skill configurations
 */
export async function getAllSkillConfigs(agentId: string): Promise<AgentSkillConfig[]> {
  const agentDir = getAgentDir(agentId);
  if (!fileExists(agentDir)) {
    return [];
  }

  const configPath = getAgentSkillsConfigPath(agentId);
  return readAgentSkillsConfig(configPath);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Read agent skills configuration from file
 */
async function readAgentSkillsConfig(configPath: string): Promise<AgentSkillConfig[]> {
  if (!fileExists(configPath)) {
    return [];
  }

  const data = await readYaml<{ skills: AgentSkillConfig[] }>(configPath);
  return data?.skills || [];
}

/**
 * Verify that a skill exists in any of the standard locations
 */
async function verifySkillExists(skillName: string): Promise<boolean> {
  const globalSkillDir = join(getSharedSkillsDir(), skillName);
  const claudeSkillDir = join(getClaudeSkillsDir(), skillName);

  return fileExists(globalSkillDir) || fileExists(claudeSkillDir);
}
