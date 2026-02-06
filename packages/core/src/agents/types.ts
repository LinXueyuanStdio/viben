/**
 * Agent-specific types (re-exports from main types for convenience)
 */
export type {
  Agent,
  AgentConfig,
  AgentTemplate,
  AgentSession,
  AgentMemory,
  DailyLog,
  LogEntry,
  CreateAgentOptions,
} from "../types";

/**
 * Internal agent config file structure
 */
export interface AgentConfigFile {
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

/**
 * Session file structure
 */
export interface SessionFile {
  id: string;
  name?: string;
  createdAt: string;
  lastAccessedAt: string;
}
