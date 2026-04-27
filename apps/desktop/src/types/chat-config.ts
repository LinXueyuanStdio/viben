/**
 * Chat Config Types
 *
 * Type definitions for dynamic agent and model selection in ChatInput.
 */

// ============================================================================
// Agent Config
// ============================================================================

/**
 * Simplified agent config for chat input selection
 */
export interface ChatAgentConfig {
  id: string;
  name: string;
  description?: string;
  model?: string;
  /** Executor type for the agent (e.g., "CLAUDE_CODE", "CODEX") */
  executor_type?: string;
  /** Source: "global" or "workspace" */
  source?: "global" | "workspace";
}

// ============================================================================
// Model Config
// ============================================================================

/**
 * Simplified model config for chat input selection
 */
export interface ChatModelConfig {
  id: string;
  name: string;
  provider?: string;
  /** Provider ID for executor filtering (e.g., "anthropic", "openai") */
  provider_id?: string;
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * Chat context type determines filtering behavior
 */
export type ChatContextType =
  | "workspace"      // Workspace chat page - show workspace + global agents
  | "agent-debug"    // Agent debug page - hide selectors completely
  | "default";       // Other pages - show all global agents/models

/**
 * Chat context info extracted from current route
 */
export interface ChatContextInfo {
  type: ChatContextType;
  workspaceId?: string;
  agentId?: string;
}

// ============================================================================
// Selector Visibility
// ============================================================================

/**
 * Determines which selectors should be visible in ChatInput
 */
export interface ChatSelectorVisibility {
  showAgentSelector: boolean;
  showModelSelector: boolean;
}
