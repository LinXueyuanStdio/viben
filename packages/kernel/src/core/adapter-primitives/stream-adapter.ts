import type {
  IChannelAdapter,
  AdapterCapabilities,
} from '../channel.js'
import type {
  OutgoingMessage,
  PermissionRequest,
  NotificationMessage,
} from '../types.js'

/** A structured event emitted over the stream (SSE, WebSocket, etc.). */
export interface StreamEvent {
  type: string
  sessionId?: string
  payload: unknown
  timestamp: number
}

/**
 * Base class for stream-based adapters (SSE, WebSocket) that push events
 * directly to connected clients rather than rendering messages on a platform.
 *
 * Unlike MessagingAdapter (which renders and sends formatted messages),
 * StreamAdapter wraps each outgoing message as a StreamEvent and emits it
 * to all connections watching that session. The client is responsible for
 * rendering.
 */
export abstract class StreamAdapter implements IChannelAdapter {
  abstract readonly name: string

  capabilities: AdapterCapabilities

  constructor(config?: Partial<AdapterCapabilities>) {
    this.capabilities = {
      streaming: true,
      richFormatting: false,
      threads: false,
      reactions: false,
      fileUpload: false,
      voice: false,
      ...config,
    }
  }

  /** Wraps the outgoing message as a StreamEvent and emits it to the session's listeners. */
  async sendMessage(sessionId: string, content: OutgoingMessage): Promise<void> {
    await this.emit(sessionId, {
      type: content.type,
      sessionId,
      payload: content,
      timestamp: Date.now(),
    })
  }

  /** Emits a permission request event so the client can render approve/deny UI. */
  async sendPermissionRequest(sessionId: string, request: PermissionRequest): Promise<void> {
    await this.emit(sessionId, {
      type: 'permission_request',
      sessionId,
      payload: request,
      timestamp: Date.now(),
    })
  }

  /** Broadcasts a notification to all connected clients (not scoped to a session). */
  async sendNotification(notification: NotificationMessage): Promise<void> {
    await this.broadcast({
      type: 'notification',
      payload: notification,
      timestamp: Date.now(),
    })
  }

  /**
   * No-op for stream adapters — threads are a platform concept (Telegram topics, Slack threads).
   * Stream clients manage their own session UI.
   */
  async createSessionThread(_sessionId: string, _name: string): Promise<string> {
    return ''
  }

  /** Emits a rename event so connected clients can update their session title. */
  async renameSessionThread(sessionId: string, name: string): Promise<void> {
    await this.emit(sessionId, {
      type: 'session_rename',
      sessionId,
      payload: { name },
      timestamp: Date.now(),
    })
  }

  /** Sends an event to all connections watching a specific session. */
  protected abstract emit(sessionId: string, event: StreamEvent): Promise<void>
  /** Sends an event to all connected clients regardless of session. */
  protected abstract broadcast(event: StreamEvent): Promise<void>
  abstract start(): Promise<void>
  abstract stop(): Promise<void>
}
