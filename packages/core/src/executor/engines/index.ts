/**
 * Executor Engines
 *
 * Import this module to register all executor engines.
 * Each engine file auto-registers itself on import.
 */

// Import engines to trigger registration
import "./amp";
import "./claude";
import "./codex";
import "./copilot";
import "./cursor";
import "./droid";
import "./gemini";
import "./opencode";
import "./qwen";

// Re-export for direct access
export { AmpExecutor } from "./amp";
export type { AmpExecutorConfig } from "./amp";
export { ClaudeExecutor } from "./claude";
export type { ClaudeExecutorConfig } from "./claude";
export { CodexExecutor } from "./codex";
export type { CodexExecutorConfig } from "./codex";
export { CopilotExecutor } from "./copilot";
export type { CopilotExecutorConfig } from "./copilot";
export { CursorAgentExecutor } from "./cursor";
export type { CursorAgentExecutorConfig } from "./cursor";
export { DroidExecutor } from "./droid";
export type { DroidExecutorConfig } from "./droid";
export { GeminiExecutor } from "./gemini";
export { OpencodeExecutor } from "./opencode";
export type { OpencodeExecutorConfig } from "./opencode";
export { QwenCodeExecutor } from "./qwen";
export type { QwenCodeExecutorConfig } from "./qwen";
export { BaseExecutor } from "./base";
