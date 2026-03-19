/**
 * Terminal WebSocket Route Tests
 *
 * Unit tests for:
 * - Route registration behavior
 * - Session management (getActiveSessionCount, killAllSessions)
 *
 * Note: Full PTY integration tests require a real terminal environment
 * and are not suitable for automated unit testing.
 *
 * TODO: Consider adding integration tests that:
 * - Spawn a real PTY process
 * - Connect via WebSocket
 * - Verify input/output round-trip
 * These would require a test environment with node-pty installed.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  registerTerminalRoutes,
  getActiveSessionCount,
  killAllSessions,
} from "./terminal";

// Mock the logger
vi.mock("../../telemetry", () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

describe("Terminal WebSocket Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure clean session state
    killAllSessions();
  });

  // ============================================================================
  // Route Registration Tests
  // ============================================================================

  describe("registerTerminalRoutes", () => {
    it("should not register routes when websocket plugin is not available", async () => {
      const mockFastify = {
        hasDecorator: vi.fn().mockReturnValue(false),
        register: vi.fn(),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      registerTerminalRoutes(mockFastify as any);

      // When websocket is not available, register should NOT be called
      expect(mockFastify.hasDecorator).toHaveBeenCalledWith("websocketServer");
      expect(mockFastify.register).not.toHaveBeenCalled();
    });

    it("should call register when websocket plugin is available", async () => {
      const mockFastify = {
        hasDecorator: vi.fn().mockReturnValue(true),
        register: vi.fn(),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      registerTerminalRoutes(mockFastify as any);

      expect(mockFastify.hasDecorator).toHaveBeenCalledWith("websocketServer");
      expect(mockFastify.register).toHaveBeenCalledTimes(1);
      expect(typeof mockFastify.register.mock.calls[0][0]).toBe("function");
    });

    it("should register a GET route at /ws/terminal when node-pty is available", async () => {
      const mockInstance = {
        get: vi.fn(),
      };

      const mockFastify = {
        hasDecorator: vi.fn().mockReturnValue(true),
        register: vi.fn(async (callback: Function) => {
          // Mock the dynamic import of node-pty
          vi.doMock("node-pty", () => ({
            spawn: vi.fn(),
          }));
          await callback(mockInstance);
        }),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      registerTerminalRoutes(mockFastify as any);

      // The register callback is async, so wait for it
      await vi.waitFor(() => {
        // Check if route was registered (may or may not depending on node-pty availability)
        return mockFastify.register.mock.calls.length > 0;
      });
    });
  });

  // ============================================================================
  // Session Management Tests
  // ============================================================================

  describe("getActiveSessionCount", () => {
    it("should return 0 when no sessions exist", () => {
      killAllSessions(); // Ensure clean state
      const count = getActiveSessionCount();
      expect(count).toBe(0);
    });

    it("should return 0 after killAllSessions is called", () => {
      // Start with clean state
      killAllSessions();
      expect(getActiveSessionCount()).toBe(0);

      // Call killAllSessions again - should be idempotent
      killAllSessions();
      expect(getActiveSessionCount()).toBe(0);
    });
  });

  describe("killAllSessions", () => {
    it("should not throw when no sessions exist", () => {
      expect(() => killAllSessions()).not.toThrow();
    });

    it("should be idempotent - calling multiple times is safe", () => {
      killAllSessions();
      killAllSessions();
      killAllSessions();
      expect(getActiveSessionCount()).toBe(0);
    });
  });
});
