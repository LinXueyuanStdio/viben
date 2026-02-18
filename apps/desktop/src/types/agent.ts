/**
 * Agent Types for Desktop-Gateway Integration
 *
 * TypeScript types matching Rust CodingAgent from viben-executors
 */

// Re-export from @viben/core/shared for browser compatibility
// Note: Using /shared subpath to avoid Node.js-only dependencies like undici
export type { ExecutorType } from "@viben/core/shared";
import type { ExecutorType } from "@viben/core/shared";

// ============================================================================
// Availability Info (matching Rust AvailabilityInfo)
// ============================================================================

/**
 * Agent availability information
 * Must match: crates/viben-executors/src/executors/mod.rs AvailabilityInfo enum
 */
export type AvailabilityInfo =
  | { type: "LOGIN_DETECTED"; last_auth_timestamp: number }
  | { type: "INSTALLATION_FOUND" }
  | { type: "NOT_FOUND" };

/**
 * Check if availability indicates the agent is usable
 */
export function isAvailable(info: AvailabilityInfo): boolean {
  return info.type === "LOGIN_DETECTED" || info.type === "INSTALLATION_FOUND";
}

// ============================================================================
// Agent Capabilities (matching Rust BaseAgentCapability)
// ============================================================================

/**
 * Agent capabilities
 * Must match: crates/viben-executors/src/executors/mod.rs BaseAgentCapability enum
 */
export type BaseAgentCapability =
  | "SESSION_FORK"
  | "SETUP_HELPER"
  | "CONTEXT_USAGE";

// ============================================================================
// Executor-Specific Configurations
// ============================================================================

/**
 * ClaudeCode executor configuration
 * Must match: crates/viben-executors/src/executors/claude.rs ClaudeCode struct
 */
export interface ClaudeCodeConfig {
  /** Text appended to prompts */
  append_prompt?: string;
  /** Enable plan mode */
  plan?: boolean;
  /** Enable approvals mode */
  approvals?: boolean;
  /** Model to use (e.g., claude-3-opus-20240229) */
  model?: string;
  /** Skip permission checks (dangerous) */
  dangerously_skip_permissions?: boolean;
  /** Override the base command */
  base_command_override?: string;
  /** Additional environment variables */
  env?: Record<string, string>;
}

/**
 * Amp executor configuration
 */
export interface AmpConfig {
  /** Model to use */
  model?: string;
  /** API key */
  api_key?: string;
}

/**
 * Gemini executor configuration
 */
export interface GeminiConfig {
  /** Model to use */
  model?: string;
  /** API key */
  api_key?: string;
}

/**
 * Codex executor configuration
 */
export interface CodexConfig {
  /** Model to use */
  model?: string;
  /** API key */
  api_key?: string;
}

/**
 * Opencode executor configuration
 */
export interface OpencodeConfig {
  /** Model to use */
  model?: string;
}

/**
 * Cursor Agent configuration
 */
export interface CursorAgentConfig {
  /** Cursor executable path */
  cursor_path?: string;
}

/**
 * Qwen Code configuration
 */
export interface QwenCodeConfig {
  /** Model to use */
  model?: string;
  /** API key */
  api_key?: string;
}

/**
 * GitHub Copilot configuration
 */
export interface CopilotConfig {
  /** No specific config yet */
}

/**
 * Droid configuration
 */
export interface DroidConfig {
  /** Model to use */
  model?: string;
}

/**
 * Union type for all executor configurations
 */
export type ExecutorConfig =
  | { type: "CLAUDE_CODE"; config: ClaudeCodeConfig }
  | { type: "AMP"; config: AmpConfig }
  | { type: "GEMINI"; config: GeminiConfig }
  | { type: "CODEX"; config: CodexConfig }
  | { type: "OPENCODE"; config: OpencodeConfig }
  | { type: "CURSOR_AGENT"; config: CursorAgentConfig }
  | { type: "QWEN_CODE"; config: QwenCodeConfig }
  | { type: "COPILOT"; config: CopilotConfig }
  | { type: "DROID"; config: DroidConfig };

/**
 * Get default config for an agent type
 */
export function getDefaultConfig(agentType: ExecutorType): ExecutorConfig {
  switch (agentType) {
    case "CLAUDE_CODE":
      return {
        type: "CLAUDE_CODE",
        config: {
          plan: false,
          approvals: false,
          dangerously_skip_permissions: false,
        },
      };
    case "AMP":
      return { type: "AMP", config: {} };
    case "GEMINI":
      return { type: "GEMINI", config: {} };
    case "CODEX":
      return { type: "CODEX", config: {} };
    case "OPENCODE":
      return { type: "OPENCODE", config: {} };
    case "CURSOR_AGENT":
      return { type: "CURSOR_AGENT", config: {} };
    case "QWEN_CODE":
      return { type: "QWEN_CODE", config: {} };
    case "COPILOT":
      return { type: "COPILOT", config: {} };
    case "DROID":
      return { type: "DROID", config: {} };
    default:
      return { type: "CLAUDE_CODE", config: {} };
  }
}

// ============================================================================
// Agent Session Types
// ============================================================================

/**
 * Active agent session
 */
export interface AgentSession {
  id: string;
  agentType: ExecutorType;
  workdir: string;
  startedAt: string;
  lastMessageAt?: string;
}

// ============================================================================
// Gateway Request/Response Types
// ============================================================================

/**
 * Spawn agent request
 */
export interface SpawnAgentRequest {
  prompt: string;
  workdir: string;
  session_id?: string;
  config?: Record<string, unknown>;
}

/**
 * Spawn agent response
 */
export interface SpawnAgentResponse {
  session_id: string;
  status: "spawned";
}

/**
 * Agent details from gateway
 */
export interface AgentDetails {
  id: string;
  name: string;
  availability: AvailabilityInfo;
  supports_mcp: boolean;
  capabilities: string[];
}
