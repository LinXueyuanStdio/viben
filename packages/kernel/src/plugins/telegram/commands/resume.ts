import type { Bot, Context } from "grammy";
import type { VibenCore } from "../../../core/index.js";
import type { ContextQuery } from "../../../plugins/context/context-provider.js";
import { DEFAULT_MAX_TOKENS } from "../../../plugins/context/context-provider.js";
import { CheckpointReader } from "../../../plugins/context/entire/checkpoint-reader.js";
import { escapeHtml } from "../formatting.js";
import { createSessionTopic, buildDeepLink } from "../topics.js";
import { buildSessionControlKeyboard, buildSessionStatusText } from "./admin.js";
import { createChildLogger } from "../../../core/utils/log.js";
import type { CommandsAssistantContext } from "../types.js";

const log = createChildLogger({ module: "telegram-cmd-resume" });

function botFromCtx(ctx: Context): Bot {
  return { api: ctx.api } as unknown as Bot;
}

// --- Arg parsing ---

/**
 * Parse `/resume` arguments into a ContextQuery.
 *
 * Supported forms:
 * - No args → latest 5 sessions
 * - `pr <number>`, `branch <name>`, `commit <hash>`
 * - Checkpoint ID (12-char hex) or session ID (auto-detected)
 * - GitHub/Entire.io URLs (PR, commit, branch, compare, checkpoint)
 */
export function parseResumeArgs(matchStr: string): { query: Omit<ContextQuery, "repoPath"> } | null {
  const args = matchStr.split(" ").filter(Boolean);
  if (args.length === 0) return { query: { type: "latest", value: "5" } };

  const first = args[0];

  // Subcommands
  if (first === "pr") return args[1] ? { query: { type: "pr", value: args[1] } } : null;
  if (first === "branch") return args[1] ? { query: { type: "branch", value: args[1] } } : null;
  if (first === "commit") return args[1] ? { query: { type: "commit", value: args[1] } } : null;

  // Auto-detect ID format
  if (CheckpointReader.isCheckpointId(first)) return { query: { type: "checkpoint", value: first } };
  if (CheckpointReader.isSessionId(first)) return { query: { type: "session", value: first } };

  // GitHub PR URL: github.com/org/repo/pull/19
  if (first.includes("/pull/")) {
    const prMatch = first.match(/\/pull\/(\d+)/);
    return prMatch ? { query: { type: "pr", value: prMatch[1] } } : null;
  }

  // GitHub commit URL: github.com/org/repo/commit/e0dd2fa4...
  const ghCommitMatch = first.match(/github\.com\/[^/]+\/[^/]+\/commit\/([0-9a-f]+)/);
  if (ghCommitMatch) return { query: { type: "commit", value: ghCommitMatch[1] } };

  // GitHub branch URL: github.com/org/repo/tree/branch-name
  const ghBranchMatch = first.match(/github\.com\/[^/]+\/[^/]+\/tree\/(.+?)(?:\?|#|$)/);
  if (ghBranchMatch) return { query: { type: "branch", value: ghBranchMatch[1] } };

  // GitHub compare URL: github.com/org/repo/compare/base...head
  const ghCompareMatch = first.match(/github\.com\/[^/]+\/[^/]+\/compare\/(?:[^.]+\.{2,3})(.+?)(?:\?|#|$)/);
  if (ghCompareMatch) return { query: { type: "branch", value: ghCompareMatch[1] } };

  // GitHub bare repo URL: github.com/org/repo (no subpath) → latest
  if (first.match(/github\.com\/[^/]+\/[^/]+\/?$/) && !first.includes("/tree/") && !first.includes("/pull/") && !first.includes("/commit/") && !first.includes("/compare/")) {
    return { query: { type: "latest", value: "5" } };
  }

  // Entire.io checkpoint URL: entire.io/gh/{owner}/{repo}/checkpoints/{branch}/{checkpoint_id}
  const entireCheckpointMatch = first.match(/entire\.io\/gh\/[^/]+\/[^/]+\/checkpoints\/[^/]+\/([0-9a-f]{12})/);
  if (entireCheckpointMatch) return { query: { type: "checkpoint", value: entireCheckpointMatch[1] } };

  // Entire.io commit URL: entire.io/gh/{owner}/{repo}/commit/{commit_hash}
  const entireCommitMatch = first.match(/entire\.io\/gh\/[^/]+\/[^/]+\/commit\/([0-9a-f]+)/);
  if (entireCommitMatch) return { query: { type: "commit", value: entireCommitMatch[1] } };

  // Unknown — default to latest
  return { query: { type: "latest", value: "5" } };
}

// --- Execute resume with resolved workspace ---

async function executeResume(
  ctx: Context,
  core: VibenCore,
  chatId: number,
  query: Omit<ContextQuery, "repoPath">,
  repoPath: string,
  onControlMessage?: (sessionId: string, msgId: number) => void,
): Promise<void> {
  // Check provider availability
  const provider = await core.contextManager.getProvider(repoPath);
  if (!provider) {
    await ctx.reply(
      `⚠️ <b>Entire not enabled in <code>${escapeHtml(repoPath)}</code></b>\n\n` +
        `To enable conversation history tracking:\n` +
        `<code>cd ${escapeHtml(repoPath)} && npx entire enable</code>\n\n` +
        `Learn more: https://docs.entire.io/getting-started`,
      { parse_mode: "HTML" },
    );
    return;
  }

  // Scan sessions
  const fullQuery: ContextQuery = { ...query, repoPath };

  await ctx.reply(`🔍 Scanning ${query.type === "latest" ? "latest sessions" : `${query.type}: ${escapeHtml(query.value)}`}...`, { parse_mode: "HTML" });

  const listResult = await core.contextManager.listSessions(fullQuery);
  if (!listResult || listResult.sessions.length === 0) {
    await ctx.reply(
      `🔍 <b>No sessions found</b>\n\n` +
        `Query: <code>${escapeHtml(query.type)}: ${escapeHtml(query.value)}</code>\n` +
        `Repo: <code>${escapeHtml(repoPath)}</code>`,
      { parse_mode: "HTML" },
    );
    return;
  }

  const config = core.configManager.get();
  const agentName = config.defaultAgent;

  let threadId: number | undefined;
  try {
    // Create topic FIRST (before session events fire — prevent race condition)
    const queryLabel = query.type === "latest" ? "latest" : `${query.type}: ${query.value.slice(0, 20)}`;
    const topicName = `📜 Resume — ${queryLabel}`;
    threadId = await createSessionTopic(botFromCtx(ctx), chatId, topicName);

    await ctx.api.sendMessage(chatId, `⏳ Loading context and starting session...`, {
      message_thread_id: threadId,
      parse_mode: "HTML",
    });

    // TODO: Over-budget interactive selection not yet implemented (F7)
    // Spec says: show options when context > 30K tokens, auto-select after 60s

    const { session, contextResult } = await core.createSessionWithContext({
      channelId: "telegram",
      agentName,
      workingDirectory: repoPath,
      contextQuery: fullQuery,
      contextOptions: { maxTokens: DEFAULT_MAX_TOKENS },
      threadId: String(threadId),
    });

    // Build summary info
    const sessionCount = contextResult?.sessionCount ?? listResult.sessions.length;
    const mode = contextResult?.mode ?? "full";
    const tokens = contextResult?.tokenEstimate ?? listResult.estimatedTokens;

    const topicLink = buildDeepLink(chatId, threadId);
    const replyTarget = ctx.message?.message_thread_id;

    if (replyTarget !== threadId) {
      await ctx.reply(
        `✅ Session resumed → <a href="${topicLink}">Open topic</a>`,
        { parse_mode: "HTML" },
      );
    }

    const resumeHeading =
      `✅ <b>Session resumed with context</b>\n` +
      `<b>Sessions loaded:</b> ${sessionCount}\n` +
      `<b>Mode:</b> ${escapeHtml(mode)}\n` +
      `<b>~Tokens:</b> ${tokens.toLocaleString()}`;
    const controlMsg = await ctx.api.sendMessage(
      chatId,
      buildSessionStatusText(session, resumeHeading),
      {
        message_thread_id: threadId,
        parse_mode: "HTML",
        reply_markup: buildSessionControlKeyboard(session.id, false, false),
      },
    );

    onControlMessage?.(session.id, controlMsg.message_id);

  } catch (err) {
    log.error({ err }, "Resume session creation failed");
    if (threadId) {
      try {
        await ctx.api.deleteForumTopic(chatId, threadId);
      } catch { /* ignore cleanup failures */ }
    }
    const message = err instanceof Error ? err.message : (typeof err === "object" ? JSON.stringify(err) : String(err));
    await ctx.reply(`❌ ${escapeHtml(message)}`, { parse_mode: "HTML" });
  }
}

// --- Main handler ---

/**
 * Handle `/resume [args]` — create a new session with Entire.io conversation context.
 *
 * Parses the args into a ContextQuery, resolves the default workspace, checks that
 * the Entire provider is enabled, then creates the session with historical context
 * loaded. Creates the forum topic before calling `createSessionWithContext` to
 * avoid a race where session events fire before the thread is ready.
 */
export async function handleResume(
  ctx: Context,
  core: VibenCore,
  chatId: number,
  assistant?: CommandsAssistantContext,
  onControlMessage?: (sessionId: string, msgId: number) => void,
): Promise<void> {
  const rawMatch = (ctx as Context & { match: unknown }).match;
  const matchStr = typeof rawMatch === "string" ? rawMatch : "";

  const parsed = parseResumeArgs(matchStr);
  if (!parsed) {
    await ctx.reply(
      `❌ <b>Invalid arguments.</b>\n\n` +
        `Usage examples:\n` +
        `• <code>/resume</code> — latest 5 sessions\n` +
        `• <code>/resume pr 19</code>\n` +
        `• <code>/resume branch main</code>\n` +
        `• <code>/resume commit e0dd2fa4</code>\n` +
        `• <code>/resume f634acf05138</code> — checkpoint ID\n` +
        `• <code>/resume https://entire.io/gh/.../checkpoints/.../2e884e2c402a</code>\n` +
        `• <code>/resume https://entire.io/gh/.../commit/e0dd2fa4...</code>`,
      { parse_mode: "HTML" },
    );
    return;
  }

  const { query } = parsed;

  // Use default workspace directory (derived from instance root)
  const resolved = core.configManager.resolveWorkspace();
  await executeResume(ctx, core, chatId, query, resolved, onControlMessage);
}

// setupResumeCallbacks is retained as a no-op for backward compatibility
// (callers may still reference it; workspace picker was removed in favor of assistant-driven flow)
export function setupResumeCallbacks(
  _bot: Bot,
  _core: VibenCore,
  _chatId: number,
  _onControlMessage?: (sessionId: string, msgId: number) => void,
): void {
  // No-op: workspace picker callbacks removed
}
