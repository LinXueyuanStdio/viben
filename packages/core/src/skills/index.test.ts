/**
 * Skills Manager Tests
 *
 * Tests for skill management functionality:
 * - Installing skills to different targets
 * - Uninstalling skills
 * - Listing installed skills
 * - Getting skill information
 * - Enabling/disabling skills for agents
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { SkillsManager } from "./index";
import { NotFoundError, AlreadyExistsError, ValidationError } from "../error";

describe("SkillsManager", () => {
  let manager: SkillsManager;
  let tempDir: string;
  let originalStateDir: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "viben-skills-test-"));
    originalStateDir = process.env.VIBEN_STATE_DIR;
    process.env.VIBEN_STATE_DIR = tempDir;
    manager = new SkillsManager();
    await manager.initialize();
  });

  afterEach(async () => {
    if (originalStateDir !== undefined) {
      process.env.VIBEN_STATE_DIR = originalStateDir;
    } else {
      delete process.env.VIBEN_STATE_DIR;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  // ============================================================================
  // Install Skill Tests
  // ============================================================================

  describe("installSkill()", () => {
    it("should install a skill to global target", async () => {
      const result = await manager.installSkill({
        name: "test-skill",
        target: "global",
      });

      expect(result.success).toBe(true);
      expect(result.name).toBe("test-skill");
      expect(result.version).toBe("1.0.0");
      expect(result.target).toBe("global");
      expect(existsSync(result.path)).toBe(true);
    });

    it("should install a skill with version from name@version format", async () => {
      const result = await manager.installSkill({
        name: "test-skill@2.0.0",
        target: "global",
      });

      expect(result.success).toBe(true);
      expect(result.name).toBe("test-skill");
      expect(result.version).toBe("2.0.0");
    });

    it("should install a skill with explicit version", async () => {
      const result = await manager.installSkill({
        name: "test-skill",
        target: "global",
        version: "3.0.0",
      });

      expect(result.success).toBe(true);
      expect(result.version).toBe("3.0.0");
    });

    it("should install a skill to custom path", async () => {
      const customPath = join(tempDir, "custom-skills");
      await mkdir(customPath, { recursive: true });

      const result = await manager.installSkill({
        name: "test-skill",
        target: "custom",
        customPath,
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe(join(customPath, "test-skill"));
      expect(existsSync(result.path)).toBe(true);
    });

    it("should install a skill to agent target", async () => {
      // Create agent directory first
      const agentDir = join(tempDir, "agents", "test-agent");
      await mkdir(agentDir, { recursive: true });

      const result = await manager.installSkill({
        name: "test-skill",
        target: "agent",
        agentId: "test-agent",
      });

      expect(result.success).toBe(true);
      expect(result.target).toBe("agent");
    });

    it("should throw AlreadyExistsError when skill exists and force is false", async () => {
      await manager.installSkill({
        name: "test-skill",
        target: "global",
      });

      await expect(
        manager.installSkill({
          name: "test-skill",
          target: "global",
        })
      ).rejects.toThrow(AlreadyExistsError);
    });

    it("should reinstall skill when force is true", async () => {
      await manager.installSkill({
        name: "test-skill",
        target: "global",
        version: "1.0.0",
      });

      const result = await manager.installSkill({
        name: "test-skill",
        target: "global",
        version: "2.0.0",
        force: true,
      });

      expect(result.success).toBe(true);
      expect(result.version).toBe("2.0.0");
    });

    it("should throw ValidationError when agent target without agentId", async () => {
      await expect(
        manager.installSkill({
          name: "test-skill",
          target: "agent",
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should throw ValidationError when custom target without customPath", async () => {
      await expect(
        manager.installSkill({
          name: "test-skill",
          target: "custom",
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should install skill from local source", async () => {
      // Create a source skill directory
      const sourceDir = join(tempDir, "source-skill");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(
        join(sourceDir, "SKILL.md"),
        `---
name: source-skill
version: 1.5.0
description: A skill from local source
---

# Source Skill
`,
        "utf-8"
      );

      const result = await manager.installSkill({
        name: "copied-skill",
        target: "global",
        sourcePath: sourceDir,
      });

      expect(result.success).toBe(true);
      expect(existsSync(join(result.path, "SKILL.md"))).toBe(true);
    });
  });

  // ============================================================================
  // Uninstall Skill Tests
  // ============================================================================

  describe("uninstallSkill()", () => {
    it("should uninstall an installed skill", async () => {
      await manager.installSkill({
        name: "test-skill",
        target: "global",
      });

      const result = await manager.uninstallSkill({
        name: "test-skill",
        target: "global",
      });

      expect(result.success).toBe(true);
      expect(result.name).toBe("test-skill");
    });

    it("should throw NotFoundError for non-existent skill", async () => {
      await expect(
        manager.uninstallSkill({
          name: "non-existent",
          target: "global",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("should update installed.yaml after uninstall", async () => {
      await manager.installSkill({
        name: "test-skill",
        target: "global",
      });

      await manager.uninstallSkill({
        name: "test-skill",
        target: "global",
      });

      const skills = await manager.listInstalledSkills({ target: "global" });
      expect(skills.find((s) => s.name === "test-skill")).toBeUndefined();
    });
  });

  // ============================================================================
  // List Installed Skills Tests
  // ============================================================================

  describe("listInstalledSkills()", () => {
    it("should list installed skills for global target", async () => {
      await manager.installSkill({
        name: "skill-1",
        target: "global",
      });
      await manager.installSkill({
        name: "skill-2",
        target: "global",
      });

      const skills = await manager.listInstalledSkills({ target: "global" });

      expect(skills).toHaveLength(2);
      expect(skills.map((s) => s.name)).toContain("skill-1");
      expect(skills.map((s) => s.name)).toContain("skill-2");
    });

    it("should return empty array when no skills installed", async () => {
      const skills = await manager.listInstalledSkills({ target: "global" });
      expect(skills).toEqual([]);
    });

    it("should list skills from directories without installed.yaml", async () => {
      // Create a skill directory manually without installed.yaml
      const skillsDir = join(tempDir, "skills");
      const skillDir = join(skillsDir, "manual-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, "SKILL.md"),
        `---
name: manual-skill
version: 1.0.0
---
`,
        "utf-8"
      );

      const skills = await manager.listInstalledSkills({ target: "global" });

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe("manual-skill");
    });
  });

  // ============================================================================
  // List Agent Skills Tests
  // ============================================================================

  describe("listAgentSkills()", () => {
    it("should list skills for an agent", async () => {
      // Create agent with skills
      const agentDir = join(tempDir, "agents", "test-agent", "skills");
      await mkdir(agentDir, { recursive: true });

      const skill1Dir = join(agentDir, "skill-1");
      await mkdir(skill1Dir, { recursive: true });
      await writeFile(
        join(skill1Dir, "SKILL.md"),
        `---
name: Agent Skill 1
version: 1.0.0
description: First agent skill
---
`,
        "utf-8"
      );

      const skills = await manager.listAgentSkills("test-agent");

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe("Agent Skill 1");
      expect(skills[0].description).toBe("First agent skill");
    });

    it("should return empty array for agent without skills", async () => {
      const skills = await manager.listAgentSkills("non-existent-agent");
      expect(skills).toEqual([]);
    });
  });

  // ============================================================================
  // List Available Skills Tests
  // ============================================================================

  describe("listAvailableSkills()", () => {
    it("should return list of available skills from marketplace", async () => {
      const skills = await manager.listAvailableSkills();
      // Marketplace is now implemented, returns array of skill metadata
      expect(Array.isArray(skills)).toBe(true);
      // Each skill should have required fields
      if (skills.length > 0) {
        expect(skills[0]).toHaveProperty("name");
        expect(skills[0]).toHaveProperty("description");
      }
    });
  });

  // ============================================================================
  // Get Skill Info Tests
  // ============================================================================

  describe("getSkillInfo()", () => {
    it("should get skill information for installed skill", async () => {
      await manager.installSkill({
        name: "test-skill",
        target: "global",
        version: "2.0.0",
      });

      const info = await manager.getSkillInfo("test-skill");

      expect(info).not.toBeNull();
      expect(info?.name).toBe("test-skill");
      expect(info?.version).toBe("2.0.0");
    });

    it("should return null for non-existent skill", async () => {
      const info = await manager.getSkillInfo("non-existent");
      expect(info).toBeNull();
    });

    it("should search in specified target only", async () => {
      await manager.installSkill({
        name: "test-skill",
        target: "global",
      });

      // Create custom directory
      const customPath = join(tempDir, "custom");
      await mkdir(customPath, { recursive: true });

      // Should not find in custom path
      const info = await manager.getSkillInfo("test-skill", {
        target: "custom",
        customPath,
      });
      expect(info).toBeNull();
    });
  });

  // ============================================================================
  // Read Skill Metadata Tests
  // ============================================================================

  describe("readSkillMetadata()", () => {
    it("should read skill metadata from SKILL.md", async () => {
      const skillDir = join(tempDir, "test-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, "SKILL.md"),
        `---
name: Test Skill
version: 1.2.3
description: A test skill
author: Test Author
tags:
  - coding
  - testing
triggers:
  - test
tools:
  - test-tool
---

# Test Skill
`,
        "utf-8"
      );

      const metadata = await manager.readSkillMetadata(skillDir);

      expect(metadata).not.toBeNull();
      expect(metadata?.name).toBe("Test Skill");
      expect(metadata?.version).toBe("1.2.3");
      expect(metadata?.description).toBe("A test skill");
      expect(metadata?.author).toBe("Test Author");
      expect(metadata?.tags).toEqual(["coding", "testing"]);
      expect(metadata?.triggers).toEqual(["test"]);
      expect(metadata?.tools).toEqual(["test-tool"]);
    });

    it("should return null when SKILL.md does not exist", async () => {
      const skillDir = join(tempDir, "empty-skill");
      await mkdir(skillDir, { recursive: true });

      const metadata = await manager.readSkillMetadata(skillDir);
      expect(metadata).toBeNull();
    });

    it("should return null for invalid frontmatter", async () => {
      const skillDir = join(tempDir, "invalid-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, "SKILL.md"), "No frontmatter here", "utf-8");

      const metadata = await manager.readSkillMetadata(skillDir);
      expect(metadata).toBeNull();
    });
  });

  // ============================================================================
  // Enable/Disable Skill Tests
  // ============================================================================

  describe("enableSkill()", () => {
    it("should enable a skill for an agent", async () => {
      // Create agent and skill
      const agentDir = join(tempDir, "agents", "test-agent");
      await mkdir(agentDir, { recursive: true });
      await manager.installSkill({
        name: "test-skill",
        target: "global",
      });

      const config = await manager.enableSkill("test-skill", "test-agent");

      expect(config.skillName).toBe("test-skill");
      expect(config.enabled).toBe(true);
      expect(config.agentId).toBe("test-agent");
    });

    it("should throw NotFoundError for non-existent agent", async () => {
      await manager.installSkill({
        name: "test-skill",
        target: "global",
      });

      await expect(
        manager.enableSkill("test-skill", "non-existent-agent")
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw NotFoundError for non-existent skill", async () => {
      const agentDir = join(tempDir, "agents", "test-agent");
      await mkdir(agentDir, { recursive: true });

      await expect(
        manager.enableSkill("non-existent-skill", "test-agent")
      ).rejects.toThrow(NotFoundError);
    });

    it("should return existing config if already enabled", async () => {
      const agentDir = join(tempDir, "agents", "test-agent");
      await mkdir(agentDir, { recursive: true });
      await manager.installSkill({
        name: "test-skill",
        target: "global",
      });

      await manager.enableSkill("test-skill", "test-agent");
      const config = await manager.enableSkill("test-skill", "test-agent");

      expect(config.enabled).toBe(true);
    });
  });

  describe("disableSkill()", () => {
    it("should disable an enabled skill", async () => {
      const agentDir = join(tempDir, "agents", "test-agent");
      await mkdir(agentDir, { recursive: true });
      await manager.installSkill({
        name: "test-skill",
        target: "global",
      });
      await manager.enableSkill("test-skill", "test-agent");

      const config = await manager.disableSkill("test-skill", "test-agent");

      expect(config.skillName).toBe("test-skill");
      expect(config.enabled).toBe(false);
    });

    it("should throw NotFoundError for non-existent agent", async () => {
      await expect(
        manager.disableSkill("test-skill", "non-existent-agent")
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw NotFoundError if skill was never enabled", async () => {
      const agentDir = join(tempDir, "agents", "test-agent");
      await mkdir(agentDir, { recursive: true });

      await expect(
        manager.disableSkill("test-skill", "test-agent")
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("getEnabledSkills()", () => {
    it("should return enabled skills for an agent", async () => {
      const agentDir = join(tempDir, "agents", "test-agent");
      await mkdir(agentDir, { recursive: true });
      await manager.installSkill({ name: "skill-1", target: "global" });
      await manager.installSkill({ name: "skill-2", target: "global" });

      await manager.enableSkill("skill-1", "test-agent");
      await manager.enableSkill("skill-2", "test-agent");
      await manager.disableSkill("skill-2", "test-agent");

      const enabled = await manager.getEnabledSkills("test-agent");

      expect(enabled).toHaveLength(1);
      expect(enabled[0].skillName).toBe("skill-1");
    });

    it("should return empty array for non-existent agent", async () => {
      const enabled = await manager.getEnabledSkills("non-existent");
      expect(enabled).toEqual([]);
    });
  });

  // ============================================================================
  // Path Methods Tests
  // ============================================================================

  describe("getTargetDir()", () => {
    it("should return global skills directory for global target", () => {
      const dir = manager.getTargetDir("global");
      expect(dir).toBe(join(tempDir, "skills"));
    });

    it("should return agent skills directory for agent target", () => {
      const dir = manager.getTargetDir("agent", "test-agent");
      expect(dir).toBe(join(tempDir, "agents", "test-agent", "skills"));
    });

    it("should return claude skills directory for claude target", () => {
      const dir = manager.getTargetDir("claude");
      expect(dir).toBe(join(homedir(), ".claude", "skills"));
    });

    it("should return custom path for custom target", () => {
      const customPath = "/custom/skills/path";
      const dir = manager.getTargetDir("custom", undefined, customPath);
      expect(dir).toBe(customPath);
    });

    it("should throw ValidationError for agent target without agentId", () => {
      expect(() => manager.getTargetDir("agent")).toThrow(ValidationError);
    });

    it("should throw ValidationError for custom target without customPath", () => {
      expect(() => manager.getTargetDir("custom")).toThrow(ValidationError);
    });
  });

  describe("getSharedSkillPath()", () => {
    it("should return correct path for shared skill", () => {
      const path = manager.getSharedSkillPath("test-skill");
      expect(path).toBe(join(tempDir, "skills", "test-skill"));
    });
  });

  describe("getAgentSkillPath()", () => {
    it("should return correct path for agent skill", () => {
      const path = manager.getAgentSkillPath("test-agent", "test-skill");
      expect(path).toBe(join(tempDir, "agents", "test-agent", "skills", "test-skill"));
    });
  });

  describe("getClaudeSkillPath()", () => {
    it("should return correct path for claude skill", () => {
      const path = manager.getClaudeSkillPath("test-skill");
      expect(path).toBe(join(homedir(), ".claude", "skills", "test-skill"));
    });
  });
});
