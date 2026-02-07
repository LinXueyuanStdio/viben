/**
 * Base channel implementation for Viben CLI
 *
 * Abstract base class for chat channel implementations.
 */

import type {
  Channel,
  ChannelConfig,
  ChannelStatus,
  ChannelType,
  InboundMessage,
  OutboundMessage,
} from './types';

/**
 * Abstract base class for channel implementations
 */
export abstract class BaseChannel implements Channel {
  readonly id: string;
  abstract readonly type: ChannelType;
  readonly config: ChannelConfig;

  protected messageCallback?: (msg: InboundMessage) => void;
  protected _connected = false;
  protected _lastError?: string;
  protected _lastMessageAt?: number;

  constructor(id: string, config: ChannelConfig) {
    this.id = id;
    this.config = config;
  }

  /**
   * Connect to the channel
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from the channel
   */
  abstract disconnect(): Promise<void>;

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this._connected;
  }

  /**
   * Register message callback
   */
  onMessage(callback: (msg: InboundMessage) => void): void {
    this.messageCallback = callback;
  }

  /**
   * Send a message through the channel
   */
  abstract sendMessage(msg: OutboundMessage): Promise<void>;

  /**
   * Get channel status
   */
  abstract getStatus(): ChannelStatus;

  /**
   * Check if a sender is allowed based on whitelist
   */
  protected isAllowed(senderId?: string): boolean {
    const allowList = this.config.allowFrom;

    // If no allow list, allow everyone
    if (!allowList || allowList.length === 0) {
      return true;
    }

    if (!senderId) {
      return false;
    }

    const senderStr = String(senderId);
    if (allowList.includes(senderStr)) {
      return true;
    }

    // Support compound IDs like "123456|username"
    if (senderStr.includes('|')) {
      for (const part of senderStr.split('|')) {
        if (part && allowList.includes(part)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Handle an incoming message
   */
  protected handleInboundMessage(msg: InboundMessage): void {
    // Check whitelist
    if (!this.isAllowed(msg.senderId)) {
      console.warn(
        `[${this.type} ${this.id}] Access denied for sender ${msg.senderId}. ` +
        `Add them to allowFrom list to grant access.`
      );
      return;
    }

    this._lastMessageAt = Date.now();
    this.messageCallback?.(msg);
  }

  /**
   * Log an error and store it
   */
  protected logError(message: string, error?: unknown): void {
    const errorMsg = error instanceof Error ? error.message : String(error || message);
    this._lastError = errorMsg;
    console.error(`[${this.type} ${this.id}] ${message}:`, errorMsg);
  }

  /**
   * Log info
   */
  protected logInfo(message: string): void {
    console.log(`[${this.type} ${this.id}] ${message}`);
  }
}
