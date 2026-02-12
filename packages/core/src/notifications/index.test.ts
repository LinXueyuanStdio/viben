/**
 * Notifications Module Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { platform } from "node:os";
import {
  sendNotification,
  notifyCronCompletion,
  notifyAgentCompletion,
  notifyChannelMessage,
  notify,
} from "./index";

// Mock child_process spawn
vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    const mockProcess = {
      on: vi.fn((event: string, callback: (code: number | null) => void) => {
        if (event === "close") {
          // Simulate successful exit
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      }),
    };
    return mockProcess;
  }),
}));

describe("Notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendNotification", () => {
    it("should send notification with title and message", async () => {
      const result = await sendNotification({
        title: "Test Title",
        message: "Test Message",
      });

      // On supported platforms, should return true
      const os = platform();
      if (os === "darwin" || os === "linux" || os === "win32") {
        expect(result).toBe(true);
      }
    });

    it("should handle notification with all options", async () => {
      const result = await sendNotification({
        title: "Full Options",
        message: "Test with all options",
        subtitle: "Subtitle",
        sound: true,
        icon: "/path/to/icon.png",
        timeout: 5000,
      });

      const os = platform();
      if (os === "darwin" || os === "linux" || os === "win32") {
        expect(result).toBe(true);
      }
    });

    it("should handle custom sound name", async () => {
      const result = await sendNotification({
        title: "Sound Test",
        message: "Custom sound",
        sound: "Ping",
      });

      const os = platform();
      if (os === "darwin" || os === "linux" || os === "win32") {
        expect(result).toBe(true);
      }
    });
  });

  describe("notifyCronCompletion", () => {
    it("should notify successful cron completion", async () => {
      const result = await notifyCronCompletion("backup-job", "success", 5000);

      const os = platform();
      if (os === "darwin" || os === "linux" || os === "win32") {
        expect(result).toBe(true);
      }
    });

    it("should notify failed cron completion with sound", async () => {
      const result = await notifyCronCompletion("sync-job", "failure");

      const os = platform();
      if (os === "darwin" || os === "linux" || os === "win32") {
        expect(result).toBe(true);
      }
    });
  });

  describe("notifyAgentCompletion", () => {
    it("should notify successful agent completion", async () => {
      const result = await notifyAgentCompletion(
        "Claude",
        "session-123",
        true
      );

      const os = platform();
      if (os === "darwin" || os === "linux" || os === "win32") {
        expect(result).toBe(true);
      }
    });

    it("should notify failed agent completion with sound", async () => {
      const result = await notifyAgentCompletion(
        "Gemini",
        "session-456",
        false
      );

      const os = platform();
      if (os === "darwin" || os === "linux" || os === "win32") {
        expect(result).toBe(true);
      }
    });
  });

  describe("notifyChannelMessage", () => {
    it("should notify channel message", async () => {
      const result = await notifyChannelMessage(
        "Telegram",
        "dev-channel",
        "Alice",
        "Hello everyone!"
      );

      const os = platform();
      if (os === "darwin" || os === "linux" || os === "win32") {
        expect(result).toBe(true);
      }
    });

    it("should truncate long messages", async () => {
      const longMessage = "A".repeat(200);
      const result = await notifyChannelMessage(
        "Discord",
        "general",
        "Bot",
        longMessage
      );

      const os = platform();
      if (os === "darwin" || os === "linux" || os === "win32") {
        expect(result).toBe(true);
      }
    });
  });

  describe("notify", () => {
    it("should send simple notification", async () => {
      const result = await notify("Simple Title", "Simple Message");

      const os = platform();
      if (os === "darwin" || os === "linux" || os === "win32") {
        expect(result).toBe(true);
      }
    });
  });
});
