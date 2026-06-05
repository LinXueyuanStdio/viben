import type { OutgoingMessage } from '../../core/types.js';

/**
 * Shape of every SSE event payload sent over the wire.
 * Clients can use `event`, `id`, and `sessionId` to route and deduplicate messages.
 */
export interface SSEEvent {
  event: string;
  id?: string;
  data: unknown;
  sessionId?: string;
  timestamp: string;
}

// Module-level counter combined with timestamp to guarantee event ID uniqueness
// within a process, even if multiple events are generated in the same millisecond.
let eventCounter = 0;

/**
 * Generates a unique event ID for SSE `id:` fields.
 *
 * IDs are used by clients in the `Last-Event-ID` header on reconnect so the
 * server can replay missed events from the EventBuffer.
 */
export function generateEventId(): string {
  return `evt_${Date.now()}_${++eventCounter}`;
}

/**
 * Serializes an event name and payload to the SSE wire format.
 *
 * SSE format: `event: <name>\nid: <id>\ndata: <json>\n\n`
 * The double newline terminates the event block and triggers delivery in browsers.
 */
export function serializeSSE(event: string, id: string | undefined, data: unknown): string {
  let result = `event: ${event}\n`;
  if (id) {
    result += `id: ${id}\n`;
  }
  result += `data: ${JSON.stringify(data)}\n\n`;
  return result;
}

/** Serialize an outgoing agent message as an SSE `message` event. */
export function serializeOutgoingMessage(
  sessionId: string,
  eventId: string,
  message: OutgoingMessage,
): string {
  return serializeSSE('message', eventId, {
    type: message.type,
    sessionId,
    text: message.text,
    metadata: message.metadata,
    timestamp: new Date().toISOString(),
  });
}

/** Serialize a permission request as an SSE `permission_request` event. */
export function serializePermissionRequest(
  sessionId: string,
  eventId: string,
  request: { id: string; description: string; options: Array<{ id: string; label: string; isAllow: boolean }> },
): string {
  return serializeSSE('permission_request', eventId, { sessionId, ...request });
}

/** Serialize a session status/name change as an SSE `session_update` event. */
export function serializeSessionUpdate(
  sessionId: string,
  eventId: string,
  update: { status: string; name?: string },
): string {
  return serializeSSE('session_update', eventId, { sessionId, ...update });
}

/**
 * Serialize a heartbeat event.
 *
 * Heartbeats are sent every 30 seconds to keep idle connections alive through
 * proxy timeout windows and to let clients detect stale connections.
 */
export function serializeHeartbeat(): string {
  return serializeSSE('heartbeat', undefined, {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

/** Serialize the initial `connected` confirmation sent when a client opens a stream. */
export function serializeConnected(connectionId: string, sessionId: string): string {
  return serializeSSE('connected', undefined, {
    connectionId,
    sessionId,
    connectedAt: new Date().toISOString(),
  });
}

/** Serialize an error event (e.g. replay gap, invalid state). */
export function serializeError(eventId: string, code: string, details?: unknown): string {
  return serializeSSE('error', eventId, { code, ...((details && typeof details === 'object') ? details : {}) });
}
