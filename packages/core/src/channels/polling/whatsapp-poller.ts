/**
 * WhatsApp Bridge WebSocket Client
 *
 * Connects to a Node.js bridge that handles WhatsApp Web protocol.
 * The bridge uses @whiskeysockets/baileys for WhatsApp Web.
 *
 * Communication is via WebSocket between this client and the bridge.
 */

import type { MessageBus, InboundMessage } from "../../services/message-bus";
import type { Channel, WhatsAppChannelConfig } from "../types";
import WebSocketImpl from "ws";
import { logger as globalLogger } from "../../telemetry";

// Module-level logger
const log = globalLogger.child({ module: "whatsapp-poller" });

/**
 * WhatsApp poller configuration
 */
export interface WhatsAppPollerConfig {
  /** Channel configuration */
  channel: Channel;
  /** WhatsApp-specific config */
  whatsappConfig: WhatsAppChannelConfig;
  /** Message bus for publishing inbound messages */
  messageBus: MessageBus;
  /** Reconnect delay in milliseconds (default: 5000) */
  reconnectDelayMs?: number;
}

/**
 * Bridge message types
 */
interface BridgeMessage {
  type: "message" | "status" | "qr" | "error";
  // For message type
  sender?: string;
  content?: string;
  id?: string;
  timestamp?: number;
  isGroup?: boolean;
  // For status type
  status?: string;
  // For error type
  error?: string;
}

/**
 * WhatsApp Bridge WebSocket Client
 *
 * Connects to a Node.js bridge that handles the WhatsApp Web protocol.
 * The bridge must be running separately and expose a WebSocket endpoint.
 */
export class WhatsAppPoller {
  private channel: Channel;
  private config: WhatsAppChannelConfig;
  private messageBus: MessageBus;
  private reconnectDelayMs: number;

  private running = false;
  private ws: WebSocket | null = null;
  private connected = false;

  constructor(config: WhatsAppPollerConfig) {
    this.channel = config.channel;
    this.config = config.whatsappConfig;
    this.messageBus = config.messageBus;
    this.reconnectDelayMs = config.reconnectDelayMs ?? 5000;
  }

  /**
   * Start the WhatsApp bridge connection
   */
  async start(): Promise<void> {
    if (this.running) {
      log.debug({ channelName: this.channel.name }, "Already running");
      return;
    }

    const bridgeUrl = this.config.bridge_url;
    if (!bridgeUrl) {
      log.error({ channelName: this.channel.name }, "bridge_url not configured");
      return;
    }

    log.info({ channelName: this.channel.name }, "Starting...");
    log.info({ bridgeUrl }, "Connecting to bridge");
    this.running = true;

    // Start connection loop
    await this.connectionLoop();
  }

  /**
   * Stop the WhatsApp bridge connection
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    log.info({ channelName: this.channel.name }, "Stopping...");
    this.running = false;
    this.connected = false;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.messageBus.updateConnectionStatus("whatsapp", this.channel.name, false);
    log.info({ channelName: this.channel.name }, "Stopped");
  }

  /**
   * Check if the poller is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get channel info
   */
  getChannel(): Channel {
    return this.channel;
  }

  /**
   * Main connection loop with auto-reconnect
   */
  private async connectionLoop(): Promise<void> {
    while (this.running) {
      try {
        await this.connectToBridge();
      } catch (error) {
        this.connected = false;
        this.ws = null;
        log.error({ err: error }, "Bridge connection error");
      }

      if (this.running) {
        log.info({ delaySeconds: this.reconnectDelayMs / 1000 }, "Reconnecting...");
        await this.sleep(this.reconnectDelayMs);
      }
    }
  }

  /**
   * Connect to WhatsApp bridge
   */
  private async connectToBridge(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocketImpl(this.config.bridge_url) as unknown as WebSocket;

        this.ws.onopen = () => {
          log.info("Connected to WhatsApp bridge");
          this.connected = true;
          this.messageBus.updateConnectionStatus("whatsapp", this.channel.name, true);
        };

        this.ws.onclose = () => {
          log.info("Bridge connection closed");
          this.connected = false;
          this.messageBus.updateConnectionStatus("whatsapp", this.channel.name, false);
          resolve();
        };

        this.ws.onerror = (error) => {
          log.error({ err: error }, "Bridge WebSocket error");
          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleBridgeMessage(event.data as string).catch((err) => {
            log.error({ err }, "Error handling message");
          });
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle message from bridge
   */
  private async handleBridgeMessage(raw: string): Promise<void> {
    let data: BridgeMessage;
    try {
      data = JSON.parse(raw);
    } catch {
      log.warn("Invalid JSON from bridge");
      return;
    }

    switch (data.type) {
      case "message":
        await this.handleIncomingMessage(data);
        break;

      case "status":
        this.handleStatus(data);
        break;

      case "qr":
        log.info("Scan QR code in the bridge terminal to connect WhatsApp");
        break;

      case "error":
        log.error({ bridgeError: data.error }, "Bridge error");
        break;
    }
  }

  /**
   * Handle incoming WhatsApp message
   */
  private async handleIncomingMessage(data: BridgeMessage): Promise<void> {
    const sender = data.sender || "";
    let content = data.content || "";

    if (!sender) return;

    // sender is typically: <phone>@s.whatsapp.net
    // Extract phone number as sender ID
    const senderId = sender.includes("@") ? sender.split("@")[0] : sender;

    // Check allow_from
    if (!this.isAllowed(senderId)) {
      log.debug({ senderId }, "Message blocked by allow_from");
      return;
    }

    // Handle voice messages
    if (content === "[Voice Message]") {
      content = "[Voice Message: Transcription not available]";
    }

    const inbound: InboundMessage = {
      channelType: "whatsapp",
      channelName: this.channel.name,
      chatId: sender, // Use full JID for replies
      senderId,
      senderName: senderId,
      message: content,
      timestamp: data.timestamp || Date.now(),
      metadata: {
        message_id: data.id,
        is_group: data.isGroup,
      },
    };

    const msgPreview = content.length > 50 ? `${content.slice(0, 50)}...` : content;
    log.info({ senderId, messagePreview: msgPreview }, "Message received");

    await this.messageBus.publishInbound(inbound);
  }

  /**
   * Handle status update from bridge
   */
  private handleStatus(data: BridgeMessage): void {
    const status = data.status;
    log.info({ status }, "WhatsApp status");

    if (status === "connected") {
      this.connected = true;
      this.messageBus.updateConnectionStatus("whatsapp", this.channel.name, true);
    } else if (status === "disconnected") {
      this.connected = false;
      this.messageBus.updateConnectionStatus("whatsapp", this.channel.name, false);
    }
  }

  /**
   * Check if sender is allowed
   */
  private isAllowed(senderId: string): boolean {
    const allowFrom = this.channel.allow_from || [];
    if (allowFrom.length === 0) {
      return true;
    }
    return allowFrom.includes(senderId);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
