import { createChildLogger } from '../../core/utils/log.js'
const log = createChildLogger({ module: 'telegram-validators' })

/**
 * Validate a bot token by calling the Telegram `getMe` API.
 * Returns the bot name and username on success, or an error description on failure.
 */
export async function validateBotToken(
  token: string,
): Promise<
  | { ok: true; botName: string; botUsername: string }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = (await res.json()) as {
      ok: boolean;
      result?: { first_name: string; username: string };
      description?: string;
    };
    if (data.ok && data.result) {
      return {
        ok: true,
        botName: data.result.first_name,
        botUsername: data.result.username,
      };
    }
    return { ok: false, error: data.description || "Invalid token" };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Validate that a chat ID refers to a supergroup (required for forum topics).
 * Returns whether the group has Topics enabled (`isForum`).
 */
export async function validateChatId(
  token: string,
  chatId: number,
): Promise<
  { ok: true; title: string; isForum: boolean } | { ok: false; error: string }
> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      result?: { title: string; type: string; is_forum?: boolean };
      description?: string;
    };
    if (!data.ok || !data.result) {
      return { ok: false, error: data.description || "Invalid chat ID" };
    }
    if (data.result.type !== "supergroup") {
      const typeHint =
        data.result.type === "group"
          ? 'This group does not have Topics enabled. Tap the group name → Edit (pencil icon) → enable "Topics" → tap the checkmark to save. Telegram will upgrade the group automatically.'
          : `Chat must be a group with Topics enabled (got: "${data.result.type}"). Channels and private chats are not supported.`;
      return { ok: false, error: typeHint };
    }
    return {
      ok: true,
      title: data.result.title,
      isForum: data.result.is_forum === true,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Check that the bot is an admin in the group and has the `can_manage_topics` permission.
 * Group creators are always treated as having all permissions.
 */
export async function validateBotAdmin(
  token: string,
  chatId: number,
): Promise<{ ok: true; canManageTopics: boolean } | { ok: false; error: string }> {
  try {
    // Get bot's own user ID
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = (await meRes.json()) as {
      ok: boolean;
      result?: { id: number };
    };
    if (!meData.ok || !meData.result) {
      return { ok: false, error: "Could not retrieve bot info" };
    }

    const res = await fetch(
      `https://api.telegram.org/bot${token}/getChatMember`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, user_id: meData.result.id }),
      },
    );
    const data = (await res.json()) as {
      ok: boolean;
      result?: { status: string; can_manage_topics?: boolean };
      description?: string;
    };
    if (!data.ok || !data.result) {
      return {
        ok: false,
        error: data.description || "Could not check bot membership",
      };
    }

    const { status } = data.result;
    log.info(
      { status, can_manage_topics: data.result.can_manage_topics, raw_result: data.result },
      'validateBotAdmin: getChatMember raw result',
    )
    if (status === "creator") {
      // Group creator has all permissions
      return { ok: true, canManageTopics: true };
    }
    if (status === "administrator") {
      return { ok: true, canManageTopics: data.result.can_manage_topics === true };
    }
    return {
      ok: false,
      error: `Bot is "${status}" in this group — it must be an admin. Ask a group admin to go to Group Settings → Administrators → add the bot → tap Save/Done. Note: only existing admins can promote the bot.`,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Run all prerequisite checks for the topic-per-session model:
 * 1. Topics are enabled on the group (`is_forum: true`)
 * 2. Bot is an admin
 * 3. Bot has `can_manage_topics` permission
 *
 * Returns all failing issues so the user can fix them all at once.
 * Called on adapter startup; if checks fail, a background watcher retries periodically.
 */
export async function checkTopicsPrerequisites(
  token: string,
  chatId: number,
): Promise<{ ok: true } | { ok: false; issues: string[] }> {
  const issues: string[] = [];

  log.info({ chatId }, 'checkTopicsPrerequisites: starting checks')

  // Check 1: Topics enabled
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      result?: { is_forum?: boolean; type?: string; title?: string };
    };
    log.info(
      { chatId, apiOk: data.ok, is_forum: data.result?.is_forum, type: data.result?.type, title: data.result?.title },
      'checkTopicsPrerequisites: getChat result',
    )
    if (data.ok && data.result && !data.result.is_forum) {
      issues.push(
        '❌ Topics are not enabled on this group.\n→ Go to Group Settings → Edit → enable "Topics" → tap Save/Done',
      );
    }
  } catch (err) {
    log.warn({ err, chatId }, 'checkTopicsPrerequisites: getChat failed (network error)')
    issues.push('❌ Could not check if Topics are enabled (network error).');
  }

  // Check 2 & 3: Bot is admin + can_manage_topics
  const adminResult = await validateBotAdmin(token, chatId);
  log.info(
    { chatId, adminOk: adminResult.ok, canManageTopics: adminResult.ok ? adminResult.canManageTopics : undefined, error: !adminResult.ok ? adminResult.error : undefined },
    'checkTopicsPrerequisites: validateBotAdmin result',
  )
  if (!adminResult.ok) {
    issues.push(
      `❌ Bot is not an admin.\n→ Go to Group Settings → Administrators → add the bot as admin → tap Save/Done\n→ Note: only existing group admins can promote the bot`,
    );
  } else if (!adminResult.canManageTopics) {
    issues.push(
      '❌ Bot cannot manage topics.\n→ Go to Group Settings → Administrators → tap the bot → enable "Manage Topics" → tap Save/Done (the checkmark)',
    );
  }

  log.info({ chatId, issueCount: issues.length, ok: issues.length === 0 }, 'checkTopicsPrerequisites: result')
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true };
}
