/**
 * Swarm Module - Multi-Agent Pipeline Utilities
 *
 * This module provides utilities for the multi-agent pipeline system,
 * supporting multiple AI coding platforms (Claude Code, OpenCode, Cursor, etc.)
 *
 * All Python scripts in templates/viben/scripts/multi_agent/ have been
 * reimplemented in TypeScript in this module:
 * - start.py → start.ts
 * - status.py → status.ts
 * - cleanup.py → cleanup.ts
 */

// CLI Adapter
export {
  // Types
  type Platform,
  type RunCommandOptions,
  type ICLIAdapter,
  // Classes
  CLIAdapter,
  // Factory functions
  createCLIAdapter,
  createCLIAdapterAuto,
  detectPlatform,
  // Backward compatibility
  getCLIAdapter,
  getCLIAdapterAuto,
} from "./cli-adapter";

// Registry
export {
  type AgentEntry,
  type Registry,
  getRegistryPath,
  readRegistry,
  writeRegistry,
  registryAddAgent,
  registryRemoveById,
  registryRemoveByWorktree,
  registryGetAgentById,
  registryGetAgentByWorktree,
  registrySearchAgent,
  registryGetTaskDir,
  registryListAgents,
} from "./registry";

// Worktree
export {
  getWorktreeCopyFiles,
  getWorktreePostCreateHooks,
} from "./worktree";

// Start Agent
export {
  type StartOptions,
  type StartResult,
  startAgent,
  startAgentSync,
} from "./start";

// Status Monitoring
export {
  type AgentStatus,
  type LogEntry,
  type TailFollowCleanup,
  isProcessRunning,
  calcElapsed,
  countModifiedFiles,
  getLastTool,
  getLastMessage,
  getRecentLogEntries,
  getSessionId,
  getAgentStatus,
  getAllAgentStatuses,
  getRunningAgentStatuses,
  getStoppedAgentStatuses,
  findAgentStatus,
  tailFollow,
  tailFollowConsole,
} from "./status";

// Cleanup
export {
  type CleanupOptions,
  type CleanupResult,
  type WorktreeInfo,
  listWorktrees,
  findWorktreeByBranch,
  getMergedBranches,
  archiveTask,
  cleanupRegistryOnly,
  cleanupWorktree,
  cleanupMerged,
  cleanupAll,
  getCleanupSummary,
} from "./cleanup";
