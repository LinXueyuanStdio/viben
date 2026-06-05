import type { Bot } from 'grammy'

/**
 * Ensure the two system topics (Notifications and Assistant) exist in the group.
 * Creates any missing topic and persists the resulting IDs via `saveConfig`.
 * Called once on startup; idempotent if both IDs are already present in config.
 */
export async function ensureTopics(
  bot: Bot,
  chatId: number,
  config: { notificationTopicId: number | null; assistantTopicId: number | null },
  saveConfig: (updates: { notificationTopicId?: number; assistantTopicId?: number }) => Promise<void>,
): Promise<{ notificationTopicId: number; assistantTopicId: number }> {
  let notificationTopicId = config.notificationTopicId
  let assistantTopicId = config.assistantTopicId

  if (notificationTopicId === null) {
    const topic = await bot.api.createForumTopic(chatId, '📋 Notifications')
    notificationTopicId = topic.message_thread_id
    await saveConfig({ notificationTopicId })
  }

  if (assistantTopicId === null) {
    const topic = await bot.api.createForumTopic(chatId, '🤖 Assistant')
    assistantTopicId = topic.message_thread_id
    await saveConfig({ assistantTopicId })
  }

  return { notificationTopicId, assistantTopicId }
}

/**
 * Create a new forum topic for a session and return its thread ID.
 * Each session gets exactly one dedicated topic; the thread ID is used
 * to route all subsequent messages for that session.
 */
export async function createSessionTopic(
  bot: Bot,
  chatId: number,
  name: string,
): Promise<number> {
  const topic = await bot.api.createForumTopic(chatId, name)
  return topic.message_thread_id
}

/** Rename an existing forum topic. Failures are silently ignored (topic may be closed/deleted). */
export async function renameSessionTopic(
  bot: Bot,
  chatId: number,
  threadId: number,
  name: string,
): Promise<void> {
  try {
    await bot.api.editForumTopic(chatId, threadId, { name })
  } catch {
    // Ignore rename failures (topic may be closed/deleted)
  }
}

/** Delete a forum topic and all its messages permanently. */
export async function deleteSessionTopic(
  bot: Bot,
  chatId: number,
  threadId: number,
): Promise<void> {
  await bot.api.deleteForumTopic(chatId, threadId);
}

/**
 * Build a Telegram deep link that navigates directly to a forum topic or message.
 *
 * When `messageId` is provided (and differs from `threadId`), the link points to
 * that specific message; otherwise it links to the topic root.
 */
export function buildDeepLink(chatId: number, threadId: number, messageId?: number): string {
  // Group chatId is prefixed with -100; strip it to form a valid t.me link
  const cleanId = String(chatId).replace('-100', '')
  // For forum groups: c/{chatId}/{threadId}/{messageId} links to a specific message
  // Without messageId: c/{chatId}/{threadId} links to the topic itself
  if (messageId && messageId !== threadId) {
    return `https://t.me/c/${cleanId}/${threadId}/${messageId}`
  }
  return `https://t.me/c/${cleanId}/${threadId}`
}
