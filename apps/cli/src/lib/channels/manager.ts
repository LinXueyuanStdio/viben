/**
 * Channel Manager for Viben CLI
 *
 * Manages multiple chat channels, routing messages between them.
 */

import type {
  Channel,
  ChannelConfig,
  ChannelStatus,
  ChannelType,
  ChannelsConfig,
  InboundMessage,
  OutboundMessage,
} from './types';
import { readChannelsConfig } from './config';
import { TelegramChannel } from './telegram';
import { DiscordChannel } from './discord';
import { FeishuChannel } from './feishu';

/**
 * Channel Manager
 *
 * Coordinates multiple chat channels:
 * - Initialize enabled channels
 * - Route messages between channels
 * - Manage channel lifecycle
 */
export class ChannelManager {
  private channels: Map<string, Channel> = new Map();
  private config: ChannelsConfig;
  private messageCallback?: (msg: InboundMessage) => void;

  constructor(config?: ChannelsConfig) {
    this.config = config || readChannelsConfig();
  }

  /**
   * Initialize all enabled channels
   */
  async initialize(): Promise<void> {
    for (const [id, channelConfig] of Object.entries(this.config.channels)) {
      if (!channelConfig.enabled) {
        continue;
      }

      try {
        const channel = this.createChannel(id, channelConfig);
        this.channels.set(id, channel);

        // Set up message callback
        channel.onMessage((msg) => {
          this.messageCallback?.(msg);
        });
      } catch (error) {
        console.error(`[ChannelManager] Failed to create channel ${id}:`, error);
      }
    }
  }

  /**
   * Connect all channels
   */
  async connectAll(): Promise<void> {
    const promises = Array.from(this.channels.values()).map(async (channel) => {
      try {
        await channel.connect();
      } catch (error) {
        console.error(
          `[ChannelManager] Failed to connect channel ${channel.id}:`,
          error
        );
      }
    });
    await Promise.allSettled(promises);
  }

  /**
   * Disconnect all channels
   */
  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.channels.values()).map(async (channel) => {
      try {
        await channel.disconnect();
      } catch (error) {
        console.error(
          `[ChannelManager] Error disconnecting channel ${channel.id}:`,
          error
        );
      }
    });
    await Promise.allSettled(promises);
  }

  /**
   * Send a message to a specific channel
   */
  async sendMessage(channelId: string, msg: OutboundMessage): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }
    await channel.sendMessage(msg);
  }

  /**
   * Register a callback for incoming messages
   */
  onMessage(callback: (msg: InboundMessage) => void): void {
    this.messageCallback = callback;
  }

  /**
   * Get all channel statuses
   */
  getStatuses(): Record<string, ChannelStatus & { type: ChannelType; enabled: boolean }> {
    const statuses: Record<string, ChannelStatus & { type: ChannelType; enabled: boolean }> = {};

    // Include all configured channels
    for (const [id, config] of Object.entries(this.config.channels)) {
      const channel = this.channels.get(id);
      if (channel) {
        statuses[id] = {
          ...channel.getStatus(),
          type: config.type as ChannelType,
          enabled: config.enabled,
        };
      } else {
        statuses[id] = {
          connected: false,
          type: config.type as ChannelType,
          enabled: config.enabled,
        };
      }
    }

    return statuses;
  }

  /**
   * Get a specific channel
   */
  getChannel(channelId: string): Channel | undefined {
    return this.channels.get(channelId);
  }

  /**
   * Get all channel IDs
   */
  getChannelIds(): string[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Get enabled channel names
   */
  get enabledChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Create a channel instance based on type
   */
  private createChannel(id: string, config: ChannelConfig): Channel {
    switch (config.type) {
      case 'telegram':
        return new TelegramChannel(id, config as TelegramConfig);
      case 'discord':
        return new DiscordChannel(id, config as DiscordConfig);
      case 'feishu':
        return new FeishuChannel(id, config as FeishuConfig);
      case 'whatsapp':
        throw new Error('WhatsApp channel is not yet implemented');
      default:
        throw new Error(`Unknown channel type: ${config.type}`);
    }
  }
}

// Import type aliases for better type checking
import type { TelegramConfig, DiscordConfig, FeishuConfig } from './types';
