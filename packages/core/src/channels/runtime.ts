/**
 * Channel Runtime Manager
 *
 * Manages the lifecycle of channel pollers (start/stop).
 * Starts enabled channels when the gateway starts.
 */

import type { MessageBus } from "../services/message-bus";
import type { ChannelManager } from "./manager";
import type {
  Channel,
  TelegramChannelConfig,
  DiscordChannelConfig,
  FeishuChannelConfig,
  WhatsAppChannelConfig,
} from "./types";
import { TelegramPoller } from "./polling/telegram-poller";
import { DiscordPoller } from "./polling/discord-poller";
import { FeishuPoller } from "./polling/feishu-poller";
import { WhatsAppPoller } from "./polling/whatsapp-poller";
import { logger as globalLogger } from "../telemetry";

// Module-level logger
const log = globalLogger.child({ module: "channel-runtime" });

/**
 * Base interface for channel pollers
 */
export interface ChannelPoller {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  getChannel(): Channel;
}

/**
 * Channel runtime configuration
 */
export interface ChannelRuntimeConfig {
  /** Channel manager for accessing channel configurations */
  channelManager: ChannelManager;
  /** Message bus for publishing inbound messages */
  messageBus: MessageBus;
  /** Whether to auto-start enabled channels (default: true) */
  auto_start?: boolean;
  /** Polling timeout in seconds (default: 30) */
  pollingTimeout?: number;
}

/**
 * Channel Runtime Manager
 *
 * Coordinates all channel pollers, starting and stopping them as needed.
 */
export class ChannelRuntime {
  private channelManager: ChannelManager;
  private messageBus: MessageBus;
  private auto_start: boolean;
  private pollingTimeout: number;

  /** Active pollers by channel ID */
  private pollers: Map<string, ChannelPoller> = new Map();
  private running = false;

  constructor(config: ChannelRuntimeConfig) {
    this.channelManager = config.channelManager;
    this.messageBus = config.messageBus;
    this.auto_start = config.auto_start ?? true;
    this.pollingTimeout = config.pollingTimeout ?? 30;
  }

  /**
   * Start the channel runtime
   *
   * If auto_start is true, starts all enabled channels with agent bindings.
   */
  async start(): Promise<void> {
    if (this.running) {
      log.debug("Already running");
      return;
    }

    log.info("Starting...");
    this.running = true;

    if (this.auto_start) {
      await this.startEnabledChannels();
    }

    log.info("Started");
  }

  /**
   * Stop the channel runtime
   *
   * Stops all running pollers gracefully.
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    log.info("Stopping...");
    this.running = false;

    // Stop all pollers in parallel
    const stopPromises: Promise<void>[] = [];
    for (const [channelId, poller] of this.pollers) {
      log.debug({ channelId }, "Stopping poller");
      stopPromises.push(poller.stop());
    }

    await Promise.all(stopPromises);
    this.pollers.clear();

    log.info("Stopped");
  }

  /**
   * Check if runtime is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get all active pollers
   */
  getActivePollers(): ChannelPoller[] {
    return Array.from(this.pollers.values());
  }

  /**
   * Start polling for a specific channel
   *
   * @param channelId - Channel ID to start polling for
   */
  async startChannel(channelId: string): Promise<void> {
    if (this.pollers.has(channelId)) {
      log.debug({ channelId }, "Channel already has active poller");
      return;
    }

    await this.channelManager.load();
    const channel = await this.channelManager.getChannel(channelId);

    if (!channel) {
      log.error({ channelId }, "Channel not found");
      return;
    }

    const poller = this.createPoller(channel);
    if (!poller) {
      log.warn({ channelId, channelType: channel.type }, "No poller available for channel type");
      return;
    }

    try {
      await poller.start();
      this.pollers.set(channelId, poller);
      log.info({ channelName: channel.name, channelType: channel.type }, "Started poller");
    } catch (error) {
      log.error({ err: error, channelId }, "Failed to start poller");
    }
  }

  /**
   * Stop polling for a specific channel
   *
   * @param channelId - Channel ID to stop polling for
   */
  async stopChannel(channelId: string): Promise<void> {
    const poller = this.pollers.get(channelId);
    if (!poller) {
      return;
    }

    try {
      await poller.stop();
    } finally {
      this.pollers.delete(channelId);
    }
  }

  /**
   * Restart polling for a specific channel
   *
   * Useful when channel configuration changes.
   */
  async restartChannel(channelId: string): Promise<void> {
    await this.stopChannel(channelId);
    await this.startChannel(channelId);
  }

  /**
   * Start all enabled channels that have agent bindings
   */
  private async startEnabledChannels(): Promise<void> {
    await this.channelManager.load();
    const channels = await this.channelManager.listChannels();

    const eligibleChannels = channels.filter(
      (ch) => ch.enabled && ch.agent_binding
    );

    if (eligibleChannels.length === 0) {
      log.debug("No enabled channels with agent bindings to start");
      return;
    }

    log.info({ count: eligibleChannels.length }, "Starting channels with agent bindings...");

    // Start all eligible channels in parallel
    const startPromises = eligibleChannels.map((channel) =>
      this.startChannel(channel.id)
    );

    await Promise.all(startPromises);
  }

  /**
   * Create a poller for a channel based on its type
   */
  private createPoller(channel: Channel): ChannelPoller | undefined {
    switch (channel.type) {
      case "telegram":
        return new TelegramPoller({
          channel,
          telegramConfig: this.buildTelegramConfig(channel),
          messageBus: this.messageBus,
          pollingTimeout: this.pollingTimeout,
        });

      case "discord":
        return new DiscordPoller({
          channel,
          discordConfig: this.buildDiscordConfig(channel),
          messageBus: this.messageBus,
        });

      case "feishu":
        return new FeishuPoller({
          channel,
          feishuConfig: this.buildFeishuConfig(channel),
          messageBus: this.messageBus,
        });

      case "whatsapp":
        return new WhatsAppPoller({
          channel,
          whatsappConfig: this.buildWhatsAppConfig(channel),
          messageBus: this.messageBus,
        });

      default:
        return undefined;
    }
  }

  /**
   * Build Telegram-specific config from channel
   */
  private buildTelegramConfig(channel: Channel): TelegramChannelConfig {
    return {
      id: channel.id,
      type: "telegram",
      name: channel.name,
      enabled: channel.enabled,
      created_at: channel.created_at,
      allow_from: channel.allow_from,
      token: (channel.config as { token?: string }).token || "",
      proxy: (channel.config as { proxy?: string }).proxy,
    };
  }

  /**
   * Build Discord-specific config from channel
   */
  private buildDiscordConfig(channel: Channel): DiscordChannelConfig {
    const config = channel.config as {
      token?: string;
      gateway_url?: string;
      intents?: number;
    };
    return {
      id: channel.id,
      type: "discord",
      name: channel.name,
      enabled: channel.enabled,
      created_at: channel.created_at,
      allow_from: channel.allow_from,
      token: config.token || "",
      gateway_url: config.gateway_url,
      intents: config.intents,
    };
  }

  /**
   * Build Feishu-specific config from channel
   */
  private buildFeishuConfig(channel: Channel): FeishuChannelConfig {
    const config = channel.config as {
      app_id?: string;
      app_secret?: string;
      encrypt_key?: string;
      verification_token?: string;
    };
    return {
      id: channel.id,
      type: "feishu",
      name: channel.name,
      enabled: channel.enabled,
      created_at: channel.created_at,
      allow_from: channel.allow_from,
      app_id: config.app_id || "",
      app_secret: config.app_secret || "",
      encrypt_key: config.encrypt_key,
      verification_token: config.verification_token,
    };
  }

  /**
   * Build WhatsApp-specific config from channel
   */
  private buildWhatsAppConfig(channel: Channel): WhatsAppChannelConfig {
    const config = channel.config as { bridge_url?: string };
    return {
      id: channel.id,
      type: "whatsapp",
      name: channel.name,
      enabled: channel.enabled,
      created_at: channel.created_at,
      allow_from: channel.allow_from,
      bridge_url: config.bridge_url || "",
    };
  }
}

/**
 * Create a channel runtime instance
 */
export function createChannelRuntime(config: ChannelRuntimeConfig): ChannelRuntime {
  return new ChannelRuntime(config);
}
