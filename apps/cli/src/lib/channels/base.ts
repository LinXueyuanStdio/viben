/**
 * Channel Base Types and Interfaces
 *
 * Defines the core abstractions for message channels (Telegram, Discord, Feishu, etc.)
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Supported channel types
 */
export type ChannelType = "telegram" | "discord" | "whatsapp" | "feishu";

/**
 * Base configuration for all channels
 */
export interface ChannelConfig {
  /** Unique identifier for this channel instance */
  id: string;
  /** Type of the channel */
  type: ChannelType;
  /** Whether this channel is enabled */
  enabled: boolean;
  /** Authentication token (encrypted in storage) */
  token?: string;
  /** Allowlist of user IDs (empty = allow all) */
  allowFrom?: string[];
  /** Proxy configuration (HTTP/SOCKS5) */
  proxy?: string;
  /** Additional type-specific configuration */
  [key: string]: unknown;
}

/**
 * Media attachment in a message
 */
export interface MediaAttachment {
  /** Type of media */
  type: "image" | "audio" | "video" | "file";
  /** URL or file path to the media */
  url: string;
  /** Original filename */
  filename?: string;
  /** MIME type */
  mimeType?: string;
  /** File size in bytes */
  size?: number;
}

/**
 * Inbound message from a channel
 */
export interface InboundMessage {
  /** Channel instance ID */
  channel: string;
  /** Type of the channel */
  channelType: ChannelType;
  /** Sender's user ID in the platform */
  senderId: string;
  /** Sender's display name */
  senderName?: string;
  /** Chat/conversation ID (1:1 or group) */
  chatId: string;
  /** Message text content */
  content: string;
  /** Attached media files */
  media?: MediaAttachment[];
  /** ID of the message being replied to */
  replyTo?: string;
  /** Original message ID from the platform */
  messageId?: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Raw message data from the platform */
  raw?: unknown;
}

/**
 * Outbound message to send via a channel
 */
export interface OutboundMessage {
  /** Target chat/conversation ID */
  chatId: string;
  /** Message text content */
  content: string;
  /** ID of the message to reply to */
  replyTo?: string;
  /** Media attachments to send */
  media?: MediaAttachment[];
  /** Platform-specific options */
  options?: Record<string, unknown>;
}

/**
 * Channel connection status
 */
export interface ChannelStatus {
  /** Whether the channel is connected */
  connected: boolean;
  /** Platform identifier (e.g., @botname for Telegram) */
  identifier?: string;
  /** Last error message */
  lastError?: string;
  /** Timestamp of last received message */
  lastMessageAt?: number;
  /** Additional status info */
  extra?: Record<string, unknown>;
}

// ============================================================================
// Channel Interface
// ============================================================================

/**
 * Channel interface - defines the contract for all channel implementations
 */
export interface Channel {
  /** Unique identifier for this channel instance */
  readonly id: string;
  /** Type of the channel */
  readonly type: ChannelType;
  /** Channel configuration */
  readonly config: ChannelConfig;

  // Lifecycle methods
  /**
   * Connect to the channel
   * @throws Error if connection fails
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the channel
   */
  disconnect(): Promise<void>;

  /**
   * Check if the channel is connected
   */
  isConnected(): boolean;

  // Message handling
  /**
   * Register a callback for incoming messages
   * @param callback - Function to call when a message is received
   */
  onMessage(callback: (msg: InboundMessage) => void): void;

  /**
   * Send a message to the channel
   * @param msg - Message to send
   * @throws Error if sending fails
   */
  sendMessage(msg: OutboundMessage): Promise<void>;

  // Status
  /**
   * Get the current channel status
   */
  getStatus(): ChannelStatus;
}

// ============================================================================
// Abstract Base Class
// ============================================================================

/**
 * Abstract base class for channel implementations
 * Provides common functionality and structure
 */
export abstract class BaseChannel implements Channel {
  abstract readonly id: string;
  abstract readonly type: ChannelType;
  abstract readonly config: ChannelConfig;

  protected messageCallback?: (msg: InboundMessage) => void;
  protected connected = false;
  protected lastError?: string;
  protected lastMessageAt?: number;

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract sendMessage(msg: OutboundMessage): Promise<void>;

  isConnected(): boolean {
    return this.connected;
  }

  onMessage(callback: (msg: InboundMessage) => void): void {
    this.messageCallback = callback;
  }

  getStatus(): ChannelStatus {
    return {
      connected: this.connected,
      lastError: this.lastError,
      lastMessageAt: this.lastMessageAt,
    };
  }

  /**
   * Check if a user is allowed based on the allowFrom list
   * @param userId - User ID to check
   * @returns true if allowed, false otherwise
   */
  protected isAllowed(userId?: string): boolean {
    // If no allowlist, allow everyone
    if (!this.config.allowFrom?.length) return true;
    // If allowlist exists, check if user is in it
    return userId ? this.config.allowFrom.includes(userId) : false;
  }

  /**
   * Emit a message to the callback
   * @param msg - Message to emit
   */
  protected emitMessage(msg: InboundMessage): void {
    this.lastMessageAt = Date.now();
    this.messageCallback?.(msg);
  }

  /**
   * Log an error and store it
   * @param error - Error to log
   * @param context - Additional context
   */
  protected handleError(error: unknown, context?: string): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    this.lastError = errorMessage;
    const prefix = `[${this.type} ${this.id}]`;
    console.error(`${prefix}${context ? ` ${context}:` : ""} ${errorMessage}`);
  }
}
