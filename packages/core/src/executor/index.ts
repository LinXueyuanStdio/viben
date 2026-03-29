/**
 * Unified Executor Module
 *
 * Central module for AI executor operations. Import from here for all executor functionality.
 *
 * Usage:
 *   import { getExecutor, type Executor } from "./executor";
 *
 *   const claude = getExecutor("CLAUDE_CODE");
 *   const result = await claude.chat({ prompt: "Hello" });
 */

// Register all engines (must be first)
import "./engines";

// Re-export everything from ops
export * from "./ops";

// Re-export engine classes for direct instantiation
export { ClaudeExecutor, GeminiExecutor, BaseExecutor } from "./engines";
export type { ClaudeExecutorConfig } from "./engines";
