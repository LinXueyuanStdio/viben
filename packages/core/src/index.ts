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
  ServiceError,
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
  // Note: getAgentSkillsDir and getSharedSkillsDir are exported from skill/ops
  getAgentMemoryDir,
  getAgentSessionsDir,
  getSharedMcpDir,
  readYaml,
  writeYaml,
  readJson,
  writeJson,
  ensureDir,
  fileExists,
  // Git-style config management
  GitStyleConfigManager,
  gitConfigManager,
  parseKey,
  getValueByPath,
  setValueByPath,
  deleteValueByPath,
  flattenObject,
  parseValue,
  getWorkspaceConfigPath,
  type ConfigEntry,
  type ConfigOptions,
} from "./config";

// Agent management
export {
  AgentManager,
  agentManager,
  // Memory management
  MemoryManager,
  memoryManager,
  // Types
  type AgentConfigFile,
  type SessionFile,
  type MemoryContent,
  type DailyLogContent,
  type ParsedLogEntry,
  type AppendLogOptions,
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

// Skills management (skill/ops)
export {
  // CRUD operations
  installSkill,
  uninstallSkill,
  listSkills,
  getSkill,
  // Config operations
  enableSkill,
  disableSkill,
  getEnabledSkills,
  // Marketplace operations
  listAvailableSkills,
  searchSkills,
  // Path utilities
  getSkillsBaseDir,
  getSharedSkillsDir,
  getClaudeSkillsDir,
  getAgentSkillsDir,
  getSkillDir,
  resolveTargetDir,
  // Extract utilities
  extractZipToDirectory,
  parseSkillMetadataFromContent,
  getZipRootDirectory,
  // Types
  type InstalledSkillsFile,
  type InstalledSkillEntry,
  type SkillMetadata,
  type SkillTarget,
  type InstallSkillOptions,
  type InstallSkillResult,
  type UninstallSkillOptions,
  type UninstallSkillResult,
  type ListSkillsOptions,
  type ListSkillsResult,
  type GetSkillResult,
  type AvailableSkill,
  type AgentSkillConfig,
  type EnableSkillResult,
  type MarketplaceResult,
  type SkillResult,
  type InstalledSkillInfo,
  type SkillInfo,
} from "./skill/ops";

// Workspace management
export {
  WorkspaceManager,
  workspaceManager,
  initWorkspace,
  initFromTemplate,
  listWorkspaceTemplates,
  getWorkspaceTemplate,
  createWorkspaceTemplate,
  deleteWorkspaceTemplate,
  workspaceExists,
  isInsideWorkspace,
  WORKSPACE_DIR,
  WORKSPACE_CONFIG_FILE,
  AGENTS_DIR,
  DEFAULT_WORKSPACE_CONFIG,
  type Workspace,
  type WorkspaceConfigFile,
  type WorkspaceMcpConfig,
  type WorkspaceSkillsConfig,
  type WorkspaceSettings,
  type KnownWorkspacesFile,
  type KnownWorkspaceEntry,
  type InitWorkspaceOptions,
  type InitWorkspaceResult,
  type WorkspaceTemplate,
  type WorkspaceTemplateConfig,
} from "./workspace";

// Channels management
export {
  // Functions
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
  // Manager
  ChannelManager,
  channelManager,
  getChannelsPath,
  // Constants
  CHANNEL_TYPES,
  // Types
  type ChannelType,
  type ChannelTypeInfo,
  type NotificationMode,
  type ConnectionStatus,
  type ChannelConfig,
  type BaseChannelConfig,
  type TelegramChannelConfig,
  type DiscordChannelConfig,
  type FeishuChannelConfig,
  type WhatsAppChannelConfig,
  type SlackChannelConfig,
  type WebhookChannelConfig,
  type ChannelEntry,
  type ChannelsFile,
  type Channel,
  type ChannelStatus,
  type CreateChannelOptions,
  type UpdateChannelOptions,
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
  // Chat types (non-interactive streaming)
  type ChatFormat,
  type ChatOptions,
  type ChatSpawnResult,
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
  // Chat helpers
  CHAT_SUPPORTED_EXECUTORS,
  executorSupportsChat,
  spawnChat,
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
  // Task state machine event types
  type TaskStateChangedData,
  type TaskRecoveredData,
  type TaskEventAppliedData,
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
  // Task service types (unified task storage)
  TaskService,
  taskService,
  VALID_TASK_STATUSES,
  isValidTaskStatus,
  type UnifiedTask,
  type TaskStatus as UnifiedTaskStatus,
  type ReviewReason,
  type SubtaskStatus,
  type ExecutionPhase,
  type ExecutionProgress,
  type SubtaskInfo,
  type XStateValue,
  type TaskEvent,
  type TaskEventType,
  type TaskSource,
  type TaskClassification,
  type AgentConfig as TaskAgentConfig,
  type GitConfig,
  type TaskMetadata,
  // Implementation plan types
  type ImplementationPlanSubtask,
  type ImplementationPlanFile,
  // Implementation plan V2 types (extended for Task State Machine)
  type ImplementationPlanSubtaskV2,
  type ImplementationPhase,
  type ImplementationProgress,
  type ImplementationPlanFileV2,
  // Task specs types
  type TaskSpecsData,
  type TaskLogs,
  type TaskLogPhase,
  type TaskLogEntry,
  type TaskLogEntryType,
  type TaskLogPhaseStatus,
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
  // Service manager
  ServiceManager,
  serviceManager,
  type ServiceType,
  type ServiceStatus,
  type ServiceInfo,
  type ServiceProcess,
  type StartServiceOptions,
  type WatchLogsOptions,
  type ServiceDefaults,
  // Background tasks
  BackgroundTaskManager,
  backgroundTaskManager,
  type BackgroundTask,
  // Agent service (runtime state and plan approval)
  AgentService,
  agentService,
  type AgentPlan,
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

// Task State Machine
export {
  // Event types
  type TaskEventType as TaskStateMachineEventType,
  VALID_EVENT_TYPES,
  isValidEventType,
  // Task event
  createTaskEvent,
  // Event store
  TaskEventStore,
  taskEventStore,
  type ApplyEventResult,
  // State machine
  taskMachine,
  xstateToTaskStatus,
  xstateToExecutionPhase,
  getStateValue,
  getNextState,
  type XStateValue as TaskXStateValue,
  type TaskMachineContext,
  type TaskMachineEvent,
  // Guards and actions
  guards as taskMachineGuards,
  actions as taskMachineActions,
  // Recovery
  TaskRecoveryService,
  type TaskRecoveryResult,
  type RecoverySummary,
  type RecoveryConfig,
  // Agent event emission (state machine integration)
  AgentEventEmitter,
  agentEventEmitter,
  type AgentEventOptions,
  type AgentEventResult,
} from "./task";

// Notifications
export {
  sendNotification,
  notifyCronCompletion,
  notifyAgentCompletion,
  notifyChannelMessage,
  notify,
  type NotificationOptions,
} from "./notifications";

// Team (viben team init)
export {
  initTeam,
  type InitOptions,
  type InitResult,
  type ProjectType as TeamProjectType,
} from "./team";

// Idea (viben idea)
export {
  // Types
  type Idea,
  type IdeaType,
  type IdeaSession,
  type IdeaStatus,
  type EffortLevel,
  type IdeaTypeSource,
  type IdeaGenerateOptions,
  type IdeaListOptions,
  type IdeaPromoteOptions,
  type IdeaRemoveOptions,
  type IdeaGenerateResult,
  type IdeaListResult,
  type IdeaViewResult,
  type IdeaPromoteResult,
  type IdeaRemoveResult,
  type IdeaListTypesResult,
  // Constants
  BUILTIN_IDEA_TYPES,
  EFFORT_LEVELS,
  IDEA_STATUSES,
  EFFORT_PRIORITY_MAP,
  DEFAULT_MAX_IDEAS,
  // Operations
  generateIdeas,
  listIdeas,
  listTypes as listIdeaTypes,
  viewIdea,
  promoteIdea,
  removeIdeas,
  dismissIdea,
  validateIdeaType,
  validateIdeaTypes,
  // Store utilities
  getIdeasDir,
  getIdeaType,
  getAllIdeas,
  getIdeaById,
} from "./idea";

// Index Generator
export {
  IndexBuilder,
  CodeAnalyzer,
  DocsAnalyzer,
  AIEnhancer,
  AIEnhancerError,
  CodeFormatter,
  DocsFormatter,
  OverviewFormatter,
  type CodeIndex,
  type TechStack,
  type PackageInfo,
  type AppInfo,
  type KeyFile,
  type ExportInfo,
  type DirectoryNode,
  type DocsIndex,
  type DocCategory,
  type DocInfo,
  type EnhanceRequest,
  type EnhanceResult,
  type ImportanceScore,
  type IndexBuilderOptions,
  type GenerateResult,
} from "./index-generator";

// Queue (command queue system)
// Note: Core components (CommandQueue, Promoter, Monitor) are not exported here
// because they extend EventEmitter which causes rollup DTS issues.
// Import directly from the queue module: import { CommandQueue } from "@viben/core/queue"
export {
  // Types
  type QueueItem,
  type RunningItem,
  type CompletedItem,
  type QueueItemStatus,
  type QueueConfig,
  DEFAULT_QUEUE_CONFIG,
  // Operations
  enqueue,
  cancel,
  cancelAllPending,
  retry,
  retryAllFailed,
  status,
  hasCapacity,
  getRunningCount,
  getPendingCount,
  list,
  listPending,
  listRunning,
  listCompleted,
  listFailed,
  inspect,
  exists as queueItemExists,
  getItemStatus,
  logs,
  followLogs,
  getConfig,
  updateConfig as updateQueueConfig,
  setMaxConcurrency,
  clean,
  cleanAllCompleted,
  cleanAllLogs,
  // Result types
  type EnqueueResult,
  type CancelResult,
  type RetryResult,
  type StatusResult,
  type ListResult,
  type InspectResult,
  type LogsResult,
  type ConfigResult,
  type CleanResult,
  // Persistence (for advanced usage)
  getQueueDir,
  ensureDirectories as ensureQueueDirectories,
} from "./queue";

// CLI
export { run, createProgram } from "./cli";

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
  const { serviceManager } = await import("./services");

  await configManager.initialize();
  await agentManager.initialize();
  await mcpManager.initialize();
  await serviceManager.initialize();
}
