import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import type { VibenCore } from "../../../core/index.js";
import { escapeHtml } from "../formatting.js";
import { createChildLogger } from "../../../core/utils/log.js";

const log = createChildLogger({ module: "telegram-cmd-tunnel" });

/**
 * Handle `/tunnel [port] [label]` or `/tunnel stop <port>`.
 *
 * Associates the tunnel with the current session (if in a session topic) so it
 * appears in `/tunnels` session-scoped view.
 */
export async function handleTunnel(
  ctx: Context,
  core: VibenCore,
): Promise<void> {
  if (!core.tunnelService) {
    await ctx.reply("❌ Tunnel service is not enabled.", { parse_mode: "HTML" });
    return;
  }

  const match = (ctx as Context & { match?: string }).match?.trim() ?? "";

  // /tunnel stop <port>
  if (match.startsWith("stop ")) {
    const portStr = match.slice(5).trim();
    const port = parseInt(portStr, 10);
    if (isNaN(port)) {
      await ctx.reply("❌ Invalid port number.", { parse_mode: "HTML" });
      return;
    }

    try {
      await core.tunnelService.stopTunnel(port);
      await ctx.reply(`🔌 Tunnel stopped: port ${port}`, { parse_mode: "HTML" });
    } catch (err) {
      await ctx.reply(`❌ ${escapeHtml((err as Error).message)}`, { parse_mode: "HTML" });
    }
    return;
  }

  // /tunnel <port> [label]
  if (match) {
    const parts = match.split(/\s+/);
    const port = parseInt(parts[0], 10);
    if (isNaN(port)) {
      await ctx.reply("❌ Invalid port number. Usage: <code>/tunnel 3000 [label]</code>", { parse_mode: "HTML" });
      return;
    }
    const label = parts.slice(1).join(" ") || undefined;

    // Find session for this thread
    const threadId = ctx.message?.message_thread_id;
    let sessionId: string | undefined;
    if (threadId) {
      const session = core.sessionManager.getSessionByThread("telegram", String(threadId));
      if (session) sessionId = session.id;
    }

    try {
      await ctx.reply(`⏳ Starting tunnel for port ${port}...`, { parse_mode: "HTML" });
      const entry = await core.tunnelService.addTunnel(port, { label, sessionId });
      await ctx.reply(
        `🔗 <b>Tunnel active</b>\n\nPort ${port}${label ? ` (${escapeHtml(label)})` : ""}\n→ <a href="${escapeHtml(entry.publicUrl || "")}">${escapeHtml(entry.publicUrl || "")}</a>`,
        { parse_mode: "HTML" },
      );
    } catch (err) {
      await ctx.reply(`❌ ${escapeHtml((err as Error).message)}`, { parse_mode: "HTML" });
    }
    return;
  }

  // No args — show help
  await ctx.reply(
    `<b>Tunnel commands:</b>\n\n` +
    `<code>/tunnel &lt;port&gt; [label]</code> — Create tunnel\n` +
    `<code>/tunnel stop &lt;port&gt;</code> — Stop tunnel\n` +
    `<code>/tunnels</code> — List active tunnels`,
    { parse_mode: "HTML" },
  );
}

/**
 * Handle `/tunnels` — list active tunnels with stop buttons.
 * In a session topic, shows only tunnels owned by that session.
 * In other topics (assistant, general), shows all tunnels.
 */
export async function handleTunnels(
  ctx: Context,
  core: VibenCore,
): Promise<void> {
  if (!core.tunnelService) {
    await ctx.reply("❌ Tunnel service is not enabled.", { parse_mode: "HTML" });
    return;
  }

  // In session topic: show only that session's tunnels. In assistant/other: show all.
  const threadId = ctx.message?.message_thread_id;
  let entries = core.tunnelService.listTunnels();
  let sessionScoped = false;

  if (threadId) {
    const session = core.sessionManager.getSessionByThread("telegram", String(threadId));
    if (session) {
      entries = entries.filter(e => e.sessionId === session.id);
      sessionScoped = true;
    }
  }

  if (entries.length === 0) {
    const hint = sessionScoped
      ? "No tunnels for this session.\n\nUse <code>/tunnel &lt;port&gt;</code> to create one."
      : "No active tunnels.\n\nUse <code>/tunnel &lt;port&gt;</code> to create one.";
    await ctx.reply(hint, { parse_mode: "HTML" });
    return;
  }

  const lines = entries.map((e) => {
    const status = e.status === "active" ? "✅" : e.status === "starting" ? "⏳" : "❌";
    const label = e.label ? ` (${escapeHtml(e.label)})` : "";
    const url = e.publicUrl ? `\n  → <a href="${escapeHtml(e.publicUrl)}">${escapeHtml(e.publicUrl)}</a>` : "";
    return `${status} Port <b>${e.port}</b>${label}${url}`;
  });

  const keyboard = new InlineKeyboard();
  for (const e of entries) {
    keyboard.text(`🔌 Stop ${e.port}${e.label ? ` (${e.label})` : ""}`, `tn:stop:${e.port}`).row();
  }
  if (entries.length > 1) {
    keyboard.text("🔌 Stop all", "tn:stop-all").row();
  }

  await ctx.reply(
    `<b>Active tunnels:</b>\n\n${lines.join("\n\n")}`,
    { parse_mode: "HTML", reply_markup: keyboard },
  );
}

export function setupTunnelCallbacks(
  bot: import("grammy").Bot,
  core: VibenCore,
): void {
  bot.callbackQuery(/^tn:/, async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (!core.tunnelService) {
      await ctx.answerCallbackQuery({ text: "Tunnel not enabled" });
      return;
    }

    try {
      if (data === "tn:stop-all") {
        const entries = core.tunnelService.listTunnels();
        for (const e of entries) {
          try { await core.tunnelService.stopTunnel(e.port); } catch { /* ignore system */ }
        }
        await ctx.answerCallbackQuery({ text: "All tunnels stopped" });
        await ctx.editMessageText("🔌 All tunnels stopped.", { parse_mode: "HTML" });
      } else if (data.startsWith("tn:stop:")) {
        const port = parseInt(data.replace("tn:stop:", ""), 10);
        await core.tunnelService.stopTunnel(port);
        await ctx.answerCallbackQuery({ text: `Port ${port} stopped` });
        // Refresh list with keyboard
        const remaining = core.tunnelService.listTunnels();
        if (remaining.length === 0) {
          await ctx.editMessageText("🔌 All tunnels stopped.", { parse_mode: "HTML" });
        } else {
          const kb = new InlineKeyboard();
          for (const e of remaining) {
            kb.text(`🔌 Stop ${e.port}${e.label ? ` (${e.label})` : ""}`, `tn:stop:${e.port}`).row();
          }
          if (remaining.length > 1) {
            kb.text("🔌 Stop all", "tn:stop-all").row();
          }
          await ctx.editMessageText(
            `<b>Active tunnels:</b>\n\n` +
            remaining.map(e => {
              const status = e.status === "active" ? "✅" : "⏳";
              const label = e.label ? ` (${escapeHtml(e.label)})` : "";
              const url = e.publicUrl ? `\n  → <a href="${escapeHtml(e.publicUrl)}">${escapeHtml(e.publicUrl)}</a>` : "";
              return `${status} Port <b>${e.port}</b>${label}${url}`;
            }).join("\n\n"),
            { parse_mode: "HTML", reply_markup: kb },
          );
        }
      }
    } catch (err) {
      await ctx.answerCallbackQuery({ text: (err as Error).message });
    }
  });
}
