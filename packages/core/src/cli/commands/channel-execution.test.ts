/**
 * Channel Command Execution Tests
 *
 * Tests that actually execute channel commands and verify real YAML file operations.
 * Uses real file system operations with temporary directories.
 *
 * This complements channel.test.ts which tests with mocked channelManager.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerChannelCommand } from "./channel";
import { createTempDir, type TempDirContext } from "../../test/helpers/temp-dir";
import { createConsoleSpy, type ConsoleSpy } from "../../test/mocks/console";
import type { ChannelsFile } from "../../channels/types";

// =============================================================================
// Test Setup
// =============================================================================

// Mock the getChannelsPath function to return our temp directory path
vi.mock("../../channels/manager", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../channels/manager")>();
  return {
    ...original,
    getChannelsPath: vi.fn(),
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

import * as channelManagerModule from "../../channels/manager";
import { ChannelManager } from "../../channels/manager";

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
  channelManager: ChannelManager;
  /** Write channels config and reload manager */
  writeConfig: (content: string) => Promise<void>;
  /** Write channels JSON config and reload manager */
  writeJsonConfig: (data: ChannelsFile) => Promise<void>;
  run: (args: string[]) => Promise<void>;
  runJson: (args: string[]) => Promise<unknown>;
  cleanup: () => Promise<void>;
}

async function createExecutionTestContext(): Promise<ExecutionTestContext> {
  const tempDir = await createTempDir("channel-test-");
  const channelsPath = tempDir.resolve("channels.yaml");

  // Mock getChannelsPath to return our temp directory
  vi.mocked(channelManagerModule.getChannelsPath).mockReturnValue(channelsPath);

  // Create a fresh ChannelManager instance that will use the mocked path
  const manager = new ChannelManager(channelsPath);

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

  // We need to dynamically import and create a new channel command module
  // that uses our custom manager. Since the CLI uses the singleton, we need
  // to mock the channelManager import in the channel command module.

  // Re-mock the channels module to use our manager
  vi.doMock("../../channels", async (importOriginal) => {
    const original = await importOriginal<typeof import("../../channels")>();
    return {
      ...original,
      channelManager: manager,
    };
  });

  // Clear the module cache and re-import
  vi.resetModules();

  // Re-import the channel command with fresh mocks
  const { registerChannelCommand: registerCmd } = await import("./channel");
  registerCmd(program);

  const consoleSpy = createConsoleSpy();

  return {
    tempDir,
    program,
    console: consoleSpy,
    channelManager: manager,

    async writeConfig(content: string) {
      await tempDir.writeFile("channels.yaml", content);
      // Reload manager to pick up new config
      await manager.load();
    },

    async writeJsonConfig(data: ChannelsFile) {
      const yaml = await import("yaml");
      await tempDir.writeFile("channels.yaml", yaml.stringify(data));
      // Reload manager to pick up new config
      await manager.load();
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
      vi.resetModules();
      // Restore process.exit
      process.exit = originalExit;
    },
  };
}

// =============================================================================
// Execution Tests
// =============================================================================

describe("channel command execution", () => {
  let ctx: ExecutionTestContext;

  beforeEach(async () => {
    ctx = await createExecutionTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // ===========================================================================
  // channel types execution
  // ===========================================================================

  describe("channel types", () => {
    it("should list all supported channel types", async () => {
      await ctx.run(["channel", "types"]);

      expect(ctx.console.hasLog("Supported Channel Types:")).toBe(true);
      expect(ctx.console.hasLog("telegram")).toBe(true);
      expect(ctx.console.hasLog("discord")).toBe(true);
      expect(ctx.console.hasLog("feishu")).toBe(true);
      expect(ctx.console.hasLog("whatsapp")).toBe(true);
      expect(ctx.console.hasLog("slack")).toBe(true);
      expect(ctx.console.hasLog("webhook")).toBe(true);
    });

    it("should return JSON output with channel types", async () => {
      const result = (await ctx.runJson(["channel", "types"])) as {
        success: boolean;
        data: { types: Array<{ id: string; name: string }> };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.types).toBeDefined();
      expect(Array.isArray(result?.data?.types)).toBe(true);
      expect(result?.data?.types?.some((t) => t.id === "telegram")).toBe(true);
      expect(result?.data?.types?.some((t) => t.id === "discord")).toBe(true);
    });
  });

  // ===========================================================================
  // channel list execution
  // ===========================================================================

  describe("channel list", () => {
    it("should show message when no channels configured", async () => {
      await ctx.run(["channel", "list"]);

      expect(ctx.console.hasLog("No channels configured.")).toBe(true);
    });

    it("should list channels from config file", async () => {
      await ctx.writeJsonConfig({
        version: 1,
        default: "my-telegram",
        channels: {
          "my-telegram": {
            type: "telegram",
            name: "My Telegram",
            enabled: true,
            created_at: Date.now(),
            token: "test-token",
          },
          "my-discord": {
            type: "discord",
            name: "My Discord",
            enabled: true,
            created_at: Date.now(),
            token: "discord-token",
          },
        },
      });

      await ctx.run(["channel", "list"]);

      expect(ctx.console.hasLog("my-telegram")).toBe(true);
      expect(ctx.console.hasLog("my-discord")).toBe(true);
      expect(ctx.console.hasLog("* = default channel")).toBe(true);
    });

    it("should return JSON output with channels list", async () => {
      await ctx.writeJsonConfig({
        version: 1,
        default: "my-telegram",
        channels: {
          "my-telegram": {
            type: "telegram",
            name: "My Telegram",
            enabled: true,
            created_at: Date.now(),
            token: "test-token",
          },
        },
      });

      const result = (await ctx.runJson(["channel", "list"])) as {
        success: boolean;
        data: { channels: Array<{ id: string; type: string }> };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.channels).toBeDefined();
      expect(result?.data?.channels?.some((c) => c.id === "my-telegram")).toBe(true);
    });
  });

  // ===========================================================================
  // channel create execution
  // ===========================================================================

  describe("channel create", () => {
    it("should create a telegram channel and save to file", async () => {
      await ctx.run([
        "channel", "create", "my-telegram",
        "--type", "telegram",
        "--token", "test-bot-token-123",
        "--name", "My Telegram Bot",
      ]);

      // Verify success message
      expect(ctx.console.hasLog('Channel "my-telegram" created successfully')).toBe(true);

      // Verify file contents
      const exists = await ctx.tempDir.exists("channels.yaml");
      expect(exists).toBe(true);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("my-telegram");
      expect(content).toContain("telegram");
      expect(content).toContain("test-bot-token-123");
    });

    it("should create a discord channel with token", async () => {
      await ctx.run([
        "channel", "create", "my-discord",
        "--type", "discord",
        "--token", "discord-bot-token",
      ]);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("my-discord");
      expect(content).toContain("discord");
      expect(content).toContain("discord-bot-token");
    });

    it("should create a feishu channel with app credentials", async () => {
      await ctx.run([
        "channel", "create", "my-feishu",
        "--type", "feishu",
        "--app-id", "cli_xxx123",
        "--app-secret", "secret-key-456",
      ]);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("my-feishu");
      expect(content).toContain("feishu");
      expect(content).toContain("cli_xxx123");
      expect(content).toContain("secret-key-456");
    });

    it("should create a whatsapp channel with bridge URL", async () => {
      await ctx.run([
        "channel", "create", "my-whatsapp",
        "--type", "whatsapp",
        "--bridge-url", "ws://localhost:3001",
      ]);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("my-whatsapp");
      expect(content).toContain("whatsapp");
      expect(content).toContain("ws://localhost:3001");
    });

    it("should create a slack channel with token", async () => {
      await ctx.run([
        "channel", "create", "my-slack",
        "--type", "slack",
        "--token", "xoxb-slack-token",
      ]);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("my-slack");
      expect(content).toContain("slack");
      expect(content).toContain("xoxb-slack-token");
    });

    it("should create a webhook channel with URL", async () => {
      await ctx.run([
        "channel", "create", "my-webhook",
        "--type", "webhook",
        "--url", "https://example.com/webhook",
      ]);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("my-webhook");
      expect(content).toContain("webhook");
      expect(content).toContain("https://example.com/webhook");
    });

    it("should set first channel as default automatically", async () => {
      await ctx.run([
        "channel", "create", "first-channel",
        "--type", "telegram",
        "--token", "test-token",
      ]);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("default: first-channel");
    });

    it("should set channel as default when --set-default is provided", async () => {
      // Create first channel
      await ctx.run([
        "channel", "create", "first-channel",
        "--type", "telegram",
        "--token", "test-token-1",
      ]);

      // Create second channel with --set-default
      await ctx.run([
        "channel", "create", "second-channel",
        "--type", "telegram",
        "--token", "test-token-2",
        "--set-default",
      ]);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("default: second-channel");
    });

    it("should create channel as disabled with --disabled flag", async () => {
      await ctx.run([
        "channel", "create", "disabled-channel",
        "--type", "telegram",
        "--token", "test-token",
        "--disabled",
      ]);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("enabled: false");
    });

    it("should create telegram channel with proxy option", async () => {
      await ctx.run([
        "channel", "create", "proxy-telegram",
        "--type", "telegram",
        "--token", "test-token",
        "--proxy", "http://127.0.0.1:7890",
      ]);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("proxy: http://127.0.0.1:7890");
    });

    it("should reject invalid channel type", async () => {
      await ctx.run([
        "channel", "create", "invalid",
        "--type", "invalid_type",
        "--token", "test-token",
      ]);

      // Check that error was logged and exit was called
      expect(ctx.console.hasError("Invalid channel type")).toBe(true);
      expect(exitCode).toBe(1);
    });

    it("should reject creating channel with existing ID", async () => {
      // Create first channel
      await ctx.run([
        "channel", "create", "my-telegram",
        "--type", "telegram",
        "--token", "test-token-1",
      ]);

      // Reset console to check new error
      ctx.console.reset();
      exitCode = undefined;

      // Try to create another with same ID
      await ctx.run([
        "channel", "create", "my-telegram",
        "--type", "telegram",
        "--token", "test-token-2",
      ]);

      // Should have logged error and exited
      expect(ctx.console.hasError("already exists")).toBe(true);
      expect(exitCode).toBe(1);
    });

    it("should return JSON output on success", async () => {
      const result = (await ctx.runJson([
        "channel", "create", "json-channel",
        "--type", "telegram",
        "--token", "test-token",
      ])) as {
        success: boolean;
        data: { channel: { id: string; type: string } };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.channel?.id).toBe("json-channel");
      expect(result?.data?.channel?.type).toBe("telegram");
    });
  });

  // ===========================================================================
  // channel remove execution
  // ===========================================================================

  describe("channel remove", () => {
    it("should remove a channel from config file", async () => {
      await ctx.writeJsonConfig({
        version: 1,
        default: "my-telegram",
        channels: {
          "my-telegram": {
            type: "telegram",
            name: "My Telegram",
            enabled: true,
            created_at: Date.now(),
            token: "test-token",
          },
          "my-discord": {
            type: "discord",
            name: "My Discord",
            enabled: true,
            created_at: Date.now(),
            token: "discord-token",
          },
        },
      });

      await ctx.run(["channel", "remove", "-n", "my-telegram"]);

      expect(ctx.console.hasLog('Channel "my-telegram" removed successfully')).toBe(true);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).not.toContain("my-telegram:");
      expect(content).toContain("my-discord");
    });

    it("should update default when removing default channel", async () => {
      await ctx.writeJsonConfig({
        version: 1,
        default: "my-telegram",
        channels: {
          "my-telegram": {
            type: "telegram",
            name: "My Telegram",
            enabled: true,
            created_at: Date.now(),
            token: "test-token",
          },
          "my-discord": {
            type: "discord",
            name: "My Discord",
            enabled: true,
            created_at: Date.now(),
            token: "discord-token",
          },
        },
      });

      await ctx.run(["channel", "remove", "-n", "my-telegram"]);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("default: my-discord");
    });

    it("should show error when channel not found", async () => {
      await ctx.writeJsonConfig({
        version: 1,
        channels: {},
      });

      await ctx.run(["channel", "remove", "-n", "nonexistent"]);

      expect(ctx.console.hasError("not found")).toBe(true);
      expect(exitCode).toBe(1);
    });

    it("should return JSON output on success", async () => {
      await ctx.writeJsonConfig({
        version: 1,
        default: "my-telegram",
        channels: {
          "my-telegram": {
            type: "telegram",
            name: "My Telegram",
            enabled: true,
            created_at: Date.now(),
            token: "test-token",
          },
        },
      });

      const result = (await ctx.runJson(["channel", "remove", "-n", "my-telegram"])) as {
        success: boolean;
        data: { removed: string };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.removed).toBe("my-telegram");
    });
  });

  // ===========================================================================
  // channel enable/disable execution
  // ===========================================================================

  describe("channel enable", () => {
    it("should enable a disabled channel", async () => {
      await ctx.writeJsonConfig({
        version: 1,
        channels: {
          "my-telegram": {
            type: "telegram",
            name: "My Telegram",
            enabled: false,
            created_at: Date.now(),
            token: "test-token",
          },
        },
      });

      await ctx.run(["channel", "enable", "-n", "my-telegram"]);

      expect(ctx.console.hasLog('Channel "my-telegram" enabled')).toBe(true);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("enabled: true");
    });

    it("should show error when channel not found", async () => {
      await ctx.writeJsonConfig({
        version: 1,
        channels: {},
      });

      await ctx.run(["channel", "enable", "-n", "nonexistent"]);

      expect(ctx.console.hasError("not found")).toBe(true);
      expect(exitCode).toBe(1);
    });
  });

  describe("channel disable", () => {
    it("should disable an enabled channel", async () => {
      await ctx.writeJsonConfig({
        version: 1,
        channels: {
          "my-telegram": {
            type: "telegram",
            name: "My Telegram",
            enabled: true,
            created_at: Date.now(),
            token: "test-token",
          },
        },
      });

      await ctx.run(["channel", "disable", "-n", "my-telegram"]);

      expect(ctx.console.hasLog('Channel "my-telegram" disabled')).toBe(true);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("enabled: false");
    });
  });

  // ===========================================================================
  // channel set-default execution
  // ===========================================================================

  describe("channel set-default", () => {
    it("should set a channel as default", async () => {
      await ctx.writeJsonConfig({
        version: 1,
        default: "first-channel",
        channels: {
          "first-channel": {
            type: "telegram",
            name: "First",
            enabled: true,
            created_at: Date.now(),
            token: "token-1",
          },
          "second-channel": {
            type: "telegram",
            name: "Second",
            enabled: true,
            created_at: Date.now(),
            token: "token-2",
          },
        },
      });

      await ctx.run(["channel", "set-default", "-n", "second-channel"]);

      expect(ctx.console.hasLog('Channel "second-channel" set as default')).toBe(true);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("default: second-channel");
    });

    it("should show error when channel not found", async () => {
      await ctx.writeJsonConfig({
        version: 1,
        channels: {},
      });

      await ctx.run(["channel", "set-default", "-n", "nonexistent"]);

      expect(ctx.console.hasError("not found")).toBe(true);
      expect(exitCode).toBe(1);
    });
  });

  // ===========================================================================
  // channel config execution
  // ===========================================================================

  describe("channel config", () => {
    describe("show config", () => {
      it("should show channel configuration", async () => {
        await ctx.writeJsonConfig({
          version: 1,
          channels: {
            "my-telegram": {
              type: "telegram",
              name: "My Telegram",
              enabled: true,
              created_at: Date.now(),
              token: "test-token-123",
              proxy: "http://127.0.0.1:7890",
            },
          },
        });

        await ctx.run(["channel", "config", "-n", "my-telegram"]);

        expect(ctx.console.hasLog("my-telegram")).toBe(true);
        expect(ctx.console.hasLog("telegram")).toBe(true);
      });

      it("should show error when channel not found", async () => {
        await ctx.writeJsonConfig({
          version: 1,
          channels: {},
        });

        await ctx.run(["channel", "config", "-n", "nonexistent"]);

        expect(ctx.console.hasError("not found")).toBe(true);
        expect(exitCode).toBe(1);
      });
    });

    describe("set config", () => {
      it("should update channel proxy configuration", async () => {
        await ctx.writeJsonConfig({
          version: 1,
          channels: {
            "my-telegram": {
              type: "telegram",
              name: "My Telegram",
              enabled: true,
              created_at: Date.now(),
              token: "test-token",
            },
          },
        });

        await ctx.run(["channel", "config", "-n", "my-telegram", "set", "proxy", "http://new-proxy:8080"]);

        const content = await ctx.tempDir.readFile("channels.yaml");
        expect(content).toContain("proxy: http://new-proxy:8080");
      });

      it("should update channel token configuration", async () => {
        await ctx.writeJsonConfig({
          version: 1,
          channels: {
            "my-telegram": {
              type: "telegram",
              name: "My Telegram",
              enabled: true,
              created_at: Date.now(),
              token: "old-token",
            },
          },
        });

        await ctx.run(["channel", "config", "-n", "my-telegram", "set", "token", "new-token-456"]);

        const content = await ctx.tempDir.readFile("channels.yaml");
        expect(content).toContain("token: new-token-456");
      });

      it("should reject invalid config key", async () => {
        await ctx.writeJsonConfig({
          version: 1,
          channels: {
            "my-telegram": {
              type: "telegram",
              name: "My Telegram",
              enabled: true,
              created_at: Date.now(),
              token: "test-token",
            },
          },
        });

        await ctx.run(["channel", "config", "-n", "my-telegram", "set", "invalid_key", "value"]);

        expect(ctx.console.hasError("Invalid config key")).toBe(true);
        expect(exitCode).toBe(1);
      });

      it("should return JSON output on success", async () => {
        await ctx.writeJsonConfig({
          version: 1,
          channels: {
            "my-telegram": {
              type: "telegram",
              name: "My Telegram",
              enabled: true,
              created_at: Date.now(),
              token: "test-token",
            },
          },
        });

        const result = (await ctx.runJson([
          "channel", "config", "-n", "my-telegram", "set", "proxy", "http://proxy:8080",
        ])) as {
          success: boolean;
        };

        expect(result?.success).toBe(true);
      });
    });
  });

  // ===========================================================================
  // Edge cases and complex scenarios
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle multiple create operations", async () => {
      await ctx.run([
        "channel", "create", "channel-1",
        "--type", "telegram",
        "--token", "token-1",
      ]);
      await ctx.run([
        "channel", "create", "channel-2",
        "--type", "discord",
        "--token", "token-2",
      ]);
      await ctx.run([
        "channel", "create", "channel-3",
        "--type", "webhook",
        "--url", "https://example.com/hook",
      ]);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("channel-1");
      expect(content).toContain("channel-2");
      expect(content).toContain("channel-3");
    });

    it("should handle create then remove then create with same ID", async () => {
      // Create channel
      await ctx.run([
        "channel", "create", "reusable-id",
        "--type", "telegram",
        "--token", "token-1",
      ]);

      // Remove it
      await ctx.run(["channel", "remove", "-n", "reusable-id"]);

      // Create again with same ID
      await ctx.run([
        "channel", "create", "reusable-id",
        "--type", "discord",
        "--token", "token-2",
      ]);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("reusable-id");
      expect(content).toContain("discord");
    });

    it("should handle special characters in token", async () => {
      await ctx.run([
        "channel", "create", "special-token",
        "--type", "telegram",
        "--token", "123456:ABC-DEF_ghi-JKL",
      ]);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("123456:ABC-DEF_ghi-JKL");
    });

    it("should handle round-trip create-enable-disable-enable", async () => {
      await ctx.run([
        "channel", "create", "roundtrip-channel",
        "--type", "telegram",
        "--token", "test-token",
      ]);

      await ctx.run(["channel", "disable", "-n", "roundtrip-channel"]);
      let content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("enabled: false");

      await ctx.run(["channel", "enable", "-n", "roundtrip-channel"]);
      content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("enabled: true");
    });

    it("should preserve other channels when removing one", async () => {
      await ctx.writeJsonConfig({
        version: 1,
        default: "keep-me-1",
        channels: {
          "keep-me-1": {
            type: "telegram",
            name: "Keep 1",
            enabled: true,
            created_at: Date.now(),
            token: "token-1",
          },
          "remove-me": {
            type: "telegram",
            name: "Remove",
            enabled: true,
            created_at: Date.now(),
            token: "token-2",
          },
          "keep-me-2": {
            type: "telegram",
            name: "Keep 2",
            enabled: true,
            created_at: Date.now(),
            token: "token-3",
          },
        },
      });

      await ctx.run(["channel", "remove", "-n", "remove-me"]);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("keep-me-1");
      expect(content).toContain("keep-me-2");
      expect(content).not.toContain("remove-me");
    });

    it("should handle URL with special characters in webhook", async () => {
      await ctx.run([
        "channel", "create", "webhook-special",
        "--type", "webhook",
        "--url", "https://example.com/webhook?key=value&other=123",
      ]);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("url:");
      expect(content).toContain("example.com");
    });
  });

  // ===========================================================================
  // Integration scenarios
  // ===========================================================================

  describe("integration scenarios", () => {
    it("should maintain config integrity through multiple operations", async () => {
      // Create multiple channels
      await ctx.run([
        "channel", "create", "telegram-main",
        "--type", "telegram",
        "--token", "tg-token",
        "--name", "Main Telegram",
      ]);

      await ctx.run([
        "channel", "create", "discord-backup",
        "--type", "discord",
        "--token", "dc-token",
        "--name", "Backup Discord",
      ]);

      // Modify settings
      await ctx.run(["channel", "config", "-n", "telegram-main", "set", "proxy", "http://proxy:8080"]);
      await ctx.run(["channel", "set-default", "-n", "discord-backup"]);
      await ctx.run(["channel", "disable", "-n", "telegram-main"]);

      // Verify final state
      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("default: discord-backup");
      expect(content).toContain("proxy: http://proxy:8080");

      // Check via manager
      const channels = await ctx.channelManager.listChannels();
      expect(channels.length).toBe(2);

      const telegramChannel = channels.find((c) => c.id === "telegram-main");
      expect(telegramChannel?.enabled).toBe(false);

      const discordChannel = channels.find((c) => c.id === "discord-backup");
      expect(discordChannel?.is_default).toBe(true);
    });

    it("should handle version field correctly", async () => {
      await ctx.run([
        "channel", "create", "test-channel",
        "--type", "telegram",
        "--token", "test-token",
      ]);

      const content = await ctx.tempDir.readFile("channels.yaml");
      expect(content).toContain("version: 1");
    });
  });
});
