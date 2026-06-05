/**
 * Centralized event name constants for all event systems in Viben.
 *
 * Three distinct event systems:
 *  - Hook     — Middleware pipeline hooks (middlewareChain.execute / ctx.registerMiddleware)
 *  - BusEvent — EventBus events (eventBus.emit / eventBus.on), cross-cutting concerns
 *  - SessionEv — Session TypedEmitter events (session.emit / session.on), per-session state
 */

import type { EventBusEvents } from './event-bus.js';
import type { SessionEvents } from './sessions/session.js';

// ---------------------------------------------------------------------------
// Middleware Hooks
// ---------------------------------------------------------------------------

/**
 * Names for all middleware pipeline hooks.
 *
 * Each hook is an intercept point in the request/event pipeline. Middleware
 * registered on a hook can inspect, modify, or block the payload before it
 * proceeds. "Read-only, fire-and-forget" hooks run after the fact and cannot
 * block.
 *
 * Used with `middlewareChain.execute(Hook.X, ...)` and
 * `ctx.registerMiddleware(Hook.X, ...)`.
 */
export const Hook = {
  // --- Message flow ---
  /** Incoming message from any adapter — modifiable, can block. */
  MESSAGE_INCOMING: 'message:incoming',
  /** Outgoing message before it reaches the adapter — modifiable, can block. */
  MESSAGE_OUTGOING: 'message:outgoing',

  // --- Agent / turn lifecycle ---
  /** Before a user prompt is sent to the agent — modifiable, can block. */
  AGENT_BEFORE_PROMPT: 'agent:beforePrompt',
  /** Before an agent event is dispatched — modifiable, can block. */
  AGENT_BEFORE_EVENT: 'agent:beforeEvent',
  /** After an agent event is dispatched — read-only, fire-and-forget. */
  AGENT_AFTER_EVENT: 'agent:afterEvent',
  /** Before the current prompt is cancelled — modifiable, can block. */
  AGENT_BEFORE_CANCEL: 'agent:beforeCancel',
  /** Before the agent is switched — modifiable, can block. */
  AGENT_BEFORE_SWITCH: 'agent:beforeSwitch',
  /** After the agent has been switched — read-only, fire-and-forget. */
  AGENT_AFTER_SWITCH: 'agent:afterSwitch',

  // --- Turn boundaries ---
  /** Turn started — read-only, fire-and-forget. */
  TURN_START: 'turn:start',
  /** Turn ended (always fires, even on error) — read-only, fire-and-forget. */
  TURN_END: 'turn:end',
  /** After a turn completes — full assembled agent text, read-only, fire-and-forget. */
  AGENT_AFTER_TURN: 'agent:afterTurn',

  // --- Session lifecycle ---
  /** Before a new session is created — modifiable, can block. */
  SESSION_BEFORE_CREATE: 'session:beforeCreate',
  /** After a session is destroyed — read-only, fire-and-forget. */
  SESSION_AFTER_DESTROY: 'session:afterDestroy',

  // --- Permissions ---
  /** Before a permission request is shown to the user — modifiable, can block. */
  PERMISSION_BEFORE_REQUEST: 'permission:beforeRequest',
  /** After a permission request is resolved — read-only, fire-and-forget. */
  PERMISSION_AFTER_RESOLVE: 'permission:afterResolve',

  // --- Config ---
  /** Before config options change — modifiable, can block. */
  CONFIG_BEFORE_CHANGE: 'config:beforeChange',

  // --- Filesystem (agent-level) ---
  /** Before a file read operation — modifiable. */
  FS_BEFORE_READ: 'fs:beforeRead',
  /** Before a file write operation — modifiable. */
  FS_BEFORE_WRITE: 'fs:beforeWrite',

  // --- Terminal ---
  /** Before a terminal session is created — modifiable, can block. */
  TERMINAL_BEFORE_CREATE: 'terminal:beforeCreate',
  /** After a terminal session exits — read-only, fire-and-forget. */
  TERMINAL_AFTER_EXIT: 'terminal:afterExit',
} as const;

export type HookName = typeof Hook[keyof typeof Hook];

// ---------------------------------------------------------------------------
// EventBus Events
// ---------------------------------------------------------------------------

/**
 * Names for all EventBus events.
 *
 * EventBus is the global pub/sub bus for cross-cutting concerns — plugins
 * subscribe to these events without needing direct references to sessions
 * or adapters. Type-checked against the EventBusEvents interface.
 *
 * Used with `eventBus.emit(BusEvent.X, ...)` and `eventBus.on(BusEvent.X, ...)`.
 */
export const BusEvent = {
  // --- Session lifecycle ---
  /** Fired when a new session is created and ready. */
  SESSION_CREATED: 'session:created',
  /** Fired when session metadata changes (status, name, overrides). */
  SESSION_UPDATED: 'session:updated',
  /** Fired when a session record is deleted from the store. */
  SESSION_DELETED: 'session:deleted',
  /** Fired when a session ends (agent finished or error). */
  SESSION_ENDED: 'session:ended',
  /** Fired when a session receives its auto-generated name. */
  SESSION_NAMED: 'session:named',
  /** Fired after a new session thread is created and bridge connected. */
  SESSION_THREAD_READY: 'session:threadReady',
  /** Fired when an agent's config options change (adapters update control UIs). */
  SESSION_CONFIG_CHANGED: 'session:configChanged',
  /** Fired during agent switch lifecycle (starting/succeeded/failed). */
  SESSION_AGENT_SWITCH: 'session:agentSwitch',

  // --- Agent ---
  /** Fired for every agent event (text, tool_call, usage, etc.). */
  AGENT_EVENT: 'agent:event',
  /** Fired when a prompt is sent to the agent. */
  AGENT_PROMPT: 'agent:prompt',

  // --- Permissions ---
  /** Fired when the agent requests user permission (blocks until resolved). */
  PERMISSION_REQUEST: 'permission:request',
  /** Fired after a permission request is resolved (approved or denied). */
  PERMISSION_RESOLVED: 'permission:resolved',

  // --- Message visibility ---
  /** Fired when a user message is queued (for cross-adapter input visibility). */
  MESSAGE_QUEUED: 'message:queued',
  /** Fired when a queued message starts processing. */
  MESSAGE_PROCESSING: 'message:processing',
  /** Fired when a queued message is rejected (e.g. blocked by middleware). */
  MESSAGE_FAILED: 'message:failed',

  // --- System lifecycle ---
  /** Fired after kernel (core + plugin infrastructure) has booted. */
  KERNEL_BOOTED: 'kernel:booted',
  /** Fired when the system is fully ready (all adapters connected). */
  SYSTEM_READY: 'system:ready',
  /** Fired during graceful shutdown. */
  SYSTEM_SHUTDOWN: 'system:shutdown',
  /** Fired when all system commands are registered and available. */
  SYSTEM_COMMANDS_READY: 'system:commands-ready',

  // --- Plugin lifecycle ---
  /** Fired when a plugin loads successfully. */
  PLUGIN_LOADED: 'plugin:loaded',
  /** Fired when a plugin fails to load. */
  PLUGIN_FAILED: 'plugin:failed',
  /** Fired when a plugin is disabled (e.g., missing config). */
  PLUGIN_DISABLED: 'plugin:disabled',
  /** Fired when a plugin is unloaded during shutdown. */
  PLUGIN_UNLOADED: 'plugin:unloaded',

  // --- Message visibility ---
  /** Fired when a user message is actually placed in the pending queue behind a running prompt.
   *  Emitted synchronously from inside PromptQueue.enqueue(), so state is accurate — no race condition. */
  PROMPT_WAITING: 'prompt:waiting',

  // --- Usage ---
  /** Fired when a token usage record is captured (consumed by usage plugin). */
  USAGE_RECORDED: 'usage:recorded',

  // --- Identity lifecycle ---
  /** Fired when a new user+identity record is created. */
  IDENTITY_CREATED: 'identity:created',
  /** Fired when user profile fields change. */
  IDENTITY_UPDATED: 'identity:updated',
  /** Fired when two identities are linked (same person). */
  IDENTITY_LINKED: 'identity:linked',
  /** Fired when an identity is unlinked into a new user. */
  IDENTITY_UNLINKED: 'identity:unlinked',
  /** Fired when two user records are merged during a link operation. */
  IDENTITY_USER_MERGED: 'identity:userMerged',
  /** Fired when a user's role changes. */
  IDENTITY_ROLE_CHANGED: 'identity:roleChanged',
  /** Fired when a user is seen (throttled). */
  IDENTITY_SEEN: 'identity:seen',

  // --- Notifications ---
  /** Fired when a user-targeted notification is dispatched (e.g. agent mention). */
  USER_NOTIFICATION: 'user:notification',
} as const satisfies Record<string, keyof EventBusEvents>;

export type BusEventName = typeof BusEvent[keyof typeof BusEvent];

// ---------------------------------------------------------------------------
// Session TypedEmitter Events
// ---------------------------------------------------------------------------

/**
 * Names for all Session TypedEmitter events.
 *
 * These are per-session events emitted by the Session instance itself.
 * SessionBridge subscribes to these to relay agent output to adapters.
 *
 * Used with `session.on(SessionEv.X, ...)` and `session.emit(SessionEv.X, ...)`.
 * Type-checked against the SessionEvents interface.
 */
export const SessionEv = {
  /** Agent produced an event (text, tool_call, etc.) during a turn. */
  AGENT_EVENT: 'agent_event',
  /** Agent is requesting user permission — blocks until resolved. */
  PERMISSION_REQUEST: 'permission_request',
  /** Session ended (agent finished, cancelled, or errored). */
  SESSION_END: 'session_end',
  /** Session status changed (e.g., initializing → active). */
  STATUS_CHANGE: 'status_change',
  /** Session received an auto-generated name from the first response. */
  NAMED: 'named',
  /** An unrecoverable error occurred in the session. */
  ERROR: 'error',
  /** The session's prompt count changed (used for UI counters). */
  PROMPT_COUNT_CHANGED: 'prompt_count_changed',
  /** A new prompt turn started (provides TurnContext for middleware). */
  TURN_STARTED: 'turn_started',
  /** A prompt was placed behind a running prompt — fired synchronously from PromptQueue.enqueue(). */
  PROMPT_QUEUED: 'prompt_queued',
} as const satisfies Record<string, keyof SessionEvents>;

export type SessionEvName = typeof SessionEv[keyof typeof SessionEv];
