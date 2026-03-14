/**
 * Services module
 *
 * Provides core services for the Viben platform:
 * - EventService: Event broadcasting and streaming
 * - SessionStoreService: File-based session persistence
 * - CronService: Scheduled job management
 * - ContainerService: Process spawning and management
 * - HistoryService: Agent history management
 * - MessageBus: Channel message routing
 * - ServiceManager: Background service management (MCP servers, gateway, viben services)
 * - BackgroundTaskManager: Background task management with observer pattern
 * - AgentService: Agent session lifecycle and plan approval management
 * - SandboxService: Isolated code execution with multiple providers
 */

// Event service
export {
  EventService,
  eventService,
  type GatewayEvent,
  type CronJobData,
  type EventListener,
  type McpProcessStatusData,
  type McpServerEventData,
  type McpConfigChangedData,
  // Task state machine event types
  type TaskStateChangedData,
  type TaskRecoveredData,
  type TaskEventAppliedData,
} from "./events";

// Session store service
export {
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
  type LibraryFile,
  type ArtifactType,
} from "./session-store";

// Task service (unified task storage)
export {
  TaskService,
  taskService,
  VALID_TASK_STATUSES,
  isValidTaskStatus,
  type UnifiedTask,
  type TaskStatus,
  type ReviewReason,
  type SubtaskStatus,
  type ExecutionPhase,
  type ExecutionProgress,
  type SubtaskInfo,
  // XState state machine types
  type XStateValue,
  type TaskEvent,
  type TaskEventType,
  // Extended metadata types
  type TaskSource,
  type TaskClassification,
  type AgentConfig,
  type GitConfig,
  type TaskMetadata,
  // Implementation plan types
  type ImplementationPlanSubtask,
  type ImplementationPlanFile,
  // Implementation plan V2 types (extended)
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
} from "./task-service";

// Cron service
export {
  CronService,
  type CronJob,
  type CreateCronJob,
  type UpdateCronJob,
  type CronJobType,
  type JobStatus,
  type CronNotificationSettings,
} from "./cron";

// Container service
export {
  ContainerService,
  type ProcessState,
  type ProcessRunStatus,
} from "./container";

// History service
export {
  HistoryService,
  historyService,
  type HistoryEntry,
} from "./history";

// Message bus
export {
  MessageBus,
  type InboundMessage,
  type OutboundMessage,
  type InboundMessageHandler,
} from "./message-bus";

// Service manager
export {
  ServiceManager,
  serviceManager,
  type ServiceType,
  type ServiceStatus,
  type ServiceInfo,
  type ServiceProcess,
  type StartServiceOptions,
  type WatchLogsOptions,
  type ServiceDefaults,
} from "./service-manager";

// Background tasks
export {
  BackgroundTaskManager,
  backgroundTaskManager,
  type BackgroundTask,
} from "./background-tasks";

// Agent service
export {
  AgentService,
  agentService,
  type AgentPlan,
  type AgentQuestion,
} from "./agent";

// Sandbox service
export {
  SandboxService,
  getSandboxService,
  type ISandboxProvider,
  type SandboxProviderType,
  type SandboxCapabilities,
  type SandboxExecOptions,
  type SandboxExecResult,
  type ScriptOptions,
  type SandboxConfig,
} from "./sandbox";

// GitHub service
export * from "./github";

// MCP Monitor service
export {
  McpMonitorService,
  type McpProcessStatus,
  type McpServerInfo,
  type McpMonitorConfig,
} from "./mcp-monitor";

// Config Watcher service
export {
  ConfigWatcherService,
  getMcpServersConfigPath,
  type ConfigWatcherConfig,
} from "./config-watcher";

// Preview service
export {
  PreviewManager,
  getPreviewManager,
  isNodeAvailable,
  type PreviewConfig,
  type PreviewStatus,
} from "./preview";
