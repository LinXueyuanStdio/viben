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

// Channel functions
export const channelList: () => Promise<Channel[]> = native.channelList;
export const channelGet: (id: string) => Promise<Channel | null> = native.channelGet;
export const channelCreate: (options: CreateChannelOptions) => Promise<Channel> = native.channelCreate as any;
export const channelUpdate: (id: string, options: UpdateChannelOptions) => Promise<Channel> = native.channelUpdate as any;
export const channelRemove: (id: string) => Promise<void> = native.channelRemove;
export const channelSetDefault: (id: string) => Promise<void> = native.channelSetDefault;
export const channelGetDefault: () => Promise<string | null> = native.channelGetDefault;
export const channelTestConnection: (id: string) => Promise<ChannelTestResult> = native.channelTestConnection;
export const channelEnable: (id: string) => Promise<void> = native.channelEnable;
export const channelDisable: (id: string) => Promise<void> = native.channelDisable;
export const channelSendMessage: (id: string, chatId: string, message: string) => Promise<SendMessageResult> = native.channelSendMessage;

// Executor functions
export const executorList: () => Executor[] = native.executorList;
export const executorGet: (id: string) => Executor | null = native.executorGet;
export const executorCheckAvailability: (id: string) => ExecutorAvailability = native.executorCheckAvailability;
export const executorGetAllIds: () => string[] = native.executorGetAllIds;

// Cron functions
export const cronList: () => Promise<CronJob[]> = native.cronList;
export const cronGet: (id: string) => Promise<CronJob | null> = native.cronGet;
export const cronCreate: (options: CreateCronJobOptions) => Promise<CronJob> = native.cronCreate as any;
export const cronUpdate: (id: string, options: UpdateCronJobOptions) => Promise<CronJob> = native.cronUpdate as any;
export const cronRemove: (id: string) => Promise<void> = native.cronRemove;
export const cronEnable: (id: string) => Promise<CronJob> = native.cronEnable;
export const cronDisable: (id: string) => Promise<CronJob> = native.cronDisable;
export const cronRun: (id: string) => Promise<void> = native.cronRun;

// ============================================================
// Service/Daemon Types
// ============================================================

/** Service type - string union */
export type ServiceType = 'Mcp' | 'Viben';

/** Service status - string union */
export type ServiceStatus = 'Running' | 'Stopped' | 'Error' | 'Unknown';

/** Parsed service name */
export interface ParsedServiceName {
  serviceType: string;
  identifier: string;
}

/** Service information */
export interface ServiceInfo {
  name: string;
  serviceType: string;
  status: string;
  pid?: number;
  uptime?: string;
  error?: string;
  command?: string;
  args?: string[];
}

// Service functions
export const serviceList: () => ServiceInfo[] = native.serviceList;
export const serviceGetStatus: (name: string) => ServiceInfo = native.serviceGetStatus;
export const serviceStart: (name: string, command: string, args: string[]) => ServiceInfo = native.serviceStart;
export const serviceStop: (name: string) => ServiceInfo = native.serviceStop;
export const serviceRestart: (name: string, command?: string, args?: string[]) => ServiceInfo = native.serviceRestart;
export const serviceReadLogs: (name: string, lines?: number) => string[] = native.serviceReadLogs;
export const serviceClearLogs: (name: string) => void = native.serviceClearLogs;
export const serviceGetLogPath: (name: string) => string = native.serviceGetLogPath;
export const serviceParseName: (name: string) => ParsedServiceName = native.serviceParseName;

// ============================================================
// Skill Types
// ============================================================

/** Installed skill information */
export interface NativeSkill {
  id: string;
  version: string;
  installedAt: string;
  description?: string;
}

/** Available skill from marketplace */
export interface NativeAvailableSkill {
  id: string;
  name: string;
  version: string;
  description: string;
}

/** Parsed skill name */
export interface ParsedSkillName {
  name: string;
  version?: string;
}

// Skill functions
export const skillList: () => NativeSkill[] = native.skillList;
export const skillGet: (id: string) => NativeSkill | null = native.skillGet;
export const skillIsInstalled: (id: string) => boolean = native.skillIsInstalled;
export const skillInstall: (name: string, version?: string) => NativeSkill = native.skillInstall;
export const skillUninstall: (name: string) => boolean = native.skillUninstall;
export const skillValidateId: (id: string) => void = native.skillValidateId;
export const skillParseName: (nameWithVersion: string) => ParsedSkillName = native.skillParseName;
export const skillGetAvailable: () => NativeAvailableSkill[] = native.skillGetAvailable;
export const skillGetDir: () => string = native.skillGetDir;

// ============================================================
// Workspace Types
// ============================================================

/** MCP configuration for workspace */
export interface NativeMcpConfig {
  enabled: string[];
  disabled?: string[];
}

/** Skills configuration for workspace */
export interface NativeWorkspaceSkillsConfig {
  enabled: string[];
  disabled?: string[];
}

/** Workspace information */
export interface NativeWorkspaceInfo {
  path: string;
  name: string;
  configPath: string;
  mcp?: NativeMcpConfig;
  skills?: NativeWorkspaceSkillsConfig;
  agents?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// Workspace functions
export const workspaceList: () => NativeWorkspaceInfo[] = native.workspaceList;
export const workspaceGetCurrent: () => NativeWorkspaceInfo | null = native.workspaceGetCurrent;
export const workspaceGetCurrentPath: () => string | null = native.workspaceGetCurrentPath;
export const workspaceIsInWorkspace: () => boolean = native.workspaceIsInWorkspace;
export const workspaceGetInfo: (path: string) => NativeWorkspaceInfo | null = native.workspaceGetInfo;
export const workspaceAddKnown: (path: string, name?: string) => void = native.workspaceAddKnown;
export const workspaceRemoveKnown: (path: string) => void = native.workspaceRemoveKnown;
export const workspaceFindRoot: (startPath: string) => string | null = native.workspaceFindRoot;

// ============================================================
// Workspace Init Types
// ============================================================

/** Options for initializing a workspace */
export interface InitWorkspaceOptions {
  targetDir?: string;
  template?: string;
  force?: boolean;
}

/** Result of workspace initialization */
export interface InitWorkspaceResult {
  success: boolean;
  path: string;
  files: string[];
}

// Workspace init function
export const workspaceInit: (options?: InitWorkspaceOptions) => InitWorkspaceResult = native.workspaceInit;

// ============================================================
// Channel Types (Additional)
// ============================================================

/** Channel type information */
export interface ChannelTypeInfo {
  id: string;
  name: string;
  description: string;
  setupDifficulty: string;
}

// Channel type list function
export const channelListTypes: () => ChannelTypeInfo[] = native.channelListTypes;

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
