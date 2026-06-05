# SSE Adapter Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a standalone SSE adapter plugin (`@viben/sse-adapter`) that provides full bidirectional messaging for app clients — SSE for server→client streaming, REST for client→server actions. Operates as a first-class adapter with full middleware chain integration.

**Architecture:** Plugin implements `IChannelAdapter` directly (not via MessagingAdapter). ConnectionManager tracks per-session SSE connections. EventBuffer provides reconnect support. Routes registered via ApiServerService from Plan 1. All messages go through SessionBridge middleware chain.

**Tech Stack:** Fastify (via ApiServerService), Node.js native SSE (ServerResponse), existing TypedEmitter for events

**Spec:** [docs/superpowers/specs/2026-03-31-sse-adapter-design.md](../specs/2026-03-31-sse-adapter-design.md)
**Depends on:** [Plan 1: API Server Core](./2026-03-31-api-server-core.md), [Plan 2: Auth System](./2026-03-31-auth-system.md)

---

## File Structure

```
src/plugins/sse-adapter/
  index.ts              — CREATE: Plugin definition, setup/teardown, adapter registration
  adapter.ts            — CREATE: SSEAdapter implements IChannelAdapter
  connection-manager.ts — CREATE: SSE connection lifecycle, session binding
  event-buffer.ts       — CREATE: Circular buffer for reconnect support
  event-serializer.ts   — CREATE: OutgoingMessage → SSE event format
  routes.ts             — CREATE: Fastify plugin with SSE stream + REST endpoints
```

---

## Task 1: Create Event Serializer

**Files:**
- Create: `src/plugins/sse-adapter/event-serializer.ts`
- Test: `src/plugins/sse-adapter/__tests__/event-serializer.test.ts`

- [ ] **Step 1: Write failing tests for event serializer**

```typescript
// src/plugins/sse-adapter/__tests__/event-serializer.test.ts
import { describe, it, expect } from 'vitest';
import { serializeSSE, serializeOutgoingMessage, serializePermissionRequest } from '../event-serializer.js';

describe('event-serializer', () => {
  it('serializes a basic SSE event', () => {
    const result = serializeSSE('message', 'evt_001', { type: 'text', content: 'Hello' });
    expect(result).toBe(
      'event: message\nid: evt_001\ndata: {"type":"text","content":"Hello"}\n\n',
    );
  });

  it('serializes SSE event without ID', () => {
    const result = serializeSSE('heartbeat', undefined, { timestamp: '2026-03-31T00:00:00Z' });
    expect(result).toBe(
      'event: heartbeat\ndata: {"timestamp":"2026-03-31T00:00:00Z"}\n\n',
    );
  });

  it('serializes outgoing text message', () => {
    const result = serializeOutgoingMessage('sess_1', 'evt_002', {
      type: 'text',
      content: 'Hello world',
    } as any);

    expect(result).toContain('event: message');
    expect(result).toContain('id: evt_002');
    expect(result).toContain('"type":"text"');
    expect(result).toContain('"sessionId":"sess_1"');
    expect(result).toContain('"content":"Hello world"');
  });

  it('serializes permission request', () => {
    const result = serializePermissionRequest('sess_1', 'evt_003', {
      id: 'perm_1',
      description: 'Run npm install',
      options: [{ id: 'allow', label: 'Allow', isAllow: true }],
    });

    expect(result).toContain('event: permission_request');
    expect(result).toContain('"id":"perm_1"');
  });

  it('handles multiline data by splitting into multiple data: lines', () => {
    const result = serializeSSE('message', 'evt_004', { content: 'line1\nline2\nline3' });
    // SSE spec: multiline data must be split into multiple data: lines
    // But we JSON.stringify which escapes newlines, so this should be single data line
    expect(result).toContain('data: {');
    expect(result.split('\n\n')).toHaveLength(2); // event + trailing empty
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/plugins/sse-adapter/__tests__/event-serializer.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement event serializer**

```typescript
// src/plugins/sse-adapter/event-serializer.ts
import type { OutgoingMessage } from '../../core/agent-event.js';

export interface SSEEvent {
  event: string;
  id?: string;
  data: unknown;
  sessionId?: string;
  timestamp: string;
}

let eventCounter = 0;

export function generateEventId(): string {
  return `evt_${Date.now()}_${++eventCounter}`;
}

export function serializeSSE(event: string, id: string | undefined, data: unknown): string {
  let result = `event: ${event}\n`;
  if (id) {
    result += `id: ${id}\n`;
  }
  const json = JSON.stringify(data);
  result += `data: ${json}\n\n`;
  return result;
}

export function serializeOutgoingMessage(
  sessionId: string,
  eventId: string,
  message: OutgoingMessage,
): string {
  return serializeSSE('message', eventId, {
    type: message.type,
    sessionId,
    content: message.content,
    timestamp: new Date().toISOString(),
  });
}

export function serializePermissionRequest(
  sessionId: string,
  eventId: string,
  request: { id: string; description: string; options: Array<{ id: string; label: string; isAllow: boolean }> },
): string {
  return serializeSSE('permission_request', eventId, {
    sessionId,
    ...request,
  });
}

export function serializeSessionUpdate(
  sessionId: string,
  eventId: string,
  update: { status: string; name?: string },
): string {
  return serializeSSE('session_update', eventId, {
    sessionId,
    ...update,
  });
}

export function serializeHeartbeat(): string {
  return serializeSSE('heartbeat', undefined, {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

export function serializeConnected(connectionId: string, sessionId: string): string {
  return serializeSSE('connected', undefined, {
    connectionId,
    sessionId,
    connectedAt: new Date().toISOString(),
  });
}

export function serializeError(eventId: string, code: string, details?: unknown): string {
  return serializeSSE('error', eventId, { code, ...((details && typeof details === 'object') ? details : {}) });
}
```

Note: The implementing agent must check the exact `OutgoingMessage` type definition in `src/core/agent-event.ts` and adjust the `content` field serialization accordingly. The message type might have nested structures for `tool_call`, `plan`, etc.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- src/plugins/sse-adapter/__tests__/event-serializer.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/sse-adapter/
git commit -m "feat(sse): add SSE event serializer for outgoing messages"
```

---

## Task 2: Create Event Buffer (Reconnect Support)

**Files:**
- Create: `src/plugins/sse-adapter/event-buffer.ts`
- Test: `src/plugins/sse-adapter/__tests__/event-buffer.test.ts`

- [ ] **Step 1: Write failing tests for event buffer**

```typescript
// src/plugins/sse-adapter/__tests__/event-buffer.test.ts
import { describe, it, expect } from 'vitest';
import { EventBuffer } from '../event-buffer.js';

describe('EventBuffer', () => {
  it('stores events per session', () => {
    const buffer = new EventBuffer(100);
    buffer.push('sess_1', { id: 'evt_1', data: 'hello' });
    buffer.push('sess_1', { id: 'evt_2', data: 'world' });
    buffer.push('sess_2', { id: 'evt_3', data: 'other' });

    const events = buffer.getSince('sess_1', undefined);
    expect(events).toHaveLength(2);
  });

  it('returns events since a given ID', () => {
    const buffer = new EventBuffer(100);
    buffer.push('sess_1', { id: 'evt_1', data: 'a' });
    buffer.push('sess_1', { id: 'evt_2', data: 'b' });
    buffer.push('sess_1', { id: 'evt_3', data: 'c' });

    const events = buffer.getSince('sess_1', 'evt_1');
    expect(events).toHaveLength(2);
    expect(events[0].id).toBe('evt_2');
    expect(events[1].id).toBe('evt_3');
  });

  it('returns empty array for unknown session', () => {
    const buffer = new EventBuffer(100);
    expect(buffer.getSince('unknown', undefined)).toHaveLength(0);
  });

  it('evicts oldest events when buffer is full', () => {
    const buffer = new EventBuffer(3);
    buffer.push('sess_1', { id: 'evt_1', data: 'a' });
    buffer.push('sess_1', { id: 'evt_2', data: 'b' });
    buffer.push('sess_1', { id: 'evt_3', data: 'c' });
    buffer.push('sess_1', { id: 'evt_4', data: 'd' }); // evicts evt_1

    const all = buffer.getSince('sess_1', undefined);
    expect(all).toHaveLength(3);
    expect(all[0].id).toBe('evt_2');
  });

  it('returns null from getSince when requested ID was evicted', () => {
    const buffer = new EventBuffer(2);
    buffer.push('sess_1', { id: 'evt_1', data: 'a' });
    buffer.push('sess_1', { id: 'evt_2', data: 'b' });
    buffer.push('sess_1', { id: 'evt_3', data: 'c' }); // evicts evt_1

    // evt_1 was evicted, so getSince('evt_1') can't find it
    const events = buffer.getSince('sess_1', 'evt_1');
    expect(events).toBeNull(); // null signals EVENTS_LOST
  });

  it('cleans up a session buffer', () => {
    const buffer = new EventBuffer(100);
    buffer.push('sess_1', { id: 'evt_1', data: 'a' });
    buffer.cleanup('sess_1');

    expect(buffer.getSince('sess_1', undefined)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/plugins/sse-adapter/__tests__/event-buffer.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement event buffer**

```typescript
// src/plugins/sse-adapter/event-buffer.ts
export interface BufferedEvent {
  id: string;
  data: unknown;
}

export class EventBuffer {
  private buffers = new Map<string, BufferedEvent[]>();

  constructor(private maxSize: number = 100) {}

  push(sessionId: string, event: BufferedEvent): void {
    let buffer = this.buffers.get(sessionId);
    if (!buffer) {
      buffer = [];
      this.buffers.set(sessionId, buffer);
    }

    buffer.push(event);

    // Evict oldest if over capacity
    while (buffer.length > this.maxSize) {
      buffer.shift();
    }
  }

  /**
   * Get events since a given event ID.
   * Returns null if the requested ID was evicted (client missed too many events).
   * Returns all events if lastEventId is undefined.
   */
  getSince(sessionId: string, lastEventId: string | undefined): BufferedEvent[] | null {
    const buffer = this.buffers.get(sessionId);
    if (!buffer || buffer.length === 0) return [];

    if (lastEventId === undefined) {
      return [...buffer];
    }

    const index = buffer.findIndex((e) => e.id === lastEventId);
    if (index === -1) {
      // Event was evicted — client lost events
      return null;
    }

    return buffer.slice(index + 1);
  }

  cleanup(sessionId: string): void {
    this.buffers.delete(sessionId);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- src/plugins/sse-adapter/__tests__/event-buffer.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/sse-adapter/event-buffer.ts src/plugins/sse-adapter/__tests__/event-buffer.test.ts
git commit -m "feat(sse): add circular event buffer for reconnect support"
```

---

## Task 3: Create Connection Manager

**Files:**
- Create: `src/plugins/sse-adapter/connection-manager.ts`
- Test: `src/plugins/sse-adapter/__tests__/connection-manager.test.ts`

- [ ] **Step 1: Write failing tests for ConnectionManager**

```typescript
// src/plugins/sse-adapter/__tests__/connection-manager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionManager } from '../connection-manager.js';
import type { ServerResponse } from 'node:http';

function mockResponse(): ServerResponse {
  return {
    write: vi.fn().mockReturnValue(true),
    end: vi.fn(),
    on: vi.fn(),
    writableEnded: false,
  } as any;
}

describe('ConnectionManager', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = new ConnectionManager();
  });

  it('adds a connection and retrieves by session', () => {
    const res = mockResponse();
    const conn = manager.addConnection('sess_1', 'tok_1', res);

    expect(conn.id).toBeDefined();
    expect(conn.sessionId).toBe('sess_1');

    const conns = manager.getConnectionsBySession('sess_1');
    expect(conns).toHaveLength(1);
    expect(conns[0].id).toBe(conn.id);
  });

  it('supports multiple connections per session', () => {
    manager.addConnection('sess_1', 'tok_1', mockResponse());
    manager.addConnection('sess_1', 'tok_2', mockResponse());

    expect(manager.getConnectionsBySession('sess_1')).toHaveLength(2);
  });

  it('removes a connection', () => {
    const conn = manager.addConnection('sess_1', 'tok_1', mockResponse());
    manager.removeConnection(conn.id);

    expect(manager.getConnectionsBySession('sess_1')).toHaveLength(0);
  });

  it('broadcasts to all connections for a session', () => {
    const res1 = mockResponse();
    const res2 = mockResponse();
    manager.addConnection('sess_1', 'tok_1', res1);
    manager.addConnection('sess_1', 'tok_2', res2);

    manager.broadcast('sess_1', 'event: test\ndata: hello\n\n');

    expect(res1.write).toHaveBeenCalledWith('event: test\ndata: hello\n\n');
    expect(res2.write).toHaveBeenCalledWith('event: test\ndata: hello\n\n');
  });

  it('does not broadcast to other sessions', () => {
    const res1 = mockResponse();
    const res2 = mockResponse();
    manager.addConnection('sess_1', 'tok_1', res1);
    manager.addConnection('sess_2', 'tok_2', res2);

    manager.broadcast('sess_1', 'event: test\ndata: hello\n\n');

    expect(res1.write).toHaveBeenCalled();
    expect(res2.write).not.toHaveBeenCalled();
  });

  it('disconnects all connections for a token', () => {
    const res1 = mockResponse();
    const res2 = mockResponse();
    manager.addConnection('sess_1', 'tok_1', res1);
    manager.addConnection('sess_2', 'tok_1', res2);
    manager.addConnection('sess_3', 'tok_2', mockResponse());

    manager.disconnectByToken('tok_1');

    expect(res1.end).toHaveBeenCalled();
    expect(res2.end).toHaveBeenCalled();
    expect(manager.getConnectionsBySession('sess_1')).toHaveLength(0);
    expect(manager.getConnectionsBySession('sess_2')).toHaveLength(0);
    expect(manager.getConnectionsBySession('sess_3')).toHaveLength(1);
  });

  it('returns empty array for unknown session', () => {
    expect(manager.getConnectionsBySession('unknown')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/plugins/sse-adapter/__tests__/connection-manager.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement ConnectionManager**

```typescript
// src/plugins/sse-adapter/connection-manager.ts
import type { ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';

export interface SSEConnection {
  id: string;
  sessionId: string;
  tokenId: string;
  response: ServerResponse;
  connectedAt: Date;
  lastEventId?: string;
}

export class ConnectionManager {
  private connections = new Map<string, SSEConnection>();
  private sessionIndex = new Map<string, Set<string>>();

  addConnection(sessionId: string, tokenId: string, response: ServerResponse): SSEConnection {
    const id = `conn_${randomBytes(8).toString('hex')}`;
    const connection: SSEConnection = {
      id,
      sessionId,
      tokenId,
      response,
      connectedAt: new Date(),
    };

    this.connections.set(id, connection);

    let sessionConns = this.sessionIndex.get(sessionId);
    if (!sessionConns) {
      sessionConns = new Set();
      this.sessionIndex.set(sessionId, sessionConns);
    }
    sessionConns.add(id);

    // Cleanup on close
    response.on('close', () => {
      this.removeConnection(id);
    });

    return connection;
  }

  removeConnection(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    this.connections.delete(connectionId);
    const sessionConns = this.sessionIndex.get(conn.sessionId);
    if (sessionConns) {
      sessionConns.delete(connectionId);
      if (sessionConns.size === 0) {
        this.sessionIndex.delete(conn.sessionId);
      }
    }
  }

  getConnectionsBySession(sessionId: string): SSEConnection[] {
    const connIds = this.sessionIndex.get(sessionId);
    if (!connIds) return [];
    return Array.from(connIds)
      .map((id) => this.connections.get(id))
      .filter((c): c is SSEConnection => c !== undefined);
  }

  broadcast(sessionId: string, serializedEvent: string): void {
    const connections = this.getConnectionsBySession(sessionId);
    for (const conn of connections) {
      if (!conn.response.writableEnded) {
        conn.response.write(serializedEvent);
      }
    }
  }

  disconnectByToken(tokenId: string): void {
    for (const [id, conn] of this.connections) {
      if (conn.tokenId === tokenId) {
        if (!conn.response.writableEnded) {
          conn.response.end();
        }
        this.removeConnection(id);
      }
    }
  }

  listConnections(): SSEConnection[] {
    return Array.from(this.connections.values());
  }

  cleanup(): void {
    for (const [id, conn] of this.connections) {
      if (!conn.response.writableEnded) {
        conn.response.end();
      }
    }
    this.connections.clear();
    this.sessionIndex.clear();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- src/plugins/sse-adapter/__tests__/connection-manager.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/sse-adapter/connection-manager.ts src/plugins/sse-adapter/__tests__/connection-manager.test.ts
git commit -m "feat(sse): add ConnectionManager for SSE connection lifecycle"
```

---

## Task 4: Implement SSEAdapter (IChannelAdapter)

**Files:**
- Create: `src/plugins/sse-adapter/adapter.ts`
- Test: `src/plugins/sse-adapter/__tests__/adapter.test.ts`

- [ ] **Step 1: Write failing tests for SSEAdapter**

```typescript
// src/plugins/sse-adapter/__tests__/adapter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SSEAdapter } from '../adapter.js';
import { ConnectionManager } from '../connection-manager.js';
import { EventBuffer } from '../event-buffer.js';
import type { ServerResponse } from 'node:http';

function mockResponse(): ServerResponse {
  return {
    write: vi.fn().mockReturnValue(true),
    end: vi.fn(),
    on: vi.fn(),
    writableEnded: false,
  } as any;
}

describe('SSEAdapter', () => {
  let adapter: SSEAdapter;
  let connectionManager: ConnectionManager;
  let eventBuffer: EventBuffer;

  beforeEach(() => {
    connectionManager = new ConnectionManager();
    eventBuffer = new EventBuffer(100);
    adapter = new SSEAdapter(connectionManager, eventBuffer);
  });

  it('has correct name and capabilities', () => {
    expect(adapter.name).toBe('sse');
    expect(adapter.capabilities.streaming).toBe(true);
    expect(adapter.capabilities.richFormatting).toBe(false);
    expect(adapter.capabilities.threads).toBe(true);
  });

  it('sends message to all session connections', async () => {
    const res = mockResponse();
    connectionManager.addConnection('sess_1', 'tok_1', res);

    await adapter.sendMessage('sess_1', { type: 'text', content: 'Hello' } as any);

    expect(res.write).toHaveBeenCalled();
    const written = (res.write as any).mock.calls[0][0] as string;
    expect(written).toContain('event: message');
    expect(written).toContain('"content":"Hello"');
  });

  it('buffers events for reconnect', async () => {
    const res = mockResponse();
    connectionManager.addConnection('sess_1', 'tok_1', res);

    await adapter.sendMessage('sess_1', { type: 'text', content: 'Hello' } as any);

    const buffered = eventBuffer.getSince('sess_1', undefined);
    expect(buffered).toHaveLength(1);
  });

  it('sends permission request', async () => {
    const res = mockResponse();
    connectionManager.addConnection('sess_1', 'tok_1', res);

    await adapter.sendPermissionRequest('sess_1', {
      id: 'perm_1',
      description: 'Run npm install',
      options: [{ id: 'allow', label: 'Allow', isAllow: true }],
    } as any);

    const written = (res.write as any).mock.calls[0][0] as string;
    expect(written).toContain('event: permission_request');
  });

  it('createSessionThread returns sessionId as threadId', async () => {
    const threadId = await adapter.createSessionThread('sess_1', 'Test Session');
    expect(threadId).toBe('sess_1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/plugins/sse-adapter/__tests__/adapter.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement SSEAdapter**

```typescript
// src/plugins/sse-adapter/adapter.ts
import type { IChannelAdapter, AdapterCapabilities } from '../../core/channel.js';
import type { OutgoingMessage } from '../../core/agent-event.js';
import type { NotificationMessage } from '../../core/notifications.js';
import type { ConnectionManager } from './connection-manager.js';
import type { EventBuffer } from './event-buffer.js';
import {
  generateEventId,
  serializeOutgoingMessage,
  serializePermissionRequest,
  serializeSSE,
  serializeHeartbeat,
} from './event-serializer.js';

export class SSEAdapter implements IChannelAdapter {
  readonly name = 'sse';
  readonly capabilities: AdapterCapabilities = {
    streaming: true,
    richFormatting: false,
    threads: true,
    reactions: false,
    fileUpload: false,
    voice: false,
  };

  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private connectionManager: ConnectionManager,
    private eventBuffer: EventBuffer,
  ) {}

  async sendMessage(sessionId: string, message: OutgoingMessage): Promise<void> {
    const eventId = generateEventId();
    const serialized = serializeOutgoingMessage(sessionId, eventId, message);

    // Buffer for reconnect
    this.eventBuffer.push(sessionId, { id: eventId, data: serialized });

    // Broadcast to all connections for this session
    this.connectionManager.broadcast(sessionId, serialized);
  }

  async sendPermissionRequest(sessionId: string, request: any): Promise<void> {
    const eventId = generateEventId();
    const serialized = serializePermissionRequest(sessionId, eventId, request);

    this.eventBuffer.push(sessionId, { id: eventId, data: serialized });
    this.connectionManager.broadcast(sessionId, serialized);
  }

  async sendNotification(notification: NotificationMessage): Promise<void> {
    const eventId = generateEventId();
    const sessionId = notification.sessionId;
    const serialized = serializeSSE('notification', eventId, notification);

    if (sessionId) {
      this.eventBuffer.push(sessionId, { id: eventId, data: serialized });
      this.connectionManager.broadcast(sessionId, serialized);
    }
  }

  async createSessionThread(sessionId: string, _name: string): Promise<string> {
    // SSE doesn't need thread creation — sessionId IS the thread
    return sessionId;
  }

  async renameSessionThread(_sessionId: string, _newName: string): Promise<void> {
    // No-op for SSE — client tracks session names via session_update events
  }

  async start(): Promise<void> {
    // Start heartbeat broadcast every 30s
    this.heartbeatInterval = setInterval(() => {
      const heartbeat = serializeHeartbeat();
      for (const conn of this.connectionManager.listConnections()) {
        if (!conn.response.writableEnded) {
          conn.response.write(heartbeat);
        }
      }
    }, 30_000);
  }

  async stop(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.connectionManager.cleanup();
  }
}
```

Note: The implementing agent must verify `OutgoingMessage`, `NotificationMessage`, and `PermissionRequest` types from `src/core/agent-event.ts` and `src/core/notifications.ts` (or wherever they are defined). Adjust imports and field access accordingly.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- src/plugins/sse-adapter/__tests__/adapter.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/sse-adapter/adapter.ts src/plugins/sse-adapter/__tests__/adapter.test.ts
git commit -m "feat(sse): implement SSEAdapter with IChannelAdapter interface"
```

---

## Task 5: Create SSE Routes (Fastify Plugin)

**Files:**
- Create: `src/plugins/sse-adapter/routes.ts`
- Test: `src/plugins/sse-adapter/__tests__/routes.test.ts`

- [ ] **Step 1: Write failing tests for SSE routes**

```typescript
// src/plugins/sse-adapter/__tests__/routes.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { createSSERoutes } from '../routes.js';
import { ConnectionManager } from '../connection-manager.js';
import { EventBuffer } from '../event-buffer.js';

describe('SSE routes', () => {
  let app: ReturnType<typeof Fastify>;
  let connectionManager: ConnectionManager;

  beforeEach(async () => {
    connectionManager = new ConnectionManager();
    const eventBuffer = new EventBuffer(100);

    app = Fastify();
    app.decorateRequest('auth', { type: 'secret', role: 'admin', scopes: ['*'] });

    const mockCore = {
      sessionManager: {
        getSession: vi.fn().mockImplementation((id: string) => {
          if (id === 'sess_1') {
            return {
              id: 'sess_1',
              enqueuePrompt: vi.fn().mockResolvedValue(undefined),
              cancel: vi.fn().mockResolvedValue(undefined),
              resolvePermission: vi.fn(),
            };
          }
          return undefined;
        }),
      },
      commandRegistry: {
        execute: vi.fn().mockResolvedValue({ type: 'text', text: 'done' }),
      },
    };

    await app.register(
      (a) => createSSERoutes(a, {
        connectionManager,
        eventBuffer,
        core: mockCore as any,
      }),
      { prefix: '/api/v1/sse' },
    );
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /sessions/:id/prompt enqueues a prompt', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sse/sessions/sess_1/prompt',
      payload: { message: 'Hello agent' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });

  it('POST /sessions/:id/prompt returns 404 for unknown session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sse/sessions/unknown/prompt',
      payload: { message: 'Hello' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('POST /sessions/:id/cancel cancels a session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sse/sessions/sess_1/cancel',
    });

    expect(res.statusCode).toBe(200);
  });

  it('GET /connections lists active connections', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/sse/connections',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.connections).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/plugins/sse-adapter/__tests__/routes.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement SSE routes**

```typescript
// src/plugins/sse-adapter/routes.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { VibenCore } from '../../core/core.js';
import type { ConnectionManager } from './connection-manager.js';
import type { EventBuffer } from './event-buffer.js';
import { NotFoundError } from '../api-server/middleware/error-handler.js';
import { PromptBodySchema, PermissionResponseBodySchema } from '../api-server/schemas/sessions.js';
import { ExecuteCommandBodySchema } from '../api-server/schemas/commands.js';
import { IdParamSchema } from '../api-server/schemas/common.js';
import { serializeConnected, serializeError } from './event-serializer.js';

export interface SSERouteDeps {
  connectionManager: ConnectionManager;
  eventBuffer: EventBuffer;
  core: VibenCore;
}

export async function createSSERoutes(app: FastifyInstance, deps: SSERouteDeps): Promise<void> {
  const { connectionManager, eventBuffer, core } = deps;

  // GET /sessions/:id/stream — SSE event stream
  app.get('/sessions/:id/stream', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = IdParamSchema.parse(request.params);
    const session = core.sessionManager.getSession(id);
    if (!session) {
      throw new NotFoundError('SESSION_NOT_FOUND', `Session ${id} not found`);
    }

    // Hijack response for SSE streaming
    reply.hijack();
    const res = reply.raw;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Add connection
    const tokenId = request.auth.tokenId ?? 'secret';
    const conn = connectionManager.addConnection(id, tokenId, res);

    // Send connected event
    res.write(serializeConnected(conn.id, id));

    // Replay missed events if reconnecting
    const lastEventId = request.headers['last-event-id'] as string | undefined;
    if (lastEventId) {
      const missed = eventBuffer.getSince(id, lastEventId);
      if (missed === null) {
        // Events were lost
        res.write(serializeError('reconnect', 'EVENTS_LOST', { message: 'Some events were missed' }));
      } else {
        for (const event of missed) {
          res.write(event.data as string);
        }
      }
    }
  });

  // POST /sessions/:id/prompt — send message
  app.post('/sessions/:id/prompt', async (request) => {
    const { id } = IdParamSchema.parse(request.params);
    const { message } = PromptBodySchema.parse(request.body);
    const session = core.sessionManager.getSession(id);
    if (!session) {
      throw new NotFoundError('SESSION_NOT_FOUND', `Session ${id} not found`);
    }
    await session.enqueuePrompt(message);
    return { success: true, sessionId: id };
  });

  // POST /sessions/:id/permission — resolve permission
  app.post('/sessions/:id/permission', async (request) => {
    const { id } = IdParamSchema.parse(request.params);
    const { requestId, optionId } = PermissionResponseBodySchema.parse(request.body);
    const session = core.sessionManager.getSession(id);
    if (!session) {
      throw new NotFoundError('SESSION_NOT_FOUND', `Session ${id} not found`);
    }
    session.resolvePermission(requestId, optionId);
    return { success: true };
  });

  // POST /sessions/:id/cancel — cancel session
  app.post('/sessions/:id/cancel', async (request) => {
    const { id } = IdParamSchema.parse(request.params);
    const session = core.sessionManager.getSession(id);
    if (!session) {
      throw new NotFoundError('SESSION_NOT_FOUND', `Session ${id} not found`);
    }
    await session.cancel();
    return { success: true };
  });

  // POST /sessions/:id/command — execute command
  app.post('/sessions/:id/command', async (request) => {
    const { id } = IdParamSchema.parse(request.params);
    const { command } = ExecuteCommandBodySchema.parse(request.body);
    const session = core.sessionManager.getSession(id);
    if (!session) {
      throw new NotFoundError('SESSION_NOT_FOUND', `Session ${id} not found`);
    }
    const result = await core.commandRegistry.execute(command, {
      sessionId: id,
      channelId: 'sse',
      userId: request.auth.tokenId ?? 'secret',
      reply: async () => {},
    });
    return { result: result ?? { type: 'silent' } };
  });

  // GET /connections — list active SSE connections (admin only)
  app.get('/connections', async () => {
    const connections = connectionManager.listConnections();
    return {
      connections: connections.map((c) => ({
        id: c.id,
        sessionId: c.sessionId,
        tokenId: c.tokenId,
        connectedAt: c.connectedAt.toISOString(),
      })),
    };
  });
}
```

Note: The implementing agent must verify:
- `session.enqueuePrompt()` signature (may be `session.promptQueue.enqueue()`)
- `session.resolvePermission()` signature (may be `session.permissionGate.resolve()`)
- `session.cancel()` signature
- Import paths for schemas from api-server plugin

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- src/plugins/sse-adapter/__tests__/routes.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/sse-adapter/routes.ts src/plugins/sse-adapter/__tests__/routes.test.ts
git commit -m "feat(sse): add Fastify routes for SSE stream and REST endpoints"
```

---

## Task 6: Create Plugin Entry and Wire Everything

**Files:**
- Create: `src/plugins/sse-adapter/index.ts`

- [ ] **Step 1: Implement plugin definition and setup**

```typescript
// src/plugins/sse-adapter/index.ts
import type { VibenPlugin } from '../../core/plugin/types.js';
import { SSEAdapter } from './adapter.js';
import { ConnectionManager } from './connection-manager.js';
import { EventBuffer } from './event-buffer.js';
import { createSSERoutes } from './routes.js';
import type { ApiServerService } from '../api-server/service.js';

const plugin: VibenPlugin = {
  name: '@viben/sse-adapter',
  version: '1.0.0',
  description: 'SSE-based messaging adapter for app clients',
  permissions: ['services:register', 'kernel:access', 'events:read'],
  dependencies: ['@viben/api-server'],

  async setup(ctx) {
    const core = ctx.kernel.core;
    const apiService = ctx.getService<ApiServerService>('api-server');

    const connectionManager = new ConnectionManager();
    const eventBuffer = new EventBuffer(100);
    const adapter = new SSEAdapter(connectionManager, eventBuffer);

    // Register as adapter in core
    core.registerAdapter('sse', adapter);

    // Register routes into API server
    apiService.registerPlugin('/api/v1/sse', (app) =>
      createSSERoutes(app, { connectionManager, eventBuffer, core }),
    );

    // Start adapter (heartbeat, etc.)
    await adapter.start();

    ctx.log.info('SSE adapter started');

    // Teardown
    return async () => {
      await adapter.stop();
      ctx.log.info('SSE adapter stopped');
    };
  },
};

export default plugin;
```

Note: The implementing agent must verify:
- How `ctx.kernel` exposes `core` (may need `ctx.kernel.core` or different access pattern)
- How `core.registerAdapter()` works (check `src/core/core.ts`)
- How plugin teardown is structured (return function vs `teardown()` hook)
- Add the plugin to the built-in plugins list if needed

- [ ] **Step 2: Register plugin in plugin loader**

Check where built-in plugins are registered (likely in `src/main.ts` or a plugins index file) and add `@viben/sse-adapter`.

- [ ] **Step 3: Verify build and all tests**

```bash
pnpm build && pnpm test
```

Expected: All pass.

- [ ] **Step 4: Manual smoke test**

1. Start Viben: `pnpm start`
2. Create a session via API
3. Connect SSE: `curl -N -H "Authorization: Bearer <secret>" http://localhost:<port>/api/v1/sse/sessions/<id>/stream`
4. Send prompt: `curl -X POST -H "Authorization: Bearer <secret>" -H "Content-Type: application/json" -d '{"message":"Hello"}' http://localhost:<port>/api/v1/sse/sessions/<id>/prompt`
5. Observe SSE events streaming in the first terminal

- [ ] **Step 5: Commit**

```bash
git add src/plugins/sse-adapter/
git commit -m "feat(sse): wire SSE adapter plugin with routes and adapter registration"
```
