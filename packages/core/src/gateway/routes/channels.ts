/**
 * Channel routes
 *
 * Provides HTTP API for:
 * - Channel instance CRUD (stored in ~/.viben/channels.yaml)
 * - Sending messages through channels
 * - Testing channel configurations
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  channelManager,
  sendChannelMessage,
  testChannel,
  sendTestMessage,
} from "../../channels";
import type {
  ChannelType,
  NotificationMode,
  CreateChannelOptions,
  UpdateChannelOptions,
  Channel,
  ChannelConfig,
  AgentBinding,
  BindingType,
} from "../../channels";

// ============================================================================
// Response Types (snake_case to match Rust gateway)
// ============================================================================

/**
 * Agent binding response (snake_case for API)
 */
interface AgentBindingResponse {
  binding_type: string;
  id: string;
  name: string;
  workspace_path?: string;
}

/**
 * Channel response (snake_case to match Rust gateway)
 */
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

/**
 * Transform AgentBinding to API response format
 */
function toAgentBindingResponse(binding?: AgentBinding): AgentBindingResponse | undefined {
  if (!binding) return undefined;
  return {
    binding_type: binding.binding_type,
    id: binding.id,
    name: binding.name,
    workspace_path: binding.workspace_path,
  };
}

/**
 * Transform channel to API response format
 * Note: Channel interface already uses snake_case internally
 */
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

/**
 * Register channel routes
 */
export function registerChannelRoutes(fastify: FastifyInstance): void {
  // List all channels
  fastify.get("/api/channels", async () => {
    const channels = await channelManager.listChannels();
    return { channels: channels.map(toSnakeCaseChannel) };
  });

  // Get a specific channel
  fastify.get("/api/channels/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const channel = await channelManager.getChannel(id);
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
      };
      const channel = await channelManager.createChannel(options);
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
      const channel = await channelManager.updateChannel(id, updates);
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
      await channelManager.removeChannel(id);
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
      const channel = await channelManager.setDefaultChannel(id);
      return toSnakeCaseChannel(channel);
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to set default channel" };
    }
  });

  // Send a message through a channel
  fastify.post("/api/channels/send", async (
    request: FastifyRequest<{
      Body: {
        channelId: string;
        chatId: string;
        message: string;
        parseMode?: "text" | "markdown" | "html";
      };
    }>,
    reply: FastifyReply
  ) => {
    const { channelId, chatId, message, parseMode } = request.body;

    if (!channelId || !chatId || !message) {
      reply.code(400);
      return { error: "channelId, chatId, and message are required" };
    }

    try {
      // Get channel
      const channel = await channelManager.getChannel(channelId);
      if (!channel) {
        reply.code(404);
        return { error: `Channel not found: ${channelId}` };
      }

      // Get channel entry for config building
      await channelManager.load();
      const entry = (await channelManager.listChannels()).find(c => c.id === channelId);
      if (!entry) {
        reply.code(404);
        return { error: `Channel not found: ${channelId}` };
      }

      // Build channel config and send message
      const config = channelManager.buildChannelConfig(channelId, {
        type: channel.type,
        name: channel.name,
        enabled: channel.enabled,
        created_at: channel.created_at,
        allow_from: channel.allow_from,
        ...channel.config,
      });

      const result = await sendChannelMessage(config, {
        chatId,
        message,
        parseMode,
      });

      if (result.success) {
        return {
          success: true,
          message_id: result.messageId,
        };
      } else {
        reply.code(400);
        return { error: result.error || "Failed to send message" };
      }
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to send message" };
    }
  });

  // Test a channel configuration (matches Rust gateway API)
  fastify.post("/api/channels/test", async (
    request: FastifyRequest<{
      Body: {
        channel_type: ChannelType;
        config: {
          type: string;
          token?: string;
          proxy?: string;
          app_id?: string;
          app_secret?: string;
          bridge_url?: string;
          url?: string;
          method?: string;
          headers?: Record<string, string>;
        };
      };
    }>,
    reply: FastifyReply
  ) => {
    const { channel_type, config } = request.body;

    if (!channel_type || !config) {
      reply.code(400);
      return { error: "channel_type and config are required" };
    }

    try {
      // Build channel config based on type
      const baseConfig = {
        id: "",
        name: "",
        enabled: true,
        created_at: Date.now(),
        allow_from: [] as string[],
      };

      let channelConfig: ChannelConfig;

      switch (channel_type) {
        case "telegram":
          channelConfig = {
            ...baseConfig,
            type: "telegram" as const,
            token: config.token || "",
            proxy: config.proxy,
          };
          break;
        case "discord":
          channelConfig = {
            ...baseConfig,
            type: "discord" as const,
            token: config.token || "",
          };
          break;
        case "feishu":
          channelConfig = {
            ...baseConfig,
            type: "feishu" as const,
            app_id: config.app_id || "",
            app_secret: config.app_secret || "",
          };
          break;
        case "whatsapp":
          channelConfig = {
            ...baseConfig,
            type: "whatsapp" as const,
            bridge_url: config.bridge_url || "",
          };
          break;
        case "slack":
          channelConfig = {
            ...baseConfig,
            type: "slack" as const,
            token: config.token || "",
          };
          break;
        case "webhook":
          channelConfig = {
            ...baseConfig,
            type: "webhook" as const,
            url: config.url || "",
            method: (config.method as "POST" | "PUT") || "POST",
            headers: config.headers || {},
          };
          break;
        default:
          reply.code(400);
          return { error: `Unknown channel type: ${channel_type}` };
      }

      const result = await testChannel(channelConfig);
      return {
        success: result.success,
        details: result.details,
        error: result.error,
      };
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to test channel" };
    }
  });

  // Send a test message (matches Rust gateway API)
  fastify.post("/api/channels/send-test", async (
    request: FastifyRequest<{
      Body: {
        channel_type: ChannelType;
        config: {
          type: string;
          token?: string;
          proxy?: string;
          app_id?: string;
          app_secret?: string;
          bridge_url?: string;
          url?: string;
          method?: string;
          headers?: Record<string, string>;
        };
        chat_id: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { channel_type, config, chat_id } = request.body;

    if (!channel_type || !config || !chat_id) {
      reply.code(400);
      return { error: "channel_type, config, and chat_id are required" };
    }

    try {
      // Build channel config based on type
      const baseConfig = {
        id: "",
        name: "",
        enabled: true,
        created_at: Date.now(),
        allow_from: [] as string[],
      };

      let channelConfig: ChannelConfig;

      switch (channel_type) {
        case "telegram":
          channelConfig = {
            ...baseConfig,
            type: "telegram" as const,
            token: config.token || "",
            proxy: config.proxy,
          };
          break;
        case "discord":
          channelConfig = {
            ...baseConfig,
            type: "discord" as const,
            token: config.token || "",
          };
          break;
        case "feishu":
          channelConfig = {
            ...baseConfig,
            type: "feishu" as const,
            app_id: config.app_id || "",
            app_secret: config.app_secret || "",
          };
          break;
        case "whatsapp":
          channelConfig = {
            ...baseConfig,
            type: "whatsapp" as const,
            bridge_url: config.bridge_url || "",
          };
          break;
        case "slack":
          channelConfig = {
            ...baseConfig,
            type: "slack" as const,
            token: config.token || "",
          };
          break;
        case "webhook":
          channelConfig = {
            ...baseConfig,
            type: "webhook" as const,
            url: config.url || "",
            method: (config.method as "POST" | "PUT") || "POST",
            headers: config.headers || {},
          };
          break;
        default:
          reply.code(400);
          return { error: `Unknown channel type: ${channel_type}` };
      }

      const result = await sendTestMessage(channelConfig, chat_id);

      return {
        success: result.success,
        message_id: result.messageId,
        error: result.error,
      };
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to send test message" };
    }
  });

  // Webhook endpoint for external events
  // Receives messages from external platforms and broadcasts them as events
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

    // Validate required fields
    if (!body.chat_id || typeof body.chat_id !== "string") {
      reply.code(400);
      return { error: "chat_id is required and must be a string" };
    }

    if (!body.message || typeof body.message !== "string") {
      reply.code(400);
      return { error: "message is required and must be a string" };
    }

    try {
      // Get event service from fastify instance (if configured)
      const eventService = (fastify as unknown as { eventService?: { broadcast: (event: unknown) => void } }).eventService;

      // Determine channel info
      let channelType = body.channel_type || "webhook";
      let channelName = body.channel_name || body.source || "external";

      // If channelId is provided, look up channel info
      if (body.channelId) {
        const channel = await channelManager.getChannel(body.channelId);
        if (channel) {
          channelType = channel.type;
          channelName = channel.name;
        }
      }

      // Parse timestamp
      let timestamp: number;
      if (typeof body.timestamp === "number") {
        timestamp = body.timestamp;
      } else if (typeof body.timestamp === "string") {
        timestamp = new Date(body.timestamp).getTime();
      } else {
        timestamp = Date.now();
      }

      // Broadcast event if event service is available
      if (eventService) {
        eventService.broadcast({
          type: "channel_message_received",
          data: {
            channelType,
            channelName,
            chatId: body.chat_id,
            senderName: body.sender_name || body.sender,
            message: body.message,
            timestamp,
          },
        });
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
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to process webhook" };
    }
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

    // Validate required fields
    if (!body.chat_id || typeof body.chat_id !== "string") {
      reply.code(400);
      return { error: "chat_id is required and must be a string" };
    }

    if (!body.message || typeof body.message !== "string") {
      reply.code(400);
      return { error: "message is required and must be a string" };
    }

    try {
      // Get channel
      const channel = await channelManager.getChannel(id);
      if (!channel) {
        reply.code(404);
        return { error: `Channel not found: ${id}` };
      }

      // Check if channel is enabled
      if (!channel.enabled) {
        reply.code(403);
        return { error: "Channel is disabled" };
      }

      // Get event service from fastify instance
      const eventService = (fastify as unknown as { eventService?: { broadcast: (event: unknown) => void } }).eventService;

      // Parse timestamp
      let timestamp: number;
      if (typeof body.timestamp === "number") {
        timestamp = body.timestamp;
      } else if (typeof body.timestamp === "string") {
        timestamp = new Date(body.timestamp).getTime();
      } else {
        timestamp = Date.now();
      }

      // Broadcast event if event service is available
      if (eventService) {
        eventService.broadcast({
          type: "channel_message_received",
          data: {
            channelType: channel.type,
            channelName: channel.name,
            chatId: body.chat_id,
            senderName: body.sender_name || body.sender,
            message: body.message,
            timestamp,
          },
        });
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
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to process webhook" };
    }
  });
}
