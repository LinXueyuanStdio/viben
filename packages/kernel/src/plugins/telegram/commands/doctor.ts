import type { Bot, Context } from "grammy";
import { InlineKeyboard } from "grammy";
import type { VibenCore } from "../../../core/index.js";
import { DoctorEngine } from "../../../core/doctor/index.js";
import type { DoctorReport, PendingFix } from "../../../core/doctor/types.js";
import { createChildLogger } from "../../../core/utils/log.js";

const log = createChildLogger({ module: "telegram-cmd-doctor" });

const pendingFixesStore = new Map<string, PendingFix[]>();

function renderReport(report: DoctorReport): { text: string; keyboard: InlineKeyboard | undefined } {
  const icons = { pass: "✅", warn: "⚠️", fail: "❌" };
  const lines: string[] = ["🩺 <b>Viben Doctor</b>\n"];

  for (const category of report.categories) {
    lines.push(`<b>${category.name}</b>`);
    for (const result of category.results) {
      lines.push(`  ${icons[result.status]} ${escapeHtml(result.message)}`);
    }
    lines.push("");
  }

  const { passed, warnings, failed, fixed } = report.summary;
  const fixedStr = fixed > 0 ? `, ${fixed} fixed` : "";
  lines.push(`<b>Result:</b> ${passed} passed, ${warnings} warnings, ${failed} failed${fixedStr}`);

  let keyboard: InlineKeyboard | undefined;
  if (report.pendingFixes.length > 0) {
    keyboard = new InlineKeyboard();
    for (let i = 0; i < report.pendingFixes.length; i++) {
      const label = `🔧 Fix: ${report.pendingFixes[i].message.slice(0, 30)}`;
      keyboard.text(label, `m:doctor:fix:${i}`).row();
    }
  }

  return { text: lines.join("\n"), keyboard };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Handle `/doctor` — run all system diagnostic checks and display the report.
 *
 * Sends an initial "running…" message, runs `DoctorEngine.runAll()`, then
 * edits the message with the report. Pending fixes are stored per-message so
 * the `m:doctor:fix:<index>` callbacks know which fixes to apply.
 */
export async function handleDoctor(ctx: Context, core: VibenCore): Promise<void> {
  const statusMsg = await ctx.reply("🩺 Running diagnostics...", { parse_mode: "HTML" });

  try {
    const engine = new DoctorEngine({ dataDir: core.instanceContext.root });
    const report = await engine.runAll();
    const { text, keyboard } = renderReport(report);

    const storeKey = `${ctx.chat!.id}:${statusMsg.message_id}`;
    if (report.pendingFixes.length > 0) {
      pendingFixesStore.set(storeKey, report.pendingFixes);
    }

    await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (err) {
    log.error({ err }, "Doctor command failed");
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `❌ Doctor failed: ${err instanceof Error ? err.message : String(err)}`,
      { parse_mode: "HTML" },
    );
  }
}

export function setupDoctorCallbacks(bot: Bot, core: VibenCore): void {
  bot.callbackQuery(/^m:doctor:fix:/, async (ctx) => {
    const data = ctx.callbackQuery.data;
    const index = parseInt(data.replace("m:doctor:fix:", ""), 10);
    const chatId = ctx.callbackQuery.message?.chat.id;
    const messageId = ctx.callbackQuery.message?.message_id;

    try {
      await ctx.answerCallbackQuery({ text: "Applying fix..." });
    } catch { /* expired */ }

    if (chatId === undefined || messageId === undefined) return;

    const storeKey = `${chatId}:${messageId}`;
    const fixes = pendingFixesStore.get(storeKey);
    if (!fixes || index < 0 || index >= fixes.length) {
      try { await ctx.answerCallbackQuery({ text: "Fix no longer available" }); } catch { /* */ }
      return;
    }

    const pending = fixes[index];
    try {
      const result = await pending.fix();
      if (result.success) {
        const engine = new DoctorEngine({ dataDir: core.instanceContext.root });
        const report = await engine.runAll();
        const { text, keyboard } = renderReport(report);

        if (report.pendingFixes.length > 0) {
          pendingFixesStore.set(storeKey, report.pendingFixes);
        } else {
          pendingFixesStore.delete(storeKey);
        }

        await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
      } else {
        try { await ctx.answerCallbackQuery({ text: `Fix failed: ${result.message}` }); } catch { /* */ }
      }
    } catch (err) {
      log.error({ err, index }, "Doctor fix callback failed");
    }
  });

  bot.callbackQuery("m:doctor", async (ctx) => {
    try { await ctx.answerCallbackQuery(); } catch { /* */ }
    await handleDoctor(ctx, core);
  });
}
