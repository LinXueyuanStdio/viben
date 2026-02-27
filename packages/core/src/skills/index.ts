/**
 * Skills management for Viben
 *
 * Provides functionality for:
 * - Installing/uninstalling skills to different targets (agent, global, claude, custom)
 * - Listing installed and available skills
 * - Getting skill metadata and information
 * - Enabling/disabling skills for agents
 */
import { readdir, readFile, rm, cp, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import {
  getSharedSkillsDir,
  getAgentSkillsDir,
  getAgentDir,
} from "../config/paths";
import { readYaml, writeYaml, fileExists, ensureDir } from "../config/yaml";
import { NotFoundError, AlreadyExistsError, ValidationError } from "../error";
import type { Skill, InstalledSkill } from "../types";
import type {
  InstalledSkillsFile,
  InstalledSkillEntry,
  SkillMetadata,
  SkillTarget,
  InstallSkillOptions,
  InstallSkillResult,
  UninstallSkillOptions,
  UninstallSkillResult,
  ListSkillsOptions,
  AvailableSkill,
  AgentSkillConfig,
} from "./types";
import { extractZipToDirectory } from "./extract";

export * from "./types";

/**
 * Get the Claude skills directory path
 * Default: ~/.claude/skills (Claude Code's skill directory)
 */
function getClaudeSkillsDir(): string {
  return join(homedir(), ".claude", "skills");
}

/**
 * SkillsManager handles skill management
 */
export class SkillsManager {
  /**
   * Initialize skills directories
   */
  async initialize(): Promise<void> {
    await ensureDir(getSharedSkillsDir());
  }

  // ========================================================================
  // Installation Methods
  // ========================================================================

  /**
   * Install a skill to the specified target
   *
   * Targets:
   * - "agent": Install to ~/.viben/agents/<id>/skills/
   * - "global": Install to ~/.viben/skills/
   * - "claude": Install to ~/.claude/skills/
   * - "custom": Install to specified customPath
   */
  async installSkill(options: InstallSkillOptions): Promise<InstallSkillResult> {
    const { name, target, agentId, customPath, force, sourcePath, zipPath, onProgress, version } = options;

    // Parse name@version if present
    const { skillName, skillVersion } = this.parseSkillName(name, version);

    // Validate options
    this.validateInstallOptions(target, agentId, customPath);

    // Get target directory
    const targetDir = this.getTargetDir(target, agentId, customPath);
    const skillDir = join(targetDir, skillName);

    // Check if already installed
    if (fileExists(skillDir) && !force) {
      throw new AlreadyExistsError("Skill", skillName);
    }

    // If force, remove existing
    if (fileExists(skillDir) && force) {
      await rm(skillDir, { recursive: true, force: true });
    }

    // Ensure target directory exists
    await ensureDir(targetDir);

    // Create skill directory
    await mkdir(skillDir, { recursive: true });

    // Install from appropriate source
    if (zipPath) {
      // Extract from zip file
      const extractResult = await extractZipToDirectory({
        zipPath,
        targetDir: skillDir,
        onProgress,
        overwrite: force,
        validate: true,
      });

      // Use skill name from extracted SKILL.md if available
      const extractedSkillName = extractResult.skillName || skillName;

      // Update installed.yaml tracking
      await this.addToInstalledList(targetDir, {
        name: extractedSkillName,
        version: skillVersion || "1.0.0",
        path: skillDir,
        source: "marketplace",
        installedAt: new Date().toISOString(),
      });

      return {
        success: true,
        name: extractedSkillName,
        version: skillVersion || "1.0.0",
        path: skillDir,
        target,
        message: `Skill "${extractedSkillName}" installed successfully to ${target}`,
      };
    } else if (sourcePath) {
      // Copy from local directory
      await this.copySkillFromLocal(sourcePath, skillDir);
    } else {
      // Create a basic SKILL.md for now (marketplace download would go here)
      await this.createSkillPlaceholder(skillDir, skillName, skillVersion);
    }

    // Update installed.yaml tracking
    await this.addToInstalledList(targetDir, {
      name: skillName,
      version: skillVersion || "1.0.0",
      path: skillDir,
      source: sourcePath ? "local" : "marketplace",
      installedAt: new Date().toISOString(),
    });

    return {
      success: true,
      name: skillName,
      version: skillVersion || "1.0.0",
      path: skillDir,
      target,
      message: `Skill "${skillName}" installed successfully to ${target}`,
    };
  }

  /**
   * Uninstall a skill from the specified target
   */
  async uninstallSkill(options: UninstallSkillOptions): Promise<UninstallSkillResult> {
    const { name, target, agentId, customPath } = options;

    // Validate options
    this.validateInstallOptions(target, agentId, customPath);

    // Get target directory
    const targetDir = this.getTargetDir(target, agentId, customPath);
    const skillDir = join(targetDir, name);

    // Check if installed
    if (!fileExists(skillDir)) {
      throw new NotFoundError("Skill", name);
    }

    // Remove skill directory
    await rm(skillDir, { recursive: true, force: true });

    // Update installed.yaml tracking
    await this.removeFromInstalledList(targetDir, name);

    return {
      success: true,
      name,
      message: `Skill "${name}" uninstalled successfully from ${target}`,
    };
  }

  // ========================================================================
  // Listing Methods
  // ========================================================================

  /**
   * List installed skills for the specified target(s)
   * If no target specified, lists all installed skills from all targets
   */
  async listInstalledSkills(options?: ListSkillsOptions): Promise<InstalledSkill[]> {
    if (!options?.target) {
      // List from all targets
      const globalSkills = await this.listSharedSkills();
      const claudeSkills = await this.listClaudeSkills();
      return [...globalSkills, ...claudeSkills];
    }

    const { target, agentId, customPath } = options;

    // Validate options
    this.validateInstallOptions(target, agentId, customPath);

    const targetDir = this.getTargetDir(target, agentId, customPath);
    return this.listSkillsInDir(targetDir);
  }

  /**
   * List installed shared (global) skills
   */
  async listSharedSkills(): Promise<InstalledSkill[]> {
    return this.listSkillsInDir(getSharedSkillsDir());
  }

  /**
   * List installed Claude skills
   */
  async listClaudeSkills(): Promise<InstalledSkill[]> {
    return this.listSkillsInDir(getClaudeSkillsDir());
  }

  /**
   * List skills for an agent
   */
  async listAgentSkills(agentId: string): Promise<Skill[]> {
    const skillsDir = getAgentSkillsDir(agentId);
    if (!fileExists(skillsDir)) {
      return [];
    }

    const entries = await readdir(skillsDir, { withFileTypes: true });
    const skills: Skill[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = join(skillsDir, entry.name);
        const metadata = await this.readSkillMetadata(skillPath);

        skills.push({
          id: entry.name,
          name: metadata?.name || entry.name,
          description: metadata?.description,
          version: metadata?.version || "1.0.0",
          path: skillPath,
          source: "local",
        });
      }
    }

    return skills;
  }

  /**
   * List available skills from registry
   * Currently returns mock data (like Rust implementation).
   * Future: Fetch from marketplace API.
   */
  async listAvailableSkills(): Promise<AvailableSkill[]> {
    // Mock data matching Rust implementation in crates/viben-core/src/services/skill.rs
    return [
      {
        name: "code-review",
        version: "1.0.0",
        description: "Code review assistance",
        author: "viben",
        tags: ["code", "review"],
      },
      {
        name: "commit",
        version: "1.2.0",
        description: "Smart commit messages",
        author: "viben",
        tags: ["git", "commit"],
      },
      {
        name: "test-runner",
        version: "0.9.0",
        description: "Test execution helper",
        author: "viben",
        tags: ["test", "runner"],
      },
      {
        name: "doc-gen",
        version: "1.1.0",
        description: "Generate documentation from code",
        author: "viben",
        tags: ["docs", "generator"],
      },
      {
        name: "refactor",
        version: "0.8.0",
        description: "Refactoring suggestions and assistance",
        author: "viben",
        tags: ["code", "refactor"],
      },
    ];
  }

  // ========================================================================
  // Information Methods
  // ========================================================================

  /**
   * Get detailed information about a skill
   */
  async getSkillInfo(name: string, options?: ListSkillsOptions): Promise<Skill | null> {
    // Search in specified target or all targets
    const targets: { target: SkillTarget; agentId?: string }[] = options?.target
      ? [{ target: options.target, agentId: options.agentId }]
      : [{ target: "global" }, { target: "claude" }];

    for (const { target, agentId } of targets) {
      const targetDir = this.getTargetDir(target, agentId, options?.customPath);
      const skillDir = join(targetDir, name);

      if (fileExists(skillDir)) {
        const metadata = await this.readSkillMetadata(skillDir);
        return {
          id: name,
          name: metadata?.name || name,
          description: metadata?.description,
          version: metadata?.version || "1.0.0",
          path: skillDir,
          source: "local",
        };
      }
    }

    return null;
  }

  /**
   * Read skill metadata from SKILL.md
   */
  async readSkillMetadata(skillPath: string): Promise<SkillMetadata | null> {
    const skillMdPath = join(skillPath, "SKILL.md");
    if (!fileExists(skillMdPath)) {
      return null;
    }

    try {
      const content = await readFile(skillMdPath, "utf-8");
      return this.parseSkillFrontmatter(content);
    } catch {
      return null;
    }
  }

  // ========================================================================
  // Enable/Disable Methods
  // ========================================================================

  /**
   * Enable a skill for an agent
   */
  async enableSkill(skillName: string, agentId: string): Promise<AgentSkillConfig> {
    // Verify agent exists
    const agentDir = getAgentDir(agentId);
    if (!fileExists(agentDir)) {
      throw new NotFoundError("Agent", agentId);
    }

    // Verify skill exists (check global and claude)
    const skill = await this.getSkillInfo(skillName);
    if (!skill) {
      throw new NotFoundError("Skill", skillName);
    }

    // Get agent skills config
    const configPath = join(agentDir, "skills_config.yaml");
    const config = await this.readAgentSkillsConfig(configPath);

    // Check if already enabled
    const existingIndex = config.findIndex((c) => c.skillName === skillName);
    if (existingIndex >= 0 && config[existingIndex].enabled) {
      // Already enabled, just return the config
      return config[existingIndex];
    }

    // Update or add config
    const skillConfig: AgentSkillConfig = {
      skillName,
      enabled: true,
      agentId,
      enabledAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      config[existingIndex] = skillConfig;
    } else {
      config.push(skillConfig);
    }

    await writeYaml(configPath, { skills: config });

    return skillConfig;
  }

  /**
   * Disable a skill for an agent
   */
  async disableSkill(skillName: string, agentId: string): Promise<AgentSkillConfig> {
    // Verify agent exists
    const agentDir = getAgentDir(agentId);
    if (!fileExists(agentDir)) {
      throw new NotFoundError("Agent", agentId);
    }

    // Get agent skills config
    const configPath = join(agentDir, "skills_config.yaml");
    const config = await this.readAgentSkillsConfig(configPath);

    // Find existing config
    const existingIndex = config.findIndex((c) => c.skillName === skillName);
    if (existingIndex < 0) {
      throw new NotFoundError("Skill configuration", skillName);
    }

    // Update config
    config[existingIndex].enabled = false;

    await writeYaml(configPath, { skills: config });

    return config[existingIndex];
  }

  /**
   * Get enabled skills for an agent
   */
  async getEnabledSkills(agentId: string): Promise<AgentSkillConfig[]> {
    const agentDir = getAgentDir(agentId);
    if (!fileExists(agentDir)) {
      return [];
    }

    const configPath = join(agentDir, "skills_config.yaml");
    const config = await this.readAgentSkillsConfig(configPath);

    return config.filter((c) => c.enabled);
  }

  // ========================================================================
  // Path Methods
  // ========================================================================

  /**
   * Get path to a shared skill
   */
  getSharedSkillPath(name: string): string {
    return join(getSharedSkillsDir(), name);
  }

  /**
   * Get path to an agent's skill
   */
  getAgentSkillPath(agentId: string, skillName: string): string {
    return join(getAgentSkillsDir(agentId), skillName);
  }

  /**
   * Get path to a Claude skill
   */
  getClaudeSkillPath(name: string): string {
    return join(getClaudeSkillsDir(), name);
  }

  /**
   * Get target directory based on target type
   */
  getTargetDir(target: SkillTarget, agentId?: string, customPath?: string): string {
    switch (target) {
      case "agent":
        if (!agentId) {
          throw new ValidationError("Agent ID is required for agent target");
        }
        return getAgentSkillsDir(agentId);
      case "global":
        return getSharedSkillsDir();
      case "claude":
        return getClaudeSkillsDir();
      case "custom":
        if (!customPath) {
          throw new ValidationError("Custom path is required for custom target");
        }
        return customPath;
      default:
        throw new ValidationError(`Unknown target: ${target}`);
    }
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  /**
   * Parse skill name@version format
   */
  private parseSkillName(
    nameWithVersion: string,
    explicitVersion?: string
  ): { skillName: string; skillVersion?: string } {
    const parts = nameWithVersion.split("@");
    const skillName = parts[0];
    const skillVersion = explicitVersion || (parts.length > 1 ? parts[1] : undefined);
    return { skillName, skillVersion };
  }

  /**
   * Validate install/uninstall options
   */
  private validateInstallOptions(
    target: SkillTarget,
    agentId?: string,
    customPath?: string
  ): void {
    if (target === "agent" && !agentId) {
      throw new ValidationError("Agent ID is required when target is 'agent'");
    }
    if (target === "custom" && !customPath) {
      throw new ValidationError("Custom path is required when target is 'custom'");
    }
  }

  /**
   * Copy skill from local source
   */
  private async copySkillFromLocal(sourcePath: string, targetDir: string): Promise<void> {
    if (!fileExists(sourcePath)) {
      throw new NotFoundError("Source skill", sourcePath);
    }
    await cp(sourcePath, targetDir, { recursive: true });
  }

  /**
   * Create a placeholder SKILL.md for marketplace skills
   */
  private async createSkillPlaceholder(
    skillDir: string,
    name: string,
    version?: string
  ): Promise<void> {
    const content = `---
name: ${name}
version: ${version || "1.0.0"}
description: Skill ${name}
---

# ${name}

This skill was installed from the marketplace.
`;
    await writeFile(join(skillDir, "SKILL.md"), content, "utf-8");
  }

  /**
   * Add entry to installed.yaml
   */
  private async addToInstalledList(
    targetDir: string,
    entry: InstalledSkillEntry
  ): Promise<void> {
    const installedPath = join(targetDir, "installed.yaml");
    const file = fileExists(installedPath)
      ? await readYaml<InstalledSkillsFile>(installedPath)
      : { installed: [] };

    const existingIndex = (file?.installed || []).findIndex(
      (e) => e.name === entry.name
    );

    if (existingIndex >= 0) {
      (file?.installed || [])[existingIndex] = entry;
    } else {
      (file?.installed || []).push(entry);
    }

    await writeYaml(installedPath, file);
  }

  /**
   * Remove entry from installed.yaml
   */
  private async removeFromInstalledList(
    targetDir: string,
    name: string
  ): Promise<void> {
    const installedPath = join(targetDir, "installed.yaml");
    if (!fileExists(installedPath)) {
      return;
    }

    const file = await readYaml<InstalledSkillsFile>(installedPath);
    if (!file?.installed) {
      return;
    }

    file.installed = file.installed.filter((e) => e.name !== name);
    await writeYaml(installedPath, file);
  }

  /**
   * List skills in a directory
   */
  private async listSkillsInDir(skillsDir: string): Promise<InstalledSkill[]> {
    const installedPath = join(skillsDir, "installed.yaml");

    if (!fileExists(installedPath)) {
      // Try to build list from directories
      if (!fileExists(skillsDir)) {
        return [];
      }

      try {
        const entries = await readdir(skillsDir, { withFileTypes: true });
        const skills: InstalledSkill[] = [];

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const skillPath = join(skillsDir, entry.name);
            const metadata = await this.readSkillMetadata(skillPath);
            skills.push({
              name: metadata?.name || entry.name,
              version: metadata?.version || "1.0.0",
              path: skillPath,
              installedAt: new Date().toISOString(),
            });
          }
        }

        return skills;
      } catch {
        return [];
      }
    }

    const file = await readYaml<InstalledSkillsFile>(installedPath);
    return (file?.installed || []).map((entry) => ({
      name: entry.name,
      version: entry.version,
      path: entry.path,
      installedAt: entry.installedAt,
    }));
  }

  /**
   * Read agent skills configuration
   */
  private async readAgentSkillsConfig(configPath: string): Promise<AgentSkillConfig[]> {
    if (!fileExists(configPath)) {
      return [];
    }

    const data = await readYaml<{ skills: AgentSkillConfig[] }>(configPath);
    return data?.skills || [];
  }

  /**
   * Parse YAML frontmatter from SKILL.md
   */
  private parseSkillFrontmatter(content: string): SkillMetadata | null {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
      return null;
    }

    try {
      // Simple YAML parsing for frontmatter
      const frontmatter = match[1];
      const metadata: SkillMetadata = { name: "" };
      const arrayFields: Record<string, string[]> = {};
      let currentArrayField: string | null = null;

      for (const line of frontmatter.split("\n")) {
        // Handle array continuation
        if (currentArrayField && line.trim().startsWith("-")) {
          const value = line.trim().slice(1).trim();
          if (value) {
            arrayFields[currentArrayField].push(value);
          }
          continue;
        }
        currentArrayField = null;

        const [key, ...valueParts] = line.split(":");
        const value = valueParts.join(":").trim();

        if (key && value) {
          const cleanKey = key.trim();
          if (cleanKey === "name") metadata.name = value;
          else if (cleanKey === "description") metadata.description = value;
          else if (cleanKey === "version") metadata.version = value;
          else if (cleanKey === "author") metadata.author = value;
        } else if (key && !value) {
          // Could be start of an array field
          const cleanKey = key.trim();
          if (["tags", "triggers", "tools"].includes(cleanKey)) {
            currentArrayField = cleanKey;
            arrayFields[cleanKey] = [];
          }
        }
      }

      // Add array fields to metadata
      if (arrayFields.tags) metadata.tags = arrayFields.tags;
      if (arrayFields.triggers) metadata.triggers = arrayFields.triggers;
      if (arrayFields.tools) metadata.tools = arrayFields.tools;

      return metadata.name ? metadata : null;
    } catch {
      return null;
    }
  }
}

// Export singleton instance
export const skillsManager = new SkillsManager();
