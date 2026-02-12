/**
 * Webhook channel implementation
 *
 * Supports sending messages via generic HTTP webhooks.
 */

import type { WebhookChannelConfig, SendMessageOptions, SendMessageResult, TestChannelResult } from "./types";
import { fetchWithProxy } from "./http-client";

/**
 * Send a message via webhook
 */
export async function sendWebhookMessage(
  config: WebhookChannelConfig,
  options: SendMessageOptions
): Promise<SendMessageResult> {
  if (!config.url) {
    return { success: false, error: "Webhook URL is required" };
  }

  try {
    const method = config.method || "POST";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...config.headers,
    };

    // Build payload
    const payload: Record<string, unknown> = {
      chat_id: options.chatId,
      message: options.message,
      timestamp: Date.now(),
    };

    // Include parse mode if specified
    if (options.parseMode) {
      payload.parse_mode = options.parseMode;
    }

    const response = await fetchWithProxy(config.url, {
      method,
      headers,
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      // Try to extract message ID from response
      let messageId: string | undefined;
      try {
        const data = (await response.json()) as { id?: string; message_id?: string };
        messageId = data.id || data.message_id;
      } catch {
        // Response might not be JSON
      }

      return {
        success: true,
        messageId,
      };
    }

    // Try to get error message from response
    let errorMessage = `HTTP ${response.status}`;
    try {
      const data = (await response.json()) as { error?: string; message?: string };
      errorMessage = data.error || data.message || errorMessage;
    } catch {
      // Response might not be JSON
    }

    return {
      success: false,
      error: errorMessage,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test webhook configuration
 *
 * Note: This only validates the URL format, not the actual endpoint.
 * To test the endpoint, use sendWebhookTestMessage.
 */
export async function testWebhookChannel(
  config: WebhookChannelConfig
): Promise<TestChannelResult> {
  if (!config.url) {
    return { success: false, error: "Webhook URL is required" };
  }

  // Validate URL format
  try {
    const url = new URL(config.url);

    // Check protocol
    if (!["http:", "https:"].includes(url.protocol)) {
      return {
        success: false,
        error: `Invalid protocol: ${url.protocol}. Must be http or https.`,
      };
    }

    return {
      success: true,
      details: `URL: ${config.url}, Method: ${config.method || "POST"}`,
    };
  } catch {
    return {
      success: false,
      error: "Invalid webhook URL format",
    };
  }
}

/**
 * Test webhook by sending a test request
 *
 * Sends a test message to verify the webhook endpoint is reachable.
 */
export async function testWebhookEndpoint(
  config: WebhookChannelConfig
): Promise<TestChannelResult> {
  if (!config.url) {
    return { success: false, error: "Webhook URL is required" };
  }

  try {
    const method = config.method || "POST";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...config.headers,
    };

    const testPayload = {
      type: "test",
      message: "Viben webhook test",
      timestamp: Date.now(),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetchWithProxy(config.url, {
        method,
        headers,
        body: JSON.stringify(testPayload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        return {
          success: true,
          details: `Endpoint responded with HTTP ${response.status}`,
        };
      }

      return {
        success: false,
        error: `Endpoint returned HTTP ${response.status}`,
      };
    } catch (fetchError) {
      clearTimeout(timeout);
      throw fetchError;
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        error: "Request timeout after 10 seconds",
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Incoming webhook message structure
 *
 * This defines the expected structure for messages received via webhook.
 */
export interface IncomingWebhookMessage {
  /** Source identifier (e.g., platform name) */
  source?: string;
  /** Chat/conversation ID */
  chat_id: string;
  /** Sender name or ID */
  sender?: string;
  /** Message content */
  message: string;
  /** Timestamp (Unix ms or ISO string) */
  timestamp?: number | string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Validate incoming webhook message
 */
export function validateIncomingWebhookMessage(
  body: unknown
): { valid: true; message: IncomingWebhookMessage } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const data = body as Record<string, unknown>;

  // Check required fields
  if (!data.chat_id || typeof data.chat_id !== "string") {
    return { valid: false, error: "chat_id is required and must be a string" };
  }

  if (!data.message || typeof data.message !== "string") {
    return { valid: false, error: "message is required and must be a string" };
  }

  // Build validated message
  const message: IncomingWebhookMessage = {
    chat_id: data.chat_id,
    message: data.message,
  };

  // Optional fields
  if (typeof data.source === "string") {
    message.source = data.source;
  }

  if (typeof data.sender === "string") {
    message.sender = data.sender;
  }

  if (typeof data.timestamp === "number" || typeof data.timestamp === "string") {
    message.timestamp = data.timestamp;
  }

  if (data.metadata && typeof data.metadata === "object") {
    message.metadata = data.metadata as Record<string, unknown>;
  }

  return { valid: true, message };
}
