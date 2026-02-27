/**
 * History service for .agent_history management
 *
 * Similar to .bash_history, records user inputs for each agent session.
 */
import { join } from "node:path";
import { existsSync } from "node:fs";
import {
  readdir,
  readFile,
  writeFile,
  appendFile,
  mkdir,
  rm,
} from "node:fs/promises";
import { getStateDir } from "../config/paths";
import { HistoryError } from "../error";

/**
 * History entry from .agent_history
 *
 * Format follows Rust implementation: timestamp|agent_id|session_id|content_base64
 */
export interface HistoryEntry {
  /** Entry ID (auto-generated, not stored in file) */
  id?: string;
  /** ISO timestamp when the command was recorded */
  timestamp: string;
  /** Agent ID */
  agentId: string;
  /** Session ID where this was recorded */
  sessionId?: string;
  /** The user input/command (prompt) */
  prompt: string;
  /** Result/output (optional) */
  result?: string;
  /** Exit code (for script executions) */
  exitCode?: number;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * History statistics
 */
export interface HistoryStats {
  totalEntries: number;
  firstEntry?: string;
  lastEntry?: string;
}

/**
 * Create a new history entry with current timestamp
 */
export function createHistoryEntry(
  prompt: string,
  agentId: string,
  sessionId?: string
): HistoryEntry {
  return {
    timestamp: new Date().toISOString(),
    agentId,
    sessionId,
    prompt,
  };
}

/**
 * History service for agent history management
 *
 * Uses a flat file format similar to .bash_history:
 * - One file per agent: ~/.viben/agents/{agent_id}/.agent_history
 * - Each line: timestamp|agent_id|session_id|content_base64
 */
export class HistoryService {
  private stateDir: string;

  constructor(stateDir?: string) {
    this.stateDir = stateDir || getStateDir();
  }

  /**
   * Get the history file path for an agent
   */
  private historyPath(agentId: string): string {
    return join(this.stateDir, "agents", agentId, ".agent_history");
  }

  /**
   * Encode content to base64 (handles newlines)
   */
  private encodeContent(content: string): string {
    return Buffer.from(content, "utf-8").toString("base64");
  }

  /**
   * Decode content from base64
   */
  private decodeContent(base64: string): string {
    return Buffer.from(base64, "base64").toString("utf-8");
  }

  /**
   * Format entry as a history line for file storage
   */
  private entryToLine(entry: HistoryEntry): string {
    const contentB64 = this.encodeContent(entry.prompt);
    const sessionId = entry.sessionId || "-";
    return `${entry.timestamp}|${entry.agentId}|${sessionId}|${contentB64}\n`;
  }

  /**
   * Parse entry from a history line
   */
  private lineToEntry(line: string): HistoryEntry | null {
    const parts = line.trim().split("|");
    if (parts.length < 4) {
      return null;
    }

    const [timestamp, agentId, sessionId, contentB64] = parts;

    try {
      const prompt = this.decodeContent(contentB64);
      return {
        timestamp,
        agentId,
        sessionId: sessionId === "-" ? undefined : sessionId,
        prompt,
      };
    } catch {
      return null;
    }
  }

  /**
   * Add a new entry to the history
   */
  async addEntry(entry: HistoryEntry): Promise<void> {
    const path = this.historyPath(entry.agentId);

    // Ensure parent directory exists
    const parentDir = join(this.stateDir, "agents", entry.agentId);
    await mkdir(parentDir, { recursive: true });

    // Append to file
    const line = this.entryToLine(entry);
    await appendFile(path, line, "utf-8");
  }

  /**
   * Get all history entries for an agent
   */
  async getHistory(agentId: string): Promise<HistoryEntry[]> {
    const path = this.historyPath(agentId);

    if (!existsSync(path)) {
      return [];
    }

    const content = await readFile(path, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());
    const entries: HistoryEntry[] = [];

    for (const line of lines) {
      const entry = this.lineToEntry(line);
      if (entry) {
        entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * Get recent history entries for an agent (last N entries)
   */
  async getRecentHistory(
    agentId: string,
    limit: number
  ): Promise<HistoryEntry[]> {
    const all = await this.getHistory(agentId);
    const start = Math.max(0, all.length - limit);
    return all.slice(start);
  }

  /**
   * Search history entries by content (case-insensitive)
   */
  async searchHistory(agentId: string, query: string): Promise<HistoryEntry[]> {
    const all = await this.getHistory(agentId);
    const queryLower = query.toLowerCase();
    return all.filter((entry) =>
      entry.prompt.toLowerCase().includes(queryLower)
    );
  }

  /**
   * Clear all history for an agent
   */
  async clearHistory(agentId: string): Promise<void> {
    const path = this.historyPath(agentId);

    if (existsSync(path)) {
      await rm(path);
    }
  }

  /**
   * Get history statistics for an agent
   */
  async getHistoryStats(agentId: string): Promise<HistoryStats> {
    const entries = await this.getHistory(agentId);

    return {
      totalEntries: entries.length,
      firstEntry: entries[0]?.timestamp,
      lastEntry: entries[entries.length - 1]?.timestamp,
    };
  }

  // ========================================
  // Legacy methods (JSON file format)
  // Kept for backward compatibility
  // ========================================

  /**
   * Get the history directory for an agent (legacy JSON format)
   * @deprecated Use flat file format instead
   */
  private historyDir(agentId: string): string {
    return join(this.stateDir, "agents", agentId, ".agent_history_json");
  }

  /**
   * List all history entries for an agent (legacy JSON format)
   * @deprecated Use getHistory() instead
   */
  async listHistory(agentId: string, limit?: number): Promise<HistoryEntry[]> {
    const historyDir = this.historyDir(agentId);

    if (!existsSync(historyDir)) {
      return [];
    }

    const entries = await readdir(historyDir, { withFileTypes: true });
    const historyEntries: HistoryEntry[] = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        try {
          const filePath = join(historyDir, entry.name);
          const content = await readFile(filePath, "utf-8");
          const historyEntry = JSON.parse(content) as HistoryEntry;
          historyEntry.id = entry.name.replace(".json", "");
          historyEntries.push(historyEntry);
        } catch {
          // Skip invalid entries
        }
      }
    }

    // Sort by timestamp descending
    historyEntries.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply limit
    if (limit && limit > 0) {
      return historyEntries.slice(0, limit);
    }

    return historyEntries;
  }

  /**
   * Get a specific history entry (legacy JSON format)
   * @deprecated Use flat file format instead
   */
  async getHistoryEntry(
    agentId: string,
    entryId: string
  ): Promise<HistoryEntry> {
    const filePath = join(this.historyDir(agentId), `${entryId}.json`);

    if (!existsSync(filePath)) {
      throw new HistoryError(`History entry not found: ${entryId}`);
    }

    const content = await readFile(filePath, "utf-8");
    const entry = JSON.parse(content) as HistoryEntry;
    entry.id = entryId;
    return entry;
  }
}

/**
 * Singleton history service instance
 */
export const historyService = new HistoryService();
