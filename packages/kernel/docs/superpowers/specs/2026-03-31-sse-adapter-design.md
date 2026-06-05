# Spec 3: SSE Adapter Plugin

**Date:** 2026-03-31
**Status:** Draft
**Related specs:**
- [Spec 1: API Server Core](./2026-03-31-api-server-core-design.md)
- [Spec 2: Auth System](./2026-03-31-auth-system-design.md)
- [Spec 4: App Connectivity](./2026-03-31-app-connectivity-design.md)

## Overview

A standalone messaging adapter plugin (`@viben/sse-adapter`) that provides full bidirectional communication for app clients. Uses SSE (Server-Sent Events) for server→client streaming and REST endpoints for client→server actions. Operates as a first-class adapter like Telegram — goes through the full middleware chain.

## Plugin Structure

```
src/plugins/sse-adapter/
  index.ts              — Plugin definition, setup/teardown
  adapter.ts            — SSEAdapter implements IChannelAdapter
  connection-manager.ts — SSE connection lifecycle, session binding
  routes.ts             — Fastify plugin registered via ApiServerService
  event-serializer.ts   — OutgoingMessage → SSE event format
  event-buffer.ts       — Circular buffer for reconnect support
```

## Plugin Definition

```typescript
const plugin: VibenPlugin = {
  name: '@viben/sse-adapter',
  version: '1.0.0',
  description: 'SSE-based messaging adapter for app clients',
  permissions: ['services:register', 'kernel:access', 'events:read'],
  dependencies: ['@viben/api-server'],
};
```

## Adapter Design

SSEAdapter implements `IChannelAdapter` directly. It does not extend `MessagingAdapter` (which is for rich messaging platforms with SendQueue, DraftManager, rendering logic). SSE clients handle their own rendering.

```typescript
class SSEAdapter implements IChannelAdapter {
  name = 'sse';

  capabilities = {
    streaming: true,
    richFormatting: false,   // client renders
    threads: true,           // each session = 1 "thread"
    reactions: false,
    fileUpload: false,       // v2
    voice: false,            // v2
  };

  // Outgoing — serialize and push to SSE connections
  sendMessage(sessionId: string, message: OutgoingMessage): void;
  sendPermissionRequest(sessionId: string, request: PermissionRequest): void;
  sendNotification(sessionId: string, notification: NotificationMessage): void;

  // Session threads — sessionId is the threadId
  createSessionThread(sessionId: string): Promise<string>;
  renameSessionThread(sessionId: string, name: string): Promise<void>;

  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
}
```

**Full OutgoingMessage support:** All message types are serialized and streamed — text, thought, tool_call, tool_update, plan, usage, error, attachment, system_message, session_end, mode_change, config_update, model_update, user_replay, resource, resource_link. Client decides what to render.

## Connection Manager

Manages SSE connections, each bound to a specific session.

```typescript
interface SSEConnection {
  id: string;               // unique connection ID
  sessionId: string;        // bound session
  tokenId: string;          // auth token ID (for revocation check)
  response: ServerResponse; // SSE response stream
  connectedAt: Date;
  lastEventId?: string;     // for reconnect, resume missed events
}

class ConnectionManager {
  private connections: Map<string, SSEConnection>;   // connectionId → connection
  private sessionIndex: Map<string, Set<string>>;    // sessionId → connectionIds

  addConnection(sessionId: string, tokenId: string, res: ServerResponse): SSEConnection;
  removeConnection(connectionId: string): void;
  getConnectionsBySession(sessionId: string): SSEConnection[];
  broadcast(sessionId: string, event: SSEEvent): void;
  disconnectByToken(tokenId: string): void;  // on token revocation
  cleanup(): void;
}
```

**Multi-connection:** Multiple clients can connect to the same session (e.g., viewing output on 2 devices). All receive the same events.

**Connection lifecycle:**
1. Client `GET /api/v1/sse/sessions/:id/stream?token=<jwt>` → auth verify → create connection
2. Server sends `event: connected` with connection info
3. Server streams OutgoingMessages for that session
4. Heartbeat every 30s (`event: heartbeat`)
5. Client disconnect or token revoked → cleanup connection

## SSE Event Format

```
event: message
id: evt_001
data: {"type":"text","sessionId":"sess_123","content":"Hello world","timestamp":"2026-03-31T14:30:00Z"}

event: message
id: evt_002
data: {"type":"tool_call","sessionId":"sess_123","content":{"name":"Read","status":"running"},"timestamp":"..."}

event: permission_request
id: evt_003
data: {"sessionId":"sess_123","id":"perm_1","description":"Run npm install","options":[{"id":"allow","label":"Allow","isAllow":true},{"id":"deny","label":"Deny","isAllow":false}]}

event: session_update
id: evt_004
data: {"sessionId":"sess_123","status":"finished","name":"Fix auth bug"}

event: notification
id: evt_005
data: {"sessionId":"sess_123","type":"completed","summary":"Task finished"}

event: heartbeat
data: {"timestamp":"2026-03-31T14:30:00Z","uptime":3600}

event: connected
data: {"connectionId":"conn_abc","sessionId":"sess_123","connectedAt":"..."}

event: error
data: {"code":"EVENTS_LOST","missedCount":42}
```

## REST Endpoints (Client → Server)

Registered via `ApiServerService.registerPlugin('/api/v1/sse', routePlugin)`:

| Method | Path | Description | Scopes |
|--------|------|-------------|--------|
| `GET` | `/sessions/:id/stream` | SSE event stream (`?token=<jwt>`) | `sessions:read` |
| `POST` | `/sessions/:id/prompt` | Send message/prompt | `sessions:prompt` |
| `POST` | `/sessions/:id/permission` | Resolve permission request | `sessions:permission` |
| `POST` | `/sessions/:id/cancel` | Cancel session | `sessions:write` |
| `POST` | `/sessions/:id/command` | Execute command in session context | `commands:execute` |
| `GET` | `/connections` | List active SSE connections | `system:admin` |

## Message Flow

### Incoming (Client → Agent)

```
Client POST /api/v1/sse/sessions/:id/prompt
  → Fastify auth preHandler → verify JWT/secret
  → requireScopes('sessions:prompt')
  → Route handler
  → Middleware chain: message:incoming (security, rate limit, context...)
  → session.enqueuePrompt(message)
  → Agent processes prompt
```

### Outgoing (Agent → Client)

```
AgentInstance emits event
  → SessionBridge
  → Middleware chain: agent:beforeEvent, message:outgoing
  → SSEAdapter.sendMessage(sessionId, outgoingMessage)
  → ConnectionManager.getConnectionsBySession(sessionId)
  → EventSerializer.serialize(outgoingMessage) → SSE format
  → Write to all connected SSE streams for that session
```

Both directions go through the full middleware chain — identical to Telegram adapter. Security, context, rate limiting plugins all apply.

## SessionBridge Integration

SSE adapter registers into core like any adapter:

```typescript
setup(ctx) {
  const core = ctx.kernel.core;
  const api = ctx.getService<ApiServerService>('api-server');
  const connectionManager = new ConnectionManager();
  const adapter = new SSEAdapter(connectionManager);

  core.registerAdapter('sse', adapter);

  // Register routes into API server
  api.registerPlugin('/api/v1/sse', createRoutes(adapter, connectionManager));
}
```

When a session is created via SSE endpoint, core creates a SessionBridge with the SSE adapter. If a session already has a bridge with another adapter (e.g., Telegram), SSE can observe as read-only stream — no conflict.

## Event Buffer (Reconnect Support)

```typescript
class EventBuffer {
  private buffers: Map<string, CircularBuffer<SSEEvent>>; // sessionId → events
  private maxSize: number; // default 100 per session

  push(sessionId: string, event: SSEEvent): void;
  getSince(sessionId: string, lastEventId: string): SSEEvent[];
  cleanup(sessionId: string): void;
}
```

**Reconnect flow:**
1. Client reconnects with `Last-Event-ID` header
2. Server looks up events in buffer since that ID
3. Events found → replay missed events, then resume live streaming
4. Events evicted (buffer full, >100 events missed) → send `event: error` with `{"code":"EVENTS_LOST","missedCount":N}` → client knows to do full state refresh

## Auth for SSE Connections

SSE uses `EventSource` API which doesn't support custom headers. Auth via query parameter:

```
GET /api/v1/sse/sessions/:id/stream?token=<jwt>
```

Server validates JWT from query param using the same auth middleware (cross-ref Spec 2). The `token` query param is only accepted on SSE stream endpoints, not on REST endpoints (which use `Authorization` header).

On token revocation, `ConnectionManager.disconnectByToken(tokenId)` closes all SSE connections using that token.
