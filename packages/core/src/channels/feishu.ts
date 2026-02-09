/**
 * Feishu (Lark) Channel Client
 *
 * Sends messages via Feishu Open Platform API
 */

import type {
  FeishuChannelConfig,
  SendMessageOptions,
  SendMessageResult,
  TestChannelResult,
} from "./types";

const FEISHU_API_BASE = "https://open.feishu.cn/open-apis";

interface TenantAccessTokenResponse {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
}

/**
 * Get tenant access token from Feishu
 */
async function getTenantAccessToken(
  config: FeishuChannelConfig
): Promise<{ token?: string; error?: string }> {
  try {
    const response = await fetch(
      `${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_id: config.app_id,
          app_secret: config.app_secret,
        }),
      }
    );

    const data: TenantAccessTokenResponse = await response.json();

    if (data.code !== 0 || !data.tenant_access_token) {
      return { error: data.msg || "Failed to get access token" };
    }

    return { token: data.tenant_access_token };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Determine receive_id_type based on the chat ID format
 */
function getReceiveIdType(chatId: string): string {
  if (chatId.startsWith("ou_")) {
    return "open_id";
  }
  if (chatId.startsWith("on_")) {
    return "union_id";
  }
  if (chatId.startsWith("oc_")) {
    return "chat_id";
  }
  if (chatId.includes("@")) {
    return "email";
  }
  // Default to chat_id
  return "chat_id";
}

/**
 * Send a message to Feishu
 */
export async function sendFeishuMessage(
  config: FeishuChannelConfig,
  options: SendMessageOptions
): Promise<SendMessageResult> {
  if (!config.app_id || !config.app_secret) {
    return { success: false, error: "App ID and App Secret are required" };
  }

  if (!options.chatId) {
    return {
      success: false,
      error: "Chat ID (open_id, chat_id, or email) is required",
    };
  }

  // Get access token first
  const { token, error: tokenError } = await getTenantAccessToken(config);
  if (!token) {
    return { success: false, error: tokenError || "Failed to get access token" };
  }

  try {
    const receiveIdType = getReceiveIdType(options.chatId);

    const response = await fetch(
      `${FEISHU_API_BASE}/im/v1/messages?receive_id_type=${receiveIdType}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receive_id: options.chatId,
          msg_type: "text",
          content: JSON.stringify({ text: options.message }),
        }),
      }
    );

    const data = await response.json();

    if (data.code !== 0) {
      return {
        success: false,
        error: data.msg || `Code ${data.code}`,
      };
    }

    return {
      success: true,
      messageId: data.data?.message_id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test Feishu channel configuration
 */
export async function testFeishuChannel(
  config: FeishuChannelConfig
): Promise<TestChannelResult> {
  if (!config.app_id || !config.app_secret) {
    return { success: false, error: "App ID and App Secret are required" };
  }

  // Test by getting tenant access token
  const { token, error } = await getTenantAccessToken(config);

  if (!token) {
    return { success: false, error: error || "Failed to get access token" };
  }

  return {
    success: true,
    details: "Successfully obtained tenant access token",
  };
}
