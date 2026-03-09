/**
 * Shared types for @viben/core
 */

// ============================================================================
// Executor Types
// ============================================================================

/**
 * Supported executor types for AI coding agents
 *
 * These are the canonical executor IDs used throughout the system.
 * Some executors have both runtime support (can be spawned) and template support (for team init).
 *
 * Runtime executors: CLAUDE_CODE, AMP, GEMINI, CODEX, OPENCODE, CURSOR_AGENT, QWEN_CODE, COPILOT, DROID
 * Template-only executors: CURSOR, IFLOW, KILO, KIRO, ANTIGRAVITY, WINDSURF, AIDER, CONTINUE
 */
export type ExecutorType =
  // Runtime executors (can be spawned and executed)
  | "CLAUDE_CODE"
  | "AMP"
  | "GEMINI"
  | "CODEX"
  | "OPENCODE"
  | "CURSOR_AGENT"
  | "QWEN_CODE"
  | "COPILOT"
  | "DROID"
  // Template-only executors (for team init configuration)
  | "CURSOR"
  | "IFLOW"
  | "KILO"
  | "KIRO"
  | "ANTIGRAVITY"
  | "WINDSURF"
  | "AIDER"
  | "CONTINUE";

/**
 * Agent type metadata for UI display
 * @deprecated Use ExecutorInfo from Gateway API instead. The metadata is now served by the backend.
 */
export interface AgentTypeInfo {
  id: ExecutorType;
  name: string;
  description: string;
  icon?: string;
  docsUrl?: string;
}

/**
 * All agent types with their metadata
 * @deprecated Use Gateway API /api/executors to get executor metadata. This constant will be removed.
 */
export const AGENT_TYPES: AgentTypeInfo[] = [
  {
    id: "CLAUDE_CODE",
    name: "Claude Code",
    description: "Anthropic's coding assistant powered by Claude",
    docsUrl: "https://claude.ai",
  },
  {
    id: "AMP",
    name: "Amp",
    description: "AI-powered code assistant",
  },
  {
    id: "GEMINI",
    name: "Gemini",
    description: "Google's AI coding assistant",
    docsUrl: "https://gemini.google.com",
  },
  {
    id: "CODEX",
    name: "Codex",
    description: "OpenAI's code-specialized model",
    docsUrl: "https://openai.com",
  },
  {
    id: "OPENCODE",
    name: "Opencode",
    description: "Open source coding assistant",
  },
  {
    id: "CURSOR_AGENT",
    name: "Cursor Agent",
    description: "Cursor's AI coding assistant",
    docsUrl: "https://cursor.so",
  },
  {
    id: "QWEN_CODE",
    name: "Qwen Code",
    description: "Alibaba's Qwen coding model",
    docsUrl: "https://qwen.aliyun.com",
  },
  {
    id: "COPILOT",
    name: "GitHub Copilot",
    description: "GitHub's AI pair programmer",
    docsUrl: "https://github.com/features/copilot",
  },
  {
    id: "DROID",
    name: "Droid",
    description: "Droid AI coding assistant",
  },
];

/**
 * Get agent type info by ID
 * @deprecated Use Gateway API /api/executors to get executor metadata.
 */
export function getAgentTypeInfo(id: ExecutorType): AgentTypeInfo | undefined {
  return AGENT_TYPES.find((a) => a.id === id);
}

/**
 * Agent capabilities
 */
export type AgentCapability =
  | "SESSION_FORK"
  | "SETUP_HELPER"
  | "CONTEXT_USAGE";

/**
 * Agent availability status
 */
export type AvailabilityStatus =
  | "LOGIN_DETECTED"
  | "INSTALLATION_FOUND"
  | "NOT_FOUND";

/**
 * Agent availability information
 */
export interface AvailabilityInfo {
  status: AvailabilityStatus;
  lastAuthTimestamp?: number;
  /** Path to the executable (if found) */
  path?: string;
}

// ============================================================================
// Agent Types
// ============================================================================

/**
 * Custom variable definition for agent templates
 */
export interface CustomVariable {
  /** Variable name (used as placeholder in prompts) */
  name: string;
  /** Default value for the variable */
  defaultValue?: string;
  /** Description of what this variable is for */
  description?: string;
}

export interface Agent {
  id: string;
  name: string;
  /** Absolute path to the agent directory (runtime only, not persisted) */
  path?: string;
  description?: string;
  /** List of tool names this agent can use */
  tools: string[];
  model?: string;
  provider?: string;
  systemPrompt?: string;
  /** Text appended to prompts */
  appendPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  /** Executor type (e.g., CLAUDE_CODE, AMP, GEMINI) */
  executorType?: ExecutorType;
  /** Executor-specific configuration */
  executorConfig?: Record<string, unknown>;
  /** List of MCP server IDs this agent can use */
  mcpServers: string[];
  /** List of skill IDs this agent can use */
  skills: string[];
  /** Whether plan mode is enabled (for Claude Code) */
  planMode: boolean;
  /** Whether approvals are required (for Claude Code) */
  approvals: boolean;
  /** Whether this agent is a template */
  isTemplate?: boolean;
  /** Template description (shown in template picker) */
  templateDescription?: string;
  /** Template tags for categorization */
  templateTags?: string[];
  /** Custom variables with default values */
  customVariables?: CustomVariable[];
  /** Environment variable references */
  envVariables?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentConfig {
  name: string;
  description?: string;
  tools?: string[];
  model?: string;
  provider?: string;
  systemPrompt?: string;
  appendPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  executorType?: ExecutorType;
  executorConfig?: Record<string, unknown>;
  mcpServers?: string[];
  skills?: string[];
  planMode?: boolean;
  approvals?: boolean;
  isTemplate?: boolean;
  templateDescription?: string;
  templateTags?: string[];
  customVariables?: CustomVariable[];
  envVariables?: string[];
}

export interface AgentSession {
  id: string;
  agentId: string;
  name?: string;
  createdAt: string;
  lastAccessedAt: string;
}

export interface AgentMemory {
  agentId: string;
  content: string;
  updatedAt: string;
}

export interface DailyLog {
  date: string;
  entries: LogEntry[];
}

export interface LogEntry {
  timestamp: string;
  type: "user" | "assistant" | "system";
  content: string;
}

export interface CreateAgentOptions {
  id?: string;
  name: string;
  description?: string;
  tools?: string[];
  model?: string;
  provider?: string;
  systemPrompt?: string;
  appendPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  executorType?: ExecutorType;
  executorConfig?: Record<string, unknown>;
  mcpServers?: string[];
  skills?: string[];
  planMode?: boolean;
  approvals?: boolean;
  fromTemplate?: string;
  /** Custom base path for storing the agent (e.g., workspace path) */
  basePath?: string;
}

/**
 * Options for updating an agent
 */
export interface AgentUpdate {
  name?: string;
  description?: string;
  tools?: string[];
  model?: string;
  provider?: string;
  systemPrompt?: string;
  appendPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  executorType?: ExecutorType;
  executorConfig?: Record<string, unknown>;
  mcpServers?: string[];
  skills?: string[];
  planMode?: boolean;
  approvals?: boolean;
}

// ============================================================================
// Provider Types
// ============================================================================

export type ProviderType =
  | "openai"
  | "anthropic"
  | "azure"
  | "ollama"
  | "openrouter"
  | "google"
  | "custom";

export interface Provider {
  id: string;
  type: ProviderType;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  /** API version (e.g., "2024-01" for Anthropic) */
  apiVersion?: string;
  /** Azure deployment name */
  deployment?: string;
  /** Request timeout in seconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Custom headers for requests */
  headers?: Record<string, string>;
  isDefault: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderConfig {
  type: ProviderType;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  apiVersion?: string;
  deployment?: string;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

export interface ProviderStatus {
  id: string;
  connected: boolean;
  latency?: number;
  error?: string;
  checkedAt: string;
}

export interface CreateProviderOptions {
  type: ProviderType;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  apiVersion?: string;
  deployment?: string;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
  setAsDefault?: boolean;
}

/**
 * Options for updating a provider
 */
export interface ProviderUpdate {
  type?: ProviderType;
  name?: string;
  apiKey?: string;
  baseUrl?: string;
  apiVersion?: string;
  deployment?: string;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

// ============================================================================
// Model Types
// ============================================================================

/**
 * Model definition
 */
export interface Model {
  id: string;
  name: string;
  provider: string;
  description?: string;
  contextLength?: number;
  maxOutputTokens?: number;
  inputPrice?: number;
  outputPrice?: number;
  /** Whether this is the default model */
  isDefault?: boolean;
  /** Whether this model is enabled */
  enabled?: boolean;
  /** Creation timestamp (for custom models) */
  createdAt?: string;
  /** Last update timestamp (for custom models) */
  updatedAt?: string;
}

export interface ModelConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface ModelAlias {
  alias: string;
  model: string;
}

// ============================================================================
// MCP Types
// ============================================================================

export interface McpServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

export interface InstalledMcp {
  name: string;
  version: string;
  path: string;
  installedAt: string;
}

// ============================================================================
// Skill Types
// ============================================================================

export interface Skill {
  id: string;
  name: string;
  description?: string;
  version: string;
  path: string;
  source: "local" | "marketplace";
}

export interface InstalledSkill {
  name: string;
  version: string;
  path: string;
  installedAt: string;
}

// ============================================================================
// Config Types
// ============================================================================

export interface GlobalConfig {
  defaultAgent?: string;
  defaultProvider?: string;
  defaultModel?: string;
  theme?: "light" | "dark" | "system";
  locale?: string;
}

export interface ProvidersConfig {
  providers: Provider[];
  default?: string;
}

export interface ModelsConfig {
  default?: string;
  aliases: Record<string, string>;
  fallbacks: string[];
  configs: Record<string, ModelConfig>;
}

// GitHub Types
export * from "./github";
