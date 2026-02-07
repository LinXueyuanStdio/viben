/**
 * Channel Manager
 *
 * Manages multiple channel instances, handling initialization,
 * connection, disconnection, and message routing.
 */

import type {
  Channel,
  ChannelConfig,
  ChannelStatus,
  ChannelType,
  InboundMessage,
  OutboundMessage,
} from "./base.js";
import {
  loadConfig,
  saveConfig,
  getConfigPath,
  type ChannelsConfigFile,
} from "./config.js";
import { TelegramChannel, type TelegramConfig } from "./telegram.js";
import { DiscordChannel, type DiscordConfig } from "./discord.js";
import { FeishuChannel, type FeishuConfig } from "./feishu.js";

// ============================================================================
// Types
// ============================================================================

export interface ChannelManagerOptions {
  /** Path to configuration file */
  configPath?: string;
  /** Auto-connect on initialization */
  autoConnect?: boolean;
}

export interface ChannelManagerStatus {
  /** Number of configured channels */
  totalChannels: number;
  /** Number of enabled channels */
  enabledChannels: number;
  /** Number of connected channels */
  connectedChannels: number;
  /** Default channel ID */
  defaultChannel?: string;
  /** Status of each channel */
  channels: Record<string, ChannelStatus>;
}

// ============================================================================
// Channel Manager
// ============================================================================

export class ChannelManager {
  private channels: Map<string, Channel> = new Map();
  private config: ChannelsConfigFile;
  private configPath: string;
  private messageCallback?: (msg: InboundMessage) => void;
  private errorCallback?: (channelId: string, error: Error) => void;

  constructor(options: ChannelManagerOptions = {}) {
    this.configPath = options.configPath ?? getConfigPath();
    this.config = loadConfig(this.configPath);
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize all enabled channels
   * Creates channel instances but does not connect them
   */
  async initialize(): Promise<void> {
    for (const [id, channelConfig] of Object.entries(this.config.channels)) {
      if (!channelConfig.enabled) continue;

      try {
        const channel = this.createChannel(id, channelConfig);
        this.channels.set(id, channel);

        // Set up message callback
        channel.onMessage((msg) => {
          this.messageCallback?.(msg);
        });
      } catch (error) {
        console.error(`Failed to initialize channel ${id}:`, error);
      }
    }
  }

  /**
   * Create a channel instance based on configuration
   */
  private createChannel(id: string, config: ChannelConfig): Channel {
    switch (config.type) {
      case "telegram":
        return new TelegramChannel(id, config as TelegramConfig);
      case "discord":
        return new DiscordChannel(id, config as DiscordConfig);
      case "feishu":
        return new FeishuChannel(id, config as FeishuConfig);
      case "whatsapp":
        throw new Error("WhatsApp channel not yet implemented");
      default:
        throw new Error(`Unknown channel type: ${config.type}`);
    }
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Connect all initialized channels
   */
  async connectAll(): Promise<Map<string, Error>> {
    const errors = new Map<string, Error>();
    const promises = Array.from(this.channels.entries()).map(
      async ([id, channel]) => {
        try {
          await channel.connect();
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          errors.set(id, err);
          this.errorCallback?.(id, err);
        }
      }
    );
    await Promise.allSettled(promises);
    return errors;
  }

  /**
   * Disconnect all channels
   */
  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.channels.values()).map((channel) =>
      channel.disconnect().catch((error) => {
        console.error(`Error disconnecting channel ${channel.id}:`, error);
      })
    );
    await Promise.allSettled(promises);
  }

  /**
   * Connect a specific channel
   */
  async connect(channelId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }
    await channel.connect();
  }

  /**
   * Disconnect a specific channel
   */
  async disconnect(channelId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }
    await channel.disconnect();
  }

  // ============================================================================
  // Messaging
  // ============================================================================

  /**
   * Send a message to a specific channel
   */
  async sendMessage(channelId: string, msg: OutboundMessage): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }
    if (!channel.isConnected()) {
      throw new Error(`Channel ${channelId} is not connected`);
    }
    await channel.sendMessage(msg);
  }

  /**
   * Send a message to the default channel
   */
  async sendToDefault(msg: OutboundMessage): Promise<void> {
    const defaultId = this.config.default;
    if (!defaultId) {
      throw new Error("No default channel configured");
    }
    await this.sendMessage(defaultId, msg);
  }

  /**
   * Broadcast a message to all connected channels
   */
  async broadcast(
    msg: Omit<OutboundMessage, "chatId">,
    getChatId: (channelId: string) => string | undefined
  ): Promise<Map<string, Error>> {
    const errors = new Map<string, Error>();
    const promises = Array.from(this.channels.entries())
      .filter(([_, channel]) => channel.isConnected())
      .map(async ([id, channel]) => {
        const chatId = getChatId(id);
        if (!chatId) return;

        try {
          await channel.sendMessage({ ...msg, chatId });
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          errors.set(id, err);
        }
      });
    await Promise.allSettled(promises);
    return errors;
  }

  // ============================================================================
  // Callbacks
  // ============================================================================

  /**
   * Register a callback for incoming messages from all channels
   */
  onMessage(callback: (msg: InboundMessage) => void): void {
    this.messageCallback = callback;
    // Also set for existing channels
    for (const channel of this.channels.values()) {
      channel.onMessage(callback);
    }
  }

  /**
   * Register a callback for channel errors
   */
  onError(callback: (channelId: string, error: Error) => void): void {
    this.errorCallback = callback;
  }

  // ============================================================================
  // Status and Information
  // ============================================================================

  /**
   * Get the status of all channels
   */
  getStatus(): ChannelManagerStatus {
    const statuses: Record<string, ChannelStatus> = {};
    let connectedCount = 0;

    for (const [id, channel] of this.channels) {
      const status = channel.getStatus();
      statuses[id] = status;
      if (status.connected) connectedCount++;
    }

    return {
      totalChannels: Object.keys(this.config.channels).length,
      enabledChannels: this.channels.size,
      connectedChannels: connectedCount,
      defaultChannel: this.config.default,
      channels: statuses,
    };
  }

  /**
   * Get a specific channel instance
   */
  getChannel(channelId: string): Channel | undefined {
    return this.channels.get(channelId);
  }

  /**
   * Get all channel instances
   */
  getAllChannels(): Map<string, Channel> {
    return new Map(this.channels);
  }

  /**
   * Get channel IDs by type
   */
  getChannelsByType(type: ChannelType): string[] {
    return Array.from(this.channels.entries())
      .filter(([_, channel]) => channel.type === type)
      .map(([id]) => id);
  }

  /**
   * Check if a channel exists
   */
  hasChannel(channelId: string): boolean {
    return this.channels.has(channelId);
  }

  // ============================================================================
  // Configuration Management
  // ============================================================================

  /**
   * Add a new channel configuration
   */
  addChannel(id: string, config: ChannelConfig): void {
    this.config.channels[id] = config;
    this.saveConfig();

    // If enabled, create and initialize the channel
    if (config.enabled) {
      const channel = this.createChannel(id, config);
      this.channels.set(id, channel);
      if (this.messageCallback) {
        channel.onMessage(this.messageCallback);
      }
    }
  }

  /**
   * Remove a channel
   */
  async removeChannel(channelId: string): Promise<void> {
    // Disconnect if connected
    const channel = this.channels.get(channelId);
    if (channel?.isConnected()) {
      await channel.disconnect();
    }

    // Remove from manager
    this.channels.delete(channelId);

    // Remove from config
    delete this.config.channels[channelId];
    if (this.config.default === channelId) {
      this.config.default = undefined;
    }
    this.saveConfig();
  }

  /**
   * Enable a channel
   */
  async enableChannel(channelId: string): Promise<void> {
    const config = this.config.channels[channelId];
    if (!config) {
      throw new Error(`Channel ${channelId} not found in configuration`);
    }

    config.enabled = true;
    this.saveConfig();

    // Create and initialize if not already
    if (!this.channels.has(channelId)) {
      const channel = this.createChannel(channelId, config);
      this.channels.set(channelId, channel);
      if (this.messageCallback) {
        channel.onMessage(this.messageCallback);
      }
    }
  }

  /**
   * Disable a channel
   */
  async disableChannel(channelId: string): Promise<void> {
    const config = this.config.channels[channelId];
    if (!config) {
      throw new Error(`Channel ${channelId} not found in configuration`);
    }

    // Disconnect if connected
    const channel = this.channels.get(channelId);
    if (channel?.isConnected()) {
      await channel.disconnect();
    }

    // Remove from active channels
    this.channels.delete(channelId);

    config.enabled = false;
    this.saveConfig();
  }

  /**
   * Set the default channel
   */
  setDefaultChannel(channelId: string): void {
    if (!this.config.channels[channelId]) {
      throw new Error(`Channel ${channelId} not found in configuration`);
    }
    this.config.default = channelId;
    this.saveConfig();
  }

  /**
   * Update channel configuration
   */
  async updateChannelConfig(
    channelId: string,
    updates: Partial<ChannelConfig>
  ): Promise<void> {
    const config = this.config.channels[channelId];
    if (!config) {
      throw new Error(`Channel ${channelId} not found in configuration`);
    }

    // Apply updates
    Object.assign(config, updates);
    this.saveConfig();

    // If enabled and connected, reconnect to apply changes
    const channel = this.channels.get(channelId);
    if (channel?.isConnected()) {
      await channel.disconnect();
      // Recreate channel with new config
      const newChannel = this.createChannel(channelId, config);
      this.channels.set(channelId, newChannel);
      if (this.messageCallback) {
        newChannel.onMessage(this.messageCallback);
      }
      await newChannel.connect();
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): ChannelsConfigFile {
    return this.config;
  }

  /**
   * Reload configuration from file
   */
  reloadConfig(): void {
    this.config = loadConfig(this.configPath);
  }

  /**
   * Save configuration to file
   */
  private saveConfig(): void {
    saveConfig(this.config, this.configPath);
  }
}
