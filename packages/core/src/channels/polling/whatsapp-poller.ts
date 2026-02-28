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
      console.log(`[WhatsAppPoller] ${this.channel.name} already running`);
      return;
    }

    const bridgeUrl = this.config.bridge_url;
    if (!bridgeUrl) {
      console.error(`[WhatsAppPoller] bridge_url not configured for ${this.channel.name}`);
      return;
    }

    console.log(`[WhatsAppPoller] Starting ${this.channel.name}...`);
    console.log(`[WhatsAppPoller] Connecting to bridge at ${bridgeUrl}`);
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

    console.log(`[WhatsAppPoller] Stopping ${this.channel.name}...`);
    this.running = false;
    this.connected = false;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.messageBus.updateConnectionStatus("whatsapp", this.channel.name, false);
    console.log(`[WhatsAppPoller] ${this.channel.name} stopped`);
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
        console.error(`[WhatsAppPoller] Bridge connection error:`, error);
      }

      if (this.running) {
        console.log(`[WhatsAppPoller] Reconnecting in ${this.reconnectDelayMs / 1000}s...`);
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
        const WebSocketImpl = require("ws") as typeof WebSocket;
        this.ws = new WebSocketImpl(this.config.bridge_url) as unknown as WebSocket;

        this.ws.onopen = () => {
          console.log(`[WhatsAppPoller] Connected to WhatsApp bridge`);
          this.connected = true;
          this.messageBus.updateConnectionStatus("whatsapp", this.channel.name, true);
        };

        this.ws.onclose = () => {
          console.log(`[WhatsAppPoller] Bridge connection closed`);
          this.connected = false;
          this.messageBus.updateConnectionStatus("whatsapp", this.channel.name, false);
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error(`[WhatsAppPoller] Bridge WebSocket error:`, error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleBridgeMessage(event.data as string).catch((err) => {
            console.error(`[WhatsAppPoller] Error handling message:`, err);
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
      console.warn(`[WhatsAppPoller] Invalid JSON from bridge`);
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
        console.log(`[WhatsAppPoller] Scan QR code in the bridge terminal to connect WhatsApp`);
        break;

      case "error":
        console.error(`[WhatsAppPoller] Bridge error: ${data.error}`);
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
      console.log(`[WhatsAppPoller] Message from ${senderId} blocked by allow_from`);
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
    console.log(`[WhatsAppPoller] Message from ${senderId}: ${msgPreview}`);

    await this.messageBus.publishInbound(inbound);
  }

  /**
   * Handle status update from bridge
   */
  private handleStatus(data: BridgeMessage): void {
    const status = data.status;
    console.log(`[WhatsAppPoller] WhatsApp status: ${status}`);

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
