/**
 * WebSocket Routes Tests
 *
 * Tests for:
 * - WebSocket connection (GET /ws)
 * - Client messages (ping, subscribe, unsubscribe, send_message)
 * - Server messages (event broadcasting, channel filtering)
 * - Event channel mapping (eventToChannel function)
 * - Error handling (invalid messages, plugin unavailable)
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import type { FastifyInstance } from "fastify";

// Mock @fastify/websocket module
vi.mock("@fastify/websocket", () => ({
  default: vi.fn(),
}));

// Import the module under test after mocks
import { registerWebSocketRoutes } from "./ws";
import type { AppState } from "../state";

/**
 * Mock WebSocket interface
 */
interface MockWebSocket {
  send: Mock;
  on: Mock;
  close: Mock;
}

/**
 * Create a mock WebSocket
 */
function createMockSocket(): MockWebSocket {
  return {
    send: vi.fn(),
    on: vi.fn(),
    close: vi.fn(),
  };
}

/**
 * Create a mock EventService
 */
function createMockEventService() {
  const subscribers: Array<(event: { type: string; data?: unknown }) => void> = [];

  return {
    subscribe: vi.fn((listener) => {
      subscribers.push(listener);
      return () => {
        const idx = subscribers.indexOf(listener);
        if (idx >= 0) subscribers.splice(idx, 1);
      };
    }),
    sessionMessage: vi.fn(),
    // Helper to simulate broadcasting an event
    _broadcast: (event: { type: string; data?: unknown }) => {
      subscribers.forEach((fn) => fn(event));
    },
    _getSubscribers: () => subscribers,
  };
}

/**
 * Create a mock AppState
 */
function createMockState() {
  return {
    events: createMockEventService(),
    sessionStore: {},
    cron: {},
    container: {},
    history: {},
    messageBus: {},
  } as unknown as AppState & { events: ReturnType<typeof createMockEventService> };
}

/**
 * Create a mock Fastify instance
 */
function createMockFastify() {
  const routes: Array<{
    path: string;
    options: { websocket?: boolean };
    handler: (socket: MockWebSocket) => void;
  }> = [];

  const registeredPlugins: Array<(instance: unknown) => Promise<void>> = [];

  return {
    register: vi.fn(async (pluginFn: (instance: unknown) => Promise<void>) => {
      registeredPlugins.push(pluginFn);
    }),
    get: vi.fn((path: string, options: { websocket?: boolean }, handler: (socket: MockWebSocket) => void) => {
      routes.push({ path, options, handler });
    }),
    _routes: routes,
    _registeredPlugins: registeredPlugins,
    _executePlugins: async function () {
      for (const plugin of registeredPlugins) {
        await plugin(this);
      }
    },
  } as unknown as FastifyInstance & {
    _routes: typeof routes;
    _registeredPlugins: typeof registeredPlugins;
    _executePlugins: () => Promise<void>;
  };
}

describe("WebSocket Routes", () => {
  let mockFastify: ReturnType<typeof createMockFastify>;
  let mockState: ReturnType<typeof createMockState>;
  let mockSocket: MockWebSocket;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockFastify = createMockFastify();
    mockState = createMockState();
    mockSocket = createMockSocket();

    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Route Registration
  // ============================================================================

  describe("Route registration", () => {
    it("should register a plugin with fastify", () => {
      registerWebSocketRoutes(mockFastify, mockState);

      expect(mockFastify.register).toHaveBeenCalled();
    });

    it("should register /ws route with websocket option", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      expect(mockFastify.get).toHaveBeenCalledWith("/ws", { websocket: true }, expect.any(Function));
    });
  });

  // ============================================================================
  // WebSocket Connection
  // ============================================================================

  describe("WebSocket connection", () => {
    it("should subscribe to events on connection", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      expect(route).toBeDefined();

      // Simulate connection
      route!.handler(mockSocket);

      expect(mockState.events.subscribe).toHaveBeenCalled();
    });

    it("should register message, close, and error handlers", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      expect(mockSocket.on).toHaveBeenCalledWith("message", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("close", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("error", expect.any(Function));
    });
  });

  // ============================================================================
  // Client Messages - ping
  // ============================================================================

  describe("Client message: ping", () => {
    it("should respond with pong", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      // Get the message handler
      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];
      expect(messageHandler).toBeDefined();

      // Send ping message
      const pingMessage = Buffer.from(JSON.stringify({ type: "ping" }));
      messageHandler(pingMessage);

      expect(mockSocket.send).toHaveBeenCalledWith(JSON.stringify({ type: "pong" }));
    });
  });

  // ============================================================================
  // Client Messages - subscribe
  // ============================================================================

  describe("Client message: subscribe", () => {
    it("should add channels and respond with subscribed", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Subscribe to channels
      const subscribeMessage = Buffer.from(
        JSON.stringify({
          type: "subscribe",
          channels: ["cron", "sessions"],
        })
      );
      messageHandler(subscribeMessage);

      expect(mockSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"subscribed"')
      );

      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("subscribed");
      expect(sentMessage.channels).toContain("cron");
      expect(sentMessage.channels).toContain("sessions");
    });

    it("should accumulate channels on multiple subscribes", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // First subscribe
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "subscribe",
            channels: ["cron"],
          })
        )
      );

      // Second subscribe
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "subscribe",
            channels: ["sessions", "agents"],
          })
        )
      );

      const lastCall = mockSocket.send.mock.calls[mockSocket.send.mock.calls.length - 1][0];
      const sentMessage = JSON.parse(lastCall);
      expect(sentMessage.channels).toContain("cron");
      expect(sentMessage.channels).toContain("sessions");
      expect(sentMessage.channels).toContain("agents");
    });

    it("should not respond if channels is missing", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Subscribe without channels
      messageHandler(Buffer.from(JSON.stringify({ type: "subscribe" })));

      expect(mockSocket.send).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Client Messages - unsubscribe
  // ============================================================================

  describe("Client message: unsubscribe", () => {
    it("should remove channels and respond with unsubscribed", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // First subscribe
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "subscribe",
            channels: ["cron", "sessions", "agents"],
          })
        )
      );

      mockSocket.send.mockClear();

      // Then unsubscribe from one
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "unsubscribe",
            channels: ["sessions"],
          })
        )
      );

      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("unsubscribed");
      expect(sentMessage.channels).toContain("cron");
      expect(sentMessage.channels).toContain("agents");
      expect(sentMessage.channels).not.toContain("sessions");
    });

    it("should not respond if channels is missing", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Unsubscribe without channels
      messageHandler(Buffer.from(JSON.stringify({ type: "unsubscribe" })));

      expect(mockSocket.send).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Client Messages - send_message
  // ============================================================================

  describe("Client message: send_message", () => {
    it("should forward message to event service", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Send message
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "send_message",
            sessionId: "session-123",
            content: "Hello, world!",
          })
        )
      );

      expect(mockState.events.sessionMessage).toHaveBeenCalledWith("session-123", "Hello, world!", "user");
    });

    it("should not call sessionMessage if sessionId is missing", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Send message without sessionId
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "send_message",
            content: "Hello",
          })
        )
      );

      expect(mockState.events.sessionMessage).not.toHaveBeenCalled();
    });

    it("should not call sessionMessage if content is missing", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Send message without content
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "send_message",
            sessionId: "session-123",
          })
        )
      );

      expect(mockState.events.sessionMessage).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Server Messages - Event Broadcasting
  // ============================================================================

  describe("Server messages: event broadcasting", () => {
    it("should send events to connected clients with no subscriptions", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      // Broadcast an event
      mockState.events._broadcast({
        type: "task_created",
        data: { taskId: "task-1" },
      });

      expect(mockSocket.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("event");
      expect(sentMessage.channel).toBe("tasks");
      expect(sentMessage.eventType).toBe("task_created");
      expect(sentMessage.data).toEqual({ taskId: "task-1" });
    });

    it("should filter events by subscribed channels", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Subscribe to only 'cron' channel
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "subscribe",
            channels: ["cron"],
          })
        )
      );

      mockSocket.send.mockClear();

      // Broadcast a task event (should be filtered out)
      mockState.events._broadcast({
        type: "task_created",
        data: { taskId: "task-1" },
      });

      expect(mockSocket.send).not.toHaveBeenCalled();

      // Broadcast a cron event (should be sent)
      mockState.events._broadcast({
        type: "cron_job_triggered",
        data: { jobId: "job-1", triggeredAt: Date.now() },
      });

      expect(mockSocket.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.channel).toBe("cron");
    });

    it("should send events for all subscribed channels", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Subscribe to multiple channels
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "subscribe",
            channels: ["cron", "tasks"],
          })
        )
      );

      mockSocket.send.mockClear();

      // Broadcast events for subscribed channels
      mockState.events._broadcast({ type: "task_created", data: { taskId: "task-1" } });
      mockState.events._broadcast({ type: "cron_job_triggered", data: { jobId: "job-1", triggeredAt: Date.now() } });

      expect(mockSocket.send).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // Event Channels
  // ============================================================================

  describe("Event channels", () => {
    it("should map cron events to cron channel", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      mockState.events._broadcast({ type: "cron_job_created", data: {} });
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.channel).toBe("cron");
    });

    it("should map channel events to channels channel", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      mockState.events._broadcast({ type: "channel_message_received", data: {} });
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.channel).toBe("channels");
    });

    it("should map group events to group channel", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      mockState.events._broadcast({ type: "group_chat_created", data: {} });
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.channel).toBe("group");
    });

    it("should map task events to tasks channel", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      mockState.events._broadcast({ type: "task_updated", data: {} });
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.channel).toBe("tasks");
    });

    it("should map session events to sessions channel", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      mockState.events._broadcast({ type: "session_created", data: {} });
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.channel).toBe("sessions");
    });

    it("should map execution_log to sessions channel", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      mockState.events._broadcast({ type: "execution_log", data: {} });
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.channel).toBe("sessions");
    });

    it("should map agent events to agents channel", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      mockState.events._broadcast({ type: "agent_spawned", data: {} });
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.channel).toBe("agents");
    });

    it("should map unknown events to gateway channel", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      mockState.events._broadcast({ type: "unknown_event", data: {} });
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.channel).toBe("gateway");
    });

    it("should map error events to gateway channel", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      mockState.events._broadcast({ type: "error", data: { message: "test" } });
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.channel).toBe("gateway");
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe("Error handling", () => {
    it("should send error response for invalid JSON", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Send invalid JSON
      messageHandler(Buffer.from("not valid json"));

      expect(mockSocket.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("error");
      expect(sentMessage.code).toBe("INVALID_MESSAGE");
      expect(sentMessage.message).toBe("Failed to parse message");
    });

    it("should unsubscribe on connection close", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      // Get the close handler
      const closeHandler = mockSocket.on.mock.calls.find((call) => call[0] === "close")?.[1];
      expect(closeHandler).toBeDefined();

      // Verify subscription exists
      expect(mockState.events._getSubscribers().length).toBe(1);

      // Trigger close
      closeHandler();

      // Verify unsubscribed
      expect(mockState.events._getSubscribers().length).toBe(0);
    });

    it("should unsubscribe on connection error", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      // Get the error handler
      const errorHandler = mockSocket.on.mock.calls.find((call) => call[0] === "error")?.[1];
      expect(errorHandler).toBeDefined();

      // Verify subscription exists
      expect(mockState.events._getSubscribers().length).toBe(1);

      // Trigger error
      errorHandler(new Error("Connection lost"));

      // Verify unsubscribed
      expect(mockState.events._getSubscribers().length).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith("[WebSocket] Error:", expect.any(Error));
    });

    it("should handle @fastify/websocket not available gracefully", async () => {
      // Create a fresh mock that rejects import
      const mockFastifyNoWs = {
        register: vi.fn(async (pluginFn: (instance: unknown) => Promise<void>) => {
          // Simulate plugin that fails to import websocket
          const innerInstance = {
            register: vi.fn(() => Promise.reject(new Error("Module not found"))),
            get: vi.fn(),
          };
          await pluginFn(innerInstance);
        }),
      } as unknown as FastifyInstance;

      // This should not throw
      registerWebSocketRoutes(mockFastifyNoWs, mockState);
      await (mockFastifyNoWs.register as Mock).mock.calls[0][0]({
        register: vi.fn(() => Promise.reject(new Error("Module not found"))),
        get: vi.fn(),
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[Gateway] @fastify/websocket not available, WebSocket routes disabled"
      );
    });
  });

  // ============================================================================
  // Connection Lifecycle
  // ============================================================================

  describe("Connection lifecycle", () => {
    it("should handle multiple simultaneous connections", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");

      // Create multiple sockets
      const socket1 = createMockSocket();
      const socket2 = createMockSocket();

      // Connect both
      route!.handler(socket1);
      route!.handler(socket2);

      // Both should be subscribed
      expect(mockState.events._getSubscribers().length).toBe(2);

      // Broadcast an event
      mockState.events._broadcast({ type: "task_created", data: { taskId: "task-1" } });

      // Both should receive the event
      expect(socket1.send).toHaveBeenCalled();
      expect(socket2.send).toHaveBeenCalled();
    });

    it("should only affect one connection when closing", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");

      // Create multiple sockets
      const socket1 = createMockSocket();
      const socket2 = createMockSocket();

      // Connect both
      route!.handler(socket1);
      route!.handler(socket2);

      expect(mockState.events._getSubscribers().length).toBe(2);

      // Close one connection
      const closeHandler1 = socket1.on.mock.calls.find((call) => call[0] === "close")?.[1];
      closeHandler1();

      // Only one should remain subscribed
      expect(mockState.events._getSubscribers().length).toBe(1);

      // Broadcast an event
      socket1.send.mockClear();
      socket2.send.mockClear();
      mockState.events._broadcast({ type: "task_created", data: { taskId: "task-1" } });

      // Only socket2 should receive
      expect(socket1.send).not.toHaveBeenCalled();
      expect(socket2.send).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // ServerMessage Format
  // ============================================================================

  describe("ServerMessage format", () => {
    it("should format pong message correctly", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];
      messageHandler(Buffer.from(JSON.stringify({ type: "ping" })));

      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage).toEqual({ type: "pong" });
    });

    it("should format subscribed message with channels array", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "subscribe",
            channels: ["cron", "tasks"],
          })
        )
      );

      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("subscribed");
      expect(Array.isArray(sentMessage.channels)).toBe(true);
      expect(sentMessage.channels.length).toBe(2);
    });

    it("should format event message with all fields", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      mockState.events._broadcast({
        type: "task_created",
        data: { taskId: "task-123", title: "Test Task" },
      });

      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("event");
      expect(sentMessage.channel).toBe("tasks");
      expect(sentMessage.eventType).toBe("task_created");
      expect(sentMessage.data).toEqual({ taskId: "task-123", title: "Test Task" });
    });

    it("should format error message with code and message", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];
      messageHandler(Buffer.from("invalid"));

      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("error");
      expect(sentMessage.code).toBe("INVALID_MESSAGE");
      expect(sentMessage.message).toBe("Failed to parse message");
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge cases", () => {
    it("should handle empty channels array in subscribe", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "subscribe",
            channels: [],
          })
        )
      );

      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("subscribed");
      expect(sentMessage.channels).toEqual([]);
    });

    it("should handle duplicate channel subscriptions", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Subscribe with duplicates
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "subscribe",
            channels: ["cron", "cron", "cron"],
          })
        )
      );

      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("subscribed");
      // Set should deduplicate
      expect(sentMessage.channels).toEqual(["cron"]);
    });

    it("should handle unsubscribe from non-subscribed channel", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Subscribe to one channel
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "subscribe",
            channels: ["cron"],
          })
        )
      );

      mockSocket.send.mockClear();

      // Unsubscribe from different channel
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "unsubscribe",
            channels: ["tasks"],
          })
        )
      );

      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("unsubscribed");
      expect(sentMessage.channels).toEqual(["cron"]);
    });

    it("should handle unknown message type gracefully", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Send unknown message type (valid JSON but unknown type)
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "unknown_type",
            data: "test",
          })
        )
      );

      // Should not send any response for unknown types (no error, just ignored)
      expect(mockSocket.send).not.toHaveBeenCalled();
    });

    it("should handle empty content in send_message", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      await mockFastify._executePlugins();

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Send message with empty string content (falsy but defined)
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "send_message",
            sessionId: "session-123",
            content: "",
          })
        )
      );

      // Empty string is falsy, so sessionMessage should not be called
      expect(mockState.events.sessionMessage).not.toHaveBeenCalled();
    });
  });
});
