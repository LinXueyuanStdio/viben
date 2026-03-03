/**
 * History Service Tests
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import {
  HistoryService,
  HistoryEntry,
  HistoryStats,
  createHistoryEntry,
} from "./history";

describe("HistoryService", () => {
  let service: HistoryService;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "viben-history-test-"));
    service = new HistoryService(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("initialization", () => {
    it("should create service with custom state directory", () => {
      const customService = new HistoryService("/custom/path");
      expect(customService).toBeInstanceOf(HistoryService);
    });

    it("should create service with default state directory", () => {
      const defaultService = new HistoryService();
      expect(defaultService).toBeInstanceOf(HistoryService);
    });
  });

  describe("addEntry", () => {
    it("should add a new history entry", async () => {
      const entry = createHistoryEntry("hello world", "test-agent");
      await service.addEntry(entry);

      const entries = await service.getHistory("test-agent");
      expect(entries).toHaveLength(1);
      expect(entries[0].prompt).toBe("hello world");
      expect(entries[0].agentId).toBe("test-agent");
    });

    it("should add entry with session ID", async () => {
      const entry = createHistoryEntry(
        "hello world",
        "test-agent",
        "session-123"
      );
      await service.addEntry(entry);

      const entries = await service.getHistory("test-agent");
      expect(entries).toHaveLength(1);
      expect(entries[0].sessionId).toBe("session-123");
    });

    it("should add entry without session ID", async () => {
      const entry = createHistoryEntry("hello world", "test-agent");
      await service.addEntry(entry);

      const entries = await service.getHistory("test-agent");
      expect(entries).toHaveLength(1);
      expect(entries[0].sessionId).toBeUndefined();
    });

    it("should create agent directory if not exists", async () => {
      const entry = createHistoryEntry("test", "new-agent");
      await service.addEntry(entry);

      const agentDir = join(tempDir, "agents", "new-agent");
      expect(existsSync(agentDir)).toBe(true);
    });

    it("should handle entries with newlines", async () => {
      const entry = createHistoryEntry(
        "line1\nline2\nline3",
        "test-agent"
      );
      await service.addEntry(entry);

      const entries = await service.getHistory("test-agent");
      expect(entries).toHaveLength(1);
      expect(entries[0].prompt).toBe("line1\nline2\nline3");
    });

    it("should handle entries with special characters", async () => {
      const entry = createHistoryEntry(
        "echo 'hello|world' && echo $HOME",
        "test-agent"
      );
      await service.addEntry(entry);

      const entries = await service.getHistory("test-agent");
      expect(entries).toHaveLength(1);
      expect(entries[0].prompt).toBe("echo 'hello|world' && echo $HOME");
    });

    it("should append multiple entries in order", async () => {
      await service.addEntry(createHistoryEntry("first", "test-agent"));
      await service.addEntry(createHistoryEntry("second", "test-agent"));
      await service.addEntry(createHistoryEntry("third", "test-agent"));

      const entries = await service.getHistory("test-agent");
      expect(entries).toHaveLength(3);
      expect(entries[0].prompt).toBe("first");
      expect(entries[1].prompt).toBe("second");
      expect(entries[2].prompt).toBe("third");
    });
  });

  describe("getHistory", () => {
    it("should return empty array for non-existent agent", async () => {
      const entries = await service.getHistory("non-existent");
      expect(entries).toEqual([]);
    });

    it("should return all entries for an agent", async () => {
      await service.addEntry(createHistoryEntry("cmd1", "agent-1"));
      await service.addEntry(createHistoryEntry("cmd2", "agent-1"));
      await service.addEntry(createHistoryEntry("cmd3", "agent-1"));

      const entries = await service.getHistory("agent-1");
      expect(entries).toHaveLength(3);
    });

    it("should return entries only for specified agent", async () => {
      await service.addEntry(createHistoryEntry("agent1-cmd", "agent-1"));
      await service.addEntry(createHistoryEntry("agent2-cmd", "agent-2"));

      const entries1 = await service.getHistory("agent-1");
      const entries2 = await service.getHistory("agent-2");

      expect(entries1).toHaveLength(1);
      expect(entries1[0].prompt).toBe("agent1-cmd");
      expect(entries2).toHaveLength(1);
      expect(entries2[0].prompt).toBe("agent2-cmd");
    });

    it("should preserve entry order (oldest first)", async () => {
      const entry1 = {
        timestamp: "2024-01-01T00:00:00.000Z",
        agentId: "test-agent",
        prompt: "first",
      };
      const entry2 = {
        timestamp: "2024-01-02T00:00:00.000Z",
        agentId: "test-agent",
        prompt: "second",
      };

      await service.addEntry(entry1);
      await service.addEntry(entry2);

      const entries = await service.getHistory("test-agent");
      expect(entries[0].prompt).toBe("first");
      expect(entries[1].prompt).toBe("second");
    });
  });

  describe("getRecentHistory", () => {
    beforeEach(async () => {
      // Add 5 entries
      for (let i = 1; i <= 5; i++) {
        await service.addEntry(createHistoryEntry(`command-${i}`, "test-agent"));
      }
    });

    it("should return last N entries", async () => {
      const entries = await service.getRecentHistory("test-agent", 3);
      expect(entries).toHaveLength(3);
      expect(entries[0].prompt).toBe("command-3");
      expect(entries[1].prompt).toBe("command-4");
      expect(entries[2].prompt).toBe("command-5");
    });

    it("should return all entries if limit exceeds total", async () => {
      const entries = await service.getRecentHistory("test-agent", 10);
      expect(entries).toHaveLength(5);
    });

    it("should return empty array for non-existent agent", async () => {
      const entries = await service.getRecentHistory("non-existent", 3);
      expect(entries).toEqual([]);
    });

    it("should return single entry when limit is 1", async () => {
      const entries = await service.getRecentHistory("test-agent", 1);
      expect(entries).toHaveLength(1);
      expect(entries[0].prompt).toBe("command-5");
    });
  });

  describe("searchHistory", () => {
    beforeEach(async () => {
      await service.addEntry(createHistoryEntry("git status", "test-agent"));
      await service.addEntry(createHistoryEntry("git commit -m 'test'", "test-agent"));
      await service.addEntry(createHistoryEntry("npm install", "test-agent"));
      await service.addEntry(createHistoryEntry("npm run build", "test-agent"));
      await service.addEntry(createHistoryEntry("docker run nginx", "test-agent"));
    });

    it("should find entries matching query", async () => {
      const results = await service.searchHistory("test-agent", "git");
      expect(results).toHaveLength(2);
      expect(results[0].prompt).toContain("git");
      expect(results[1].prompt).toContain("git");
    });

    it("should be case-insensitive", async () => {
      const results = await service.searchHistory("test-agent", "GIT");
      expect(results).toHaveLength(2);
    });

    it("should return empty array when no matches", async () => {
      const results = await service.searchHistory("test-agent", "python");
      expect(results).toEqual([]);
    });

    it("should return empty array for non-existent agent", async () => {
      const results = await service.searchHistory("non-existent", "git");
      expect(results).toEqual([]);
    });

    it("should find partial matches", async () => {
      const results = await service.searchHistory("test-agent", "npm");
      expect(results).toHaveLength(2);
    });
  });

  describe("clearHistory", () => {
    it("should clear all history for an agent", async () => {
      await service.addEntry(createHistoryEntry("cmd1", "test-agent"));
      await service.addEntry(createHistoryEntry("cmd2", "test-agent"));

      await service.clearHistory("test-agent");

      const entries = await service.getHistory("test-agent");
      expect(entries).toEqual([]);
    });

    it("should not throw for non-existent agent", async () => {
      await expect(
        service.clearHistory("non-existent")
      ).resolves.not.toThrow();
    });

    it("should only clear specified agent history", async () => {
      await service.addEntry(createHistoryEntry("agent1-cmd", "agent-1"));
      await service.addEntry(createHistoryEntry("agent2-cmd", "agent-2"));

      await service.clearHistory("agent-1");

      const entries1 = await service.getHistory("agent-1");
      const entries2 = await service.getHistory("agent-2");

      expect(entries1).toEqual([]);
      expect(entries2).toHaveLength(1);
    });
  });

  describe("getHistoryStats", () => {
    it("should return stats for agent with history", async () => {
      const entry1: HistoryEntry = {
        timestamp: "2024-01-01T00:00:00.000Z",
        agentId: "test-agent",
        prompt: "first",
      };
      const entry2: HistoryEntry = {
        timestamp: "2024-01-05T00:00:00.000Z",
        agentId: "test-agent",
        prompt: "last",
      };

      await service.addEntry(entry1);
      await service.addEntry(entry2);

      const stats = await service.getHistoryStats("test-agent");
      expect(stats.totalEntries).toBe(2);
      expect(stats.firstEntry).toBe("2024-01-01T00:00:00.000Z");
      expect(stats.lastEntry).toBe("2024-01-05T00:00:00.000Z");
    });

    it("should return zero stats for non-existent agent", async () => {
      const stats = await service.getHistoryStats("non-existent");
      expect(stats.totalEntries).toBe(0);
      expect(stats.firstEntry).toBeUndefined();
      expect(stats.lastEntry).toBeUndefined();
    });

    it("should return same first and last for single entry", async () => {
      const entry: HistoryEntry = {
        timestamp: "2024-01-01T00:00:00.000Z",
        agentId: "test-agent",
        prompt: "only",
      };

      await service.addEntry(entry);

      const stats = await service.getHistoryStats("test-agent");
      expect(stats.totalEntries).toBe(1);
      expect(stats.firstEntry).toBe(stats.lastEntry);
    });
  });

  describe("file persistence", () => {
    it("should persist entries after service restart", async () => {
      // Create first service and add entries
      const service1 = new HistoryService(tempDir);
      await service1.addEntry(createHistoryEntry("command-1", "test-agent"));
      await service1.addEntry(createHistoryEntry("command-2", "test-agent"));

      // Create new service instance (simulates restart)
      const service2 = new HistoryService(tempDir);
      const entries = await service2.getHistory("test-agent");

      expect(entries).toHaveLength(2);
      expect(entries[0].prompt).toBe("command-1");
      expect(entries[1].prompt).toBe("command-2");
    });

    it("should persist across multiple service instances", async () => {
      // First instance
      const service1 = new HistoryService(tempDir);
      await service1.addEntry(createHistoryEntry("cmd1", "test-agent"));

      // Second instance
      const service2 = new HistoryService(tempDir);
      await service2.addEntry(createHistoryEntry("cmd2", "test-agent"));

      // Third instance
      const service3 = new HistoryService(tempDir);
      const entries = await service3.getHistory("test-agent");

      expect(entries).toHaveLength(2);
      expect(entries[0].prompt).toBe("cmd1");
      expect(entries[1].prompt).toBe("cmd2");
    });

    it("should store data in flat file format", async () => {
      await service.addEntry(createHistoryEntry("test command", "test-agent"));

      const filePath = join(tempDir, "agents", "test-agent", ".agent_history");
      expect(existsSync(filePath)).toBe(true);

      const content = await readFile(filePath, "utf-8");
      expect(content).toContain("|test-agent|");
      // Content should be base64 encoded
      expect(content).toContain(Buffer.from("test command").toString("base64"));
    });
  });

  describe("entry serialization", () => {
    it("should correctly encode and decode entries with pipe characters", async () => {
      const entry = createHistoryEntry(
        "echo 'a|b|c' | grep 'a'",
        "test-agent"
      );
      await service.addEntry(entry);

      const entries = await service.getHistory("test-agent");
      expect(entries[0].prompt).toBe("echo 'a|b|c' | grep 'a'");
    });

    it("should correctly encode and decode unicode characters", async () => {
      const entry = createHistoryEntry(
        "echo '你好世界' && echo 'Привет'",
        "test-agent"
      );
      await service.addEntry(entry);

      const entries = await service.getHistory("test-agent");
      expect(entries[0].prompt).toBe("echo '你好世界' && echo 'Привет'");
    });

    it("should correctly encode and decode emojis", async () => {
      const entry = createHistoryEntry(
        "echo 'Hello World!'",
        "test-agent"
      );
      await service.addEntry(entry);

      const entries = await service.getHistory("test-agent");
      expect(entries[0].prompt).toBe("echo 'Hello World!'");
    });
  });
});

describe("createHistoryEntry", () => {
  it("should create entry with current timestamp", () => {
    const before = new Date().toISOString();
    const entry = createHistoryEntry("test", "agent-1");
    const after = new Date().toISOString();

    expect(entry.prompt).toBe("test");
    expect(entry.agentId).toBe("agent-1");
    expect(entry.sessionId).toBeUndefined();
    expect(entry.timestamp >= before).toBe(true);
    expect(entry.timestamp <= after).toBe(true);
  });

  it("should create entry with session ID", () => {
    const entry = createHistoryEntry("test", "agent-1", "session-abc");

    expect(entry.sessionId).toBe("session-abc");
  });
});
