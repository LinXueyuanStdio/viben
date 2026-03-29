/**
 * Executor Engines
 *
 * Import this module to register all executor engines.
 * Each engine file auto-registers itself on import.
 */

// Import engines to trigger registration
import "./claude";
import "./gemini";

// Re-export for direct access
export { ClaudeExecutor } from "./claude";
export type { ClaudeExecutorConfig } from "./claude";
export { GeminiExecutor } from "./gemini";
export { BaseExecutor } from "./base";
