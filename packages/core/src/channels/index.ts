/**
 * Channels Module
 *
 * Unified interface for sending messages through various channels
 * and managing channel configurations.
 */

export * from "./types";

import type {
  ChannelConfig,
  SendMessageOptions,
  SendMessageResult,
  TestChannelResult,
} from "./types";

import { sendTelegramMessage, testTelegramChannel } from "./telegram";
import { sendDiscordMessage, testDiscordChannel } from "./discord";
import { sendFeishuMessage, testFeishuChannel } from "./feishu";
import { sendWhatsAppMessage, testWhatsAppChannel } from "./whatsapp";

// Re-export individual channel functions
export { sendTelegramMessage, testTelegramChannel } from "./telegram";
export { sendDiscordMessage, testDiscordChannel } from "./discord";
export { sendFeishuMessage, testFeishuChannel } from "./feishu";
export { sendWhatsAppMessage, testWhatsAppChannel } from "./whatsapp";

// Re-export channel manager
export { ChannelManager, channelManager, getChannelsPath } from "./manager";

/**
 * Send a message through any channel type
 */
export async function sendChannelMessage(
  config: ChannelConfig,
  options: SendMessageOptions
): Promise<SendMessageResult> {
  switch (config.type) {
    case "telegram":
      return sendTelegramMessage(config, options);
    case "discord":
      return sendDiscordMessage(config, options);
    case "feishu":
      return sendFeishuMessage(config, options);
    case "whatsapp":
      return sendWhatsAppMessage(config, options);
    case "slack":
      // Slack message sending
      if (!config.token) {
        return { success: false, error: "Bot token is required" };
      }
      try {
        const response = await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channel: options.chatId,
            text: options.message,
          }),
        });
        const data = (await response.json()) as {
          ok: boolean;
          error?: string;
          ts?: string;
        };
        if (data.ok) {
          return { success: true, messageId: data.ts };
        }
        return { success: false, error: data.error || "Unknown error" };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    case "webhook":
      // Webhook message sending
      if (!config.url) {
        return { success: false, error: "Webhook URL is required" };
      }
      try {
        const method = config.method || "POST";
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...config.headers,
        };
        const response = await fetch(config.url, {
          method,
          headers,
          body: JSON.stringify({
            chatId: options.chatId,
            message: options.message,
          }),
        });
        if (response.ok) {
          return { success: true };
        }
        return { success: false, error: `HTTP ${response.status}` };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    default:
      return {
        success: false,
        error: `Unknown channel type: ${(config as ChannelConfig).type}`,
      };
  }
}

/**
 * Test a channel configuration
 */
export async function testChannel(
  config: ChannelConfig
): Promise<TestChannelResult> {
  switch (config.type) {
    case "telegram":
      return testTelegramChannel(config);
    case "discord":
      return testDiscordChannel(config);
    case "feishu":
      return testFeishuChannel(config);
    case "whatsapp":
      return testWhatsAppChannel(config);
    case "slack":
      // Slack channel test
      if (!config.token) {
        return { success: false, error: "Bot token is required" };
      }
      try {
        const response = await fetch("https://slack.com/api/auth.test", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
          },
        });
        const data = (await response.json()) as {
          ok: boolean;
          error?: string;
          user?: string;
        };
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
    case "webhook":
      // Webhook validation
      if (!config.url) {
        return { success: false, error: "Webhook URL is required" };
      }
      try {
        new URL(config.url);
        return { success: true, details: `URL: ${config.url}` };
      } catch {
        return { success: false, error: "Invalid webhook URL" };
      }
    default:
      return {
        success: false,
        error: `Unknown channel type: ${(config as ChannelConfig).type}`,
      };
  }
}

/**
 * Send a test message to verify channel configuration
 */
export async function sendTestMessage(
  config: ChannelConfig,
  chatId: string
): Promise<SendMessageResult> {
  const testMessage = `Viben Test Message

This is a test message from Viben.
Time: ${new Date().toLocaleString()}

If you received this message, your channel is configured correctly!`;

  return sendChannelMessage(config, {
    chatId,
    message: testMessage,
  });
}
