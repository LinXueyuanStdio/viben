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
 */

// Event service
export {
  EventService,
  eventService,
  type GatewayEvent,
  type CronJobData,
  type EventListener,
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
} from "./session-store";

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
