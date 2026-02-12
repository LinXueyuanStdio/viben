/**
 * Channel routes
 *
 * Provides HTTP API for:
 * - Channel instance CRUD (stored in ~/.viben/channels.yaml)
 * - Sending messages through channels
 * - Testing channel configurations
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { channelManager } from "../../channels";
import type {
  ChannelType,
  NotificationMode,
  CreateChannelOptions,
  UpdateChannelOptions,
  Channel,
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
    agent_binding: undefined, // Agent binding not yet implemented in TypeScript
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

  // TODO: Add send message endpoint once sendMessage is implemented in ChannelManager
  // For now, these endpoints are stubs

  // Send a message through a channel (stub)
  fastify.post("/api/channels/send", async (
    request: FastifyRequest<{
      Body: {
        channelId: string;
        message: string;
        parseMode?: "text" | "markdown" | "html";
      };
    }>,
    reply: FastifyReply
  ) => {
    reply.code(501);
    return { error: "Not implemented yet" };
  });

  // Test a channel configuration (stub)
  fastify.post("/api/channels/test", async (
    request: FastifyRequest<{
      Body: {
        channelId: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    reply.code(501);
    return { error: "Not implemented yet" };
  });

  // Send a test message (stub)
  fastify.post("/api/channels/send-test", async (
    request: FastifyRequest<{
      Body: {
        channelId: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    reply.code(501);
    return { error: "Not implemented yet" };
  });
}
