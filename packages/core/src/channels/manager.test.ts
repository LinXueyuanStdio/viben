/**
 * Channel Manager Tests
 *
 * Each test creates its own isolated manager instance to avoid state sharing.
 */
import { describe, it, expect, vi } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { ChannelManager } from "./manager";
import { NotFoundError, AlreadyExistsError, ValidationError } from "../error";

// Helper to create a unique temp directory for each test
async function createIsolatedManager() {
  const tempDir = await mkdtemp(join(tmpdir(), `viben-ch-${Date.now()}-`));
  const manager = new ChannelManager(join(tempDir, "channels.yaml"));
  await manager.load();
  return {
    manager,
    tempDir,
    cleanup: async () => {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    },
  };
}

describe("ChannelManager", () => {
  // ============================================================
  // Channel Types Tests
  // ============================================================

  it("getChannelTypes should return all supported channel types", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const types = manager.getChannelTypes();
      expect(types).toHaveLength(6);
      expect(types.map((t) => t.id)).toContain("telegram");
      expect(types.map((t) => t.id)).toContain("discord");
      expect(types.map((t) => t.id)).toContain("feishu");
      expect(types.map((t) => t.id)).toContain("whatsapp");
      expect(types.map((t) => t.id)).toContain("slack");
      expect(types.map((t) => t.id)).toContain("webhook");
    } finally {
      await cleanup();
    }
  });

  it("getChannelTypes should have name and description for each type", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const types = manager.getChannelTypes();
      for (const type of types) {
        expect(type.name).toBeDefined();
        expect(type.description).toBeDefined();
        expect(type.setupDifficulty).toBeDefined();
      }
    } finally {
      await cleanup();
    }
  });

  // ============================================================
  // Create Channel Tests
  // ============================================================

  it("createChannel should create a Telegram channel", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const channel = await manager.createChannel({
        name: "My Telegram",
        type: "telegram",
        token: "123456:ABC-DEF",
      });

      expect(channel.id).toBe("my-telegram");
      expect(channel.name).toBe("My Telegram");
      expect(channel.type).toBe("telegram");
      expect(channel.enabled).toBe(true);
      expect(channel.is_default).toBe(true);
      expect(channel.config.token).toBe("123456:ABC-DEF");
    } finally {
      await cleanup();
    }
  });

  it("createChannel should create a Discord channel", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const channel = await manager.createChannel({
        name: "My Discord",
        type: "discord",
        token: "discord-bot-token",
        intents: 37377,
      });

      expect(channel.type).toBe("discord");
      expect(channel.config.token).toBe("discord-bot-token");
      expect(channel.config.intents).toBe(37377);
    } finally {
      await cleanup();
    }
  });

  it("createChannel should create a Feishu channel", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const channel = await manager.createChannel({
        name: "My Feishu",
        type: "feishu",
        app_id: "cli_xxx",
        app_secret: "secret_xxx",
      });

      expect(channel.type).toBe("feishu");
      expect(channel.config.app_id).toBe("cli_xxx");
      expect(channel.config.app_secret).toBe("secret_xxx");
    } finally {
      await cleanup();
    }
  });

  it("createChannel should create a WhatsApp channel", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const channel = await manager.createChannel({
        name: "My WhatsApp",
        type: "whatsapp",
        bridge_url: "ws://localhost:3001",
      });

      expect(channel.type).toBe("whatsapp");
      expect(channel.config.bridge_url).toBe("ws://localhost:3001");
    } finally {
      await cleanup();
    }
  });

  it("createChannel should create a Slack channel", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const channel = await manager.createChannel({
        name: "My Slack",
        type: "slack",
        token: "xoxb-slack-token",
      });

      expect(channel.type).toBe("slack");
      expect(channel.config.token).toBe("xoxb-slack-token");
    } finally {
      await cleanup();
    }
  });

  it("createChannel should create a Webhook channel", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const channel = await manager.createChannel({
        name: "My Webhook",
        type: "webhook",
        url: "https://example.com/webhook",
        method: "POST",
        headers: { "X-Custom": "value" },
      });

      expect(channel.type).toBe("webhook");
      expect(channel.config.url).toBe("https://example.com/webhook");
      expect(channel.config.method).toBe("POST");
      expect(channel.config.headers).toEqual({ "X-Custom": "value" });
    } finally {
      await cleanup();
    }
  });

  it("createChannel should use custom ID if provided", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const channel = await manager.createChannel({
        id: "custom-id",
        name: "Custom Channel",
        type: "telegram",
        token: "test-token",
      });

      expect(channel.id).toBe("custom-id");
    } finally {
      await cleanup();
    }
  });

  it("createChannel should create disabled channel", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const channel = await manager.createChannel({
        name: "Disabled Channel",
        type: "telegram",
        token: "test-token",
        enabled: false,
      });

      expect(channel.enabled).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("createChannel should set allow_from list", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const channel = await manager.createChannel({
        name: "Restricted Channel",
        type: "telegram",
        token: "test-token",
        allow_from: ["123456789", "987654321"],
      });

      expect(channel.allow_from).toEqual(["123456789", "987654321"]);
    } finally {
      await cleanup();
    }
  });

  it("createChannel should throw error for duplicate ID", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "First",
        type: "telegram",
        token: "token1",
      });

      await expect(
        manager.createChannel({
          name: "First",
          type: "telegram",
          token: "token2",
        })
      ).rejects.toThrow(AlreadyExistsError);
    } finally {
      await cleanup();
    }
  });

  it("createChannel should throw validation error when Telegram token is missing", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await expect(
        manager.createChannel({
          name: "No Token",
          type: "telegram",
        })
      ).rejects.toThrow(ValidationError);
    } finally {
      await cleanup();
    }
  });

  it("createChannel should throw validation error when Feishu credentials are missing", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await expect(
        manager.createChannel({
          name: "No Credentials",
          type: "feishu",
          app_id: "cli_xxx",
        })
      ).rejects.toThrow(ValidationError);
    } finally {
      await cleanup();
    }
  });

  // ============================================================
  // List/Get Channels Tests
  // ============================================================

  it("listChannels should return empty array when no channels", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const channels = await manager.listChannels();
      expect(channels).toEqual([]);
    } finally {
      await cleanup();
    }
  });

  it("listChannels should list all created channels", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "Channel 1",
        type: "telegram",
        token: "token1",
      });
      await manager.createChannel({
        name: "Channel 2",
        type: "discord",
        token: "token2",
      });

      const channels = await manager.listChannels();
      expect(channels).toHaveLength(2);
    } finally {
      await cleanup();
    }
  });

  it("getChannel should get channel by ID", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "Test Channel",
        type: "telegram",
        token: "test-token",
      });

      const channel = await manager.getChannel("test-channel");
      expect(channel?.name).toBe("Test Channel");
    } finally {
      await cleanup();
    }
  });

  it("getChannel should return undefined for non-existent channel", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const channel = await manager.getChannel("non-existent");
      expect(channel).toBeUndefined();
    } finally {
      await cleanup();
    }
  });

  it("getDefaultChannel should return undefined when no channels exist", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const channel = await manager.getDefaultChannel();
      expect(channel).toBeUndefined();
    } finally {
      await cleanup();
    }
  });

  it("getDefaultChannel should return first channel as default", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "First",
        type: "telegram",
        token: "token1",
      });
      await manager.createChannel({
        name: "Second",
        type: "discord",
        token: "token2",
      });

      const defaultChannel = await manager.getDefaultChannel();
      expect(defaultChannel?.name).toBe("First");
    } finally {
      await cleanup();
    }
  });

  // ============================================================
  // Update Channel Tests
  // ============================================================

  it("updateChannel should update channel name", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "Original",
        type: "telegram",
        token: "test-token",
      });

      const updated = await manager.updateChannel("original", {
        name: "Updated Name",
      });

      expect(updated.name).toBe("Updated Name");
    } finally {
      await cleanup();
    }
  });

  it("updateChannel should update channel enabled status", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "Test",
        type: "telegram",
        token: "test-token",
      });

      const updated = await manager.updateChannel("test", {
        enabled: false,
      });

      expect(updated.enabled).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("updateChannel should update channel config fields", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "Test",
        type: "telegram",
        token: "old-token",
      });

      const updated = await manager.updateChannel("test", {
        token: "new-token",
        proxy: "http://proxy:8080",
      });

      expect(updated.config.token).toBe("new-token");
      expect(updated.config.proxy).toBe("http://proxy:8080");
    } finally {
      await cleanup();
    }
  });

  it("updateChannel should throw error for non-existent channel", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await expect(
        manager.updateChannel("non-existent", { name: "New Name" })
      ).rejects.toThrow(NotFoundError);
    } finally {
      await cleanup();
    }
  });

  it("updateChannel should set updated_at timestamp", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const created = await manager.createChannel({
        name: "Test",
        type: "telegram",
        token: "test-token",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await manager.updateChannel("test", {
        name: "Updated",
      });

      expect(updated.updated_at).toBeGreaterThan(created.created_at);
    } finally {
      await cleanup();
    }
  });

  // ============================================================
  // Remove Channel Tests
  // ============================================================

  it("removeChannel should remove a channel", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "To Remove",
        type: "telegram",
        token: "test-token",
      });

      await manager.removeChannel("to-remove");

      const channel = await manager.getChannel("to-remove");
      expect(channel).toBeUndefined();
    } finally {
      await cleanup();
    }
  });

  it("removeChannel should throw error for non-existent channel", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await expect(manager.removeChannel("non-existent")).rejects.toThrow(
        NotFoundError
      );
    } finally {
      await cleanup();
    }
  });

  it("removeChannel should update default when removing default channel", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "First",
        type: "telegram",
        token: "token1",
      });
      await manager.createChannel({
        name: "Second",
        type: "discord",
        token: "token2",
      });

      await manager.removeChannel("first");

      const defaultChannel = await manager.getDefaultChannel();
      expect(defaultChannel?.name).toBe("Second");
    } finally {
      await cleanup();
    }
  });

  it("removeChannel should clear default when removing last channel", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "Only",
        type: "telegram",
        token: "test-token",
      });

      await manager.removeChannel("only");

      const defaultChannel = await manager.getDefaultChannel();
      expect(defaultChannel).toBeUndefined();
    } finally {
      await cleanup();
    }
  });

  // ============================================================
  // Enable/Disable Channel Tests
  // ============================================================

  it("enableChannel should enable a disabled channel", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "Test",
        type: "telegram",
        token: "test-token",
        enabled: false,
      });

      const channel = await manager.enableChannel("test");
      expect(channel.enabled).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("disableChannel should disable an enabled channel", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "Test",
        type: "telegram",
        token: "test-token",
        enabled: true,
      });

      const channel = await manager.disableChannel("test");
      expect(channel.enabled).toBe(false);
    } finally {
      await cleanup();
    }
  });

  // ============================================================
  // Set Default Channel Tests
  // ============================================================

  it("setDefaultChannel should set a channel as default", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "First",
        type: "telegram",
        token: "token1",
      });
      await manager.createChannel({
        name: "Second",
        type: "discord",
        token: "token2",
      });

      const channel = await manager.setDefaultChannel("second");

      expect(channel.is_default).toBe(true);

      const defaultChannel = await manager.getDefaultChannel();
      expect(defaultChannel?.id).toBe("second");
    } finally {
      await cleanup();
    }
  });

  it("setDefaultChannel should throw error for non-existent channel", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await expect(manager.setDefaultChannel("non-existent")).rejects.toThrow(
        NotFoundError
      );
    } finally {
      await cleanup();
    }
  });

  it("setDefaultChannel should update is_default flag on other channels", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "First",
        type: "telegram",
        token: "token1",
      });
      await manager.createChannel({
        name: "Second",
        type: "discord",
        token: "token2",
      });

      await manager.setDefaultChannel("second");

      const first = await manager.getChannel("first");
      const second = await manager.getChannel("second");

      expect(first?.is_default).toBe(false);
      expect(second?.is_default).toBe(true);
    } finally {
      await cleanup();
    }
  });

  // ============================================================
  // Update Channel Config Tests
  // ============================================================

  it("updateChannelConfig should update a specific config key", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "Test",
        type: "telegram",
        token: "test-token",
      });

      const channel = await manager.updateChannelConfig(
        "test",
        "proxy",
        "http://proxy:8080"
      );

      expect(channel.config.proxy).toBe("http://proxy:8080");
    } finally {
      await cleanup();
    }
  });

  it("updateChannelConfig should update allow_from list", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "Test",
        type: "telegram",
        token: "test-token",
      });

      const channel = await manager.updateChannelConfig("test", "allow_from", [
        "123456",
      ]);

      expect(channel.allow_from).toEqual(["123456"]);
    } finally {
      await cleanup();
    }
  });

  it("updateChannelConfig should throw error for invalid config key", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "Test",
        type: "telegram",
        token: "test-token",
      });

      await expect(
        manager.updateChannelConfig("test", "invalid_key", "value")
      ).rejects.toThrow(ValidationError);
    } finally {
      await cleanup();
    }
  });

  it("updateChannelConfig should throw error for non-existent channel", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await expect(
        manager.updateChannelConfig("non-existent", "token", "value")
      ).rejects.toThrow(NotFoundError);
    } finally {
      await cleanup();
    }
  });

  // ============================================================
  // Channel Status Tests
  // ============================================================

  it("getChannelStatus should return disabled status for disabled channel", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "Test",
        type: "telegram",
        token: "test-token",
        enabled: false,
      });

      const status = await manager.getChannelStatus("test");

      expect(status.status).toBe("disabled");
      expect(status.enabled).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("getChannelStatus should throw error for non-existent channel", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await expect(manager.getChannelStatus("non-existent")).rejects.toThrow(
        NotFoundError
      );
    } finally {
      await cleanup();
    }
  });

  it("getChannelStatus should return error status when token is missing", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "Test",
        type: "telegram",
        token: "test-token",
      });

      await manager.updateChannelConfig("test", "token", "");

      const status = await manager.getChannelStatus("test");
      expect(status.status).toBe("error");
    } finally {
      await cleanup();
    }
  });

  it("getChannelStatus should include checked_at timestamp", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "Test",
        type: "telegram",
        token: "test-token",
        enabled: false,
      });

      const before = Date.now();
      const status = await manager.getChannelStatus("test");
      const after = Date.now();

      expect(status.checked_at).toBeGreaterThanOrEqual(before);
      expect(status.checked_at).toBeLessThanOrEqual(after);
    } finally {
      await cleanup();
    }
  });

  it("getChannelStatus should validate webhook URL format", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "Test Webhook",
        type: "webhook",
        url: "https://valid-url.com/webhook",
      });

      const status = await manager.getChannelStatus("test-webhook");
      expect(status.status).toBe("connected");
      expect(status.details).toContain("https://valid-url.com/webhook");
    } finally {
      await cleanup();
    }
  });

  it("getAllChannelStatuses should return status for all channels", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "Channel 1",
        type: "telegram",
        token: "token1",
        enabled: false,
      });
      await manager.createChannel({
        name: "Channel 2",
        type: "webhook",
        url: "https://example.com/webhook",
      });

      const statuses = await manager.getAllChannelStatuses();

      expect(statuses).toHaveLength(2);
      expect(statuses.find((s) => s.id === "channel-1")?.status).toBe(
        "disabled"
      );
      expect(statuses.find((s) => s.id === "channel-2")?.status).toBe(
        "connected"
      );
    } finally {
      await cleanup();
    }
  });

  it("getAllChannelStatuses should return empty array when no channels", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const statuses = await manager.getAllChannelStatuses();
      expect(statuses).toEqual([]);
    } finally {
      await cleanup();
    }
  });

  // ============================================================
  // Persistence Tests
  // ============================================================

  it("persistence should persist channels across manager instances", async () => {
    const { manager, tempDir, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "Persisted",
        type: "telegram",
        token: "test-token",
      });

      const newManager = new ChannelManager(join(tempDir, "channels.yaml"));
      await newManager.load();

      const channel = await newManager.getChannel("persisted");
      expect(channel?.name).toBe("Persisted");
    } finally {
      await cleanup();
    }
  });

  it("persistence should persist default channel setting", async () => {
    const { manager, tempDir, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "First",
        type: "telegram",
        token: "token1",
      });
      await manager.createChannel({
        name: "Second",
        type: "discord",
        token: "token2",
      });
      await manager.setDefaultChannel("second");

      const newManager = new ChannelManager(join(tempDir, "channels.yaml"));
      await newManager.load();

      const defaultChannel = await newManager.getDefaultChannel();
      expect(defaultChannel?.id).toBe("second");
    } finally {
      await cleanup();
    }
  });

  // ============================================================
  // Build Channel Config Tests
  // ============================================================

  it("buildChannelConfig should build TelegramChannelConfig", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const config = manager.buildChannelConfig("test", {
        type: "telegram",
        name: "Test",
        enabled: true,
        created_at: Date.now(),
        token: "test-token",
        proxy: "http://proxy:8080",
      });

      expect(config.type).toBe("telegram");
      if (config.type === "telegram") {
        expect(config.token).toBe("test-token");
        expect(config.proxy).toBe("http://proxy:8080");
      }
    } finally {
      await cleanup();
    }
  });

  it("buildChannelConfig should build WebhookChannelConfig with headers", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const config = manager.buildChannelConfig("webhook-test", {
        type: "webhook",
        name: "Webhook Test",
        enabled: true,
        created_at: Date.now(),
        url: "https://example.com",
        method: "PUT",
        headers: { Authorization: "Bearer token" },
      });

      expect(config.type).toBe("webhook");
      if (config.type === "webhook") {
        expect(config.url).toBe("https://example.com");
        expect(config.method).toBe("PUT");
        expect(config.headers).toEqual({ Authorization: "Bearer token" });
      }
    } finally {
      await cleanup();
    }
  });

  it("buildChannelConfig should build DiscordChannelConfig with intents", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const config = manager.buildChannelConfig("discord-test", {
        type: "discord",
        name: "Discord Test",
        enabled: true,
        created_at: Date.now(),
        token: "discord-token",
        intents: 37377,
      });

      expect(config.type).toBe("discord");
      if (config.type === "discord") {
        expect(config.token).toBe("discord-token");
        expect(config.intents).toBe(37377);
      }
    } finally {
      await cleanup();
    }
  });

  // ============================================================
  // Notification Mode Tests
  // ============================================================

  it("notification mode should default to none", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const channel = await manager.createChannel({
        name: "Test",
        type: "telegram",
        token: "test-token",
      });

      expect(channel.notification_mode).toBe("none");
    } finally {
      await cleanup();
    }
  });

  it("notification mode should set custom notification mode", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      const channel = await manager.createChannel({
        name: "Test",
        type: "telegram",
        token: "test-token",
        notification_mode: "both",
      });

      expect(channel.notification_mode).toBe("both");
    } finally {
      await cleanup();
    }
  });

  it("notification mode should update notification mode", async () => {
    const { manager, cleanup } = await createIsolatedManager();
    try {
      await manager.createChannel({
        name: "Test",
        type: "telegram",
        token: "test-token",
      });

      const updated = await manager.updateChannelConfig(
        "test",
        "notification_mode",
        "in_app"
      );

      expect(updated.notification_mode).toBe("in_app");
    } finally {
      await cleanup();
    }
  });
});
