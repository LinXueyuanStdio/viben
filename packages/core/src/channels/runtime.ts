/**
 * Channel Runtime Manager
 *
 * Manages the lifecycle of channel pollers (start/stop).
 * Starts enabled channels when the gateway starts.
 */

import type { MessageBus } from "../services/message-bus";
import type { ChannelManager } from "./manager";
import type { Channel, TelegramChannelConfig } from "./types";
import { TelegramPoller } from "./polling/telegram-poller";

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
  autoStart?: boolean;
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
  private autoStart: boolean;
  private pollingTimeout: number;

  /** Active pollers by channel ID */
  private pollers: Map<string, ChannelPoller> = new Map();
  private running = false;

  constructor(config: ChannelRuntimeConfig) {
    this.channelManager = config.channelManager;
    this.messageBus = config.messageBus;
    this.autoStart = config.autoStart ?? true;
    this.pollingTimeout = config.pollingTimeout ?? 30;
  }

  /**
   * Start the channel runtime
   *
   * If autoStart is true, starts all enabled channels with agent bindings.
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log("[ChannelRuntime] Already running");
      return;
    }

    console.log("[ChannelRuntime] Starting...");
    this.running = true;

    if (this.autoStart) {
      await this.startEnabledChannels();
    }

    console.log("[ChannelRuntime] Started");
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

    console.log("[ChannelRuntime] Stopping...");
    this.running = false;

    // Stop all pollers in parallel
    const stopPromises: Promise<void>[] = [];
    for (const [channelId, poller] of this.pollers) {
      console.log(`[ChannelRuntime] Stopping poller for ${channelId}`);
      stopPromises.push(poller.stop());
    }

    await Promise.all(stopPromises);
    this.pollers.clear();

    console.log("[ChannelRuntime] Stopped");
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
      console.log(`[ChannelRuntime] Channel ${channelId} already has active poller`);
      return;
    }

    await this.channelManager.load();
    const channel = await this.channelManager.getChannel(channelId);

    if (!channel) {
      console.error(`[ChannelRuntime] Channel not found: ${channelId}`);
      return;
    }

    const poller = this.createPoller(channel);
    if (!poller) {
      console.warn(`[ChannelRuntime] No poller available for channel type: ${channel.type}`);
      return;
    }

    try {
      await poller.start();
      this.pollers.set(channelId, poller);
      console.log(`[ChannelRuntime] Started poller for ${channel.name} (${channel.type})`);
    } catch (error) {
      console.error(`[ChannelRuntime] Failed to start poller for ${channelId}:`, error);
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
      console.log("[ChannelRuntime] No enabled channels with agent bindings to start");
      return;
    }

    console.log(
      `[ChannelRuntime] Starting ${eligibleChannels.length} channel(s) with agent bindings...`
    );

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

      // TODO: Add more channel types
      // case "discord":
      //   return new DiscordPoller({ ... });

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
}

/**
 * Create a channel runtime instance
 */
export function createChannelRuntime(config: ChannelRuntimeConfig): ChannelRuntime {
  return new ChannelRuntime(config);
}
