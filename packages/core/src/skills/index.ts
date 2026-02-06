/**
 * Skills management for Viben
 */
import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import {
  getSharedSkillsDir,
  getAgentSkillsDir,
} from "../config/paths";
import { readYaml, writeYaml, fileExists, ensureDir } from "../config/yaml";
import type { Skill, InstalledSkill } from "../types";
import type { InstalledSkillsFile, InstalledSkillEntry, SkillMetadata } from "./types";

export * from "./types";

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

  /**
   * List installed shared skills
   */
  async listSharedSkills(): Promise<InstalledSkill[]> {
    const skillsDir = getSharedSkillsDir();
    const installedPath = join(skillsDir, "installed.yaml");

    if (!fileExists(installedPath)) {
      return [];
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

      for (const line of frontmatter.split("\n")) {
        const [key, ...valueParts] = line.split(":");
        const value = valueParts.join(":").trim();

        if (key && value) {
          const cleanKey = key.trim();
          if (cleanKey === "name") metadata.name = value;
          else if (cleanKey === "description") metadata.description = value;
          else if (cleanKey === "version") metadata.version = value;
          else if (cleanKey === "author") metadata.author = value;
        }
      }

      return metadata.name ? metadata : null;
    } catch {
      return null;
    }
  }

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
}

// Export singleton instance
export const skillsManager = new SkillsManager();
