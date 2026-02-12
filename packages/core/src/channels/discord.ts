/**
 * Discord Channel Client
 *
 * Sends messages via Discord Bot API
 */

import type {
  DiscordChannelConfig,
  SendMessageOptions,
  SendMessageResult,
  TestChannelResult,
} from "./types";
import { fetchWithProxy } from "./http-client";

const DISCORD_API_BASE = "https://discord.com/api/v10";

/**
 * Send a message to a Discord channel
 */
export async function sendDiscordMessage(
  config: DiscordChannelConfig,
  options: SendMessageOptions
): Promise<SendMessageResult> {
  if (!config.token) {
    return { success: false, error: "Bot token is required" };
  }

  if (!options.chatId) {
    return { success: false, error: "Channel ID is required" };
  }

  try {
    const response = await fetchWithProxy(
      `${DISCORD_API_BASE}/channels/${options.chatId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: options.message,
        }),
      }
    );

    const data = (await response.json()) as {
      id?: string;
      message?: string;
    };

    if (!response.ok) {
      return {
        success: false,
        error: data.message || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      messageId: data.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test Discord channel configuration by calling /users/@me
 */
export async function testDiscordChannel(
  config: DiscordChannelConfig
): Promise<TestChannelResult> {
  if (!config.token) {
    return { success: false, error: "Bot token is required" };
  }

  try {
    const response = await fetchWithProxy(`${DISCORD_API_BASE}/users/@me`, {
      method: "GET",
      headers: {
        Authorization: `Bot ${config.token}`,
      },
    });

    const data = (await response.json()) as {
      username?: string;
      discriminator?: string;
      message?: string;
    };

    if (!response.ok) {
      return {
        success: false,
        error: data.message || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      details: `Bot: ${data.username}#${data.discriminator}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
