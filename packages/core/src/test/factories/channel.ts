/**
 * Channel test factories
 */
import type { Channel, ChannelStatus, ChannelTypeInfo } from "../../channels/types";

/**
 * Create a mock channel with sensible defaults
 */
export function createMockChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: "test-channel",
    type: "telegram",
    name: "Test Channel",
    enabled: true,
    is_default: false,
    created_at: Date.now(),
    allow_from: [],
    notification_mode: "none",
    config: {},
    ...overrides,
  } as Channel;
}

/**
 * Create multiple mock channels
 */
export function createMockChannels(
  count: number,
  overrides?: (index: number) => Partial<Channel>
): Channel[] {
  return Array.from({ length: count }, (_, i) =>
    createMockChannel({
      id: `channel-${i + 1}`,
      name: `Channel ${i + 1}`,
      ...overrides?.(i),
    })
  );
}

/**
 * Create a mock channel status
 */
export function createMockChannelStatus(
  overrides: Partial<ChannelStatus> = {}
): ChannelStatus {
  return {
    id: "test-channel",
    type: "telegram",
    name: "Test Channel",
    enabled: true,
    is_default: false,
    status: "connected",
    checked_at: Date.now(),
    ...overrides,
  } as ChannelStatus;
}

/**
 * Default channel types for mocking
 */
export const MOCK_CHANNEL_TYPES: ChannelTypeInfo[] = [
  {
    id: "telegram",
    name: "Telegram Bot API",
    description: "Send messages via Telegram Bot",
    setupDifficulty: "easy",
  },
  {
    id: "discord",
    name: "Discord Bot API",
    description: "Send messages via Discord Bot",
    setupDifficulty: "easy",
  },
  {
    id: "feishu",
    name: "Feishu (Lark) Open Platform",
    description: "Send messages via Feishu/Lark",
    setupDifficulty: "medium",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Web Bridge",
    description: "Send messages via WhatsApp bridge",
    setupDifficulty: "medium",
  },
  {
    id: "slack",
    name: "Slack Web API",
    description: "Send messages via Slack",
    setupDifficulty: "medium",
  },
  {
    id: "webhook",
    name: "Generic Webhook",
    description: "Send messages via HTTP webhook",
    setupDifficulty: "easy",
  },
];
