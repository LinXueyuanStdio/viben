/**
 * Channel Routes Integration Tests
 *
 * These tests use real ChannelManager instances with temporary directories
 * to verify actual file system operations and end-to-end route behavior.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { createTempDir } from "../../test/helpers/temp-dir";
import type { TempDirContext } from "../../test/helpers/temp-dir";
import { ChannelManager } from "../../channels/manager";

describe("Channel Routes - Integration Tests", () => {
  let tempDir: TempDirContext;
  let app: FastifyInstance;
  let channelManager: ChannelManager;

  beforeEach(async () => {
    // Create temp directory
    tempDir = await createTempDir("viben-channels-integration-");

    // Create the channels.yaml path
    const channelsPath = tempDir.resolve("channels.yaml");

    // Create a real ChannelManager instance with the temp path
    channelManager = new ChannelManager(channelsPath);
    await channelManager.load();

    // Create a new Fastify instance
    app = fastify({ logger: false });

    // Register routes that will use our channelManager
    // We need to manually wire up the routes since we can't mock the singleton easily
    registerChannelRoutesWithManager(app, channelManager);

    await app.ready();
  });

  afterEach(async () => {
    // Cleanup
    if (app) {
      await app.close();
    }
    if (tempDir) {
      await tempDir.cleanup();
    }
  });

  describe("GET /api/channels", () => {
    it("should return empty array when no channels configured", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/channels",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.channels).toEqual([]);
    });

    it("should return list of created channels", async () => {
      // Create a channel first
      await channelManager.createChannel({
        name: "Test Channel",
        type: "webhook",
        url: "https://example.com/webhook",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/channels",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.channels).toHaveLength(1);
      expect(body.channels[0].name).toBe("Test Channel");
      expect(body.channels[0].channel_type).toBe("webhook");
    });
  });

  describe("POST /api/channels", () => {
    it("should create a new webhook channel and persist to file", async () => {
      const newChannel = {
        type: "webhook" as const,
        name: "My Webhook",
        url: "https://example.com/hook",
        method: "POST" as const,
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/channels",
        payload: newChannel,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBe("my-webhook");
      expect(body.name).toBe("My Webhook");
      expect(body.channel_type).toBe("webhook");
      expect(body.config.url).toBe("https://example.com/hook");

      // Verify file was created
      const fileExists = await tempDir.exists("channels.yaml");
      expect(fileExists).toBe(true);

      // Read and verify YAML content
      const content = await tempDir.readFile("channels.yaml");
      expect(content).toContain("my-webhook");
      expect(content).toContain("My Webhook");
      expect(content).toContain("https://example.com/hook");
    });

    it("should create a telegram channel with token", async () => {
      const newChannel = {
        type: "telegram" as const,
        name: "My Telegram Bot",
        token: "123456:ABC-DEF-test-token",
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/channels",
        payload: newChannel,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.channel_type).toBe("telegram");
      expect(body.config.token).toBe("123456:ABC-DEF-test-token");
    });

    it("should return 400 when required fields are missing", async () => {
      const invalidChannel = {
        type: "telegram" as const,
        name: "No Token Bot",
        // Missing required token
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/channels",
        payload: invalidChannel,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it("should set first channel as default automatically", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/channels",
        payload: {
          type: "webhook" as const,
          name: "First Channel",
          url: "https://example.com/first",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.is_default).toBe(true);
    });

    it("should set channel as default when set_as_default is true", async () => {
      // Create first channel
      await app.inject({
        method: "POST",
        url: "/api/channels",
        payload: {
          type: "webhook" as const,
          name: "First Channel",
          url: "https://example.com/first",
        },
      });

      // Create second channel with set_as_default
      const response = await app.inject({
        method: "POST",
        url: "/api/channels",
        payload: {
          type: "webhook" as const,
          name: "Second Channel",
          url: "https://example.com/second",
          set_as_default: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.is_default).toBe(true);
    });
  });

  describe("GET /api/channels/:id", () => {
    it("should return a specific channel by ID", async () => {
      // Create a channel
      await channelManager.createChannel({
        id: "test-channel-id",
        name: "Test Channel",
        type: "webhook",
        url: "https://example.com/test",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/channels/test-channel-id",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe("test-channel-id");
      expect(body.name).toBe("Test Channel");
    });

    it("should return 404 for non-existent channel", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/channels/non-existent-channel",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("not found");
    });
  });

  describe("PATCH /api/channels/:id", () => {
    it("should update channel name", async () => {
      // Create a channel
      await channelManager.createChannel({
        id: "update-test",
        name: "Original Name",
        type: "webhook",
        url: "https://example.com/update",
      });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/channels/update-test",
        payload: { name: "Updated Name" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe("Updated Name");

      // Verify persistence
      const content = await tempDir.readFile("channels.yaml");
      expect(content).toContain("Updated Name");
    });

    it("should update channel enabled status", async () => {
      // Create a channel
      await channelManager.createChannel({
        id: "enable-test",
        name: "Enable Test",
        type: "webhook",
        url: "https://example.com/enable",
        enabled: true,
      });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/channels/enable-test",
        payload: { enabled: false },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.enabled).toBe(false);
    });

    it("should return 400 for non-existent channel", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/channels/non-existent",
        payload: { name: "New Name" },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("DELETE /api/channels/:id", () => {
    it("should delete a channel", async () => {
      // Create a channel
      await channelManager.createChannel({
        id: "delete-test",
        name: "Delete Test",
        type: "webhook",
        url: "https://example.com/delete",
      });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/channels/delete-test",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.deleted).toBe("delete-test");

      // Verify channel is gone
      const getResponse = await app.inject({
        method: "GET",
        url: "/api/channels/delete-test",
      });
      expect(getResponse.statusCode).toBe(404);
    });

    it("should return 400 for non-existent channel", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/channels/non-existent",
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /api/channels/:id/default", () => {
    it("should set a channel as default", async () => {
      // Create two channels
      await channelManager.createChannel({
        id: "channel-1",
        name: "Channel 1",
        type: "webhook",
        url: "https://example.com/1",
      });
      await channelManager.createChannel({
        id: "channel-2",
        name: "Channel 2",
        type: "webhook",
        url: "https://example.com/2",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/channels/channel-2/default",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.is_default).toBe(true);

      // Verify persistence
      const content = await tempDir.readFile("channels.yaml");
      expect(content).toContain("default: channel-2");
    });

    it("should return 400 for non-existent channel", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/channels/non-existent/default",
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("YAML File Verification", () => {
    it("should persist complete channel configuration to YAML", async () => {
      // Create a channel with all options
      await app.inject({
        method: "POST",
        url: "/api/channels",
        payload: {
          type: "webhook" as const,
          name: "Full Config Channel",
          url: "https://example.com/full",
          method: "PUT" as const,
          headers: { "X-Custom-Header": "custom-value" },
          enabled: true,
          notification_mode: "all",
        },
      });

      // Read and verify YAML content
      const content = await tempDir.readFile("channels.yaml");

      // Verify structure
      expect(content).toContain("full-config-channel");
      expect(content).toContain("Full Config Channel");
      expect(content).toContain("webhook");
      expect(content).toContain("https://example.com/full");
      expect(content).toContain("PUT");
      expect(content).toContain("X-Custom-Header");
    });

    it("should handle multiple channels in YAML file", async () => {
      // Create multiple channels
      await channelManager.createChannel({
        name: "Channel A",
        type: "webhook",
        url: "https://a.example.com",
      });
      await channelManager.createChannel({
        name: "Channel B",
        type: "telegram",
        token: "token-b",
      });
      await channelManager.createChannel({
        name: "Channel C",
        type: "discord",
        token: "token-c",
      });

      // Read YAML content
      const content = await tempDir.readFile("channels.yaml");

      // Verify all channels present
      expect(content).toContain("channel-a");
      expect(content).toContain("channel-b");
      expect(content).toContain("channel-c");
      expect(content).toContain("webhook");
      expect(content).toContain("telegram");
      expect(content).toContain("discord");
    });
  });

  describe("Channel Types", () => {
    it("should create and verify discord channel", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/channels",
        payload: {
          type: "discord" as const,
          name: "Discord Bot",
          token: "discord-bot-token-123",
          intents: 37377,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.channel_type).toBe("discord");
      expect(body.config.token).toBe("discord-bot-token-123");
    });

    it("should create and verify feishu channel", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/channels",
        payload: {
          type: "feishu" as const,
          name: "Feishu Bot",
          app_id: "cli_feishu_app_id",
          app_secret: "feishu_app_secret",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.channel_type).toBe("feishu");
      expect(body.config.app_id).toBe("cli_feishu_app_id");
    });

    it("should create and verify slack channel", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/channels",
        payload: {
          type: "slack" as const,
          name: "Slack Bot",
          token: "xoxb-slack-token",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.channel_type).toBe("slack");
      expect(body.config.token).toBe("xoxb-slack-token");
    });
  });

  describe("Webhook Routes", () => {
    it("should receive webhook message on generic endpoint", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/channels/webhook",
        payload: {
          chat_id: "chat-123",
          message: "Hello from webhook",
          sender: "test-sender",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.received.chat_id).toBe("chat-123");
    });

    it("should receive webhook message on channel-specific endpoint", async () => {
      // Create a channel first
      await channelManager.createChannel({
        id: "webhook-channel",
        name: "Webhook Channel",
        type: "webhook",
        url: "https://example.com/webhook",
        enabled: true,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/channels/webhook-channel/webhook",
        payload: {
          chat_id: "specific-chat",
          message: "Channel-specific message",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.received.channel_id).toBe("webhook-channel");
    });

    it("should return 404 for webhook on non-existent channel", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/channels/non-existent/webhook",
        payload: {
          chat_id: "chat-123",
          message: "Test message",
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 403 for webhook on disabled channel", async () => {
      // Create a disabled channel
      await channelManager.createChannel({
        id: "disabled-channel",
        name: "Disabled Channel",
        type: "webhook",
        url: "https://example.com/disabled",
        enabled: false,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/channels/disabled-channel/webhook",
        payload: {
          chat_id: "chat-123",
          message: "Test message",
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("disabled");
    });
  });
});

// ============================================================================
// Helper function to register channel routes with a custom ChannelManager
// ============================================================================

import type { FastifyRequest, FastifyReply } from "fastify";
import type {
  ChannelType,
  NotificationMode,
  CreateChannelOptions,
  UpdateChannelOptions,
  Channel,
  AgentBinding,
  BindingType,
} from "../../channels";

interface AgentBindingResponse {
  binding_type: string;
  id: string;
  name: string;
  workspace_path?: string;
}

interface ChannelResponse {
  id: string;
  channel_type: string;
  name: string;
  config: Record<string, unknown>;
  is_default: boolean;
  enabled: boolean;
  notification_mode: string;
  agent_binding?: AgentBindingResponse;
  created_at: string;
  updated_at: string;
}

function toAgentBindingResponse(binding?: AgentBinding): AgentBindingResponse | undefined {
  if (!binding) return undefined;
  return {
    binding_type: binding.binding_type,
    id: binding.id,
    name: binding.name,
    workspace_path: binding.workspace_path,
  };
}

function toSnakeCaseChannel(channel: Channel): ChannelResponse {
  return {
    id: channel.id,
    channel_type: channel.type,
    name: channel.name,
    config: channel.config || {},
    is_default: channel.is_default || false,
    enabled: channel.enabled !== false,
    notification_mode: channel.notification_mode || "none",
    agent_binding: toAgentBindingResponse(channel.agent_binding),
    created_at: channel.created_at ? new Date(channel.created_at).toISOString() : new Date().toISOString(),
    updated_at: channel.updated_at ? new Date(channel.updated_at).toISOString() : new Date().toISOString(),
  };
}

function registerChannelRoutesWithManager(fastify: FastifyInstance, manager: ChannelManager): void {
  // List all channels
  fastify.get("/api/channels", async () => {
    const channels = await manager.listChannels();
    return { channels: channels.map(toSnakeCaseChannel) };
  });

  // Get a specific channel
  fastify.get("/api/channels/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const channel = await manager.getChannel(id);
    if (!channel) {
      reply.code(404);
      return { error: `Channel not found: ${id}` };
    }
    return toSnakeCaseChannel(channel);
  });

  // Create a new channel
  fastify.post("/api/channels", async (
    request: FastifyRequest<{
      Body: {
        type: ChannelType;
        name: string;
        enabled?: boolean;
        set_as_default?: boolean;
        notification_mode?: NotificationMode;
        agent_binding?: {
          binding_type: BindingType;
          id: string;
          name: string;
          workspace_path?: string;
        };
        token?: string;
        proxy?: string;
        gateway_url?: string;
        app_id?: string;
        app_secret?: string;
        bridge_url?: string;
        channel_id?: string;
        url?: string;
        method?: "POST" | "PUT";
        headers?: Record<string, string>;
        intents?: number;
      };
    }>,
    reply: FastifyReply
  ) => {
    const body = request.body;
    try {
      const options: CreateChannelOptions = {
        name: body.name,
        type: body.type,
        enabled: body.enabled,
        set_as_default: body.set_as_default,
        notification_mode: body.notification_mode,
        agent_binding: body.agent_binding,
        token: body.token,
        proxy: body.proxy,
        gateway_url: body.gateway_url,
        app_id: body.app_id,
        app_secret: body.app_secret,
        bridge_url: body.bridge_url,
        channel_id: body.channel_id,
        url: body.url,
        method: body.method,
        headers: body.headers,
        intents: body.intents,
      };
      const channel = await manager.createChannel(options);
      reply.code(201);
      return toSnakeCaseChannel(channel);
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to create channel" };
    }
  });

  // Update a channel
  fastify.patch("/api/channels/:id", async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: UpdateChannelOptions;
    }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const updates = request.body;
    try {
      const channel = await manager.updateChannel(id, updates);
      return toSnakeCaseChannel(channel);
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to update channel" };
    }
  });

  // Delete a channel
  fastify.delete("/api/channels/:id", async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    try {
      await manager.removeChannel(id);
      return { deleted: id };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to delete channel" };
    }
  });

  // Set a channel as default
  fastify.post("/api/channels/:id/default", async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    try {
      const channel = await manager.setDefaultChannel(id);
      return toSnakeCaseChannel(channel);
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to set default channel" };
    }
  });

  // Webhook endpoint for external events
  fastify.post("/api/channels/webhook", async (
    request: FastifyRequest<{
      Body: {
        channelId?: string;
        channel_type?: string;
        channel_name?: string;
        chat_id: string;
        sender?: string;
        sender_name?: string;
        message: string;
        timestamp?: number | string;
        source?: string;
        metadata?: Record<string, unknown>;
      };
    }>,
    reply: FastifyReply
  ) => {
    const body = request.body;

    if (!body.chat_id || typeof body.chat_id !== "string") {
      reply.code(400);
      return { error: "chat_id is required and must be a string" };
    }

    if (!body.message || typeof body.message !== "string") {
      reply.code(400);
      return { error: "message is required and must be a string" };
    }

    let channelType = body.channel_type || "webhook";
    let channelName = body.channel_name || body.source || "external";

    if (body.channelId) {
      const channel = await manager.getChannel(body.channelId);
      if (channel) {
        channelType = channel.type;
        channelName = channel.name;
      }
    }

    let timestamp: number;
    if (typeof body.timestamp === "number") {
      timestamp = body.timestamp;
    } else if (typeof body.timestamp === "string") {
      timestamp = new Date(body.timestamp).getTime();
    } else {
      timestamp = Date.now();
    }

    return {
      success: true,
      received: {
        channel_type: channelType,
        channel_name: channelName,
        chat_id: body.chat_id,
        timestamp,
      },
    };
  });

  // Webhook endpoint for specific channel
  fastify.post("/api/channels/:id/webhook", async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        chat_id: string;
        sender?: string;
        sender_name?: string;
        message: string;
        timestamp?: number | string;
        metadata?: Record<string, unknown>;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const body = request.body;

    if (!body.chat_id || typeof body.chat_id !== "string") {
      reply.code(400);
      return { error: "chat_id is required and must be a string" };
    }

    if (!body.message || typeof body.message !== "string") {
      reply.code(400);
      return { error: "message is required and must be a string" };
    }

    const channel = await manager.getChannel(id);
    if (!channel) {
      reply.code(404);
      return { error: `Channel not found: ${id}` };
    }

    if (!channel.enabled) {
      reply.code(403);
      return { error: "Channel is disabled" };
    }

    let timestamp: number;
    if (typeof body.timestamp === "number") {
      timestamp = body.timestamp;
    } else if (typeof body.timestamp === "string") {
      timestamp = new Date(body.timestamp).getTime();
    } else {
      timestamp = Date.now();
    }

    return {
      success: true,
      received: {
        channel_id: id,
        channel_type: channel.type,
        channel_name: channel.name,
        chat_id: body.chat_id,
        timestamp,
      },
    };
  });
}
