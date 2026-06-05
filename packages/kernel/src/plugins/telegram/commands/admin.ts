import type { Bot, Context } from "grammy";
import { InlineKeyboard } from "grammy";
import type { VibenCore } from "../../../core/index.js";
import type { Session } from "../../../core/sessions/session.js";
import { isPermissionBypass } from "../../../core/utils/bypass-detection.js";
import type { CommandRegistry } from "../../../core/command-registry.js";
import { escapeHtml } from "../formatting.js";
import { createChildLogger } from "../../../core/utils/log.js";
const log = createChildLogger({ module: "telegram-cmd-admin" });

/**
 * Return true if the session currently has bypass permissions enabled.
 * Checks both the ACP-level mode config and the client-side override flag.
 */
export function isBypassActive(session: Session): boolean {
  const modeOpt = session.getConfigByCategory("mode");
  return (modeOpt?.type === "select" && isPermissionBypass(String(modeOpt.currentValue)))
    || !!session.clientOverrides.bypassPermissions;
}

export function buildDangerousModeKeyboard(
  sessionId: string,
  enabled: boolean,
): InlineKeyboard {
  return new InlineKeyboard().text(
    enabled ? "🔐 Disable Bypass Permissions" : "☠️ Enable Bypass Permissions",
    `d:${sessionId}`,
  );
}

/**
 * Register the `d:` callback handler for bypass permissions toggle buttons.
 *
 * When the session is live in memory, the toggle is applied via the command registry
 * (/bypass_permissions) so it propagates through ACP. When the session is no longer
 * in memory (e.g. after restart), the toggle falls back to a direct store patch.
 */
export function setupDangerousModeCallbacks(bot: Bot, core: VibenCore): void {
  bot.callbackQuery(/^d:/, async (ctx) => {
    const sessionId = ctx.callbackQuery.data.slice(2);
    const session = core.sessionManager.getSession(sessionId);

    // Session live in memory — delegate to /bypass command (handles ACP + client-side fallback)
    if (session) {
      const wantOn = !isBypassActive(session);
      const toastText = wantOn
        ? "☠️ Bypass Permissions enabled — permissions auto-approved"
        : "🔐 Bypass Permissions disabled — approvals required";
      try {
        await ctx.answerCallbackQuery({ text: toastText });
      } catch {
        /* expired */
      }

      const registry = core.lifecycleManager?.serviceRegistry?.get<CommandRegistry>("command-registry");
      if (registry) {
        await registry.execute(wantOn ? "/bypass_permissions on" : "/bypass_permissions off", {
          raw: wantOn ? "on" : "off",
          sessionId,
          channelId: "telegram",
          userId: String(ctx.from?.id ?? ""),
          reply: async () => {},
        }).catch(() => {});
      }
      log.info({ sessionId, wantOn }, "Bypass permissions toggled via button");

      try {
        await ctx.editMessageText(buildSessionStatusText(session), {
          parse_mode: "HTML",
          reply_markup: buildSessionControlKeyboard(sessionId, isBypassActive(session), session.voiceMode === "on"),
        });
      } catch {
        /* ignore */
      }
      return;
    }

    // Session not in memory (e.g. after restart) — toggle directly in store
    const record = core.sessionManager.getSessionRecord(sessionId);
    if (!record || record.status === "cancelled" || record.status === "error") {
      try {
        await ctx.answerCallbackQuery({
          text: "⚠️ Session not found or already ended.",
        });
      } catch {
        /* expired */
      }
      return;
    }

    const newDangerousMode = !(record.clientOverrides?.bypassPermissions ?? record.dangerousMode ?? false);
    core.sessionManager
      .patchRecord(sessionId, { clientOverrides: { bypassPermissions: newDangerousMode } })
      .catch(() => {});
    log.info(
      { sessionId, dangerousMode: newDangerousMode },
      "Bypass permissions toggled via button (store-only, session not in memory)",
    );

    const toastText = newDangerousMode
      ? "☠️ Bypass Permissions enabled — permissions auto-approved"
      : "🔐 Bypass Permissions disabled — approvals required";
    try {
      await ctx.answerCallbackQuery({ text: toastText });
    } catch {
      /* expired */
    }

    try {
      await ctx.editMessageReplyMarkup({
        reply_markup: buildSessionControlKeyboard(
          sessionId,
          newDangerousMode,
          false,
        ),
      });
    } catch {
      /* ignore */
    }
  });
}


export function buildTTSKeyboard(
  sessionId: string,
  enabled: boolean,
): InlineKeyboard {
  return new InlineKeyboard().text(
    enabled ? "🔊 Text to Speech" : "🔇 Text to Speech",
    `v:${sessionId}`,
  );
}

export function buildSessionControlKeyboard(
  sessionId: string,
  dangerousMode: boolean,
  voiceMode: boolean,
): InlineKeyboard {
  return new InlineKeyboard()
    .text(
      dangerousMode ? "🔐 Disable Bypass Permissions" : "☠️ Enable Bypass Permissions",
      `d:${sessionId}`,
    )
    .row()
    .text(
      voiceMode ? "🔊 Text to Speech" : "🔇 Text to Speech",
      `v:${sessionId}`,
    );
}

/**
 * Build the status text shown in the session control message.
 * Includes agent, workspace, and current config info (model, thought, mode).
 */
export function buildSessionStatusText(
  session: Session,
  heading: string = "✅ New chat (same agent &amp; workspace)",
): string {
  const lines: string[] = [heading];
  lines.push(`<b>Agent:</b> ${escapeHtml(session.agentName)}`);
  lines.push(`<b>Workspace:</b> <code>${escapeHtml(session.workingDirectory)}</code>`);

  const modelOpt = session.getConfigByCategory("model");
  if (modelOpt && modelOpt.type === "select") {
    const choice = modelOpt.options
      .flatMap((o) => "group" in o ? o.options : [o])
      .find((c) => c.value === modelOpt.currentValue);
    lines.push(`<b>Model:</b> ${escapeHtml(choice?.name ?? modelOpt.currentValue)}`);
  }

  const thoughtOpt = session.getConfigByCategory("thought_level");
  if (thoughtOpt && thoughtOpt.type === "select") {
    const choice = thoughtOpt.options
      .flatMap((o) => "group" in o ? o.options : [o])
      .find((c) => c.value === thoughtOpt.currentValue);
    lines.push(`<b>Thinking:</b> ${escapeHtml(choice?.name ?? thoughtOpt.currentValue)}`);
  }

  const modeOpt = session.getConfigByCategory("mode");
  if (isBypassActive(session)) {
    lines.push(`<b>Mode:</b> ☠️ Bypass Permissions enabled`);
  } else if (modeOpt && modeOpt.type === "select") {
    const choice = modeOpt.options
      .flatMap((o) => "group" in o ? o.options : [o])
      .find((c) => c.value === modeOpt.currentValue);
    lines.push(`<b>Mode:</b> ${escapeHtml(choice?.name ?? modeOpt.currentValue)}`);
  }

  return lines.join("\n");
}

export function setupTTSCallbacks(bot: Bot, core: VibenCore): void {
  bot.callbackQuery(/^v:/, async (ctx) => {
    const sessionId = ctx.callbackQuery.data.slice(2);
    const session = core.sessionManager.getSession(sessionId);

    if (!session) {
      try {
        await ctx.answerCallbackQuery({
          text: "⚠️ Session not found or not active.",
        });
      } catch {}
      return;
    }

    // Check if TTS provider is available
    if (session.voiceMode !== "on" && !core.speechService?.isTTSAvailable()) {
      try {
        await ctx.answerCallbackQuery({
          text: "⚠️ TTS provider not installed. Use /tts install to set up.",
        });
      } catch {}
      return;
    }

    const newMode = session.voiceMode === "on" ? "off" : "on";
    session.setVoiceMode(newMode);

    const toastText =
      newMode === "on"
        ? "🔊 Text to Speech enabled"
        : "🔇 Text to Speech disabled";
    try {
      await ctx.answerCallbackQuery({ text: toastText });
    } catch {}

    try {
      const keyboard = buildSessionControlKeyboard(
        sessionId,
        isBypassActive(session),
        newMode === "on",
      );
      await ctx.editMessageText(buildSessionStatusText(session), {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    } catch {
      /* ignore */
    }
  });
}

/**
 * Handle `/text_to_speech [on|off]` — toggle TTS for the current session.
 * Must be used inside a session topic. Without an argument, enables TTS for the
 * next message only. Checks that a TTS provider is installed before enabling.
 */
export async function handleTTS(
  ctx: Context,
  core: VibenCore,
): Promise<void> {
  const threadId = ctx.message?.message_thread_id;
  if (!threadId) {
    await ctx.reply("⚠️ This command only works inside a session topic.", {
      parse_mode: "HTML",
    });
    return;
  }
  const session = await core.getOrResumeSession("telegram", String(threadId));
  if (!session) {
    await ctx.reply("⚠️ No active session in this topic.", {
      parse_mode: "HTML",
    });
    return;
  }

  const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
  const arg = args[0]?.toLowerCase();

  // Check if TTS provider is available before enabling
  if (arg === "on" || (!arg)) {
    if (!core.speechService?.isTTSAvailable()) {
      await ctx.reply(
        "⚠️ TTS provider not installed.\n\nUse <code>/tts install</code> to install Edge TTS plugin.",
        { parse_mode: "HTML" },
      );
      return;
    }
  }

  if (arg === "on") {
    session.setVoiceMode("on");
    await ctx.reply("🔊 Text to Speech enabled for this session.", {
      parse_mode: "HTML",
    });
  } else if (arg === "off") {
    session.setVoiceMode("off");
    await ctx.reply("🔇 Text to Speech disabled.", { parse_mode: "HTML" });
  } else {
    session.setVoiceMode("next");
    await ctx.reply("🔊 Text to Speech enabled for the next message.", {
      parse_mode: "HTML",
    });
  }
}

// ─── Verbosity (deprecated alias) ──────────────────────────────────────────

export async function handleVerbosity(
  ctx: Context,
  core: VibenCore,
): Promise<void> {
  // Deprecated — alias for /outputmode
  await ctx.reply("⚠️ <code>/verbosity</code> is deprecated. Use <code>/outputmode</code> instead.", { parse_mode: "HTML" });
  await handleOutputMode(ctx, core);
}

// ─── Output Mode ────────────────────────────────────────────────────────────

const OUTPUT_MODE_LABELS: Record<string, string> = {
  low: "🔇 Low",
  medium: "📊 Medium",
  high: "🔍 High",
};

/**
 * Handle `/outputmode [low|medium|high]` — set the adapter-level or session-level
 * output verbosity.
 *
 * - No args: show current mode and usage
 * - `low|medium|high`: set adapter default (persisted to config)
 * - `session low|medium|high|reset`: override for the current session only
 */
export async function handleOutputMode(
  ctx: Context,
  core: VibenCore,
): Promise<void> {
  const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
  const arg0 = args[0]?.toLowerCase();
  const arg1 = args[1]?.toLowerCase();

  // /outputmode session [low|medium|high|reset]
  if (arg0 === "session") {
    const chatId = ctx.chat?.id;
    const threadId = ctx.message?.message_thread_id;
    if (!chatId || threadId === undefined) {
      await ctx.reply("⚠️ This command must be used in a session topic.", { parse_mode: "HTML" });
      return;
    }

    const session = await core.getOrResumeSession(
      "telegram",
      String(threadId),
    );

    if (!session) {
      await ctx.reply("⚠️ No active session found for this topic.", { parse_mode: "HTML" });
      return;
    }

    if (arg1 === "reset") {
      await core.sessionManager.patchRecord(session.id, { outputMode: undefined });
      await ctx.reply("🔄 Session output mode reset to adapter default.", { parse_mode: "HTML" });
    } else if (arg1 === "low" || arg1 === "medium" || arg1 === "high") {
      await core.sessionManager.patchRecord(session.id, { outputMode: arg1 });
      await ctx.reply(
        `${OUTPUT_MODE_LABELS[arg1]} Session output mode set to <b>${arg1}</b>.`,
        { parse_mode: "HTML" },
      );
    } else {
      const record = core.sessionManager.getSessionRecord(session.id);
      const current = record?.outputMode ?? "(adapter default)";
      await ctx.reply(
        `📊 Session output mode: <b>${current}</b>\n\nUsage: <code>/outputmode session low|medium|high|reset</code>`,
        { parse_mode: "HTML" },
      );
    }
    return;
  }

  // /outputmode [low|medium|high] — adapter-level
  if (arg0 === "low" || arg0 === "medium" || arg0 === "high") {
    await core.configManager.save(
      { channels: { telegram: { outputMode: arg0 } } },
      "channels.telegram.outputMode",
    );
    await ctx.reply(
      `${OUTPUT_MODE_LABELS[arg0]} Output mode set to <b>${arg0}</b>.`,
      { parse_mode: "HTML" },
    );
  } else {
    // Read outputMode from plugin settings (migrated out of config.json)
    let current = "medium";
    if (core.settingsManager) {
      const tgSettings = await core.settingsManager.loadSettings("@viben/telegram");
      current = (tgSettings.outputMode as string) ?? "medium";
    }
    await ctx.reply(
      `📊 Current output mode: <b>${current}</b>\n\n` +
        `Usage: <code>/outputmode low|medium|high</code>\n` +
        `Session override: <code>/outputmode session low|medium|high|reset</code>\n\n` +
        `• <b>low</b> — minimal: title only\n` +
        `• <b>medium</b> — balanced: description + output summary (default)\n` +
        `• <b>high</b> — full detail: inline output, IN/OUT blocks`,
      { parse_mode: "HTML" },
    );
  }
}

export function setupVerbosityCallbacks(bot: Bot, core: VibenCore): void {
  bot.callbackQuery(/^vb:/, async (ctx) => {
    const level = ctx.callbackQuery.data.slice(3);
    if (level !== "low" && level !== "medium" && level !== "high") return;

    await core.configManager.save(
      { channels: { telegram: { outputMode: level } } },
      "channels.telegram.outputMode",
    );

    try {
      await ctx.answerCallbackQuery({
        text: `${OUTPUT_MODE_LABELS[level]} Output mode: ${level}`,
      });
    } catch {}
  });
}

/**
 * Handle `/update` — check npm for a newer version of `@viben/kernel`, install it,
 * and trigger a process restart. Edits the status message in-place as each step completes.
 */
export async function handleUpdate(
  ctx: Context,
  core: VibenCore,
): Promise<void> {
  if (!core.requestRestart) {
    await ctx.reply(
      "⚠️ Update is not available (no restart handler registered).",
      { parse_mode: "HTML" },
    );
    return;
  }

  const { getCurrentVersion, getLatestVersion, compareVersions, runUpdate } =
    await import("../../../cli/version.js");
  const current = getCurrentVersion();
  const statusMsg = await ctx.reply(
    `🔍 Checking for updates... (current: v${escapeHtml(current)})`,
    { parse_mode: "HTML" },
  );

  const latest = await getLatestVersion();
  if (!latest) {
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      "❌ Could not check for updates.",
      { parse_mode: "HTML" },
    );
    return;
  }

  if (compareVersions(current, latest) >= 0) {
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `✅ Already up to date (v${escapeHtml(current)}).`,
      { parse_mode: "HTML" },
    );
    return;
  }

  await ctx.api.editMessageText(
    ctx.chat!.id,
    statusMsg.message_id,
    `⬇️ Updating v${escapeHtml(current)} → v${escapeHtml(latest)}...`,
    { parse_mode: "HTML" },
  );

  const ok = await runUpdate();
  if (!ok) {
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      "❌ Update failed. Try manually: <code>npm install -g @viben/kernel@latest</code>",
      { parse_mode: "HTML" },
    );
    return;
  }

  await ctx.api.editMessageText(
    ctx.chat!.id,
    statusMsg.message_id,
    `✅ Updated to v${escapeHtml(latest)}. Restarting...`,
    { parse_mode: "HTML" },
  );

  await new Promise((r) => setTimeout(r, 500));
  await core.requestRestart();
}

/**
 * Handle `/restart` — confirm and trigger a process restart via `core.requestRestart()`.
 * A short delay is added so Telegram can deliver the confirmation message before shutdown.
 */
export async function handleRestart(
  ctx: Context,
  core: VibenCore,
): Promise<void> {
  if (!core.requestRestart) {
    await ctx.reply(
      "⚠️ Restart is not available (no restart handler registered).",
      { parse_mode: "HTML" },
    );
    return;
  }
  await ctx.reply(
    "🔄 <b>Restarting Viben...</b>\nRebuilding and restarting. Be back shortly.",
    { parse_mode: "HTML" },
  );
  // Give Telegram a moment to deliver the message before shutting down
  await new Promise((r) => setTimeout(r, 500));
  await core.requestRestart();
}
