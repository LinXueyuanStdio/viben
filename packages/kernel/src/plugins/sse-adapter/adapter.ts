import type { IChannelAdapter, AdapterCapabilities } from '../../core/channel.js';
import type { OutgoingMessage, PermissionRequest, NotificationMessage } from '../../core/types.js';
import type { ConnectionManager } from './connection-manager.js';
import type { EventBuffer } from './event-buffer.js';
import {
  generateEventId,
  serializeOutgoingMessage,
  serializePermissionRequest,
  serializeHeartbeat,
  serializeSSE,
} from './event-serializer.js';

// Keep idle connections alive through proxy timeout windows (typically 60–90 s).
// 30 s is well within that range while being infrequent enough to not generate noise.
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * SSE-based channel adapter for the Viben web app.
 *
 * Unlike Telegram/Slack adapters (which extend `MessagingAdapter` and have
 * platform-specific rendering), SSEAdapter implements `IChannelAdapter` directly.
 * It does not format messages — it serializes them as JSON and pushes them over
 * the SSE stream so the web app can render them natively.
 *
 * Key differences from Telegram/Slack:
 * - No platform SDK: communication is via raw HTTP responses (Node.js `ServerResponse`).
 * - No threads: SSE has no concept of topics — `createSessionThread` returns sessionId.
 * - Every outbound event is also pushed to the `EventBuffer` so reconnecting clients
 *   can catch up via `Last-Event-ID` replay.
 *
 * Session connections are managed by `ConnectionManager`. A session can have multiple
 * concurrent SSE connections (e.g. two open browser tabs), all receiving the same events.
 */
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

  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly connectionManager: ConnectionManager,
    private readonly eventBuffer: EventBuffer,
  ) {}

  /**
   * Starts the heartbeat timer that keeps idle SSE connections alive.
   *
   * `.unref()` prevents the timer from blocking the Node.js event loop from
   * exiting if this is the only remaining async operation (e.g. during tests).
   */
  async start(): Promise<void> {
    this.heartbeatTimer = setInterval(() => {
      const heartbeat = serializeHeartbeat();
      for (const conn of this.connectionManager.listConnections()) {
        if (!conn.response.writableEnded) {
          try { conn.response.write(heartbeat); } catch { /* closed */ }
        }
      }
    }, HEARTBEAT_INTERVAL_MS);

    if (typeof this.heartbeatTimer === 'object' && 'unref' in this.heartbeatTimer) {
      (this.heartbeatTimer as NodeJS.Timeout).unref();
    }
  }

  /** Stops the heartbeat timer and closes all active connections. */
  async stop(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    this.connectionManager.cleanup();
  }

  /**
   * Serializes an outgoing agent message, pushes it to the event buffer,
   * then broadcasts it to all active connections for the session.
   *
   * Buffering before broadcast ensures that a client reconnecting immediately
   * after this call can still replay the event via `Last-Event-ID`.
   */
  async sendMessage(sessionId: string, content: OutgoingMessage): Promise<void> {
    const eventId = generateEventId();
    const serialized = serializeOutgoingMessage(sessionId, eventId, content);
    this.eventBuffer.push(sessionId, { id: eventId, data: serialized });
    this.connectionManager.broadcast(sessionId, serialized);
  }

  /** Serializes and delivers a permission request UI to the session's SSE clients. */
  async sendPermissionRequest(sessionId: string, request: PermissionRequest): Promise<void> {
    const eventId = generateEventId();
    const serialized = serializePermissionRequest(sessionId, eventId, request);
    this.eventBuffer.push(sessionId, { id: eventId, data: serialized });
    this.connectionManager.broadcast(sessionId, serialized);
  }

  /**
   * Delivers a cross-session notification to the target session's SSE clients.
   *
   * Notifications are always buffered in addition to being broadcast so that
   * a client reconnecting shortly after (e.g. page refresh) still sees the alert.
   */
  async sendNotification(notification: NotificationMessage): Promise<void> {
    if (notification.sessionId) {
      const eventId = generateEventId();
      const serialized = serializeSSE('notification', eventId, notification);
      this.eventBuffer.push(notification.sessionId, { id: eventId, data: serialized });
      this.connectionManager.broadcast(notification.sessionId, serialized);
    }
  }

  /** SSE has no concept of threads — return sessionId as the threadId */
  async createSessionThread(sessionId: string, _name: string): Promise<string> {
    return sessionId;
  }

  /** No-op for SSE — there are no named threads to rename. */
  async renameSessionThread(_sessionId: string, _newName: string): Promise<void> {
  }

  /** No-op for SSE — there are no platform topics to archive. */
  async archiveSessionTopic(_sessionId: string): Promise<void> {
  }
}
