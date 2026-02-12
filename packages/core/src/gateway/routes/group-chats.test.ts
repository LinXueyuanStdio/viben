/**
 * Group Chat Routes Tests
 *
 * Tests for group chat management endpoints:
 * - Group chat CRUD
 * - Member management
 * - Session management
 * - Message handling
 * - Event broadcasting
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Types for mock Fastify
interface MockRoute {
  method: string;
  path: string;
  handler: (request: MockRequest, reply: MockReply) => Promise<unknown>;
}

interface MockRequest {
  query: Record<string, unknown>;
  params: Record<string, string>;
  body: unknown;
}

interface MockReply {
  code: (status: number) => MockReply;
  statusCode: number;
}

interface MockFastify {
  routes: MockRoute[];
  get: (path: string, handler: (req: MockRequest, reply: MockReply) => Promise<unknown>) => void;
  post: (path: string, handler: (req: MockRequest, reply: MockReply) => Promise<unknown>) => void;
  patch: (path: string, handler: (req: MockRequest, reply: MockReply) => Promise<unknown>) => void;
  delete: (path: string, handler: (req: MockRequest, reply: MockReply) => Promise<unknown>) => void;
  register: (fn: (instance: MockFastify) => Promise<void>) => void;
  inject: (options: { method: string; url: string; body?: unknown }) => Promise<{ statusCode: number; json: () => unknown }>;
}

// Create mock Fastify instance
function createMockFastify(): MockFastify {
  const routes: MockRoute[] = [];

  const instance: MockFastify = {
    routes,
    get(path: string, handler: (req: MockRequest, reply: MockReply) => Promise<unknown>) {
      routes.push({ method: "GET", path, handler });
    },
    post(path: string, handler: (req: MockRequest, reply: MockReply) => Promise<unknown>) {
      routes.push({ method: "POST", path, handler });
    },
    patch(path: string, handler: (req: MockRequest, reply: MockReply) => Promise<unknown>) {
      routes.push({ method: "PATCH", path, handler });
    },
    delete(path: string, handler: (req: MockRequest, reply: MockReply) => Promise<unknown>) {
      routes.push({ method: "DELETE", path, handler });
    },
    register(fn: (instance: MockFastify) => Promise<void>) {
      // Execute registration function but ignore WebSocket routes
      fn(instance).catch(() => {});
    },
    async inject(options: { method: string; url: string; body?: unknown }) {
      const [urlPath, queryString] = options.url.split("?");
      const query: Record<string, unknown> = {};
      const params: Record<string, string> = {};

      if (queryString) {
        queryString.split("&").forEach((param) => {
          const [key, value] = param.split("=");
          query[key] = decodeURIComponent(value);
        });
      }

      // Match route with path parameters
      const route = routes.find((r) => {
        if (r.method !== options.method) return false;

        // Convert route path to regex
        const pathParts = r.path.split("/");
        const urlParts = urlPath.split("/");

        if (pathParts.length !== urlParts.length) return false;

        for (let i = 0; i < pathParts.length; i++) {
          if (pathParts[i].startsWith(":")) {
            params[pathParts[i].slice(1)] = urlParts[i];
          } else if (pathParts[i] !== urlParts[i]) {
            return false;
          }
        }
        return true;
      });

      if (!route) {
        return { statusCode: 404, json: () => ({ error: "Route not found" }) };
      }

      let statusCode = 200;
      const reply: MockReply = {
        statusCode: 200,
        code(status: number) {
          statusCode = status;
          this.statusCode = status;
          return this;
        },
      };

      try {
        const result = await route.handler({ query, params, body: options.body }, reply);
        return { statusCode, json: () => result };
      } catch (e) {
        return {
          statusCode: statusCode === 200 ? 500 : statusCode,
          json: () => ({ error: e instanceof Error ? e.message : "Unknown error" }),
        };
      }
    },
  };

  return instance;
}

// Mock AppState
function createMockState() {
  return {
    events: {
      broadcast: vi.fn(),
      subscribe: vi.fn(() => () => {}),
      sessionMessage: vi.fn(),
    },
  };
}

describe("Group Chat Routes", () => {
  let fastify: MockFastify;
  let mockState: ReturnType<typeof createMockState>;

  beforeEach(async () => {
    vi.clearAllMocks();
    fastify = createMockFastify();
    mockState = createMockState();

    // Reset module to clear in-memory storage
    vi.resetModules();

    // Import and register routes
    const { registerGroupChatRoutes } = await import("./group-chats");
    registerGroupChatRoutes(
      fastify as unknown as import("fastify").FastifyInstance,
      mockState as unknown as import("../state").AppState
    );
  });

  // ============================================================================
  // Group Chat CRUD
  // ============================================================================

  describe("GET /api/group-chats", () => {
    it("should return empty list initially", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/group-chats",
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as { group_chats: unknown[] };
      expect(data.group_chats).toBeDefined();
      expect(Array.isArray(data.group_chats)).toBe(true);
    });

    it("should return created group chats", async () => {
      // Create a group chat first
      await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Test Chat", created_by: "user-1" },
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/api/group-chats",
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as { group_chats: Array<{ name: string }> };
      expect(data.group_chats).toHaveLength(1);
      expect(data.group_chats[0].name).toBe("Test Chat");
    });
  });

  describe("GET /api/group-chats/:id", () => {
    it("should return 404 for non-existent group chat", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/group-chats/non-existent",
      });

      expect(response.statusCode).toBe(404);
      const data = response.json() as { error: string };
      expect(data.error).toContain("not found");
    });

    it("should return group chat with members", async () => {
      // Create a group chat
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Test Chat", created_by: "user-1" },
      });
      const created = createResponse.json() as { group_chat: { id: string } };

      const response = await fastify.inject({
        method: "GET",
        url: `/api/group-chats/${created.group_chat.id}`,
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as { group_chat: { name: string }; members: unknown[] };
      expect(data.group_chat.name).toBe("Test Chat");
      expect(data.members).toBeDefined();
    });
  });

  describe("POST /api/group-chats", () => {
    it("should create a group chat", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: {
          name: "New Chat",
          description: "A test chat",
          created_by: "user-1",
        },
      });

      expect(response.statusCode).toBe(201);
      const data = response.json() as { group_chat: { id: string; name: string; description: string } };
      expect(data.group_chat.id).toBeDefined();
      expect(data.group_chat.name).toBe("New Chat");
      expect(data.group_chat.description).toBe("A test chat");
    });

    it("should create group chat with initial members", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: {
          name: "Team Chat",
          created_by: "user-1",
          members: [
            { type: "human", member_id: "user-2", display_name: "User 2" },
            { type: "agent", member_id: "agent-1", display_name: "Assistant", model: "claude-sonnet-4" },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      const data = response.json() as { members: Array<{ id: string; type: string }> };
      expect(data.members).toHaveLength(2);
    });

    it("should broadcast group_chat_created event", async () => {
      await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Event Test", created_by: "user-1" },
      });

      expect(mockState.events.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "group_chat_created" })
      );
    });

    it("should set default settings", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Settings Test", created_by: "user-1" },
      });

      const data = response.json() as { group_chat: { settings: { broadcastMode: string; showThinking: boolean } } };
      expect(data.group_chat.settings.broadcastMode).toBe("all");
      expect(data.group_chat.settings.showThinking).toBe(false);
    });
  });

  describe("PATCH /api/group-chats/:id", () => {
    it("should return 404 for non-existent group chat", async () => {
      const response = await fastify.inject({
        method: "PATCH",
        url: "/api/group-chats/non-existent",
        body: { name: "Updated" },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should update group chat name", async () => {
      // Create first
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Original", created_by: "user-1" },
      });
      const created = createResponse.json() as { group_chat: { id: string } };

      const response = await fastify.inject({
        method: "PATCH",
        url: `/api/group-chats/${created.group_chat.id}`,
        body: { name: "Updated Name" },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as { name: string };
      expect(data.name).toBe("Updated Name");
    });

    it("should update group chat description", async () => {
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Test", created_by: "user-1" },
      });
      const created = createResponse.json() as { group_chat: { id: string } };

      const response = await fastify.inject({
        method: "PATCH",
        url: `/api/group-chats/${created.group_chat.id}`,
        body: { description: "New description" },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as { description: string };
      expect(data.description).toBe("New description");
    });

    it("should broadcast group_chat_updated event", async () => {
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Test", created_by: "user-1" },
      });
      const created = createResponse.json() as { group_chat: { id: string } };
      mockState.events.broadcast.mockClear();

      await fastify.inject({
        method: "PATCH",
        url: `/api/group-chats/${created.group_chat.id}`,
        body: { name: "Updated" },
      });

      expect(mockState.events.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "group_chat_updated" })
      );
    });
  });

  describe("DELETE /api/group-chats/:id", () => {
    it("should return 404 for non-existent group chat", async () => {
      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/group-chats/non-existent",
      });

      expect(response.statusCode).toBe(404);
    });

    it("should delete group chat", async () => {
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "To Delete", created_by: "user-1" },
      });
      const created = createResponse.json() as { group_chat: { id: string } };

      const response = await fastify.inject({
        method: "DELETE",
        url: `/api/group-chats/${created.group_chat.id}`,
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as { deleted: string };
      expect(data.deleted).toBe(created.group_chat.id);
    });

    it("should broadcast group_chat_deleted event", async () => {
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Test", created_by: "user-1" },
      });
      const created = createResponse.json() as { group_chat: { id: string } };
      mockState.events.broadcast.mockClear();

      await fastify.inject({
        method: "DELETE",
        url: `/api/group-chats/${created.group_chat.id}`,
      });

      expect(mockState.events.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "group_chat_deleted" })
      );
    });
  });

  // ============================================================================
  // Member Management
  // ============================================================================

  describe("GET /api/group-chats/:id/members", () => {
    it("should return 404 for non-existent group chat", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/group-chats/non-existent/members",
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return members list", async () => {
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: {
          name: "Test",
          created_by: "user-1",
          members: [{ type: "human", member_id: "user-2", display_name: "User 2" }],
        },
      });
      const created = createResponse.json() as { group_chat: { id: string } };

      const response = await fastify.inject({
        method: "GET",
        url: `/api/group-chats/${created.group_chat.id}/members`,
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as { members: unknown[] };
      expect(data.members).toHaveLength(1);
    });
  });

  describe("POST /api/group-chats/:id/members", () => {
    it("should return 404 for non-existent group chat", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/group-chats/non-existent/members",
        body: { type: "human", member_id: "user-1", display_name: "User 1" },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should add a member", async () => {
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Test", created_by: "user-1" },
      });
      const created = createResponse.json() as { group_chat: { id: string } };

      const response = await fastify.inject({
        method: "POST",
        url: `/api/group-chats/${created.group_chat.id}/members`,
        body: { type: "human", member_id: "user-2", display_name: "User 2" },
      });

      expect(response.statusCode).toBe(201);
      const data = response.json() as { id: string; displayName: string };
      expect(data.id).toBe("user-2");
      expect(data.displayName).toBe("User 2");
    });

    it("should return 400 for duplicate member", async () => {
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: {
          name: "Test",
          created_by: "user-1",
          members: [{ type: "human", member_id: "user-2", display_name: "User 2" }],
        },
      });
      const created = createResponse.json() as { group_chat: { id: string } };

      const response = await fastify.inject({
        method: "POST",
        url: `/api/group-chats/${created.group_chat.id}/members`,
        body: { type: "human", member_id: "user-2", display_name: "User 2 Again" },
      });

      expect(response.statusCode).toBe(400);
      const data = response.json() as { error: string };
      expect(data.error).toContain("already exists");
    });

    it("should add agent member with model", async () => {
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Test", created_by: "user-1" },
      });
      const created = createResponse.json() as { group_chat: { id: string } };

      const response = await fastify.inject({
        method: "POST",
        url: `/api/group-chats/${created.group_chat.id}/members`,
        body: {
          type: "agent",
          member_id: "agent-1",
          display_name: "Assistant",
          model: "claude-sonnet-4",
        },
      });

      expect(response.statusCode).toBe(201);
      const data = response.json() as { type: string; model: string };
      expect(data.type).toBe("agent");
      expect(data.model).toBe("claude-sonnet-4");
    });

    it("should broadcast group_chat_member_joined event", async () => {
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Test", created_by: "user-1" },
      });
      const created = createResponse.json() as { group_chat: { id: string } };
      mockState.events.broadcast.mockClear();

      await fastify.inject({
        method: "POST",
        url: `/api/group-chats/${created.group_chat.id}/members`,
        body: { type: "human", member_id: "user-2", display_name: "User 2" },
      });

      expect(mockState.events.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "group_chat_member_joined" })
      );
    });
  });

  describe("DELETE /api/group-chats/:id/members/:memberId", () => {
    it("should return 404 for non-existent group chat", async () => {
      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/group-chats/non-existent/members/user-1",
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 404 for non-existent member", async () => {
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Test", created_by: "user-1" },
      });
      const created = createResponse.json() as { group_chat: { id: string } };

      const response = await fastify.inject({
        method: "DELETE",
        url: `/api/group-chats/${created.group_chat.id}/members/non-existent`,
      });

      expect(response.statusCode).toBe(404);
      const data = response.json() as { error: string };
      expect(data.error).toContain("not found");
    });

    it("should remove a member", async () => {
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: {
          name: "Test",
          created_by: "user-1",
          members: [{ type: "human", member_id: "user-2", display_name: "User 2" }],
        },
      });
      const created = createResponse.json() as { group_chat: { id: string } };

      const response = await fastify.inject({
        method: "DELETE",
        url: `/api/group-chats/${created.group_chat.id}/members/user-2`,
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as { deleted: string };
      expect(data.deleted).toBe("user-2");
    });

    it("should broadcast group_chat_member_left event", async () => {
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: {
          name: "Test",
          created_by: "user-1",
          members: [{ type: "human", member_id: "user-2", display_name: "User 2" }],
        },
      });
      const created = createResponse.json() as { group_chat: { id: string } };
      mockState.events.broadcast.mockClear();

      await fastify.inject({
        method: "DELETE",
        url: `/api/group-chats/${created.group_chat.id}/members/user-2`,
      });

      expect(mockState.events.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "group_chat_member_left" })
      );
    });
  });

  // ============================================================================
  // Session Management
  // ============================================================================

  describe("GET /api/group-chats/:id/sessions", () => {
    it("should return 404 for non-existent group chat", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/group-chats/non-existent/sessions",
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return empty sessions list initially", async () => {
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Test", created_by: "user-1" },
      });
      const created = createResponse.json() as { group_chat: { id: string } };

      const response = await fastify.inject({
        method: "GET",
        url: `/api/group-chats/${created.group_chat.id}/sessions`,
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as { sessions: unknown[] };
      expect(data.sessions).toHaveLength(0);
    });
  });

  describe("POST /api/group-chats/:id/sessions", () => {
    it("should return 404 for non-existent group chat", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/group-chats/non-existent/sessions",
        body: {},
      });

      expect(response.statusCode).toBe(404);
    });

    it("should create a session", async () => {
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Test", created_by: "user-1" },
      });
      const created = createResponse.json() as { group_chat: { id: string } };

      const response = await fastify.inject({
        method: "POST",
        url: `/api/group-chats/${created.group_chat.id}/sessions`,
        body: { title: "New Session" },
      });

      expect(response.statusCode).toBe(201);
      const data = response.json() as { id: string; title: string; status: string };
      expect(data.id).toBeDefined();
      expect(data.title).toBe("New Session");
      expect(data.status).toBe("active");
    });

    it("should create session with active agents", async () => {
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Test", created_by: "user-1" },
      });
      const created = createResponse.json() as { group_chat: { id: string } };

      const response = await fastify.inject({
        method: "POST",
        url: `/api/group-chats/${created.group_chat.id}/sessions`,
        body: { active_agents: ["agent-1", "agent-2"] },
      });

      expect(response.statusCode).toBe(201);
      const data = response.json() as { activeAgents: string[] };
      expect(data.activeAgents).toEqual(["agent-1", "agent-2"]);
    });
  });

  // ============================================================================
  // Message Handling
  // ============================================================================

  describe("GET /api/group-chats/:id/sessions/:sessionId/messages", () => {
    it("should return 404 for non-existent group chat", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/group-chats/non-existent/sessions/session-1/messages",
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 404 for non-existent session", async () => {
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Test", created_by: "user-1" },
      });
      const created = createResponse.json() as { group_chat: { id: string } };

      const response = await fastify.inject({
        method: "GET",
        url: `/api/group-chats/${created.group_chat.id}/sessions/non-existent/messages`,
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return empty messages for new session", async () => {
      // Create group chat and session
      const createGcResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Test", created_by: "user-1" },
      });
      const gc = createGcResponse.json() as { group_chat: { id: string } };

      const createSessionResponse = await fastify.inject({
        method: "POST",
        url: `/api/group-chats/${gc.group_chat.id}/sessions`,
        body: {},
      });
      const session = createSessionResponse.json() as { id: string };

      const response = await fastify.inject({
        method: "GET",
        url: `/api/group-chats/${gc.group_chat.id}/sessions/${session.id}/messages`,
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as { messages: unknown[]; view: string };
      expect(data.messages).toHaveLength(0);
      expect(data.view).toBe("ui");
    });

    it("should return 400 for agent view without agent_id", async () => {
      const createGcResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Test", created_by: "user-1" },
      });
      const gc = createGcResponse.json() as { group_chat: { id: string } };

      const createSessionResponse = await fastify.inject({
        method: "POST",
        url: `/api/group-chats/${gc.group_chat.id}/sessions`,
        body: {},
      });
      const session = createSessionResponse.json() as { id: string };

      const response = await fastify.inject({
        method: "GET",
        url: `/api/group-chats/${gc.group_chat.id}/sessions/${session.id}/messages?view=agent`,
      });

      expect(response.statusCode).toBe(400);
      const data = response.json() as { error: string };
      expect(data.error).toContain("agent_id");
    });

    it("should support agent view with agent_id", async () => {
      const createGcResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Test", created_by: "user-1" },
      });
      const gc = createGcResponse.json() as { group_chat: { id: string } };

      const createSessionResponse = await fastify.inject({
        method: "POST",
        url: `/api/group-chats/${gc.group_chat.id}/sessions`,
        body: {},
      });
      const session = createSessionResponse.json() as { id: string };

      const response = await fastify.inject({
        method: "GET",
        url: `/api/group-chats/${gc.group_chat.id}/sessions/${session.id}/messages?view=agent&agent_id=agent-1`,
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as { view: string; agent_id: string };
      expect(data.view).toBe("agent");
      expect(data.agent_id).toBe("agent-1");
    });
  });

  describe("POST /api/group-chats/:id/sessions/:sessionId/messages", () => {
    it("should return 404 for non-existent group chat", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/group-chats/non-existent/sessions/session-1/messages",
        body: { content: "Hello", sender_id: "user-1", sender_name: "User" },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 404 for non-existent session", async () => {
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Test", created_by: "user-1" },
      });
      const created = createResponse.json() as { group_chat: { id: string } };

      const response = await fastify.inject({
        method: "POST",
        url: `/api/group-chats/${created.group_chat.id}/sessions/non-existent/messages`,
        body: { content: "Hello", sender_id: "user-1", sender_name: "User" },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should send a message", async () => {
      // Create group chat and session
      const createGcResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Test", created_by: "user-1" },
      });
      const gc = createGcResponse.json() as { group_chat: { id: string } };

      const createSessionResponse = await fastify.inject({
        method: "POST",
        url: `/api/group-chats/${gc.group_chat.id}/sessions`,
        body: {},
      });
      const session = createSessionResponse.json() as { id: string };

      const response = await fastify.inject({
        method: "POST",
        url: `/api/group-chats/${gc.group_chat.id}/sessions/${session.id}/messages`,
        body: { content: "Hello world", sender_id: "user-1", sender_name: "User 1" },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as { message: { type: string; content: string } };
      expect(data.message).toBeDefined();
      expect(data.message.type).toBe("user");
      expect(data.message.content).toBe("Hello world");
    });

    it("should broadcast group_chat_message event", async () => {
      const createGcResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Test", created_by: "user-1" },
      });
      const gc = createGcResponse.json() as { group_chat: { id: string } };

      const createSessionResponse = await fastify.inject({
        method: "POST",
        url: `/api/group-chats/${gc.group_chat.id}/sessions`,
        body: {},
      });
      const session = createSessionResponse.json() as { id: string };
      mockState.events.broadcast.mockClear();

      await fastify.inject({
        method: "POST",
        url: `/api/group-chats/${gc.group_chat.id}/sessions/${session.id}/messages`,
        body: { content: "Test message", sender_id: "user-1", sender_name: "User 1" },
      });

      expect(mockState.events.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "group_chat_message" })
      );
    });

    it("should trigger agent members", async () => {
      // Create group chat with agent member
      const createGcResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: {
          name: "Test",
          created_by: "user-1",
          members: [
            { type: "agent", member_id: "agent-1", display_name: "Assistant" },
          ],
        },
      });
      const gc = createGcResponse.json() as { group_chat: { id: string } };

      const createSessionResponse = await fastify.inject({
        method: "POST",
        url: `/api/group-chats/${gc.group_chat.id}/sessions`,
        body: {},
      });
      const session = createSessionResponse.json() as { id: string };

      const response = await fastify.inject({
        method: "POST",
        url: `/api/group-chats/${gc.group_chat.id}/sessions/${session.id}/messages`,
        body: { content: "Hello agent", sender_id: "user-1", sender_name: "User 1" },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as { agents_triggered: string[] };
      expect(data.agents_triggered).toContain("agent-1");
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe("Integration Tests", () => {
    it("should handle full chat lifecycle", async () => {
      // 1. Create group chat
      const createGcResponse = await fastify.inject({
        method: "POST",
        url: "/api/group-chats",
        body: { name: "Full Lifecycle", created_by: "user-1" },
      });
      expect(createGcResponse.statusCode).toBe(201);
      const gc = createGcResponse.json() as { group_chat: { id: string } };

      // 2. Add member
      const addMemberResponse = await fastify.inject({
        method: "POST",
        url: `/api/group-chats/${gc.group_chat.id}/members`,
        body: { type: "human", member_id: "user-2", display_name: "User 2" },
      });
      expect(addMemberResponse.statusCode).toBe(201);

      // 3. Create session
      const createSessionResponse = await fastify.inject({
        method: "POST",
        url: `/api/group-chats/${gc.group_chat.id}/sessions`,
        body: { title: "Test Session" },
      });
      expect(createSessionResponse.statusCode).toBe(201);
      const session = createSessionResponse.json() as { id: string };

      // 4. Send message
      const sendMessageResponse = await fastify.inject({
        method: "POST",
        url: `/api/group-chats/${gc.group_chat.id}/sessions/${session.id}/messages`,
        body: { content: "Hello", sender_id: "user-1", sender_name: "User 1" },
      });
      expect(sendMessageResponse.statusCode).toBe(200);

      // 5. Get messages
      const getMessagesResponse = await fastify.inject({
        method: "GET",
        url: `/api/group-chats/${gc.group_chat.id}/sessions/${session.id}/messages`,
      });
      expect(getMessagesResponse.statusCode).toBe(200);
      const messages = getMessagesResponse.json() as { messages: unknown[] };
      expect(messages.messages.length).toBeGreaterThan(0);

      // 6. Delete group chat
      const deleteResponse = await fastify.inject({
        method: "DELETE",
        url: `/api/group-chats/${gc.group_chat.id}`,
      });
      expect(deleteResponse.statusCode).toBe(200);

      // 7. Verify deletion
      const getAfterDeleteResponse = await fastify.inject({
        method: "GET",
        url: `/api/group-chats/${gc.group_chat.id}`,
      });
      expect(getAfterDeleteResponse.statusCode).toBe(404);
    });
  });
});
