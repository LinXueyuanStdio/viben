# Core Push Notification System — Design Spec

**Date:** 2026-04-12
**Status:** Draft
**Depends on:** [Core Identity System](2026-04-12-core-identity-system-design.md)

---

## Overview

Viben currently has a basic `NotificationManager` that broadcasts system-level notifications (session end, errors) to adapters. There is no way for plugins to send targeted notifications to specific users, across platforms, with delivery options like DM, thread reply, or topic.

This spec introduces a core `NotificationService` and the `ctx.notify()` API that enables any plugin to send user-targeted, cross-platform notifications. It also extends the SSE infrastructure to support user-level connections (not session-bound) for App notification delivery.

---

## Goals

- Any plugin can notify any user with a single API call: `ctx.notify(target, message, options)`
- Notifications resolve through the identity system — one call delivers across all linked platforms
- Adapters control their own delivery mechanisms (DM, thread, topic, SSE push)
- Fire-and-forget semantics — notifications are best-effort, never block the caller
- SSE supports user-level connections for notifications without an active session

**Non-goals (v1):**
- Delivery confirmation or read receipts
- Notification preferences per user (mute, schedule, filter)
- Notification history / inbox
- Rich notifications (buttons, cards, images) — text only for v1

---

## Part 1 — Notification API

### 1.1 Plugin-facing API

```typescript
// On PluginContext — requires 'notifications:send' permission
ctx.notify(
  target: NotificationTarget,
  message: NotificationMessage,
  options?: NotificationOptions
): void
// Fire-and-forget. Does not throw. Does not return result.
```

### 1.2 Types

```typescript
type NotificationTarget =
  | { identityId: IdentityId }                // Resolve via identity system → user → all identities
  | { userId: string }                         // Direct user lookup → all identities
  | { channelId: string; platformId: string }  // Bypass identity system, direct adapter call

interface NotificationMessage {
  type: 'text'
  text: string
}

interface NotificationOptions {
  via?: 'dm' | 'thread' | 'topic'    // Delivery hint — adapter decides if supported
  topicId?: string                    // For 'topic' delivery (e.g. Telegram forum topic)
  sessionId?: string                  // For 'thread' delivery (which session thread to reply in)
  onlyPlatforms?: string[]           // Only deliver to these platforms (e.g. ['telegram'])
  excludePlatforms?: string[]        // Skip these platforms (e.g. ['sse'])
}
```

### 1.3 Permission

New permission: `notifications:send`

Plugin declares in `permissions[]`:
```typescript
permissions: ['identity:read', 'notifications:send']
```

### 1.4 Usage examples

```typescript
// Workspace plugin: mention notification
ctx.notify(
  { identityId: 'telegram:123456789' },
  { type: 'text', text: '@lucas mentioned you in a task' },
  { via: 'dm' }
)

// Billing plugin: budget alert
ctx.notify(
  { userId: user.userId },
  { type: 'text', text: 'Budget 90% used' }
)

// Scheduler plugin: reminder
ctx.notify(
  { userId: reminder.ownerUserId },
  { type: 'text', text: `Reminder: ${reminder.text}` },
  { via: 'dm' }
)

// Direct adapter call (bypass identity resolution)
ctx.notify(
  { channelId: 'telegram', platformId: '123456789' },
  { type: 'text', text: 'Direct message' },
  { via: 'dm' }
)
```

---

## Part 2 — Target Resolution Flow

```
ctx.notify(target, message, options)
  ↓
NotificationService.notify()
  ↓
  Resolve target:
  ├─ { identityId } → identityService.getIdentity(id) → identity.userId
  │                  → identityService.getUser(userId) → user
  │                  → identityService.getIdentitiesFor(userId) → all identities
  │
  ├─ { userId } → identityService.getUser(userId) → user
  │             → identityService.getIdentitiesFor(userId) → all identities
  │
  └─ { channelId, platformId } → skip resolution, single adapter call
  ↓
  Apply platform filters:
    if (options.onlyPlatforms) → keep only matching identities
    if (options.excludePlatforms) → remove matching identities
  ↓
  For each identity:
    adapter = adapters.get(identity.source)
    ↓
    ├─ adapter not found → log.warn, skip
    ├─ adapter.sendUserNotification not implemented → log.warn, skip
    └─ adapter.sendUserNotification(identity.platformId, message, {
          via: options.via,
          topicId: options.topicId,
          sessionId: options.sessionId,
          platformMention: {
            platformUsername: identity.platformUsername,
            platformId: identity.platformId,
          }
        })
        ├─ success → continue
        └─ error → log.warn('notification delivery failed', { identityId, error }), continue
  ↓
  Done (fire-and-forget)
```

---

## Part 3 — Adapter Interface Extension

### 3.1 New optional method on IChannelAdapter

The existing `sendNotification()` is a required method for system-level broadcast notifications (session completed, errors). The new `sendUserNotification()` is a separate optional method for user-targeted delivery with platform-specific options. These serve different purposes:
- `sendNotification(notification)` — broadcast to a channel/adapter (existing, unchanged)
- `sendUserNotification(platformId, message, options)` — deliver to a specific user (new, optional)

There is precedent for optional methods on IChannelAdapter: `deleteSessionThread?()`, `archiveSessionTopic?()`, `stripTTSBlock?()`, `sendSkillCommands?()`, `cleanupSessionState?()`.

```typescript
interface IChannelAdapter {
  // === Existing methods (unchanged) ===
  readonly name: string
  readonly capabilities: AdapterCapabilities
  sendMessage(sessionId: string, content: OutgoingMessage): Promise<void>
  sendNotification(notification: NotificationMessage): Promise<void>  // required, broadcast
  sendPermissionRequest(sessionId: string, request: PermissionRequest): Promise<void>
  // ... other existing optional methods

  // === NEW: user-targeted notification (optional) ===
  sendUserNotification?(
    platformId: string,
    message: NotificationMessage,
    options?: AdapterNotificationOptions
  ): Promise<void>
}

interface AdapterNotificationOptions {
  via?: 'dm' | 'thread' | 'topic'
  topicId?: string
  sessionId?: string
  platformMention?: {
    platformUsername?: string
    platformId: string
  }
}
```

### 3.2 Adapter support matrix

| Adapter | dm | thread | topic | Notes |
|---|---|---|---|---|
| Telegram | Yes | Yes | Yes | DM requires user has `/start`ed the bot first |
| Discord | Yes | Yes | No | DM via Discord DM channel API |
| Slack | Yes | Yes | No | DM via Slack conversations.open + chat.postMessage |
| SSE | No | No | No | Pushes typed event via user-level SSE stream |

### 3.3 Adapter implementations

**Telegram:**
```typescript
async sendUserNotification(platformId, message, options) {
  switch (options?.via) {
    case 'dm':
      // bot.api.sendMessage(platformId, message.text)
      // May throw 403 if user hasn't /started bot
      break
    case 'thread':
      // Requires sessionId → look up threadId → reply in thread
      break
    case 'topic':
      // Requires topicId → send to forum topic
      break
    default:
      // Default to DM
      break
  }
}
```

**SSE Adapter:**
```typescript
async sendUserNotification(platformId, message, options) {
  // platformId = userId (from identity 'api:{userId}')
  this.connectionManager.pushToUser(platformId, {
    type: 'notification',
    data: { message, ...options }
  })
}
```

---

## Part 4 — SSE User-level Connection

### 4.1 Current state — two SSE systems

Viben has two separate SSE systems that serve different purposes:

1. **SSEManager** (`api-server/sse-manager.ts`): Broadcasts EventBus events (session created, agent events, etc.) to dashboard clients. Endpoint: `GET /api/v1/events`. Max 50 connections. Filters by `?sessionId` query param. Uses raw `http.ServerResponse` set.

2. **SSE Adapter** (`sse-adapter/`): Implements `IChannelAdapter` for App session interaction. Endpoint: `GET /api/v1/sse/sessions/:sessionId/stream`. Uses `ConnectionManager` with per-session tracking, EventBuffer for replay, per-session limit 10 + global limit 100. Tracks `tokenId` per connection.

These are separate connection pools and do not share limits.

### 4.2 New: user-level SSE endpoint

The user-level endpoint is added to the **SSE Adapter's ConnectionManager** (not SSEManager), because:
- ConnectionManager already tracks `tokenId` per connection — can be extended to track `userId`
- EventBuffer provides replay on reconnect (important for notifications)
- SSE Adapter already implements `IChannelAdapter`, so `sendUserNotification()` can push directly

```
GET /api/v1/sse/events
Authorization: Bearer <token>
  → token.sub → tokenStore.get(tokenId).userId
  → userId required (must have completed /identity/setup)
  → Register user-level connection on ConnectionManager
  → Stream: notifications + system events for this user
```

### 4.3 ConnectionManager extension

```typescript
// Current indexes
connections: Map<connectionId, SSEConnection>     // all connections
sessionIndex: Map<sessionId, Set<connectionId>>   // session → connections

// New index
userIndex: Map<userId, Set<connectionId>>          // user → connections (session + user-level)

// New methods
addUserConnection(userId: string, tokenId: string, res: Response): string  // returns connectionId
pushToUser(userId: string, event: SSEEvent): void                          // push to all user connections
disconnectByUser(userId: string): void
```

Push logic:
- Notification for user `u_abc`: `userIndex.get('u_abc')` → push to all connections (both session-level and user-level)
- Session event for session `sess_xyz`: `sessionIndex.get('sess_xyz')` → push as before (unchanged)

### 4.4 Connection limit clarification

User-level connections count against the SSE Adapter's **global limit of 100 connections** (shared with session-level connections). They do NOT count against SSEManager's separate 50-connection pool.

Limits:
- Per-session connections: max 10 (unchanged)
- Total SSE Adapter connections (session + user-level): max 100
- SSEManager connections (EventBus broadcast): max 50 (separate pool, unchanged)

### 4.5 Typed SSE events

Events on the user-level stream use type prefixes for client filtering:

```typescript
// Notification events
{ event: 'notification:text',       data: { text, from?, sessionId? } }
{ event: 'notification:mention',    data: { sessionId, mentionedBy, text } }
{ event: 'notification:task',       data: { sessionId, taskId, title, assignee } }

// System events (forwarded from EventBus)
{ event: 'session:created',         data: { sessionId, agentName } }
{ event: 'session:ended',           data: { sessionId } }

// Health
{ event: 'heartbeat',              data: { ts } }  // every 15s
```

Client filters by event type prefix: `notification:*` for notifications, `session:*` for lifecycle.

### 4.6 Auth requirements

- User without `userId` on token (not yet set up via `/identity/setup`) → 401 on `/sse/events`
- Heartbeat every 30s to keep connections alive (matches existing SSE Adapter heartbeat interval)

---

## Part 5 — NotificationService Architecture

### 5.1 Placement in core

NotificationService replaces the existing `NotificationManager` as a core construct (not a plugin).

```
NotificationService (core)
  ├── Depends on: IdentityService (consumed via serviceRegistry.get('identity'))
  ├── Depends on: Adapter registry (core.adapters Map — public on CoreAccess)
  ├── Registered as service: 'notifications'
  └── Plugin access: ctx.notify() on PluginContext (like ctx.sendMessage())
```

### 5.2 ctx.notify() on PluginContext

`ctx.notify()` follows the same delegation pattern as `ctx.sendMessage()`:

```typescript
// In plugin-context.ts:
async notify(target: NotificationTarget, message: NotificationMessage, options?: NotificationOptions): Promise<void> {
  requirePermission(permissions, 'notifications:send', 'notify()')
  const service = serviceRegistry.get<NotificationService>('notifications')
  if (service) await service.notify(target, message, options)
}
```

This is consistent with how `ctx.sendMessage()` works: check permission, get service from registry, delegate. The `notifications:send` permission is a new addition to `PluginPermission` union type — justified because sending notifications has explicit side-effects (messages delivered to users), distinct from generic service consumption.

### 5.3 Why core service, not plugin?

- Replaces existing `NotificationManager` which is already a core construct in `session-bridge.ts`
- Needs adapter registry access — `NotificationManager` constructor already takes `core.adapters` Map
- Every plugin may need notifications — core capability, not optional feature
- Identity service is a plugin dependency, consumed via `serviceRegistry.get('identity')`

### 5.4 Graceful degradation

If identity plugin is not installed:
- `{ identityId }` and `{ userId }` targets → log warning, skip (cannot resolve)
- `{ channelId, platformId }` target → works (direct adapter call, no identity needed)

### 5.5 Migration from NotificationManager

Current `NotificationManager`:
- `notify(channelId, notification)` — adapter-targeted broadcast
- `notifyAll(notification)` — all-adapter broadcast
- Used internally for session completion and error notifications

Migration:
- `NotificationManager` deprecated, replaced by `NotificationService`
- Internal session completion/error notifications refactored to use new service
- `notifyAll()` becomes iterating all adapters with `sendNotification()` (existing method, not `sendUserNotification`)

---

## Part 6 — Mention Rewriting in message:outgoing

### 6.1 Agent writes canonical mentions

Agent always uses canonical usernames: `@lucas`, not platform-specific mentions.

### 6.2 Adapter-owned middleware rewrites to platform-native

Each adapter registers `message:outgoing` middleware in `setup()`. The `message:outgoing` payload contains `{ sessionId, message: OutgoingMessage }` where `message.text` can be reassigned (object property mutation — same pattern used by `agent:beforePrompt` middleware). No adapters currently register on this hook, so there is no priority conflict:

```
Agent output: "@lucas I've updated the code"
  ↓
message:outgoing middleware (registered by adapter):
  → Parse @mentions: find /@(\w+)/g in text
  → For each match:
      → identityService.resolveCanonicalMention('lucas', adapterSource)
      → { found: true, platformId: '456789', platformUsername: 'lucasdev' }
      → Rewrite based on adapter format:
          Telegram: "@lucas_tg"
          Discord:  "<@456789>"
          Slack:    "<@UXXXXXX>"
          SSE:      "@lucas" (keep canonical, App renders)
```

### 6.3 Identity service helper

```typescript
identityService.resolveCanonicalMention(username: string, source: string): Promise<{
  found: boolean
  platformId?: string
  platformUsername?: string
} | undefined>
```

This looks up the canonical username → UserRecord → finds the IdentityRecord matching the given source → returns platform-specific info for the adapter to format.

---

## Error Handling

- Identity resolution failure (user not found): log warning, skip delivery — do not throw
- Adapter not found for source: log warning, skip — platform may have been removed
- `sendUserNotification` not implemented on adapter: log warning, skip
- Adapter delivery failure (network, rate limit, user blocked bot): log warning, continue to next identity
- SSE push failure (connection closed): remove stale connection, continue
- No identities after platform filter: log info, no-op
- Identity plugin not installed: `{ identityId }` / `{ userId }` targets degrade gracefully (log + skip)

---

## Dependencies

- **Core Identity System** — required for `{ identityId }` and `{ userId }` target resolution
- **Adapter implementations** — each adapter independently implements `sendUserNotification()`
- **api-server plugin** — required for SSE user-level endpoint

---

## Out of Scope (v2+)

- Rich notification types (buttons, cards, images, actions)
- User notification preferences (mute, schedule, channel preference)
- Notification history / inbox with read/unread tracking
- Delivery confirmation and retry with backoff
- Priority levels (urgent, normal, low)
- Notification batching / digest (group multiple notifications)
- Push notifications via mobile native (APNs, FCM)
