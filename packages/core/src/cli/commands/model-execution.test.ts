/**
 * Model Command Execution Tests
 *
 * Tests that actually execute model commands and verify behavior.
 * Uses real file system operations with temporary directories.
 *
 * This complements model.test.ts which tests command registration with mocks.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerModelCommand } from "./model";
import { createTempDir, type TempDirContext } from "../../test/helpers/temp-dir";
import { createConsoleSpy, type ConsoleSpy } from "../../test/mocks/console";

// =============================================================================
// Test Setup
// =============================================================================

// Mock config paths to use temp directory
vi.mock("../../config/paths", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../config/paths")>();
  return {
    ...original,
    getStateDir: vi.fn(),
    getModelsPath: vi.fn(),
  };
});

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

import * as configPaths from "../../config/paths";
import { ModelManager, modelManager } from "../../models";

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
  modelManager: ModelManager;
  /** Write config file and reload modelManager */
  writeConfig: (content: string) => Promise<void>;
  run: (args: string[]) => Promise<void>;
  runJson: (args: string[]) => Promise<unknown>;
  cleanup: () => Promise<void>;
}

async function createExecutionTestContext(): Promise<ExecutionTestContext> {
  const tempDir = await createTempDir("model-test-");

  // Mock getStateDir to return temp directory
  vi.mocked(configPaths.getStateDir).mockReturnValue(tempDir.root);
  vi.mocked(configPaths.getModelsPath).mockReturnValue(tempDir.resolve("models.yaml"));

  // Force the global modelManager to reload config (clear cache)
  await modelManager.reload();

  // Create a fresh ModelManager instance for reference (not used by CLI)
  const localModelManager = new ModelManager();

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

  registerModelCommand(program);

  const consoleSpy = createConsoleSpy();

  return {
    tempDir,
    program,
    console: consoleSpy,
    modelManager: localModelManager,

    async writeConfig(content: string) {
      await tempDir.writeFile("models.yaml", content);
      // Reload the global modelManager to pick up the new config
      await modelManager.reload();
    },

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
      // Restore process.exit
      process.exit = originalExit;
    },
  };
}

const OPENAI_MODEL_CONFIG = `
openai-main:
  id: openai-main
  type: openai
  base_url: https://api.openai.com/v1
  api_key: sk-test
  models:
    gpt-4o:
      name: GPT-4o
      enabled: true
      config:
        temperature: 0.7
        max_tokens: 4096
    gpt-4o-mini:
      name: GPT-4o Mini
      enabled: true
`;

const MULTI_PROVIDER_CONFIG = `
openai-main:
  id: openai-main
  type: openai
  base_url: https://api.openai.com/v1
  api_key: sk-test
  models:
    gpt-4o:
      name: GPT-4o
      enabled: true
anthropic-main:
  id: anthropic-main
  type: anthropic
  base_url: https://api.anthropic.com/v1
  api_key: sk-ant
  models:
    claude-sonnet:
      name: Claude Sonnet
      enabled: true
`;

// =============================================================================
// Execution Tests
// =============================================================================

describe("model command execution", () => {
  let ctx: ExecutionTestContext;

  beforeEach(async () => {
    ctx = await createExecutionTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // ===========================================================================
  // model list execution
  // ===========================================================================

  describe("model list", () => {
    it("should show no models without config file", async () => {
      await ctx.run(["model", "list"]);

      expect(ctx.console.hasLog("No models found")).toBe(true);
    });

    it("should list models from config when models.yaml exists", async () => {
      await ctx.writeConfig(OPENAI_MODEL_CONFIG);

      await ctx.run(["model", "list"]);

      expect(ctx.console.hasLog("gpt-4o")).toBe(true);
    });

    it("should return JSON output with models list", async () => {
      await ctx.writeConfig(OPENAI_MODEL_CONFIG);

      const result = (await ctx.runJson(["model", "list"])) as {
        success: boolean;
        data: { models: Array<{ id: string }> };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.models).toBeDefined();
      expect(Array.isArray(result?.data?.models)).toBe(true);
      expect(result?.data?.models?.some((m) => m.id === "gpt-4o")).toBe(true);
    });

    it("should filter models by provider", async () => {
      await ctx.writeConfig(MULTI_PROVIDER_CONFIG);

      const result = (await ctx.runJson(["model", "list", "--provider", "anthropic"])) as {
        success: boolean;
        data: { models: Array<{ provider: string }> };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.models?.every((m) => m.provider === "anthropic")).toBe(true);
    });

    it("should create and list media models by surface", async () => {
      await ctx.writeConfig(`
fal-media:
  id: fal-media
  type: fal
  models: {}
`);

      await ctx.run([
        "model",
        "create",
        "-n",
        "fal-custom-image",
        "--provider",
        "fal-media",
        "--category",
        "media",
        "--surface",
        "image",
        "--capability",
        "t2i",
      ]);

      const result = (await ctx.runJson([
        "model",
        "list",
        "--category",
        "media",
        "--surface",
        "image",
      ])) as {
        success: boolean;
        data: {
          models: Array<{
            id: string;
            provider: string;
            category: string;
            surface: string;
            capabilities: string[];
          }>;
        };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.models).toContainEqual(
        expect.objectContaining({
          id: "fal-custom-image",
          provider: "fal",
          category: "media",
          surface: "image",
          capabilities: ["t2i"],
        })
      );

      const content = await ctx.tempDir.readFile("models.yaml");
      expect(content).toContain("category: media");
      expect(content).toContain("surface: image");
      expect(content).toContain("- t2i");
    });
  });

  // ===========================================================================
  // model set-default execution
  // ===========================================================================

  describe("model set-default", () => {
    it("should not write default metadata to models.yaml", async () => {
      await ctx.writeConfig(OPENAI_MODEL_CONFIG);
      await ctx.run(["model", "set-default", "-n", "gpt-4o-mini"]);

      const content = await ctx.tempDir.readFile("models.yaml");
      expect(content).not.toContain("default:");
    });

    it("should resolve alias and set actual model as default", async () => {
      await ctx.writeConfig(OPENAI_MODEL_CONFIG);

      await ctx.run(["model", "set-default", "-n", "gpt4"]);

      const content = await ctx.tempDir.readFile("models.yaml");
      expect(content).not.toContain("default:");

      // Should show message about alias resolution
      expect(ctx.console.hasLog("resolved from alias")).toBe(true);
    });

    it("should return JSON output on success", async () => {
      const result = (await ctx.runJson(["model", "set-default", "-n", "gpt-4o"])) as {
        success: boolean;
        data: { default: string };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.default).toBe("gpt-4o");
    });

    it("should set default model for a media surface", async () => {
      await ctx.writeConfig(OPENAI_MODEL_CONFIG);

      const result = (await ctx.runJson([
        "model",
        "set-default",
        "-n",
        "gpt-image-2",
        "--surface",
        "image",
      ])) as {
        success: boolean;
        data: { default: string; surface: string };
      };

      expect(result?.success).toBe(true);
      expect(result?.data).toMatchObject({
        default: "gpt-image-2",
        surface: "image",
      });

      const content = await ctx.tempDir.readFile("models.yaml");
      expect(content).not.toContain("defaults:");
    });
  });

  // ===========================================================================
  // model show execution
  // ===========================================================================

  describe("model show", () => {
    it("should show details of known model", async () => {
      await ctx.writeConfig(OPENAI_MODEL_CONFIG);

      await ctx.run(["model", "show", "-n", "gpt-4o"]);

      expect(ctx.console.hasLog("gpt-4o")).toBe(true);
      expect(ctx.console.hasLog("openai")).toBe(true);
    });

    it("should show custom configuration if present", async () => {
      await ctx.writeConfig(OPENAI_MODEL_CONFIG);

      await ctx.run(["model", "show", "-n", "gpt-4o"]);

      expect(ctx.console.hasLog("Custom Configuration")).toBe(true);
      expect(ctx.console.hasLog("0.7")).toBe(true);
    });

    it("should return JSON with model details", async () => {
      await ctx.writeConfig(OPENAI_MODEL_CONFIG);

      const result = (await ctx.runJson(["model", "show", "-n", "gpt-4o"])) as {
        success: boolean;
        data: { model: { id: string; provider: string } };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.model?.id).toBe("gpt-4o");
      expect(result?.data?.model?.provider).toBe("openai");
    });
  });

  // ===========================================================================
  // model alias execution
  // ===========================================================================

  describe("model alias list", () => {
    it("should list default aliases when no config file", async () => {
      await ctx.run(["model", "alias", "list"]);

      // Should show default aliases
      expect(ctx.console.hasLog("gpt4")).toBe(true);
      expect(ctx.console.hasLog("claude")).toBe(true);
    });

    it("should ignore legacy custom aliases from config", async () => {
      await ctx.writeConfig(`
aliases:
  mymodel: gpt-4o-mini
openai-main:
  id: openai-main
  type: openai
  models: {}
`);

      await ctx.run(["model", "alias", "list"]);

      expect(ctx.console.hasLog("mymodel")).toBe(false);
      expect(ctx.console.hasLog("gpt4")).toBe(true);
    });
  });

  describe("model alias create", () => {
    it("should not write aliases to config", async () => {
      await ctx.writeConfig(OPENAI_MODEL_CONFIG);
      await ctx.run(["model", "alias", "create", "-n", "myfast", "-m", "gpt-4o-mini"]);

      const content = await ctx.tempDir.readFile("models.yaml");
      expect(content).not.toContain("myfast:");
    });

    it("should not update legacy aliases", async () => {
      await ctx.writeConfig(OPENAI_MODEL_CONFIG);

      await ctx.run(["model", "alias", "create", "-n", "myfast", "-m", "gpt-4o-mini"]);

      const content = await ctx.tempDir.readFile("models.yaml");
      expect(content).not.toContain("myfast:");
    });
  });

  describe("model alias remove", () => {
    it("should not write alias metadata", async () => {
      await ctx.writeConfig(OPENAI_MODEL_CONFIG);

      await ctx.run(["model", "alias", "remove", "-n", "myfast"]);

      const content = await ctx.tempDir.readFile("models.yaml");
      expect(content).not.toContain("myfast:");
    });
  });

  describe("model alias resolve", () => {
    it("should resolve alias to model ID", async () => {
      await ctx.run(["model", "alias", "resolve", "-n", "gpt4"]);

      expect(ctx.console.hasLog("gpt4 -> gpt-4o")).toBe(true);
    });

    it("should indicate when input is not an alias", async () => {
      await ctx.run(["model", "alias", "resolve", "-n", "gpt-4o"]);

      expect(ctx.console.hasLog("is not an alias")).toBe(true);
    });
  });

  describe("removed model fallback command", () => {
    it("should not register model fallback subcommands", async () => {
      await ctx.run(["model", "fallback", "list"]);

      expect(ctx.console.hasLog("No fallback chain configured")).toBe(false);
    });
  });

  // ===========================================================================
  // model config execution
  // ===========================================================================

  describe("model config show", () => {
    it("should show message when no custom config", async () => {
      await ctx.writeConfig(`
openai-main:
  id: openai-main
  type: openai
  models:
    gpt-4o:
      name: GPT-4o
      enabled: true
`);
      await ctx.run(["model", "config", "show", "-n", "gpt-4o"]);

      expect(ctx.console.hasLog("No custom configuration")).toBe(true);
    });

    it("should show custom configuration", async () => {
      await ctx.writeConfig(`
openai-main:
  id: openai-main
  type: openai
  models:
    gpt-4o:
      name: GPT-4o
      enabled: true
      config:
        temperature: 0.7
        max_tokens: 4096
        top_p: 0.9
`);

      await ctx.run(["model", "config", "show", "-n", "gpt-4o"]);

      expect(ctx.console.hasLog("Configuration for gpt-4o")).toBe(true);
      expect(ctx.console.hasLog("0.7")).toBe(true);
      expect(ctx.console.hasLog("4096")).toBe(true);
    });
  });

  describe("model config set", () => {
    it("should set temperature config", async () => {
      await ctx.writeConfig(OPENAI_MODEL_CONFIG);
      await ctx.run(["model", "config", "set", "-n", "gpt-4o", "--temperature", "0.7"]);

      const content = await ctx.tempDir.readFile("models.yaml");
      expect(content).toContain("temperature: 0.7");
    });

    it("should set max-tokens config", async () => {
      await ctx.writeConfig(OPENAI_MODEL_CONFIG);
      await ctx.run(["model", "config", "set", "-n", "gpt-4o", "--max-tokens", "8192"]);

      const content = await ctx.tempDir.readFile("models.yaml");
      expect(content).toContain("max_tokens: 8192");
    });

    it("should set multiple config options", async () => {
      await ctx.writeConfig(OPENAI_MODEL_CONFIG);
      await ctx.run([
        "model",
        "config",
        "set",
        "-n",
        "gpt-4o",
        "--temperature",
        "0.8",
        "--max-tokens",
        "4096",
        "--top-p",
        "0.95",
      ]);

      const content = await ctx.tempDir.readFile("models.yaml");
      expect(content).toContain("temperature: 0.8");
      expect(content).toContain("max_tokens: 4096");
      expect(content).toContain("top_p: 0.95");
    });

    it("should merge with existing configuration", async () => {
      await ctx.writeConfig(`
openai-main:
  id: openai-main
  type: openai
  models:
    gpt-4o:
      name: GPT-4o
      enabled: true
      config:
        temperature: 0.5
        max_tokens: 2048
`);

      await ctx.run(["model", "config", "set", "-n", "gpt-4o", "--top-p", "0.9"]);

      const content = await ctx.tempDir.readFile("models.yaml");
      expect(content).toContain("temperature: 0.5");
      expect(content).toContain("max_tokens: 2048");
      expect(content).toContain("top_p: 0.9");
    });
  });

  describe("model config remove", () => {
    it("should remove model configuration", async () => {
      await ctx.writeConfig(OPENAI_MODEL_CONFIG);

      await ctx.run(["model", "config", "remove", "-n", "gpt-4o"]);

      const content = await ctx.tempDir.readFile("models.yaml");
      expect(content).toContain("gpt-4o:");
      expect(content).not.toContain("temperature: 0.7");
      expect(content).toContain("gpt-4o-mini:");
    });
  });

  // ===========================================================================
  // model status execution
  // ===========================================================================

  describe("model status", () => {
    it("should show model status summary", async () => {
      await ctx.writeConfig(OPENAI_MODEL_CONFIG);

      await ctx.run(["model", "status"]);

      expect(ctx.console.hasLog("Model Status")).toBe(true);
      expect(ctx.console.hasLog("Known Models")).toBe(true);
    });

    it("should return JSON with status details", async () => {
      await ctx.writeConfig(OPENAI_MODEL_CONFIG);

      const result = (await ctx.runJson(["model", "status"])) as {
        success: boolean;
        data: {
          default: string;
          aliasCount: number;
        };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.default).toBeUndefined();
      expect("fallbackCount" in (result?.data ?? {})).toBe(false);
    });
  });

  // ===========================================================================
  // model providers execution
  // ===========================================================================

  describe("model providers", () => {
    it("should list available providers", async () => {
      await ctx.writeConfig(MULTI_PROVIDER_CONFIG);
      await ctx.run(["model", "providers"]);

      expect(ctx.console.hasLog("Available Providers")).toBe(true);
      expect(ctx.console.hasLog("openai")).toBe(true);
      expect(ctx.console.hasLog("anthropic")).toBe(true);
    });

    it("should return JSON with provider info", async () => {
      await ctx.writeConfig(MULTI_PROVIDER_CONFIG);

      const result = (await ctx.runJson(["model", "providers"])) as {
        success: boolean;
        data: { providers: Array<{ provider: string; modelCount: number }> };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.providers).toBeDefined();
      expect(result?.data?.providers?.some((p) => p.provider === "openai")).toBe(true);
      expect(result?.data?.providers?.some((p) => p.provider === "anthropic")).toBe(true);
    });
  });
});
