/**
 * History service for .agent_history management
 *
 * Provides access to agent execution history stored in the file system.
 */
import { join } from "node:path";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { getStateDir } from "../config/paths";
import { HistoryError } from "../error";

/**
 * History entry from .agent_history
 */
export interface HistoryEntry {
  /** Entry ID (filename without extension) */
  id: string;
  /** Timestamp */
  timestamp: string;
  /** Agent ID */
  agentId: string;
  /** Session ID */
  sessionId?: string;
  /** Prompt/command that was executed */
  prompt: string;
  /** Result/output */
  result?: string;
  /** Exit code (for script executions) */
  exitCode?: number;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * History service for agent history management
 */
export class HistoryService {
  private stateDir: string;

  constructor(stateDir?: string) {
    this.stateDir = stateDir || getStateDir();
  }

  /**
   * Get the history directory for an agent
   */
  private historyDir(agentId: string): string {
    return join(this.stateDir, "agents", agentId, ".agent_history");
  }

  /**
   * List all history entries for an agent
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
    historyEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit
    if (limit && limit > 0) {
      return historyEntries.slice(0, limit);
    }

    return historyEntries;
  }

  /**
   * Get a specific history entry
   */
  async getHistoryEntry(agentId: string, entryId: string): Promise<HistoryEntry> {
    const filePath = join(this.historyDir(agentId), `${entryId}.json`);

    if (!existsSync(filePath)) {
      throw new HistoryError(`History entry not found: ${entryId}`);
    }

    const content = await readFile(filePath, "utf-8");
    const entry = JSON.parse(content) as HistoryEntry;
    entry.id = entryId;
    return entry;
  }

  /**
   * Get history stats for an agent
   */
  async getHistoryStats(agentId: string): Promise<{ totalEntries: number; latestEntry?: string }> {
    const entries = await this.listHistory(agentId, 1);
    return {
      totalEntries: entries.length,
      latestEntry: entries[0]?.timestamp,
    };
  }
}

/**
 * Singleton history service instance
 */
export const historyService = new HistoryService();
