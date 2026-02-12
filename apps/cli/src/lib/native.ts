/**
 * Native NAPI bindings wrapper
 *
 * This module provides type-safe access to Rust viben-core via NAPI.
 * If NAPI fails to load, operations will throw errors.
 */

// Import native module - use default import for CJS compatibility
// @ts-ignore - native module loaded at runtime
import native from '@viben/cli-rs';

// ============================================================
// Types - Using string unions for flexibility with CJS/ESM
// ============================================================

/** Provider type - string union for flexibility */
export type ProviderType = 'OpenAI' | 'Anthropic' | 'Azure' | 'Ollama' | 'OpenRouter' | 'Google' | 'Custom';

/** Provider type constants */
export const ProviderTypes = {
  OpenAI: 'OpenAI' as const,
  Anthropic: 'Anthropic' as const,
  Azure: 'Azure' as const,
  Ollama: 'Ollama' as const,
  OpenRouter: 'OpenRouter' as const,
  Google: 'Google' as const,
  Custom: 'Custom' as const,
};

/** Provider information returned to Node.js */
export interface Provider {
  id: string
  name: string
  providerType: string
  baseUrl?: string
  apiKey?: string
  enabled: boolean
  isDefault: boolean
}

/** Options for creating a provider */
export interface CreateProviderOptions {
  providerType: string
  name: string
  apiKey?: string
  baseUrl?: string
  setAsDefault?: boolean
}

/** Options for updating a provider */
export interface UpdateProviderOptions {
  name?: string
  apiKey?: string
  baseUrl?: string
  providerType?: string
}

/** Provider connection status */
export interface ProviderStatus {
  connected: boolean
  latencyMs?: number
  error?: string
}

/** Model information returned to Node.js */
export interface Model {
  id: string
  name: string
  provider: string
  description?: string
  contextWindow?: number
  maxOutputTokens?: number
  enabled: boolean
  isDefault: boolean
}

/** Options for creating a model */
export interface CreateModelOptions {
  id: string
  name: string
  provider: string
  description?: string
  contextWindow?: number
  maxOutputTokens?: number
  setAsDefault?: boolean
}

/** Options for updating a model */
export interface UpdateModelOptions {
  name?: string
  description?: string
  contextWindow?: number
  maxOutputTokens?: number
}

/** Discovered model from provider */
export interface DiscoveredModel {
  id: string
  name: string
  description?: string
  contextWindow?: number
  maxOutputTokens?: number
}

/** Agent information returned to Node.js */
export interface Agent {
  id: string
  /** Absolute path to the agent directory (e.g., ~/.viben/agents/hello-agent) */
  path?: string
  name: string
  description?: string
  model?: string
  provider?: string
  systemPrompt?: string
  appendPrompt?: string
  temperature?: number
  maxTokens?: number
  executorType?: string
  planMode: boolean
  approvals: boolean
}

/** Options for creating an agent */
export interface CreateAgentOptions {
  name: string
  description?: string
  model?: string
  provider?: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  fromTemplate?: string
}

/** Options for updating an agent */
export interface UpdateAgentOptions {
  name?: string
  description?: string
  model?: string
  provider?: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
}

/** Global configuration object returned to Node.js */
export interface GlobalConfig {
  theme?: string
  locale?: string
  defaultProvider?: string
  defaultModel?: string
  defaultAgent?: string
}

// ============================================================
// Channel Types
// ============================================================

/** Channel type - string union */
export type ChannelType = 'Telegram' | 'Discord' | 'Feishu' | 'WhatsApp' | 'Slack' | 'Webhook';

/** Notification mode - string union */
export type NotificationMode = 'None' | 'InApp' | 'System' | 'Both';

/** Binding type - string union */
export type BindingType = 'Agent' | 'Executor';

/** Agent binding */
export interface AgentBinding {
  bindingType: string
  id: string
  name: string
  workspacePath?: string
}

/** Channel config options */
export interface ChannelConfigOptions {
  telegramToken?: string
  telegramChatId?: string
  telegramProxy?: string
  discordToken?: string
  feishuAppId?: string
  feishuAppSecret?: string
  whatsappBridgeUrl?: string
  slackToken?: string
  webhookUrl?: string
  webhookMethod?: string
}

/** Channel information */
export interface Channel {
  id: string
  channelType: string
  name: string
  enabled: boolean
  isDefault: boolean
  notificationMode: string
  agentBinding?: AgentBinding
  createdAt: string
  updatedAt: string
}

/** Options for creating a channel */
export interface CreateChannelOptions {
  channelType: string
  name: string
  setAsDefault?: boolean
  notificationMode?: string
  agentBinding?: AgentBinding
  config?: ChannelConfigOptions
}

/** Options for updating a channel */
export interface UpdateChannelOptions {
  name?: string
  enabled?: boolean
  notificationMode?: string
  agentBinding?: AgentBinding
  setAsDefault?: boolean
  config?: ChannelConfigOptions
}

/** Channel test result */
export interface ChannelTestResult {
  success: boolean
  details?: string
  error?: string
}

/** Channel send message result */
export interface SendMessageResult {
  success: boolean
  messageId?: string
  error?: string
}

// ============================================================
// Executor Types
// ============================================================

/** Executor type - string union */
export type ExecutorType = 'ClaudeCode' | 'Amp' | 'Gemini' | 'Codex' | 'Opencode' | 'CursorAgent' | 'QwenCode' | 'Copilot' | 'Droid';

/** Availability status - string union */
export type AvailabilityStatus = 'LoginDetected' | 'InstallationFound' | 'NotFound';

/** Executor capability - string union */
export type ExecutorCapability = 'SessionFork' | 'SetupHelper' | 'ContextUsage';

/** Executor availability info */
export interface ExecutorAvailability {
  status: string
  lastAuthTimestamp?: number
}

/** Executor information */
export interface Executor {
  id: string
  name: string
  description: string
  availability: ExecutorAvailability
  capabilities: string[]
  supportsMcp: boolean
  mcpConfigPath?: string
}

// ============================================================
// Cron Types
// ============================================================

/** Job status - string union */
export type JobStatus = 'Success' | 'Failure' | 'Running';

/** Cron job type - string union */
export type CronJobType = 'Agent' | 'Script';

/** Cron notification settings */
export interface CronNotificationSettings {
  inApp: boolean
  system: boolean
  channelIds: string[]
}

/** Cron job information */
export interface CronJob {
  id: string
  name: string
  enabled: boolean
  jobType: string
  message?: string
  script?: string
  cron?: string
  every?: number
  channel?: string
  agent: string
  notifications?: CronNotificationSettings
  lastRun?: number
  lastStatus?: string
  lastError?: string
  lastOutput?: string
  nextRun?: number
  createdAt: number
  updatedAt: number
}

/** Options for creating a cron job */
export interface CreateCronJobOptions {
  id?: string
  name: string
  jobType?: string
  message?: string
  script?: string
  cron?: string
  every?: number
  channel?: string
  agent?: string
  enabled?: boolean
  notifications?: CronNotificationSettings
}

/** Options for updating a cron job */
export interface UpdateCronJobOptions {
  name?: string
  jobType?: string
  message?: string
  script?: string
  cron?: string
  every?: number
  channel?: string
  agent?: string
  enabled?: boolean
  notifications?: CronNotificationSettings
}

// ============================================================
// Native Module Functions - Cast to our types
// ============================================================

// Init functions
export const initialize: () => Promise<void> = native.initialize;
export const version: () => string = native.version;
export const getStateDir: () => string = native.getStateDir;

// Config functions
export const configGet: (key: string) => Promise<string | null> = native.configGet;
export const configSet: (key: string, value?: string | null) => Promise<void> = native.configSet;
export const configGetAll: () => Promise<GlobalConfig> = native.configGetAll;
export const configListKeys: () => string[] = native.configListKeys;
export const configReset: () => Promise<void> = native.configReset;

// Provider functions - cast to our types
export const providerList: () => Promise<Provider[]> = native.providerList;
export const providerGet: (id: string) => Promise<Provider | null> = native.providerGet;
export const providerCreate: (options: CreateProviderOptions) => Promise<Provider> = native.providerCreate as any;
export const providerUpdate: (id: string, options: UpdateProviderOptions) => Promise<Provider> = native.providerUpdate as any;
export const providerRemove: (id: string) => Promise<void> = native.providerRemove;
export const providerSetDefault: (id: string) => Promise<void> = native.providerSetDefault;
export const providerGetDefault: () => Promise<string | null> = native.providerGetDefault;
export const providerTestConnection: (id: string) => Promise<ProviderStatus> = native.providerTestConnection;
export const providerEnable: (id: string) => Promise<void> = native.providerEnable;
export const providerDisable: (id: string) => Promise<void> = native.providerDisable;

// Model functions - cast to our types
export const modelList: () => Promise<Model[]> = native.modelList;
export const modelGet: (id: string) => Promise<Model | null> = native.modelGet;
export const modelCreate: (options: CreateModelOptions) => Promise<Model> = native.modelCreate as any;
export const modelUpdate: (id: string, options: UpdateModelOptions) => Promise<Model> = native.modelUpdate as any;
export const modelRemove: (id: string) => Promise<void> = native.modelRemove;
export const modelSetDefault: (id: string) => Promise<void> = native.modelSetDefault;
export const modelGetDefault: () => Promise<string | null> = native.modelGetDefault;
export const modelEnable: (id: string) => Promise<void> = native.modelEnable;
export const modelDisable: (id: string) => Promise<void> = native.modelDisable;
export const modelDiscover: (providerId: string) => Promise<DiscoveredModel[]> = native.modelDiscover;

// Agent functions
export const agentList: () => Promise<Agent[]> = native.agentList;
export const agentGet: (id: string) => Promise<Agent | null> = native.agentGet;
export const agentCreate: (options: CreateAgentOptions) => Promise<Agent> = native.agentCreate as any;
export const agentUpdate: (id: string, options: UpdateAgentOptions) => Promise<Agent> = native.agentUpdate as any;
export const agentRemove: (id: string) => Promise<void> = native.agentRemove;
export const agentSetDefault: (id: string) => Promise<void> = native.agentSetDefault;
export const agentGetDefault: () => Promise<string | null> = native.agentGetDefault;

/**
 * Check if native bindings are available
 */
export function isNativeAvailable(): boolean {
  try {
    version();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get native module version
 */
export function getNativeVersion(): string {
  return version();
}
