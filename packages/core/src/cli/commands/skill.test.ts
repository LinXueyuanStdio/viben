/**
 * Skill CLI Commands Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { registerSkillCommand } from "./skill";
import type { InstalledSkill, Skill } from "../../types";
import type {
  AvailableSkill,
  AgentSkillConfig,
  InstallSkillResult,
  UninstallSkillResult,
} from "../../skills/types";

// Mock the skills module
vi.mock("../../skills", () => ({
  skillsManager: {
    listInstalledSkills: vi.fn(),
    listAvailableSkills: vi.fn(),
    listAgentSkills: vi.fn(),
    getSkillInfo: vi.fn(),
    installSkill: vi.fn(),
    uninstallSkill: vi.fn(),
    enableSkill: vi.fn(),
    disableSkill: vi.fn(),
    getEnabledSkills: vi.fn(),
    getSharedSkillPath: vi.fn(),
    getAgentSkillPath: vi.fn(),
    getClaudeSkillPath: vi.fn(),
  },
}));

// Mock chalk to avoid color output in tests
vi.mock("chalk", () => ({
  default: {
    bold: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    gray: (s: string) => s,
    cyan: (s: string) => s,
    blue: (s: string) => s,
  },
}));

// Mock process.exit
vi.spyOn(process, "exit").mockImplementation((code?: number | string | null | undefined) => {
  throw new Error(`process.exit(${code})`);
});

import { skillsManager } from "../../skills";

/**
 * Helper to create a mock installed skill
 */
function createMockInstalledSkill(overrides: Partial<InstalledSkill> = {}): InstalledSkill {
  return {
    name: "test-skill",
    version: "1.0.0",
    path: "/path/to/skills/test-skill",
    installedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Helper to create a mock skill (with full details)
 */
function createMockSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "test-skill",
    name: "Test Skill",
    version: "1.0.0",
    path: "/path/to/skills/test-skill",
    source: "local",
    description: "A test skill",
    ...overrides,
  };
}

/**
 * Helper to create a mock available skill
 */
function createMockAvailableSkill(overrides: Partial<AvailableSkill> = {}): AvailableSkill {
  return {
    name: "available-skill",
    version: "1.0.0",
    description: "An available skill from marketplace",
    ...overrides,
  };
}

/**
 * Helper to create a mock agent skill config
 */
function createMockAgentSkillConfig(
  overrides: Partial<AgentSkillConfig> = {}
): AgentSkillConfig {
  return {
    skillName: "test-skill",
    enabled: true,
    agentId: "test-agent",
    enabledAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Helper to create a mock install result
 */
function createMockInstallResult(
  overrides: Partial<InstallSkillResult> = {}
): InstallSkillResult {
  return {
    success: true,
    name: "test-skill",
    version: "1.0.0",
    path: "/path/to/skills/test-skill",
    target: "global",
    message: 'Skill "test-skill" installed successfully to global',
    ...overrides,
  };
}

/**
 * Helper to create a mock uninstall result
 */
function createMockUninstallResult(
  overrides: Partial<UninstallSkillResult> = {}
): UninstallSkillResult {
  return {
    success: true,
    name: "test-skill",
    message: 'Skill "test-skill" uninstalled successfully from global',
    ...overrides,
  };
}

describe("Skill CLI Commands", () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create fresh program instance
    program = new Command();
    program.option("--json", "Output in JSON format");
    program.option("--verbose", "Verbose output");
    program.option("--quiet", "Quiet mode");

    // Register skill commands
    registerSkillCommand(program);

    // Spy on console
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Helper to run command
  // ============================================================================
  async function runCommand(args: string[]): Promise<void> {
    await program.parseAsync(["node", "test", ...args]);
  }

  // ============================================================================
  // skill list Tests
  // ============================================================================

  describe("skill list", () => {
    it("should list installed skills", async () => {
      const mockSkills = [
        createMockInstalledSkill({
          name: "code-review",
          version: "1.0.0",
          path: "/path/to/code-review",
          installedAt: "2024-01-01T00:00:00Z",
        }),
        createMockInstalledSkill({
          name: "commit-helper",
          version: "1.2.0",
          path: "/path/to/commit-helper",
          installedAt: "2024-01-02T00:00:00Z",
        }),
      ];

      vi.mocked(skillsManager.listInstalledSkills).mockResolvedValue(mockSkills);

      await runCommand(["skill", "list"]);

      expect(skillsManager.listInstalledSkills).toHaveBeenCalledWith(undefined);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should show message when no skills installed", async () => {
      vi.mocked(skillsManager.listInstalledSkills).mockResolvedValue([]);

      await runCommand(["skill", "list"]);

      expect(skillsManager.listInstalledSkills).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("No skills installed"));
    });

    it("should output JSON when --json flag is provided", async () => {
      const mockSkills = [
        createMockInstalledSkill({
          name: "code-review",
          version: "1.0.0",
        }),
      ];

      vi.mocked(skillsManager.listInstalledSkills).mockResolvedValue(mockSkills);

      await runCommand(["--json", "skill", "list"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
    });
  });

  describe("skill list --available", () => {
    it("should list available skills from marketplace", async () => {
      const mockAvailable = [
        createMockAvailableSkill({
          name: "marketplace-skill-1",
          version: "2.0.0",
          description: "First marketplace skill",
        }),
        createMockAvailableSkill({
          name: "marketplace-skill-2",
          version: "1.5.0",
          description: "Second marketplace skill",
        }),
      ];

      vi.mocked(skillsManager.listAvailableSkills).mockResolvedValue(mockAvailable);

      await runCommand(["skill", "list", "--available"]);

      expect(skillsManager.listAvailableSkills).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should show message when no skills available in marketplace", async () => {
      vi.mocked(skillsManager.listAvailableSkills).mockResolvedValue([]);

      await runCommand(["skill", "list", "--available"]);

      expect(skillsManager.listAvailableSkills).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No skills available in marketplace")
      );
    });

    it("should output JSON for available skills", async () => {
      const mockAvailable = [
        createMockAvailableSkill({ name: "marketplace-skill" }),
      ];

      vi.mocked(skillsManager.listAvailableSkills).mockResolvedValue(mockAvailable);

      await runCommand(["--json", "skill", "list", "--available"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"skills"'));
    });
  });

  describe("skill list --agent <id>", () => {
    it("should list skills for a specific agent", async () => {
      const mockSkills = [
        createMockSkill({
          id: "agent-skill-1",
          name: "Agent Skill 1",
          version: "1.0.0",
          path: "/path/to/agent/skills/agent-skill-1",
        }),
      ];

      vi.mocked(skillsManager.listAgentSkills).mockResolvedValue(mockSkills);

      await runCommand(["skill", "list", "--agent", "my-agent"]);

      expect(skillsManager.listAgentSkills).toHaveBeenCalledWith("my-agent");
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should show message when no skills for agent", async () => {
      vi.mocked(skillsManager.listAgentSkills).mockResolvedValue([]);

      await runCommand(["skill", "list", "--agent", "my-agent"]);

      expect(skillsManager.listAgentSkills).toHaveBeenCalledWith("my-agent");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No skills installed for agent "my-agent"')
      );
    });

    it("should output JSON for agent skills", async () => {
      const mockSkills = [createMockSkill({ name: "agent-skill" })];

      vi.mocked(skillsManager.listAgentSkills).mockResolvedValue(mockSkills);

      await runCommand(["--json", "skill", "list", "--agent", "my-agent"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"agent": "my-agent"'));
    });
  });

  describe("skill list --global", () => {
    it("should list only global skills", async () => {
      const mockSkills = [
        createMockInstalledSkill({
          name: "global-skill",
          version: "1.0.0",
        }),
      ];

      vi.mocked(skillsManager.listInstalledSkills).mockResolvedValue(mockSkills);

      await runCommand(["skill", "list", "--global"]);

      expect(skillsManager.listInstalledSkills).toHaveBeenCalledWith({ target: "global" });
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe("skill list --claude", () => {
    it("should list only Claude skills", async () => {
      const mockSkills = [
        createMockInstalledSkill({
          name: "claude-skill",
          version: "1.0.0",
        }),
      ];

      vi.mocked(skillsManager.listInstalledSkills).mockResolvedValue(mockSkills);

      await runCommand(["skill", "list", "--claude"]);

      expect(skillsManager.listInstalledSkills).toHaveBeenCalledWith({ target: "claude" });
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // skill show Tests
  // ============================================================================

  describe("skill show <name>", () => {
    it("should show skill details", async () => {
      const mockSkill = createMockSkill({
        id: "code-review",
        name: "Code Review",
        version: "1.0.0",
        description: "Code review skill",
        path: "/path/to/code-review",
        source: "local",
      });

      vi.mocked(skillsManager.getSkillInfo).mockResolvedValue(mockSkill);

      await runCommand(["skill", "show", "code-review"]);

      expect(skillsManager.getSkillInfo).toHaveBeenCalledWith("code-review", undefined);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should show skill details for specific agent", async () => {
      const mockSkill = createMockSkill({
        id: "agent-skill",
        name: "Agent Skill",
      });

      vi.mocked(skillsManager.getSkillInfo).mockResolvedValue(mockSkill);

      await runCommand(["skill", "show", "agent-skill", "--agent", "my-agent"]);

      expect(skillsManager.getSkillInfo).toHaveBeenCalledWith("agent-skill", {
        target: "agent",
        agentId: "my-agent",
      });
    });

    it("should show error when skill not found", async () => {
      vi.mocked(skillsManager.getSkillInfo).mockResolvedValue(null);

      await expect(runCommand(["skill", "show", "nonexistent"])).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skill "nonexistent" not found')
      );
    });

    it("should output JSON for skill show", async () => {
      const mockSkill = createMockSkill({ name: "code-review" });

      vi.mocked(skillsManager.getSkillInfo).mockResolvedValue(mockSkill);

      await runCommand(["--json", "skill", "show", "code-review"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
    });
  });

  // ============================================================================
  // skill install Tests
  // ============================================================================

  describe("skill install <name>", () => {
    it("should install a skill globally (default)", async () => {
      const mockResult = createMockInstallResult({
        name: "new-skill",
        target: "global",
      });

      vi.mocked(skillsManager.installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "new-skill"]);

      expect(skillsManager.installSkill).toHaveBeenCalledWith({
        name: "new-skill",
        target: "global",
        agentId: undefined,
        customPath: undefined,
        sourcePath: undefined,
        version: undefined,
        force: undefined,
      });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should install skill with --agent option", async () => {
      const mockResult = createMockInstallResult({
        name: "agent-skill",
        target: "agent",
      });

      vi.mocked(skillsManager.installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "agent-skill", "--agent", "my-agent"]);

      expect(skillsManager.installSkill).toHaveBeenCalledWith({
        name: "agent-skill",
        target: "agent",
        agentId: "my-agent",
        customPath: undefined,
        sourcePath: undefined,
        version: undefined,
        force: undefined,
      });
    });

    it("should install skill with --global option", async () => {
      const mockResult = createMockInstallResult({ target: "global" });

      vi.mocked(skillsManager.installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "my-skill", "--global"]);

      expect(skillsManager.installSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          target: "global",
        })
      );
    });

    it("should install skill with --claude option", async () => {
      const mockResult = createMockInstallResult({ target: "claude" });

      vi.mocked(skillsManager.installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "claude-skill", "--claude"]);

      expect(skillsManager.installSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          target: "claude",
        })
      );
    });

    it("should install skill with --path option", async () => {
      const mockResult = createMockInstallResult({ target: "custom" });

      vi.mocked(skillsManager.installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "custom-skill", "--path", "/custom/path"]);

      expect(skillsManager.installSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          target: "custom",
          customPath: "/custom/path",
        })
      );
    });

    it("should install skill with --force option", async () => {
      const mockResult = createMockInstallResult();

      vi.mocked(skillsManager.installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "existing-skill", "--force"]);

      expect(skillsManager.installSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          force: true,
        })
      );
    });

    it("should install skill with --source option", async () => {
      const mockResult = createMockInstallResult();

      vi.mocked(skillsManager.installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "local-skill", "--source", "/local/source"]);

      expect(skillsManager.installSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          sourcePath: "/local/source",
        })
      );
    });

    it("should install skill with --version option", async () => {
      const mockResult = createMockInstallResult({ version: "2.0.0" });

      vi.mocked(skillsManager.installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "my-skill", "--version", "2.0.0"]);

      expect(skillsManager.installSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          version: "2.0.0",
        })
      );
    });

    it("should install skill with name@version syntax", async () => {
      const mockResult = createMockInstallResult({
        name: "my-skill",
        version: "2.0.0",
      });

      vi.mocked(skillsManager.installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "my-skill@2.0.0"]);

      expect(skillsManager.installSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "my-skill",
          version: "2.0.0",
        })
      );
    });

    it("should install skill with name@latest syntax (resolves to undefined version)", async () => {
      const mockResult = createMockInstallResult({
        name: "my-skill",
        version: "3.0.0",
      });

      vi.mocked(skillsManager.installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "my-skill@latest"]);

      expect(skillsManager.installSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "my-skill",
          version: undefined,
        })
      );
    });

    it("should prefer --version option over @version in name", async () => {
      const mockResult = createMockInstallResult({ version: "3.0.0" });

      vi.mocked(skillsManager.installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "my-skill@2.0.0", "--version", "3.0.0"]);

      expect(skillsManager.installSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "my-skill",
          version: "3.0.0",
        })
      );
    });

    it("should install skill with --executor claude-code option", async () => {
      const mockResult = createMockInstallResult({ target: "claude" });

      vi.mocked(skillsManager.installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "my-skill", "--executor", "claude-code"]);

      expect(skillsManager.installSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "my-skill",
          target: "claude",
          executor: "claude-code",
        })
      );
    });

    it("should install skill with --executor option (unknown executor defaults to global)", async () => {
      const mockResult = createMockInstallResult({ target: "global" });

      vi.mocked(skillsManager.installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "my-skill", "--executor", "unknown-executor"]);

      expect(skillsManager.installSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "my-skill",
          target: "global",
          executor: "unknown-executor",
        })
      );
    });

    it("should output JSON for skill install", async () => {
      const mockResult = createMockInstallResult();

      vi.mocked(skillsManager.installSkill).mockResolvedValue(mockResult);

      await runCommand(["--json", "skill", "install", "new-skill"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
    });

    it("should handle install error", async () => {
      vi.mocked(skillsManager.installSkill).mockRejectedValue(
        new Error('Skill "test-skill" already exists')
      );

      await expect(
        runCommand(["skill", "install", "test-skill"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // skill uninstall Tests
  // ============================================================================

  describe("skill uninstall <name>", () => {
    it("should uninstall a skill from global (default)", async () => {
      const mockResult = createMockUninstallResult({ name: "old-skill" });

      vi.mocked(skillsManager.uninstallSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "uninstall", "old-skill"]);

      expect(skillsManager.uninstallSkill).toHaveBeenCalledWith({
        name: "old-skill",
        target: "global",
        agentId: undefined,
        customPath: undefined,
      });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should uninstall skill from agent with --agent option", async () => {
      const mockResult = createMockUninstallResult();

      vi.mocked(skillsManager.uninstallSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "uninstall", "agent-skill", "--agent", "my-agent"]);

      expect(skillsManager.uninstallSkill).toHaveBeenCalledWith({
        name: "agent-skill",
        target: "agent",
        agentId: "my-agent",
        customPath: undefined,
      });
    });

    it("should uninstall skill from claude with --claude option", async () => {
      const mockResult = createMockUninstallResult();

      vi.mocked(skillsManager.uninstallSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "uninstall", "claude-skill", "--claude"]);

      expect(skillsManager.uninstallSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          target: "claude",
        })
      );
    });

    it("should uninstall skill from custom path with --path option", async () => {
      const mockResult = createMockUninstallResult();

      vi.mocked(skillsManager.uninstallSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "uninstall", "custom-skill", "--path", "/custom/path"]);

      expect(skillsManager.uninstallSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          target: "custom",
          customPath: "/custom/path",
        })
      );
    });

    it("should output JSON for skill uninstall", async () => {
      const mockResult = createMockUninstallResult();

      vi.mocked(skillsManager.uninstallSkill).mockResolvedValue(mockResult);

      await runCommand(["--json", "skill", "uninstall", "old-skill"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
    });

    it("should handle uninstall error when skill not found", async () => {
      vi.mocked(skillsManager.uninstallSkill).mockRejectedValue(
        new Error('Skill "nonexistent" not found')
      );

      await expect(
        runCommand(["skill", "uninstall", "nonexistent"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // skill enable Tests
  // ============================================================================

  describe("skill enable <name> --agent <id>", () => {
    it("should enable a skill for an agent", async () => {
      const mockConfig = createMockAgentSkillConfig({
        skillName: "code-review",
        enabled: true,
        agentId: "my-agent",
      });

      vi.mocked(skillsManager.enableSkill).mockResolvedValue(mockConfig);

      await runCommand(["skill", "enable", "code-review", "--agent", "my-agent"]);

      expect(skillsManager.enableSkill).toHaveBeenCalledWith("code-review", "my-agent");
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should output JSON for skill enable", async () => {
      const mockConfig = createMockAgentSkillConfig();

      vi.mocked(skillsManager.enableSkill).mockResolvedValue(mockConfig);

      await runCommand(["--json", "skill", "enable", "code-review", "--agent", "my-agent"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
    });

    it("should handle error when agent not found", async () => {
      vi.mocked(skillsManager.enableSkill).mockRejectedValue(
        new Error('Agent "nonexistent" not found')
      );

      await expect(
        runCommand(["skill", "enable", "code-review", "--agent", "nonexistent"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle error when skill not found", async () => {
      vi.mocked(skillsManager.enableSkill).mockRejectedValue(
        new Error('Skill "nonexistent" not found')
      );

      await expect(
        runCommand(["skill", "enable", "nonexistent", "--agent", "my-agent"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // skill disable Tests
  // ============================================================================

  describe("skill disable <name> --agent <id>", () => {
    it("should disable a skill for an agent", async () => {
      const mockConfig = createMockAgentSkillConfig({
        skillName: "code-review",
        enabled: false,
        agentId: "my-agent",
      });

      vi.mocked(skillsManager.disableSkill).mockResolvedValue(mockConfig);

      await runCommand(["skill", "disable", "code-review", "--agent", "my-agent"]);

      expect(skillsManager.disableSkill).toHaveBeenCalledWith("code-review", "my-agent");
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should output JSON for skill disable", async () => {
      const mockConfig = createMockAgentSkillConfig({ enabled: false });

      vi.mocked(skillsManager.disableSkill).mockResolvedValue(mockConfig);

      await runCommand(["--json", "skill", "disable", "code-review", "--agent", "my-agent"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
    });

    it("should handle error when skill config not found", async () => {
      vi.mocked(skillsManager.disableSkill).mockRejectedValue(
        new Error('Skill configuration "code-review" not found')
      );

      await expect(
        runCommand(["skill", "disable", "code-review", "--agent", "my-agent"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // skill enabled Tests
  // ============================================================================

  describe("skill enabled --agent <id>", () => {
    it("should list enabled skills for an agent", async () => {
      const mockEnabledSkills = [
        createMockAgentSkillConfig({
          skillName: "code-review",
          enabled: true,
          agentId: "my-agent",
          enabledAt: "2024-01-01T00:00:00Z",
        }),
        createMockAgentSkillConfig({
          skillName: "commit-helper",
          enabled: true,
          agentId: "my-agent",
          enabledAt: "2024-01-02T00:00:00Z",
        }),
      ];

      vi.mocked(skillsManager.getEnabledSkills).mockResolvedValue(mockEnabledSkills);

      await runCommand(["skill", "enabled", "--agent", "my-agent"]);

      expect(skillsManager.getEnabledSkills).toHaveBeenCalledWith("my-agent");
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should show message when no skills enabled", async () => {
      vi.mocked(skillsManager.getEnabledSkills).mockResolvedValue([]);

      await runCommand(["skill", "enabled", "--agent", "my-agent"]);

      expect(skillsManager.getEnabledSkills).toHaveBeenCalledWith("my-agent");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No skills enabled for agent "my-agent"')
      );
    });

    it("should output JSON for enabled skills", async () => {
      const mockEnabledSkills = [createMockAgentSkillConfig()];

      vi.mocked(skillsManager.getEnabledSkills).mockResolvedValue(mockEnabledSkills);

      await runCommand(["--json", "skill", "enabled", "--agent", "my-agent"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"agent": "my-agent"'));
    });

    it("should handle error when getting enabled skills fails", async () => {
      vi.mocked(skillsManager.getEnabledSkills).mockRejectedValue(
        new Error('Failed to get enabled skills for agent "my-agent"')
      );

      await expect(
        runCommand(["skill", "enabled", "--agent", "my-agent"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // skill path Tests
  // ============================================================================

  describe("skill path <name>", () => {
    it("should get path to a shared skill (default)", async () => {
      vi.mocked(skillsManager.getSharedSkillPath).mockReturnValue(
        "/path/to/shared/skills/code-review"
      );

      await runCommand(["skill", "path", "code-review"]);

      expect(skillsManager.getSharedSkillPath).toHaveBeenCalledWith("code-review");
      expect(consoleSpy).toHaveBeenCalledWith("/path/to/shared/skills/code-review");
    });

    it("should get path to an agent skill with --agent option", async () => {
      vi.mocked(skillsManager.getAgentSkillPath).mockReturnValue(
        "/path/to/agent/skills/code-review"
      );

      await runCommand(["skill", "path", "code-review", "--agent", "my-agent"]);

      expect(skillsManager.getAgentSkillPath).toHaveBeenCalledWith("my-agent", "code-review");
      expect(consoleSpy).toHaveBeenCalledWith("/path/to/agent/skills/code-review");
    });

    it("should get path to a Claude skill with --claude option", async () => {
      vi.mocked(skillsManager.getClaudeSkillPath).mockReturnValue(
        "/path/to/claude/skills/code-review"
      );

      await runCommand(["skill", "path", "code-review", "--claude"]);

      expect(skillsManager.getClaudeSkillPath).toHaveBeenCalledWith("code-review");
      expect(consoleSpy).toHaveBeenCalledWith("/path/to/claude/skills/code-review");
    });

    it("should get path to global skill with --global option", async () => {
      vi.mocked(skillsManager.getSharedSkillPath).mockReturnValue(
        "/path/to/global/skills/code-review"
      );

      await runCommand(["skill", "path", "code-review", "--global"]);

      expect(skillsManager.getSharedSkillPath).toHaveBeenCalledWith("code-review");
    });

    it("should output JSON for skill path", async () => {
      vi.mocked(skillsManager.getSharedSkillPath).mockReturnValue(
        "/path/to/skills/code-review"
      );

      await runCommand(["--json", "skill", "path", "code-review"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"path"'));
    });

    it("should handle error when getting path fails", async () => {
      vi.mocked(skillsManager.getSharedSkillPath).mockImplementation(() => {
        throw new Error("Failed to get skill path");
      });

      await expect(
        runCommand(["skill", "path", "nonexistent"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // JSON Output Tests
  // ============================================================================

  describe("JSON output mode", () => {
    it("should output JSON for skill list with count", async () => {
      const mockSkills = [
        createMockInstalledSkill({ name: "skill-1" }),
        createMockInstalledSkill({ name: "skill-2" }),
      ];

      vi.mocked(skillsManager.listInstalledSkills).mockResolvedValue(mockSkills);

      await runCommand(["--json", "skill", "list"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"count": 2'));
    });

    it("should output JSON error response", async () => {
      vi.mocked(skillsManager.getSkillInfo).mockResolvedValue(null);

      await expect(
        runCommand(["--json", "skill", "show", "nonexistent"])
      ).rejects.toThrow();

      // In JSON mode, errors are output via console.log with JSON format
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": false'));
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("Error handling", () => {
    it("should handle generic errors during list", async () => {
      vi.mocked(skillsManager.listInstalledSkills).mockRejectedValue(
        new Error("Database connection failed")
      );

      await expect(runCommand(["skill", "list"])).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle generic errors during install", async () => {
      vi.mocked(skillsManager.installSkill).mockRejectedValue(
        new Error("Network error during download")
      );

      await expect(
        runCommand(["skill", "install", "remote-skill"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle validation errors", async () => {
      vi.mocked(skillsManager.installSkill).mockRejectedValue(
        new Error("Agent ID is required when target is 'agent'")
      );

      // This tries to install with agent target but CLI defaults to global
      // The error would come from skillsManager validation
      await expect(
        runCommand(["skill", "install", "my-skill"])
      ).rejects.toThrow();

      // No error expected since we're not triggering the validation error
    });
  });

  // ============================================================================
  // Combined Options Tests
  // ============================================================================

  describe("Combined options", () => {
    it("should install skill with multiple options", async () => {
      const mockResult = createMockInstallResult({
        name: "full-skill",
        version: "2.0.0",
        target: "agent",
      });

      vi.mocked(skillsManager.installSkill).mockResolvedValue(mockResult);

      await runCommand([
        "skill",
        "install",
        "full-skill",
        "--agent",
        "my-agent",
        "--version",
        "2.0.0",
        "--force",
        "--source",
        "/local/path",
      ]);

      expect(skillsManager.installSkill).toHaveBeenCalledWith({
        name: "full-skill",
        target: "agent",
        agentId: "my-agent",
        customPath: undefined,
        sourcePath: "/local/path",
        version: "2.0.0",
        executor: undefined,
        force: true,
      });
    });

    it("should install skill with name@version and --agent combined", async () => {
      const mockResult = createMockInstallResult({
        name: "full-skill",
        version: "2.0.0",
        target: "agent",
      });

      vi.mocked(skillsManager.installSkill).mockResolvedValue(mockResult);

      await runCommand([
        "skill",
        "install",
        "full-skill@2.0.0",
        "--agent",
        "my-agent",
        "--force",
      ]);

      expect(skillsManager.installSkill).toHaveBeenCalledWith({
        name: "full-skill",
        target: "agent",
        agentId: "my-agent",
        customPath: undefined,
        sourcePath: undefined,
        version: "2.0.0",
        executor: undefined,
        force: true,
      });
    });
  });
});
