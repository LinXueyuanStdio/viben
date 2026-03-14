/**
 * Queue Module
 *
 * Shared command queue system for CLI and Gateway.
 * Provides detached process execution with file-based persistence.
 *
 * Usage:
 * - CLI: viben queue <command>
 * - Gateway API: /api/queue/*
 *
 * Storage: ~/.viben/queue/
 *
 * Note: Core components (CommandQueue, Promoter, Monitor) extend EventEmitter
 * and are exported separately to avoid rollup DTS issues.
 * Import them directly: import { CommandQueue } from "./queue/core"
 */

// Re-export operations layer (used by CLI and Gateway)
export * from "./ops";

// Re-export persistence utilities (safe for main export)
export { getQueueDir, ensureDirectories } from "./core/persistence";

// Core components are NOT re-exported here to avoid rollup DTS issues with EventEmitter.
// They should be imported directly from "./queue/core" when needed by Gateway.
