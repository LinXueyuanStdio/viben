/**
 * Skill CLI Commands Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { registerSkillCommand } from "./skill";
import type {
  AvailableSkill,
  AgentSkillConfig,
  InstallSkillResult,
  UninstallSkillResult,
  ListSkillsResult,
  GetSkillResult,
  EnableSkillResult,
  MarketplaceResult,
} from "../../skill/ops/types";

// Mock the skill/ops module
vi.mock("../../skill/ops", () => ({
  listSkills: vi.fn(),
  listAvailableSkills: vi.fn(),
  getSkill: vi.fn(),
  installSkill: vi.fn(),
  uninstallSkill: vi.fn(),
  enableSkill: vi.fn(),
  disableSkill: vi.fn(),
  getEnabledSkills: vi.fn(),
  getSkillDir: vi.fn(),
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

import {
  listSkills,
  listAvailableSkills,
  getSkill,
  installSkill,
  uninstallSkill,
  enableSkill,
  disableSkill,
  getEnabledSkills,
  getSkillDir,
} from "../../skill/ops";

/**
 * Helper to create a mock list skills result
 */
function createMockListSkillsResult(
  skills: Array<{ name: string; version: string; path: string; installed_at: string }> = []
): ListSkillsResult {
  return {
    success: true,
    skills,
    count: skills.length,
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
      const mockResult = createMockListSkillsResult([
        {
          name: "code-review",
          version: "1.0.0",
          path: "/path/to/code-review",
          installed_at: "2024-01-01T00:00:00Z",
        },
        {
          name: "commit-helper",
          version: "1.2.0",
          path: "/path/to/commit-helper",
          installed_at: "2024-01-02T00:00:00Z",
        },
      ]);

      vi.mocked(listSkills).mockResolvedValue(mockResult);

      await runCommand(["skill", "list"]);

      expect(listSkills).toHaveBeenCalledWith(undefined);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should show message when no skills installed", async () => {
      vi.mocked(listSkills).mockResolvedValue(createMockListSkillsResult([]));

      await runCommand(["skill", "list"]);

      expect(listSkills).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("No skills installed"));
    });

    it("should output JSON when --json flag is provided", async () => {
      const mockResult = createMockListSkillsResult([
        {
          name: "code-review",
          version: "1.0.0",
          path: "/path/to/code-review",
          installed_at: "2024-01-01T00:00:00Z",
        },
      ]);

      vi.mocked(listSkills).mockResolvedValue(mockResult);

      await runCommand(["--json", "skill", "list"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
    });
  });

  describe("skill list --available", () => {
    it("should list available skills from marketplace", async () => {
      const mockResult: MarketplaceResult = {
        success: true,
        skills: [
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
        ],
        total: 2,
      };

      vi.mocked(listAvailableSkills).mockResolvedValue(mockResult);

      await runCommand(["skill", "list", "--available"]);

      expect(listAvailableSkills).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should show message when no skills available in marketplace", async () => {
      const mockResult: MarketplaceResult = {
        success: true,
        skills: [],
        total: 0,
      };

      vi.mocked(listAvailableSkills).mockResolvedValue(mockResult);

      await runCommand(["skill", "list", "--available"]);

      expect(listAvailableSkills).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No skills available in marketplace")
      );
    });

    it("should output JSON for available skills", async () => {
      const mockResult: MarketplaceResult = {
        success: true,
        skills: [createMockAvailableSkill({ name: "marketplace-skill" })],
        total: 1,
      };

      vi.mocked(listAvailableSkills).mockResolvedValue(mockResult);

      await runCommand(["--json", "skill", "list", "--available"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"skills"'));
    });
  });

  describe("skill list --agent <id>", () => {
    it("should list skills for a specific agent", async () => {
      const mockResult = createMockListSkillsResult([
        {
          name: "agent-skill-1",
          version: "1.0.0",
          path: "/path/to/agent/skills/agent-skill-1",
          installed_at: "2024-01-01T00:00:00Z",
        },
      ]);

      vi.mocked(listSkills).mockResolvedValue(mockResult);

      await runCommand(["skill", "list", "--agent", "my-agent"]);

      expect(listSkills).toHaveBeenCalledWith({ target: "agent", agentId: "my-agent" });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should show message when no skills for agent", async () => {
      vi.mocked(listSkills).mockResolvedValue(createMockListSkillsResult([]));

      await runCommand(["skill", "list", "--agent", "my-agent"]);

      expect(listSkills).toHaveBeenCalledWith({ target: "agent", agentId: "my-agent" });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No skills installed for agent "my-agent"')
      );
    });
  });

  describe("skill list -g (short option)", () => {
    it("should list only global skills", async () => {
      const mockResult = createMockListSkillsResult([
        {
          name: "global-skill",
          version: "1.0.0",
          path: "/path/to/global-skill",
          installed_at: "2024-01-01T00:00:00Z",
        },
      ]);

      vi.mocked(listSkills).mockResolvedValue(mockResult);

      await runCommand(["skill", "list", "-g"]);

      expect(listSkills).toHaveBeenCalledWith({ target: "global", agentId: undefined });
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe("skill list -c (short option)", () => {
    it("should list only Claude skills", async () => {
      const mockResult = createMockListSkillsResult([
        {
          name: "claude-skill",
          version: "1.0.0",
          path: "/path/to/claude-skill",
          installed_at: "2024-01-01T00:00:00Z",
        },
      ]);

      vi.mocked(listSkills).mockResolvedValue(mockResult);

      await runCommand(["skill", "list", "-c"]);

      expect(listSkills).toHaveBeenCalledWith({ target: "claude", agentId: undefined });
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // skill view Tests
  // ============================================================================

  describe("skill view <name>", () => {
    it("should show skill details", async () => {
      const mockResult: GetSkillResult = {
        success: true,
        skill: {
          id: "code-review",
          name: "Code Review",
          version: "1.0.0",
          description: "Code review skill",
          path: "/path/to/code-review",
          source: "local",
        },
      };

      vi.mocked(getSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "view", "code-review"]);

      expect(getSkill).toHaveBeenCalledWith("code-review", undefined);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should show skill details for specific agent", async () => {
      const mockResult: GetSkillResult = {
        success: true,
        skill: {
          id: "agent-skill",
          name: "Agent Skill",
          version: "1.0.0",
          path: "/path/to/agent-skill",
          source: "local",
        },
      };

      vi.mocked(getSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "view", "agent-skill", "--agent", "my-agent"]);

      expect(getSkill).toHaveBeenCalledWith("agent-skill", {
        target: "agent",
        agentId: "my-agent",
      });
    });

    it("should show error when skill not found", async () => {
      const mockResult: GetSkillResult = {
        success: false,
        error: 'Skill "nonexistent" not found',
      };

      vi.mocked(getSkill).mockResolvedValue(mockResult);

      await expect(runCommand(["skill", "view", "nonexistent"])).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skill "nonexistent" not found')
      );
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

      vi.mocked(installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "new-skill"]);

      expect(installSkill).toHaveBeenCalledWith({
        name: "new-skill",
        target: "global",
        agentId: undefined,
        customPath: undefined,
        sourcePath: undefined,
        version: undefined,
        executor: undefined,
        force: undefined,
      });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should install skill with -g option (short for --global)", async () => {
      const mockResult = createMockInstallResult({ target: "global" });

      vi.mocked(installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "my-skill", "-g"]);

      expect(installSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          target: "global",
        })
      );
    });

    it("should install skill with -c option (short for --claude)", async () => {
      const mockResult = createMockInstallResult({ target: "claude" });

      vi.mocked(installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "claude-skill", "-c"]);

      expect(installSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          target: "claude",
        })
      );
    });

    it("should install skill with --agent option", async () => {
      const mockResult = createMockInstallResult({
        name: "agent-skill",
        target: "agent",
      });

      vi.mocked(installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "agent-skill", "--agent", "my-agent"]);

      expect(installSkill).toHaveBeenCalledWith({
        name: "agent-skill",
        target: "agent",
        agentId: "my-agent",
        customPath: undefined,
        sourcePath: undefined,
        version: undefined,
        executor: undefined,
        force: undefined,
      });
    });

    it("should install skill with --path option", async () => {
      const mockResult = createMockInstallResult({ target: "custom" });

      vi.mocked(installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "custom-skill", "--path", "/custom/path"]);

      expect(installSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          target: "custom",
          customPath: "/custom/path",
        })
      );
    });

    it("should install skill with -f option (short for --force)", async () => {
      const mockResult = createMockInstallResult();

      vi.mocked(installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "existing-skill", "-f"]);

      expect(installSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          force: true,
        })
      );
    });

    it("should install skill with --source option", async () => {
      const mockResult = createMockInstallResult();

      vi.mocked(installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "local-skill", "--source", "/local/source"]);

      expect(installSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          sourcePath: "/local/source",
        })
      );
    });

    it("should install skill with --version option", async () => {
      const mockResult = createMockInstallResult({ version: "2.0.0" });

      vi.mocked(installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "my-skill", "--version", "2.0.0"]);

      expect(installSkill).toHaveBeenCalledWith(
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

      vi.mocked(installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "my-skill@2.0.0"]);

      expect(installSkill).toHaveBeenCalledWith(
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

      vi.mocked(installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "my-skill@latest"]);

      expect(installSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "my-skill",
          version: undefined,
        })
      );
    });

    it("should prefer --version option over @version in name", async () => {
      const mockResult = createMockInstallResult({ version: "3.0.0" });

      vi.mocked(installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "my-skill@2.0.0", "--version", "3.0.0"]);

      expect(installSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "my-skill",
          version: "3.0.0",
        })
      );
    });

    it("should install skill with --executor CLAUDE_CODE option", async () => {
      const mockResult = createMockInstallResult({ target: "claude" });

      vi.mocked(installSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "install", "my-skill", "--executor", "CLAUDE_CODE"]);

      expect(installSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "my-skill",
          target: "claude",
          executor: "CLAUDE_CODE",
        })
      );
    });

    it("should output JSON for skill install", async () => {
      const mockResult = createMockInstallResult();

      vi.mocked(installSkill).mockResolvedValue(mockResult);

      await runCommand(["--json", "skill", "install", "new-skill"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
    });

    it("should handle install error", async () => {
      const mockResult: InstallSkillResult = {
        success: false,
        name: "test-skill",
        version: "",
        path: "",
        target: "global",
        message: 'Skill "test-skill" already exists',
        error: 'Skill "test-skill" already exists',
      };

      vi.mocked(installSkill).mockResolvedValue(mockResult);

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

      vi.mocked(uninstallSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "uninstall", "old-skill"]);

      expect(uninstallSkill).toHaveBeenCalledWith({
        name: "old-skill",
        target: "global",
        agentId: undefined,
        customPath: undefined,
      });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should uninstall skill from agent with --agent option", async () => {
      const mockResult = createMockUninstallResult();

      vi.mocked(uninstallSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "uninstall", "agent-skill", "--agent", "my-agent"]);

      expect(uninstallSkill).toHaveBeenCalledWith({
        name: "agent-skill",
        target: "agent",
        agentId: "my-agent",
        customPath: undefined,
      });
    });

    it("should uninstall skill from claude with -c option", async () => {
      const mockResult = createMockUninstallResult();

      vi.mocked(uninstallSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "uninstall", "claude-skill", "-c"]);

      expect(uninstallSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          target: "claude",
        })
      );
    });

    it("should uninstall skill from custom path with --path option", async () => {
      const mockResult = createMockUninstallResult();

      vi.mocked(uninstallSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "uninstall", "custom-skill", "--path", "/custom/path"]);

      expect(uninstallSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          target: "custom",
          customPath: "/custom/path",
        })
      );
    });

    it("should output JSON for skill uninstall", async () => {
      const mockResult = createMockUninstallResult();

      vi.mocked(uninstallSkill).mockResolvedValue(mockResult);

      await runCommand(["--json", "skill", "uninstall", "old-skill"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
    });

    it("should handle uninstall error when skill not found", async () => {
      const mockResult: UninstallSkillResult = {
        success: false,
        name: "nonexistent",
        message: 'Skill "nonexistent" not found',
        error: 'Skill "nonexistent" not found',
      };

      vi.mocked(uninstallSkill).mockResolvedValue(mockResult);

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
      const mockResult: EnableSkillResult = {
        success: true,
        skillName: "code-review",
        agentId: "my-agent",
        enabled: true,
      };

      vi.mocked(enableSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "enable", "code-review", "--agent", "my-agent"]);

      expect(enableSkill).toHaveBeenCalledWith("code-review", "my-agent");
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should output JSON for skill enable", async () => {
      const mockResult: EnableSkillResult = {
        success: true,
        skillName: "test-skill",
        agentId: "test-agent",
        enabled: true,
      };

      vi.mocked(enableSkill).mockResolvedValue(mockResult);

      await runCommand(["--json", "skill", "enable", "code-review", "--agent", "my-agent"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
    });

    it("should handle error when agent not found", async () => {
      const mockResult: EnableSkillResult = {
        success: false,
        skillName: "code-review",
        agentId: "nonexistent",
        enabled: false,
        error: 'Agent "nonexistent" not found',
      };

      vi.mocked(enableSkill).mockResolvedValue(mockResult);

      await expect(
        runCommand(["skill", "enable", "code-review", "--agent", "nonexistent"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // skill disable Tests
  // ============================================================================

  describe("skill disable <name> --agent <id>", () => {
    it("should disable a skill for an agent", async () => {
      const mockResult: EnableSkillResult = {
        success: true,
        skillName: "code-review",
        agentId: "my-agent",
        enabled: false,
      };

      vi.mocked(disableSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "disable", "code-review", "--agent", "my-agent"]);

      expect(disableSkill).toHaveBeenCalledWith("code-review", "my-agent");
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should output JSON for skill disable", async () => {
      const mockResult: EnableSkillResult = {
        success: true,
        skillName: "test-skill",
        agentId: "test-agent",
        enabled: false,
      };

      vi.mocked(disableSkill).mockResolvedValue(mockResult);

      await runCommand(["--json", "skill", "disable", "code-review", "--agent", "my-agent"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
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

      vi.mocked(getEnabledSkills).mockResolvedValue(mockEnabledSkills);

      await runCommand(["skill", "enabled", "--agent", "my-agent"]);

      expect(getEnabledSkills).toHaveBeenCalledWith("my-agent");
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should show message when no skills enabled", async () => {
      vi.mocked(getEnabledSkills).mockResolvedValue([]);

      await runCommand(["skill", "enabled", "--agent", "my-agent"]);

      expect(getEnabledSkills).toHaveBeenCalledWith("my-agent");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No skills enabled for agent "my-agent"')
      );
    });

    it("should output JSON for enabled skills", async () => {
      const mockEnabledSkills = [createMockAgentSkillConfig()];

      vi.mocked(getEnabledSkills).mockResolvedValue(mockEnabledSkills);

      await runCommand(["--json", "skill", "enabled", "--agent", "my-agent"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"agent": "my-agent"'));
    });
  });

  // ============================================================================
  // Backward compatibility: skill show (hidden alias for view)
  // ============================================================================

  describe("skill show (hidden alias)", () => {
    it("should work as alias for view command", async () => {
      const mockResult: GetSkillResult = {
        success: true,
        skill: {
          id: "test-skill",
          name: "Test Skill",
          version: "1.0.0",
          path: "/path/to/test-skill",
          source: "local",
        },
      };

      vi.mocked(getSkill).mockResolvedValue(mockResult);

      await runCommand(["skill", "show", "test-skill"]);

      expect(getSkill).toHaveBeenCalledWith("test-skill");
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Backward compatibility: skill path (hidden alias for view path)
  // ============================================================================

  describe("skill path (hidden alias)", () => {
    it("should return path to skill", async () => {
      vi.mocked(getSkillDir).mockReturnValue("/path/to/skills/test-skill");

      await runCommand(["skill", "path", "test-skill"]);

      expect(getSkillDir).toHaveBeenCalledWith("global", "test-skill");
      expect(consoleSpy).toHaveBeenCalledWith("/path/to/skills/test-skill");
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

      vi.mocked(installSkill).mockResolvedValue(mockResult);

      await runCommand([
        "skill",
        "install",
        "full-skill",
        "--agent",
        "my-agent",
        "--version",
        "2.0.0",
        "-f",
        "--source",
        "/local/path",
      ]);

      expect(installSkill).toHaveBeenCalledWith({
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
  });
});
