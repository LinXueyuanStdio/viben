import type { OutputMode } from "./adapter-primitives/format-types.js";
import type { TurnRouting } from "./sessions/turn-context.js";

export type { TurnRouting };

/**
 * Per-turn context bag threaded through all turn-lifecycle middleware hooks.
 *
 * Core fills in `turnId`; plugins attach arbitrary keys at any hook and read
 * them at subsequent hooks in the same turn. The object is mutable by design —
 * plugins collaborating through meta should use namespaced keys to avoid clashes
 * (e.g., `meta['workspace.sender']` not `meta.sender`).
 */
export interface TurnMeta {
  /** The turn's unique ID — same value passed to session.enqueuePrompt(). */
  turnId: string
  [key: string]: unknown
}

/**
 * A file attachment sent to or received from an agent.
 *
 * Agents receive attachments as content blocks in their prompt input.
 * `originalFilePath` preserves the user's original path before any
 * conversion (e.g., audio transcoding or image resizing).
 */
export interface Attachment {
  type: 'image' | 'audio' | 'file';
  filePath: string;
  fileName: string;
  mimeType: string;
  size: number;
  originalFilePath?: string;
}

/**
 * A message arriving from a channel adapter (Telegram, Slack, SSE, etc.)
 * destined for a session's agent.
 *
 * `routing` controls how the message is dispatched when multiple adapters
 * are attached to the same session (e.g., which adapter should receive the response).
 */
export interface IncomingMessage {
  channelId: string;
  threadId: string;
  userId: string;
  text: string;
  attachments?: Attachment[];
  routing?: TurnRouting;
}

/**
 * A message flowing from the agent back to channel adapters for display.
 *
 * The `type` field determines how the adapter renders the message:
 * - text/thought/plan/error — rendered as formatted text blocks
 * - tool_call/tool_update — rendered as collapsible tool activity
 * - usage — token/cost summary (typically shown in a status bar)
 * - attachment — binary content (image, audio, file)
 * - session_end — signals the agent turn is complete
 * - ACP Phase 2 types (mode_change, config_update, etc.) — interactive controls
 */
export interface OutgoingMessage {
  type:
    | "text"
    | "thought"
    | "tool_call"
    | "tool_update"
    | "plan"
    | "usage"
    | "session_end"
    | "error"
    | "attachment"
    | "system_message"
    // ACP Phase 2 additions
    | "mode_change"
    | "config_update"
    | "model_update"
    | "user_replay"
    | "resource"
    | "resource_link";
  text: string;
  metadata?: Record<string, unknown>;
  attachment?: Attachment;
}

/**
 * A permission request sent by the agent when it needs user approval.
 *
 * The agent blocks until the user picks one of the `options`.
 * PermissionGate holds the request, emits it to adapters via SessionEv,
 * and resumes the agent with the chosen option when resolved.
 */
export interface PermissionRequest {
  id: string;
  description: string;
  options: PermissionOption[];
}

/** A single choice within a permission request (e.g., "Allow once", "Deny"). */
export interface PermissionOption {
  id: string;
  label: string;
  /** Whether this option grants the requested permission. */
  isAllow: boolean;
}

/**
 * A notification pushed to the user outside of the normal message flow.
 *
 * Used for background alerts when the user isn't actively watching the session
 * (e.g., agent completed, permission needed, budget warning).
 */
export interface NotificationMessage {
  sessionId: string;
  sessionName?: string;
  type: "completed" | "error" | "permission" | "input_required" | "budget_warning";
  summary: string;
  /** URL to jump directly to the session in the adapter UI. */
  deepLink?: string;
}

/** A command exposed by the agent, surfaced as interactive buttons in the chat UI. */
export interface AgentCommand {
  name: string;
  description: string;
  input?: unknown;
}

/**
 * Union of all events that an AgentInstance can emit during a prompt turn.
 *
 * Each variant maps to an ACP protocol event. AgentInstance translates raw
 * ACP SDK events into these normalized types, which then flow through
 * middleware (Hook.AGENT_BEFORE_EVENT) and into SessionBridge for rendering.
 */
export type AgentEvent =
  /** Streamed text content from the agent's response. */
  | { type: "text"; content: string }
  /** Agent's internal reasoning (displayed in a collapsible block). */
  | { type: "thought"; content: string }
  /** Agent started or completed a tool invocation. */
  | {
      type: "tool_call";
      id: string;
      name: string;
      kind?: string;
      status: string;
      content?: unknown;
      locations?: unknown;
      rawInput?: unknown;
      rawOutput?: unknown;
      meta?: unknown;
    }
  /** Progress update for an in-flight tool call (partial output, status change). */
  | {
      type: "tool_update";
      id: string;
      name?: string;
      kind?: string;
      status: string;
      content?: unknown;
      locations?: unknown;
      rawInput?: unknown;
      rawOutput?: unknown;
      meta?: unknown;
    }
  /** Agent's execution plan with prioritized steps. */
  | { type: "plan"; entries: PlanEntry[] }
  /** Token usage and cost report for the current turn. */
  | {
      type: "usage";
      tokensUsed?: number;
      contextSize?: number;
      cost?: { amount: number; currency: string };
    }
  /** Agent updated its available slash commands. */
  | { type: "commands_update"; commands: AgentCommand[] }
  /** Agent produced an image as output (base64-encoded). */
  | { type: "image_content"; data: string; mimeType: string }
  /** Agent produced audio as output (base64-encoded). */
  | { type: "audio_content"; data: string; mimeType: string }
  /** Agent ended the session (no more prompts accepted). */
  | { type: "session_end"; reason: string }
  /** Agent-level error (non-fatal — session may continue). */
  | { type: "error"; message: string }
  /** System message injected by Viben (not from the agent itself). */
  | { type: "system_message"; message: string }
  // ACP Phase 2 additions
  /** Agent updated session metadata (title, timestamps). */
  | { type: "session_info_update"; title?: string; updatedAt?: string; _meta?: Record<string, unknown> }
  /** Agent updated its config options (modes, models, toggles). */
  | { type: "config_option_update"; options: ConfigOption[] }
  /** Echoed user message chunk — used for cross-adapter input visibility. */
  | { type: "user_message_chunk"; content: string }
  /** Agent returned a resource's content (file, data). */
  | { type: "resource_content"; uri: string; name: string; text?: string; blob?: string; mimeType?: string }
  /** Agent returned a link to a resource (without inline content). */
  | { type: "resource_link"; uri: string; name: string; mimeType?: string; title?: string; description?: string; size?: number }
  /** Signals that TTS output should be stripped from the response. */
  | { type: "tts_strip" };

/** A single step in an agent's execution plan. */
export interface PlanEntry {
  content: string;
  status: "pending" | "in_progress" | "completed";
  priority: "high" | "medium" | "low";
}

/**
 * Static definition of an agent — the command, args, and environment
 * needed to spawn its subprocess.
 */
export interface AgentDefinition {
  name: string;
  command: string;
  args: string[];
  workingDirectory?: string;
  env?: Record<string, string>;
  /** Override the default init timeout (ms) for this agent's ACP handshake. */
  initTimeoutMs?: number;
}

// --- Agent Registry Types ---

/** How the agent is distributed and installed. */
export type AgentDistribution = "npx" | "uvx" | "binary" | "custom";

/** An agent that has been installed locally and is ready to spawn. */
export interface InstalledAgent {
  registryId: string | null;
  name: string;
  version: string;
  distribution: AgentDistribution;
  command: string;
  args: string[];
  env: Record<string, string>;
  workingDirectory?: string;
  installedAt: string;
  /** Absolute path to the binary on disk (only for "binary" distribution). */
  binaryPath: string | null;
  /** Override the default init timeout (ms) for this agent's ACP handshake. */
  initTimeoutMs?: number;
}

/** Platform-specific binary download target from the agent registry. */
export interface RegistryBinaryTarget {
  archive: string;
  cmd: string;
  args?: string[];
  env?: Record<string, string>;
}

/** Distribution methods available for a registry agent. */
export interface RegistryDistribution {
  npx?: { package: string; args?: string[]; env?: Record<string, string> };
  uvx?: { package: string; args?: string[]; env?: Record<string, string> };
  /** Platform → arch → binary target mapping. */
  binary?: Record<string, RegistryBinaryTarget>;
}

/** An agent entry from the remote agent registry. */
export interface RegistryAgent {
  id: string;
  name: string;
  version: string;
  description: string;
  repository?: string;
  website?: string;
  authors?: string[];
  license?: string;
  icon?: string;
  distribution: RegistryDistribution;
}

/** Merged view of a registry agent with local install status. */
export interface AgentListItem {
  key: string;
  registryId: string;
  name: string;
  version: string;
  description?: string;
  distribution: AgentDistribution;
  installed: boolean;
  available: boolean;
  /** Runtime dependencies that are missing on this machine. */
  missingDeps?: string[];
}

/** Result of checking whether an agent can run on this machine. */
export interface AvailabilityResult {
  available: boolean;
  reason?: string;
  missing?: Array<{ label: string; installHint: string }>;
}

/** Callbacks for reporting agent installation progress to the UI. */
export interface InstallProgress {
  onStart(agentId: string, agentName: string): void | Promise<void>;
  onStep(step: string): void | Promise<void>;
  onDownloadProgress(percent: number): void | Promise<void>;
  onSuccess(agentName: string): void | Promise<void>;
  onError(error: string, hint?: string): void | Promise<void>;
}

/** Result of an agent install operation. */
export interface InstallResult {
  ok: boolean;
  agentKey: string;
  error?: string;
  hint?: string;
  setupSteps?: string[];
}

/**
 * Session lifecycle status.
 *
 * Valid transitions:
 *   initializing → active | error
 *   active       → error | finished | cancelled
 *   error        → active | cancelled  (recovery or user cancels)
 *   cancelled    → active              (user resumes)
 *   finished     → (terminal — no transitions)
 */
export type SessionStatus =
  | "initializing"
  | "active"
  | "cancelled"
  | "finished"
  | "error";

/** Record of an agent switch within a session (for history tracking). */
export interface AgentSwitchEntry {
  agentName: string;
  agentSessionId: string;
  switchedAt: string;
  promptCount: number;
}

/**
 * Persisted session state — serialized to the session store (JSON file).
 *
 * Generic parameter `P` is the primary adapter's platform-specific data
 * (e.g., TelegramPlatformData). Additional adapters store data in `platforms`.
 */
export interface SessionRecord<P = Record<string, unknown>> {
  sessionId: string;
  agentSessionId: string;
  originalAgentSessionId?: string;
  agentName: string;
  workingDir: string;
  channelId: string;
  status: SessionStatus;
  createdAt: string;
  lastActiveAt: string;
  name?: string;
  isAssistant?: boolean;
  dangerousMode?: boolean;
  clientOverrides?: { bypassPermissions?: boolean };
  outputMode?: OutputMode;
  platform: P;
  /** Per-adapter platform data. Key = adapterId, value = adapter-specific data. */
  platforms?: Record<string, Record<string, unknown>>;
  /** Adapters currently attached to this session. Defaults to [channelId] for old records. */
  attachedAdapters?: string[];
  firstAgent?: string;
  currentPromptCount?: number;
  agentSwitchHistory?: AgentSwitchEntry[];
  /** userId of the user who created this session (from identity system). */
  createdBy?: string;
  /** userId[] of all users who have sent messages in this session. */
  participants?: string[];
  // ACP state (cached — overridden by agent response on resume)
  acpState?: {
    // Primary fields (used on load)
    configOptions?: ConfigOption[];
    agentCapabilities?: AgentCapabilities;
    // Legacy fields (kept for backward compat, ignored on load)
    currentMode?: string;
    availableModes?: SessionMode[];
    currentModel?: string;
    availableModels?: ModelInfo[];
  };
}

/** Telegram-specific data stored per session in the session record. */
export interface TelegramPlatformData {
  topicId: number;
  skillMsgId?: number;
  controlMsgId?: number;
}

/** A single token usage data point for cost tracking. */
export interface UsageRecord {
  id: string;
  sessionId: string;
  agentName: string;
  tokensUsed: number;
  contextSize: number;
  cost?: { amount: number; currency: string };
  timestamp: string;
}

/** Usage event emitted on the EventBus for the usage-tracking plugin. */
export interface UsageRecordEvent {
  sessionId: string;
  agentName: string;
  timestamp: string;
  tokensUsed: number;
  contextSize: number;
  cost?: { amount: number; currency: string };
}


// --- ACP Protocol Types (Phase 2) ---

/** An agent operating mode (e.g., "code", "architect", "ask"). */
export interface SessionMode {
  id: string;
  name: string;
  description?: string;
}

/** Current mode and all available modes for a session. */
export interface SessionModeState {
  currentModeId: string;
  availableModes: SessionMode[];
}

/** A single choice within a select-type config option. */
export interface ConfigSelectChoice {
  value: string;
  name: string;
  description?: string;
}

/** A named group of select choices (for categorized dropdowns). */
export interface ConfigSelectGroup {
  group: string;
  name: string;
  options: ConfigSelectChoice[];
}

/**
 * Agent-exposed configuration options surfaced as interactive controls in chat.
 *
 * These are settings the agent advertises via the ACP config_option_update event.
 * Adapters render them as select menus, toggles, etc. in the chat UI.
 * When the user changes a value, Viben sends a setConfigOption request to the agent.
 */
export type ConfigOption =
  | {
      id: string;
      name: string;
      description?: string;
      category?: string;
      type: "select";
      currentValue: string;
      options: (ConfigSelectChoice | ConfigSelectGroup)[];
      _meta?: Record<string, unknown>;
    }
  | {
      id: string;
      name: string;
      description?: string;
      category?: string;
      type: "boolean";
      currentValue: boolean;
      _meta?: Record<string, unknown>;
    };

/** Value payload for updating a config option on the agent. */
export type SetConfigOptionValue =
  | { type: "select"; value: string }
  | { type: "boolean"; value: boolean };

// Model Selection

/** An AI model available for the agent to use. */
export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

/** Current model and all available models for a session. */
export interface SessionModelState {
  currentModelId: string;
  availableModels: ModelInfo[];
}

/**
 * Capabilities advertised by the agent in its initialize response.
 *
 * These determine which ACP features the agent supports — Viben uses
 * them to enable/disable UI features (e.g., session list, fork, MCP).
 */
export interface AgentCapabilities {
  name: string;
  title?: string;
  version?: string;
  /** Whether the agent supports loading (resuming) existing sessions. */
  loadSession?: boolean;
  promptCapabilities?: {
    image?: boolean;
    audio?: boolean;
    embeddedContext?: boolean;
  };
  sessionCapabilities?: {
    list?: boolean;
    fork?: boolean;
    close?: boolean;
  };
  mcp?: { http?: boolean; sse?: boolean };
  authMethods?: AuthMethod[];
}

/** Response from the agent when creating a new session. */
export interface NewSessionResponse {
  sessionId: string;
  modes?: SessionModeState;
  configOptions?: ConfigOption[];
  models?: SessionModelState;
}

// Auth

/** Authentication method supported by the agent. */
export type AuthMethod =
  | { type: "agent" }
  | { type: "env_var"; name: string; description?: string }
  | { type: "terminal" };

/** Request to authenticate with a specific method. */
export interface AuthenticateRequest {
  methodId: string;
}

// Prompt Response

/**
 * Reason why the agent stopped generating.
 *
 * - end_turn: agent completed its response normally
 * - max_tokens / max_turn_requests: hit a limit
 * - refusal: agent declined the request
 * - cancelled / interrupted: user or system stopped the prompt
 * - error: agent encountered an error
 */
export type StopReason =
  | "end_turn"
  | "max_tokens"
  | "max_turn_requests"
  | "refusal"
  | "cancelled"
  | "error"
  | "interrupted";

/** Final response from the agent after a prompt completes. */
export interface PromptResponse {
  stopReason: StopReason;
  _meta?: Record<string, unknown>;
}

// Content Blocks (for prompt input)

/** A content block within a prompt message sent to the agent. */
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string; uri?: string }
  | { type: "audio"; data: string; mimeType: string }
  | { type: "resource"; resource: { uri: string; text?: string; blob?: string; mimeType?: string } }
  | { type: "resource_link"; uri: string; name: string; mimeType?: string; title?: string; description?: string; size?: number };

// Session List

/** A session entry returned by the agent's session list endpoint. */
export interface SessionListItem {
  sessionId: string;
  title?: string;
  createdAt: string;
  updatedAt?: string;
  _meta?: Record<string, unknown>;
}

/** Paginated response from the agent's session list endpoint. */
export interface SessionListResponse {
  sessions: SessionListItem[];
  nextCursor?: string;
}

// MCP Server Config

/** Configuration for connecting to an MCP (Model Context Protocol) server. */
export type McpServerConfig =
  | { type?: "stdio"; name: string; command: string; args?: string[]; env?: Record<string, string> }
  | { type: "http"; name: string; url: string; headers?: Record<string, string> }
  | { type: "sse"; name: string; url: string; headers?: Record<string, string> };
