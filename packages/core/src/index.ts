/**
 * @viben/core - Shared core library for Viben
 *
 * This library provides configuration management, agent/provider/model management
 * for both the CLI and Desktop applications.
 */

// Types
export * from "./types";

// Errors
export {
  VibenError,
  NotFoundError,
  AlreadyExistsError,
  ValidationError,
  ExecutorError,
  DatabaseError,
  CronError,
  EventError,
  SessionStoreError,
  HistoryError,
  GatewayError,
} from "./error";

// Config management
export {
  ConfigManager,
  ProvidersConfigManager,
  ModelsConfigManager,
  configManager,
  providersConfigManager,
  modelsConfigManager,
  getStateDir,
  getConfigPath,
  getProvidersPath,
  getModelsPath,
  getAgentsDir,
  getAgentDir,
  getAgentConfigPath,
  getAgentMcpServersPath,
  getAgentSkillsDir,
  getAgentMemoryDir,
  getAgentSessionsDir,
  getTemplatesDir,
  getTemplateDir,
  getSharedMcpDir,
  getSharedSkillsDir,
  readYaml,
  writeYaml,
  readJson,
  writeJson,
  ensureDir,
  fileExists,
} from "./config";

// Agent management
export {
  AgentManager,
  agentManager,
  type AgentConfigFile,
  type SessionFile,
} from "./agents";

// Provider management
export {
  ProviderManager,
  providerManager,
  DEFAULT_BASE_URLS,
  ENV_VAR_NAMES,
  type ProviderEntry,
  type ProvidersFile,
} from "./providers";

// Model management
export {
  ModelManager,
  modelManager,
  KNOWN_MODELS,
  DEFAULT_ALIASES,
  getKnownModel,
  getModelsByProvider,
  // Model discovery
  discoverModels,
  discoverAllModels,
  enrichModel,
  type DiscoveredModel,
  type DiscoveryResult,
  // Types
  type ModelsFile,
  type ModelConfigEntry,
  type KnownModel,
} from "./models";

// MCP management
export {
  McpManager,
  mcpManager,
  type McpServersFile,
  type McpServerEntry,
  type InstalledMcpFile,
  type InstalledMcpEntry,
} from "./mcp";

// Skills management
export {
  SkillsManager,
  skillsManager,
  type InstalledSkillsFile,
  type InstalledSkillEntry,
  type SkillMetadata,
} from "./skills";

// Channels management
export {
  sendChannelMessage,
  sendTestMessage,
  testChannel,
  sendTelegramMessage,
  testTelegramChannel,
  sendDiscordMessage,
  testDiscordChannel,
  sendFeishuMessage,
  testFeishuChannel,
  sendWhatsAppMessage,
  testWhatsAppChannel,
  type ChannelType,
  type ChannelConfig,
  type TelegramChannelConfig,
  type DiscordChannelConfig,
  type FeishuChannelConfig,
  type WhatsAppChannelConfig,
  type ChannelsFile,
  type SendMessageOptions,
  type SendMessageResult,
  type TestChannelResult,
} from "./channels";

// Executors
export {
  // Types
  type RepoContext,
  type ExecutionEnv,
  type CommandParts,
  type ExecutorExitResult,
  type SpawnedChild,
  type ProcessRunStatus,
  type ProcessState,
  type ExecutorConfig,
  type ExecutorApprovalService,
  type StandardCodingAgentExecutor,
  // Utilities
  createExecutionEnv,
  applyEnvToSpawnOptions,
  CommandBuilder,
  CommandBuildError,
  createCommandParts,
  which,
  whichSync,
  getConfigDir,
  getDataDir,
  // Factory
  createExecutor,
  EXECUTOR_TYPES,
  isExecutorType,
  getAllExecutorsAvailability,
  // Executors
  ClaudeCode,
  createClaudeCode,
  type ClaudeCodeConfig,
  Amp,
  createAmp,
  type AmpConfig,
  Gemini,
  createGemini,
  type GeminiConfig,
  Codex,
  createCodex,
  type CodexConfig,
  Opencode,
  createOpencode,
  type OpencodeConfig,
  CursorAgent,
  createCursorAgent,
  type CursorAgentConfig,
  QwenCode,
  createQwenCode,
  type QwenCodeConfig,
  Copilot,
  createCopilot,
  type CopilotConfig,
  Droid,
  createDroid,
  type DroidConfig,
} from "./executors";

// Database (file-based)
export {
  // Types
  type TaskStatus,
  type Task,
  type CreateTask,
  type UpdateTask,
  type SessionStatus,
  type Session,
  type CreateSession,
  type UpdateSession,
  type ExecutionProcessStatus,
  type ExecutionProcess,
  type CreateExecutionProcess,
  type UpdateExecutionProcess,
  type MemberType,
  type MemberRole,
  type GroupChat,
  type GroupChatMember,
  type MessageContentType,
  type GroupChatMessage,
  // Models
  TaskModel,
  SessionModel,
  ExecutionProcessModel,
  GroupChatModel,
  GroupChatMemberModel,
  GroupChatMessageModel,
  type CreateGroupChat,
  type UpdateGroupChat,
  type CreateGroupChatMember,
  type UpdateGroupChatMember,
  type CreateGroupChatMessage,
} from "./db";

// Services
export {
  // Event service
  EventService,
  eventService,
  type GatewayEvent,
  type CronJobData,
  type EventListener,
  // Session store service
  SessionStoreService,
  sessionStoreService,
  createSessionConfig,
  createSessionConfigWithWorkspace,
  createSessionConfigWithAgentInfo,
  createUserMessage,
  createAssistantMessage,
  createSystemMessage,
  UIMessageHelpers,
  type SessionConfig,
  type SessionMessage,
  type UIMessage,
  type AgentMessage,
  type SessionStats,
  // Cron service
  CronService,
  type CronJob,
  type CreateCronJob,
  type UpdateCronJob,
  type CronJobType,
  type JobStatus,
  type CronNotificationSettings,
  // Container service
  ContainerService,
  type ProcessState as ContainerProcessState,
  type ProcessRunStatus as ContainerProcessRunStatus,
  // History service
  HistoryService,
  historyService,
  type HistoryEntry,
  // Message bus
  MessageBus,
  type InboundMessage,
  type OutboundMessage,
  type InboundMessageHandler,
} from "./services";

// Group Chat
export {
  // Service
  GroupChatService,
  groupChatService,
  // Types
  type BroadcastMode,
  type GroupChatSettings,
  type GroupChatConfig,
  type MemberConfig,
  type GroupChatSessionStatus,
  type GroupChatSessionConfig,
  type UIMessageType,
  type GroupChatUIMessage,
  type AgentResponse,
  type AgentRolloutMessage,
  type FileInfo,
  type FileUploadMeta,
  type CreateGroupChatRequest,
  type UpdateGroupChatRequest,
  type SendMessageRequest,
  type CreateSessionRequest,
  type UpdateSessionRequest,
  type ListMessagesQuery,
} from "./group-chat";

// Notifications
export {
  sendNotification,
  notifyCronCompletion,
  notifyAgentCompletion,
  notifyChannelMessage,
  notify,
  type NotificationOptions,
} from "./notifications";

// Gateway (optional - requires fastify)
// Note: Gateway is excluded from the main build because it requires optional dependencies.
// To use the gateway, install fastify and @fastify/cors, then:
//   import { createGateway, runGateway } from "@viben/core/gateway";
// Or dynamically import:
//   const gateway = await import("@viben/core/gateway");

/**
 * Initialize all core managers
 * Call this once at application startup
 */
export async function initializeCore(): Promise<void> {
  const { configManager } = await import("./config");
  const { agentManager } = await import("./agents");
  const { mcpManager } = await import("./mcp");
  const { skillsManager } = await import("./skills");

  await configManager.initialize();
  await agentManager.initialize();
  await mcpManager.initialize();
  await skillsManager.initialize();
}
