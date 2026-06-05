// ============================================================
// @viben/plugin-sdk — main entry point
//
// Sub-path imports available:
//   @viben/plugin-sdk/formatting — format utils, icons
//   @viben/plugin-sdk/config     — config utils, doctor engine
//   @viben/plugin-sdk/testing    — test helpers, conformance tests
// ============================================================

// --- Plugin interfaces ---
export type {
  VibenPlugin, PluginContext, PluginPermission, PluginStorage,
  InstallContext, MigrateContext, TerminalIO, SettingsAPI,
} from '@viben/kernel'

// --- Command types ---
export type {
  CommandDef, CommandArgs, CommandResponse, MenuOption, ListItem,
} from '@viben/kernel'

// --- Config field types ---
export type { FieldDef } from '@viben/kernel'

// --- Service interfaces ---
export type {
  SecurityService, FileServiceInterface, NotificationService,
  UsageService, TunnelServiceInterface, ContextService,
} from '@viben/kernel'

// --- Speech types (self-contained, no @viben/kernel dependency) ---
export type {
  TTSProvider, TTSOptions, TTSResult,
  STTProvider, STTOptions, STTResult,
  SpeechServiceInterface,
} from './speech-types.js'

// --- Adapter types ---
export type {
  IChannelAdapter, AdapterCapabilities, OutgoingMessage, PermissionRequest,
  PermissionOption, NotificationMessage, AgentCommand,
  MessagingAdapterConfig, IRenderer, RenderedMessage,
} from '@viben/kernel'

// --- Adapter base classes (runtime) ---
export { MessagingAdapter, StreamAdapter, BaseRenderer } from '@viben/kernel'

// --- Adapter primitives (runtime) ---
export { SendQueue, DraftManager, ToolCallTracker, ActivityTracker } from '@viben/kernel'
export { ToolStateMap, ThoughtBuffer } from '@viben/kernel'
export { DisplaySpecBuilder } from '@viben/kernel'
export { OutputModeResolver } from '@viben/kernel'
export { ToolCardState } from '@viben/kernel'

// --- Core types ---
export type {
  VibenCore, Session, SessionEvents, SessionManager, CommandRegistry,
  Attachment, PlanEntry, StopReason, SessionStatus, ConfigOption,
  UsageRecord, InstallProgress,
  DisplayVerbosity, ToolCallMeta, ToolUpdateMeta, ViewerLinks,
  TelegramPlatformData,
  TurnMeta,
} from '@viben/kernel'

// --- Middleware types ---
export type { MiddlewarePayloadMap, MiddlewareHook } from '@viben/kernel'

// --- New adapter primitive types ---
export type {
  ToolDisplaySpec, ThoughtDisplaySpec, ToolEntry,
  OutputMode, ToolCardSnapshot, ToolCardStateConfig,
} from '@viben/kernel'

// --- Logging (runtime) ---
export { log, createChildLogger } from '@viben/kernel'

// --- Data (runtime) ---
export { PRODUCT_GUIDE } from '@viben/kernel'

// --- Sub-path re-exports (types only — use sub-path imports for values) ---
export type { ConfigFieldDef, DoctorReport, PendingFix } from './config.js'
