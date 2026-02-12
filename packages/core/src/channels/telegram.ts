/**
 * Telegram Channel Client
 *
 * Sends messages via Telegram Bot API
 */

import type {
  TelegramChannelConfig,
  SendMessageOptions,
  SendMessageResult,
  TestChannelResult,
} from "./types";
import { fetchWithProxy } from "./http-client";

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
