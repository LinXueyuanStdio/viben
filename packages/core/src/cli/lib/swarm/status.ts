/**
 * Status monitoring utilities for multi-agent pipeline.
 *
 * Provides functions for checking agent status, reading logs, and monitoring
 * agent activity across both Claude Code and OpenCode platforms.
 */
import { existsSync, readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import {
  runGitCommand,
  registryListAgents,
  registrySearchAgent,
  getPhaseInfo,
  readTaskJson,
  type AgentRegistryEntry,
} from "../viben-workspace";

// =============================================================================
// Types
// =============================================================================

/**
 * Agent status information
 */
export interface AgentStatus {
  /** Agent ID from registry */
  id: string;
  /** Process ID */
  pid: number;
  /** Whether the agent process is currently running */
  running: boolean;
  /** Path to the git worktree */
  worktreePath: string;
  /** Task directory path */
  taskDir: string;
  /** ISO timestamp when agent was started */
  startedAt: string;
  /** Platform (claude, opencode, etc.) */
  platform: string;
  /** Session ID for resuming (if available) */
  sessionId?: string;
  /** Elapsed time since start (formatted) */
  elapsed?: string;
  /** Number of modified files in worktree */
  modifiedFiles?: number;
  /** Last tool call made by agent */
  lastTool?: string | null;
  /** Last assistant message */
  lastMessage?: string | null;
  /** Git branch name */
  branch?: string;
  /** Phase info string (e.g., "1/4 (implement)") */
  phase?: string;
}

/**
 * Log entry parsed from agent log
 */
export interface LogEntry {
  /** Message type */
  type: string;
  /** Display text */
  text: string;
  /** Optional tool name */
  tool?: string;
  /** Optional status */
  status?: string;
}

// =============================================================================
// Process Utilities
// =============================================================================

/**
 * Check if a PID is running.
 *
 * Uses process.kill(pid, 0) which checks if process exists without sending a signal.
 *
 * @param pid - Process ID to check
 * @returns True if the process is running
 */
export function isProcessRunning(pid: number | string | null | undefined): boolean {
  if (!pid) {
    return false;
  }

  try {
    const pidNum = typeof pid === "string" ? parseInt(pid, 10) : pid;
    if (isNaN(pidNum)) {
      return false;
    }
    // On Unix, kill with signal 0 checks if process exists
    process.kill(pidNum, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Calculate elapsed time from ISO timestamp.
 *
 * @param startedAt - ISO timestamp string (e.g., "2024-01-15T10:30:00Z")
 * @returns Formatted elapsed time (e.g., "5m 30s", "2h 15m")
 */
export function calcElapsed(startedAt: string | null | undefined): string {
  if (!startedAt) {
    return "N/A";
  }

  try {
    // Handle timezone suffix
    let dateStr = startedAt;
    if (dateStr.includes("+")) {
      dateStr = dateStr.split("+")[0];
    }

    const startDt = new Date(dateStr);
    const now = new Date();
    const elapsed = (now.getTime() - startDt.getTime()) / 1000;

    if (elapsed < 60) {
      return `${Math.floor(elapsed)}s`;
    } else if (elapsed < 3600) {
      const mins = Math.floor(elapsed / 60);
      const secs = Math.floor(elapsed % 60);
      return `${mins}m ${secs}s`;
    } else {
      const hours = Math.floor(elapsed / 3600);
      const mins = Math.floor((elapsed % 3600) / 60);
      return `${hours}h ${mins}m`;
    }
  } catch {
    return "N/A";
  }
}

// =============================================================================
// Git Utilities
// =============================================================================

/**
 * Count modified files in a git worktree.
 *
 * Uses `git status --short` to count uncommitted changes.
 *
 * @param worktreePath - Path to the git worktree
 * @returns Number of modified files
 */
export function countModifiedFiles(worktreePath: string): number {
  if (!existsSync(worktreePath)) {
    return 0;
  }

  try {
    const { stdout } = runGitCommand(["status", "--short"], worktreePath);
    return stdout.split("\n").filter((line) => line.trim()).length;
  } catch {
    return 0;
  }
}

// =============================================================================
// Log Parsing
// =============================================================================

/**
 * Get the last tool call from agent log.
 *
 * Supports both Claude Code and OpenCode log formats:
 * - Claude: {"type": "assistant", "message": {"content": [{"type": "tool_use", "name": "Read"}]}}
 * - OpenCode: {"type": "tool_use", "tool": "bash", "state": {"status": "completed"}}
 *
 * @param logFile - Path to the .agent-log file
 * @param platform - Platform type ("claude" or "opencode")
 * @returns Tool name or null if not found
 */
export function getLastTool(logFile: string, platform: string = "claude"): string | null {
  if (!existsSync(logFile)) {
    return null;
  }

  try {
    const content = readFileSync(logFile, "utf-8");
    const lines = content.split("\n").slice(-100);

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line.trim()) continue;

      try {
        const data = JSON.parse(line);

        if (platform === "opencode") {
          // OpenCode format: {"type": "tool_use", "tool": "bash", ...}
          if (data.type === "tool_use") {
            return data.tool;
          }
        } else {
          // Claude Code format: {"type": "assistant", "message": {"content": [...]}}
          if (data.type === "assistant") {
            const content = data.message?.content || [];
            for (const item of content) {
              if (item.type === "tool_use") {
                return item.name;
              }
            }
          }
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Get the last assistant message from agent log.
 *
 * Supports both Claude Code and OpenCode log formats:
 * - Claude: {"type": "assistant", "message": {"content": [{"type": "text", "text": "..."}]}}
 * - OpenCode: {"type": "text", "text": "..."}
 *
 * @param logFile - Path to the .agent-log file
 * @param maxLen - Maximum length of returned text (default: 100)
 * @param platform - Platform type ("claude" or "opencode")
 * @returns Message text or null if not found
 */
export function getLastMessage(
  logFile: string,
  maxLen: number = 100,
  platform: string = "claude"
): string | null {
  if (!existsSync(logFile)) {
    return null;
  }

  try {
    const content = readFileSync(logFile, "utf-8");
    const lines = content.split("\n").slice(-100);

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line.trim()) continue;

      try {
        const data = JSON.parse(line);

        if (platform === "opencode") {
          // OpenCode format: {"type": "text", "text": "..."}
          if (data.type === "text" && data.text) {
            return data.text.slice(0, maxLen);
          }
        } else {
          // Claude Code format: {"type": "assistant", "message": {"content": [...]}}
          if (data.type === "assistant") {
            const content = data.message?.content || [];
            for (const item of content) {
              if (item.type === "text" && item.text) {
                return item.text.slice(0, maxLen);
              }
            }
          }
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Get recent log entries from agent log.
 *
 * Parses the last N entries from the agent log file and returns formatted entries.
 *
 * @param logFile - Path to the .agent-log file
 * @param count - Number of recent entries to return (default: 50)
 * @param platform - Platform type ("claude" or "opencode")
 * @returns Array of formatted log entry strings
 */
export function getRecentLogEntries(
  logFile: string,
  count: number = 50,
  platform: string = "claude"
): string[] {
  if (!existsSync(logFile)) {
    return [];
  }

  const entries: string[] = [];

  try {
    const content = readFileSync(logFile, "utf-8");
    const lines = content.split("\n").slice(-count);

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const data = JSON.parse(line);
        const msgType = data.type || "";

        if (platform === "opencode") {
          // OpenCode format
          if (msgType === "text") {
            const text = data.text || "";
            if (text) {
              const display = text.slice(0, 300) + (text.length > 300 ? "..." : "");
              entries.push(`[TEXT] ${display}`);
            }
          } else if (msgType === "tool_use") {
            const toolName = data.tool || "unknown";
            const status = data.state?.status || "";
            entries.push(`[TOOL] ${toolName} (${status})`);
          } else if (msgType === "step_start") {
            entries.push(`[STEP] Start`);
          } else if (msgType === "step_finish") {
            const reason = data.reason || "";
            entries.push(`[STEP] Finish (${reason})`);
          } else if (msgType === "error") {
            const errorMsg = data.message || "";
            entries.push(`[ERROR] ${errorMsg}`);
          }
        } else {
          // Claude Code format
          if (msgType === "system") {
            const subtype = data.subtype || "";
            entries.push(`[SYSTEM] ${subtype}`);
          } else if (msgType === "user") {
            const content = data.message?.content || "";
            if (content) {
              entries.push(`[USER] ${content.slice(0, 200)}`);
            }
          } else if (msgType === "assistant") {
            const content = data.message?.content || [];
            if (content.length > 0) {
              const item = content[0];
              const text = item.text;
              const tool = item.name;
              if (text) {
                const display = text.slice(0, 300) + (text.length > 300 ? "..." : "");
                entries.push(`[ASSISTANT] ${display}`);
              } else if (tool) {
                entries.push(`[TOOL] ${tool}`);
              }
            }
          } else if (msgType === "result") {
            const toolName = data.tool || "unknown";
            entries.push(`[RESULT] ${toolName} completed`);
          }
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Ignore errors
  }

  return entries;
}

// =============================================================================
// Agent Status
// =============================================================================

/**
 * Get session ID from task directory.
 *
 * Reads the session_id field from task.json.
 *
 * @param taskDir - Path to the task directory (absolute)
 * @returns Session ID or null if not found
 */
export function getSessionId(taskDir: string): string | null {
  const taskData = readTaskJson(taskDir);
  if (!taskData) {
    return null;
  }

  // Support both camelCase and snake_case
  const sessionId = (taskData.sessionId as string) || (taskData.session_id as string);
  return sessionId || null;
}

/**
 * Get comprehensive agent status.
 *
 * Collects all status information for a single agent including:
 * - Process running status
 * - Session ID
 * - Elapsed time
 * - Modified files count
 * - Last tool and message
 * - Git branch
 * - Phase info
 *
 * @param agent - Agent registry entry
 * @param repoRoot - Repository root path
 * @returns AgentStatus object with all available information
 */
export function getAgentStatus(agent: AgentRegistryEntry, repoRoot: string): AgentStatus {
  const worktree = agent.worktree_path;
  const platform = agent.platform || "claude";
  const logFile = join(worktree, ".agent-log");
  const taskJsonPath = join(repoRoot, agent.task_dir, "task.json");

  // Get session ID from task.json
  const taskDir = join(repoRoot, agent.task_dir);
  const sessionId = getSessionId(taskDir);

  // Get elapsed time
  const elapsed = calcElapsed(agent.started_at);

  // Get modified files count
  const modifiedFiles = countModifiedFiles(worktree);

  // Get last tool and message
  const lastTool = getLastTool(logFile, platform);
  const lastMessage = getLastMessage(logFile, 150, platform);

  // Get branch from task.json
  let branch: string | undefined;
  const taskData = readTaskJson(taskDir);
  if (taskData) {
    branch = (taskData.branch as string) || undefined;
  }

  // Get phase info
  let phase: string | undefined;
  if (existsSync(taskJsonPath)) {
    phase = getPhaseInfo(taskJsonPath);
  }

  return {
    id: agent.id,
    pid: agent.pid,
    running: isProcessRunning(agent.pid),
    worktreePath: agent.worktree_path,
    taskDir: agent.task_dir,
    startedAt: agent.started_at,
    platform,
    sessionId: sessionId || undefined,
    elapsed,
    modifiedFiles,
    lastTool,
    lastMessage,
    branch,
    phase,
  };
}

/**
 * Get status for all registered agents.
 *
 * @param repoRoot - Repository root path
 * @returns Array of AgentStatus objects
 */
export function getAllAgentStatuses(repoRoot: string): AgentStatus[] {
  const agents = registryListAgents(repoRoot);
  return agents.map((agent) => getAgentStatus(agent, repoRoot));
}

/**
 * Get running agent statuses only.
 *
 * @param repoRoot - Repository root path
 * @returns Array of AgentStatus objects for running agents
 */
export function getRunningAgentStatuses(repoRoot: string): AgentStatus[] {
  return getAllAgentStatuses(repoRoot).filter((status) => status.running);
}

/**
 * Get stopped agent statuses only.
 *
 * @param repoRoot - Repository root path
 * @returns Array of AgentStatus objects for stopped agents
 */
export function getStoppedAgentStatuses(repoRoot: string): AgentStatus[] {
  return getAllAgentStatuses(repoRoot).filter((status) => !status.running);
}

/**
 * Find agent status by task name or agent ID.
 *
 * @param search - Task name or agent ID to search for
 * @param repoRoot - Repository root path
 * @returns AgentStatus or null if not found
 */
export function findAgentStatus(search: string, repoRoot: string): AgentStatus | null {
  const agent = registrySearchAgent(search, repoRoot);
  if (!agent) {
    return null;
  }
  return getAgentStatus(agent, repoRoot);
}

// =============================================================================
// File Watching
// =============================================================================

/**
 * Cleanup function type for tailFollow
 */
export type TailFollowCleanup = () => void;

/**
 * Follow a file like 'tail -f', cross-platform compatible.
 *
 * This function sets up polling to watch for new content added to a file.
 * It returns a cleanup function to stop the watch.
 *
 * @param filePath - Path to the file to watch
 * @param callback - Function called with each new line
 * @returns Cleanup function to stop watching
 */
export function tailFollow(filePath: string, callback: (line: string) => void): TailFollowCleanup {
  // Get initial file size
  let position = 0;
  try {
    const stats = statSync(filePath);
    position = stats.size;
  } catch {
    // Start from beginning if file doesn't exist
  }

  // Poll for changes
  const pollInterval = setInterval(() => {
    try {
      const stats = statSync(filePath);
      if (stats.size > position) {
        // Read new content
        const fd = openSync(filePath, "r");
        const buffer = Buffer.alloc(stats.size - position);
        readSync(fd, buffer, 0, buffer.length, position);
        closeSync(fd);

        const newContent = buffer.toString("utf-8");
        // Split into lines and call callback for each
        const lines = newContent.split("\n");
        for (const line of lines) {
          if (line) {
            callback(line);
          }
        }

        position = stats.size;
      } else if (stats.size < position) {
        // File was truncated, start from beginning
        position = 0;
      }
    } catch {
      // File might have been deleted, continue polling
    }
  }, 100);

  // Return cleanup function
  return () => {
    clearInterval(pollInterval);
  };
}

/**
 * Follow agent log file and output to console.
 *
 * This is a blocking function that watches the log file until
 * the process receives SIGINT or SIGTERM.
 *
 * @param filePath - Path to the log file
 */
export function tailFollowConsole(filePath: string): void {
  // Get initial file size
  let position = 0;
  try {
    const stats = statSync(filePath);
    position = stats.size;
  } catch {
    // Start from beginning if file doesn't exist
  }

  // Poll for changes
  const pollInterval = setInterval(() => {
    try {
      const stats = statSync(filePath);
      if (stats.size > position) {
        // Read new content
        const fd = openSync(filePath, "r");
        const buffer = Buffer.alloc(stats.size - position);
        readSync(fd, buffer, 0, buffer.length, position);
        closeSync(fd);

        process.stdout.write(buffer.toString("utf-8"));
        position = stats.size;
      } else if (stats.size < position) {
        // File was truncated, start from beginning
        position = 0;
      }
    } catch {
      // File might have been deleted, continue polling
    }
  }, 100);

  // Handle cleanup
  const cleanup = () => {
    clearInterval(pollInterval);
    console.log();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}
