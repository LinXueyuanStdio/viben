/**
 * Channel CLI Commands Tests
 *
 * Tests for the channel management CLI commands.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ChannelTypeInfo, ChannelConfig } from "../../channels/types";
import { chalkMock } from "../../test/mocks/chalk";
import {
  createMockChannel,
  createMockChannelStatus,
  MOCK_CHANNEL_TYPES,
} from "../../test/factories/channel";
import { createCliTestContext, type CliTestContext } from "../../test/helpers/cli";

// =============================================================================
// Mock Functions - Hoisted
// =============================================================================

const {
  mockListChannels,
  mockGetChannel,
  mockGetDefaultChannel,
  mockCreateChannel,
  mockRemoveChannel,
  mockEnableChannel,
  mockDisableChannel,
  mockSetDefaultChannel,
  mockGetChannelStatus,
  mockGetAllChannelStatuses,
  mockUpdateChannelConfig,
  mockBuildChannelConfig,
  mockTestChannel,
  mockSendTestMessage,
} = vi.hoisted(() => ({
  mockListChannels: vi.fn(),
  mockGetChannel: vi.fn(),
  mockGetDefaultChannel: vi.fn(),
  mockCreateChannel: vi.fn(),
  mockRemoveChannel: vi.fn(),
  mockEnableChannel: vi.fn(),
  mockDisableChannel: vi.fn(),
  mockSetDefaultChannel: vi.fn(),
  mockGetChannelStatus: vi.fn(),
  mockGetAllChannelStatuses: vi.fn(),
  mockUpdateChannelConfig: vi.fn(),
  mockBuildChannelConfig: vi.fn(),
  mockTestChannel: vi.fn(),
  mockSendTestMessage: vi.fn(),
}));

// =============================================================================
// Module Mocks
// =============================================================================

vi.mock("../../channels", () => ({
  channelManager: {
    listChannels: mockListChannels,
    getChannel: mockGetChannel,
    getDefaultChannel: mockGetDefaultChannel,
    createChannel: mockCreateChannel,
    removeChannel: mockRemoveChannel,
    enableChannel: mockEnableChannel,
    disableChannel: mockDisableChannel,
    setDefaultChannel: mockSetDefaultChannel,
    getChannelStatus: mockGetChannelStatus,
    getAllChannelStatuses: mockGetAllChannelStatuses,
    updateChannelConfig: mockUpdateChannelConfig,
    buildChannelConfig: mockBuildChannelConfig,
  },
  CHANNEL_TYPES: MOCK_CHANNEL_TYPES,
  testChannel: mockTestChannel,
  sendTestMessage: mockSendTestMessage,
}));

vi.mock("chalk", () => chalkMock);

// Mock process.exit
vi.spyOn(process, "exit").mockImplementation((code?: number | string | null | undefined) => {
  throw new Error(`process.exit(${code})`);
});

// Import after mocking
import { registerChannelCommand } from "./channel";

// =============================================================================
// Test Suite
// =============================================================================

describe("Channel CLI Commands", () => {
  let ctx: CliTestContext;

  beforeEach(() => {
    ctx = createCliTestContext(registerChannelCommand);
  });

  afterEach(() => {
    ctx.cleanup();
  });

  // ===========================================================================
  // channel types
  // ===========================================================================

  describe("channel types", () => {
    it("should list supported channel types", async () => {
      await ctx.run(["channel", "types"]);

      expect(ctx.console.hasLog("Supported Channel Types:")).toBe(true);
    });

    it("should output JSON when --json flag is provided", async () => {
      await ctx.run(["--json", "channel", "types"]);

      expect(ctx.console.hasLog('"success": true')).toBe(true);
      expect(ctx.console.hasLog('"types"')).toBe(true);
    });

    it("should include all supported channel types", async () => {
      const result = await ctx.runJson(["channel", "types"]);

      expect(result).toMatchObject({
        success: true,
        data: {
          types: expect.arrayContaining([
            expect.objectContaining({ id: "telegram" }),
            expect.objectContaining({ id: "discord" }),
            expect.objectContaining({ id: "feishu" }),
            expect.objectContaining({ id: "whatsapp" }),
            expect.objectContaining({ id: "slack" }),
            expect.objectContaining({ id: "webhook" }),
          ]),
        },
      });
    });
  });

  // ===========================================================================
  // channel list
  // ===========================================================================

  describe("channel list", () => {
    it("should list all configured channels", async () => {
      const mockChannels = [
        createMockChannel({ id: "my-telegram", name: "My Telegram", type: "telegram", is_default: true }),
        createMockChannel({ id: "my-discord", name: "My Discord", type: "discord" }),
      ];

      mockListChannels.mockResolvedValue(mockChannels);
      mockGetDefaultChannel.mockResolvedValue(mockChannels[0]);

      await ctx.run(["channel", "list"]);

      expect(mockListChannels).toHaveBeenCalled();
      expect(mockGetDefaultChannel).toHaveBeenCalled();
      expect(ctx.console.hasLog("Channels:")).toBe(true);
    });

    it("should show message when no channels exist", async () => {
      mockListChannels.mockResolvedValue([]);
      mockGetDefaultChannel.mockResolvedValue(undefined);

      await ctx.run(["channel", "list"]);

      expect(ctx.console.hasLog("No channels configured.")).toBe(true);
    });

    it("should output JSON when --json flag is provided", async () => {
      const mockChannels = [
        createMockChannel({ id: "my-telegram", is_default: true }),
      ];

      mockListChannels.mockResolvedValue(mockChannels);
      mockGetDefaultChannel.mockResolvedValue(mockChannels[0]);

      await ctx.run(["--json", "channel", "list"]);

      expect(ctx.console.hasLog('"success": true')).toBe(true);
      expect(ctx.console.hasLog('"channels"')).toBe(true);
    });

    it("should show default channel indicator", async () => {
      const mockChannels = [
        createMockChannel({ id: "my-telegram", is_default: true }),
      ];

      mockListChannels.mockResolvedValue(mockChannels);
      mockGetDefaultChannel.mockResolvedValue(mockChannels[0]);

      await ctx.run(["channel", "list"]);

      expect(ctx.console.hasLog("* = default channel")).toBe(true);
    });
  });

  // ===========================================================================
  // channel create <id>
  // ===========================================================================

  describe("channel create <id>", () => {
    it("should create a telegram channel", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        type: "telegram",
        config: { token: "test-token" },
      });

      mockCreateChannel.mockResolvedValue(mockChannel);

      await ctx.run([
        "channel", "create", "my-telegram",
        "--type", "telegram",
        "--token", "test-token",
      ]);

      expect(mockCreateChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "my-telegram",
          type: "telegram",
          token: "test-token",
        })
      );
      expect(ctx.console.hasLog('Channel "my-telegram" created successfully')).toBe(true);
    });

    it("should create a discord channel", async () => {
      mockCreateChannel.mockResolvedValue(createMockChannel({ id: "my-discord", type: "discord" }));

      await ctx.run([
        "channel", "create", "my-discord",
        "--type", "discord",
        "--token", "discord-token",
      ]);

      expect(mockCreateChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: "my-discord", type: "discord", token: "discord-token" })
      );
    });

    it("should create a feishu channel with app credentials", async () => {
      mockCreateChannel.mockResolvedValue(createMockChannel({ id: "my-feishu", type: "feishu" }));

      await ctx.run([
        "channel", "create", "my-feishu",
        "--type", "feishu",
        "--app-id", "cli_xxx",
        "--app-secret", "secret123",
      ]);

      expect(mockCreateChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: "my-feishu", type: "feishu", app_id: "cli_xxx", app_secret: "secret123" })
      );
    });

    it("should create a whatsapp channel with bridge URL", async () => {
      mockCreateChannel.mockResolvedValue(createMockChannel({ id: "my-whatsapp", type: "whatsapp" }));

      await ctx.run([
        "channel", "create", "my-whatsapp",
        "--type", "whatsapp",
        "--bridge-url", "ws://localhost:3001",
      ]);

      expect(mockCreateChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: "my-whatsapp", type: "whatsapp", bridge_url: "ws://localhost:3001" })
      );
    });

    it("should create a slack channel", async () => {
      mockCreateChannel.mockResolvedValue(createMockChannel({ id: "my-slack", type: "slack" }));

      await ctx.run([
        "channel", "create", "my-slack",
        "--type", "slack",
        "--token", "xoxb-slack-token",
      ]);

      expect(mockCreateChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: "my-slack", type: "slack", token: "xoxb-slack-token" })
      );
    });

    it("should create a webhook channel", async () => {
      mockCreateChannel.mockResolvedValue(createMockChannel({ id: "my-webhook", type: "webhook" }));

      await ctx.run([
        "channel", "create", "my-webhook",
        "--type", "webhook",
        "--url", "https://example.com/webhook",
      ]);

      expect(mockCreateChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: "my-webhook", type: "webhook", url: "https://example.com/webhook" })
      );
    });

    it("should create channel with custom name", async () => {
      mockCreateChannel.mockResolvedValue(createMockChannel({ id: "my-telegram", name: "Custom Name" }));

      await ctx.run([
        "channel", "create", "my-telegram",
        "--type", "telegram",
        "--token", "test-token",
        "--name", "Custom Name",
      ]);

      expect(mockCreateChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: "my-telegram", name: "Custom Name" })
      );
    });

    it("should create channel with --chat-id option", async () => {
      mockCreateChannel.mockResolvedValue(createMockChannel({ id: "my-telegram" }));

      await ctx.run([
        "channel", "create", "my-telegram",
        "--type", "telegram",
        "--token", "test-token",
        "--chat-id", "123456789",
      ]);

      expect(mockCreateChannel).toHaveBeenCalledWith(
        expect.objectContaining({ channel_id: "123456789" })
      );
    });

    it("should create channel as disabled with --disabled flag", async () => {
      mockCreateChannel.mockResolvedValue(createMockChannel({ id: "my-telegram", enabled: false }));

      await ctx.run([
        "channel", "create", "my-telegram",
        "--type", "telegram",
        "--token", "test-token",
        "--disabled",
      ]);

      expect(mockCreateChannel).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });

    it("should set as default with --set-default flag", async () => {
      mockCreateChannel.mockResolvedValue(createMockChannel({ id: "my-telegram", is_default: true }));

      await ctx.run([
        "channel", "create", "my-telegram",
        "--type", "telegram",
        "--token", "test-token",
        "--set-default",
      ]);

      expect(mockCreateChannel).toHaveBeenCalledWith(
        expect.objectContaining({ set_as_default: true })
      );
    });

    it("should create telegram channel with proxy option", async () => {
      mockCreateChannel.mockResolvedValue(createMockChannel({ id: "my-telegram" }));

      await ctx.run([
        "channel", "create", "my-telegram",
        "--type", "telegram",
        "--token", "test-token",
        "--proxy", "http://127.0.0.1:7890",
      ]);

      expect(mockCreateChannel).toHaveBeenCalledWith(
        expect.objectContaining({ proxy: "http://127.0.0.1:7890" })
      );
    });

    it("should reject invalid channel type", async () => {
      await expect(
        ctx.run([
          "channel", "create", "my-channel",
          "--type", "invalid_type",
          "--token", "test-token",
        ])
      ).rejects.toThrow();

      expect(ctx.console.hasError("Invalid channel type")).toBe(true);
    });

    it("should output JSON when --json flag is provided", async () => {
      mockCreateChannel.mockResolvedValue(createMockChannel({ id: "my-telegram" }));

      await ctx.run([
        "--json",
        "channel", "create", "my-telegram",
        "--type", "telegram",
        "--token", "test-token",
      ]);

      expect(ctx.console.hasLog('"success": true')).toBe(true);
      expect(ctx.console.hasLog('"channel"')).toBe(true);
    });
  });

  // ===========================================================================
  // channel remove
  // ===========================================================================

  describe("channel remove -n <id>", () => {
    it("should remove a channel", async () => {
      mockGetChannel.mockResolvedValue(createMockChannel({ id: "channel-to-remove" }));
      mockRemoveChannel.mockResolvedValue(undefined);

      await ctx.run(["channel", "remove", "-n", "channel-to-remove"]);

      expect(mockGetChannel).toHaveBeenCalledWith("channel-to-remove");
      expect(mockRemoveChannel).toHaveBeenCalledWith("channel-to-remove");
      expect(ctx.console.hasLog('Channel "channel-to-remove" removed successfully')).toBe(true);
    });

    it("should show error when channel not found", async () => {
      mockGetChannel.mockResolvedValue(undefined);

      await expect(ctx.run(["channel", "remove", "-n", "nonexistent"])).rejects.toThrow();

      expect(ctx.console.hasError("not found")).toBe(true);
    });

    it("should output JSON when --json flag is provided", async () => {
      mockGetChannel.mockResolvedValue(createMockChannel({ id: "channel-to-remove" }));
      mockRemoveChannel.mockResolvedValue(undefined);

      await ctx.run(["--json", "channel", "remove", "-n", "channel-to-remove"]);

      expect(ctx.console.hasLog('"success": true')).toBe(true);
      expect(ctx.console.hasLog('"removed"')).toBe(true);
    });
  });

  // ===========================================================================
  // channel enable
  // ===========================================================================

  describe("channel enable -n <id>", () => {
    it("should enable a channel", async () => {
      mockEnableChannel.mockResolvedValue(createMockChannel({ id: "my-channel", enabled: true }));

      await ctx.run(["channel", "enable", "-n", "my-channel"]);

      expect(mockEnableChannel).toHaveBeenCalledWith("my-channel");
      expect(ctx.console.hasLog('Channel "my-channel" enabled')).toBe(true);
    });

    it("should show error when channel not found", async () => {
      mockEnableChannel.mockRejectedValue(new Error('Channel "nonexistent" not found'));

      await expect(ctx.run(["channel", "enable", "-n", "nonexistent"])).rejects.toThrow();
    });

    it("should output JSON when --json flag is provided", async () => {
      mockEnableChannel.mockResolvedValue(createMockChannel({ id: "my-channel", enabled: true }));

      await ctx.run(["--json", "channel", "enable", "-n", "my-channel"]);

      expect(ctx.console.hasLog('"success": true')).toBe(true);
    });
  });

  // ===========================================================================
  // channel disable
  // ===========================================================================

  describe("channel disable -n <id>", () => {
    it("should disable a channel", async () => {
      mockDisableChannel.mockResolvedValue(createMockChannel({ id: "my-channel", enabled: false }));

      await ctx.run(["channel", "disable", "-n", "my-channel"]);

      expect(mockDisableChannel).toHaveBeenCalledWith("my-channel");
      expect(ctx.console.hasLog('Channel "my-channel" disabled')).toBe(true);
    });

    it("should show error when channel not found", async () => {
      mockDisableChannel.mockRejectedValue(new Error('Channel "nonexistent" not found'));

      await expect(ctx.run(["channel", "disable", "-n", "nonexistent"])).rejects.toThrow();
    });

    it("should output JSON when --json flag is provided", async () => {
      mockDisableChannel.mockResolvedValue(createMockChannel({ id: "my-channel", enabled: false }));

      await ctx.run(["--json", "channel", "disable", "-n", "my-channel"]);

      expect(ctx.console.hasLog('"success": true')).toBe(true);
    });
  });

  // ===========================================================================
  // channel set-default
  // ===========================================================================

  describe("channel set-default -n <id>", () => {
    it("should set default channel", async () => {
      mockSetDefaultChannel.mockResolvedValue(createMockChannel({ id: "my-channel", is_default: true }));

      await ctx.run(["channel", "set-default", "-n", "my-channel"]);

      expect(mockSetDefaultChannel).toHaveBeenCalledWith("my-channel");
      expect(ctx.console.hasLog('Channel "my-channel" set as default')).toBe(true);
    });

    it("should show error when channel not found", async () => {
      mockSetDefaultChannel.mockRejectedValue(new Error('Channel "nonexistent" not found'));

      await expect(ctx.run(["channel", "set-default", "-n", "nonexistent"])).rejects.toThrow();
    });

    it("should output JSON when --json flag is provided", async () => {
      mockSetDefaultChannel.mockResolvedValue(createMockChannel({ id: "my-channel", is_default: true }));

      await ctx.run(["--json", "channel", "set-default", "-n", "my-channel"]);

      expect(ctx.console.hasLog('"success": true')).toBe(true);
    });
  });

  // ===========================================================================
  // channel status
  // ===========================================================================

  describe("channel status", () => {
    describe("single channel status -n <id>", () => {
      it("should show connected status", async () => {
        mockGetChannelStatus.mockResolvedValue(
          createMockChannelStatus({ id: "my-channel", status: "connected" })
        );

        await ctx.run(["channel", "status", "-n", "my-channel"]);

        expect(mockGetChannelStatus).toHaveBeenCalledWith("my-channel");
        expect(ctx.console.hasLog("connected")).toBe(true);
      });

      it("should show disconnected status", async () => {
        mockGetChannelStatus.mockResolvedValue(
          createMockChannelStatus({ id: "my-channel", status: "disconnected" })
        );

        await ctx.run(["channel", "status", "-n", "my-channel"]);

        expect(ctx.console.hasLog("disconnected")).toBe(true);
      });

      it("should show error status with message", async () => {
        mockGetChannelStatus.mockResolvedValue(
          createMockChannelStatus({
            id: "my-channel",
            status: "error",
            error: "Invalid token",
          })
        );

        await ctx.run(["channel", "status", "-n", "my-channel"]);

        expect(ctx.console.hasLog("error")).toBe(true);
      });

      it("should output JSON when --json flag is provided", async () => {
        mockGetChannelStatus.mockResolvedValue(
          createMockChannelStatus({ id: "my-channel", status: "connected" })
        );

        await ctx.run(["--json", "channel", "status", "-n", "my-channel"]);

        expect(ctx.console.hasLog('"success": true')).toBe(true);
        expect(ctx.console.hasLog('"status"')).toBe(true);
      });
    });

    describe("all channels status", () => {
      it("should show status for all channels when no ID provided", async () => {
        mockGetAllChannelStatuses.mockResolvedValue([
          createMockChannelStatus({ id: "telegram-1", status: "connected" }),
          createMockChannelStatus({ id: "discord-1", status: "disconnected" }),
        ]);

        await ctx.run(["channel", "status"]);

        expect(mockGetAllChannelStatuses).toHaveBeenCalled();
        expect(ctx.console.hasLog("Channel Status:")).toBe(true);
      });

      it("should show message when no channels configured", async () => {
        mockGetAllChannelStatuses.mockResolvedValue([]);

        await ctx.run(["channel", "status"]);

        expect(ctx.console.hasLog("No channels configured.")).toBe(true);
      });

      it("should output JSON for all channels status", async () => {
        mockGetAllChannelStatuses.mockResolvedValue([
          createMockChannelStatus({ id: "telegram-1", status: "connected" }),
        ]);

        await ctx.run(["--json", "channel", "status"]);

        expect(ctx.console.hasLog('"success": true')).toBe(true);
        expect(ctx.console.hasLog('"statuses"')).toBe(true);
      });
    });
  });

  // ===========================================================================
  // channel config
  // ===========================================================================

  describe("channel config", () => {
    describe("show config -n <id>", () => {
      it("should show channel configuration", async () => {
        mockGetChannel.mockResolvedValue(createMockChannel({
          id: "my-telegram",
          type: "telegram",
          name: "My Telegram",
        }));

        await ctx.run(["channel", "config", "-n", "my-telegram"]);

        expect(mockGetChannel).toHaveBeenCalledWith("my-telegram");
        expect(ctx.console.hasLog("my-telegram")).toBe(true);
      });

      it("should show error when channel not found", async () => {
        mockGetChannel.mockResolvedValue(undefined);

        await expect(ctx.run(["channel", "config", "-n", "nonexistent"])).rejects.toThrow();

        expect(ctx.console.hasError("not found")).toBe(true);
      });

      it("should output JSON when --json flag is provided", async () => {
        mockGetChannel.mockResolvedValue(createMockChannel({ id: "my-telegram" }));

        await ctx.run(["--json", "channel", "config", "-n", "my-telegram"]);

        expect(ctx.console.hasLog('"success": true')).toBe(true);
        expect(ctx.console.hasLog('"config"')).toBe(true);
      });
    });

    describe("set config: channel config -n <id> set <key> <value>", () => {
      it("should update channel configuration", async () => {
        const mockChannel = createMockChannel({ id: "my-channel" });
        mockGetChannel.mockResolvedValue(mockChannel);
        mockUpdateChannelConfig.mockResolvedValue(mockChannel);

        // CLI uses positional args: channel config -n <id> set <key> <value>
        await ctx.run(["channel", "config", "-n", "my-channel", "set", "proxy", "http://127.0.0.1:7890"]);

        expect(mockUpdateChannelConfig).toHaveBeenCalledWith("my-channel", "proxy", "http://127.0.0.1:7890");
      });

      it("should update timeout configuration", async () => {
        const mockChannel = createMockChannel({ id: "my-channel" });
        mockGetChannel.mockResolvedValue(mockChannel);
        mockUpdateChannelConfig.mockResolvedValue(mockChannel);

        await ctx.run([
          "channel", "config", "-n", "my-channel",
          "set", "timeout", "30000",
        ]);

        expect(mockUpdateChannelConfig).toHaveBeenCalledWith("my-channel", "timeout", "30000");
      });

      it("should output JSON when --json flag is provided", async () => {
        const mockChannel = createMockChannel({ id: "my-channel" });
        mockGetChannel.mockResolvedValue(mockChannel);
        mockUpdateChannelConfig.mockResolvedValue(mockChannel);

        await ctx.run([
          "--json",
          "channel", "config", "-n", "my-channel",
          "set", "proxy", "http://127.0.0.1:7890",
        ]);

        expect(ctx.console.hasLog('"success": true')).toBe(true);
      });
    });
  });

  // ===========================================================================
  // channel test
  // ===========================================================================

  describe("channel test", () => {
    const buildMockConfig = (id: string): ChannelConfig => ({
      id,
      type: "telegram",
      name: "My Telegram",
      enabled: true,
      created_at: Date.now(),
      allow_from: [],
      token: "test-token",
    });

    it("should test a channel successfully", async () => {
      mockGetChannel.mockResolvedValue(createMockChannel({ id: "my-telegram" }));
      mockBuildChannelConfig.mockReturnValue(buildMockConfig("my-telegram"));
      mockTestChannel.mockResolvedValue({
        success: true,
        latency: 150,
        message: "Connection successful",
      });

      await ctx.run(["channel", "test", "my-telegram"]);

      expect(mockTestChannel).toHaveBeenCalled();
      expect(ctx.console.hasLog("test passed")).toBe(true);
    });

    it("should show error when channel not found", async () => {
      mockGetChannel.mockResolvedValue(undefined);

      await expect(ctx.run(["channel", "test", "nonexistent"])).rejects.toThrow();

      expect(ctx.console.hasError("not found")).toBe(true);
    });

    it("should show error when test fails", async () => {
      mockGetChannel.mockResolvedValue(createMockChannel({ id: "my-telegram" }));
      mockBuildChannelConfig.mockReturnValue(buildMockConfig("my-telegram"));
      mockTestChannel.mockResolvedValue({
        success: false,
        error: "Invalid token",
      });

      await expect(ctx.run(["channel", "test", "my-telegram"])).rejects.toThrow();

      expect(ctx.console.hasError("Invalid token")).toBe(true);
    });

    it("should output JSON when --json flag is provided", async () => {
      mockGetChannel.mockResolvedValue(createMockChannel({ id: "my-telegram" }));
      mockBuildChannelConfig.mockReturnValue(buildMockConfig("my-telegram"));
      mockTestChannel.mockResolvedValue({
        success: true,
        latency: 150,
      });

      await ctx.run(["--json", "channel", "test", "my-telegram"]);

      expect(ctx.console.hasLog('"success": true')).toBe(true);
    });

    describe("send test message with chat-id", () => {
      it("should send test message when chat-id provided", async () => {
        mockGetChannel.mockResolvedValue(createMockChannel({ id: "my-telegram" }));
        mockBuildChannelConfig.mockReturnValue(buildMockConfig("my-telegram"));
        // Must mock testChannel to succeed first (connectivity check)
        mockTestChannel.mockResolvedValue({
          success: true,
          latency: 150,
        });
        mockSendTestMessage.mockResolvedValue({
          success: true,
          messageId: "msg123",
        });

        await ctx.run(["channel", "test", "my-telegram", "chat123"]);

        expect(mockTestChannel).toHaveBeenCalled();
        expect(mockSendTestMessage).toHaveBeenCalled();
        expect(ctx.console.hasLog("Test message sent")).toBe(true);
      });

      it("should show error when send fails", async () => {
        mockGetChannel.mockResolvedValue(createMockChannel({ id: "my-telegram" }));
        mockBuildChannelConfig.mockReturnValue(buildMockConfig("my-telegram"));
        // Connectivity succeeds
        mockTestChannel.mockResolvedValue({
          success: true,
          latency: 150,
        });
        // But sending fails
        mockSendTestMessage.mockResolvedValue({
          success: false,
          error: "Chat not found",
        });

        await expect(ctx.run(["channel", "test", "my-telegram", "chat123"])).rejects.toThrow();

        expect(ctx.console.hasError("Chat not found")).toBe(true);
      });

      it("should output JSON when --json flag is provided", async () => {
        mockGetChannel.mockResolvedValue(createMockChannel({ id: "my-telegram" }));
        mockBuildChannelConfig.mockReturnValue(buildMockConfig("my-telegram"));
        mockTestChannel.mockResolvedValue({
          success: true,
          latency: 150,
        });
        mockSendTestMessage.mockResolvedValue({
          success: true,
          messageId: "msg123",
        });

        await ctx.run(["--json", "channel", "test", "my-telegram", "chat123"]);

        expect(ctx.console.hasLog('"success": true')).toBe(true);
      });
    });

    describe("error handling", () => {
      it("should handle connection timeout", async () => {
        mockGetChannel.mockResolvedValue(createMockChannel({ id: "my-telegram" }));
        mockBuildChannelConfig.mockReturnValue(buildMockConfig("my-telegram"));
        mockTestChannel.mockResolvedValue({
          success: false,
          error: "Connection timeout after 30s",
        });

        await expect(ctx.run(["channel", "test", "my-telegram"])).rejects.toThrow();

        expect(ctx.console.hasError("Connection timeout")).toBe(true);
      });

      it("should handle network error during test", async () => {
        mockGetChannel.mockResolvedValue(createMockChannel({ id: "my-telegram" }));
        mockBuildChannelConfig.mockReturnValue(buildMockConfig("my-telegram"));
        mockTestChannel.mockRejectedValue(new Error("Network error: ECONNREFUSED"));

        await expect(ctx.run(["channel", "test", "my-telegram"])).rejects.toThrow();
      });
    });
  });

  // ===========================================================================
  // YAML storage integration
  // ===========================================================================

  describe("YAML storage integration", () => {
    it("should store channels in ~/.viben/channels.yaml format", async () => {
      mockCreateChannel.mockResolvedValue(createMockChannel({
        id: "my-telegram",
        type: "telegram",
        config: { token: "encrypted:xxx" },
      }));

      await ctx.run([
        "channel", "create", "my-telegram",
        "--type", "telegram",
        "--token", "test-token",
      ]);

      expect(mockCreateChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "my-telegram",
          type: "telegram",
          token: "test-token",
        })
      );
    });
  });

  // ===========================================================================
  // Command options and aliases
  // ===========================================================================

  describe("command options and aliases", () => {
    it("should support --name as alias for -n in create (display name)", async () => {
      mockCreateChannel.mockResolvedValue(createMockChannel({ id: "my-telegram", name: "Custom Name" }));

      await ctx.run([
        "channel", "create", "my-telegram",
        "--type", "telegram",
        "--token", "test-token",
        "--name", "Custom Name",
      ]);

      expect(mockCreateChannel).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Custom Name" })
      );
    });

    it("should support -f as alias for --force in remove", async () => {
      mockGetChannel.mockResolvedValue(createMockChannel({ id: "channel-to-remove" }));
      mockRemoveChannel.mockResolvedValue(undefined);

      await ctx.run(["channel", "remove", "-n", "channel-to-remove", "-f"]);

      expect(mockRemoveChannel).toHaveBeenCalledWith("channel-to-remove");
    });

    it("should support --name as long form for -n in remove", async () => {
      mockGetChannel.mockResolvedValue(createMockChannel({ id: "channel-to-remove" }));
      mockRemoveChannel.mockResolvedValue(undefined);

      await ctx.run(["channel", "remove", "--name", "channel-to-remove"]);

      expect(mockRemoveChannel).toHaveBeenCalledWith("channel-to-remove");
    });

    it("should support --name as long form for -n in enable", async () => {
      mockEnableChannel.mockResolvedValue(createMockChannel({ id: "my-channel", enabled: true }));

      await ctx.run(["channel", "enable", "--name", "my-channel"]);

      expect(mockEnableChannel).toHaveBeenCalledWith("my-channel");
    });

    it("should support --name as long form for -n in disable", async () => {
      mockDisableChannel.mockResolvedValue(createMockChannel({ id: "my-channel", enabled: false }));

      await ctx.run(["channel", "disable", "--name", "my-channel"]);

      expect(mockDisableChannel).toHaveBeenCalledWith("my-channel");
    });

    it("should support --name as long form for -n in set-default", async () => {
      mockSetDefaultChannel.mockResolvedValue(createMockChannel({ id: "my-channel", is_default: true }));

      await ctx.run(["channel", "set-default", "--name", "my-channel"]);

      expect(mockSetDefaultChannel).toHaveBeenCalledWith("my-channel");
    });

    it("should support --name as long form for -n in status", async () => {
      mockGetChannelStatus.mockResolvedValue(createMockChannelStatus({ id: "my-channel", status: "connected" }));

      await ctx.run(["channel", "status", "--name", "my-channel"]);

      expect(mockGetChannelStatus).toHaveBeenCalledWith("my-channel");
    });

    it("should support --name as long form for -n in config", async () => {
      mockGetChannel.mockResolvedValue(createMockChannel({ id: "my-channel" }));

      await ctx.run(["channel", "config", "--name", "my-channel"]);

      expect(mockGetChannel).toHaveBeenCalledWith("my-channel");
    });
  });
});
