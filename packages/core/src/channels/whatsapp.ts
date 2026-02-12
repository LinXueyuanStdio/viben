/**
 * WhatsApp Channel Client
 *
 * Sends messages via WhatsApp Web Bridge
 */

import type {
  WhatsAppChannelConfig,
  SendMessageOptions,
  SendMessageResult,
  TestChannelResult,
} from "./types";
import { fetchWithProxy } from "./http-client";

/**
 * Send a message via WhatsApp Bridge
 *
 * Note: This requires a running WhatsApp Web bridge server
 */
export async function sendWhatsAppMessage(
  config: WhatsAppChannelConfig,
  options: SendMessageOptions
): Promise<SendMessageResult> {
  if (!config.bridge_url) {
    return { success: false, error: "Bridge URL is required" };
  }

  if (!options.chatId) {
    return { success: false, error: "Phone number is required" };
  }

  // WhatsApp Bridge communication is typically via WebSocket
  // This is a simplified HTTP fallback for bridges that support it
  try {
    // Convert bridge WebSocket URL to HTTP if needed
    let httpUrl = config.bridge_url;
    if (httpUrl.startsWith("ws://")) {
      httpUrl = httpUrl.replace("ws://", "http://");
    } else if (httpUrl.startsWith("wss://")) {
      httpUrl = httpUrl.replace("wss://", "https://");
    }

    const response = await fetchWithProxy(`${httpUrl}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone: options.chatId.replace(/[^0-9]/g, ""),
        message: options.message,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: text || `HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as { messageId?: string };
    return {
      success: true,
      messageId: data.messageId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test WhatsApp channel configuration by checking bridge connectivity
 */
export async function testWhatsAppChannel(
  config: WhatsAppChannelConfig
): Promise<TestChannelResult> {
  if (!config.bridge_url) {
    return { success: false, error: "Bridge URL is required" };
  }

  // Test WebSocket connection to bridge
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(config.bridge_url);
      const timeout = setTimeout(() => {
        ws.close();
        resolve({ success: false, error: "Connection timeout (5s)" });
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve({
          success: true,
          details: "Successfully connected to bridge",
        });
      };

      ws.onerror = (event) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: "Failed to connect to bridge",
        });
      };
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : "Invalid bridge URL",
      });
    }
  });
}
