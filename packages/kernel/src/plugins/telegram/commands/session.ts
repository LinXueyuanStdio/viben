import type { Bot, Context } from "grammy";
import { InlineKeyboard } from "grammy";
import type { VibenCore } from "../../../core/index.js";
import type { Session } from "../../../core/sessions/session.js";
import { escapeHtml } from "../formatting.js";
import { createChildLogger } from "../../../core/utils/log.js";
import type { CommandsAssistantContext } from "../types.js";
const log = createChildLogger({ module: "telegram-cmd-session" });

/**
 * Handle `/cancel` — abort the current prompt in the active session.
 *
 * In the assistant topic, delegates to the AI to confirm which session to cancel.
 * In a session topic with an active prompt, calls `session.abortPrompt()`.
 * If there is no active prompt (session paused/waiting), informs the user.
 */
export async function handleCancel(
  ctx: Context,
  core: VibenCore,
  assistant?: CommandsAssistantContext,
): Promise<void> {
  const threadId = ctx.message?.message_thread_id;
  if (!threadId) return;

  // In assistant topic: forward to assistant for confirmation
  if (assistant && threadId === assistant.topicId) {
    const assistantSession = assistant.getSession();
    if (assistantSession) {
      await assistantSession.enqueuePrompt(
        "User wants to cancel a session. Confirm which session to cancel.",
      );
      return;
    }
  }

  const session = core.sessionManager.getSessionByThread(
    "telegram",
    String(threadId),
  );
  if (session) {
    log.info({ sessionId: session.id }, "Abort prompt command");
    await session.abortPrompt();
    await ctx.reply("⛔ Prompt aborted. Session is still active — send a new message to continue.", { parse_mode: "HTML" });
    return;
  }

  // Fallback: session not in memory — nothing to abort, but session can
  // still be resumed when the user sends a new message.
  const record = core.sessionManager.getRecordByThread("telegram", String(threadId));
  if (record && record.status !== "error") {
    log.info({ sessionId: record.sessionId, status: record.status }, "Cancel command — no active prompt to abort");
    await ctx.reply("ℹ️ No active prompt to cancel. Send a new message to resume the session.", { parse_mode: "HTML" });
  }
}

/**
 * Handle `/status` — show session info for the current topic, or overall system
 * stats when used outside a topic. Falls back to stored record when the session
 * is not currently loaded in memory.
 */
export async function handleStatus(ctx: Context, core: VibenCore): Promise<void> {
  const threadId = ctx.message?.message_thread_id;
  if (threadId) {
    const session = await core.getOrResumeSession(
      "telegram",
      String(threadId),
    );
    if (session) {
      await ctx.reply(
        `<b>Session:</b> ${escapeHtml(session.name || session.id)}\n` +
          `<b>Agent:</b> ${escapeHtml(session.agentName)}\n` +
          `<b>Status:</b> ${escapeHtml(session.status)}\n` +
          `<b>Workspace:</b> <code>${escapeHtml(session.workingDirectory)}</code>\n` +
          `<b>Queue:</b> ${session.queueDepth} pending`,
        { parse_mode: "HTML" },
      );
    } else {
      // Fallback: show stored session info when not loaded in memory (e.g. after restart)
      const record = core.sessionManager.getRecordByThread("telegram", String(threadId));
      if (record) {
        await ctx.reply(
          `<b>Session:</b> ${escapeHtml(record.name || record.sessionId)}\n` +
            `<b>Agent:</b> ${escapeHtml(record.agentName)}\n` +
            `<b>Status:</b> ${escapeHtml(record.status)} (not loaded)\n` +
            `<b>Workspace:</b> <code>${escapeHtml(record.workingDir)}</code>`,
          { parse_mode: "HTML" },
        );
      } else {
        await ctx.reply("No active session in this topic.", {
          parse_mode: "HTML",
        });
      }
    }
  } else {
    const sessions = core.sessionManager.listSessions("telegram");
    const active = sessions.filter(
      (s) => s.status === "active" || s.status === "initializing",
    );
    await ctx.reply(
      `<b>Viben Status</b>\n` +
        `Active sessions: ${active.length}\n` +
        `Total sessions: ${sessions.length}`,
      { parse_mode: "HTML" },
    );
  }
}

/**
 * Handle `/sessions` — list all sessions with a status overview and cleanup buttons.
 * Headless sessions (no Telegram topic) are filtered from the display but counted.
 */
export async function handleTopics(ctx: Context, core: VibenCore): Promise<void> {
  try {
    const allRecords = core.sessionManager.listRecords();

    // Only show sessions that have a Telegram topic (skip headless/CLI-only)
    const records = allRecords.filter((r) => {
      const platform = r.platform as { topicId?: number };
      return !!platform?.topicId;
    });

    const headlessCount = allRecords.length - records.length;

    if (records.length === 0) {
      const extra = headlessCount > 0 ? ` (${headlessCount} headless hidden)` : "";
      await ctx.reply(`No sessions with topics found.${extra}`, { parse_mode: "HTML" });
      return;
    }

    const statusEmoji: Record<string, string> = {
      active: "🟢",
      initializing: "🟡",
      finished: "✅",
      error: "❌",
      cancelled: "⛔",
    };

    // Sort: active/initializing first, then by lastActiveAt desc
    const statusOrder: Record<string, number> = { active: 0, initializing: 1, error: 2, finished: 3, cancelled: 4 };
    records.sort((a, b) => (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5));

    const MAX_DISPLAY = 30;
    const displayed = records.slice(0, MAX_DISPLAY);

    const lines = displayed.map((r) => {
      const emoji = statusEmoji[r.status] || "⚪";
      const name = r.name?.trim();
      const label = name ? escapeHtml(name) : `<i>${escapeHtml(r.agentName)} session</i>`;
      return `${emoji} ${label}  <code>[${r.status}]</code>`;
    });

    const header = `<b>Sessions: ${records.length}</b>` +
      (headlessCount > 0 ? ` (${headlessCount} headless hidden)` : "");
    const truncated = records.length > MAX_DISPLAY ? `\n\n<i>...and ${records.length - MAX_DISPLAY} more</i>` : "";

    // Count by status for cleanup buttons (include headless sessions)
    const finishedCount = allRecords.filter((r) => r.status === "finished").length;
    const errorCount = allRecords.filter((r) => r.status === "error" || r.status === "cancelled").length;

    const keyboard = new InlineKeyboard();
    if (finishedCount > 0) {
      keyboard.text(`Cleanup finished (${finishedCount})`, "m:cleanup:finished").row();
    }
    if (errorCount > 0) {
      keyboard.text(`Cleanup errors (${errorCount})`, "m:cleanup:errors").row();
    }
    if (finishedCount + errorCount > 0) {
      keyboard.text(`Cleanup all non-active (${finishedCount + errorCount})`, "m:cleanup:all").row();
    }
    keyboard.text(`⚠️ Cleanup ALL (${allRecords.length})`, "m:cleanup:everything").row();
    keyboard.text("Refresh", "m:topics");

    await ctx.reply(
      `${header}\n\n${lines.join("\n")}${truncated}`,
      { parse_mode: "HTML", reply_markup: keyboard },
    );
  } catch (err) {
    log.error({ err }, "handleTopics error");
    await ctx.reply("❌ Failed to list sessions.", { parse_mode: "HTML" }).catch(() => {});
  }
}

export async function handleCleanup(ctx: Context, core: VibenCore, chatId: number, statuses: string[]): Promise<void> {
  const allRecords = core.sessionManager.listRecords();
  const cleanable = allRecords.filter((r) => statuses.includes(r.status));

  if (cleanable.length === 0) {
    await ctx.reply("Nothing to clean up.", { parse_mode: "HTML" });
    return;
  }

  let deleted = 0;
  let failed = 0;

  for (const record of cleanable) {
    try {
      const topicId = (record.platform as { topicId?: number })?.topicId;
      if (topicId) {
        try {
          await ctx.api.deleteForumTopic(chatId, topicId);
        } catch (err) {
          log.warn({ err, sessionId: record.sessionId, topicId }, "Failed to delete forum topic during cleanup");
        }
      }
      await core.sessionManager.removeRecord(record.sessionId);
      deleted++;
    } catch (err) {
      log.error({ err, sessionId: record.sessionId }, "Failed to cleanup session");
      failed++;
    }
  }

  await ctx.reply(
    `🗑 Cleaned up <b>${deleted}</b> sessions${failed > 0 ? ` (${failed} failed)` : ""}.`,
    { parse_mode: "HTML" },
  );
}

export async function handleCleanupEverything(
  ctx: Context,
  core: VibenCore,
  chatId: number,
  systemTopicIds?: { notificationTopicId: number; assistantTopicId: number },
): Promise<void> {
  const allRecords = core.sessionManager.listRecords();
  const cleanable = allRecords.filter((r) => {
    const platform = r.platform as { topicId?: number };
    if (systemTopicIds && platform?.topicId && (platform.topicId === systemTopicIds.notificationTopicId || platform.topicId === systemTopicIds.assistantTopicId)) return false;
    return true;
  });

  if (cleanable.length === 0) {
    await ctx.reply("Nothing to clean up.", { parse_mode: "HTML" });
    return;
  }

  // Group by status for breakdown
  const statusCounts = new Map<string, number>();
  for (const r of cleanable) {
    statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1);
  }

  const statusEmoji: Record<string, string> = {
    active: "🟢", initializing: "🟡", finished: "✅", error: "❌", cancelled: "⛔",
  };

  const breakdown = Array.from(statusCounts.entries())
    .map(([status, count]) => `${statusEmoji[status] ?? "⚪"} ${status}: ${count}`)
    .join("\n");

  const activeCount = (statusCounts.get("active") ?? 0) + (statusCounts.get("initializing") ?? 0);
  const activeWarning = activeCount > 0
    ? `\n\n⚠️ <b>${activeCount} active session(s) will be cancelled and their agents stopped!</b>`
    : "";

  const keyboard = new InlineKeyboard()
    .text("Yes, delete all", "m:cleanup:everything:confirm")
    .text("Cancel", "m:topics");

  await ctx.reply(
    `<b>Delete ${cleanable.length} topics?</b>\n\n` +
    `This will:\n` +
    `• Delete all session topics from this group\n` +
    `• Cancel any running agent sessions\n` +
    `• Remove all session records\n\n` +
    `<b>Breakdown:</b>\n${breakdown}${activeWarning}\n\n` +
    `<i>Notifications and Assistant topics will NOT be deleted.</i>`,
    { parse_mode: "HTML", reply_markup: keyboard },
  );
}

export async function handleCleanupEverythingConfirmed(
  ctx: Context,
  core: VibenCore,
  chatId: number,
  systemTopicIds?: { notificationTopicId: number; assistantTopicId: number },
): Promise<void> {
  const allRecords = core.sessionManager.listRecords();
  const cleanable = allRecords.filter((r) => {
    const platform = r.platform as { topicId?: number };
    if (systemTopicIds && platform?.topicId && (platform.topicId === systemTopicIds.notificationTopicId || platform.topicId === systemTopicIds.assistantTopicId)) return false;
    return true;
  });

  if (cleanable.length === 0) {
    await ctx.reply("Nothing to clean up.", { parse_mode: "HTML" });
    return;
  }

  let deleted = 0;
  let failed = 0;

  for (const record of cleanable) {
    try {
      // Cancel active sessions first
      if (record.status === "active" || record.status === "initializing") {
        try {
          await core.sessionManager.cancelSession(record.sessionId);
        } catch (err) {
          log.warn({ err, sessionId: record.sessionId }, "Failed to cancel session during cleanup");
        }
      }

      const topicId = (record.platform as { topicId?: number })?.topicId;
      if (topicId) {
        try {
          await ctx.api.deleteForumTopic(chatId, topicId);
        } catch (err) {
          log.warn({ err, sessionId: record.sessionId, topicId }, "Failed to delete forum topic during cleanup");
        }
      }
      await core.sessionManager.removeRecord(record.sessionId);
      deleted++;
    } catch (err) {
      log.error({ err, sessionId: record.sessionId }, "Failed to cleanup session");
      failed++;
    }
  }

  await ctx.reply(
    `🗑 Cleaned up <b>${deleted}</b> sessions${failed > 0 ? ` (${failed} failed)` : ""}.`,
    { parse_mode: "HTML" },
  );
}

/**
 * Programmatically abort the most recently active Telegram session.
 * Used by the assistant when told to cancel a session via chat.
 * `excludeSessionId` prevents cancelling the assistant's own session.
 */
export async function executeCancelSession(
  core: VibenCore,
  excludeSessionId?: string,
): Promise<Session | null> {
  const sessions = core.sessionManager
    .listSessions("telegram")
    .filter((s) => s.status === "active" && s.id !== excludeSessionId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const session = sessions[0];
  if (!session) return null;

  await session.abortPrompt();
  return session;
}

export function setupSessionCallbacks(
  bot: Bot,
  core: VibenCore,
  chatId: number,
  systemTopicIds?: { notificationTopicId: number; assistantTopicId: number },
): void {
  bot.callbackQuery(/^m:cleanup/, async (ctx) => {
    const data = ctx.callbackQuery.data;
    try {
      await ctx.answerCallbackQuery();
    } catch { /* expired */ }

    switch (data) {
      case "m:cleanup:finished":
        await handleCleanup(ctx, core, chatId, ["finished"]);
        break;
      case "m:cleanup:errors":
        await handleCleanup(ctx, core, chatId, ["error", "cancelled"]);
        break;
      case "m:cleanup:all":
        await handleCleanup(ctx, core, chatId, ["finished", "error", "cancelled"]);
        break;
      case "m:cleanup:everything":
        await handleCleanupEverything(ctx, core, chatId, systemTopicIds);
        break;
      case "m:cleanup:everything:confirm":
        await handleCleanupEverythingConfirmed(ctx, core, chatId, systemTopicIds);
        break;
    }
  });

  // Refresh sessions list (button created by handleTopics)
  bot.callbackQuery('m:topics', async (ctx) => {
    try { await ctx.answerCallbackQuery() } catch { /* expired */ }
    await handleTopics(ctx, core)
  })
}

/**
 * Handle `/archive` — show a confirmation prompt before deleting the current
 * session's topic. The archive destroys the Telegram topic (all messages lost)
 * and permanently removes the session record.
 */
export async function handleArchive(
  ctx: Context,
  core: VibenCore,
): Promise<void> {
  const threadId = ctx.message?.message_thread_id;
  if (!threadId) return;

  // Check in-memory session first, then fall back to stored record
  const session = core.sessionManager.getSessionByThread("telegram", String(threadId));
  const record = !session ? core.sessionManager.getRecordByThread("telegram", String(threadId)) : undefined;

  // Must be used in a session topic (not orphan or non-session)
  if (!session && !record) {
    await ctx.reply("This topic is not linked to a session.", { parse_mode: "HTML" });
    return;
  }

  const identifier = session?.id ?? record?.sessionId;
  if (!identifier) {
    await ctx.reply("Could not determine session for this topic.", { parse_mode: "HTML" });
    return;
  }

  // Session must be active (not initializing)
  const status = session?.status ?? record?.status;
  if (status === "initializing") {
    await ctx.reply("Cannot archive a session that is still initializing. Wait for it to become active.", { parse_mode: "HTML" });
    return;
  }

  await ctx.reply(
    "⚠️ <b>Archive this session?</b>\n\n" +
    "This will:\n" +
    "• Stop the agent session\n" +
    "• Delete this topic permanently\n\n" +
    "<i>This cannot be undone.</i>",
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard()
        .text("🗑 Yes, archive", `ar:yes:${identifier}`)
        .text("❌ Cancel", `ar:no:${identifier}`),
    },
  );
}

export async function handleArchiveConfirm(
  ctx: Context,
  core: VibenCore,
  chatId: number,
): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  try {
    await ctx.answerCallbackQuery();
  } catch { /* expired */ }

  // Format: ar:<action>:<identifier> where identifier is sessionId
  const [, action, ...rest] = data.split(":");
  const identifier = rest.join(":");

  if (action === "no") {
    await ctx.editMessageText("Archive cancelled.", { parse_mode: "HTML" });
    return;
  }

  // action === "yes"
  // Note: we don't editMessageText here because the topic is about to be deleted

  const result = await core.archiveSession(identifier);
  if (!result.ok) {
    try {
      await ctx.editMessageText(`Failed to archive: <code>${escapeHtml(result.error)}</code>`, { parse_mode: "HTML" });
    } catch {
      core.notificationManager.notifyAll({
        sessionId: identifier,
        type: "error",
        summary: `Failed to archive session "${identifier}": ${result.error}`,
      });
    }
  }
}

