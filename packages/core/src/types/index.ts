/**
 * Shared types for @viben/core
 */

// ============================================================================
// Agent Types
// ============================================================================

export interface Agent {
  id: string;
  name: string;
  description?: string;
  model?: string;
  provider?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentConfig {
  name: string;
  description?: string;
  model?: string;
  provider?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
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
  temperature?: number;
  maxTokens?: number;
  fromTemplate?: string;
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
  | "custom";

export interface Provider {
  id: string;
  type: ProviderType;
  name: string;
  apiKey?: string;
  baseUrl?: string;
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
  setAsDefault?: boolean;
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
