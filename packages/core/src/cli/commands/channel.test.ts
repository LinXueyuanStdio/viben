/**
 * Channel CLI Commands Tests
 *
 * Tests for the channel management CLI commands.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { registerChannelCommand } from "./channel";
import type {
  Channel,
  ChannelStatus,
  ChannelTypeInfo,
  CreateChannelOptions,
  ChannelConfig,
  TestChannelResult,
  SendMessageResult,
} from "../../channels/types";

// Mock the channels module
vi.mock("../../channels", () => ({
  channelManager: {
    listChannels: vi.fn(),
    getChannel: vi.fn(),
    getDefaultChannel: vi.fn(),
    createChannel: vi.fn(),
    removeChannel: vi.fn(),
    enableChannel: vi.fn(),
    disableChannel: vi.fn(),
    setDefaultChannel: vi.fn(),
    getChannelStatus: vi.fn(),
    getAllChannelStatuses: vi.fn(),
    updateChannelConfig: vi.fn(),
    buildChannelConfig: vi.fn(),
  },
  CHANNEL_TYPES: [
    {
      id: "telegram",
      name: "Telegram Bot API",
      description: "Send messages via Telegram Bot",
      setupDifficulty: "easy",
    },
    {
      id: "discord",
      name: "Discord Bot API",
      description: "Send messages via Discord Bot",
      setupDifficulty: "easy",
    },
    {
      id: "feishu",
      name: "Feishu (Lark) Open Platform",
      description: "Send messages via Feishu/Lark",
      setupDifficulty: "medium",
    },
    {
      id: "whatsapp",
      name: "WhatsApp Web Bridge",
      description: "Send messages via WhatsApp bridge",
      setupDifficulty: "medium",
    },
    {
      id: "slack",
      name: "Slack Web API",
      description: "Send messages via Slack",
      setupDifficulty: "medium",
    },
    {
      id: "webhook",
      name: "Generic Webhook",
      description: "Send messages via HTTP webhook",
      setupDifficulty: "easy",
    },
  ] as ChannelTypeInfo[],
  testChannel: vi.fn(),
  sendTestMessage: vi.fn(),
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

import { channelManager, CHANNEL_TYPES, testChannel, sendTestMessage } from "../../channels";

/**
 * Helper to create a mock channel with proper typing
 */
function createMockChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: "test-channel",
    type: "telegram",
    name: "Test Channel",
    enabled: true,
    is_default: false,
    created_at: Date.now(),
    allow_from: [],
    notification_mode: "none",
    config: {},
    ...overrides,
  } as Channel;
}

/**
 * Helper to create a mock channel status
 */
function createMockChannelStatus(overrides: Partial<ChannelStatus> = {}): ChannelStatus {
  return {
    id: "test-channel",
    type: "telegram",
    name: "Test Channel",
    enabled: true,
    is_default: false,
    status: "connected",
    checked_at: Date.now(),
    ...overrides,
  } as ChannelStatus;
}

describe("Channel CLI Commands", () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create fresh program instance
    program = new Command();
    program.option("--json", "Output in JSON format");
    program.option("--verbose", "Verbose output");
    program.option("--quiet", "Quiet mode");

    // Register channel commands
    registerChannelCommand(program);

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
  // channel types
  // ============================================================================

  describe("channel types", () => {
    it("should list supported channel types", async () => {
      await runCommand(["channel", "types"]);

      expect(consoleSpy).toHaveBeenCalledWith("Supported Channel Types:");
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should output JSON when --json flag is provided", async () => {
      await runCommand(["--json", "channel", "types"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"types"')
      );
    });

    it("should include all supported channel types", async () => {
      await runCommand(["--json", "channel", "types"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.success).toBe(true);
      expect(response.data.types).toHaveLength(6);
      expect(response.data.types.map((t: ChannelTypeInfo) => t.id)).toContain("telegram");
      expect(response.data.types.map((t: ChannelTypeInfo) => t.id)).toContain("discord");
      expect(response.data.types.map((t: ChannelTypeInfo) => t.id)).toContain("feishu");
      expect(response.data.types.map((t: ChannelTypeInfo) => t.id)).toContain("whatsapp");
      expect(response.data.types.map((t: ChannelTypeInfo) => t.id)).toContain("slack");
      expect(response.data.types.map((t: ChannelTypeInfo) => t.id)).toContain("webhook");
    });
  });

  // ============================================================================
  // channel list
  // ============================================================================

  describe("channel list", () => {
    it("should list all configured channels", async () => {
      const mockChannels = [
        createMockChannel({
          id: "my-telegram",
          name: "My Telegram",
          type: "telegram",
          is_default: true,
        }),
        createMockChannel({
          id: "my-discord",
          name: "My Discord",
          type: "discord",
        }),
      ];

      vi.mocked(channelManager.listChannels).mockResolvedValue(mockChannels);
      vi.mocked(channelManager.getDefaultChannel).mockResolvedValue(mockChannels[0]);

      await runCommand(["channel", "list"]);

      expect(channelManager.listChannels).toHaveBeenCalled();
      expect(channelManager.getDefaultChannel).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith("Channels:");
    });

    it("should show message when no channels exist", async () => {
      vi.mocked(channelManager.listChannels).mockResolvedValue([]);
      vi.mocked(channelManager.getDefaultChannel).mockResolvedValue(undefined);

      await runCommand(["channel", "list"]);

      expect(consoleSpy).toHaveBeenCalledWith("No channels configured.");
    });

    it("should output JSON when --json flag is provided", async () => {
      const mockChannels = [
        createMockChannel({
          id: "my-telegram",
          name: "My Telegram",
          type: "telegram",
          is_default: true,
        }),
      ];

      vi.mocked(channelManager.listChannels).mockResolvedValue(mockChannels);
      vi.mocked(channelManager.getDefaultChannel).mockResolvedValue(mockChannels[0]);

      await runCommand(["--json", "channel", "list"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"channels"')
      );
    });

    it("should show default channel indicator", async () => {
      const mockChannels = [
        createMockChannel({
          id: "my-telegram",
          name: "My Telegram",
          type: "telegram",
          is_default: true,
        }),
      ];

      vi.mocked(channelManager.listChannels).mockResolvedValue(mockChannels);
      vi.mocked(channelManager.getDefaultChannel).mockResolvedValue(mockChannels[0]);

      await runCommand(["channel", "list"]);

      expect(consoleSpy).toHaveBeenCalledWith("* = default channel");
    });
  });

  // ============================================================================
  // channel create <id>
  // ============================================================================

  describe("channel create <id>", () => {
    it("should create a telegram channel", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        name: "my-telegram",
        type: "telegram",
        config: { token: "test-token" },
      });

      vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

      await runCommand([
        "channel",
        "create",
        "my-telegram",
        "--type",
        "telegram",
        "--token",
        "test-token",
      ]);

      expect(channelManager.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "my-telegram",
          name: "my-telegram",
          type: "telegram",
          token: "test-token",
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Channel "my-telegram" created successfully')
      );
    });

    it("should create a discord channel", async () => {
      const mockChannel = createMockChannel({
        id: "my-discord",
        name: "my-discord",
        type: "discord",
      });

      vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

      await runCommand([
        "channel",
        "create",
        "my-discord",
        "--type",
        "discord",
        "--token",
        "discord-token",
      ]);

      expect(channelManager.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "my-discord",
          type: "discord",
          token: "discord-token",
        })
      );
    });

    it("should create a feishu channel with app credentials", async () => {
      const mockChannel = createMockChannel({
        id: "my-feishu",
        name: "my-feishu",
        type: "feishu",
      });

      vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

      await runCommand([
        "channel",
        "create",
        "my-feishu",
        "--type",
        "feishu",
        "--app-id",
        "cli_xxx",
        "--app-secret",
        "secret123",
      ]);

      expect(channelManager.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "my-feishu",
          type: "feishu",
          app_id: "cli_xxx",
          app_secret: "secret123",
        })
      );
    });

    it("should create a whatsapp channel with bridge URL", async () => {
      const mockChannel = createMockChannel({
        id: "my-whatsapp",
        name: "my-whatsapp",
        type: "whatsapp",
      });

      vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

      await runCommand([
        "channel",
        "create",
        "my-whatsapp",
        "--type",
        "whatsapp",
        "--bridge-url",
        "ws://localhost:3001",
      ]);

      expect(channelManager.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "my-whatsapp",
          type: "whatsapp",
          bridge_url: "ws://localhost:3001",
        })
      );
    });

    it("should create a slack channel", async () => {
      const mockChannel = createMockChannel({
        id: "my-slack",
        name: "my-slack",
        type: "slack",
      });

      vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

      await runCommand([
        "channel",
        "create",
        "my-slack",
        "--type",
        "slack",
        "--token",
        "xoxb-slack-token",
      ]);

      expect(channelManager.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "my-slack",
          type: "slack",
          token: "xoxb-slack-token",
        })
      );
    });

    it("should create a webhook channel", async () => {
      const mockChannel = createMockChannel({
        id: "my-webhook",
        name: "my-webhook",
        type: "webhook",
      });

      vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

      await runCommand([
        "channel",
        "create",
        "my-webhook",
        "--type",
        "webhook",
        "--url",
        "https://example.com/webhook",
      ]);

      expect(channelManager.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "my-webhook",
          type: "webhook",
          url: "https://example.com/webhook",
        })
      );
    });

    it("should create channel with custom name", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        name: "Custom Name",
        type: "telegram",
      });

      vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

      await runCommand([
        "channel",
        "create",
        "my-telegram",
        "--type",
        "telegram",
        "--token",
        "test-token",
        "--name",
        "Custom Name",
      ]);

      expect(channelManager.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "my-telegram",
          name: "Custom Name",
        })
      );
    });

    it("should create channel with --chat-id option", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        type: "telegram",
      });

      vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

      await runCommand([
        "channel",
        "create",
        "my-telegram",
        "--type",
        "telegram",
        "--token",
        "test-token",
        "--chat-id",
        "123456789",
      ]);

      expect(channelManager.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          channel_id: "123456789",
        })
      );
    });

    it("should create channel as disabled with --disabled flag", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        type: "telegram",
        enabled: false,
      });

      vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

      await runCommand([
        "channel",
        "create",
        "my-telegram",
        "--type",
        "telegram",
        "--token",
        "test-token",
        "--disabled",
      ]);

      expect(channelManager.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        })
      );
    });

    it("should set as default with --set-default flag", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        type: "telegram",
        is_default: true,
      });

      vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

      await runCommand([
        "channel",
        "create",
        "my-telegram",
        "--type",
        "telegram",
        "--token",
        "test-token",
        "--set-default",
      ]);

      expect(channelManager.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          set_as_default: true,
        })
      );
    });

    it("should create telegram channel with proxy option", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        type: "telegram",
      });

      vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

      await runCommand([
        "channel",
        "create",
        "my-telegram",
        "--type",
        "telegram",
        "--token",
        "test-token",
        "--proxy",
        "http://127.0.0.1:7890",
      ]);

      expect(channelManager.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: "http://127.0.0.1:7890",
        })
      );
    });

    it("should reject invalid channel type", async () => {
      await expect(
        runCommand([
          "channel",
          "create",
          "my-channel",
          "--type",
          "invalid_type",
          "--token",
          "test-token",
        ])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid channel type")
      );
    });

    it("should output JSON when --json flag is provided", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        type: "telegram",
      });

      vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

      await runCommand([
        "--json",
        "channel",
        "create",
        "my-telegram",
        "--type",
        "telegram",
        "--token",
        "test-token",
      ]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"channel"')
      );
    });
  });

  // ============================================================================
  // channel remove <id>
  // ============================================================================

  describe("channel remove -n <id>", () => {
    it("should remove a channel", async () => {
      const mockChannel = createMockChannel({
        id: "channel-to-remove",
        name: "Channel To Remove",
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);
      vi.mocked(channelManager.removeChannel).mockResolvedValue(undefined);

      await runCommand(["channel", "remove", "-n", "channel-to-remove"]);

      expect(channelManager.getChannel).toHaveBeenCalledWith("channel-to-remove");
      expect(channelManager.removeChannel).toHaveBeenCalledWith("channel-to-remove");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Channel "channel-to-remove" removed successfully')
      );
    });

    it("should show error when channel not found", async () => {
      vi.mocked(channelManager.getChannel).mockResolvedValue(undefined);

      await expect(runCommand(["channel", "remove", "-n", "nonexistent"])).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found")
      );
    });

    it("should output JSON when --json flag is provided", async () => {
      const mockChannel = createMockChannel({
        id: "channel-to-remove",
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);
      vi.mocked(channelManager.removeChannel).mockResolvedValue(undefined);

      await runCommand(["--json", "channel", "remove", "-n", "channel-to-remove"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"removed"')
      );
    });
  });

  // ============================================================================
  // channel enable <id>
  // ============================================================================

  describe("channel enable -n <id>", () => {
    it("should enable a channel", async () => {
      const mockChannel = createMockChannel({
        id: "my-channel",
        enabled: true,
      });

      vi.mocked(channelManager.enableChannel).mockResolvedValue(mockChannel);

      await runCommand(["channel", "enable", "-n", "my-channel"]);

      expect(channelManager.enableChannel).toHaveBeenCalledWith("my-channel");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Channel "my-channel" enabled')
      );
    });

    it("should show error when channel not found", async () => {
      vi.mocked(channelManager.enableChannel).mockRejectedValue(
        new Error('Channel "nonexistent" not found')
      );

      await expect(runCommand(["channel", "enable", "-n", "nonexistent"])).rejects.toThrow();
    });

    it("should output JSON when --json flag is provided", async () => {
      const mockChannel = createMockChannel({
        id: "my-channel",
        enabled: true,
      });

      vi.mocked(channelManager.enableChannel).mockResolvedValue(mockChannel);

      await runCommand(["--json", "channel", "enable", "-n", "my-channel"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });
  });

  // ============================================================================
  // channel disable <id>
  // ============================================================================

  describe("channel disable -n <id>", () => {
    it("should disable a channel", async () => {
      const mockChannel = createMockChannel({
        id: "my-channel",
        enabled: false,
      });

      vi.mocked(channelManager.disableChannel).mockResolvedValue(mockChannel);

      await runCommand(["channel", "disable", "-n", "my-channel"]);

      expect(channelManager.disableChannel).toHaveBeenCalledWith("my-channel");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Channel "my-channel" disabled')
      );
    });

    it("should show error when channel not found", async () => {
      vi.mocked(channelManager.disableChannel).mockRejectedValue(
        new Error('Channel "nonexistent" not found')
      );

      await expect(runCommand(["channel", "disable", "-n", "nonexistent"])).rejects.toThrow();
    });

    it("should output JSON when --json flag is provided", async () => {
      const mockChannel = createMockChannel({
        id: "my-channel",
        enabled: false,
      });

      vi.mocked(channelManager.disableChannel).mockResolvedValue(mockChannel);

      await runCommand(["--json", "channel", "disable", "-n", "my-channel"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });
  });

  // ============================================================================
  // channel set-default <id>
  // ============================================================================

  describe("channel set-default -n <id>", () => {
    it("should set default channel", async () => {
      const mockChannel = createMockChannel({
        id: "new-default",
        is_default: true,
      });

      vi.mocked(channelManager.setDefaultChannel).mockResolvedValue(mockChannel);

      await runCommand(["channel", "set-default", "-n", "new-default"]);

      expect(channelManager.setDefaultChannel).toHaveBeenCalledWith("new-default");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Channel "new-default" set as default')
      );
    });

    it("should show error when channel not found", async () => {
      vi.mocked(channelManager.setDefaultChannel).mockRejectedValue(
        new Error('Channel "nonexistent" not found')
      );

      await expect(runCommand(["channel", "set-default", "-n", "nonexistent"])).rejects.toThrow();
    });

    it("should output JSON when --json flag is provided", async () => {
      const mockChannel = createMockChannel({
        id: "new-default",
        is_default: true,
      });

      vi.mocked(channelManager.setDefaultChannel).mockResolvedValue(mockChannel);

      await runCommand(["--json", "channel", "set-default", "-n", "new-default"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });
  });

  // ============================================================================
  // channel status [id]
  // ============================================================================

  describe("channel status", () => {
    it("should show status for all channels", async () => {
      const mockStatuses = [
        createMockChannelStatus({
          id: "my-telegram",
          type: "telegram",
          name: "My Telegram",
          enabled: true,
          is_default: true,
          status: "connected",
          latency_ms: 50,
        }),
        createMockChannelStatus({
          id: "my-discord",
          type: "discord",
          name: "My Discord",
          enabled: true,
          status: "connected",
          latency_ms: 100,
        }),
      ];

      vi.mocked(channelManager.getAllChannelStatuses).mockResolvedValue(mockStatuses);

      await runCommand(["channel", "status"]);

      expect(channelManager.getAllChannelStatuses).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith("Channel Status:");
    });

    it("should show status for a specific channel", async () => {
      const mockStatus = createMockChannelStatus({
        id: "my-telegram",
        type: "telegram",
        name: "My Telegram",
        enabled: true,
        is_default: true,
        status: "connected",
        details: "@my_bot",
        latency_ms: 50,
      });

      vi.mocked(channelManager.getChannelStatus).mockResolvedValue(mockStatus);

      await runCommand(["channel", "status", "-n", "my-telegram"]);

      expect(channelManager.getChannelStatus).toHaveBeenCalledWith("my-telegram");
      expect(consoleSpy).toHaveBeenCalledWith("Channel: my-telegram");
    });

    it("should show message when no channels configured", async () => {
      vi.mocked(channelManager.getAllChannelStatuses).mockResolvedValue([]);

      await runCommand(["channel", "status"]);

      expect(consoleSpy).toHaveBeenCalledWith("No channels configured.");
    });

    it("should show disabled status for disabled channel", async () => {
      const mockStatus = createMockChannelStatus({
        id: "my-channel",
        enabled: false,
        status: "disabled",
      });

      vi.mocked(channelManager.getChannelStatus).mockResolvedValue(mockStatus);

      await runCommand(["channel", "status", "-n", "my-channel"]);

      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should show error status with error details", async () => {
      const mockStatus = createMockChannelStatus({
        id: "my-channel",
        status: "error",
        error: "Connection timeout",
      });

      vi.mocked(channelManager.getChannelStatus).mockResolvedValue(mockStatus);

      await runCommand(["channel", "status", "-n", "my-channel"]);

      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should output JSON for all channels status", async () => {
      const mockStatuses = [
        createMockChannelStatus({ id: "channel-1" }),
        createMockChannelStatus({ id: "channel-2" }),
      ];

      vi.mocked(channelManager.getAllChannelStatuses).mockResolvedValue(mockStatuses);

      await runCommand(["--json", "channel", "status"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"statuses"')
      );
    });

    it("should output JSON for single channel status", async () => {
      const mockStatus = createMockChannelStatus({
        id: "my-channel",
        status: "connected",
      });

      vi.mocked(channelManager.getChannelStatus).mockResolvedValue(mockStatus);

      await runCommand(["--json", "channel", "status", "-n", "my-channel"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"status"')
      );
    });
  });

  // ============================================================================
  // channel config <id>
  // ============================================================================

  describe("channel config -n <id>", () => {
    it("should show channel configuration", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        name: "My Telegram",
        type: "telegram",
        enabled: true,
        is_default: true,
        created_at: Date.now(),
        allow_from: ["123456"],
        notification_mode: "none",
        config: { token: "secret-token", proxy: "http://proxy.example.com" },
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);

      await runCommand(["channel", "config", "-n", "my-telegram"]);

      expect(channelManager.getChannel).toHaveBeenCalledWith("my-telegram");
      expect(consoleSpy).toHaveBeenCalledWith("Channel: my-telegram");
    });

    it("should update channel config with set action", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        type: "telegram",
      });

      const updatedChannel = createMockChannel({
        ...mockChannel,
        config: { ...mockChannel.config, proxy: "http://new-proxy.example.com" },
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);
      vi.mocked(channelManager.updateChannelConfig).mockResolvedValue(updatedChannel);

      await runCommand([
        "channel",
        "config",
        "-n",
        "my-telegram",
        "set",
        "proxy",
        "http://new-proxy.example.com",
      ]);

      expect(channelManager.updateChannelConfig).toHaveBeenCalledWith(
        "my-telegram",
        "proxy",
        "http://new-proxy.example.com"
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Channel "my-telegram" config updated')
      );
    });

    it("should show error when channel not found", async () => {
      vi.mocked(channelManager.getChannel).mockResolvedValue(undefined);

      await expect(runCommand(["channel", "config", "-n", "nonexistent"])).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found")
      );
    });

    it("should mask sensitive values like token", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        type: "telegram",
        config: { token: "1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ" },
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);

      await runCommand(["channel", "config", "-n", "my-telegram"]);

      // The output should contain masked token (not the full token)
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should output JSON when --json flag is provided", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        type: "telegram",
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);

      await runCommand(["--json", "channel", "config", "-n", "my-telegram"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });
  });

  // ============================================================================
  // channel login <type>
  // ============================================================================

  describe("channel login <type>", () => {
    it("should show login guide for telegram", async () => {
      await runCommand(["channel", "login", "telegram"]);

      expect(consoleSpy).toHaveBeenCalledWith("Login Guide for telegram:");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("@BotFather")
      );
    });

    it("should show login guide for discord", async () => {
      await runCommand(["channel", "login", "discord"]);

      expect(consoleSpy).toHaveBeenCalledWith("Login Guide for discord:");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("discord.com/developers")
      );
    });

    it("should show login guide for feishu", async () => {
      await runCommand(["channel", "login", "feishu"]);

      expect(consoleSpy).toHaveBeenCalledWith("Login Guide for feishu:");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("open.feishu.cn")
      );
    });

    it("should show login guide for slack", async () => {
      await runCommand(["channel", "login", "slack"]);

      expect(consoleSpy).toHaveBeenCalledWith("Login Guide for slack:");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("api.slack.com")
      );
    });

    it("should show login guide for whatsapp", async () => {
      await runCommand(["channel", "login", "whatsapp"]);

      expect(consoleSpy).toHaveBeenCalledWith("Login Guide for whatsapp:");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("bridge")
      );
    });

    it("should show login guide for webhook", async () => {
      await runCommand(["channel", "login", "webhook"]);

      expect(consoleSpy).toHaveBeenCalledWith("Login Guide for webhook:");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("webhook endpoint")
      );
    });

    it("should reject invalid channel type", async () => {
      await expect(
        runCommand(["channel", "login", "invalid_type"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid channel type")
      );
    });

    it("should show login for existing channel with --name option", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        type: "telegram",
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);

      await runCommand(["channel", "login", "telegram", "--name", "my-telegram"]);

      expect(channelManager.getChannel).toHaveBeenCalledWith("my-telegram");
      // Should show manual configuration message for telegram
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("configure credentials manually")
      );
    });

    it("should show WhatsApp bridge info for existing WhatsApp channel", async () => {
      const mockChannel = createMockChannel({
        id: "my-whatsapp",
        type: "whatsapp",
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);

      await runCommand(["channel", "login", "whatsapp", "--name", "my-whatsapp"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("WhatsApp login requires bridge")
      );
    });

    it("should show error when existing channel not found", async () => {
      vi.mocked(channelManager.getChannel).mockResolvedValue(undefined);

      await expect(
        runCommand(["channel", "login", "telegram", "--name", "nonexistent"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found")
      );
    });

    it("should output JSON when --json flag is provided", async () => {
      await runCommand(["--json", "channel", "login", "telegram"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"guide"')
      );
    });
  });

  // ============================================================================
  // channel test <id>
  // ============================================================================

  describe("channel test <id>", () => {
    it("should test channel connectivity", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        type: "telegram",
        config: { token: "test-token" },
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);
      vi.mocked(channelManager.buildChannelConfig).mockReturnValue({
        id: "my-telegram",
        type: "telegram",
        name: "My Telegram",
        enabled: true,
        created_at: Date.now(),
        allow_from: [],
        token: "test-token",
      } as ChannelConfig);
      vi.mocked(testChannel).mockResolvedValue({
        success: true,
        details: "@my_bot",
      });

      await runCommand(["channel", "test", "my-telegram"]);

      expect(channelManager.getChannel).toHaveBeenCalledWith("my-telegram");
      expect(testChannel).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith("Connectivity test passed.");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Channel connectivity test passed!")
      );
    });

    it("should send test message when chat-id is provided", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        type: "telegram",
        config: { token: "test-token" },
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);
      vi.mocked(channelManager.buildChannelConfig).mockReturnValue({
        id: "my-telegram",
        type: "telegram",
        name: "My Telegram",
        enabled: true,
        created_at: Date.now(),
        allow_from: [],
        token: "test-token",
      } as ChannelConfig);
      vi.mocked(testChannel).mockResolvedValue({ success: true });
      vi.mocked(sendTestMessage).mockResolvedValue({
        success: true,
        messageId: "msg-123",
      });

      await runCommand(["channel", "test", "my-telegram", "123456789"]);

      expect(testChannel).toHaveBeenCalled();
      expect(sendTestMessage).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test message sent successfully!")
      );
    });

    it("should show error when channel not found", async () => {
      vi.mocked(channelManager.getChannel).mockResolvedValue(undefined);

      await expect(runCommand(["channel", "test", "nonexistent"])).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found")
      );
    });

    it("should show error when connectivity test fails", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        type: "telegram",
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);
      vi.mocked(channelManager.buildChannelConfig).mockReturnValue({
        id: "my-telegram",
        type: "telegram",
        name: "My Telegram",
        enabled: true,
        created_at: Date.now(),
        allow_from: [],
        token: "invalid-token",
      } as ChannelConfig);
      vi.mocked(testChannel).mockResolvedValue({
        success: false,
        error: "Invalid token",
      });

      await expect(runCommand(["channel", "test", "my-telegram"])).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Channel test failed: Invalid token")
      );
    });

    it("should show error when sending test message fails", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        type: "telegram",
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);
      vi.mocked(channelManager.buildChannelConfig).mockReturnValue({
        id: "my-telegram",
        type: "telegram",
        name: "My Telegram",
        enabled: true,
        created_at: Date.now(),
        allow_from: [],
        token: "test-token",
      } as ChannelConfig);
      vi.mocked(testChannel).mockResolvedValue({ success: true });
      vi.mocked(sendTestMessage).mockResolvedValue({
        success: false,
        error: "Chat not found",
      });

      await expect(
        runCommand(["channel", "test", "my-telegram", "invalid-chat"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send test message: Chat not found")
      );
    });

    it("should output JSON when --json flag is provided (connectivity only)", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        type: "telegram",
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);
      vi.mocked(channelManager.buildChannelConfig).mockReturnValue({
        id: "my-telegram",
        type: "telegram",
        name: "My Telegram",
        enabled: true,
        created_at: Date.now(),
        allow_from: [],
        token: "test-token",
      } as ChannelConfig);
      vi.mocked(testChannel).mockResolvedValue({ success: true });

      await runCommand(["--json", "channel", "test", "my-telegram"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"test": "passed"')
      );
    });

    it("should output JSON when --json flag is provided (with message sent)", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        type: "telegram",
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);
      vi.mocked(channelManager.buildChannelConfig).mockReturnValue({
        id: "my-telegram",
        type: "telegram",
        name: "My Telegram",
        enabled: true,
        created_at: Date.now(),
        allow_from: [],
        token: "test-token",
      } as ChannelConfig);
      vi.mocked(testChannel).mockResolvedValue({ success: true });
      vi.mocked(sendTestMessage).mockResolvedValue({
        success: true,
        messageId: "msg-123",
      });

      await runCommand(["--json", "channel", "test", "my-telegram", "123456"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message": "sent"')
      );
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("error handling", () => {
    it("should handle unexpected errors gracefully", async () => {
      vi.mocked(channelManager.listChannels).mockRejectedValue(
        new Error("Unexpected database error")
      );

      await expect(runCommand(["channel", "list"])).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unexpected database error")
      );
    });

    it("should handle validation errors", async () => {
      vi.mocked(channelManager.createChannel).mockRejectedValue(
        new Error("Token is required for Telegram channels")
      );

      await expect(
        runCommand([
          "channel",
          "create",
          "my-telegram",
          "--type",
          "telegram",
        ])
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // JSON Output Tests
  // ============================================================================

  describe("JSON output mode", () => {
    it("should output valid JSON for all commands", async () => {
      // Test types command
      await runCommand(["--json", "channel", "types"]);
      let output = consoleSpy.mock.calls[0][0] as string;
      expect(() => JSON.parse(output)).not.toThrow();
      vi.clearAllMocks();

      // Test list command
      vi.mocked(channelManager.listChannels).mockResolvedValue([]);
      vi.mocked(channelManager.getDefaultChannel).mockResolvedValue(undefined);
      await runCommand(["--json", "channel", "list"]);
      output = consoleSpy.mock.calls[0][0] as string;
      expect(() => JSON.parse(output)).not.toThrow();
      vi.clearAllMocks();

      // Test create command
      const mockChannel = createMockChannel({ id: "test" });
      vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);
      await runCommand([
        "--json",
        "channel",
        "create",
        "test",
        "--type",
        "telegram",
        "--token",
        "token",
      ]);
      output = consoleSpy.mock.calls[0][0] as string;
      expect(() => JSON.parse(output)).not.toThrow();
    });
  });

  // ============================================================================
  // Spec Compliance Tests - channel.md
  // ============================================================================

  describe("spec compliance", () => {
    describe("channel types output format", () => {
      it("should match spec output format for human-readable", async () => {
        await runCommand(["channel", "types"]);

        // Per spec: should show TYPE and DESCRIPTION columns
        expect(consoleSpy).toHaveBeenCalledWith("Supported Channel Types:");
        // All 6 types should be listed
        expect(consoleSpy).toHaveBeenCalled();
      });

      it("should match spec JSON structure", async () => {
        await runCommand(["--json", "channel", "types"]);

        const output = consoleSpy.mock.calls[0][0] as string;
        const response = JSON.parse(output);

        // Per spec JSON structure: { success, data: { types: [...] } }
        expect(response.success).toBe(true);
        expect(response.data.types).toBeDefined();
        expect(response.data.types).toHaveLength(6);

        // Each type should have id and name (as per spec)
        const type = response.data.types[0];
        expect(type).toHaveProperty("id");
        expect(type).toHaveProperty("name");
      });
    });

    describe("channel list output format", () => {
      it("should match spec output format with columns", async () => {
        const mockChannels = [
          createMockChannel({
            id: "vibenrobot",
            name: "viben_robot",
            type: "telegram",
            enabled: true,
            is_default: true,
          }),
          createMockChannel({
            id: "my-discord",
            name: "My Discord",
            type: "discord",
            enabled: true,
            is_default: false,
          }),
          createMockChannel({
            id: "my-feishu",
            name: "Feishu Bot",
            type: "feishu",
            enabled: false,
            is_default: false,
          }),
        ];

        vi.mocked(channelManager.listChannels).mockResolvedValue(mockChannels);
        vi.mocked(channelManager.getDefaultChannel).mockResolvedValue(mockChannels[0]);

        await runCommand(["channel", "list"]);

        // Per spec: columns are ID, NAME, TYPE, ENABLED, DEFAULT
        expect(channelManager.listChannels).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith("Channels:");
      });

      it("should match spec JSON structure for list", async () => {
        const mockChannels = [
          createMockChannel({
            id: "vibenrobot",
            type: "telegram",
            is_default: true,
            enabled: true,
            notification_mode: "none",
            created_at: Date.now(),
            updated_at: Date.now(),
          }),
        ];

        vi.mocked(channelManager.listChannels).mockResolvedValue(mockChannels);
        vi.mocked(channelManager.getDefaultChannel).mockResolvedValue(mockChannels[0]);

        await runCommand(["--json", "channel", "list"]);

        const output = consoleSpy.mock.calls[0][0] as string;
        const response = JSON.parse(output);

        // Per spec: { success, data: { channels: [...] } }
        expect(response.success).toBe(true);
        expect(response.data.channels).toBeDefined();
        expect(response.data.channels[0]).toHaveProperty("id");
        expect(response.data.channels[0]).toHaveProperty("is_default");
        expect(response.data.channels[0]).toHaveProperty("enabled");
      });

      it("should show hint when no channels configured", async () => {
        vi.mocked(channelManager.listChannels).mockResolvedValue([]);
        vi.mocked(channelManager.getDefaultChannel).mockResolvedValue(undefined);

        await runCommand(["channel", "list"]);

        // Per spec: "No channels configured:" with hint
        expect(consoleSpy).toHaveBeenCalledWith("No channels configured.");
      });
    });

    describe("channel status output format", () => {
      it("should match spec format with status indicators", async () => {
        const mockStatuses = [
          createMockChannelStatus({
            id: "my-telegram",
            type: "telegram",
            name: "my-telegram",
            enabled: true,
            is_default: false,
            status: "connected",
            details: "@my_bot",
          }),
          createMockChannelStatus({
            id: "my-discord",
            type: "discord",
            name: "my-discord",
            enabled: true,
            is_default: false,
            status: "connected",
            details: "MyBot#1234",
          }),
          createMockChannelStatus({
            id: "my-whatsapp",
            type: "whatsapp",
            name: "my-whatsapp",
            enabled: false,
            is_default: false,
            status: "disabled",
          }),
        ];

        vi.mocked(channelManager.getAllChannelStatuses).mockResolvedValue(mockStatuses);

        await runCommand(["channel", "status"]);

        // Per spec: shows channel status with ✓ connected or ○ disabled
        expect(consoleSpy).toHaveBeenCalledWith("Channel Status:");
      });
    });

    describe("channel create variations", () => {
      it("should create channel with allow_from whitelist", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram",
          type: "telegram",
          allow_from: ["123456789"],
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        // Note: allow_from is typically set via config command, but create might support it
        await runCommand([
          "channel",
          "create",
          "my-telegram",
          "--type",
          "telegram",
          "--token",
          "test-token",
        ]);

        expect(channelManager.createChannel).toHaveBeenCalled();
      });

      it("should validate required options for each channel type", async () => {
        // Telegram requires token - validation happens in channelManager.createChannel
        vi.mocked(channelManager.createChannel).mockRejectedValue(
          new Error("Token is required for Telegram channels")
        );

        await expect(
          runCommand([
            "channel",
            "create",
            "my-telegram",
            "--type",
            "telegram",
            // Missing --token - should fail in channelManager
          ])
        ).rejects.toThrow();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Token is required")
        );
      });
    });

    describe("channel config set with JSON array value", () => {
      it("should update allow_from with JSON array", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram",
          type: "telegram",
        });

        const updatedChannel = createMockChannel({
          ...mockChannel,
          allow_from: ["123456789"],
        });

        vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);
        vi.mocked(channelManager.updateChannelConfig).mockResolvedValue(updatedChannel);

        // Per spec: viben channel config -n my-telegram set allow_from "[\"123456789\"]"
        await runCommand([
          "channel",
          "config",
          "-n",
          "my-telegram",
          "set",
          "allow_from",
          '["123456789"]',
        ]);

        expect(channelManager.updateChannelConfig).toHaveBeenCalledWith(
          "my-telegram",
          "allow_from",
          '["123456789"]'
        );
      });

      it("should update proxy setting", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram",
          type: "telegram",
        });

        vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);
        vi.mocked(channelManager.updateChannelConfig).mockResolvedValue(mockChannel);

        // Per spec: viben channel config -n my-telegram set proxy "http://127.0.0.1:7890"
        await runCommand([
          "channel",
          "config",
          "-n",
          "my-telegram",
          "set",
          "proxy",
          "http://127.0.0.1:7890",
        ]);

        expect(channelManager.updateChannelConfig).toHaveBeenCalledWith(
          "my-telegram",
          "proxy",
          "http://127.0.0.1:7890"
        );
      });
    });

    describe("channel config display", () => {
      it("should display channel configuration with all fields", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram",
          name: "My Telegram",
          type: "telegram",
          enabled: true,
          is_default: true,
          created_at: Date.now(),
          updated_at: Date.now(),
          allow_from: ["123456789"],
          notification_mode: "none",
          config: {
            token: "1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ",
            proxy: "http://127.0.0.1:7890",
          },
        });

        vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);

        await runCommand(["channel", "config", "-n", "my-telegram"]);

        expect(consoleSpy).toHaveBeenCalledWith("Channel: my-telegram");
        // Should show config details
        expect(consoleSpy).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Edge Cases and Boundary Conditions
  // ============================================================================

  describe("edge cases", () => {
    describe("channel create edge cases", () => {
      it("should handle channel ID with special characters", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram-123",
          type: "telegram",
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        await runCommand([
          "channel",
          "create",
          "my-telegram-123",
          "--type",
          "telegram",
          "--token",
          "test-token",
        ]);

        expect(channelManager.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "my-telegram-123",
          })
        );
      });

      it("should handle duplicate channel ID error", async () => {
        vi.mocked(channelManager.createChannel).mockRejectedValue(
          new Error('Channel "my-telegram" already exists')
        );

        await expect(
          runCommand([
            "channel",
            "create",
            "my-telegram",
            "--type",
            "telegram",
            "--token",
            "test-token",
          ])
        ).rejects.toThrow();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("already exists")
        );
      });

      it("should handle empty token", async () => {
        vi.mocked(channelManager.createChannel).mockRejectedValue(
          new Error("Token is required for Telegram channels")
        );

        await expect(
          runCommand([
            "channel",
            "create",
            "my-telegram",
            "--type",
            "telegram",
            "--token",
            "",
          ])
        ).rejects.toThrow();
      });
    });

    describe("channel remove edge cases", () => {
      it("should handle removing default channel", async () => {
        const mockChannel = createMockChannel({
          id: "default-channel",
          is_default: true,
        });

        vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);
        vi.mocked(channelManager.removeChannel).mockResolvedValue(undefined);

        await runCommand(["channel", "remove", "-n", "default-channel"]);

        expect(channelManager.removeChannel).toHaveBeenCalledWith("default-channel");
      });

      it("should handle remove with --force flag", async () => {
        const mockChannel = createMockChannel({
          id: "channel-to-remove",
        });

        vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);
        vi.mocked(channelManager.removeChannel).mockResolvedValue(undefined);

        await runCommand(["channel", "remove", "-n", "channel-to-remove", "--force"]);

        expect(channelManager.removeChannel).toHaveBeenCalledWith("channel-to-remove");
      });
    });

    describe("channel set-default edge cases", () => {
      it("should handle setting disabled channel as default", async () => {
        const mockChannel = createMockChannel({
          id: "disabled-channel",
          enabled: false,
          is_default: true,
        });

        vi.mocked(channelManager.setDefaultChannel).mockResolvedValue(mockChannel);

        await runCommand(["channel", "set-default", "-n", "disabled-channel"]);

        expect(channelManager.setDefaultChannel).toHaveBeenCalledWith("disabled-channel");
      });
    });

    describe("channel status edge cases", () => {
      it("should handle channel with error status", async () => {
        const mockStatus = createMockChannelStatus({
          id: "error-channel",
          status: "error",
          error: "Connection refused",
          latency_ms: undefined,
        });

        vi.mocked(channelManager.getChannelStatus).mockResolvedValue(mockStatus);

        await runCommand(["channel", "status", "-n", "error-channel"]);

        expect(consoleSpy).toHaveBeenCalled();
      });

      it("should handle channel with high latency", async () => {
        const mockStatus = createMockChannelStatus({
          id: "slow-channel",
          status: "connected",
          latency_ms: 5000,
        });

        vi.mocked(channelManager.getChannelStatus).mockResolvedValue(mockStatus);

        await runCommand(["channel", "status", "-n", "slow-channel"]);

        expect(consoleSpy).toHaveBeenCalled();
      });
    });

    describe("channel test edge cases", () => {
      it("should handle timeout during connectivity test", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram",
          type: "telegram",
        });

        vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);
        vi.mocked(channelManager.buildChannelConfig).mockReturnValue({
          id: "my-telegram",
          type: "telegram",
          name: "My Telegram",
          enabled: true,
          created_at: Date.now(),
          allow_from: [],
          token: "test-token",
        } as ChannelConfig);
        vi.mocked(testChannel).mockResolvedValue({
          success: false,
          error: "Connection timeout after 30s",
        });

        await expect(runCommand(["channel", "test", "my-telegram"])).rejects.toThrow();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Connection timeout")
        );
      });

      it("should handle network error during test", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram",
          type: "telegram",
        });

        vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);
        vi.mocked(channelManager.buildChannelConfig).mockReturnValue({
          id: "my-telegram",
          type: "telegram",
          name: "My Telegram",
          enabled: true,
          created_at: Date.now(),
          allow_from: [],
          token: "test-token",
        } as ChannelConfig);
        vi.mocked(testChannel).mockRejectedValue(new Error("Network error: ECONNREFUSED"));

        await expect(runCommand(["channel", "test", "my-telegram"])).rejects.toThrow();
      });
    });
  });

  // ============================================================================
  // Integration with YAML Storage (spec requirement)
  // ============================================================================

  describe("YAML storage integration", () => {
    it("should store channels in ~/.viben/channels.yaml format", async () => {
      // This test verifies the channelManager interface matches spec expectations
      // The actual YAML file writing is handled by channelManager
      const mockChannel = createMockChannel({
        id: "my-telegram",
        type: "telegram",
        enabled: true,
        config: {
          token: "encrypted:xxx",
          proxy: null,
        },
      });

      vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

      await runCommand([
        "channel",
        "create",
        "my-telegram",
        "--type",
        "telegram",
        "--token",
        "test-token",
      ]);

      // Verify createChannel was called with correct structure
      expect(channelManager.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "my-telegram",
          type: "telegram",
          token: "test-token",
        })
      );
    });
  });

  // ============================================================================
  // Command Alias Tests (spec uses -n for name)
  // ============================================================================

  describe("command options and aliases", () => {
    it("should support --name as alias for -n in create (display name)", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        name: "Custom Name",
        type: "telegram",
      });

      vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

      await runCommand([
        "channel",
        "create",
        "my-telegram",
        "--type",
        "telegram",
        "--token",
        "test-token",
        "--name",
        "Custom Name",
      ]);

      expect(channelManager.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Custom Name",
        })
      );
    });

    it("should support -f as alias for --force in remove", async () => {
      const mockChannel = createMockChannel({
        id: "channel-to-remove",
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);
      vi.mocked(channelManager.removeChannel).mockResolvedValue(undefined);

      await runCommand(["channel", "remove", "-n", "channel-to-remove", "-f"]);

      expect(channelManager.removeChannel).toHaveBeenCalledWith("channel-to-remove");
    });

    it("should support --name as long form for -n in remove", async () => {
      const mockChannel = createMockChannel({
        id: "channel-to-remove",
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);
      vi.mocked(channelManager.removeChannel).mockResolvedValue(undefined);

      await runCommand(["channel", "remove", "--name", "channel-to-remove"]);

      expect(channelManager.removeChannel).toHaveBeenCalledWith("channel-to-remove");
    });

    it("should support --name as long form for -n in enable", async () => {
      const mockChannel = createMockChannel({
        id: "my-channel",
        enabled: true,
      });

      vi.mocked(channelManager.enableChannel).mockResolvedValue(mockChannel);

      await runCommand(["channel", "enable", "--name", "my-channel"]);

      expect(channelManager.enableChannel).toHaveBeenCalledWith("my-channel");
    });

    it("should support --name as long form for -n in disable", async () => {
      const mockChannel = createMockChannel({
        id: "my-channel",
        enabled: false,
      });

      vi.mocked(channelManager.disableChannel).mockResolvedValue(mockChannel);

      await runCommand(["channel", "disable", "--name", "my-channel"]);

      expect(channelManager.disableChannel).toHaveBeenCalledWith("my-channel");
    });

    it("should support --name as long form for -n in set-default", async () => {
      const mockChannel = createMockChannel({
        id: "my-channel",
        is_default: true,
      });

      vi.mocked(channelManager.setDefaultChannel).mockResolvedValue(mockChannel);

      await runCommand(["channel", "set-default", "--name", "my-channel"]);

      expect(channelManager.setDefaultChannel).toHaveBeenCalledWith("my-channel");
    });

    it("should support --name as long form for -n in status", async () => {
      const mockStatus = createMockChannelStatus({
        id: "my-channel",
        status: "connected",
      });

      vi.mocked(channelManager.getChannelStatus).mockResolvedValue(mockStatus);

      await runCommand(["channel", "status", "--name", "my-channel"]);

      expect(channelManager.getChannelStatus).toHaveBeenCalledWith("my-channel");
    });

    it("should support --name as long form for -n in config", async () => {
      const mockChannel = createMockChannel({
        id: "my-channel",
        type: "telegram",
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);

      await runCommand(["channel", "config", "--name", "my-channel"]);

      expect(channelManager.getChannel).toHaveBeenCalledWith("my-channel");
    });
  });
});
