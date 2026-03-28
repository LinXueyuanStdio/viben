/**
 * Agent memory management
 *
 * Memory is stored in ~/.viben/agents/{agent-id}/memory/
 * The memory system consists of:
 *   - MEMORY.md (main memory file - structured knowledge)
 *   - YYYY-MM-DD.md (daily logs - append-only)
 *
 * Daily log format:
 *   # 2024-01-16
 *
 *   ## 10:30 - Session started
 *   - Working on feature X
 *   - Discovered issue with Y
 *
 *   ## 14:15 - Completed task
 *   - Fixed bug in Z
 */
import { readFile, writeFile, appendFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { getAgentMemoryDir } from "../config/paths";
import { ensureDir, fileExists } from "../config/yaml";
import type { AgentMemory, DailyLog, LogEntry } from "../types";

/**
 * Memory content with metadata
 */
export interface MemoryContent {
  /** Agent ID */
  agent_id: string;
  /** Main memory content (MEMORY.md) */
  content: string;
  /** File path */
  path: string;
  /** Last modified time */
  updated_at: string;
  /** File size in bytes */
  size: number;
}

/**
 * Daily log with content
 */
export interface DailyLogContent {
  /** Date string (YYYY-MM-DD) */
  date: string;
  /** Raw markdown content */
  content: string;
  /** Parsed entries */
  entries: ParsedLogEntry[];
  /** File path */
  path: string;
  /** Last modified time */
  updated_at: string;
}

/**
 * Parsed log entry from daily log
 */
export interface ParsedLogEntry {
  /** Time (HH:MM) */
  time: string;
  /** Entry title */
  title: string;
  /** Entry items (bullet points) */
  items: string[];
}

/**
 * Options for appending to daily log
 */
export interface AppendLogOptions {
  /** Optional title (default: current time) */
  title?: string;
  /** Content items to append */
  items: string[];
}

/**
 * MemoryManager handles agent memory operations
 */
export class MemoryManager {
  /**
   * Initialize memory directory for an agent
   */
  async initialize(agent_id: string): Promise<void> {
    await ensureDir(getAgentMemoryDir(agent_id));
  }

  // ==========================================================================
  // Main Memory (MEMORY.md)
  // ==========================================================================

  /**
   * Get main memory content for an agent
   */
  async getMemory(agent_id: string): Promise<MemoryContent> {
    const memoryDir = getAgentMemoryDir(agent_id);
    const memoryPath = join(memoryDir, "MEMORY.md");

    if (!fileExists(memoryPath)) {
      return {
        agent_id,
        content: "",
        path: memoryPath,
        updated_at: new Date().toISOString(),
        size: 0,
      };
    }

    const content = await readFile(memoryPath, "utf-8");
    const stats = await stat(memoryPath);

    return {
      agent_id,
      content,
      path: memoryPath,
      updated_at: stats.mtime.toISOString(),
      size: stats.size,
    };
  }

  /**
   * Set main memory content (overwrites existing)
   */
  async setMemory(agent_id: string, content: string): Promise<void> {
    const memoryDir = getAgentMemoryDir(agent_id);
    const memoryPath = join(memoryDir, "MEMORY.md");

    await ensureDir(memoryDir);
    await writeFile(memoryPath, content, "utf-8");
  }

  /**
   * Append content to main memory
   */
  async appendMemory(agent_id: string, content: string): Promise<void> {
    const memoryDir = getAgentMemoryDir(agent_id);
    const memoryPath = join(memoryDir, "MEMORY.md");

    await ensureDir(memoryDir);

    if (fileExists(memoryPath)) {
      await appendFile(memoryPath, "\n" + content, "utf-8");
    } else {
      await writeFile(memoryPath, content, "utf-8");
    }
  }

  /**
   * Clear main memory (delete content but keep file)
   */
  async clearMemory(agent_id: string): Promise<void> {
    await this.setMemory(agent_id, "");
  }

  /**
   * Check if agent has main memory file
   */
  async hasMemory(agent_id: string): Promise<boolean> {
    const memoryPath = join(getAgentMemoryDir(agent_id), "MEMORY.md");
    return fileExists(memoryPath);
  }

  // ==========================================================================
  // Daily Logs (YYYY-MM-DD.md)
  // ==========================================================================

  /**
   * Get daily log for a specific date
   */
  async getDailyLog(agent_id: string, date?: string): Promise<DailyLogContent | null> {
    const dateStr = date ?? this.getTodayDateString();
    const memoryDir = getAgentMemoryDir(agent_id);
    const logPath = join(memoryDir, `${dateStr}.md`);

    if (!fileExists(logPath)) {
      return null;
    }

    const content = await readFile(logPath, "utf-8");
    const stats = await stat(logPath);
    const entries = this.parseDailyLog(content);

    return {
      date: dateStr,
      content,
      entries,
      path: logPath,
      updated_at: stats.mtime.toISOString(),
    };
  }

  /**
   * Get today's daily log
   */
  async getTodayLog(agent_id: string): Promise<DailyLogContent | null> {
    return this.getDailyLog(agent_id, this.getTodayDateString());
  }

  /**
   * Get yesterday's daily log
   */
  async getYesterdayLog(agent_id: string): Promise<DailyLogContent | null> {
    return this.getDailyLog(agent_id, this.getYesterdayDateString());
  }

  /**
   * Get daily logs for the last N days
   */
  async getRecentLogs(agent_id: string, days = 7): Promise<DailyLogContent[]> {
    const logs: DailyLogContent[] = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = this.formatDate(date);

      const log = await this.getDailyLog(agent_id, dateStr);
      if (log) {
        logs.push(log);
      }
    }

    return logs;
  }

  /**
   * List all available daily log dates
   */
  async listDailyLogDates(agent_id: string): Promise<string[]> {
    const memoryDir = getAgentMemoryDir(agent_id);
    if (!fileExists(memoryDir)) {
      return [];
    }

    const entries = await readdir(memoryDir);
    const dates: string[] = [];

    // Match YYYY-MM-DD.md pattern
    const datePattern = /^\d{4}-\d{2}-\d{2}\.md$/;
    for (const entry of entries) {
      if (datePattern.test(entry)) {
        dates.push(entry.replace(".md", ""));
      }
    }

    // Sort descending (newest first)
    return dates.sort((a, b) => b.localeCompare(a));
  }

  /**
   * Append entry to today's daily log
   */
  async appendToDailyLog(agent_id: string, options: AppendLogOptions): Promise<void> {
    const dateStr = this.getTodayDateString();
    const memoryDir = getAgentMemoryDir(agent_id);
    const logPath = join(memoryDir, `${dateStr}.md`);

    await ensureDir(memoryDir);

    const time = this.getCurrentTimeString();
    const title = options.title ?? `Session activity`;

    // Format entry
    const lines: string[] = [];
    lines.push(`## ${time} - ${title}`);
    for (const item of options.items) {
      lines.push(`- ${item}`);
    }
    lines.push("");

    const entryContent = lines.join("\n");

    if (fileExists(logPath)) {
      await appendFile(logPath, "\n" + entryContent, "utf-8");
    } else {
      // Create new daily log with header
      const header = `# ${dateStr}\n\n`;
      await writeFile(logPath, header + entryContent, "utf-8");
    }
  }

  /**
   * Append raw content to today's daily log
   */
  async appendRawToDailyLog(agent_id: string, content: string): Promise<void> {
    const dateStr = this.getTodayDateString();
    const memoryDir = getAgentMemoryDir(agent_id);
    const logPath = join(memoryDir, `${dateStr}.md`);

    await ensureDir(memoryDir);

    if (fileExists(logPath)) {
      await appendFile(logPath, "\n" + content, "utf-8");
    } else {
      // Create new daily log with header
      const header = `# ${dateStr}\n\n`;
      await writeFile(logPath, header + content, "utf-8");
    }
  }

  /**
   * Get memory content for session startup
   * Returns main memory + today's log + yesterday's log
   */
  async getSessionStartupMemory(agent_id: string): Promise<string> {
    const parts: string[] = [];

    // Main memory
    const memory = await this.getMemory(agent_id);
    if (memory.content) {
      parts.push("# Agent Memory\n");
      parts.push(memory.content);
    }

    // Today's log
    const todayLog = await this.getTodayLog(agent_id);
    if (todayLog) {
      parts.push("\n# Today's Log\n");
      parts.push(todayLog.content);
    }

    // Yesterday's log
    const yesterdayLog = await this.getYesterdayLog(agent_id);
    if (yesterdayLog) {
      parts.push("\n# Yesterday's Log\n");
      parts.push(yesterdayLog.content);
    }

    return parts.join("\n");
  }

  /**
   * Get combined memory stats
   */
  async getMemoryStats(
    agent_id: string
  ): Promise<{ mainMemorySize: number; dailyLogsCount: number; totalSize: number }> {
    const memory = await this.getMemory(agent_id);
    const dates = await this.listDailyLogDates(agent_id);

    let totalSize = memory.size;
    const memoryDir = getAgentMemoryDir(agent_id);

    for (const date of dates) {
      const logPath = join(memoryDir, `${date}.md`);
      if (fileExists(logPath)) {
        const stats = await stat(logPath);
        totalSize += stats.size;
      }
    }

    return {
      mainMemorySize: memory.size,
      dailyLogsCount: dates.length,
      totalSize,
    };
  }

  // ==========================================================================
  // Legacy Support (DailyLog/LogEntry format)
  // ==========================================================================

  /**
   * Get daily logs in legacy format (for backward compatibility)
   */
  async getDailyLogsLegacy(agent_id: string, days = 7): Promise<DailyLog[]> {
    const logs = await this.getRecentLogs(agent_id, days);

    return logs.map((log) => ({
      date: log.date,
      entries: log.entries.map((entry) => ({
        timestamp: `${log.date}T${entry.time}:00.000Z`,
        type: "system" as const,
        content: `${entry.title}\n${entry.items.map((i) => `- ${i}`).join("\n")}`,
      })),
    }));
  }

  /**
   * Get agent memory in legacy format (for backward compatibility)
   */
  async getMemoryLegacy(agent_id: string): Promise<AgentMemory> {
    const memory = await this.getMemory(agent_id);
    return {
      agent_id,
      content: memory.content,
      updated_at: memory.updated_at,
    };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Parse daily log markdown content into entries
   */
  private parseDailyLog(content: string): ParsedLogEntry[] {
    const entries: ParsedLogEntry[] = [];
    const lines = content.split("\n");

    let currentEntry: ParsedLogEntry | null = null;

    for (const line of lines) {
      // Match ## HH:MM - Title
      const headerMatch = line.match(/^##\s+(\d{1,2}:\d{2})\s*-\s*(.+)$/);
      if (headerMatch) {
        if (currentEntry) {
          entries.push(currentEntry);
        }
        currentEntry = {
          time: headerMatch[1],
          title: headerMatch[2].trim(),
          items: [],
        };
        continue;
      }

      // Match bullet points
      const bulletMatch = line.match(/^[-*]\s+(.+)$/);
      if (bulletMatch && currentEntry) {
        currentEntry.items.push(bulletMatch[1].trim());
      }
    }

    if (currentEntry) {
      entries.push(currentEntry);
    }

    return entries;
  }

  /**
   * Get today's date string (YYYY-MM-DD)
   */
  private getTodayDateString(): string {
    return this.formatDate(new Date());
  }

  /**
   * Get yesterday's date string (YYYY-MM-DD)
   */
  private getYesterdayDateString(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return this.formatDate(yesterday);
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Get current time string (HH:MM)
   */
  private getCurrentTimeString(): string {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }
}

// Export singleton instance
export const memoryManager = new MemoryManager();
