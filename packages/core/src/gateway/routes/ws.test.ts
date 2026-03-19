/**
 * WebSocket Routes Tests
 *
 * Tests for:
 * - WebSocket connection (GET /ws)
 * - Client messages (Ping, Subscribe, Unsubscribe, SendMessage)
 * - Server messages (Event broadcasting with PascalCase types, snake_case data)
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
 * Create a mock Fastify instance for WebSocket testing
 */
function createMockFastify() {
  const routes: Array<{
    path: string;
    options: { websocket?: boolean };
    handler: (socket: MockWebSocket) => void;
  }> = [];

  return {
    register: vi.fn(),
    get: vi.fn((path: string, options: { websocket?: boolean }, handler: (socket: MockWebSocket) => void) => {
      routes.push({ path, options, handler });
    }),
    hasDecorator: vi.fn((name: string) => name === "websocketServer"),
    _routes: routes,
  } as unknown as FastifyInstance & {
    _routes: typeof routes;
    hasDecorator: Mock;
  };
}

describe("WebSocket Routes", () => {
  let mockFastify: ReturnType<typeof createMockFastify>;
  let mockState: ReturnType<typeof createMockState>;
  let mockSocket: MockWebSocket;

  beforeEach(() => {
    mockFastify = createMockFastify();
    mockState = createMockState();
    mockSocket = createMockSocket();

    // Suppress console output during tests (ws.ts uses structured logger, but some paths may still log)
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Route Registration
  // ============================================================================

  describe("Route registration", () => {
    it("should register /ws route with websocket option when decorator is present", () => {
      registerWebSocketRoutes(mockFastify, mockState);

      expect(mockFastify.get).toHaveBeenCalledWith("/ws", { websocket: true }, expect.any(Function));
      expect(mockFastify._routes).toHaveLength(1);
      expect(mockFastify._routes[0].path).toBe("/ws");
      expect(mockFastify._routes[0].options.websocket).toBe(true);
    });
  });

  // ============================================================================
  // WebSocket Connection
  // ============================================================================

  describe("WebSocket connection", () => {
    it("should subscribe to events on connection", async () => {
      registerWebSocketRoutes(mockFastify, mockState);

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      expect(route).toBeDefined();

      // Simulate connection
      route!.handler(mockSocket);

      expect(mockState.events.subscribe).toHaveBeenCalledWith(expect.any(Function));
      expect(mockState.events.subscribe).toHaveBeenCalledTimes(1);
    });

    it("should register message, close, and error handlers", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      expect(mockSocket.on).toHaveBeenCalledWith("message", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("close", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("error", expect.any(Function));
    });
  });

  // ============================================================================
  // Client Messages - Ping (PascalCase)
  // ============================================================================

  describe("Client message: Ping", () => {
    it("should respond with Pong", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      // Get the message handler
      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];
      expect(messageHandler).toBeDefined();

      // Send Ping message (PascalCase)
      const pingMessage = Buffer.from(JSON.stringify({ type: "Ping" }));
      messageHandler(pingMessage);

      expect(mockSocket.send).toHaveBeenCalledWith(JSON.stringify({ type: "Pong" }));
    });
  });

  // ============================================================================
  // Client Messages - Subscribe (PascalCase with nested data)
  // ============================================================================

  describe("Client message: Subscribe", () => {
    it("should add channels and respond with Subscribed", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Subscribe to channels (PascalCase with nested data)
      const subscribeMessage = Buffer.from(
        JSON.stringify({
          type: "Subscribe",
          data: { channels: ["cron", "sessions"] },
        })
      );
      messageHandler(subscribeMessage);

      expect(mockSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"Subscribed"')
      );

      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("Subscribed");
      expect(sentMessage.data.channels).toContain("cron");
      expect(sentMessage.data.channels).toContain("sessions");
    });

    it("should accumulate channels on multiple subscribes", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // First subscribe
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "Subscribe",
            data: { channels: ["cron"] },
          })
        )
      );

      // Second subscribe
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "Subscribe",
            data: { channels: ["sessions", "agents"] },
          })
        )
      );

      const lastCall = mockSocket.send.mock.calls[mockSocket.send.mock.calls.length - 1][0];
      const sentMessage = JSON.parse(lastCall);
      expect(sentMessage.data.channels).toContain("cron");
      expect(sentMessage.data.channels).toContain("sessions");
      expect(sentMessage.data.channels).toContain("agents");
    });

    it("should not respond if channels is missing", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Subscribe without channels
      messageHandler(Buffer.from(JSON.stringify({ type: "Subscribe" })));

      expect(mockSocket.send).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Client Messages - Unsubscribe (PascalCase)
  // ============================================================================

  describe("Client message: Unsubscribe", () => {
    it("should remove channels and respond with Unsubscribed", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // First subscribe
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "Subscribe",
            data: { channels: ["cron", "sessions", "agents"] },
          })
        )
      );

      mockSocket.send.mockClear();

      // Then unsubscribe from one
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "Unsubscribe",
            data: { channels: ["sessions"] },
          })
        )
      );

      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("Unsubscribed");
      expect(sentMessage.data.channels).toContain("cron");
      expect(sentMessage.data.channels).toContain("agents");
      expect(sentMessage.data.channels).not.toContain("sessions");
    });

    it("should not respond if channels is missing", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Unsubscribe without channels
      messageHandler(Buffer.from(JSON.stringify({ type: "Unsubscribe" })));

      expect(mockSocket.send).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Client Messages - SendMessage (PascalCase with snake_case fields)
  // ============================================================================

  describe("Client message: SendMessage", () => {
    it("should forward message to event service", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Send message with snake_case fields
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "SendMessage",
            data: {
              session_id: "session-123",
              content: "Hello, world!",
            },
          })
        )
      );

      expect(mockState.events.sessionMessage).toHaveBeenCalledWith("session-123", "Hello, world!", "user");
    });

    it("should not call sessionMessage if session_id is missing", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Send message without session_id
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "SendMessage",
            data: { content: "Hello" },
          })
        )
      );

      expect(mockState.events.sessionMessage).not.toHaveBeenCalled();
    });

    it("should not call sessionMessage if content is missing", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Send message without content
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "SendMessage",
            data: { session_id: "session-123" },
          })
        )
      );

      expect(mockState.events.sessionMessage).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Server Messages - Event Broadcasting (with PascalCase type and snake_case data)
  // ============================================================================

  describe("Server messages: event broadcasting", () => {
    it("should send events to connected clients with no subscriptions", async () => {
      registerWebSocketRoutes(mockFastify, mockState);

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      // Broadcast an event (using snake_case as per codebase standard)
      mockState.events._broadcast({
        type: "task_created",
        data: { task_id: "task-1" },
      });

      const expectedMessage = JSON.stringify({
        type: "Event",
        data: {
          channel: "tasks",
          payload: {
            type: "TaskCreated",
            data: { task_id: "task-1" },
          },
        },
      });
      expect(mockSocket.send).toHaveBeenCalledWith(expectedMessage);
      expect(mockSocket.send).toHaveBeenCalledTimes(1);
    });

    it("should filter events by subscribed channels", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Subscribe to only 'cron' channel
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "Subscribe",
            data: { channels: ["cron"] },
          })
        )
      );

      mockSocket.send.mockClear();

      // Broadcast a task event (should be filtered out)
      mockState.events._broadcast({
        type: "task_created",
        data: { task_id: "task-1" },
      });

      expect(mockSocket.send).not.toHaveBeenCalled();

      // Broadcast a cron event (should be sent)
      const triggeredAt = Date.now();
      mockState.events._broadcast({
        type: "cron_job_triggered",
        data: { job_id: "job-1", triggered_at: triggeredAt },
      });

      const expectedCronMessage = JSON.stringify({
        type: "Event",
        data: {
          channel: "cron",
          payload: {
            type: "CronJobTriggered",
            data: { job_id: "job-1", triggered_at: triggeredAt },
          },
        },
      });
      expect(mockSocket.send).toHaveBeenCalledWith(expectedCronMessage);
      expect(mockSocket.send).toHaveBeenCalledTimes(1);
    });

    it("should send events for all subscribed channels", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Subscribe to multiple channels
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "Subscribe",
            data: { channels: ["cron", "tasks"] },
          })
        )
      );

      mockSocket.send.mockClear();

      // Broadcast events for subscribed channels (using snake_case)
      mockState.events._broadcast({ type: "task_created", data: { task_id: "task-1" } });
      mockState.events._broadcast({ type: "cron_job_triggered", data: { job_id: "job-1", triggered_at: Date.now() } });

      expect(mockSocket.send).toHaveBeenCalledTimes(2);
    });

    it("should pass through snake_case data fields as-is", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      // Broadcast cron_job_completed event with snake_case fields (codebase standard)
      mockState.events._broadcast({
        type: "cron_job_completed",
        data: {
          job_id: "job-1",
          job_name: "Test Job",
          job_type: "script",
          duration_ms: 1234,
          completed_at: 1234567890,
        },
      });

      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("Event");
      expect(sentMessage.data.payload.type).toBe("CronJobCompleted");
      expect(sentMessage.data.payload.data).toEqual({
        job_id: "job-1",
        job_name: "Test Job",
        job_type: "script",
        duration_ms: 1234,
        completed_at: 1234567890,
      });
    });
  });

  // ============================================================================
  // Event Channels
  // ============================================================================

  describe("Event channels", () => {
    it("should map cron events to cron channel", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      mockState.events._broadcast({ type: "cron_job_created", data: {} });
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.data.channel).toBe("cron");
    });

    it("should map channel events to channels channel", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      mockState.events._broadcast({ type: "channel_message_received", data: {} });
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.data.channel).toBe("channels");
    });

    it("should map group events to group channel", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      mockState.events._broadcast({ type: "group_chat_created", data: {} });
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.data.channel).toBe("group");
    });

    it("should map task events to tasks channel", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      mockState.events._broadcast({ type: "task_updated", data: {} });
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.data.channel).toBe("tasks");
    });

    it("should map session events to sessions channel", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      mockState.events._broadcast({ type: "session_created", data: {} });
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.data.channel).toBe("sessions");
    });

    it("should map execution_log to sessions channel", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      mockState.events._broadcast({ type: "execution_log", data: {} });
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.data.channel).toBe("sessions");
    });

    it("should map agent events to agents channel", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      mockState.events._broadcast({ type: "agent_spawned", data: {} });
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.data.channel).toBe("agents");
    });

    it("should map unknown events to gateway channel", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      mockState.events._broadcast({ type: "unknown_event", data: {} });
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.data.channel).toBe("gateway");
    });

    it("should map error events to gateway channel", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      mockState.events._broadcast({ type: "error", data: { message: "test" } });
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.data.channel).toBe("gateway");
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe("Error handling", () => {
    it("should send Error response for invalid JSON", async () => {
      registerWebSocketRoutes(mockFastify, mockState);

      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Send invalid JSON
      messageHandler(Buffer.from("not valid json"));

      const expectedErrorMessage = JSON.stringify({
        type: "Error",
        data: { message: "Failed to parse message" },
      });
      expect(mockSocket.send).toHaveBeenCalledWith(expectedErrorMessage);
      expect(mockSocket.send).toHaveBeenCalledTimes(1);
    });

    it("should unsubscribe on connection close", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
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
      // Note: error logging now uses structured logger (log.error), not console.error
    });

    it("should handle @fastify/websocket not available gracefully", async () => {
      // Create a mock fastify without websocket decorator
      const mockFastifyNoWs = {
        register: vi.fn(),
        hasDecorator: vi.fn(() => false), // Simulate websocket plugin not registered
      } as unknown as FastifyInstance;

      // This should not throw - it should just return early
      registerWebSocketRoutes(mockFastifyNoWs, mockState);

      // Should not have registered any plugins since websocket is not available
      expect(mockFastifyNoWs.register).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Connection Lifecycle
  // ============================================================================

  describe("Connection lifecycle", () => {
    it("should handle multiple simultaneous connections", async () => {
      registerWebSocketRoutes(mockFastify, mockState);

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
      mockState.events._broadcast({ type: "task_created", data: { task_id: "task-1" } });

      // Both should receive the same event message
      const expectedMessage = JSON.stringify({
        type: "Event",
        data: {
          channel: "tasks",
          payload: {
            type: "TaskCreated",
            data: { task_id: "task-1" },
          },
        },
      });
      expect(socket1.send).toHaveBeenCalledWith(expectedMessage);
      expect(socket2.send).toHaveBeenCalledWith(expectedMessage);
      expect(socket1.send).toHaveBeenCalledTimes(1);
      expect(socket2.send).toHaveBeenCalledTimes(1);
    });

    it("should only affect one connection when closing", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
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
      mockState.events._broadcast({ type: "task_created", data: { task_id: "task-1" } });

      // Only socket2 should receive
      const expectedMessage = JSON.stringify({
        type: "Event",
        data: {
          channel: "tasks",
          payload: {
            type: "TaskCreated",
            data: { task_id: "task-1" },
          },
        },
      });
      expect(socket1.send).not.toHaveBeenCalled();
      expect(socket2.send).toHaveBeenCalledWith(expectedMessage);
      expect(socket2.send).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // ServerMessage Format
  // ============================================================================

  describe("ServerMessage format", () => {
    it("should format Pong message correctly", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];
      messageHandler(Buffer.from(JSON.stringify({ type: "Ping" })));

      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage).toEqual({ type: "Pong" });
    });

    it("should format Subscribed message with channels in data", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "Subscribe",
            data: { channels: ["cron", "tasks"] },
          })
        )
      );

      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("Subscribed");
      expect(sentMessage.data).toBeDefined();
      expect(Array.isArray(sentMessage.data.channels)).toBe(true);
      expect(sentMessage.data.channels.length).toBe(2);
    });

    it("should format Event message with nested payload structure", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      mockState.events._broadcast({
        type: "task_created",
        data: { task_id: "task-123", title: "Test Task" },
      });

      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("Event");
      expect(sentMessage.data.channel).toBe("tasks");
      expect(sentMessage.data.payload.type).toBe("TaskCreated");
      expect(sentMessage.data.payload.data).toEqual({ task_id: "task-123", title: "Test Task" });
    });

    it("should format Error message with message in data", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];
      messageHandler(Buffer.from("invalid"));

      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("Error");
      expect(sentMessage.data.message).toBe("Failed to parse message");
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge cases", () => {
    it("should handle empty channels array in subscribe", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "Subscribe",
            data: { channels: [] },
          })
        )
      );

      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("Subscribed");
      expect(sentMessage.data.channels).toEqual([]);
    });

    it("should handle duplicate channel subscriptions", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Subscribe with duplicates
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "Subscribe",
            data: { channels: ["cron", "cron", "cron"] },
          })
        )
      );

      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("Subscribed");
      // Set should deduplicate
      expect(sentMessage.data.channels).toEqual(["cron"]);
    });

    it("should handle unsubscribe from non-subscribed channel", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Subscribe to one channel
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "Subscribe",
            data: { channels: ["cron"] },
          })
        )
      );

      mockSocket.send.mockClear();

      // Unsubscribe from different channel
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "Unsubscribe",
            data: { channels: ["tasks"] },
          })
        )
      );

      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("Unsubscribed");
      expect(sentMessage.data.channels).toEqual(["cron"]);
    });

    it("should handle unknown message type gracefully", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Send unknown message type (valid JSON but unknown type)
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "UnknownType",
            data: "test",
          })
        )
      );

      // Should not send any response for unknown types (no error, just ignored)
      expect(mockSocket.send).not.toHaveBeenCalled();
    });

    it("should handle empty content in SendMessage", async () => {
      registerWebSocketRoutes(mockFastify, mockState);
      
      const route = mockFastify._routes.find((r) => r.path === "/ws");
      route!.handler(mockSocket);

      const messageHandler = mockSocket.on.mock.calls.find((call) => call[0] === "message")?.[1];

      // Send message with empty string content (falsy but defined)
      messageHandler(
        Buffer.from(
          JSON.stringify({
            type: "SendMessage",
            data: {
              session_id: "session-123",
              content: "",
            },
          })
        )
      );

      // Empty string is falsy, so sessionMessage should not be called
      expect(mockState.events.sessionMessage).not.toHaveBeenCalled();
    });
  });
});
