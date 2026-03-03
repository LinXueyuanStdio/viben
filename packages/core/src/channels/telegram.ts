/**
 * Telegram Channel Client
 *
 * Sends and receives messages via Telegram Bot API
 */

import type {
  TelegramChannelConfig,
  SendMessageOptions,
  SendMessageResult,
  TestChannelResult,
} from "./types";
import { fetchWithProxy } from "./http-client";

/**
 * Telegram Update object from getUpdates API
 */
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
}

/**
 * Telegram Message object
 */
export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  voice?: TelegramAudio;
  audio?: TelegramAudio;
  document?: TelegramDocument;
}

/**
 * Telegram User object
 */
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Telegram Chat object
 */
export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Telegram PhotoSize object
 */
export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

/**
 * Telegram Audio/Voice object
 */
export interface TelegramAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

/**
 * Telegram Document object
 */
export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

/**
 * Options for getUpdates API
 */
export interface GetUpdatesOptions {
  /** Offset to start fetching from (last update_id + 1) */
  offset?: number;
  /** Long polling timeout in seconds (0-50, default 30) */
  timeout?: number;
  /** Maximum number of updates to fetch (1-100, default 100) */
  limit?: number;
  /** Types of updates to receive */
  allowedUpdates?: string[];
}

/**
 * Result of getUpdates API
 */
export interface GetUpdatesResult {
  success: boolean;
  updates?: TelegramUpdate[];
  error?: string;
}

/**
 * Get the Telegram API base URL (with optional proxy)
 */
function getApiUrl(config: TelegramChannelConfig): string {
  if (config.proxy) {
    // When using proxy, route through proxy server
    return `${config.proxy}/bot${config.token}`;
  }
  return `https://api.telegram.org/bot${config.token}`;
}

/**
 * Send a message to a Telegram chat
 */
export async function sendTelegramMessage(
  config: TelegramChannelConfig,
  options: SendMessageOptions
): Promise<SendMessageResult> {
  if (!config.token) {
    return { success: false, error: "Bot token is required" };
  }

  if (!options.chatId) {
    return { success: false, error: "Chat ID is required" };
  }

  try {
    const apiUrl = getApiUrl(config);

    // Determine parse_mode
    let parseMode: string | undefined;
    if (options.parseMode === "markdown") {
      parseMode = "Markdown";
    } else if (options.parseMode === "html") {
      parseMode = "HTML";
    }

    const body: Record<string, unknown> = {
      chat_id: options.chatId,
      text: options.message,
    };

    if (parseMode) {
      body.parse_mode = parseMode;
    }

    const response = await fetchWithProxy(`${apiUrl}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as {
      ok: boolean;
      description?: string;
      result?: { message_id?: number };
    };

    if (!response.ok || !data.ok) {
      return {
        success: false,
        error: data.description || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      messageId: data.result?.message_id?.toString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test Telegram channel configuration by calling getMe
 */
export async function testTelegramChannel(
  config: TelegramChannelConfig
): Promise<TestChannelResult> {
  if (!config.token) {
    return { success: false, error: "Bot token is required" };
  }

  try {
    const apiUrl = getApiUrl(config);

    const response = await fetchWithProxy(`${apiUrl}/getMe`, {
      method: "GET",
    });

    const data = (await response.json()) as {
      ok: boolean;
      description?: string;
      result?: { username?: string; first_name?: string };
    };

    if (!response.ok || !data.ok) {
      return {
        success: false,
        error: data.description || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      details: `Bot: @${data.result?.username} (${data.result?.first_name})`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get updates from Telegram using long polling
 *
 * @param config - Telegram channel configuration
 * @param options - GetUpdates options
 * @returns Updates result
 */
export async function getTelegramUpdates(
  config: TelegramChannelConfig,
  options: GetUpdatesOptions = {}
): Promise<GetUpdatesResult> {
  if (!config.token) {
    return { success: false, error: "Bot token is required" };
  }

  const {
    offset,
    timeout = 30,
    limit = 100,
    allowedUpdates = ["message"],
  } = options;

  try {
    const apiUrl = getApiUrl(config);

    // Build query parameters
    const params = new URLSearchParams();
    if (offset !== undefined) {
      params.append("offset", offset.toString());
    }
    params.append("timeout", timeout.toString());
    params.append("limit", limit.toString());

    // Telegram expects allowed_updates as JSON array
    if (allowedUpdates.length > 0) {
      params.append("allowed_updates", JSON.stringify(allowedUpdates));
    }

    const response = await fetchWithProxy(`${apiUrl}/getUpdates?${params}`, {
      method: "GET",
    });

    const data = (await response.json()) as {
      ok: boolean;
      description?: string;
      result?: TelegramUpdate[];
    };

    if (!response.ok || !data.ok) {
      return {
        success: false,
        error: data.description || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      updates: data.result || [],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete webhook and enable getUpdates mode
 *
 * Must be called before using getUpdates if a webhook was previously set.
 *
 * @param config - Telegram channel configuration
 * @param dropPending - Whether to drop all pending updates
 */
export async function deleteTelegramWebhook(
  config: TelegramChannelConfig,
  dropPending = true
): Promise<TestChannelResult> {
  if (!config.token) {
    return { success: false, error: "Bot token is required" };
  }

  try {
    const apiUrl = getApiUrl(config);

    const params = new URLSearchParams();
    params.append("drop_pending_updates", dropPending.toString());

    const response = await fetchWithProxy(`${apiUrl}/deleteWebhook?${params}`, {
      method: "GET",
    });

    const data = (await response.json()) as {
      ok: boolean;
      description?: string;
    };

    if (!response.ok || !data.ok) {
      return {
        success: false,
        error: data.description || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      details: dropPending ? "Webhook deleted, pending updates dropped" : "Webhook deleted",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
