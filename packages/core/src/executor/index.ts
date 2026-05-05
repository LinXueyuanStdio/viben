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
export {
  AmpExecutor,
  ClaudeExecutor,
  CodexExecutor,
  CopilotExecutor,
  CursorAgentExecutor,
  DroidExecutor,
  GeminiExecutor,
  OpencodeExecutor,
  OpenClawExecutor,
  QwenCodeExecutor,
  BaseExecutor,
} from "./engines";
export type {
  AmpExecutorConfig,
  ClaudeExecutorConfig,
  CodexExecutorConfig,
  CopilotExecutorConfig,
  CursorAgentExecutorConfig,
  DroidExecutorConfig,
  OpencodeExecutorConfig,
  OpenClawExecutorConfig,
  QwenCodeExecutorConfig,
} from "./engines";
