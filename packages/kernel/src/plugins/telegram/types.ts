import type { Session } from "../../core/sessions/session.js";
import type { ChannelConfig } from "../../core/channel.js";

/**
 * Runtime configuration for the Telegram adapter.
 *
 * `notificationTopicId` and `assistantTopicId` start as `null` on first run and are
 * populated by `ensureTopics()` when the system topics are created in the group.
 * Both IDs are persisted to plugin settings so they survive restarts.
 */
export interface TelegramChannelConfig extends ChannelConfig {
  botToken: string
  chatId: number
  /** Forum topic used for all cross-session notifications (completions, permissions). Null until first run. */
  notificationTopicId: number | null
  /** Forum topic where users chat with the assistant. Null until first run. */
  assistantTopicId: number | null
}

/**
 * Context passed to command handlers that need to interact with the assistant session.
 *
 * Allows commands (e.g. /new, /cancel, /resume) to delegate to the AI assistant
 * when run inside the assistant topic, instead of showing a plain usage error.
 */
export interface CommandsAssistantContext {
  topicId: number;
  getSession: () => Session | null;
  setControlMessage: (sessionId: string, msgId: number) => void;
}
