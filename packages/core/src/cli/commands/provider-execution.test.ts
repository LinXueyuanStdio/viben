/**
 * Provider Command Execution Tests
 *
 * Tests that actually execute provider commands with real ProviderManager
 * using temporary YAML configuration files.
 *
 * This complements provider.test.ts which uses mocked providerManager.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { registerProviderCommand } from "./provider";
import { createTempDir, type TempDirContext } from "../../test/helpers/temp-dir";
import { createConsoleSpy, type ConsoleSpy } from "../../test/mocks/console";
import { ProviderManager } from "../../providers";

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
  providerManager: ProviderManager;
  run: (args: string[]) => Promise<void>;
  runJson: (args: string[]) => Promise<unknown>;
  cleanup: () => Promise<void>;
}

async function createExecutionTestContext(): Promise<ExecutionTestContext> {
  const tempDir = await createTempDir("provider-test-");

  // Set VIBEN_STATE_DIR to use temp directory for provider config
  originalStateDir = process.env.VIBEN_STATE_DIR;
  process.env.VIBEN_STATE_DIR = tempDir.root;

  // Create a fresh ProviderManager that will use the temp directory
  const providerManager = new ProviderManager();

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

  registerProviderCommand(program);

  const consoleSpy = createConsoleSpy();

  return {
    tempDir,
    program,
    console: consoleSpy,
    providerManager,

    async run(args: string[]) {
      // Force providerManager to reload config from disk
      const { providerManager: pm } = await import("../../providers");
      await pm.reload();

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
      // Force providerManager to reload config from disk
      const { providerManager: pm } = await import("../../providers");
      await pm.reload();

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

      // Reload the singleton providerManager to clear cached config
      const { providerManager: pm } = await import("../../providers");
      await pm.reload();
    },
  };
}

// =============================================================================
// Execution Tests
// =============================================================================

describe("provider command execution", () => {
  let ctx: ExecutionTestContext;

  beforeEach(async () => {
    ctx = await createExecutionTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // ===========================================================================
  // provider list execution
  // ===========================================================================

  describe("provider list", () => {
    it("should show message when no providers exist", async () => {
      await ctx.run(["provider", "list"]);

      // Check that console output indicates no providers
      const hasNoProvidersMessage = ctx.console.hasLog("No providers configured");
      expect(hasNoProvidersMessage).toBe(true);
    });

    it("should list providers from config", async () => {
      // Create providers.yaml with test data
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `default: openai-main
providers:
  openai-main:
    provider_type: openai
    name: openai-main
    api_key: sk-xxx
    base_url: https://api.openai.com/v1
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      await ctx.run(["provider", "list"]);

      expect(ctx.console.hasLog("openai-main")).toBe(true);
      expect(ctx.console.hasLog("openai")).toBe(true);
    });

    it("should return JSON output with --json flag", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `providers:
  test-provider:
    provider_type: anthropic
    name: test-provider
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      const result = (await ctx.runJson(["provider", "list"])) as {
        success: boolean;
        data: { providers: Array<{ id: string }> };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.providers).toBeDefined();
      expect(result?.data?.providers.length).toBe(1);
      expect(result?.data?.providers[0]?.id).toBe("test-provider");
    });

    it("should show default indicator for default provider", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `default: my-default
providers:
  my-default:
    provider_type: openai
    name: my-default
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
  secondary:
    provider_type: anthropic
    name: secondary
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      const result = (await ctx.runJson(["provider", "list"])) as {
        success: boolean;
        data: { providers: Array<{ id: string; isDefault: boolean }>; default: string };
      };

      expect(result?.data?.default).toBe("my-default");
      const defaultProvider = result?.data?.providers.find((p) => p.id === "my-default");
      expect(defaultProvider?.isDefault).toBe(true);
    });
  });

  // ===========================================================================
  // provider create execution
  // ===========================================================================

  describe("provider create", () => {
    it("should create new provider in config", async () => {
      // Start with empty providers
      await ctx.tempDir.writeFile("providers.yaml", "providers: {}");

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

      // Verify provider was created
      const content = await ctx.tempDir.readFile("providers.yaml");
      expect(content).toContain("my-anthropic");
      expect(content).toContain("provider_type: anthropic");
      expect(content).toContain("api_key: sk-ant-xxx");
    });

    it("should auto-generate name if not provided", async () => {
      await ctx.tempDir.writeFile("providers.yaml", "providers: {}");

      await ctx.run(["provider", "create", "-t", "openai", "-k", "sk-xxx"]);

      const content = await ctx.tempDir.readFile("providers.yaml");
      expect(content).toContain("provider_type: openai");
      // Auto-generated name contains "openai-" prefix
      expect(content).toMatch(/openai-\d+/);
    });

    it("should set first provider as default", async () => {
      await ctx.tempDir.writeFile("providers.yaml", "providers: {}");

      await ctx.run(["provider", "create", "-n", "first-provider", "-t", "openai"]);

      const content = await ctx.tempDir.readFile("providers.yaml");
      expect(content).toContain("default: first-provider");
    });

    it("should set provider as default with --default flag", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `default: existing
providers:
  existing:
    provider_type: openai
    name: existing
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      await ctx.run([
        "provider",
        "create",
        "-n",
        "new-default",
        "-t",
        "anthropic",
        "-d",
      ]);

      const content = await ctx.tempDir.readFile("providers.yaml");
      expect(content).toContain("default: new-default");
    });

    it("should set base URL", async () => {
      await ctx.tempDir.writeFile("providers.yaml", "providers: {}");

      await ctx.run([
        "provider",
        "create",
        "-n",
        "custom-url",
        "-t",
        "openai",
        "-u",
        "https://custom.api.com/v1",
      ]);

      const content = await ctx.tempDir.readFile("providers.yaml");
      expect(content).toContain("base_url: https://custom.api.com/v1");
    });

    it("should return JSON output with --json flag", async () => {
      await ctx.tempDir.writeFile("providers.yaml", "providers: {}");

      const result = (await ctx.runJson([
        "provider",
        "create",
        "-n",
        "json-provider",
        "-t",
        "openai",
      ])) as {
        success: boolean;
        data: { provider: { id: string; type: string } };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.provider?.id).toBe("json-provider");
      expect(result?.data?.provider?.type).toBe("openai");
    });

    it("should reject invalid provider type", async () => {
      await ctx.tempDir.writeFile("providers.yaml", "providers: {}");

      await ctx.run(["provider", "create", "-n", "invalid", "-t", "invalid-type"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("Invalid provider type")).toBe(true);
    });

    it("should reject duplicate provider id", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `providers:
  existing:
    provider_type: openai
    name: existing
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      await ctx.run(["provider", "create", "-n", "existing", "-t", "anthropic"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("already exists")).toBe(true);
    });
  });

  // ===========================================================================
  // provider remove execution
  // ===========================================================================

  describe("provider remove", () => {
    it("should remove provider from config", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `providers:
  to-remove:
    provider_type: openai
    name: to-remove
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      await ctx.run(["provider", "remove", "-n", "to-remove"]);

      const content = await ctx.tempDir.readFile("providers.yaml");
      expect(content).not.toContain("to-remove");
    });

    it("should update default when removing default provider", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `default: first
providers:
  first:
    provider_type: openai
    name: first
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
  second:
    provider_type: anthropic
    name: second
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      await ctx.run(["provider", "remove", "-n", "first"]);

      const content = await ctx.tempDir.readFile("providers.yaml");
      expect(content).not.toContain("first:");
      // Default should be updated to remaining provider
      expect(content).toContain("default: second");
    });

    it("should return error for non-existent provider", async () => {
      await ctx.tempDir.writeFile("providers.yaml", "providers: {}");

      await ctx.run(["provider", "remove", "-n", "nonexistent"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("not found")).toBe(true);
    });

    it("should return JSON output with --json flag", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `providers:
  removable:
    provider_type: openai
    name: removable
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      const result = (await ctx.runJson(["provider", "remove", "-n", "removable"])) as {
        success: boolean;
        data: { removed: string };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.removed).toBe("removable");
    });
  });

  // ===========================================================================
  // provider set-default execution
  // ===========================================================================

  describe("provider set-default", () => {
    it("should set default provider", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `default: first
providers:
  first:
    provider_type: openai
    name: first
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
  second:
    provider_type: anthropic
    name: second
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      await ctx.run(["provider", "set-default", "-n", "second"]);

      const content = await ctx.tempDir.readFile("providers.yaml");
      expect(content).toContain("default: second");
    });

    it("should return error for non-existent provider", async () => {
      await ctx.tempDir.writeFile("providers.yaml", "providers: {}");

      await ctx.run(["provider", "set-default", "-n", "nonexistent"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("not found")).toBe(true);
    });

    it("should return JSON output with --json flag", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `providers:
  my-provider:
    provider_type: openai
    name: my-provider
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      const result = (await ctx.runJson([
        "provider",
        "set-default",
        "-n",
        "my-provider",
      ])) as {
        success: boolean;
        data: { default: string };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.default).toBe("my-provider");
    });
  });

  // ===========================================================================
  // provider show execution
  // ===========================================================================

  describe("provider show", () => {
    it("should show provider details", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `providers:
  show-me:
    provider_type: anthropic
    name: show-me
    api_key: sk-ant-xxx
    base_url: https://api.anthropic.com/v1
    timeout: 30
    max_retries: 3
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      await ctx.run(["provider", "show", "-n", "show-me"]);

      expect(ctx.console.hasLog("show-me")).toBe(true);
      expect(ctx.console.hasLog("anthropic")).toBe(true);
    });

    it("should return error for non-existent provider", async () => {
      await ctx.tempDir.writeFile("providers.yaml", "providers: {}");

      await ctx.run(["provider", "show", "-n", "nonexistent"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("not found")).toBe(true);
    });

    it("should return JSON output with --json flag", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `providers:
  json-show:
    provider_type: openai
    name: json-show
    api_key: sk-xxx
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      const result = (await ctx.runJson(["provider", "show", "-n", "json-show"])) as {
        success: boolean;
        data: { provider: { id: string; type: string; apiKey: string } };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.provider?.id).toBe("json-show");
      expect(result?.data?.provider?.type).toBe("openai");
      expect(result?.data?.provider?.apiKey).toBe("sk-xxx");
    });
  });

  // ===========================================================================
  // provider update execution
  // ===========================================================================

  describe("provider update", () => {
    it("should update provider type", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `providers:
  update-me:
    provider_type: openai
    name: update-me
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      await ctx.run(["provider", "update", "-n", "update-me", "-t", "anthropic"]);

      const content = await ctx.tempDir.readFile("providers.yaml");
      expect(content).toContain("provider_type: anthropic");
    });

    it("should update API key", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `providers:
  update-key:
    provider_type: openai
    name: update-key
    api_key: old-key
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      await ctx.run(["provider", "update", "-n", "update-key", "-k", "new-key"]);

      const content = await ctx.tempDir.readFile("providers.yaml");
      expect(content).toContain("api_key: new-key");
      expect(content).not.toContain("old-key");
    });

    it("should update base URL", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `providers:
  update-url:
    provider_type: custom
    name: update-url
    base_url: https://old.api.com
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      await ctx.run([
        "provider",
        "update",
        "-n",
        "update-url",
        "-u",
        "https://new.api.com",
      ]);

      const content = await ctx.tempDir.readFile("providers.yaml");
      expect(content).toContain("base_url: https://new.api.com");
    });

    it("should return error for non-existent provider", async () => {
      await ctx.tempDir.writeFile("providers.yaml", "providers: {}");

      await ctx.run(["provider", "update", "-n", "nonexistent", "-k", "key"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("not found")).toBe(true);
    });

    it("should return JSON output with --json flag", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `providers:
  json-update:
    provider_type: openai
    name: json-update
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      const result = (await ctx.runJson([
        "provider",
        "update",
        "-n",
        "json-update",
        "-k",
        "new-key",
      ])) as {
        success: boolean;
        data: { provider: { id: string; apiKey: string } };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.provider?.id).toBe("json-update");
      expect(result?.data?.provider?.apiKey).toBe("new-key");
    });
  });

  // ===========================================================================
  // provider enable/disable execution
  // ===========================================================================

  describe("provider enable", () => {
    it("should enable disabled provider", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `providers:
  disabled-provider:
    provider_type: openai
    name: disabled-provider
    enabled: false
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      await ctx.run(["provider", "enable", "-n", "disabled-provider"]);

      const content = await ctx.tempDir.readFile("providers.yaml");
      expect(content).toContain("enabled: true");
    });

    it("should return error for non-existent provider", async () => {
      await ctx.tempDir.writeFile("providers.yaml", "providers: {}");

      await ctx.run(["provider", "enable", "-n", "nonexistent"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("not found")).toBe(true);
    });
  });

  describe("provider disable", () => {
    it("should disable enabled provider", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `providers:
  enabled-provider:
    provider_type: openai
    name: enabled-provider
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      await ctx.run(["provider", "disable", "-n", "enabled-provider"]);

      const content = await ctx.tempDir.readFile("providers.yaml");
      expect(content).toContain("enabled: false");
    });

    it("should return error for non-existent provider", async () => {
      await ctx.tempDir.writeFile("providers.yaml", "providers: {}");

      await ctx.run(["provider", "disable", "-n", "nonexistent"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("not found")).toBe(true);
    });
  });

  // ===========================================================================
  // provider status execution
  // ===========================================================================

  describe("provider status", () => {
    it("should show status for all providers", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `providers:
  status-test:
    provider_type: ollama
    name: status-test
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      await ctx.run(["provider", "status"]);

      expect(ctx.console.hasLog("status-test")).toBe(true);
    });

    it("should show status for specific provider", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `providers:
  specific-status:
    provider_type: ollama
    name: specific-status
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      await ctx.run(["provider", "status", "-n", "specific-status"]);

      expect(ctx.console.hasLog("specific-status")).toBe(true);
    });

    it("should show disabled status for disabled provider", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `providers:
  disabled-status:
    provider_type: openai
    name: disabled-status
    enabled: false
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      const result = (await ctx.runJson([
        "provider",
        "status",
        "-n",
        "disabled-status",
      ])) as {
        success: boolean;
        data: { status: { connected: boolean; error: string } };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.status?.connected).toBe(false);
      expect(result?.data?.status?.error).toContain("disabled");
    });

    it("should show API key error for provider without key", async () => {
      await ctx.tempDir.writeFile(
        "providers.yaml",
        `providers:
  no-key:
    provider_type: openai
    name: no-key
    enabled: true
    created_at: "2024-01-01T00:00:00Z"
    updated_at: "2024-01-01T00:00:00Z"
`
      );

      const result = (await ctx.runJson(["provider", "status", "-n", "no-key"])) as {
        success: boolean;
        data: { status: { connected: boolean; error: string } };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.status?.connected).toBe(false);
      expect(result?.data?.status?.error).toContain("API key not configured");
    });

    it("should return error for non-existent provider", async () => {
      await ctx.tempDir.writeFile("providers.yaml", "providers: {}");

      const result = (await ctx.runJson([
        "provider",
        "status",
        "-n",
        "nonexistent",
      ])) as {
        success: boolean;
        data: { status: { connected: boolean; error: string } };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.status?.connected).toBe(false);
      expect(result?.data?.status?.error).toContain("not found");
    });
  });

  // ===========================================================================
  // provider types execution
  // ===========================================================================

  describe("provider types", () => {
    it("should list all supported provider types", async () => {
      await ctx.run(["provider", "types"]);

      expect(ctx.console.hasLog("openai")).toBe(true);
      expect(ctx.console.hasLog("anthropic")).toBe(true);
      expect(ctx.console.hasLog("azure")).toBe(true);
      expect(ctx.console.hasLog("ollama")).toBe(true);
      expect(ctx.console.hasLog("openrouter")).toBe(true);
      expect(ctx.console.hasLog("google")).toBe(true);
      expect(ctx.console.hasLog("custom")).toBe(true);
    });

    it("should return JSON output with --json flag", async () => {
      const result = (await ctx.runJson(["provider", "types"])) as {
        success: boolean;
        data: { types: Array<{ type: string; defaultUrl: string; envVar: string }> };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.types).toBeDefined();
      expect(result?.data?.types.length).toBeGreaterThan(0);

      const openaiType = result?.data?.types.find((t) => t.type === "openai");
      expect(openaiType).toBeDefined();
      expect(openaiType?.defaultUrl).toContain("api.openai.com");
      expect(openaiType?.envVar).toBe("OPENAI_API_KEY");
    });
  });
});
