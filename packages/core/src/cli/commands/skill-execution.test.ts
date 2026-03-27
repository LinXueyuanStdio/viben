/**
 * Skill Command Execution Tests
 *
 * Tests that actually execute skill commands with real skill/ops functions
 * using temporary directories for actual file operations.
 *
 * This complements skill.test.ts which tests command registration with mocks.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { registerSkillCommand } from "./skill";
import { createTempDir, type TempDirContext } from "../../test/helpers/temp-dir";
import { createConsoleSpy, type ConsoleSpy } from "../../test/mocks/console";
import { join } from "node:path";

// =============================================================================
// Test Setup
// =============================================================================

// Mock chalk to avoid color codes in test output
vi.mock("chalk", () => ({
  default: {
    bold: Object.assign((s: string) => s, {
      cyan: (s: string) => s,
    }),
    gray: (s: string) => s,
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    blue: (s: string) => s,
    dim: (s: string) => s,
    white: (s: string) => s,
    magenta: (s: string) => s,
  },
}));

// Store original env
let originalStateDir: string | undefined;

// Store original process.exit and mock it
const originalExit = process.exit;
let exitCode: number | undefined;

// =============================================================================
// Test Context Helper
// =============================================================================

interface ExecutionTestContext {
  tempDir: TempDirContext;
  program: Command;
  console: ConsoleSpy;
  /** Get the skills directory path */
  skillsDir: string;
  /** Get the Claude skills directory path */
  claudeDir: string;
  run: (args: string[]) => Promise<void>;
  runJson: (args: string[]) => Promise<unknown>;
  cleanup: () => Promise<void>;
}

async function createExecutionTestContext(): Promise<ExecutionTestContext> {
  const tempDir = await createTempDir("skills-test-");

  // Create viben state directory structure
  const skillsDir = await tempDir.mkdir("skills");
  const claudeDir = await tempDir.mkdir(".claude/skills");
  const agentsDir = await tempDir.mkdir("agents");

  // Set VIBEN_STATE_DIR to use temp directory for skills config
  originalStateDir = process.env.VIBEN_STATE_DIR;
  process.env.VIBEN_STATE_DIR = tempDir.root;

  // Mock process.exit to capture exit code instead of actually exiting
  exitCode = undefined;
  process.exit = vi.fn((code?: string | number | null | undefined) => {
    exitCode = typeof code === "number" ? code : 0;
    throw new Error(`process.exit unexpectedly called with "${code}"`);
  }) as never;

  const program = new Command();
  program.option("--json", "Output JSON format");
  program.option("--verbose", "Verbose output");
  program.option("--quiet", "Quiet mode");

  // Prevent commander from calling process.exit
  program.exitOverride();

  registerSkillCommand(program);

  const consoleSpy = createConsoleSpy();

  return {
    tempDir,
    program,
    console: consoleSpy,
    skillsDir,
    claudeDir,

    async run(args: string[]) {
      try {
        await program.parseAsync(["node", "test", ...args]);
      } catch (error) {
        // Commander throws on exitOverride, but we can ignore it
        // Also ignore process.exit mock errors
        const errorMessage = (error as Error).message || "";
        if (
          (error as Error).name !== "CommanderError" &&
          !errorMessage.includes("process.exit")
        ) {
          throw error;
        }
      }
    },

    async runJson(args: string[]) {
      try {
        await program.parseAsync(["node", "test", "--json", ...args]);
      } catch (error) {
        const errorMessage = (error as Error).message || "";
        if (
          (error as Error).name !== "CommanderError" &&
          !errorMessage.includes("process.exit")
        ) {
          throw error;
        }
      }
      const lastLog = consoleSpy.getLastLog();
      if (lastLog) {
        try {
          return JSON.parse(lastLog);
        } catch {
          return null;
        }
      }
      return null;
    },

    async cleanup() {
      consoleSpy.cleanup();
      await tempDir.cleanup();
      vi.clearAllMocks();

      // Restore original VIBEN_STATE_DIR
      if (originalStateDir !== undefined) {
        process.env.VIBEN_STATE_DIR = originalStateDir;
      } else {
        delete process.env.VIBEN_STATE_DIR;
      }

      // Restore process.exit
      process.exit = originalExit;
    },
  };
}

// =============================================================================
// Execution Tests
// =============================================================================

describe("skill command execution", () => {
  let ctx: ExecutionTestContext;

  beforeEach(async () => {
    ctx = await createExecutionTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // ===========================================================================
  // skill list execution
  // ===========================================================================

  describe("skill list", () => {
    it("should show message when no skills installed with -g flag", async () => {
      // Note: We use -g flag to only check the temp directory's skills dir
      // Without -g, listSkills also checks ~/.claude/skills which
      // may contain actual user skills that we can't control in tests
      await ctx.run(["skill", "list", "-g"]);

      // The output says "No skills installed." with a period
      expect(ctx.console.hasLog("No skills installed.")).toBe(true);
    });

    it("should list installed skills from shared directory", async () => {
      // Create a skill directory with SKILL.md
      await ctx.tempDir.mkdir("skills/test-skill");
      await ctx.tempDir.writeFile(
        "skills/test-skill/SKILL.md",
        `---
name: Test Skill
version: 1.0.0
description: A test skill
---

# Test Skill

This is a test skill.
`
      );

      await ctx.run(["skill", "list"]);

      expect(ctx.console.hasLog("Test Skill")).toBe(true);
      expect(ctx.console.hasLog("1.0.0")).toBe(true);
    });

    it("should list skills with installed.yaml tracking", async () => {
      // Create skill directory
      await ctx.tempDir.mkdir("skills/tracked-skill");
      await ctx.tempDir.writeFile(
        "skills/tracked-skill/SKILL.md",
        `---
name: Tracked Skill
version: 2.0.0
description: A tracked skill
---

# Tracked Skill
`
      );

      // Create installed.yaml
      await ctx.tempDir.writeFile(
        "skills/installed.yaml",
        `installed:
  - name: tracked-skill
    version: 2.0.0
    path: ${ctx.skillsDir}/tracked-skill
    installedAt: "2024-01-01T00:00:00Z"
`
      );

      await ctx.run(["skill", "list"]);

      expect(ctx.console.hasLog("tracked-skill")).toBe(true);
      expect(ctx.console.hasLog("2.0.0")).toBe(true);
    });

    it("should return JSON output with --json flag", async () => {
      // Create a skill directory
      await ctx.tempDir.mkdir("skills/json-skill");
      await ctx.tempDir.writeFile(
        "skills/json-skill/SKILL.md",
        `---
name: JSON Skill
version: 1.0.0
---
`
      );

      const result = (await ctx.runJson(["skill", "list"])) as {
        success: boolean;
        data: { skills: Array<{ name: string; version: string }> };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.skills).toBeDefined();
      expect(Array.isArray(result?.data?.skills)).toBe(true);
    });

    it("should list global skills with -g flag", async () => {
      // Create a global skill
      await ctx.tempDir.mkdir("skills/global-skill");
      await ctx.tempDir.writeFile(
        "skills/global-skill/SKILL.md",
        `---
name: Global Skill
version: 1.0.0
---
`
      );

      await ctx.run(["skill", "list", "-g"]);

      expect(ctx.console.hasLog("Global Skill")).toBe(true);
    });
  });

  // ===========================================================================
  // skill view execution
  // ===========================================================================

  describe("skill view", () => {
    it("should show skill details", async () => {
      // Create a skill with full metadata
      await ctx.tempDir.mkdir("skills/detail-skill");
      await ctx.tempDir.writeFile(
        "skills/detail-skill/SKILL.md",
        `---
name: Detail Skill
version: 1.5.0
description: A skill with detailed information
author: test-author
tags:
  - code
  - test
---

# Detail Skill

This is a detailed skill for testing.
`
      );

      await ctx.run(["skill", "view", "detail-skill"]);

      expect(ctx.console.hasLog("detail-skill")).toBe(true);
      expect(ctx.console.hasLog("1.5.0")).toBe(true);
    });

    it("should show error when skill not found", async () => {
      await ctx.run(["skill", "view", "nonexistent-skill"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError('Skill "nonexistent-skill" not found')).toBe(true);
    });

    it("should return JSON output for skill details", async () => {
      await ctx.tempDir.mkdir("skills/json-detail-skill");
      await ctx.tempDir.writeFile(
        "skills/json-detail-skill/SKILL.md",
        `---
name: JSON Detail Skill
version: 2.0.0
description: A skill for JSON output test
---
`
      );

      const result = (await ctx.runJson(["skill", "view", "json-detail-skill"])) as {
        success: boolean;
        data: { skill: { name: string; version: string } };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.skill).toBeDefined();
    });
  });

  // ===========================================================================
  // skill install execution
  // ===========================================================================

  describe("skill install", () => {
    it("should install a skill to global (default)", async () => {
      await ctx.run(["skill", "install", "new-skill"]);

      // Verify skill directory was created
      const exists = await ctx.tempDir.exists("skills/new-skill");
      expect(exists).toBe(true);

      // Verify SKILL.md was created
      const skillMdExists = await ctx.tempDir.exists("skills/new-skill/SKILL.md");
      expect(skillMdExists).toBe(true);

      // Verify content
      const content = await ctx.tempDir.readFile("skills/new-skill/SKILL.md");
      expect(content).toContain("name: new-skill");
    });

    it("should install skill with specific version", async () => {
      await ctx.run(["skill", "install", "versioned-skill", "--version", "2.5.0"]);

      const content = await ctx.tempDir.readFile("skills/versioned-skill/SKILL.md");
      expect(content).toContain("version: 2.5.0");
    });

    it("should install skill with name@version syntax", async () => {
      await ctx.run(["skill", "install", "syntax-skill@3.0.0"]);

      const content = await ctx.tempDir.readFile("skills/syntax-skill/SKILL.md");
      expect(content).toContain("version: 3.0.0");
    });

    it("should update installed.yaml after install", async () => {
      await ctx.run(["skill", "install", "tracked-install"]);

      const installedYaml = await ctx.tempDir.readFile("skills/installed.yaml");
      expect(installedYaml).toContain("tracked-install");
    });

    it("should reject duplicate skill without -f", async () => {
      // First install
      await ctx.run(["skill", "install", "duplicate-skill"]);

      // Try to install again - should fail
      ctx.console.reset();
      await ctx.run(["skill", "install", "duplicate-skill"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("already exists")).toBe(true);
    });

    it("should allow reinstall with -f flag", async () => {
      // First install
      await ctx.run(["skill", "install", "force-skill"]);

      // Reinstall with force
      ctx.console.reset();
      await ctx.run(["skill", "install", "force-skill", "-f"]);

      expect(ctx.console.hasLog("installed successfully")).toBe(true);
    });

    it("should install skill from local source with --source", async () => {
      // Create source skill directory
      await ctx.tempDir.mkdir("source-skill");
      await ctx.tempDir.writeFile(
        "source-skill/SKILL.md",
        `---
name: Source Skill
version: 1.0.0
description: Copied from source
---
`
      );

      await ctx.run([
        "skill",
        "install",
        "copied-skill",
        "--source",
        ctx.tempDir.resolve("source-skill"),
      ]);

      // Verify skill was copied
      const copiedContent = await ctx.tempDir.readFile("skills/copied-skill/SKILL.md");
      expect(copiedContent).toContain("Source Skill");
    });

    it("should install skill to custom path with --path", async () => {
      const customPath = await ctx.tempDir.mkdir("custom-skills");

      await ctx.run([
        "skill",
        "install",
        "custom-path-skill",
        "--path",
        customPath,
      ]);

      // Verify skill was installed to custom path
      const exists = await ctx.tempDir.exists("custom-skills/custom-path-skill/SKILL.md");
      expect(exists).toBe(true);
    });

    it("should return JSON output on success", async () => {
      const result = (await ctx.runJson(["skill", "install", "json-install-skill"])) as {
        success: boolean;
        data: { result: { name: string; version: string; path: string } };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.result?.name).toBe("json-install-skill");
      expect(result?.data?.result?.path).toBeDefined();
    });
  });

  // ===========================================================================
  // skill uninstall execution
  // ===========================================================================

  describe("skill uninstall", () => {
    it("should uninstall a skill", async () => {
      // First install a skill
      await ctx.run(["skill", "install", "to-uninstall"]);

      // Verify it exists
      expect(await ctx.tempDir.exists("skills/to-uninstall")).toBe(true);

      // Uninstall
      ctx.console.reset();
      await ctx.run(["skill", "uninstall", "to-uninstall"]);

      // Verify it's removed
      expect(await ctx.tempDir.exists("skills/to-uninstall")).toBe(false);
      expect(ctx.console.hasLog("uninstalled successfully")).toBe(true);
    });

    it("should update installed.yaml after uninstall", async () => {
      // Install a skill
      await ctx.run(["skill", "install", "track-uninstall"]);

      // Verify it's in installed.yaml
      let installedYaml = await ctx.tempDir.readFile("skills/installed.yaml");
      expect(installedYaml).toContain("track-uninstall");

      // Uninstall
      await ctx.run(["skill", "uninstall", "track-uninstall"]);

      // Verify it's removed from installed.yaml
      installedYaml = await ctx.tempDir.readFile("skills/installed.yaml");
      expect(installedYaml).not.toContain("track-uninstall");
    });

    it("should return error for non-existent skill", async () => {
      await ctx.run(["skill", "uninstall", "nonexistent"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("not found")).toBe(true);
    });

    it("should uninstall from custom path with --path", async () => {
      const customPath = await ctx.tempDir.mkdir("custom-uninstall-skills");

      // Install to custom path
      await ctx.run([
        "skill",
        "install",
        "custom-uninstall-skill",
        "--path",
        customPath,
      ]);

      expect(await ctx.tempDir.exists("custom-uninstall-skills/custom-uninstall-skill")).toBe(true);

      // Uninstall from custom path
      await ctx.run([
        "skill",
        "uninstall",
        "custom-uninstall-skill",
        "--path",
        customPath,
      ]);

      expect(await ctx.tempDir.exists("custom-uninstall-skills/custom-uninstall-skill")).toBe(false);
    });

    it("should return JSON output on success", async () => {
      // Install first
      await ctx.run(["skill", "install", "json-uninstall-skill"]);

      // Uninstall with JSON
      const result = (await ctx.runJson([
        "skill",
        "uninstall",
        "json-uninstall-skill",
      ])) as {
        success: boolean;
        data: { result: { name: string; success: boolean } };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.result?.name).toBe("json-uninstall-skill");
    });
  });

  // ===========================================================================
  // skill path execution (backward compatibility alias)
  // ===========================================================================

  describe("skill path", () => {
    it("should return path to shared skill", async () => {
      await ctx.run(["skill", "path", "test-skill"]);

      expect(ctx.console.hasLog(join(ctx.skillsDir, "test-skill"))).toBe(true);
    });

    it("should return path for another skill", async () => {
      await ctx.run(["skill", "path", "another-skill"]);

      expect(ctx.console.hasLog(join(ctx.skillsDir, "another-skill"))).toBe(true);
    });
  });

  // ===========================================================================
  // skill available execution
  // ===========================================================================

  describe("skill list --available", () => {
    it("should list available skills from marketplace", async () => {
      await ctx.run(["skill", "list", "--available"]);

      // The mock data includes these skills
      expect(ctx.console.hasLog("code-review")).toBe(true);
      expect(ctx.console.hasLog("commit")).toBe(true);
    });

    it("should return JSON output for available skills", async () => {
      const result = (await ctx.runJson(["skill", "list", "--available"])) as {
        success: boolean;
        data: { skills: Array<{ name: string }> };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.skills).toBeDefined();
      expect(Array.isArray(result?.data?.skills)).toBe(true);
    });
  });

  // ===========================================================================
  // skill enable/disable execution with agent
  // ===========================================================================

  describe("skill enable/disable for agent", () => {
    beforeEach(async () => {
      // Create an agent directory
      await ctx.tempDir.mkdir("agents/test-agent");
      await ctx.tempDir.writeFile(
        "agents/test-agent/AGENTS.md",
        `---
name: Test Agent
description: A test agent
---
`
      );

      // Install a skill that can be enabled
      await ctx.run(["skill", "install", "enable-test-skill"]);
    });

    it("should enable a skill for an agent", async () => {
      await ctx.run(["skill", "enable", "enable-test-skill", "--agent", "test-agent"]);

      // Verify skills_config.yaml was created
      const configExists = await ctx.tempDir.exists("agents/test-agent/skills_config.yaml");
      expect(configExists).toBe(true);

      const config = await ctx.tempDir.readFile("agents/test-agent/skills_config.yaml");
      expect(config).toContain("enable-test-skill");
      expect(config).toContain("enabled: true");
    });

    it("should disable an enabled skill for an agent", async () => {
      // First enable
      await ctx.run(["skill", "enable", "enable-test-skill", "--agent", "test-agent"]);

      // Then disable
      await ctx.run(["skill", "disable", "enable-test-skill", "--agent", "test-agent"]);

      const config = await ctx.tempDir.readFile("agents/test-agent/skills_config.yaml");
      expect(config).toContain("enable-test-skill");
      expect(config).toContain("enabled: false");
    });

    it("should return error when agent not found", async () => {
      await ctx.run(["skill", "enable", "enable-test-skill", "--agent", "nonexistent-agent"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("not found")).toBe(true);
    });

    it("should return error when skill not found", async () => {
      await ctx.run(["skill", "enable", "nonexistent-skill", "--agent", "test-agent"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("not found")).toBe(true);
    });
  });

  // ===========================================================================
  // skill enabled execution
  // ===========================================================================

  describe("skill enabled", () => {
    beforeEach(async () => {
      // Create an agent directory
      await ctx.tempDir.mkdir("agents/enabled-agent");
      await ctx.tempDir.writeFile(
        "agents/enabled-agent/AGENTS.md",
        `---
name: Enabled Agent
---
`
      );

      // Install and enable a skill
      await ctx.run(["skill", "install", "enabled-skill-1"]);
      await ctx.run(["skill", "install", "enabled-skill-2"]);
    });

    it("should show message when no skills enabled", async () => {
      await ctx.run(["skill", "enabled", "--agent", "enabled-agent"]);

      expect(ctx.console.hasLog('No skills enabled for agent "enabled-agent"')).toBe(true);
    });

    it("should list enabled skills for an agent", async () => {
      // Enable skills
      await ctx.run(["skill", "enable", "enabled-skill-1", "--agent", "enabled-agent"]);
      await ctx.run(["skill", "enable", "enabled-skill-2", "--agent", "enabled-agent"]);

      ctx.console.reset();
      await ctx.run(["skill", "enabled", "--agent", "enabled-agent"]);

      expect(ctx.console.hasLog("enabled-skill-1")).toBe(true);
      expect(ctx.console.hasLog("enabled-skill-2")).toBe(true);
    });

    it("should return JSON output for enabled skills", async () => {
      await ctx.run(["skill", "enable", "enabled-skill-1", "--agent", "enabled-agent"]);

      const result = (await ctx.runJson(["skill", "enabled", "--agent", "enabled-agent"])) as {
        success: boolean;
        data: { agent: string; skills: Array<{ skillName: string }> };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.agent).toBe("enabled-agent");
      expect(result?.data?.skills).toBeDefined();
    });
  });

  // ===========================================================================
  // skill list --agent execution
  // ===========================================================================

  describe("skill list --agent", () => {
    beforeEach(async () => {
      // Create agent with skills directory
      await ctx.tempDir.mkdir("agents/skill-agent/skills");
      await ctx.tempDir.writeFile(
        "agents/skill-agent/AGENTS.md",
        `---
name: Skill Agent
---
`
      );
    });

    it("should show message when no skills for agent", async () => {
      await ctx.run(["skill", "list", "--agent", "skill-agent"]);

      expect(ctx.console.hasLog('No skills installed for agent "skill-agent"')).toBe(true);
    });

    it("should list skills installed for agent", async () => {
      // Create a skill in agent's skills directory
      await ctx.tempDir.mkdir("agents/skill-agent/skills/agent-skill");
      await ctx.tempDir.writeFile(
        "agents/skill-agent/skills/agent-skill/SKILL.md",
        `---
name: Agent Skill
version: 1.0.0
---
`
      );

      await ctx.run(["skill", "list", "--agent", "skill-agent"]);

      expect(ctx.console.hasLog("Agent Skill")).toBe(true);
    });

    it("should return JSON output for agent skills", async () => {
      // Create a skill in agent's skills directory
      await ctx.tempDir.mkdir("agents/skill-agent/skills/json-agent-skill");
      await ctx.tempDir.writeFile(
        "agents/skill-agent/skills/json-agent-skill/SKILL.md",
        `---
name: JSON Agent Skill
version: 1.0.0
---
`
      );

      const result = (await ctx.runJson(["skill", "list", "--agent", "skill-agent"])) as {
        success: boolean;
        data: { skills: Array<{ name: string }> };
      };

      expect(result?.success).toBe(true);
    });
  });

  // ===========================================================================
  // Verify file content after operations
  // ===========================================================================

  describe("file content verification", () => {
    it("should create proper SKILL.md frontmatter on install", async () => {
      await ctx.run(["skill", "install", "frontmatter-skill", "--version", "1.2.3"]);

      const content = await ctx.tempDir.readFile("skills/frontmatter-skill/SKILL.md");

      // Verify frontmatter format
      expect(content).toMatch(/^---\n/);
      expect(content).toContain("name: frontmatter-skill");
      expect(content).toContain("version: 1.2.3");
      expect(content).toMatch(/---\n/);
    });

    it("should preserve skill metadata when reading", async () => {
      // Create a skill with full metadata
      await ctx.tempDir.mkdir("skills/metadata-skill");
      await ctx.tempDir.writeFile(
        "skills/metadata-skill/SKILL.md",
        `---
name: Metadata Test Skill
version: 3.0.0
description: A skill with complete metadata
author: test-author
tags:
  - testing
  - metadata
---

# Metadata Test Skill

Full content here.
`
      );

      const result = (await ctx.runJson(["skill", "view", "metadata-skill"])) as {
        success: boolean;
        data: { skill: { name: string; version: string; description?: string } };
      };

      expect(result?.data?.skill?.name).toBe("Metadata Test Skill");
      expect(result?.data?.skill?.version).toBe("3.0.0");
    });

    it("should maintain installed.yaml integrity across operations", async () => {
      // Install multiple skills
      await ctx.run(["skill", "install", "skill-a"]);
      await ctx.run(["skill", "install", "skill-b"]);
      await ctx.run(["skill", "install", "skill-c"]);

      // Verify all are tracked
      let installedYaml = await ctx.tempDir.readFile("skills/installed.yaml");
      expect(installedYaml).toContain("skill-a");
      expect(installedYaml).toContain("skill-b");
      expect(installedYaml).toContain("skill-c");

      // Uninstall one
      await ctx.run(["skill", "uninstall", "skill-b"]);

      // Verify only skill-b is removed
      installedYaml = await ctx.tempDir.readFile("skills/installed.yaml");
      expect(installedYaml).toContain("skill-a");
      expect(installedYaml).not.toContain("skill-b");
      expect(installedYaml).toContain("skill-c");
    });
  });
});
