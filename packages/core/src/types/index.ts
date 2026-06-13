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
 * Some executors have both runtime support (can be spawned) and template support (for viben init).
 *
 * Runtime executors: CLAUDE_CODE, AMP, GEMINI, CODEX, OPENCODE, CURSOR_AGENT, QWEN_CODE, COPILOT, DROID, OPENCLAW
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
  | "OPENCLAW"
  // Template-only executors (for viben init configuration)
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
  {
    id: "OPENCLAW",
    name: "OpenClaw",
    description: "Personal AI assistant gateway with multi-agent routing",
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
  /** List of MCP servers this agent can use (string = name-only, object = full connection details) */
  mcpServers: (string | AgentMcpServerEntry)[];
  /** List of skill IDs this agent can use */
  skills: string[];
  /** Approval mode: bypass (skip all), rules (rule-based), ai (AI-evaluated) */
  approvalMode: "bypass" | "rules" | "ai";
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
  created_at: string;
  updated_at: string;
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
  mcpServers?: (string | AgentMcpServerEntry)[];
  skills?: string[];
  approvalMode?: "bypass" | "rules" | "ai";
  isTemplate?: boolean;
  templateDescription?: string;
  templateTags?: string[];
  customVariables?: CustomVariable[];
  envVariables?: string[];
}

export interface AgentSession {
  id: string;
  agent_id: string;
  name?: string;
  created_at: string;
  last_accessed_at: string;
}

export interface AgentMemory {
  agent_id: string;
  content: string;
  updated_at: string;
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
  system_prompt?: string;
  append_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  executor_type?: ExecutorType;
  executor_config?: Record<string, unknown>;
  mcp_servers?: (string | AgentMcpServerEntry)[];
  skills?: string[];
  approval_mode?: "bypass" | "rules" | "ai";
  from_template?: string;
  /** Custom base path for storing the agent (e.g., workspace path) */
  base_path?: string;
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
  mcpServers?: (string | AgentMcpServerEntry)[];
  skills?: string[];
  approvalMode?: "bypass" | "rules" | "ai";
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
  | "volcengine"
  | "grok"
  | "nanobanana"
  | "imagerouter"
  | "custom-image"
  | "fal"
  | "leonardo"
  | "minimax"
  | "elevenlabs"
  | "fishaudio"
  | "senseaudio"
  | "aihubmix"
  | "suno"
  | "udio"
  | "custom";

export type ProviderCategory = "llm" | "media";

export type ProviderSurface =
  | "chat"
  | "image"
  | "video"
  | "music"
  | "speech"
  | "sfx";

export interface Provider {
  id: string;
  type: ProviderType;
  category: ProviderCategory;
  name: string;
  apiKey?: string;
  base_url?: string;
  /** API version (e.g., "2024-01" for Anthropic) */
  apiVersion?: string;
  /** Azure deployment name */
  deployment?: string;
  /** Request timeout in seconds */
  timeout?: number;
  /** Maximum retry attempts */
  max_retries?: number;
  /** Custom headers for requests */
  headers?: Record<string, string>;
  surfaces: ProviderSurface[];
  supportsCustomModel?: boolean;
  isDefault: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProviderConfig {
  type: ProviderType;
  category?: ProviderCategory;
  name: string;
  apiKey?: string;
  base_url?: string;
  apiVersion?: string;
  deployment?: string;
  timeout?: number;
  max_retries?: number;
  headers?: Record<string, string>;
  surfaces?: ProviderSurface[];
  supportsCustomModel?: boolean;
}

export interface ProviderStatus {
  id: string;
  connected: boolean;
  latency?: number;
  error?: string;
  checked_at: string;
}

export interface CreateProviderOptions {
  type: ProviderType;
  category?: ProviderCategory;
  name: string;
  apiKey?: string;
  base_url?: string;
  apiVersion?: string;
  deployment?: string;
  timeout?: number;
  max_retries?: number;
  headers?: Record<string, string>;
  surfaces?: ProviderSurface[];
  supportsCustomModel?: boolean;
  setAsDefault?: boolean;
}

/**
 * Options for updating a provider
 */
export interface ProviderUpdate {
  type?: ProviderType;
  category?: ProviderCategory;
  name?: string;
  apiKey?: string;
  base_url?: string;
  apiVersion?: string;
  deployment?: string;
  timeout?: number;
  max_retries?: number;
  headers?: Record<string, string>;
  surfaces?: ProviderSurface[];
  supportsCustomModel?: boolean;
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
  /** Provider instance ID (e.g. "deepseek-openai") */
  provider_id?: string;
  category?: "llm" | "media";
  surface?: "chat" | "image" | "video" | "music" | "speech" | "sfx";
  capabilities?: string[];
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
  created_at?: string;
  /** Last update timestamp (for custom models) */
  updated_at?: string;
}

export interface ModelConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  provider?: string;
  category?: "llm" | "media";
  surface?: "chat" | "image" | "video" | "music" | "speech" | "sfx";
  capabilities?: string[];
  duration_seconds?: number;
  aspect_ratio?: string;
  size?: string;
  voice_id?: string;
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

/** MCP server entry with full connection details (for agent config) */
export interface AgentMcpServerEntry {
  name: string;
  type: "builtin" | "stdio" | "sse" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

export interface InstalledMcp {
  name: string;
  version: string;
  path: string;
  installed_at: string;
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
  installed_at: string;
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
