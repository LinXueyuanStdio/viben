/**
 * Channel Manager
 *
 * Provides CRUD operations for channel configurations with YAML persistence.
 * Config path: ~/.viben/channels.yaml
 */
import { join } from "node:path";
import { homedir } from "node:os";
import { NotFoundError, AlreadyExistsError, ValidationError } from "../error";
import { readYaml, writeYaml } from "../config/yaml";
import { testTelegramChannel } from "./telegram";
import { testDiscordChannel } from "./discord";
import { testFeishuChannel } from "./feishu";
import { testWhatsAppChannel } from "./whatsapp";
import type {
  ChannelType,
  ChannelEntry,
  ChannelsFile,
  Channel,
  ChannelStatus,
  ConnectionStatus,
  CreateChannelOptions,
  UpdateChannelOptions,
  TelegramChannelConfig,
  DiscordChannelConfig,
  FeishuChannelConfig,
  WhatsAppChannelConfig,
  SlackChannelConfig,
  WebhookChannelConfig,
  ChannelConfig,
  NotificationMode,
  CHANNEL_TYPES,
} from "./types";
import { CHANNEL_TYPES as channelTypes } from "./types";

/**
 * Default channels file structure
 */
const DEFAULT_CHANNELS_FILE: ChannelsFile = {
  version: 1,
  channels: {},
};

/**
 * Get the default channels config path
 */
export function getChannelsPath(): string {
  return join(homedir(), ".viben", "channels.yaml");
}

/**
 * Channel Manager for CRUD operations on channels
 */
export class ChannelManager {
  private configPath: string;
  private config: ChannelsFile | null = null;

  constructor(configPath?: string) {
    this.configPath = configPath || getChannelsPath();
  }

  /**
   * Load channels configuration from file
   */
  async load(): Promise<void> {
    const loaded = await readYaml<ChannelsFile>(this.configPath);
    // Deep copy to avoid sharing state between instances
    this.config = loaded || { version: 1, channels: {} };
  }

  /**
   * Ensure config is loaded
   */
  private async ensureLoaded(): Promise<ChannelsFile> {
    if (!this.config) {
      await this.load();
    }
    return this.config!;
  }

  /**
   * Save channels configuration to file
   */
  private async save(): Promise<void> {
    if (this.config) {
      await writeYaml(this.configPath, this.config);
    }
  }

  /**
   * Get all supported channel types
   */
  getChannelTypes(): typeof channelTypes {
    return channelTypes;
  }

  /**
   * List all configured channels
   */
  async listChannels(): Promise<Channel[]> {
    const config = await this.ensureLoaded();
    const channels: Channel[] = [];

    for (const [id, entry] of Object.entries(config.channels)) {
      channels.push(this.entryToChannel(id, entry, config.default));
    }

    return channels;
  }

  /**
   * Get a channel by ID
   */
  async getChannel(id: string): Promise<Channel | undefined> {
    const config = await this.ensureLoaded();
    const entry = config.channels[id];
    if (!entry) {
      return undefined;
    }
    return this.entryToChannel(id, entry, config.default);
  }

  /**
   * Get the default channel
   */
  async getDefaultChannel(): Promise<Channel | undefined> {
    const config = await this.ensureLoaded();
    if (!config.default) {
      return undefined;
    }
    return this.getChannel(config.default);
  }

  /**
   * Create a new channel
   */
  async createChannel(options: CreateChannelOptions): Promise<Channel> {
    const config = await this.ensureLoaded();

    // Generate ID from name if not provided
    const id =
      options.id ||
      options.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

    if (!id) {
      throw new ValidationError("Channel ID cannot be empty", "id");
    }

    // Check if already exists
    if (config.channels[id]) {
      throw new AlreadyExistsError("Channel", id);
    }

    // Validate type-specific required fields
    this.validateChannelConfig(options.type, options);

    const now = Date.now();

    // Build channel entry
    const entry: ChannelEntry = {
      type: options.type,
      name: options.name,
      enabled: options.enabled ?? true,
      created_at: now,
      updated_at: now,
      allow_from: options.allow_from || [],
      notification_mode: options.notification_mode || "none",
    };

    // Add type-specific fields
    this.applyTypeSpecificFields(entry, options);

    // Store the entry
    config.channels[id] = entry;

    // Set as default if requested or if first channel
    if (options.set_as_default || !config.default) {
      config.default = id;
    }

    // Save config
    await this.save();

    return this.entryToChannel(id, entry, config.default);
  }

  /**
   * Update an existing channel
   */
  async updateChannel(id: string, options: UpdateChannelOptions): Promise<Channel> {
    const config = await this.ensureLoaded();

    const entry = config.channels[id];
    if (!entry) {
      throw new NotFoundError("Channel", id);
    }

    // Apply updates
    if (options.name !== undefined) {
      entry.name = options.name;
    }
    if (options.enabled !== undefined) {
      entry.enabled = options.enabled;
    }
    if (options.allow_from !== undefined) {
      entry.allow_from = options.allow_from;
    }
    if (options.notification_mode !== undefined) {
      entry.notification_mode = options.notification_mode;
    }

    // Apply type-specific updates
    this.applyTypeSpecificFields(entry, options);

    entry.updated_at = Date.now();

    // Handle set_as_default
    if (options.set_as_default) {
      config.default = id;
    }

    // Save config
    await this.save();

    return this.entryToChannel(id, entry, config.default);
  }

  /**
   * Remove a channel
   */
  async removeChannel(id: string): Promise<void> {
    const config = await this.ensureLoaded();

    if (!config.channels[id]) {
      throw new NotFoundError("Channel", id);
    }

    // Remove the channel
    delete config.channels[id];

    // Update default if needed
    if (config.default === id) {
      const remainingIds = Object.keys(config.channels);
      config.default = remainingIds.length > 0 ? remainingIds[0] : undefined;
    }

    // Save config
    await this.save();
  }

  /**
   * Enable a channel
   */
  async enableChannel(id: string): Promise<Channel> {
    return this.updateChannel(id, { enabled: true });
  }

  /**
   * Disable a channel
   */
  async disableChannel(id: string): Promise<Channel> {
    return this.updateChannel(id, { enabled: false });
  }

  /**
   * Set the default channel
   */
  async setDefaultChannel(id: string): Promise<Channel> {
    const config = await this.ensureLoaded();

    if (!config.channels[id]) {
      throw new NotFoundError("Channel", id);
    }

    config.default = id;

    // Save config
    await this.save();

    return this.entryToChannel(id, config.channels[id], config.default);
  }

  /**
   * Update a specific config key for a channel
   */
  async updateChannelConfig(id: string, key: string, value: unknown): Promise<Channel> {
    const config = await this.ensureLoaded();

    const entry = config.channels[id];
    if (!entry) {
      throw new NotFoundError("Channel", id);
    }

    // Validate key is a valid config field
    const validKeys = [
      "token",
      "proxy",
      "gateway_url",
      "intents",
      "app_id",
      "app_secret",
      "encrypt_key",
      "verification_token",
      "bridge_url",
      "channel_id",
      "url",
      "method",
      "headers",
      "allow_from",
      "notification_mode",
    ];

    if (!validKeys.includes(key)) {
      throw new ValidationError(`Invalid config key: ${key}`, key);
    }

    // Update the specific field
    (entry as unknown as Record<string, unknown>)[key] = value;
    entry.updated_at = Date.now();

    // Save config
    await this.save();

    return this.entryToChannel(id, entry, config.default);
  }

  /**
   * Get the connection status of a channel
   */
  async getChannelStatus(id: string): Promise<ChannelStatus> {
    const config = await this.ensureLoaded();

    const entry = config.channels[id];
    if (!entry) {
      throw new NotFoundError("Channel", id);
    }

    const baseStatus: ChannelStatus = {
      id,
      type: entry.type,
      name: entry.name,
      enabled: entry.enabled,
      is_default: config.default === id,
      status: "disconnected",
      checked_at: Date.now(),
    };

    // If disabled, return disabled status
    if (!entry.enabled) {
      baseStatus.status = "disabled";
      return baseStatus;
    }

    // Test the channel connection
    const startTime = Date.now();
    const testResult = await this.testChannelConnection(entry);
    const latency = Date.now() - startTime;

    if (testResult.success) {
      baseStatus.status = "connected";
      baseStatus.details = testResult.details;
      baseStatus.latency_ms = latency;
    } else {
      baseStatus.status = "error";
      baseStatus.error = testResult.error;
    }

    return baseStatus;
  }

  /**
   * Get status for all channels
   */
  async getAllChannelStatuses(): Promise<ChannelStatus[]> {
    const config = await this.ensureLoaded();
    const statuses: ChannelStatus[] = [];

    for (const id of Object.keys(config.channels)) {
      const status = await this.getChannelStatus(id);
      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Test a channel connection based on its type
   */
  private async testChannelConnection(
    entry: ChannelEntry
  ): Promise<{ success: boolean; error?: string; details?: string }> {
    switch (entry.type) {
      case "telegram": {
        if (!entry.token) {
          return { success: false, error: "Bot token is required" };
        }
        const telegramConfig: TelegramChannelConfig = {
          id: "",
          name: entry.name,
          type: "telegram",
          enabled: entry.enabled,
          created_at: entry.created_at,
          allow_from: entry.allow_from || [],
          token: entry.token,
          proxy: entry.proxy,
        };
        return testTelegramChannel(telegramConfig);
      }

      case "discord": {
        if (!entry.token) {
          return { success: false, error: "Bot token is required" };
        }
        const discordConfig: DiscordChannelConfig = {
          id: "",
          name: entry.name,
          type: "discord",
          enabled: entry.enabled,
          created_at: entry.created_at,
          allow_from: entry.allow_from || [],
          token: entry.token,
          gateway_url: entry.gateway_url,
          intents: entry.intents,
        };
        return testDiscordChannel(discordConfig);
      }

      case "feishu": {
        if (!entry.app_id || !entry.app_secret) {
          return { success: false, error: "App ID and App Secret are required" };
        }
        const feishuConfig: FeishuChannelConfig = {
          id: "",
          name: entry.name,
          type: "feishu",
          enabled: entry.enabled,
          created_at: entry.created_at,
          allow_from: entry.allow_from || [],
          app_id: entry.app_id,
          app_secret: entry.app_secret,
          encrypt_key: entry.encrypt_key,
          verification_token: entry.verification_token,
        };
        return testFeishuChannel(feishuConfig);
      }

      case "whatsapp": {
        if (!entry.bridge_url) {
          return { success: false, error: "Bridge URL is required" };
        }
        const whatsappConfig: WhatsAppChannelConfig = {
          id: "",
          name: entry.name,
          type: "whatsapp",
          enabled: entry.enabled,
          created_at: entry.created_at,
          allow_from: entry.allow_from || [],
          bridge_url: entry.bridge_url,
        };
        return testWhatsAppChannel(whatsappConfig);
      }

      case "slack": {
        if (!entry.token) {
          return { success: false, error: "Bot token is required" };
        }
        // Test Slack connection by calling auth.test
        try {
          const response = await fetch("https://slack.com/api/auth.test", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${entry.token}`,
              "Content-Type": "application/json",
            },
          });
          const data = (await response.json()) as { ok: boolean; error?: string; user?: string };
          if (data.ok) {
            return { success: true, details: `User: ${data.user}` };
          }
          return { success: false, error: data.error || "Unknown error" };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }

      case "webhook": {
        if (!entry.url) {
          return { success: false, error: "Webhook URL is required" };
        }
        // For webhooks, we just validate the URL format
        try {
          new URL(entry.url);
          return { success: true, details: `URL: ${entry.url}` };
        } catch {
          return { success: false, error: "Invalid webhook URL" };
        }
      }

      default:
        return { success: false, error: `Unknown channel type: ${entry.type}` };
    }
  }

  /**
   * Validate type-specific required fields
   */
  private validateChannelConfig(type: ChannelType, options: CreateChannelOptions): void {
    switch (type) {
      case "telegram":
        if (!options.token) {
          throw new ValidationError("Token is required for Telegram channels", "token");
        }
        break;
      case "discord":
        if (!options.token) {
          throw new ValidationError("Token is required for Discord channels", "token");
        }
        break;
      case "feishu":
        if (!options.app_id || !options.app_secret) {
          throw new ValidationError(
            "App ID and App Secret are required for Feishu channels",
            "app_id"
          );
        }
        break;
      case "whatsapp":
        if (!options.bridge_url) {
          throw new ValidationError(
            "Bridge URL is required for WhatsApp channels",
            "bridge_url"
          );
        }
        break;
      case "slack":
        if (!options.token) {
          throw new ValidationError("Token is required for Slack channels", "token");
        }
        break;
      case "webhook":
        if (!options.url) {
          throw new ValidationError("URL is required for Webhook channels", "url");
        }
        break;
    }
  }

  /**
   * Apply type-specific fields to entry
   */
  private applyTypeSpecificFields(
    entry: ChannelEntry,
    options: CreateChannelOptions | UpdateChannelOptions
  ): void {
    // Common optional fields
    if ("token" in options && options.token !== undefined) {
      entry.token = options.token;
    }
    if ("proxy" in options && options.proxy !== undefined) {
      entry.proxy = options.proxy;
    }
    if ("gateway_url" in options && options.gateway_url !== undefined) {
      entry.gateway_url = options.gateway_url;
    }
    if ("intents" in options && options.intents !== undefined) {
      entry.intents = options.intents;
    }
    if ("app_id" in options && options.app_id !== undefined) {
      entry.app_id = options.app_id;
    }
    if ("app_secret" in options && options.app_secret !== undefined) {
      entry.app_secret = options.app_secret;
    }
    if ("encrypt_key" in options && options.encrypt_key !== undefined) {
      entry.encrypt_key = options.encrypt_key;
    }
    if ("verification_token" in options && options.verification_token !== undefined) {
      entry.verification_token = options.verification_token;
    }
    if ("bridge_url" in options && options.bridge_url !== undefined) {
      entry.bridge_url = options.bridge_url;
    }
    if ("channel_id" in options && options.channel_id !== undefined) {
      entry.channel_id = options.channel_id;
    }
    if ("url" in options && options.url !== undefined) {
      entry.url = options.url;
    }
    if ("method" in options && options.method !== undefined) {
      entry.method = options.method;
    }
    if ("headers" in options && options.headers !== undefined) {
      entry.headers = options.headers;
    }
  }

  /**
   * Convert ChannelEntry to Channel
   */
  private entryToChannel(
    id: string,
    entry: ChannelEntry,
    defaultId?: string
  ): Channel {
    // Extract config fields (everything except base fields)
    const {
      type,
      name,
      enabled,
      created_at,
      updated_at,
      allow_from,
      notification_mode,
      ...config
    } = entry;

    return {
      id,
      type,
      name,
      enabled,
      is_default: defaultId === id,
      created_at,
      updated_at,
      allow_from: allow_from || [],
      notification_mode: notification_mode || "none",
      config,
    };
  }

  /**
   * Build a typed ChannelConfig from an entry
   */
  buildChannelConfig(id: string, entry: ChannelEntry): ChannelConfig {
    const baseConfig = {
      id,
      name: entry.name,
      enabled: entry.enabled,
      created_at: entry.created_at,
      allow_from: entry.allow_from || [],
    };

    switch (entry.type) {
      case "telegram":
        return {
          ...baseConfig,
          type: "telegram" as const,
          token: entry.token || "",
          proxy: entry.proxy,
        };
      case "discord":
        return {
          ...baseConfig,
          type: "discord" as const,
          token: entry.token || "",
          gateway_url: entry.gateway_url,
          intents: entry.intents,
        };
      case "feishu":
        return {
          ...baseConfig,
          type: "feishu" as const,
          app_id: entry.app_id || "",
          app_secret: entry.app_secret || "",
          encrypt_key: entry.encrypt_key,
          verification_token: entry.verification_token,
        };
      case "whatsapp":
        return {
          ...baseConfig,
          type: "whatsapp" as const,
          bridge_url: entry.bridge_url || "",
        };
      case "slack":
        return {
          ...baseConfig,
          type: "slack" as const,
          token: entry.token || "",
          channel_id: entry.channel_id,
        };
      case "webhook":
        return {
          ...baseConfig,
          type: "webhook" as const,
          url: entry.url || "",
          method: entry.method as "POST" | "PUT" | undefined,
          headers: entry.headers,
        };
    }
  }
}

/**
 * Singleton instance
 */
export const channelManager = new ChannelManager();
