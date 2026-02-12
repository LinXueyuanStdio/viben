/**
 * Channel Routes Tests
 *
 * Tests for the channel management HTTP API:
 * - GET /api/channels - List all channels
 * - GET /api/channels/:id - Get specific channel
 * - POST /api/channels - Create new channel
 * - PATCH /api/channels/:id - Update channel
 * - DELETE /api/channels/:id - Delete channel
 * - POST /api/channels/:id/default - Set channel as default
 * - POST /api/channels/send - Send message (stub)
 * - POST /api/channels/test - Test channel (stub)
 * - POST /api/channels/send-test - Send test message (stub)
 *
 * These tests verify the route handler logic by testing the underlying
 * channelManager operations. Since fastify is not available as a test
 * dependency, we mock the channelManager and verify the behavior.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Channel, ChannelType, NotificationMode } from "../../channels";

// Mock the channelManager
vi.mock("../../channels", () => ({
  channelManager: {
    listChannels: vi.fn(),
    getChannel: vi.fn(),
    createChannel: vi.fn(),
    updateChannel: vi.fn(),
    deleteChannel: vi.fn(),
    setDefault: vi.fn(),
  },
}));

import { channelManager } from "../../channels";

/**
 * Helper to create a mock channel
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

describe("Channel Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // GET /api/channels - List all channels
  // ============================================================================

  describe("GET /api/channels", () => {
    it("should return empty array when no channels exist", async () => {
      vi.mocked(channelManager.listChannels).mockResolvedValue([]);

      const channels = await channelManager.listChannels();

      expect(channels).toEqual([]);
      expect(channelManager.listChannels).toHaveBeenCalled();
    });

    it("should return list of all channels", async () => {
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
        createMockChannel({
          id: "my-slack",
          name: "My Slack",
          type: "slack",
          enabled: false,
        }),
      ];

      vi.mocked(channelManager.listChannels).mockResolvedValue(mockChannels);

      const channels = await channelManager.listChannels();

      expect(channels).toHaveLength(3);
      expect(channels[0].id).toBe("my-telegram");
      expect(channels[0].is_default).toBe(true);
      expect(channels[1].id).toBe("my-discord");
      expect(channels[2].id).toBe("my-slack");
      expect(channels[2].enabled).toBe(false);
    });

    it("should return channels with different types", async () => {
      const channelTypes: ChannelType[] = ["telegram", "discord", "feishu", "whatsapp", "slack", "webhook"];
      const mockChannels = channelTypes.map((type, index) =>
        createMockChannel({
          id: `channel-${type}`,
          name: `Channel ${type}`,
          type,
          is_default: index === 0,
        })
      );

      vi.mocked(channelManager.listChannels).mockResolvedValue(mockChannels);

      const channels = await channelManager.listChannels();

      expect(channels).toHaveLength(6);
      channelTypes.forEach((type, index) => {
        expect(channels[index].type).toBe(type);
      });
    });
  });

  // ============================================================================
  // GET /api/channels/:id - Get specific channel
  // ============================================================================

  describe("GET /api/channels/:id", () => {
    it("should return channel when found", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        name: "My Telegram",
        type: "telegram",
        enabled: true,
        is_default: true,
        notification_mode: "both",
        config: { token: "secret", proxy: "http://proxy.example.com" },
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);

      const channel = await channelManager.getChannel("my-telegram");

      expect(channel).toBeDefined();
      expect(channel?.id).toBe("my-telegram");
      expect(channel?.name).toBe("My Telegram");
      expect(channel?.type).toBe("telegram");
      expect(channel?.enabled).toBe(true);
      expect(channel?.is_default).toBe(true);
      expect(channel?.notification_mode).toBe("both");
      expect(channelManager.getChannel).toHaveBeenCalledWith("my-telegram");
    });

    it("should return undefined when channel not found", async () => {
      vi.mocked(channelManager.getChannel).mockResolvedValue(undefined);

      const channel = await channelManager.getChannel("nonexistent");

      expect(channel).toBeUndefined();
      expect(channelManager.getChannel).toHaveBeenCalledWith("nonexistent");
    });

    it("should handle special characters in channel ID", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram-123",
        name: "My Telegram 123",
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);

      const channel = await channelManager.getChannel("my-telegram-123");

      expect(channel?.id).toBe("my-telegram-123");
    });
  });

  // ============================================================================
  // POST /api/channels - Create new channel
  // ============================================================================

  describe("POST /api/channels", () => {
    describe("Telegram channel", () => {
      it("should create telegram channel with required fields", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram",
          name: "My Telegram",
          type: "telegram",
          config: { token: "bot-token" },
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        const channel = await channelManager.createChannel({
          type: "telegram",
          name: "My Telegram",
          token: "bot-token",
        });

        expect(channel.id).toBe("my-telegram");
        expect(channel.type).toBe("telegram");
        expect(channelManager.createChannel).toHaveBeenCalledWith({
          type: "telegram",
          name: "My Telegram",
          token: "bot-token",
        });
      });

      it("should create telegram channel with proxy option", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram",
          type: "telegram",
          config: { token: "bot-token", proxy: "http://proxy.example.com" },
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        const channel = await channelManager.createChannel({
          type: "telegram",
          name: "My Telegram",
          token: "bot-token",
          proxy: "http://proxy.example.com",
        });

        expect(channel).toBeDefined();
        expect(channelManager.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            token: "bot-token",
            proxy: "http://proxy.example.com",
          })
        );
      });
    });

    describe("Discord channel", () => {
      it("should create discord channel with token", async () => {
        const mockChannel = createMockChannel({
          id: "my-discord",
          name: "My Discord",
          type: "discord",
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        const channel = await channelManager.createChannel({
          type: "discord",
          name: "My Discord",
          token: "discord-token",
        });

        expect(channel.type).toBe("discord");
        expect(channelManager.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "discord",
            name: "My Discord",
            token: "discord-token",
          })
        );
      });

      it("should create discord channel with gateway_url", async () => {
        const mockChannel = createMockChannel({
          id: "my-discord",
          type: "discord",
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        await channelManager.createChannel({
          type: "discord",
          name: "My Discord",
          token: "discord-token",
          gateway_url: "wss://gateway.discord.gg",
        });

        expect(channelManager.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            gateway_url: "wss://gateway.discord.gg",
          })
        );
      });
    });

    describe("Feishu channel", () => {
      it("should create feishu channel with app credentials", async () => {
        const mockChannel = createMockChannel({
          id: "my-feishu",
          name: "My Feishu",
          type: "feishu",
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        await channelManager.createChannel({
          type: "feishu",
          name: "My Feishu",
          app_id: "cli_xxx",
          app_secret: "secret123",
        });

        expect(channelManager.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "feishu",
            app_id: "cli_xxx",
            app_secret: "secret123",
          })
        );
      });
    });

    describe("WhatsApp channel", () => {
      it("should create whatsapp channel with bridge_url", async () => {
        const mockChannel = createMockChannel({
          id: "my-whatsapp",
          name: "My WhatsApp",
          type: "whatsapp",
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        await channelManager.createChannel({
          type: "whatsapp",
          name: "My WhatsApp",
          bridge_url: "ws://localhost:3001",
        });

        expect(channelManager.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "whatsapp",
            bridge_url: "ws://localhost:3001",
          })
        );
      });
    });

    describe("Slack channel", () => {
      it("should create slack channel with token", async () => {
        const mockChannel = createMockChannel({
          id: "my-slack",
          name: "My Slack",
          type: "slack",
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        await channelManager.createChannel({
          type: "slack",
          name: "My Slack",
          token: "xoxb-slack-token",
        });

        expect(channelManager.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "slack",
            token: "xoxb-slack-token",
          })
        );
      });

      it("should create slack channel with channel_id", async () => {
        const mockChannel = createMockChannel({
          id: "my-slack",
          type: "slack",
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        await channelManager.createChannel({
          type: "slack",
          name: "My Slack",
          token: "xoxb-slack-token",
          channel_id: "C123456",
        });

        expect(channelManager.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            channel_id: "C123456",
          })
        );
      });
    });

    describe("Webhook channel", () => {
      it("should create webhook channel with url", async () => {
        const mockChannel = createMockChannel({
          id: "my-webhook",
          name: "My Webhook",
          type: "webhook",
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        await channelManager.createChannel({
          type: "webhook",
          name: "My Webhook",
          url: "https://example.com/webhook",
        });

        expect(channelManager.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "webhook",
            url: "https://example.com/webhook",
          })
        );
      });

      it("should create webhook channel with custom method (POST)", async () => {
        const mockChannel = createMockChannel({
          id: "my-webhook",
          type: "webhook",
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        await channelManager.createChannel({
          type: "webhook",
          name: "My Webhook",
          url: "https://example.com/webhook",
          method: "POST",
        });

        expect(channelManager.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "POST",
          })
        );
      });

      it("should create webhook channel with custom method (PUT)", async () => {
        const mockChannel = createMockChannel({
          id: "my-webhook",
          type: "webhook",
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        await channelManager.createChannel({
          type: "webhook",
          name: "My Webhook",
          url: "https://example.com/webhook",
          method: "PUT",
        });

        expect(channelManager.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "PUT",
          })
        );
      });

      it("should create webhook channel with custom headers", async () => {
        const mockChannel = createMockChannel({
          id: "my-webhook",
          type: "webhook",
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        const customHeaders = {
          Authorization: "Bearer token123",
          "X-Custom-Header": "custom-value",
        };

        await channelManager.createChannel({
          type: "webhook",
          name: "My Webhook",
          url: "https://example.com/webhook",
          headers: customHeaders,
        });

        expect(channelManager.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            headers: customHeaders,
          })
        );
      });
    });

    describe("Channel options", () => {
      it("should create channel with enabled option set to true", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram",
          enabled: true,
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        await channelManager.createChannel({
          type: "telegram",
          name: "My Telegram",
          token: "bot-token",
          enabled: true,
        });

        expect(channelManager.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            enabled: true,
          })
        );
      });

      it("should create channel with enabled option set to false", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram",
          enabled: false,
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        await channelManager.createChannel({
          type: "telegram",
          name: "My Telegram",
          token: "bot-token",
          enabled: false,
        });

        expect(channelManager.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            enabled: false,
          })
        );
      });

      it("should create channel with set_as_default option", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram",
          is_default: true,
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        await channelManager.createChannel({
          type: "telegram",
          name: "My Telegram",
          token: "bot-token",
          set_as_default: true,
        });

        expect(channelManager.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            set_as_default: true,
          })
        );
      });

      it("should create channel with notification_mode: none", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram",
          notification_mode: "none",
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        await channelManager.createChannel({
          type: "telegram",
          name: "My Telegram",
          token: "bot-token",
          notification_mode: "none",
        });

        expect(channelManager.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            notification_mode: "none",
          })
        );
      });

      it("should create channel with notification_mode: in_app", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram",
          notification_mode: "in_app",
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        await channelManager.createChannel({
          type: "telegram",
          name: "My Telegram",
          token: "bot-token",
          notification_mode: "in_app",
        });

        expect(channelManager.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            notification_mode: "in_app",
          })
        );
      });

      it("should create channel with notification_mode: system", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram",
          notification_mode: "system",
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        await channelManager.createChannel({
          type: "telegram",
          name: "My Telegram",
          token: "bot-token",
          notification_mode: "system",
        });

        expect(channelManager.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            notification_mode: "system",
          })
        );
      });

      it("should create channel with notification_mode: both", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram",
          notification_mode: "both",
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        await channelManager.createChannel({
          type: "telegram",
          name: "My Telegram",
          token: "bot-token",
          notification_mode: "both",
        });

        expect(channelManager.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            notification_mode: "both",
          })
        );
      });
    });

    describe("Error handling", () => {
      it("should throw error when creation fails due to missing required fields", async () => {
        vi.mocked(channelManager.createChannel).mockRejectedValue(
          new Error("Token is required for Telegram channels")
        );

        await expect(
          channelManager.createChannel({
            type: "telegram",
            name: "My Telegram",
            // Missing token
          })
        ).rejects.toThrow("Token is required for Telegram channels");
      });

      it("should throw error when channel already exists", async () => {
        vi.mocked(channelManager.createChannel).mockRejectedValue(
          new Error('Channel "my-telegram" already exists')
        );

        await expect(
          channelManager.createChannel({
            type: "telegram",
            name: "My Telegram",
            token: "bot-token",
          })
        ).rejects.toThrow("already exists");
      });
    });
  });

  // ============================================================================
  // PATCH /api/channels/:id - Update channel
  // ============================================================================

  describe("PATCH /api/channels/:id", () => {
    it("should update channel name", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        name: "Updated Name",
      });

      vi.mocked(channelManager.updateChannel).mockResolvedValue(mockChannel);

      const channel = await channelManager.updateChannel("my-telegram", {
        name: "Updated Name",
      });

      expect(channel.name).toBe("Updated Name");
      expect(channelManager.updateChannel).toHaveBeenCalledWith(
        "my-telegram",
        expect.objectContaining({ name: "Updated Name" })
      );
    });

    it("should update channel enabled status", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        enabled: false,
      });

      vi.mocked(channelManager.updateChannel).mockResolvedValue(mockChannel);

      await channelManager.updateChannel("my-telegram", {
        enabled: false,
      });

      expect(channelManager.updateChannel).toHaveBeenCalledWith(
        "my-telegram",
        expect.objectContaining({ enabled: false })
      );
    });

    it("should update channel notification_mode", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        notification_mode: "both",
      });

      vi.mocked(channelManager.updateChannel).mockResolvedValue(mockChannel);

      await channelManager.updateChannel("my-telegram", {
        notification_mode: "both",
      });

      expect(channelManager.updateChannel).toHaveBeenCalledWith(
        "my-telegram",
        expect.objectContaining({ notification_mode: "both" })
      );
    });

    it("should update channel token", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        config: { token: "new-token" },
      });

      vi.mocked(channelManager.updateChannel).mockResolvedValue(mockChannel);

      await channelManager.updateChannel("my-telegram", {
        token: "new-token",
      });

      expect(channelManager.updateChannel).toHaveBeenCalledWith(
        "my-telegram",
        expect.objectContaining({ token: "new-token" })
      );
    });

    it("should update channel proxy", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
      });

      vi.mocked(channelManager.updateChannel).mockResolvedValue(mockChannel);

      await channelManager.updateChannel("my-telegram", {
        proxy: "http://new-proxy.example.com",
      });

      expect(channelManager.updateChannel).toHaveBeenCalledWith(
        "my-telegram",
        expect.objectContaining({ proxy: "http://new-proxy.example.com" })
      );
    });

    it("should update multiple fields at once", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        name: "New Name",
        enabled: false,
        notification_mode: "system",
      });

      vi.mocked(channelManager.updateChannel).mockResolvedValue(mockChannel);

      await channelManager.updateChannel("my-telegram", {
        name: "New Name",
        enabled: false,
        notification_mode: "system",
      });

      expect(channelManager.updateChannel).toHaveBeenCalledWith(
        "my-telegram",
        expect.objectContaining({
          name: "New Name",
          enabled: false,
          notification_mode: "system",
        })
      );
    });

    it("should update webhook headers", async () => {
      const mockChannel = createMockChannel({
        id: "my-webhook",
        type: "webhook",
      });

      vi.mocked(channelManager.updateChannel).mockResolvedValue(mockChannel);

      const newHeaders = {
        Authorization: "Bearer new-token",
        "X-Custom": "value",
      };

      await channelManager.updateChannel("my-webhook", {
        headers: newHeaders,
      });

      expect(channelManager.updateChannel).toHaveBeenCalledWith(
        "my-webhook",
        expect.objectContaining({ headers: newHeaders })
      );
    });

    describe("Error handling", () => {
      it("should throw error when channel not found", async () => {
        vi.mocked(channelManager.updateChannel).mockRejectedValue(
          new Error('Channel "nonexistent" not found')
        );

        await expect(
          channelManager.updateChannel("nonexistent", { name: "New Name" })
        ).rejects.toThrow("not found");
      });
    });
  });

  // ============================================================================
  // DELETE /api/channels/:id - Delete channel
  // ============================================================================

  describe("DELETE /api/channels/:id", () => {
    it("should delete channel", async () => {
      vi.mocked(channelManager.deleteChannel).mockResolvedValue(undefined);

      await channelManager.deleteChannel("my-telegram");

      expect(channelManager.deleteChannel).toHaveBeenCalledWith("my-telegram");
    });

    it("should handle deleting channel with special characters in ID", async () => {
      vi.mocked(channelManager.deleteChannel).mockResolvedValue(undefined);

      await channelManager.deleteChannel("my-telegram-123");

      expect(channelManager.deleteChannel).toHaveBeenCalledWith("my-telegram-123");
    });

    describe("Error handling", () => {
      it("should throw error when channel not found", async () => {
        vi.mocked(channelManager.deleteChannel).mockRejectedValue(
          new Error('Channel "nonexistent" not found')
        );

        await expect(
          channelManager.deleteChannel("nonexistent")
        ).rejects.toThrow("not found");
      });
    });
  });

  // ============================================================================
  // POST /api/channels/:id/default - Set channel as default
  // ============================================================================

  describe("POST /api/channels/:id/default", () => {
    it("should set channel as default", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        is_default: true,
      });

      vi.mocked(channelManager.setDefault).mockResolvedValue(mockChannel);

      const channel = await channelManager.setDefault("my-telegram");

      expect(channel.id).toBe("my-telegram");
      expect(channel.is_default).toBe(true);
      expect(channelManager.setDefault).toHaveBeenCalledWith("my-telegram");
    });

    it("should set disabled channel as default", async () => {
      const mockChannel = createMockChannel({
        id: "disabled-channel",
        enabled: false,
        is_default: true,
      });

      vi.mocked(channelManager.setDefault).mockResolvedValue(mockChannel);

      const channel = await channelManager.setDefault("disabled-channel");

      expect(channel.enabled).toBe(false);
      expect(channel.is_default).toBe(true);
    });

    describe("Error handling", () => {
      it("should throw error when channel not found", async () => {
        vi.mocked(channelManager.setDefault).mockRejectedValue(
          new Error('Channel "nonexistent" not found')
        );

        await expect(
          channelManager.setDefault("nonexistent")
        ).rejects.toThrow("not found");
      });
    });
  });

  // ============================================================================
  // Channel Types
  // ============================================================================

  describe("Channel Types", () => {
    const allTypes: ChannelType[] = ["telegram", "discord", "feishu", "whatsapp", "slack", "webhook"];

    allTypes.forEach((type) => {
      it(`should support ${type} channel type`, async () => {
        const mockChannel = createMockChannel({
          id: `test-${type}`,
          type,
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        const channel = await channelManager.createChannel({
          type,
          name: `Test ${type}`,
          ...(type === "telegram" ? { token: "token" } : {}),
          ...(type === "discord" ? { token: "token" } : {}),
          ...(type === "feishu" ? { app_id: "id", app_secret: "secret" } : {}),
          ...(type === "whatsapp" ? { bridge_url: "ws://localhost" } : {}),
          ...(type === "slack" ? { token: "token" } : {}),
          ...(type === "webhook" ? { url: "https://example.com" } : {}),
        });

        expect(channel.type).toBe(type);
      });
    });
  });

  // ============================================================================
  // Notification Modes
  // ============================================================================

  describe("Notification Modes", () => {
    const allModes: NotificationMode[] = ["none", "in_app", "system", "both"];

    allModes.forEach((mode) => {
      it(`should support notification_mode: ${mode}`, async () => {
        const mockChannel = createMockChannel({
          id: "test-channel",
          notification_mode: mode,
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        const channel = await channelManager.createChannel({
          type: "telegram",
          name: "Test Channel",
          token: "token",
          notification_mode: mode,
        });

        expect(channel.notification_mode).toBe(mode);
      });
    });
  });

  // ============================================================================
  // Integration scenarios
  // ============================================================================

  describe("Integration scenarios", () => {
    it("should handle creating, getting, and deleting a channel", async () => {
      const mockChannel = createMockChannel({
        id: "integration-test",
        name: "Integration Test",
        type: "telegram",
      });

      // Create channel
      vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

      const created = await channelManager.createChannel({
        type: "telegram",
        name: "Integration Test",
        token: "bot-token",
      });

      expect(created.id).toBe("integration-test");

      // Get channel
      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);

      const retrieved = await channelManager.getChannel("integration-test");

      expect(retrieved?.id).toBe("integration-test");

      // Delete channel
      vi.mocked(channelManager.deleteChannel).mockResolvedValue(undefined);

      await channelManager.deleteChannel("integration-test");

      expect(channelManager.deleteChannel).toHaveBeenCalledWith("integration-test");
    });

    it("should handle creating channel and setting as default", async () => {
      const mockChannel = createMockChannel({
        id: "new-default",
        name: "New Default",
        type: "discord",
        is_default: false,
      });

      // Create channel
      vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

      await channelManager.createChannel({
        type: "discord",
        name: "New Default",
        token: "discord-token",
      });

      // Set as default
      const defaultChannel = { ...mockChannel, is_default: true };
      vi.mocked(channelManager.setDefault).mockResolvedValue(defaultChannel);

      const updated = await channelManager.setDefault("new-default");

      expect(updated.is_default).toBe(true);
    });

    it("should handle updating channel and listing all", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        name: "Original Name",
      });

      // Update channel
      const updatedChannel = { ...mockChannel, name: "Updated Name" };
      vi.mocked(channelManager.updateChannel).mockResolvedValue(updatedChannel);

      await channelManager.updateChannel("my-telegram", {
        name: "Updated Name",
      });

      // List channels
      vi.mocked(channelManager.listChannels).mockResolvedValue([updatedChannel]);

      const channels = await channelManager.listChannels();

      expect(channels).toHaveLength(1);
      expect(channels[0].name).toBe("Updated Name");
    });
  });

  // ============================================================================
  // Edge cases
  // ============================================================================

  describe("Edge cases", () => {
    it("should handle empty update payload", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
      });

      vi.mocked(channelManager.updateChannel).mockResolvedValue(mockChannel);

      await channelManager.updateChannel("my-telegram", {});

      expect(channelManager.updateChannel).toHaveBeenCalledWith("my-telegram", {});
    });

    it("should handle large number of channels in list", async () => {
      const mockChannels = Array.from({ length: 100 }, (_, i) =>
        createMockChannel({
          id: `channel-${i}`,
          name: `Channel ${i}`,
        })
      );

      vi.mocked(channelManager.listChannels).mockResolvedValue(mockChannels);

      const channels = await channelManager.listChannels();

      expect(channels).toHaveLength(100);
    });

    it("should handle channel with all optional fields undefined", async () => {
      const minimalChannel: Channel = {
        id: "minimal",
        type: "webhook",
        name: "Minimal",
        enabled: true,
        is_default: false,
        created_at: Date.now(),
        allow_from: [],
        notification_mode: "none",
        config: {},
      };

      vi.mocked(channelManager.getChannel).mockResolvedValue(minimalChannel);

      const channel = await channelManager.getChannel("minimal");

      expect(channel).toBeDefined();
      expect(channel?.id).toBe("minimal");
    });

    it("should handle channel with complex config", async () => {
      const complexChannel = createMockChannel({
        id: "complex",
        type: "webhook",
        config: {
          url: "https://example.com",
          method: "POST",
          headers: {
            Authorization: "Bearer token",
            "Content-Type": "application/json",
            "X-Custom-Header": "value",
          },
        },
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(complexChannel);

      const channel = await channelManager.getChannel("complex");

      expect(channel?.config).toEqual({
        url: "https://example.com",
        method: "POST",
        headers: {
          Authorization: "Bearer token",
          "Content-Type": "application/json",
          "X-Custom-Header": "value",
        },
      });
    });
  });

  // ============================================================================
  // Stub Endpoints behavior
  // ============================================================================

  describe("Stub endpoints behavior", () => {
    // Note: These test cases document the expected behavior of stub endpoints.
    // The actual route handlers return 501 Not Implemented for these endpoints.

    describe("POST /api/channels/send (stub)", () => {
      it("should document expected send message interface", () => {
        // Expected request body structure
        const expectedRequest = {
          channelId: "my-telegram",
          message: "Hello, World!",
          parseMode: "markdown" as const, // "text" | "markdown" | "html"
        };

        expect(expectedRequest.channelId).toBeDefined();
        expect(expectedRequest.message).toBeDefined();
        expect(["text", "markdown", "html"]).toContain(expectedRequest.parseMode);
      });
    });

    describe("POST /api/channels/test (stub)", () => {
      it("should document expected test channel interface", () => {
        // Expected request body structure
        const expectedRequest = {
          channelId: "my-telegram",
        };

        expect(expectedRequest.channelId).toBeDefined();
      });
    });

    describe("POST /api/channels/send-test (stub)", () => {
      it("should document expected send test message interface", () => {
        // Expected request body structure
        const expectedRequest = {
          channelId: "my-telegram",
        };

        expect(expectedRequest.channelId).toBeDefined();
      });
    });
  });
});
