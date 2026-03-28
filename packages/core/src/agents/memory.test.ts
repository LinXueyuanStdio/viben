/**
 * Agent Memory Management Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { MemoryManager } from "./memory";

// Mock the paths module to use temp directory
vi.mock("../config/paths", async () => {
  const actual = await vi.importActual("../config/paths");
  return {
    ...actual,
    getAgentMemoryDir: vi.fn(),
  };
});

import { getAgentMemoryDir } from "../config/paths";

/**
 * Helper to format date as YYYY-MM-DD in local time (same as MemoryManager)
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

describe("MemoryManager", () => {
  let manager: MemoryManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "viben-memory-test-"));

    // Set up mock
    vi.mocked(getAgentMemoryDir).mockImplementation((agentId: string) =>
      join(tempDir, "agents", agentId, "memory")
    );

    manager = new MemoryManager();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Initialize Tests
  // ==========================================================================

  describe("initialize", () => {
    it("should create memory directory for agent", async () => {
      await manager.initialize("test-agent");

      const memoryDir = getAgentMemoryDir("test-agent");
      expect(existsSync(memoryDir)).toBe(true);
    });
  });

  // ==========================================================================
  // Main Memory Tests (MEMORY.md)
  // ==========================================================================

  describe("getMemory", () => {
    it("should return empty content for non-existent memory", async () => {
      const memory = await manager.getMemory("new-agent");

      expect(memory.agent_id).toBe("new-agent");
      expect(memory.content).toBe("");
      expect(memory.size).toBe(0);
    });

    it("should return existing memory content", async () => {
      const memoryDir = getAgentMemoryDir("test-agent");
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, "MEMORY.md"), "# Agent Memory\n\nSome content here.");

      const memory = await manager.getMemory("test-agent");

      expect(memory.content).toBe("# Agent Memory\n\nSome content here.");
      expect(memory.size).toBeGreaterThan(0);
    });

    it("should include path in memory result", async () => {
      const memoryDir = getAgentMemoryDir("test-agent");
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, "MEMORY.md"), "content");

      const memory = await manager.getMemory("test-agent");

      expect(memory.path).toBe(join(memoryDir, "MEMORY.md"));
    });
  });

  describe("setMemory", () => {
    it("should create memory file with content", async () => {
      await manager.setMemory("test-agent", "# New Memory\n\nNew content.");

      const memory = await manager.getMemory("test-agent");
      expect(memory.content).toBe("# New Memory\n\nNew content.");
    });

    it("should overwrite existing memory content", async () => {
      await manager.setMemory("test-agent", "Original content");
      await manager.setMemory("test-agent", "New content");

      const memory = await manager.getMemory("test-agent");
      expect(memory.content).toBe("New content");
    });

    it("should create memory directory if not exists", async () => {
      const memoryDir = getAgentMemoryDir("new-agent");
      expect(existsSync(memoryDir)).toBe(false);

      await manager.setMemory("new-agent", "content");

      expect(existsSync(memoryDir)).toBe(true);
    });
  });

  describe("appendMemory", () => {
    it("should append to existing memory", async () => {
      await manager.setMemory("test-agent", "Line 1");
      await manager.appendMemory("test-agent", "Line 2");

      const memory = await manager.getMemory("test-agent");
      expect(memory.content).toBe("Line 1\nLine 2");
    });

    it("should create memory file if not exists", async () => {
      await manager.appendMemory("new-agent", "First content");

      const memory = await manager.getMemory("new-agent");
      expect(memory.content).toBe("First content");
    });

    it("should handle multiple appends", async () => {
      await manager.appendMemory("test-agent", "First");
      await manager.appendMemory("test-agent", "Second");
      await manager.appendMemory("test-agent", "Third");

      const memory = await manager.getMemory("test-agent");
      expect(memory.content).toBe("First\nSecond\nThird");
    });
  });

  describe("clearMemory", () => {
    it("should clear memory content", async () => {
      await manager.setMemory("test-agent", "Some content");
      await manager.clearMemory("test-agent");

      const memory = await manager.getMemory("test-agent");
      expect(memory.content).toBe("");
    });
  });

  describe("hasMemory", () => {
    it("should return false for non-existent memory", async () => {
      const has = await manager.hasMemory("new-agent");
      expect(has).toBe(false);
    });

    it("should return true for existing memory", async () => {
      await manager.setMemory("test-agent", "content");

      const has = await manager.hasMemory("test-agent");
      expect(has).toBe(true);
    });
  });

  // ==========================================================================
  // Daily Log Tests (YYYY-MM-DD.md)
  // ==========================================================================

  describe("getDailyLog", () => {
    it("should return null for non-existent log", async () => {
      const log = await manager.getDailyLog("test-agent", "2024-01-15");
      expect(log).toBeNull();
    });

    it("should return existing daily log", async () => {
      const memoryDir = getAgentMemoryDir("test-agent");
      await mkdir(memoryDir, { recursive: true });
      const logContent = `# 2024-01-15

## 10:30 - Session started
- Working on feature X
- Found bug in Y

## 14:00 - Break
- Lunch break
`;
      await writeFile(join(memoryDir, "2024-01-15.md"), logContent);

      const log = await manager.getDailyLog("test-agent", "2024-01-15");

      expect(log).not.toBeNull();
      expect(log?.date).toBe("2024-01-15");
      expect(log?.content).toBe(logContent);
    });

    it("should parse log entries", async () => {
      const memoryDir = getAgentMemoryDir("test-agent");
      await mkdir(memoryDir, { recursive: true });
      const logContent = `# 2024-01-15

## 10:30 - Session started
- Working on feature X
- Found bug in Y

## 14:00 - Completed task
- Fixed the bug
`;
      await writeFile(join(memoryDir, "2024-01-15.md"), logContent);

      const log = await manager.getDailyLog("test-agent", "2024-01-15");

      expect(log?.entries).toHaveLength(2);
      expect(log?.entries[0].time).toBe("10:30");
      expect(log?.entries[0].title).toBe("Session started");
      expect(log?.entries[0].items).toEqual(["Working on feature X", "Found bug in Y"]);
      expect(log?.entries[1].time).toBe("14:00");
      expect(log?.entries[1].title).toBe("Completed task");
    });
  });

  describe("getTodayLog / getYesterdayLog", () => {
    it("should get today's log using current date", async () => {
      const today = formatLocalDate(new Date());
      const memoryDir = getAgentMemoryDir("test-agent");
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, `${today}.md`), `# ${today}\n\n## 10:00 - Test\n- Item`);

      const log = await manager.getTodayLog("test-agent");

      expect(log).not.toBeNull();
      expect(log?.date).toBe(today);
    });

    it("should get yesterday's log", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatLocalDate(yesterday);

      const memoryDir = getAgentMemoryDir("test-agent");
      await mkdir(memoryDir, { recursive: true });
      await writeFile(
        join(memoryDir, `${yesterdayStr}.md`),
        `# ${yesterdayStr}\n\n## 10:00 - Test\n- Item`
      );

      const log = await manager.getYesterdayLog("test-agent");

      expect(log).not.toBeNull();
      expect(log?.date).toBe(yesterdayStr);
    });
  });

  describe("getRecentLogs", () => {
    it("should return empty array when no logs exist", async () => {
      const logs = await manager.getRecentLogs("test-agent", 7);
      expect(logs).toEqual([]);
    });

    it("should return logs from recent days", async () => {
      const memoryDir = getAgentMemoryDir("test-agent");
      await mkdir(memoryDir, { recursive: true });

      // Create logs for today and yesterday
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const todayStr = formatLocalDate(today);
      const yesterdayStr = formatLocalDate(yesterday);

      await writeFile(join(memoryDir, `${todayStr}.md`), `# ${todayStr}\n\n## 10:00 - Today`);
      await writeFile(
        join(memoryDir, `${yesterdayStr}.md`),
        `# ${yesterdayStr}\n\n## 10:00 - Yesterday`
      );

      const logs = await manager.getRecentLogs("test-agent", 7);

      expect(logs).toHaveLength(2);
    });
  });

  describe("listDailyLogDates", () => {
    it("should return empty array when no logs exist", async () => {
      const dates = await manager.listDailyLogDates("test-agent");
      expect(dates).toEqual([]);
    });

    it("should list all log dates sorted descending", async () => {
      const memoryDir = getAgentMemoryDir("test-agent");
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, "2024-01-15.md"), "# 2024-01-15");
      await writeFile(join(memoryDir, "2024-01-17.md"), "# 2024-01-17");
      await writeFile(join(memoryDir, "2024-01-16.md"), "# 2024-01-16");
      // Non-date file should be ignored
      await writeFile(join(memoryDir, "MEMORY.md"), "# Memory");

      const dates = await manager.listDailyLogDates("test-agent");

      expect(dates).toEqual(["2024-01-17", "2024-01-16", "2024-01-15"]);
    });
  });

  describe("appendToDailyLog", () => {
    it("should create new daily log with header", async () => {
      await manager.appendToDailyLog("test-agent", {
        title: "Session started",
        items: ["Working on feature X", "Planning tasks"],
      });

      const today = formatLocalDate(new Date());
      const log = await manager.getDailyLog("test-agent", today);

      expect(log).not.toBeNull();
      expect(log?.content).toContain(`# ${today}`);
      expect(log?.content).toContain("Session started");
      expect(log?.content).toContain("Working on feature X");
    });

    it("should append to existing daily log", async () => {
      const today = formatLocalDate(new Date());
      const memoryDir = getAgentMemoryDir("test-agent");
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, `${today}.md`), `# ${today}\n\n## 09:00 - Morning\n- Task 1`);

      await manager.appendToDailyLog("test-agent", {
        title: "Afternoon session",
        items: ["Task 2", "Task 3"],
      });

      const log = await manager.getDailyLog("test-agent", today);

      expect(log?.content).toContain("Morning");
      expect(log?.content).toContain("Afternoon session");
      expect(log?.content).toContain("Task 2");
    });

    it("should use default title if not provided", async () => {
      await manager.appendToDailyLog("test-agent", {
        items: ["Some activity"],
      });

      const today = formatLocalDate(new Date());
      const log = await manager.getDailyLog("test-agent", today);

      expect(log).not.toBeNull();
      expect(log!.content).toContain("Session activity");
    });
  });

  describe("appendRawToDailyLog", () => {
    it("should append raw content to daily log", async () => {
      await manager.appendRawToDailyLog(
        "test-agent",
        "## Custom Format\nThis is raw markdown content."
      );

      const today = formatLocalDate(new Date());
      const log = await manager.getDailyLog("test-agent", today);

      expect(log).not.toBeNull();
      expect(log!.content).toContain("Custom Format");
      expect(log!.content).toContain("This is raw markdown content.");
    });
  });

  // ==========================================================================
  // Session Startup Memory Tests
  // ==========================================================================

  describe("getSessionStartupMemory", () => {
    it("should return empty string when no memory exists", async () => {
      const memory = await manager.getSessionStartupMemory("test-agent");
      expect(memory).toBe("");
    });

    it("should combine main memory with today and yesterday logs", async () => {
      const memoryDir = getAgentMemoryDir("test-agent");
      await mkdir(memoryDir, { recursive: true });

      // Create main memory
      await writeFile(join(memoryDir, "MEMORY.md"), "## Project Knowledge\n\nImportant fact.");

      // Create today's log
      const today = formatLocalDate(new Date());
      await writeFile(join(memoryDir, `${today}.md`), `# ${today}\n\n## 10:00 - Today's work`);

      // Create yesterday's log
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatLocalDate(yesterday);
      await writeFile(
        join(memoryDir, `${yesterdayStr}.md`),
        `# ${yesterdayStr}\n\n## 10:00 - Yesterday's work`
      );

      const memory = await manager.getSessionStartupMemory("test-agent");

      expect(memory).toContain("# Agent Memory");
      expect(memory).toContain("Project Knowledge");
      expect(memory).toContain("# Today's Log");
      expect(memory).toContain("Today's work");
      expect(memory).toContain("# Yesterday's Log");
      expect(memory).toContain("Yesterday's work");
    });
  });

  // ==========================================================================
  // Memory Stats Tests
  // ==========================================================================

  describe("getMemoryStats", () => {
    it("should return zero stats for new agent", async () => {
      const stats = await manager.getMemoryStats("new-agent");

      expect(stats.mainMemorySize).toBe(0);
      expect(stats.dailyLogsCount).toBe(0);
      expect(stats.totalSize).toBe(0);
    });

    it("should calculate stats correctly", async () => {
      const memoryDir = getAgentMemoryDir("test-agent");
      await mkdir(memoryDir, { recursive: true });

      await writeFile(join(memoryDir, "MEMORY.md"), "Main memory content");
      await writeFile(join(memoryDir, "2024-01-15.md"), "Day 1 log");
      await writeFile(join(memoryDir, "2024-01-16.md"), "Day 2 log");

      const stats = await manager.getMemoryStats("test-agent");

      expect(stats.mainMemorySize).toBeGreaterThan(0);
      expect(stats.dailyLogsCount).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(stats.mainMemorySize);
    });
  });

  // ==========================================================================
  // Legacy Format Tests
  // ==========================================================================

  describe("getDailyLogsLegacy", () => {
    it("should return logs in legacy format", async () => {
      const memoryDir = getAgentMemoryDir("test-agent");
      await mkdir(memoryDir, { recursive: true });

      const today = formatLocalDate(new Date());
      await writeFile(
        join(memoryDir, `${today}.md`),
        `# ${today}\n\n## 10:30 - Session\n- Task 1\n- Task 2`
      );

      const logs = await manager.getDailyLogsLegacy("test-agent", 7);

      expect(logs).toHaveLength(1);
      expect(logs[0].date).toBe(today);
      expect(logs[0].entries).toHaveLength(1);
      expect(logs[0].entries[0].type).toBe("system");
    });
  });

  describe("getMemoryLegacy", () => {
    it("should return memory in legacy format", async () => {
      await manager.setMemory("test-agent", "Memory content");

      const memory = await manager.getMemoryLegacy("test-agent");

      expect(memory.agent_id).toBe("test-agent");
      expect(memory.content).toBe("Memory content");
      expect(memory.updated_at).toBeDefined();  // AgentMemory uses snake_case
    });
  });

  // ==========================================================================
  // Log Parsing Tests
  // ==========================================================================

  describe("log parsing", () => {
    it("should handle empty log file", async () => {
      const memoryDir = getAgentMemoryDir("test-agent");
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, "2024-01-15.md"), "");

      const log = await manager.getDailyLog("test-agent", "2024-01-15");

      expect(log?.entries).toEqual([]);
    });

    it("should handle log with only header", async () => {
      const memoryDir = getAgentMemoryDir("test-agent");
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, "2024-01-15.md"), "# 2024-01-15\n");

      const log = await manager.getDailyLog("test-agent", "2024-01-15");

      expect(log?.entries).toEqual([]);
    });

    it("should parse entries with different bullet styles", async () => {
      const memoryDir = getAgentMemoryDir("test-agent");
      await mkdir(memoryDir, { recursive: true });
      await writeFile(
        join(memoryDir, "2024-01-15.md"),
        `# 2024-01-15

## 10:00 - Test
- Dash bullet
* Star bullet
`
      );

      const log = await manager.getDailyLog("test-agent", "2024-01-15");

      expect(log?.entries[0].items).toEqual(["Dash bullet", "Star bullet"]);
    });

    it("should handle entries without items", async () => {
      const memoryDir = getAgentMemoryDir("test-agent");
      await mkdir(memoryDir, { recursive: true });
      await writeFile(
        join(memoryDir, "2024-01-15.md"),
        `# 2024-01-15

## 10:00 - Empty entry

## 11:00 - Another entry
- Has items
`
      );

      const log = await manager.getDailyLog("test-agent", "2024-01-15");

      expect(log?.entries).toHaveLength(2);
      expect(log?.entries[0].items).toEqual([]);
      expect(log?.entries[1].items).toEqual(["Has items"]);
    });
  });
});
