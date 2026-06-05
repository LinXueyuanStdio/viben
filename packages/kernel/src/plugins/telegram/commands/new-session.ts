import type { Bot, Context } from "grammy";
import { InlineKeyboard } from "grammy";
import type { VibenCore } from "../../../core/index.js";
import type { Session } from "../../../core/sessions/session.js";
import { escapeHtml } from "../formatting.js";
import { createSessionTopic, renameSessionTopic, buildDeepLink } from "../topics.js";
import { createChildLogger } from "../../../core/utils/log.js";
import { buildSessionControlKeyboard, buildSessionStatusText } from "./admin.js";
import type { CommandsAssistantContext } from "../types.js";
const log = createChildLogger({ module: "telegram-cmd-new-session" });

function botFromCtx(ctx: Context): Bot {
  // createSessionTopic only uses bot.api.createForumTopic
  return { api: ctx.api } as unknown as Bot;
}

/**
 * Handle `/new [agent] [workspace]` — create a new session.
 *
 * - With both args: creates the session directly via `createSessionDirect`.
 * - From the assistant topic without full args: delegates to the AI assistant
 *   to guide the user through selecting an agent and workspace.
 * - Otherwise: shows a usage hint.
 */
export async function handleNew(
  ctx: Context,
  core: VibenCore,
  chatId: number,
  assistant?: CommandsAssistantContext,
  onControlMessage?: (sessionId: string, msgId: number) => void,
): Promise<void> {
  const rawMatch = (ctx as Context & { match: unknown }).match;
  const matchStr = typeof rawMatch === "string" ? rawMatch : "";
  const args = matchStr.split(" ").filter(Boolean);
  const agentName = args[0];
  const workspace = args[1];

  // Full args → create directly
  if (agentName && workspace) {
    await createSessionDirect(ctx, core, chatId, agentName, workspace, onControlMessage);
    return;
  }

  // In assistant topic → forward to assistant for conversational handling
  const currentThreadId = ctx.message?.message_thread_id;
  if (assistant && currentThreadId === assistant.topicId) {
    const assistantSession = assistant.getSession();
    if (assistantSession) {
      const prompt = agentName
        ? `User wants to create a new session with agent "${agentName}" but didn't specify a workspace. Ask them which project directory to use as workspace.`
        : `User wants to create a new session. Guide them through choosing an agent and workspace (project directory).`;
      await assistantSession.enqueuePrompt(prompt);
      return;
    }
  }

  // Outside assistant topic or no assistant — show usage hint
  await ctx.reply(
    `Usage: <code>/new &lt;agent&gt; &lt;workspace&gt;</code>\n\n` +
      `Or ask the assistant to create a session for you.`,
    { parse_mode: "HTML" },
  );
}

/**
 * Create a session topic and start the agent immediately.
 *
 * Creates the forum topic first (before the session events fire) to ensure the
 * thread ID is available when `session_thread_ready` fires. Sends a control
 * message with session status and bypass/TTS buttons. Cleans up the orphaned
 * topic if session creation fails.
 *
 * Returns the Telegram thread ID, or null on failure.
 */
export async function createSessionDirect(
  ctx: Context,
  core: VibenCore,
  chatId: number,
  agentName: string,
  workspace: string,
  onControlMessage?: (sessionId: string, msgId: number) => void,
): Promise<number | null> {
  log.info({ userId: ctx.from?.id, agentName, workspace }, "New session command (direct)");

  let threadId: number | undefined;
  try {
    const topicName = `🔄 New Session`;
    threadId = await createSessionTopic(botFromCtx(ctx), chatId, topicName);

    await ctx.api.sendMessage(chatId, `⏳ Setting up session, please wait...`, {
      message_thread_id: threadId,
      parse_mode: "HTML",
    });

    const session = await core.handleNewSession("telegram", agentName, workspace, { threadId: String(threadId) });

    const finalName = `🔄 ${session.agentName} — New Session`;
    try {
      await ctx.api.editForumTopic(chatId, threadId, { name: finalName });
    } catch { /* ignore rename failures */ }

    const controlMsg = await ctx.api.sendMessage(
      chatId,
      buildSessionStatusText(session, `✅ <b>Session started</b>`),
      {
        message_thread_id: threadId,
        parse_mode: "HTML",
        reply_markup: buildSessionControlKeyboard(session.id, false, false),
      },
    );

    onControlMessage?.(session.id, controlMsg.message_id);

    return threadId ?? null;
  } catch (err) {
    log.error({ err }, "Session creation failed");
    if (threadId) {
      try { await ctx.api.deleteForumTopic(chatId, threadId); } catch { /* ignore */ }
    }
    const message = err instanceof Error ? err.message : (typeof err === 'object' ? JSON.stringify(err) : String(err));
    await ctx.reply(`❌ ${escapeHtml(message)}`, { parse_mode: "HTML" });
    return null;
  }
}

/**
 * Handle `/newchat` — start a fresh chat in a new topic, reusing the current
 * session's agent and workspace. Resolves agent/workspace from the in-memory session
 * first, falling back to the stored record for sessions not currently loaded.
 */
export async function handleNewChat(
  ctx: Context,
  core: VibenCore,
  chatId: number,
  onControlMessage?: (sessionId: string, msgId: number) => void,
): Promise<void> {
  const threadId = ctx.message?.message_thread_id;
  if (!threadId) {
    await ctx.reply(
      "Use /newchat inside a session topic to inherit its config.",
      { parse_mode: "HTML" },
    );
    return;
  }

  // Read agent config directly from the stored record — no need to resume the old session
  // since /newchat only inherits agentName + workspace, not any live session state.
  const record = core.sessionManager.getRecordByThread("telegram", String(threadId));
  if (!record || record.status === "cancelled" || record.status === "error") {
    await ctx.reply("No active session in this topic.", {
      parse_mode: "HTML",
    });
    return;
  }

  const agentName = record.agentName;
  const workspace = record.workingDir;

  let newThreadId: number | undefined;
  try {
    // Create topic FIRST so threadId is ready before session events fire
    const topicName = `🔄 ${agentName} — New Chat`;
    newThreadId = await createSessionTopic(
      botFromCtx(ctx),
      chatId,
      topicName,
    );

    // Notify in the original topic immediately with a deep link to the new one
    const topicLink = buildDeepLink(chatId, newThreadId);
    await ctx.reply(
      `✅ New chat created → <a href="${topicLink}">Open topic</a>`,
      { parse_mode: "HTML" },
    );

    await ctx.api.sendMessage(chatId, `⏳ Setting up session, please wait...`, {
      message_thread_id: newThreadId,
      parse_mode: "HTML",
    });

    const session = await core.handleNewSession(
      "telegram",
      agentName,
      workspace,
      { threadId: String(newThreadId) },
    );

    const controlMsg = await ctx.api.sendMessage(
      chatId,
      buildSessionStatusText(session, `✅ New chat (same agent &amp; workspace)`),
      {
        message_thread_id: newThreadId,
        parse_mode: "HTML",
        reply_markup: buildSessionControlKeyboard(session.id, false, false),
      },
    );

    onControlMessage?.(session.id, controlMsg.message_id);

  } catch (err) {
    // Clean up orphaned topic if session creation failed
    if (newThreadId) {
      try {
        await ctx.api.deleteForumTopic(chatId, newThreadId);
      } catch {
        /* ignore cleanup failures */
      }
    }
    const message = err instanceof Error ? err.message : String(err);
    await ctx.reply(`❌ ${escapeHtml(message)}`, { parse_mode: "HTML" });
  }
}

// --- New Session button flow (ns: prefix) ---

/** Workspace cache for callback data — avoids Telegram's 64-byte callback limit */
const WS_CACHE_MAX = 50
const workspaceCache = new Map<number, { agentKey: string; workspace: string; ts: number }>()
let nextWsId = 0

// --- Force Reply state for custom path input ---

interface ForceReplyEntry {
  agentKey: string;
  chatId: number;
  createdAt: number; // ms timestamp, for TTL
}

export const _forceReplyMap = new Map<number, ForceReplyEntry>();

export function _pruneExpiredForceReplies(): void {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [msgId, entry] of _forceReplyMap) {
    if (entry.createdAt < cutoff) _forceReplyMap.delete(msgId);
  }
}

export async function _sendCustomPathPrompt(
  ctx: Context,
  chatId: number,
  agentKey: string,
): Promise<void> {
  const threadId =
    ctx.message?.message_thread_id ??
    (ctx as Context & { callbackQuery?: { message?: { message_thread_id?: number } } })
      .callbackQuery?.message?.message_thread_id;

  const sent = await ctx.api.sendMessage(
    chatId,
    `Please type the workspace path.\n\n` +
      `Examples:\n` +
      `• <code>/absolute/path/to/project</code>\n` +
      `• <code>~/my-project</code>\n` +
      `• <code>project-name</code> (created under your base directory)\n\n` +
      `Reply to this message with your path.`,
    {
      parse_mode: 'HTML',
      reply_markup: { force_reply: true },
      ...(threadId !== undefined ? { message_thread_id: threadId } : {}),
    },
  );
  _forceReplyMap.set(sent.message_id, { agentKey, chatId, createdAt: Date.now() });
}

export async function _handleCustomPathReply(
  ctx: Context,
  core: VibenCore,
  chatId: number,
  entry: ForceReplyEntry,
): Promise<void> {
  const input = (ctx.message!.text ?? '').trim();

  let resolvedPath: string;
  try {
    resolvedPath = core.configManager.resolveWorkspace(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await ctx.reply(`❌ ${escapeHtml(message)}\n\nPlease try again:`, {
      parse_mode: 'HTML',
    }).catch(() => {});
    await _sendCustomPathPrompt(ctx, chatId, entry.agentKey);
    return;
  }

  await createSessionDirect(ctx, core, chatId, entry.agentKey, resolvedPath);
}

function cacheWorkspace(agentKey: string, workspace: string): number {
  // Evict stale entries (>5 min) and cap size
  const now = Date.now()
  for (const [id, entry] of workspaceCache) {
    if (now - entry.ts > 5 * 60_000) {
      workspaceCache.delete(id)
    }
  }
  if (workspaceCache.size > WS_CACHE_MAX) {
    const sorted = [...workspaceCache.entries()].sort((a, b) => a[1].ts - b[1].ts)
    const toDelete = sorted.slice(0, workspaceCache.size - WS_CACHE_MAX)
    for (const [id] of toDelete) {
      workspaceCache.delete(id)
    }
  }
  const id = nextWsId++
  workspaceCache.set(id, { agentKey, workspace, ts: now })
  return id
}

function shortenPath(ws: string): string {
  const home = process.env.HOME || ''
  return home && ws.startsWith(home) ? '~' + ws.slice(home.length) : ws
}

/**
 * Show the agent selection step of the multi-step new session wizard.
 * If only one agent is installed, skip directly to workspace selection.
 */
export async function showAgentPicker(ctx: Context, core: VibenCore, chatId: number): Promise<void> {
  const catalog = core.agentCatalog
  const installed = catalog.getAvailable().filter((i) => i.installed)

  if (installed.length === 0) {
    await ctx.reply('No agents installed. Use /install to add one.', { parse_mode: 'HTML' }).catch(() => {})
    return
  }

  // Single agent → skip picker, go straight to workspace
  if (installed.length === 1) {
    await showWorkspacePicker(ctx, core, chatId, installed[0].key, true)
    return
  }

  const kb = new InlineKeyboard()
  for (let i = 0; i < installed.length; i += 2) {
    const row = installed.slice(i, i + 2)
    for (const agent of row) {
      kb.text(agent.name, `ns:agent:${agent.key}`)
    }
    kb.row()
  }

  // Always new message — menu stays untouched
  await ctx.reply('<b>🆕 New Session</b>\nSelect an agent:', {
    parse_mode: 'HTML',
    reply_markup: kb,
  }).catch(() => {})
}

async function showWorkspacePicker(ctx: Context, core: VibenCore, chatId: number, agentKey: string, newMessage = false): Promise<void> {
  const records = core.sessionManager.listRecords()
  const recentWorkspaces = [...new Set(records.map((r) => r.workingDir).filter(Boolean))]
    .slice(0, 5)

  const resolvedBaseDir = core.configManager.resolveWorkspace()

  // Ensure workspace base is always an option
  const hasBaseDir = recentWorkspaces.some(ws => ws === resolvedBaseDir)
  const workspaces = hasBaseDir
    ? recentWorkspaces
    : [resolvedBaseDir, ...recentWorkspaces].slice(0, 5)

  const kb = new InlineKeyboard()
  for (const ws of workspaces) {
    const id = cacheWorkspace(agentKey, ws)
    kb.text(`📁 ${shortenPath(ws)}`, `ns:ws:${id}`).row()
  }
  // Custom path → delegate to AI
  kb.text('📁 Custom path...', `ns:custom:${agentKey}`).row()

  const agentLabel = escapeHtml(agentKey)
  const text = `<b>🆕 New Session</b>\nAgent: <code>${agentLabel}</code>\n\nSelect workspace:`
  const opts = { parse_mode: 'HTML' as const, reply_markup: kb }

  if (newMessage) {
    // First message in flow (single agent skip) — new message, menu untouched
    await ctx.reply(text, opts).catch(() => {})
  } else {
    // Edit the agent picker message in-place
    try {
      await ctx.editMessageText(text, opts)
    } catch {
      await ctx.reply(text, opts).catch(() => {})
    }
  }
}

/**
 * Register all callback handlers for the multi-step new session wizard.
 *
 * Wizard flow:
 * 1. `ns:start` → agent picker
 * 2. `ns:agent:<key>` → workspace picker
 * 3. `ns:ws:<id>` → create session
 * 4. `ns:custom:<key>` → force-reply prompt for custom path input
 *
 * Custom path replies are intercepted from the `message:text` middleware by
 * checking against the `_forceReplyMap` before passing to the next handler.
 */
export function setupNewSessionCallbacks(
  bot: Bot,
  core: VibenCore,
  chatId: number,
): void {
  // Intercept replies to force-reply messages (custom path input)
  bot.on("message:text", async (ctx, next) => {
    _pruneExpiredForceReplies()
    const replyToId = ctx.message.reply_to_message?.message_id
    if (replyToId === undefined) return next()
    const entry = _forceReplyMap.get(replyToId)
    if (!entry || entry.chatId !== ctx.message.chat.id) return next()
    _forceReplyMap.delete(replyToId)
    await _handleCustomPathReply(ctx, core, chatId, entry)
  })

  // Agent picker (also triggered from m: handler callback case)
  bot.callbackQuery('ns:start', async (ctx) => {
    try { await ctx.answerCallbackQuery() } catch { /* expired */ }
    await showAgentPicker(ctx, core, chatId)
  })

  bot.callbackQuery(/^ns:agent:/, async (ctx) => {
    const agentKey = ctx.callbackQuery.data.replace('ns:agent:', '')
    try { await ctx.answerCallbackQuery() } catch { /* expired */ }
    await showWorkspacePicker(ctx, core, chatId, agentKey)
  })

  bot.callbackQuery(/^ns:ws:/, async (ctx) => {
    const id = parseInt(ctx.callbackQuery.data.replace('ns:ws:', ''), 10)
    try { await ctx.answerCallbackQuery() } catch { /* expired */ }

    const entry = workspaceCache.get(id)
    if (!entry) {
      try { await ctx.editMessageText('⚠️ Session expired. Please try again via /menu.') } catch { /* ignore */ }
      return
    }
    workspaceCache.delete(id)

    // Show creating state in same message
    try {
      await ctx.editMessageText(
        `<b>🆕 New Session</b>\n` +
        `Agent: <code>${escapeHtml(entry.agentKey)}</code>\n` +
        `Workspace: <code>${escapeHtml(shortenPath(entry.workspace))}</code>\n\n` +
        `⏳ Creating session...`,
        { parse_mode: 'HTML' },
      )
    } catch { /* ignore */ }

    const threadId = await createSessionDirect(ctx, core, chatId, entry.agentKey, entry.workspace)

    // Update message with result
    if (threadId) {
      const { buildDeepLink } = await import('../topics.js')
      const link = buildDeepLink(chatId, threadId)
      try {
        await ctx.editMessageText(
          `<b>✅ Session created</b>\n` +
          `Agent: <code>${escapeHtml(entry.agentKey)}</code>\n` +
          `Workspace: <code>${escapeHtml(shortenPath(entry.workspace))}</code>\n\n` +
          `<a href="${link}">Open session →</a>`,
          { parse_mode: 'HTML' },
        )
      } catch { /* ignore */ }
    } else {
      try {
        await ctx.editMessageText(
          `<b>❌ Session creation failed</b>\n` +
          `Agent: <code>${escapeHtml(entry.agentKey)}</code>\n` +
          `Workspace: <code>${escapeHtml(shortenPath(entry.workspace))}</code>\n\n` +
          `Try again with /new or /menu`,
          { parse_mode: 'HTML' },
        )
      } catch { /* ignore */ }
    }
  })

  bot.callbackQuery(/^ns:custom:/, async (ctx) => {
    const agentKey = ctx.callbackQuery.data.replace('ns:custom:', '')
    try { await ctx.answerCallbackQuery() } catch { /* expired */ }

    // Remove inline keyboard from wizard message so user can't click stale buttons
    try {
      await ctx.editMessageText(
        `<b>🆕 New Session</b>\n` +
        `Agent: <code>${escapeHtml(agentKey)}</code>\n\n` +
        `⌨️ Waiting for workspace path...`,
        { parse_mode: 'HTML' },
      )
    } catch { /* ignore */ }

    await _sendCustomPathPrompt(ctx, chatId, agentKey)
  })
}

/**
 * Create a new session programmatically (used by the API server and assistant).
 *
 * Creates the forum topic and sends the initial "Setting up..." message before
 * calling `core.handleNewSession()`, so the threadId is ready when session events
 * fire. Cleans up the orphaned topic on failure.
 */
export async function executeNewSession(
  bot: Bot,
  core: VibenCore,
  chatId: number,
  agentName?: string,
  workspace?: string,
): Promise<{ session: Session; threadId: number; firstMsgId: number }> {
  // Create topic with generic name first (same as original handleNew)
  const threadId = await createSessionTopic(bot, chatId, "🔄 New Session");

  const setupMsg = await bot.api.sendMessage(chatId, "⏳ Setting up session, please wait...", {
    message_thread_id: threadId,
    parse_mode: "HTML",
  });
  const firstMsgId = setupMsg.message_id;

  try {
    // core.handleNewSession() already wires events internally — do NOT call wireSessionEvents again
    const session = await core.handleNewSession(
      "telegram",
      agentName,
      workspace,
      { threadId: String(threadId) },
    );

    // Rename topic with agent name after session is created
    const finalName = `🔄 ${session.agentName} — New Session`;
    await renameSessionTopic(bot, chatId, threadId, finalName);

    return { session, threadId, firstMsgId };
  } catch (err) {
    // Clean up orphaned topic on failure
    try {
      await bot.api.deleteForumTopic(chatId, threadId);
    } catch {
      /* best effort */
    }
    throw err;
  }
}
