/**
 * Model CLI Commands Tests
 *
 * 测试覆盖:
 * - Model 管理: list, show, status, set-default
 * - Model Alias: list, create, remove, resolve
 * - Model Config: show, set, remove
 * - Model Providers: providers
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { registerModelCommand } from "./model";
import type { Model, ModelConfig } from "../../types";

// Mock the models module
vi.mock("../../models", () => ({
  modelManager: {
    listModels: vi.fn(),
    listModelsFiltered: vi.fn(),
    getModelsByProvider: vi.fn(),
    getDefault: vi.fn(),
    setDefault: vi.fn(),
    getAliases: vi.fn(),
    createAlias: vi.fn(),
    removeAlias: vi.fn(),
    resolveAlias: vi.fn(),
    getModelConfig: vi.fn(),
    setModelConfig: vi.fn(),
    removeModelConfig: vi.fn(),
    getModelInfo: vi.fn(),
  },
  DEFAULT_ALIASES: {
    gpt4: "gpt-4o",
    claude: "claude-3-5-sonnet-20241022",
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

import { modelManager, DEFAULT_ALIASES } from "../../models";

/**
 * Helper to create a mock model with proper typing
 */
function createMockModel(overrides: Partial<Model> = {}): Model {
  return {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    provider_id: "openai-main",
    contextLength: 128000,
    maxOutputTokens: 16384,
    inputPrice: 2.5,
    outputPrice: 10,
    ...overrides,
  };
}

describe("Model CLI Commands", () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create fresh program instance
    program = new Command();
    program.option("--json", "Output in JSON format");
    program.option("--verbose", "Verbose output");
    program.option("--quiet", "Quiet mode");

    // Register model commands
    registerModelCommand(program);

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
  // Model List Tests
  // 规范: viben model list [--provider <provider>] [--json]
  // ============================================================================

  describe("model list", () => {
    it("should list all models", async () => {
      const mockModels = [
        createMockModel({ id: "gpt-4o", name: "GPT-4o", provider: "openai" }),
        createMockModel({ id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", provider: "anthropic" }),
      ];

      vi.mocked(modelManager.listModelsFiltered).mockResolvedValue(mockModels);
      vi.mocked(modelManager.getDefault).mockResolvedValue("gpt-4o");

      await runCommand(["model", "list"]);

      expect(modelManager.listModelsFiltered).toHaveBeenCalled();
      expect(modelManager.getDefault).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should filter models by provider with --provider", async () => {
      const mockModels = [
        createMockModel({ id: "gpt-4o", name: "GPT-4o", provider: "openai" }),
        createMockModel({ id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai" }),
      ];

      vi.mocked(modelManager.listModelsFiltered).mockResolvedValue(mockModels);
      vi.mocked(modelManager.getDefault).mockResolvedValue("gpt-4o");

      await runCommand(["model", "list", "--provider", "openai"]);

      expect(modelManager.listModelsFiltered).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "openai" })
      );
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should show message when no models found", async () => {
      vi.mocked(modelManager.listModelsFiltered).mockResolvedValue([]);
      vi.mocked(modelManager.getDefault).mockResolvedValue(undefined);

      await runCommand(["model", "list"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("No models found"));
    });

    it("should output JSON when --json flag is provided", async () => {
      const mockModels = [createMockModel()];

      vi.mocked(modelManager.listModelsFiltered).mockResolvedValue(mockModels);
      vi.mocked(modelManager.getDefault).mockResolvedValue("gpt-4o");

      await runCommand(["--json", "model", "list"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
    });
  });

  // ============================================================================
  // Model Show Tests
  // 规范: viben model show -n <model>
  // ============================================================================

  describe("model show -n <model>", () => {
    it("should show model details", async () => {
      const mockModel = createMockModel({
        id: "gpt-4o",
        name: "GPT-4o",
        provider: "openai",
        contextLength: 128000,
        maxOutputTokens: 16384,
        inputPrice: 2.5,
        outputPrice: 10,
      });

      vi.mocked(modelManager.resolveAlias).mockResolvedValue("gpt-4o");
      vi.mocked(modelManager.getModelInfo).mockReturnValue(mockModel);
      vi.mocked(modelManager.getModelConfig).mockResolvedValue(null);
      vi.mocked(modelManager.getDefault).mockResolvedValue("gpt-4o");

      await runCommand(["model", "show", "-n", "gpt-4o"]);

      expect(modelManager.resolveAlias).toHaveBeenCalledWith("gpt-4o");
      expect(modelManager.getModelInfo).toHaveBeenCalledWith("gpt-4o");
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should support --name option", async () => {
      const mockModel = createMockModel({ id: "gpt-4o" });

      vi.mocked(modelManager.resolveAlias).mockResolvedValue("gpt-4o");
      vi.mocked(modelManager.getModelInfo).mockReturnValue(mockModel);
      vi.mocked(modelManager.getModelConfig).mockResolvedValue(null);
      vi.mocked(modelManager.getDefault).mockResolvedValue(undefined);

      await runCommand(["model", "show", "--name", "gpt-4o"]);

      expect(modelManager.resolveAlias).toHaveBeenCalledWith("gpt-4o");
    });

    it("should resolve alias and show model details", async () => {
      const mockModel = createMockModel({
        id: "gpt-4o",
        name: "GPT-4o",
        provider: "openai",
      });

      vi.mocked(modelManager.resolveAlias).mockResolvedValue("gpt-4o");
      vi.mocked(modelManager.getModelInfo).mockReturnValue(mockModel);
      vi.mocked(modelManager.getModelConfig).mockResolvedValue(null);
      vi.mocked(modelManager.getDefault).mockResolvedValue(undefined);

      await runCommand(["model", "show", "-n", "gpt4"]);

      expect(modelManager.resolveAlias).toHaveBeenCalledWith("gpt4");
      expect(modelManager.getModelInfo).toHaveBeenCalledWith("gpt-4o");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("resolved from alias"));
    });

    it("should show message for unknown model", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("unknown-model");
      vi.mocked(modelManager.getModelInfo).mockReturnValue(undefined);
      vi.mocked(modelManager.getModelConfig).mockResolvedValue(null);
      vi.mocked(modelManager.getDefault).mockResolvedValue(undefined);

      await runCommand(["model", "show", "-n", "unknown-model"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));
    });

    it("should show custom configuration if present", async () => {
      const mockModel = createMockModel({ id: "gpt-4o" });
      const mockConfig: ModelConfig = {
        temperature: 0.7,
        maxTokens: 4096,
      };

      vi.mocked(modelManager.resolveAlias).mockResolvedValue("gpt-4o");
      vi.mocked(modelManager.getModelInfo).mockReturnValue(mockModel);
      vi.mocked(modelManager.getModelConfig).mockResolvedValue(mockConfig);
      vi.mocked(modelManager.getDefault).mockResolvedValue(undefined);

      await runCommand(["model", "show", "-n", "gpt-4o"]);

      expect(modelManager.getModelConfig).toHaveBeenCalledWith("gpt-4o");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Custom Configuration"));
    });
  });

  // ============================================================================
  // Model Status Tests
  // 规范: viben model status
  // ============================================================================

  describe("model status", () => {
    it("should show model availability status", async () => {
      const mockModels = [
        createMockModel({ id: "gpt-4o", provider: "openai" }),
        createMockModel({ id: "claude-3-5-sonnet-20241022", provider: "anthropic" }),
      ];

      vi.mocked(modelManager.listModels).mockResolvedValue(mockModels);
      vi.mocked(modelManager.getAliases).mockResolvedValue({ gpt4: "gpt-4o" });
      vi.mocked(modelManager.getDefault).mockResolvedValue("gpt-4o");

      await runCommand(["model", "status"]);

      expect(modelManager.listModels).toHaveBeenCalled();
      expect(modelManager.getAliases).toHaveBeenCalled();
      expect(modelManager.getDefault).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Model Status"));
    });

    it("should show status without default model", async () => {
      vi.mocked(modelManager.listModels).mockResolvedValue([]);
      vi.mocked(modelManager.getAliases).mockResolvedValue({});
      vi.mocked(modelManager.getDefault).mockResolvedValue(undefined);

      await runCommand(["model", "status"]);

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Model Set Default Tests
  // 规范: viben model set-default -n <model>
  // ============================================================================

  describe("model set-default -n <model>", () => {
    it("should set the default model", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("gpt-4o");
      vi.mocked(modelManager.setDefault).mockResolvedValue(undefined);

      await runCommand(["model", "set-default", "-n", "gpt-4o"]);

      expect(modelManager.resolveAlias).toHaveBeenCalledWith("gpt-4o");
      expect(modelManager.setDefault).toHaveBeenCalledWith("gpt-4o");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Set"));
    });

    it("should support --name option", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("gpt-4o");
      vi.mocked(modelManager.setDefault).mockResolvedValue(undefined);

      await runCommand(["model", "set-default", "--name", "gpt-4o"]);

      expect(modelManager.resolveAlias).toHaveBeenCalledWith("gpt-4o");
      expect(modelManager.setDefault).toHaveBeenCalledWith("gpt-4o");
    });

    it("should resolve alias before setting default", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("gpt-4o");
      vi.mocked(modelManager.setDefault).mockResolvedValue(undefined);

      await runCommand(["model", "set-default", "-n", "gpt4"]);

      expect(modelManager.resolveAlias).toHaveBeenCalledWith("gpt4");
      expect(modelManager.setDefault).toHaveBeenCalledWith("gpt-4o");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("resolved from alias"));
    });
  });

  // ============================================================================
  // Model Alias Tests
  // 规范: viben model alias list/create/remove/resolve
  // ============================================================================

  describe("model alias list", () => {
    it("should list all model aliases", async () => {
      vi.mocked(modelManager.getAliases).mockResolvedValue({
        gpt4: "gpt-4o",
        claude: "claude-3-5-sonnet-20241022",
      });

      await runCommand(["model", "alias", "list"]);

      expect(modelManager.getAliases).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Model Aliases"));
    });

    it("should show message when no aliases configured", async () => {
      vi.mocked(modelManager.getAliases).mockResolvedValue({});

      await runCommand(["model", "alias", "list"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("No aliases configured"));
    });
  });

  describe("model alias create -n <name> -m <model>", () => {
    it("should create a new alias", async () => {
      vi.mocked(modelManager.createAlias).mockResolvedValue(undefined);

      await runCommand(["model", "alias", "create", "-n", "fast", "-m", "gpt-4o-mini"]);

      expect(modelManager.createAlias).toHaveBeenCalledWith("fast", "gpt-4o-mini");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Set alias "fast"'));
    });

    it("should support --name and --model options", async () => {
      vi.mocked(modelManager.createAlias).mockResolvedValue(undefined);

      await runCommand(["model", "alias", "create", "--name", "smart", "--model", "claude-3-5-sonnet-20241022"]);

      expect(modelManager.createAlias).toHaveBeenCalledWith("smart", "claude-3-5-sonnet-20241022");
    });

    it("should update an existing alias", async () => {
      vi.mocked(modelManager.createAlias).mockResolvedValue(undefined);

      await runCommand(["model", "alias", "create", "-n", "gpt4", "-m", "gpt-4o-mini"]);

      expect(modelManager.createAlias).toHaveBeenCalledWith("gpt4", "gpt-4o-mini");
    });
  });

  describe("model alias remove -n <name>", () => {
    it("should remove an alias", async () => {
      vi.mocked(modelManager.removeAlias).mockResolvedValue(undefined);

      await runCommand(["model", "alias", "remove", "-n", "fast"]);

      expect(modelManager.removeAlias).toHaveBeenCalledWith("fast");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Removed alias "fast"'));
    });

    it("should support --name option", async () => {
      vi.mocked(modelManager.removeAlias).mockResolvedValue(undefined);

      await runCommand(["model", "alias", "remove", "--name", "fast"]);

      expect(modelManager.removeAlias).toHaveBeenCalledWith("fast");
    });

    it("should support rm shorthand", async () => {
      vi.mocked(modelManager.removeAlias).mockResolvedValue(undefined);

      await runCommand(["model", "alias", "rm", "-n", "fast"]);

      expect(modelManager.removeAlias).toHaveBeenCalledWith("fast");
    });
  });

  describe("model alias resolve -n <name>", () => {
    it("should resolve an alias to model ID", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("gpt-4o");

      await runCommand(["model", "alias", "resolve", "-n", "gpt4"]);

      expect(modelManager.resolveAlias).toHaveBeenCalledWith("gpt4");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("gpt4 -> gpt-4o"));
    });

    it("should support --name option", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("gpt-4o");

      await runCommand(["model", "alias", "resolve", "--name", "gpt4"]);

      expect(modelManager.resolveAlias).toHaveBeenCalledWith("gpt4");
    });

    it("should show message when input is not an alias", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("gpt-4o");

      await runCommand(["model", "alias", "resolve", "-n", "gpt-4o"]);

      expect(modelManager.resolveAlias).toHaveBeenCalledWith("gpt-4o");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("is not an alias"));
    });
  });

  describe("removed fallback command", () => {
    it("should reject removed model fallback subcommands", async () => {
      await expect(runCommand(["model", "fallback", "list"])).rejects.toThrow();
    });
  });

  // ============================================================================
  // Model Config Tests
  // 规范: viben model config show/set/remove -n <model>
  // ============================================================================

  describe("model config show -n <model>", () => {
    it("should show model configuration", async () => {
      const mockConfig: ModelConfig = {
        temperature: 0.7,
        maxTokens: 4096,
        topP: 0.9,
      };

      vi.mocked(modelManager.getModelConfig).mockResolvedValue(mockConfig);

      await runCommand(["model", "config", "show", "-n", "gpt-4o"]);

      expect(modelManager.getModelConfig).toHaveBeenCalledWith("gpt-4o");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Configuration for gpt-4o"));
    });

    it("should support --name option", async () => {
      vi.mocked(modelManager.getModelConfig).mockResolvedValue({ temperature: 0.7 });

      await runCommand(["model", "config", "show", "--name", "gpt-4o"]);

      expect(modelManager.getModelConfig).toHaveBeenCalledWith("gpt-4o");
    });

    it("should show message when no custom configuration", async () => {
      vi.mocked(modelManager.getModelConfig).mockResolvedValue(null);

      await runCommand(["model", "config", "show", "-n", "gpt-4o"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("No custom configuration"));
    });
  });

  describe("model config set -n <model>", () => {
    it("should set model configuration with temperature", async () => {
      vi.mocked(modelManager.getModelConfig).mockResolvedValue(null);
      vi.mocked(modelManager.setModelConfig).mockResolvedValue(undefined);

      await runCommand(["model", "config", "set", "-n", "gpt-4o", "--temperature", "0.7"]);

      expect(modelManager.setModelConfig).toHaveBeenCalledWith(
        "gpt-4o",
        expect.objectContaining({ temperature: 0.7 })
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Updated configuration"));
    });

    it("should set model configuration with max-tokens", async () => {
      vi.mocked(modelManager.getModelConfig).mockResolvedValue(null);
      vi.mocked(modelManager.setModelConfig).mockResolvedValue(undefined);

      await runCommand(["model", "config", "set", "-n", "gpt-4o", "--max-tokens", "4096"]);

      expect(modelManager.setModelConfig).toHaveBeenCalledWith(
        "gpt-4o",
        expect.objectContaining({ maxTokens: 4096 })
      );
    });

    it("should set model configuration with top-p", async () => {
      vi.mocked(modelManager.getModelConfig).mockResolvedValue(null);
      vi.mocked(modelManager.setModelConfig).mockResolvedValue(undefined);

      await runCommand(["model", "config", "set", "-n", "gpt-4o", "--top-p", "0.9"]);

      expect(modelManager.setModelConfig).toHaveBeenCalledWith(
        "gpt-4o",
        expect.objectContaining({ topP: 0.9 })
      );
    });

    it("should set model configuration with frequency-penalty", async () => {
      vi.mocked(modelManager.getModelConfig).mockResolvedValue(null);
      vi.mocked(modelManager.setModelConfig).mockResolvedValue(undefined);

      await runCommand(["model", "config", "set", "-n", "gpt-4o", "--frequency-penalty", "0.5"]);

      expect(modelManager.setModelConfig).toHaveBeenCalledWith(
        "gpt-4o",
        expect.objectContaining({ frequencyPenalty: 0.5 })
      );
    });

    it("should set model configuration with presence-penalty", async () => {
      vi.mocked(modelManager.getModelConfig).mockResolvedValue(null);
      vi.mocked(modelManager.setModelConfig).mockResolvedValue(undefined);

      await runCommand(["model", "config", "set", "-n", "gpt-4o", "--presence-penalty", "0.5"]);

      expect(modelManager.setModelConfig).toHaveBeenCalledWith(
        "gpt-4o",
        expect.objectContaining({ presencePenalty: 0.5 })
      );
    });

    it("should merge with existing configuration", async () => {
      const existingConfig: ModelConfig = {
        temperature: 0.7,
        maxTokens: 4096,
      };

      vi.mocked(modelManager.getModelConfig).mockResolvedValue(existingConfig);
      vi.mocked(modelManager.setModelConfig).mockResolvedValue(undefined);

      await runCommand(["model", "config", "set", "-n", "gpt-4o", "--top-p", "0.9"]);

      expect(modelManager.setModelConfig).toHaveBeenCalledWith(
        "gpt-4o",
        expect.objectContaining({
          temperature: 0.7,
          maxTokens: 4096,
          topP: 0.9,
        })
      );
    });

    it("should set multiple options at once", async () => {
      vi.mocked(modelManager.getModelConfig).mockResolvedValue(null);
      vi.mocked(modelManager.setModelConfig).mockResolvedValue(undefined);

      await runCommand([
        "model",
        "config",
        "set",
        "-n",
        "gpt-4o",
        "--temperature",
        "0.7",
        "--max-tokens",
        "4096",
        "--top-p",
        "0.9",
      ]);

      expect(modelManager.setModelConfig).toHaveBeenCalledWith(
        "gpt-4o",
        expect.objectContaining({
          temperature: 0.7,
          maxTokens: 4096,
          topP: 0.9,
        })
      );
    });
  });

  describe("model config remove -n <model>", () => {
    it("should remove model configuration", async () => {
      vi.mocked(modelManager.removeModelConfig).mockResolvedValue(undefined);

      await runCommand(["model", "config", "remove", "-n", "gpt-4o"]);

      expect(modelManager.removeModelConfig).toHaveBeenCalledWith("gpt-4o");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Removed configuration"));
    });

    it("should support --name option", async () => {
      vi.mocked(modelManager.removeModelConfig).mockResolvedValue(undefined);

      await runCommand(["model", "config", "remove", "--name", "gpt-4o"]);

      expect(modelManager.removeModelConfig).toHaveBeenCalledWith("gpt-4o");
    });

    it("should support rm shorthand", async () => {
      vi.mocked(modelManager.removeModelConfig).mockResolvedValue(undefined);

      await runCommand(["model", "config", "rm", "-n", "gpt-4o"]);

      expect(modelManager.removeModelConfig).toHaveBeenCalledWith("gpt-4o");
    });
  });

  // ============================================================================
  // Model Providers Tests
  // 规范: viben model providers
  // ============================================================================

  describe("model providers", () => {
    it("should list available providers", async () => {
      await runCommand(["model", "providers"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Available Providers"));
    });
  });

  // ============================================================================
  // JSON Output Tests
  // ============================================================================

  describe("JSON output mode", () => {
    it("should output JSON for model status", async () => {
      vi.mocked(modelManager.listModels).mockResolvedValue([createMockModel()]);
      vi.mocked(modelManager.getAliases).mockResolvedValue({});
      vi.mocked(modelManager.getDefault).mockResolvedValue("gpt-4o");

      await runCommand(["--json", "model", "status"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
    });

    it("should output JSON for model alias list", async () => {
      vi.mocked(modelManager.getAliases).mockResolvedValue({ gpt4: "gpt-4o" });

      await runCommand(["--json", "model", "alias", "list"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
    });

    it("should output JSON for model config show", async () => {
      vi.mocked(modelManager.getModelConfig).mockResolvedValue({ temperature: 0.7 });

      await runCommand(["--json", "model", "config", "show", "-n", "gpt-4o"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("error handling", () => {
    it("should handle errors in model list", async () => {
      vi.mocked(modelManager.listModelsFiltered).mockRejectedValue(new Error("Failed to list models"));

      await expect(runCommand(["model", "list"])).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle errors in alias operations", async () => {
      vi.mocked(modelManager.createAlias).mockRejectedValue(new Error("Failed to create alias"));

      await expect(runCommand(["model", "alias", "create", "-n", "test", "-m", "gpt-4o"])).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle errors in config operations", async () => {
      vi.mocked(modelManager.getModelConfig).mockRejectedValue(new Error("Failed to get config"));

      await expect(runCommand(["model", "config", "show", "-n", "gpt-4o"])).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
