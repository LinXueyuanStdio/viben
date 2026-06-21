/**
 * Provider Command Execution Tests
 *
 * Tests provider commands against file-native models.yaml storage.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { parse } from "yaml";
import { registerProviderCommand } from "./provider";
import { createTempDir, type TempDirContext } from "../../test/helpers/temp-dir";
import { createConsoleSpy, type ConsoleSpy } from "../../test/mocks/console";
import { ProviderManager } from "../../providers";

vi.mock("chalk", () => ({
  default: {
    bold: Object.assign((s: string) => s, { cyan: (s: string) => s }),
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

let originalStateDir: string | undefined;
const originalExit = process.exit;
let exitCode: number | undefined;

interface ExecutionTestContext {
  tempDir: TempDirContext;
  program: Command;
  console: ConsoleSpy;
  providerManager: ProviderManager;
  writeModels: (content: string) => Promise<void>;
  readModels: () => Promise<Record<string, unknown>>;
  run: (args: string[]) => Promise<void>;
  runJson: (args: string[]) => Promise<unknown>;
  cleanup: () => Promise<void>;
}

async function reloadProviderSingleton(): Promise<void> {
  const { providerManager } = await import("../../providers");
  await providerManager.reload();
}

async function createExecutionTestContext(): Promise<ExecutionTestContext> {
  const tempDir = await createTempDir("provider-test-");
  originalStateDir = process.env.VIBEN_STATE_DIR;
  process.env.VIBEN_STATE_DIR = tempDir.root;

  const providerManager = new ProviderManager();
  exitCode = undefined;
  process.exit = vi.fn((code?: string | number | null | undefined) => {
    exitCode = typeof code === "number" ? code : 0;
    throw new Error(`process.exit unexpectedly called with "${code}"`);
  }) as never;

  const program = new Command();
  program.option("--json", "Output JSON format");
  program.option("--verbose", "Verbose output");
  program.option("--quiet", "Quiet mode");
  program.exitOverride();
  registerProviderCommand(program);

  const consoleSpy = createConsoleSpy();

  return {
    tempDir,
    program,
    console: consoleSpy,
    providerManager,

    async writeModels(content: string) {
      await tempDir.writeFile("models.yaml", content);
      await reloadProviderSingleton();
    },

    async readModels() {
      return parse(await tempDir.readFile("models.yaml"));
    },

    async run(args: string[]) {
      await reloadProviderSingleton();
      try {
        await program.parseAsync(["node", "test", ...args]);
      } catch (error) {
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
      await reloadProviderSingleton();
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
      return lastLog ? JSON.parse(lastLog) : null;
    },

    async cleanup() {
      consoleSpy.cleanup();
      await tempDir.cleanup();
      vi.clearAllMocks();
      if (originalStateDir !== undefined) {
        process.env.VIBEN_STATE_DIR = originalStateDir;
      } else {
        delete process.env.VIBEN_STATE_DIR;
      }
      process.exit = originalExit;
      await reloadProviderSingleton();
    },
  };
}

const TWO_PROVIDERS = `
openai-main:
  id: openai-main
  type: openai
  name: OpenAI Main
  api_key: sk-openai
  base_url: https://api.openai.com/v1
  is_default: true
  enabled: true
  models: {}
anthropic-main:
  id: anthropic-main
  type: anthropic
  name: Anthropic Main
  api_key: sk-ant
  enabled: true
  models: {}
`;

describe("provider command execution", () => {
  let ctx: ExecutionTestContext;

  beforeEach(async () => {
    ctx = await createExecutionTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("shows a message when no providers exist", async () => {
    await ctx.run(["provider", "list"]);

    expect(ctx.console.hasLog("No providers configured")).toBe(true);
  });

  it("lists providers from models.yaml", async () => {
    await ctx.writeModels(TWO_PROVIDERS);

    await ctx.run(["provider", "list"]);

    expect(ctx.console.hasLog("openai-main")).toBe(true);
    expect(ctx.console.hasLog("openai")).toBe(true);
  });

  it("returns JSON output and default provider from models.yaml", async () => {
    await ctx.writeModels(TWO_PROVIDERS);

    const result = (await ctx.runJson(["provider", "list"])) as {
      success: boolean;
      data: { providers: Array<{ id: string; isDefault: boolean }>; default: string };
    };

    expect(result.success).toBe(true);
    expect(result.data.default).toBe("openai-main");
    expect(result.data.providers.find((p) => p.id === "openai-main")?.isDefault).toBe(true);
  });

  it("filters media providers by surface", async () => {
    await ctx.writeModels(`
fal-media:
  id: fal-media
  type: fal
  category: media
  surfaces: [image, video]
  enabled: true
  models: {}
chat-provider:
  id: chat-provider
  type: openai
  category: llm
  surfaces: [chat]
  enabled: true
  models: {}
`);

    const result = (await ctx.runJson([
      "provider",
      "list",
      "--category",
      "media",
      "--surface",
      "image",
    ])) as {
      success: boolean;
      data: { providers: Array<{ id: string; type: string; surfaces: string[] }> };
    };

    expect(result.success).toBe(true);
    expect(result.data.providers).toEqual([
      expect.objectContaining({
        id: "fal-media",
        type: "fal",
        surfaces: ["image", "video"],
      }),
    ]);
  });

  it("creates a new provider in models.yaml", async () => {
    await ctx.run([
      "provider",
      "create",
      "-n",
      "my-anthropic",
      "-t",
      "anthropic",
      "-k",
      "sk-ant-xxx",
    ]);

    const config = await ctx.readModels();
    expect(config["my-anthropic"]).toMatchObject({
      id: "my-anthropic",
      type: "anthropic",
      api_key: "sk-ant-xxx",
      models: {},
    });
    expect(await ctx.tempDir.exists("providers.yaml")).toBe(false);
  });

  it("rejects duplicate provider IDs", async () => {
    await ctx.writeModels(TWO_PROVIDERS);

    await ctx.run(["provider", "create", "-n", "openai-main", "-t", "anthropic"]);

    expect(exitCode).toBe(1);
    expect(ctx.console.hasError("already exists")).toBe(true);
  });

  it("removes a provider from models.yaml", async () => {
    await ctx.writeModels(TWO_PROVIDERS);

    await ctx.run(["provider", "remove", "-n", "anthropic-main"]);

    const config = await ctx.readModels();
    expect(config["anthropic-main"]).toBeUndefined();
    expect(config["openai-main"]).toBeDefined();
  });

  it("sets default provider without top-level metadata", async () => {
    await ctx.writeModels(TWO_PROVIDERS);

    await ctx.run(["provider", "set-default", "-n", "anthropic-main"]);

    const config = await ctx.readModels();
    expect(config.default).toBeUndefined();
    expect(config["openai-main"]).toMatchObject({ is_default: false });
    expect(config["anthropic-main"]).toMatchObject({ is_default: true });
  });

  it("shows provider details", async () => {
    await ctx.writeModels(TWO_PROVIDERS);

    await ctx.run(["provider", "show", "-n", "openai-main"]);

    expect(ctx.console.hasLog("openai-main")).toBe(true);
    expect(ctx.console.hasLog("openai")).toBe(true);
  });

  it("updates provider type, api_key, and base_url", async () => {
    await ctx.writeModels(`
update-me:
  id: update-me
  type: openai
  api_key: old-key
  base_url: https://old.api.com
  enabled: true
  models: {}
`);

    await ctx.run([
      "provider",
      "update",
      "-n",
      "update-me",
      "-t",
      "anthropic",
      "-k",
      "new-key",
      "-u",
      "https://new.api.com",
    ]);

    const config = await ctx.readModels();
    expect(config["update-me"]).toMatchObject({
      type: "anthropic",
      api_key: "new-key",
      base_url: "https://new.api.com",
    });
  });

  it("enables and disables a provider", async () => {
    await ctx.writeModels(TWO_PROVIDERS);

    await ctx.run(["provider", "disable", "-n", "openai-main"]);
    let config = await ctx.readModels();
    expect(config["openai-main"]).toMatchObject({ enabled: false });

    await ctx.run(["provider", "enable", "-n", "openai-main"]);
    config = await ctx.readModels();
    expect(config["openai-main"]).toMatchObject({ enabled: true });
  });

  it("shows provider status", async () => {
    await ctx.writeModels(`
ollama-local:
  id: ollama-local
  type: ollama
  enabled: true
  models: {}
`);

    await ctx.run(["provider", "status", "-n", "ollama-local"]);

    expect(ctx.console.hasLog("ollama-local")).toBe(true);
  });

  it("lists supported provider types without custom provider", async () => {
    const result = (await ctx.runJson(["provider", "types"])) as {
      success: boolean;
      data: { types: Array<{ type: string }> };
    };

    expect(result.success).toBe(true);
    expect(result.data.types.some((entry) => entry.type === "openai-responses")).toBe(true);
    expect(result.data.types.some((entry) => entry.type === "custom")).toBe(false);
    expect(result.data.types.some((entry) => entry.type === "custom-image")).toBe(false);
  });
});
