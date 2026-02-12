/**
 * Slack channel implementation
 *
 * Supports sending messages via Slack Web API.
 */

import type { SlackChannelConfig, SendMessageOptions, SendMessageResult, TestChannelResult } from "./types";
import { fetchWithProxy } from "./http-client";

/**
 * Slack API response types
 */
interface SlackAuthTestResponse {
  ok: boolean;
  error?: string;
  user?: string;
  team?: string;
  team_id?: string;
}

interface SlackPostMessageResponse {
  ok: boolean;
  error?: string;
  ts?: string;
  channel?: string;
}

/**
 * Send a message via Slack Web API
 */
export async function sendSlackMessage(
  config: SlackChannelConfig,
  options: SendMessageOptions
): Promise<SendMessageResult> {
  if (!config.token) {
    return { success: false, error: "Bot token is required" };
  }

  try {
    const response = await fetchWithProxy("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: options.chatId,
        text: options.message,
        // Support markdown formatting
        mrkdwn: options.parseMode === "markdown",
      }),
    });

    const data = (await response.json()) as SlackPostMessageResponse;

    if (data.ok) {
      return {
        success: true,
        messageId: data.ts,
      };
    }

    return {
      success: false,
      error: data.error || "Unknown error",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test Slack channel configuration
 */
export async function testSlackChannel(
  config: SlackChannelConfig
): Promise<TestChannelResult> {
  if (!config.token) {
    return { success: false, error: "Bot token is required" };
  }

  try {
    const response = await fetchWithProxy("https://slack.com/api/auth.test", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
    });

    const data = (await response.json()) as SlackAuthTestResponse;

    if (data.ok) {
      const details = [
        data.user && `User: ${data.user}`,
        data.team && `Team: ${data.team}`,
      ]
        .filter(Boolean)
        .join(", ");

      return {
        success: true,
        details: details || "Connection successful",
      };
    }

    return {
      success: false,
      error: data.error || "Unknown error",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get Slack channel info
 */
export async function getSlackChannelInfo(
  config: SlackChannelConfig,
  channelId: string
): Promise<{ name?: string; error?: string }> {
  if (!config.token) {
    return { error: "Bot token is required" };
  }

  try {
    const response = await fetchWithProxy(
      `https://slack.com/api/conversations.info?channel=${encodeURIComponent(channelId)}`,
      {
        headers: {
          Authorization: `Bearer ${config.token}`,
        },
      }
    );

    const data = (await response.json()) as {
      ok: boolean;
      error?: string;
      channel?: { name: string };
    };

    if (data.ok && data.channel) {
      return { name: data.channel.name };
    }

    return { error: data.error || "Unknown error" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * List Slack channels
 */
export async function listSlackChannels(
  config: SlackChannelConfig
): Promise<{ channels?: Array<{ id: string; name: string }>; error?: string }> {
  if (!config.token) {
    return { error: "Bot token is required" };
  }

  try {
    const response = await fetchWithProxy(
      "https://slack.com/api/conversations.list?types=public_channel,private_channel",
      {
        headers: {
          Authorization: `Bearer ${config.token}`,
        },
      }
    );

    const data = (await response.json()) as {
      ok: boolean;
      error?: string;
      channels?: Array<{ id: string; name: string }>;
    };

    if (data.ok && data.channels) {
      return {
        channels: data.channels.map((c) => ({
          id: c.id,
          name: c.name,
        })),
      };
    }

    return { error: data.error || "Unknown error" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
