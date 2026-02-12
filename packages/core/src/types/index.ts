/**
 * Shared types for @viben/core
 */

// ============================================================================
// Executor Types
// ============================================================================

/**
 * Supported executor types for AI coding agents
 */
export type ExecutorType =
  | "CLAUDE_CODE"
  | "AMP"
  | "GEMINI"
  | "CODEX"
  | "OPENCODE"
  | "CURSOR_AGENT"
  | "QWEN_CODE"
  | "COPILOT"
  | "DROID";

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
}

// ============================================================================
// Agent Types
// ============================================================================

export interface Agent {
  id: string;
  name: string;
  /** Absolute path to the agent directory (runtime only, not persisted) */
  path?: string;
  description?: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface AgentConfig {
  name: string;
  description?: string;
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

export interface AgentTemplate {
  id: string;
  name: string;
  description?: string;
  config: AgentConfig;
  createdAt: string;
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

export interface Model {
  id: string;
  name: string;
  provider: string;
  contextLength?: number;
  maxOutputTokens?: number;
  inputPrice?: number;
  outputPrice?: number;
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
