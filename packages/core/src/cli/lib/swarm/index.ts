/**
 * Swarm Module - Multi-Agent Pipeline Utilities
 *
 * This module provides utilities for the multi-agent pipeline system,
 * supporting multiple AI coding platforms (Claude Code, OpenCode, Cursor, etc.)
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
