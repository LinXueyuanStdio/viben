/**
 * Channels Module
 *
 * Unified interface for sending messages through various channels
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
    default:
      return { success: false, error: `Unknown channel type: ${(config as ChannelConfig).type}` };
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
    default:
      return { success: false, error: `Unknown channel type: ${(config as ChannelConfig).type}` };
  }
}

/**
 * Send a test message to verify channel configuration
 */
export async function sendTestMessage(
  config: ChannelConfig,
  chatId: string
): Promise<SendMessageResult> {
  const testMessage = `🔔 Viben Test Message

This is a test message from Viben.
Time: ${new Date().toLocaleString()}

If you received this message, your channel is configured correctly!`;

  return sendChannelMessage(config, {
    chatId,
    message: testMessage,
  });
}
