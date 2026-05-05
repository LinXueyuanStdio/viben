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
 * - POST /api/channels/send - Send message
 * - POST /api/channels/test - Test channel configuration
 * - POST /api/channels/send-test - Send test message
 * - POST /api/channels/webhook - Receive webhook messages
 * - POST /api/channels/:id/webhook - Receive webhook messages for specific channel
 *
 * These tests verify the HTTP route handlers using a mock Fastify instance
 * that simulates HTTP requests and invokes actual route handlers.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { Channel, ChannelType, NotificationMode } from "../../channels";
import { registerChannelRoutes } from "./channels";

// Mock the channelManager and channel functions
vi.mock("../../channels", () => ({
  channelManager: {
    listChannels: vi.fn(),
    getChannel: vi.fn(),
    createChannel: vi.fn(),
    updateChannel: vi.fn(),
    removeChannel: vi.fn(),
    setDefaultChannel: vi.fn(),
    load: vi.fn(),
    buildChannelConfig: vi.fn(),
  },
  sendChannelMessage: vi.fn(),
  testChannel: vi.fn(),
  sendTestMessage: vi.fn(),
}));

// Mock telemetry
vi.mock("../../telemetry", () => ({
  trace: {
    getTracer: () => ({
      startSpan: () => ({
        setAttributes: vi.fn(),
        setStatus: vi.fn(),
        recordException: vi.fn(),
        setAttribute: vi.fn(),
        end: vi.fn(),
      }),
    }),
  },
  SpanStatusCode: {
    OK: 0,
    ERROR: 1,
  },
}));

vi.mock("../../telemetry/route-names", () => ({
  getSpanName: (name: string) => name,
}));

import { channelManager, sendChannelMessage, testChannel, sendTestMessage } from "../../channels";

/**
 * Mock Fastify instance for testing route handlers
 */
interface MockReply {
  code: ReturnType<typeof vi.fn>;
}

interface RouteOptions {
  schema?: unknown;
}

interface MockRouteHandler {
  method: string;
  url: string;
  handler: (request: unknown, reply: MockReply) => Promise<unknown>;
}

function createMockFastify() {
  const routes: MockRouteHandler[] = [];

  const fastify = {
    get: vi.fn((url: string, optionsOrHandler: RouteOptions | ((req: unknown, rep: MockReply) => Promise<unknown>), handler?: (req: unknown, rep: MockReply) => Promise<unknown>) => {
      const actualHandler = typeof optionsOrHandler === "function" ? optionsOrHandler : handler!;
      routes.push({ method: "GET", url, handler: actualHandler });
    }),
    post: vi.fn((url: string, optionsOrHandler: RouteOptions | ((req: unknown, rep: MockReply) => Promise<unknown>), handler?: (req: unknown, rep: MockReply) => Promise<unknown>) => {
      const actualHandler = typeof optionsOrHandler === "function" ? optionsOrHandler : handler!;
      routes.push({ method: "POST", url, handler: actualHandler });
    }),
    patch: vi.fn((url: string, handler: (req: unknown, rep: MockReply) => Promise<unknown>) => {
      routes.push({ method: "PATCH", url, handler });
    }),
    delete: vi.fn((url: string, handler: (req: unknown, rep: MockReply) => Promise<unknown>) => {
      routes.push({ method: "DELETE", url, handler });
    }),
    routes,
    // Helper to find and execute a route handler
    async inject(options: { method: string; url: string; payload?: unknown }) {
      const { method, url, payload } = options;
      const parsedUrl = new URL(url, "http://localhost");
      const pathname = parsedUrl.pathname;
      const searchParams = Object.fromEntries(parsedUrl.searchParams.entries());

      // Convert string params to appropriate types
      const query: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(searchParams)) {
        query[key] = value;
      }

      // Find matching route
      let matchingRoute: MockRouteHandler | undefined;
      let params: Record<string, string> = {};

      for (const route of routes) {
        if (route.method !== method) continue;

        // Check for exact match
        if (route.url === pathname) {
          matchingRoute = route;
          break;
        }

        // Check for parameterized match (e.g., /api/channels/:id)
        const routeParts = route.url.split("/");
        const urlParts = pathname.split("/");

        if (routeParts.length === urlParts.length) {
          let isMatch = true;
          const extractedParams: Record<string, string> = {};

          for (let i = 0; i < routeParts.length; i++) {
            if (routeParts[i].startsWith(":")) {
              extractedParams[routeParts[i].slice(1)] = urlParts[i];
            } else if (routeParts[i] !== urlParts[i]) {
              isMatch = false;
              break;
            }
          }

          if (isMatch) {
            matchingRoute = route;
            params = extractedParams;
            break;
          }
        }
      }

      if (!matchingRoute) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Route not found" }),
        };
      }

      // Create mock request and reply
      const request = {
        query,
        params,
        body: payload,
      };

      let statusCode = 200;
      const reply: MockReply = {
        code: vi.fn((code: number) => {
          statusCode = code;
          return reply;
        }),
      };

      const result = await matchingRoute.handler(request, reply);

      return {
        statusCode,
        body: JSON.stringify(result),
      };
    },
  };

  return fastify;
}

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
    updated_at: Date.now(),
    allow_from: [],
    notification_mode: "none",
    config: {},
    ...overrides,
  };
}

describe("Channel Routes", () => {
  let fastify: ReturnType<typeof createMockFastify>;

  beforeEach(() => {
    vi.clearAllMocks();
    fastify = createMockFastify();
    registerChannelRoutes(fastify as never);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // GET /api/channels - List all channels
  // ============================================================================

  describe("GET /api/channels", () => {
    it("should return empty array when no channels exist", async () => {
      vi.mocked(channelManager.listChannels).mockResolvedValue([]);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/channels",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.channels).toEqual([]);
      expect(channelManager.listChannels).toHaveBeenCalledWith();
    });

    it("should return list of all channels with snake_case transformation", async () => {
      const mockChannels = [
        createMockChannel({
          id: "my-telegram",
          name: "My Telegram",
          type: "telegram",
          is_default: true,
          created_at: 1609459200000,
          updated_at: 1609459200000,
        }),
        createMockChannel({
          id: "my-discord",
          name: "My Discord",
          type: "discord",
        }),
      ];

      vi.mocked(channelManager.listChannels).mockResolvedValue(mockChannels);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/channels",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.channels).toHaveLength(2);
      // Verify snake_case transformation
      expect(body.channels[0].id).toBe("my-telegram");
      expect(body.channels[0].channel_type).toBe("telegram");
      expect(body.channels[0].is_default).toBe(true);
      expect(body.channels[0].created_at).toBeDefined();
      expect(body.channels[0].updated_at).toBeDefined();
      expect(body.channels[1].id).toBe("my-discord");
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

      const response = await fastify.inject({
        method: "GET",
        url: "/api/channels",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.channels).toHaveLength(6);
      channelTypes.forEach((type, index) => {
        expect(body.channels[index].channel_type).toBe(type);
      });
    });

    it("should include agent_binding in response when present", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        agent_binding: {
          binding_type: "agent",
          id: "agent-1",
          name: "My Agent",
          workspace_path: "/path/to/workspace",
        },
      });

      vi.mocked(channelManager.listChannels).mockResolvedValue([mockChannel]);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/channels",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.channels[0].agent_binding).toEqual({
        binding_type: "agent",
        id: "agent-1",
        name: "My Agent",
        workspace_path: "/path/to/workspace",
      });
    });
  });

  // ============================================================================
  // GET /api/channels/:id - Get specific channel
  // ============================================================================

  describe("GET /api/channels/:id", () => {
    it("should return channel when found with snake_case transformation", async () => {
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

      const response = await fastify.inject({
        method: "GET",
        url: "/api/channels/my-telegram",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe("my-telegram");
      expect(body.name).toBe("My Telegram");
      expect(body.channel_type).toBe("telegram");
      expect(body.enabled).toBe(true);
      expect(body.is_default).toBe(true);
      expect(body.notification_mode).toBe("both");
      expect(channelManager.getChannel).toHaveBeenCalledWith("my-telegram");
    });

    it("should return 404 when channel not found", async () => {
      vi.mocked(channelManager.getChannel).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/channels/nonexistent",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Channel not found");
      expect(body.error).toContain("nonexistent");
      expect(channelManager.getChannel).toHaveBeenCalledWith("nonexistent");
    });

    it("should handle special characters in channel ID", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram-123",
        name: "My Telegram 123",
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/channels/my-telegram-123",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe("my-telegram-123");
    });
  });

  // ============================================================================
  // POST /api/channels - Create new channel
  // ============================================================================

  describe("POST /api/channels", () => {
    describe("Telegram channel", () => {
      it("should create telegram channel with required fields and return 201", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram",
          name: "My Telegram",
          type: "telegram",
          config: { token: "bot-token" },
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "telegram",
            name: "My Telegram",
            token: "bot-token",
          },
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.id).toBe("my-telegram");
        expect(body.channel_type).toBe("telegram");
        expect(channelManager.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "telegram",
            name: "My Telegram",
            token: "bot-token",
          })
        );
      });

      it("should create telegram channel with proxy option", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram",
          type: "telegram",
          config: { token: "bot-token", proxy: "http://proxy.example.com" },
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "telegram",
            name: "My Telegram",
            token: "bot-token",
            proxy: "http://proxy.example.com",
          },
        });

        expect(response.statusCode).toBe(201);
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

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "discord",
            name: "My Discord",
            token: "discord-token",
          },
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.channel_type).toBe("discord");
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

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "discord",
            name: "My Discord",
            token: "discord-token",
            gateway_url: "wss://gateway.discord.gg",
          },
        });

        expect(response.statusCode).toBe(201);
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

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "feishu",
            name: "My Feishu",
            app_id: "cli_xxx",
            app_secret: "secret123",
          },
        });

        expect(response.statusCode).toBe(201);
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

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "whatsapp",
            name: "My WhatsApp",
            bridge_url: "ws://localhost:3001",
          },
        });

        expect(response.statusCode).toBe(201);
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

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "slack",
            name: "My Slack",
            token: "xoxb-slack-token",
          },
        });

        expect(response.statusCode).toBe(201);
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

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "slack",
            name: "My Slack",
            token: "xoxb-slack-token",
            channel_id: "C123456",
          },
        });

        expect(response.statusCode).toBe(201);
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

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "webhook",
            name: "My Webhook",
            url: "https://example.com/webhook",
          },
        });

        expect(response.statusCode).toBe(201);
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

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "webhook",
            name: "My Webhook",
            url: "https://example.com/webhook",
            method: "POST",
          },
        });

        expect(response.statusCode).toBe(201);
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

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "webhook",
            name: "My Webhook",
            url: "https://example.com/webhook",
            method: "PUT",
          },
        });

        expect(response.statusCode).toBe(201);
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

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "webhook",
            name: "My Webhook",
            url: "https://example.com/webhook",
            headers: customHeaders,
          },
        });

        expect(response.statusCode).toBe(201);
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

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "telegram",
            name: "My Telegram",
            token: "bot-token",
            enabled: true,
          },
        });

        expect(response.statusCode).toBe(201);
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

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "telegram",
            name: "My Telegram",
            token: "bot-token",
            enabled: false,
          },
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.enabled).toBe(false);
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

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "telegram",
            name: "My Telegram",
            token: "bot-token",
            set_as_default: true,
          },
        });

        expect(response.statusCode).toBe(201);
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

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "telegram",
            name: "My Telegram",
            token: "bot-token",
            notification_mode: "none",
          },
        });

        expect(response.statusCode).toBe(201);
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

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "telegram",
            name: "My Telegram",
            token: "bot-token",
            notification_mode: "in_app",
          },
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.notification_mode).toBe("in_app");
      });

      it("should create channel with notification_mode: system", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram",
          notification_mode: "system",
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "telegram",
            name: "My Telegram",
            token: "bot-token",
            notification_mode: "system",
          },
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.notification_mode).toBe("system");
      });

      it("should create channel with notification_mode: both", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram",
          notification_mode: "both",
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "telegram",
            name: "My Telegram",
            token: "bot-token",
            notification_mode: "both",
          },
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.notification_mode).toBe("both");
      });

      it("should create channel with agent_binding", async () => {
        const mockChannel = createMockChannel({
          id: "my-telegram",
          agent_binding: {
            binding_type: "agent",
            id: "agent-1",
            name: "My Agent",
          },
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "telegram",
            name: "My Telegram",
            token: "bot-token",
            agent_binding: {
              binding_type: "agent",
              id: "agent-1",
              name: "My Agent",
            },
          },
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.agent_binding).toEqual({
          binding_type: "agent",
          id: "agent-1",
          name: "My Agent",
        });
      });
    });

    describe("Error handling", () => {
      it("should return 400 when creation fails", async () => {
        vi.mocked(channelManager.createChannel).mockRejectedValue(
          new Error("Token is required for Telegram channels")
        );

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "telegram",
            name: "My Telegram",
            // Missing token
          },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toContain("Token is required for Telegram channels");
      });

      it("should return 400 when channel already exists", async () => {
        vi.mocked(channelManager.createChannel).mockRejectedValue(
          new Error('Channel "my-telegram" already exists')
        );

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "telegram",
            name: "My Telegram",
            token: "bot-token",
          },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toContain("already exists");
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

      const response = await fastify.inject({
        method: "PATCH",
        url: "/api/channels/my-telegram",
        payload: {
          name: "Updated Name",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe("Updated Name");
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

      const response = await fastify.inject({
        method: "PATCH",
        url: "/api/channels/my-telegram",
        payload: {
          enabled: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.enabled).toBe(false);
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

      const response = await fastify.inject({
        method: "PATCH",
        url: "/api/channels/my-telegram",
        payload: {
          notification_mode: "both",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.notification_mode).toBe("both");
    });

    it("should update multiple fields at once", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        name: "New Name",
        enabled: false,
        notification_mode: "system",
      });

      vi.mocked(channelManager.updateChannel).mockResolvedValue(mockChannel);

      const response = await fastify.inject({
        method: "PATCH",
        url: "/api/channels/my-telegram",
        payload: {
          name: "New Name",
          enabled: false,
          notification_mode: "system",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe("New Name");
      expect(body.enabled).toBe(false);
      expect(body.notification_mode).toBe("system");
    });

    describe("Error handling", () => {
      it("should return 400 when channel not found", async () => {
        vi.mocked(channelManager.updateChannel).mockRejectedValue(
          new Error('Channel "nonexistent" not found')
        );

        const response = await fastify.inject({
          method: "PATCH",
          url: "/api/channels/nonexistent",
          payload: { name: "New Name" },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toContain("not found");
      });
    });
  });

  // ============================================================================
  // DELETE /api/channels/:id - Delete channel
  // ============================================================================

  describe("DELETE /api/channels/:id", () => {
    it("should delete channel and return deleted id", async () => {
      vi.mocked(channelManager.removeChannel).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/channels/my-telegram",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.deleted).toBe("my-telegram");
      expect(channelManager.removeChannel).toHaveBeenCalledWith("my-telegram");
    });

    it("should handle deleting channel with special characters in ID", async () => {
      vi.mocked(channelManager.removeChannel).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/channels/my-telegram-123",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.deleted).toBe("my-telegram-123");
    });

    describe("Error handling", () => {
      it("should return 400 when channel not found", async () => {
        vi.mocked(channelManager.removeChannel).mockRejectedValue(
          new Error('Channel "nonexistent" not found')
        );

        const response = await fastify.inject({
          method: "DELETE",
          url: "/api/channels/nonexistent",
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toContain("not found");
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

      vi.mocked(channelManager.setDefaultChannel).mockResolvedValue(mockChannel);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/my-telegram/default",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe("my-telegram");
      expect(body.is_default).toBe(true);
      expect(channelManager.setDefaultChannel).toHaveBeenCalledWith("my-telegram");
    });

    it("should set disabled channel as default", async () => {
      const mockChannel = createMockChannel({
        id: "disabled-channel",
        enabled: false,
        is_default: true,
      });

      vi.mocked(channelManager.setDefaultChannel).mockResolvedValue(mockChannel);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/disabled-channel/default",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.enabled).toBe(false);
      expect(body.is_default).toBe(true);
    });

    describe("Error handling", () => {
      it("should return 400 when channel not found", async () => {
        vi.mocked(channelManager.setDefaultChannel).mockRejectedValue(
          new Error('Channel "nonexistent" not found')
        );

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels/nonexistent/default",
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toContain("not found");
      });
    });
  });

  // ============================================================================
  // POST /api/channels/send - Send message
  // ============================================================================

  describe("POST /api/channels/send", () => {
    it("should send message successfully", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        type: "telegram",
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);
      vi.mocked(channelManager.load).mockResolvedValue(undefined);
      vi.mocked(channelManager.listChannels).mockResolvedValue([mockChannel]);
      vi.mocked(channelManager.buildChannelConfig).mockReturnValue({
        id: "my-telegram",
        type: "telegram",
        name: "My Telegram",
        enabled: true,
        created_at: Date.now(),
        allow_from: [],
        token: "bot-token",
      });
      vi.mocked(sendChannelMessage).mockResolvedValue({
        success: true,
        messageId: "msg-123",
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/send",
        payload: {
          channel_id: "my-telegram",
          chat_id: "chat-123",
          message: "Hello, World!",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message_id).toBe("msg-123");
    });

    it("should return 400 for missing required parameters", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/send",
        payload: {
          channel_id: "my-telegram",
          // Missing chat_id and message
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("required");
    });

    it("should return 404 when channel not found", async () => {
      vi.mocked(channelManager.getChannel).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/send",
        payload: {
          channel_id: "nonexistent",
          chat_id: "chat-123",
          message: "Hello",
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Channel not found");
    });

    it("should return 400 when send fails", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        type: "telegram",
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);
      vi.mocked(channelManager.load).mockResolvedValue(undefined);
      vi.mocked(channelManager.listChannels).mockResolvedValue([mockChannel]);
      vi.mocked(channelManager.buildChannelConfig).mockReturnValue({
        id: "my-telegram",
        type: "telegram",
        name: "My Telegram",
        enabled: true,
        created_at: Date.now(),
        allow_from: [],
        token: "bot-token",
      });
      vi.mocked(sendChannelMessage).mockResolvedValue({
        success: false,
        error: "Failed to send message",
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/send",
        payload: {
          channelId: "my-telegram",
          chatId: "chat-123",
          message: "Hello",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Failed to send message");
    });
  });

  // ============================================================================
  // POST /api/channels/test - Test channel configuration
  // ============================================================================

  describe("POST /api/channels/test", () => {
    it("should test telegram channel successfully", async () => {
      vi.mocked(testChannel).mockResolvedValue({
        success: true,
        details: "Connection successful",
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/test",
        payload: {
          channel_type: "telegram",
          config: {
            type: "telegram",
            token: "bot-token",
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.details).toBe("Connection successful");
    });

    it("should return 400 for missing required parameters", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/test",
        payload: {
          // Missing channel_type and config
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("required");
    });

    it("should return 400 for unknown channel type", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/test",
        payload: {
          channel_type: "unknown",
          config: {
            type: "unknown",
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Unknown channel type");
    });

    it("should test discord channel", async () => {
      vi.mocked(testChannel).mockResolvedValue({
        success: true,
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/test",
        payload: {
          channel_type: "discord",
          config: {
            type: "discord",
            token: "discord-token",
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it("should handle test failure", async () => {
      vi.mocked(testChannel).mockResolvedValue({
        success: false,
        error: "Invalid token",
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/test",
        payload: {
          channel_type: "telegram",
          config: {
            type: "telegram",
            token: "invalid-token",
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Invalid token");
    });
  });

  // ============================================================================
  // POST /api/channels/send-test - Send test message
  // ============================================================================

  describe("POST /api/channels/send-test", () => {
    it("should send test message successfully", async () => {
      vi.mocked(sendTestMessage).mockResolvedValue({
        success: true,
        messageId: "test-msg-123",
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/send-test",
        payload: {
          channel_type: "telegram",
          config: {
            type: "telegram",
            token: "bot-token",
          },
          chat_id: "chat-123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message_id).toBe("test-msg-123");
    });

    it("should return 400 for missing required parameters", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/send-test",
        payload: {
          channel_type: "telegram",
          // Missing config and chat_id
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("required");
    });

    it("should return 400 for unknown channel type", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/send-test",
        payload: {
          channel_type: "unknown",
          config: {
            type: "unknown",
          },
          chat_id: "chat-123",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Unknown channel type");
    });
  });

  // ============================================================================
  // POST /api/channels/webhook - Receive webhook messages
  // ============================================================================

  describe("POST /api/channels/webhook", () => {
    it("should receive webhook message successfully", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/webhook",
        payload: {
          chat_id: "chat-123",
          message: "Hello from webhook",
          channel_type: "telegram",
          channel_name: "My Telegram",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.received.channel_type).toBe("telegram");
      expect(body.received.chat_id).toBe("chat-123");
    });

    it("should return 400 for missing chat_id", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/webhook",
        payload: {
          message: "Hello",
          // Missing chat_id
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("chat_id is required");
    });

    it("should return 400 for missing message", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/webhook",
        payload: {
          chat_id: "chat-123",
          // Missing message
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("message is required");
    });

    it("should look up channel info when channelId is provided", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        name: "My Telegram",
        type: "telegram",
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/webhook",
        payload: {
          channelId: "my-telegram",
          chat_id: "chat-123",
          message: "Hello",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.received.channel_type).toBe("telegram");
      expect(body.received.channel_name).toBe("My Telegram");
    });
  });

  // ============================================================================
  // POST /api/channels/:id/webhook - Receive webhook messages for specific channel
  // ============================================================================

  describe("POST /api/channels/:id/webhook", () => {
    it("should receive webhook message for specific channel", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        name: "My Telegram",
        type: "telegram",
        enabled: true,
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/my-telegram/webhook",
        payload: {
          chat_id: "chat-123",
          message: "Hello from specific channel webhook",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.received.channel_id).toBe("my-telegram");
      expect(body.received.channel_type).toBe("telegram");
    });

    it("should return 404 when channel not found", async () => {
      vi.mocked(channelManager.getChannel).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/nonexistent/webhook",
        payload: {
          chat_id: "chat-123",
          message: "Hello",
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Channel not found");
    });

    it("should return 403 when channel is disabled", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        enabled: false,
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/my-telegram/webhook",
        payload: {
          chat_id: "chat-123",
          message: "Hello",
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("disabled");
    });

    it("should return 400 for missing chat_id", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        enabled: true,
      });

      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/channels/my-telegram/webhook",
        payload: {
          message: "Hello",
          // Missing chat_id
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("chat_id is required");
    });
  });

  // ============================================================================
  // Channel Types
  // ============================================================================

  describe("Channel Types", () => {
    const allTypes: ChannelType[] = ["telegram", "discord", "feishu", "whatsapp", "slack", "webhook"];

    allTypes.forEach((type) => {
      it(`should support ${type} channel type through HTTP API`, async () => {
        const mockChannel = createMockChannel({
          id: `test-${type}`,
          type,
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        const payload: Record<string, unknown> = {
          type,
          name: `Test ${type}`,
        };

        // Add type-specific required fields
        if (type === "telegram") payload.token = "token";
        if (type === "discord") payload.token = "token";
        if (type === "feishu") {
          payload.app_id = "id";
          payload.app_secret = "secret";
        }
        if (type === "whatsapp") payload.bridge_url = "ws://localhost";
        if (type === "slack") payload.token = "token";
        if (type === "webhook") payload.url = "https://example.com";

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload,
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.channel_type).toBe(type);
      });
    });
  });

  // ============================================================================
  // Notification Modes
  // ============================================================================

  describe("Notification Modes", () => {
    const allModes: NotificationMode[] = ["none", "in_app", "system", "both"];

    allModes.forEach((mode) => {
      it(`should support notification_mode: ${mode} through HTTP API`, async () => {
        const mockChannel = createMockChannel({
          id: "test-channel",
          notification_mode: mode,
        });

        vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

        const response = await fastify.inject({
          method: "POST",
          url: "/api/channels",
          payload: {
            type: "telegram",
            name: "Test Channel",
            token: "token",
            notification_mode: mode,
          },
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.notification_mode).toBe(mode);
      });
    });
  });

  // ============================================================================
  // Integration scenarios
  // ============================================================================

  describe("Integration scenarios", () => {
    it("should handle creating, getting, and deleting a channel through HTTP", async () => {
      const mockChannel = createMockChannel({
        id: "integration-test",
        name: "Integration Test",
        type: "telegram",
      });

      // Create channel
      vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/channels",
        payload: {
          type: "telegram",
          name: "Integration Test",
          token: "bot-token",
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const created = JSON.parse(createResponse.body);
      expect(created.id).toBe("integration-test");

      // Get channel
      vi.mocked(channelManager.getChannel).mockResolvedValue(mockChannel);

      const getResponse = await fastify.inject({
        method: "GET",
        url: "/api/channels/integration-test",
      });

      expect(getResponse.statusCode).toBe(200);
      const retrieved = JSON.parse(getResponse.body);
      expect(retrieved.id).toBe("integration-test");

      // Delete channel
      vi.mocked(channelManager.removeChannel).mockResolvedValue(undefined);

      const deleteResponse = await fastify.inject({
        method: "DELETE",
        url: "/api/channels/integration-test",
      });

      expect(deleteResponse.statusCode).toBe(200);
      const deleted = JSON.parse(deleteResponse.body);
      expect(deleted.deleted).toBe("integration-test");
    });

    it("should handle creating channel and setting as default through HTTP", async () => {
      const mockChannel = createMockChannel({
        id: "new-default",
        name: "New Default",
        type: "discord",
        is_default: false,
      });

      // Create channel
      vi.mocked(channelManager.createChannel).mockResolvedValue(mockChannel);

      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/channels",
        payload: {
          type: "discord",
          name: "New Default",
          token: "discord-token",
        },
      });

      expect(createResponse.statusCode).toBe(201);

      // Set as default
      const defaultChannel = { ...mockChannel, is_default: true };
      vi.mocked(channelManager.setDefaultChannel).mockResolvedValue(defaultChannel);

      const defaultResponse = await fastify.inject({
        method: "POST",
        url: "/api/channels/new-default/default",
      });

      expect(defaultResponse.statusCode).toBe(200);
      const updated = JSON.parse(defaultResponse.body);
      expect(updated.is_default).toBe(true);
    });

    it("should handle updating channel and listing all through HTTP", async () => {
      const mockChannel = createMockChannel({
        id: "my-telegram",
        name: "Original Name",
      });

      // Update channel
      const updatedChannel = { ...mockChannel, name: "Updated Name" };
      vi.mocked(channelManager.updateChannel).mockResolvedValue(updatedChannel);

      const updateResponse = await fastify.inject({
        method: "PATCH",
        url: "/api/channels/my-telegram",
        payload: {
          name: "Updated Name",
        },
      });

      expect(updateResponse.statusCode).toBe(200);

      // List channels
      vi.mocked(channelManager.listChannels).mockResolvedValue([updatedChannel]);

      const listResponse = await fastify.inject({
        method: "GET",
        url: "/api/channels",
      });

      expect(listResponse.statusCode).toBe(200);
      const list = JSON.parse(listResponse.body);
      expect(list.channels).toHaveLength(1);
      expect(list.channels[0].name).toBe("Updated Name");
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

      const response = await fastify.inject({
        method: "PATCH",
        url: "/api/channels/my-telegram",
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(channelManager.updateChannel).toHaveBeenCalledWith("my-telegram", {});
    });

    it("should handle large number of channels in list response", async () => {
      const mockChannels = Array.from({ length: 100 }, (_, i) =>
        createMockChannel({
          id: `channel-${i}`,
          name: `Channel ${i}`,
        })
      );

      vi.mocked(channelManager.listChannels).mockResolvedValue(mockChannels);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/channels",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.channels).toHaveLength(100);
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

      const response = await fastify.inject({
        method: "GET",
        url: "/api/channels/minimal",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe("minimal");
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

      const response = await fastify.inject({
        method: "GET",
        url: "/api/channels/complex",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.config).toEqual({
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
  // Route Registration
  // ============================================================================

  describe("Route Registration", () => {
    it("should register GET /api/channels route", () => {
      const getCalls = fastify.get.mock.calls;
      const listRoute = getCalls.find((call) => call[0] === "/api/channels");
      expect(listRoute).toBeDefined();
      expect(listRoute![0]).toBe("/api/channels");
      expect(typeof listRoute![1]).toBe("object"); // schema options
      expect(typeof listRoute![2]).toBe("function"); // handler
    });

    it("should register GET /api/channels/:id route", () => {
      const getCalls = fastify.get.mock.calls;
      const getByIdRoute = getCalls.find((call) => call[0] === "/api/channels/:id");
      expect(getByIdRoute).toBeDefined();
    });

    it("should register POST /api/channels route", () => {
      const postCalls = fastify.post.mock.calls;
      const createRoute = postCalls.find((call) => call[0] === "/api/channels");
      expect(createRoute).toBeDefined();
      expect(createRoute![0]).toBe("/api/channels");
      expect(typeof createRoute![1]).toBe("function"); // handler (no schema options)
    });

    it("should register PATCH /api/channels/:id route", () => {
      const patchCalls = fastify.patch.mock.calls;
      const updateRoute = patchCalls.find((call) => call[0] === "/api/channels/:id");
      expect(updateRoute).toBeDefined();
      expect(updateRoute![0]).toBe("/api/channels/:id");
      expect(typeof updateRoute![1]).toBe("function"); // handler
    });

    it("should register DELETE /api/channels/:id route", () => {
      const deleteCalls = fastify.delete.mock.calls;
      const deleteByIdRoute = deleteCalls.find((call) => call[0] === "/api/channels/:id");
      expect(deleteByIdRoute).toBeDefined();
      expect(deleteByIdRoute![0]).toBe("/api/channels/:id");
      expect(typeof deleteByIdRoute![1]).toBe("function"); // handler
    });

    it("should register POST /api/channels/:id/default route", () => {
      const postCalls = fastify.post.mock.calls;
      const defaultRoute = postCalls.find((call) => call[0] === "/api/channels/:id/default");
      expect(defaultRoute).toBeDefined();
    });

    it("should register POST /api/channels/send route", () => {
      const postCalls = fastify.post.mock.calls;
      const sendRoute = postCalls.find((call) => call[0] === "/api/channels/send");
      expect(sendRoute).toBeDefined();
    });

    it("should register POST /api/channels/test route", () => {
      const postCalls = fastify.post.mock.calls;
      const testRoute = postCalls.find((call) => call[0] === "/api/channels/test");
      expect(testRoute).toBeDefined();
    });

    it("should register POST /api/channels/send-test route", () => {
      const postCalls = fastify.post.mock.calls;
      const sendTestRoute = postCalls.find((call) => call[0] === "/api/channels/send-test");
      expect(sendTestRoute).toBeDefined();
    });

    it("should register POST /api/channels/webhook route", () => {
      const postCalls = fastify.post.mock.calls;
      const webhookRoute = postCalls.find((call) => call[0] === "/api/channels/webhook");
      expect(webhookRoute).toBeDefined();
    });

    it("should register POST /api/channels/:id/webhook route", () => {
      const postCalls = fastify.post.mock.calls;
      const channelWebhookRoute = postCalls.find((call) => call[0] === "/api/channels/:id/webhook");
      expect(channelWebhookRoute).toBeDefined();
    });
  });
});
