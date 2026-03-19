/**
 * Notifications Module Tests
 *
 * Tests are organized into:
 * 1. Unit tests for escape functions
 * 2. Command building tests (verifying spawn arguments)
 * 3. Error handling tests
 * 4. Convenience function tests
 */
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { spawn } from "node:child_process";
import { platform } from "node:os";
import { EventEmitter } from "node:events";
import {
  sendNotification,
  notifyCronCompletion,
  notifyAgentCompletion,
  notifyChannelMessage,
  notify,
  escapeAppleScript,
  escapePS,
  escapeXml,
} from "./index";

// Mock child_process spawn
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

// Mock os platform
vi.mock("node:os", () => ({
  platform: vi.fn(),
}));

const mockSpawn = spawn as Mock;
const mockPlatform = platform as Mock;

/**
 * Create a mock child process that emits events
 */
function createMockProcess(exitCode: number | null = 0, emitError: Error | null = null) {
  const proc = new EventEmitter();
  setTimeout(() => {
    if (emitError) {
      proc.emit("error", emitError);
    } else {
      proc.emit("close", exitCode);
    }
  }, 0);
  return proc;
}

describe("Escape Functions", () => {
  describe("escapeAppleScript", () => {
    it("should escape double quotes", () => {
      expect(escapeAppleScript('say "hello"')).toBe('say \\"hello\\"');
    });

    it("should escape backslashes", () => {
      expect(escapeAppleScript("path\\to\\file")).toBe("path\\\\to\\\\file");
    });

    it("should escape both backslashes and quotes", () => {
      expect(escapeAppleScript('path\\to\\"file"')).toBe('path\\\\to\\\\\\"file\\"');
    });

    it("should handle empty string", () => {
      expect(escapeAppleScript("")).toBe("");
    });

    it("should handle string without special characters", () => {
      expect(escapeAppleScript("hello world")).toBe("hello world");
    });

    it("should escape backslashes before quotes (order matters)", () => {
      // Backslash followed by quote should become \\" (escaped backslash + escaped quote)
      expect(escapeAppleScript('\\"')).toBe('\\\\\\"');
    });
  });

  describe("escapePS (PowerShell)", () => {
    it("should escape backticks", () => {
      expect(escapePS("hello`world")).toBe("hello``world");
    });

    it("should escape double quotes", () => {
      expect(escapePS('say "hello"')).toBe('say `"hello`"');
    });

    it("should escape dollar signs", () => {
      expect(escapePS("$variable")).toBe("`$variable");
    });

    it("should escape all special characters", () => {
      expect(escapePS('`"$test')).toBe('```"`$test');
    });

    it("should handle empty string", () => {
      expect(escapePS("")).toBe("");
    });

    it("should handle string without special characters", () => {
      expect(escapePS("hello world")).toBe("hello world");
    });
  });

  describe("escapeXml", () => {
    it("should escape ampersand", () => {
      expect(escapeXml("foo & bar")).toBe("foo &amp; bar");
    });

    it("should escape less than", () => {
      expect(escapeXml("a < b")).toBe("a &lt; b");
    });

    it("should escape greater than", () => {
      expect(escapeXml("a > b")).toBe("a &gt; b");
    });

    it("should escape double quotes", () => {
      expect(escapeXml('say "hello"')).toBe("say &quot;hello&quot;");
    });

    it("should escape single quotes", () => {
      expect(escapeXml("it's")).toBe("it&apos;s");
    });

    it("should escape all special characters", () => {
      expect(escapeXml('<tag attr="value">a & b\'s</tag>')).toBe(
        "&lt;tag attr=&quot;value&quot;&gt;a &amp; b&apos;s&lt;/tag&gt;"
      );
    });

    it("should handle empty string", () => {
      expect(escapeXml("")).toBe("");
    });

    it("should handle string without special characters", () => {
      expect(escapeXml("hello world")).toBe("hello world");
    });
  });
});

describe("Notification Command Building", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSpawn.mockImplementation(() => createMockProcess(0));
  });

  describe("macOS (darwin)", () => {
    beforeEach(() => {
      mockPlatform.mockReturnValue("darwin");
    });

    it("should build correct osascript command with title and message", async () => {
      await sendNotification({ title: "Test Title", message: "Test Message" });

      expect(mockSpawn).toHaveBeenCalledWith("osascript", [
        "-e",
        'display notification "Test Message" with title "Test Title"',
      ]);
    });

    it("should include subtitle when provided", async () => {
      await sendNotification({
        title: "Test",
        message: "Message",
        subtitle: "Subtitle",
      });

      expect(mockSpawn).toHaveBeenCalledWith("osascript", [
        "-e",
        'display notification "Message" with title "Test" subtitle "Subtitle"',
      ]);
    });

    it("should include default sound when sound is true", async () => {
      await sendNotification({
        title: "Test",
        message: "Message",
        sound: true,
      });

      expect(mockSpawn).toHaveBeenCalledWith("osascript", [
        "-e",
        'display notification "Message" with title "Test" sound name "default"',
      ]);
    });

    it("should include custom sound name when provided", async () => {
      await sendNotification({
        title: "Test",
        message: "Message",
        sound: "Ping",
      });

      expect(mockSpawn).toHaveBeenCalledWith("osascript", [
        "-e",
        'display notification "Message" with title "Test" sound name "Ping"',
      ]);
    });

    it("should escape special characters in title and message", async () => {
      await sendNotification({
        title: 'Title with "quotes"',
        message: "Message with\\backslash",
      });

      expect(mockSpawn).toHaveBeenCalledWith("osascript", [
        "-e",
        'display notification "Message with\\\\backslash" with title "Title with \\"quotes\\""',
      ]);
    });

    it("should include all options together", async () => {
      await sendNotification({
        title: "Full",
        message: "Test",
        subtitle: "Sub",
        sound: "Glass",
      });

      expect(mockSpawn).toHaveBeenCalledWith("osascript", [
        "-e",
        'display notification "Test" with title "Full" subtitle "Sub" sound name "Glass"',
      ]);
    });
  });

  describe("Linux", () => {
    beforeEach(() => {
      mockPlatform.mockReturnValue("linux");
    });

    it("should build correct notify-send command with title and message", async () => {
      await sendNotification({ title: "Test Title", message: "Test Message" });

      expect(mockSpawn).toHaveBeenCalledWith("notify-send", ["Test Title", "Test Message"]);
    });

    it("should include icon when provided", async () => {
      await sendNotification({
        title: "Test",
        message: "Message",
        icon: "/path/to/icon.png",
      });

      expect(mockSpawn).toHaveBeenCalledWith("notify-send", [
        "Test",
        "Message",
        "-i",
        "/path/to/icon.png",
      ]);
    });

    it("should include timeout when provided", async () => {
      await sendNotification({
        title: "Test",
        message: "Message",
        timeout: 5000,
      });

      expect(mockSpawn).toHaveBeenCalledWith("notify-send", ["Test", "Message", "-t", "5000"]);
    });

    it("should include both icon and timeout", async () => {
      await sendNotification({
        title: "Test",
        message: "Message",
        icon: "/icon.png",
        timeout: 3000,
      });

      expect(mockSpawn).toHaveBeenCalledWith("notify-send", [
        "Test",
        "Message",
        "-i",
        "/icon.png",
        "-t",
        "3000",
      ]);
    });
  });

  describe("Windows (win32)", () => {
    beforeEach(() => {
      mockPlatform.mockReturnValue("win32");
    });

    it("should build PowerShell command with correct arguments", async () => {
      await sendNotification({ title: "Test Title", message: "Test Message" });

      expect(mockSpawn).toHaveBeenCalledWith(
        "powershell",
        ["-NoProfile", "-NonInteractive", "-Command", expect.any(String)],
        { shell: false }
      );
    });

    it("should include escaped title and message in script", async () => {
      await sendNotification({ title: "Test", message: "Hello" });

      const [, args] = mockSpawn.mock.calls[0];
      const script = args[3];

      expect(script).toContain("Test");
      expect(script).toContain("Hello");
      expect(script).toContain("New-BurntToastNotification");
    });

    it("should include icon parameter when provided", async () => {
      await sendNotification({
        title: "Test",
        message: "Message",
        icon: "C:\\path\\to\\icon.png",
      });

      const [, args] = mockSpawn.mock.calls[0];
      const script = args[3];

      expect(script).toContain('-AppLogo "C:\\path\\to\\icon.png"');
    });

    it("should escape special PowerShell characters", async () => {
      await sendNotification({
        title: 'Title with "quotes"',
        message: "$variable",
      });

      const [, args] = mockSpawn.mock.calls[0];
      const script = args[3];

      expect(script).toContain('`"');
      expect(script).toContain("`$");
    });

    it("should include XML-escaped content in fallback template", async () => {
      await sendNotification({
        title: "A & B",
        message: "<test>",
      });

      const [, args] = mockSpawn.mock.calls[0];
      const script = args[3];

      expect(script).toContain("&amp;");
      expect(script).toContain("&lt;test&gt;");
    });
  });

  describe("Unsupported platform", () => {
    it("should return false for unsupported platform", async () => {
      mockPlatform.mockReturnValue("freebsd");

      const result = await sendNotification({ title: "Test", message: "Message" });

      expect(result).toBe(false);
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });
});

describe("Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatform.mockReturnValue("darwin");
  });

  it("should return false when spawn exits with non-zero code", async () => {
    mockSpawn.mockImplementation(() => createMockProcess(1));

    const result = await sendNotification({ title: "Test", message: "Message" });

    expect(result).toBe(false);
  });

  it("should return false when spawn emits error event", async () => {
    mockSpawn.mockImplementation(() => createMockProcess(null, new Error("spawn failed")));

    const result = await sendNotification({ title: "Test", message: "Message" });

    expect(result).toBe(false);
  });

  it("should return false when spawn throws synchronously", async () => {
    mockSpawn.mockImplementation(() => {
      throw new Error("spawn ENOENT");
    });

    const result = await sendNotification({ title: "Test", message: "Message" });

    expect(result).toBe(false);
  });
});

describe("Convenience Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatform.mockReturnValue("darwin");
    mockSpawn.mockImplementation(() => createMockProcess(0));
  });

  describe("notifyCronCompletion", () => {
    it("should format success notification correctly", async () => {
      await notifyCronCompletion("backup-job", "success", 5000);

      expect(mockSpawn).toHaveBeenCalledWith("osascript", [
        "-e",
        expect.stringContaining("backup-job"),
      ]);

      const script = mockSpawn.mock.calls[0][1][1];
      expect(script).toContain("Viben Cron Job");
      expect(script).toContain("backup-job");
      expect(script).toContain("5s");
    });

    it("should format failure notification with sound", async () => {
      await notifyCronCompletion("sync-job", "failure");

      const script = mockSpawn.mock.calls[0][1][1];
      expect(script).toContain("sync-job");
      expect(script).toContain('sound name "default"');
    });

    it("should not include duration when not provided", async () => {
      await notifyCronCompletion("job", "success");

      const script = mockSpawn.mock.calls[0][1][1];
      expect(script).not.toContain("s)");
    });
  });

  describe("notifyAgentCompletion", () => {
    it("should format successful agent completion", async () => {
      await notifyAgentCompletion("Claude", "abcd1234-5678-efgh", true);

      const script = mockSpawn.mock.calls[0][1][1];
      expect(script).toContain("Viben Agent");
      expect(script).toContain("Claude");
      // sessionId.slice(0, 8) = "abcd1234"
      expect(script).toContain("abcd1234");
      expect(script).toContain("completed");
    });

    it("should format failed agent completion with sound", async () => {
      await notifyAgentCompletion("Gemini", "efgh5678-1234-abcd", false);

      const script = mockSpawn.mock.calls[0][1][1];
      expect(script).toContain("Gemini");
      // sessionId.slice(0, 8) = "efgh5678"
      expect(script).toContain("efgh5678");
      expect(script).toContain("failed");
      expect(script).toContain('sound name "default"');
    });
  });

  describe("notifyChannelMessage", () => {
    it("should format channel message notification", async () => {
      await notifyChannelMessage("Telegram", "dev-channel", "Alice", "Hello everyone!");

      const script = mockSpawn.mock.calls[0][1][1];
      expect(script).toContain("Telegram: dev-channel");
      expect(script).toContain("Alice: Hello everyone!");
    });

    it("should truncate long messages to 100 characters", async () => {
      const longMessage = "A".repeat(200);
      await notifyChannelMessage("Discord", "general", "Bot", longMessage);

      const script = mockSpawn.mock.calls[0][1][1];
      expect(script).toContain("Bot: " + "A".repeat(97) + "...");
    });

    it("should not truncate messages under 100 characters", async () => {
      const message = "A".repeat(100);
      await notifyChannelMessage("Slack", "random", "User", message);

      const script = mockSpawn.mock.calls[0][1][1];
      expect(script).toContain("User: " + "A".repeat(100));
      expect(script).not.toContain("...");
    });
  });

  describe("notify", () => {
    it("should send simple notification with title and message", async () => {
      await notify("Simple Title", "Simple Message");

      expect(mockSpawn).toHaveBeenCalledWith("osascript", [
        "-e",
        'display notification "Simple Message" with title "Simple Title"',
      ]);
    });
  });
});

describe("Integration Scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSpawn.mockImplementation(() => createMockProcess(0));
  });

  it("should return true on successful notification (darwin)", async () => {
    mockPlatform.mockReturnValue("darwin");

    const result = await sendNotification({ title: "Test", message: "Message" });

    expect(result).toBe(true);
  });

  it("should return true on successful notification (linux)", async () => {
    mockPlatform.mockReturnValue("linux");

    const result = await sendNotification({ title: "Test", message: "Message" });

    expect(result).toBe(true);
  });

  it("should return true on successful notification (win32)", async () => {
    mockPlatform.mockReturnValue("win32");

    const result = await sendNotification({ title: "Test", message: "Message" });

    expect(result).toBe(true);
  });
});
