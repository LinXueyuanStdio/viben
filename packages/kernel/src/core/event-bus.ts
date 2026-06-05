import { TypedEmitter } from "./utils/typed-emitter.js";
import type { AgentEvent, PermissionRequest, SessionStatus, UsageRecordEvent } from "./types.js";
import type { TurnSender } from "./sessions/turn-context.js";

/**
 * Event map for the global EventBus.
 *
 * Defines all cross-cutting events that flow between core, plugins, and adapters.
 * Plugins subscribe via `eventBus.on(...)` without needing direct references
 * to the components that emit these events.
 */
export interface EventBusEvents {
  "session:created": (data: {
    sessionId: string;
    name?: string;
    agent: string;
    status: SessionStatus;
    userId?: string;
  }) => void;
  "session:updated": (data: {
    sessionId: string;
    status?: SessionStatus;
    name?: string;
    clientOverrides?: { bypassPermissions?: boolean };
  }) => void;
  "session:deleted": (data: { sessionId: string }) => void;
  "agent:event": (data: { sessionId: string; turnId: string; event: AgentEvent }) => void;
  "permission:request": (data: {
    sessionId: string;
    permission: PermissionRequest;
  }) => void;
  "permission:resolved": (data: {
    sessionId: string;
    requestId: string;
    decision: string;
    optionId?: string;
    resolvedBy?: string;
  }) => void;

  // System lifecycle
  "kernel:booted": () => void;
  "system:ready": () => void;
  "system:shutdown": () => void;
  "system:commands-ready": (data: {
    commands: Array<{ name: string; description: string; category?: string; usage?: string }>;
  }) => void;

  // Plugin lifecycle
  "plugin:loaded": (data: { name: string; version: string }) => void;
  "plugin:failed": (data: { name: string; error: string }) => void;
  "plugin:disabled": (data: { name: string; reason: string }) => void;
  "plugin:unloaded": (data: { name: string }) => void;

  // Session (additional)
  "session:ended": (data: { sessionId: string; reason: string }) => void;
  "session:named": (data: { sessionId: string; name: string }) => void;

  // Agent (additional)
  "agent:prompt": (data: {
    sessionId: string;
    text: string;
    attachments?: unknown[];
  }) => void;

  // Usage tracking (consumed by usage plugin)
  "usage:recorded": (data: UsageRecordEvent) => void;

  // Emitted after a new session thread is created and bridge connected
  "session:threadReady": (data: { sessionId: string; channelId: string; threadId: string }) => void;

  // Config changed (used by adapters to update control messages)
  "session:configChanged": (data: { sessionId: string }) => void;

  // Cross-adapter input visibility (SSE clients see messages from other adapters)
  "message:queued": (data: {
    sessionId: string;
    turnId: string;
    text: string;
    sourceAdapterId: string;
    attachments?: unknown[];
    timestamp: string;
    queueDepth: number;
    sender?: TurnSender | null;
  }) => void;
  "message:processing": (data: {
    sessionId: string;
    turnId: string;
    sourceAdapterId: string;
    userPrompt: string;
    finalPrompt: string;
    attachments?: unknown[];
    sender?: TurnSender | null;
    timestamp: string;
  }) => void;

  /** Fired when a queued message is rejected before processing (e.g. blocked by middleware). */
  "message:failed": (data: {
    sessionId: string;
    turnId: string;
    reason: string;
  }) => void;

  /**
   * Fired when a user message is actually placed in the pending queue behind a running prompt.
   *
   * Unlike MESSAGE_QUEUED (which fires before enqueuePrompt is called and can race), this event
   * fires synchronously from inside PromptQueue.enqueue() so queueDepth and sourceAdapterId are
   * always accurate.
   */
  "prompt:waiting": (data: {
    sessionId: string;
    turnId: string;
    sourceAdapterId: string;
    queueDepth: number;
  }) => void;

  // Agent switch lifecycle (used by UI & dashboards)
  "session:agentSwitch": (data: {
    sessionId: string;
    fromAgent: string;
    toAgent: string;
    status: "starting" | "succeeded" | "failed";
    resumed?: boolean;
    error?: string;
  }) => void;

  // Identity lifecycle (emitted by @viben/identity built-in plugin)
  "identity:created": (data: { userId: string; identityId: string; source: string; displayName: string }) => void;
  "identity:updated": (data: { userId: string; changes: string[] }) => void;
  "identity:linked": (data: { userId: string; identityId: string; linkedFrom?: string }) => void;
  "identity:unlinked": (data: { userId: string; identityId: string; newUserId: string }) => void;
  "identity:userMerged": (data: { keptUserId: string; mergedUserId: string; movedIdentities: string[] }) => void;
  "identity:roleChanged": (data: { userId: string; oldRole: string; newRole: string; changedBy?: string }) => void;
  "identity:seen": (data: { userId: string; identityId: string; sessionId: string }) => void;

  // User-targeted notifications (delivered to app via SSE)
  "user:notification": (data: { userId: string; text: string; sessionId?: string }) => void;
}

/**
 * Global event bus for cross-cutting communication.
 *
 * Decouples plugins from direct session/core references — plugins and adapters
 * subscribe to bus events without knowing which component emits them. The core
 * and sessions emit events here; plugins consume them for features like usage
 * tracking, notifications, and UI updates.
 */
export class EventBus extends TypedEmitter<EventBusEvents> {}
