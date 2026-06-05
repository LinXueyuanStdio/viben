import type { Bot, Context } from "grammy";
import { InlineKeyboard } from "grammy";
import type { VibenCore } from "../../../core/index.js";
import { escapeHtml } from "../formatting.js";

/**
 * Handle `/integrate` — show a list of agents with available integrations.
 * Tapping an agent opens the integration items (install/uninstall hooks).
 */
export async function handleIntegrate(ctx: Context, _core: VibenCore): Promise<void> {
  const { listIntegrations } = await import("../../../cli/integrate.js");
  const agents = listIntegrations();

  const keyboard = new InlineKeyboard();
  for (const agent of agents) {
    keyboard.text(`🤖 ${agent}`, `i:agent:${agent}`).row();
  }

  await ctx.reply(
    `<b>🔗 Integrations</b>\n\nSelect an agent to manage its integrations.`,
    { parse_mode: "HTML", reply_markup: keyboard },
  );
}

function buildAgentItemsKeyboard(agentName: string, items: import("../../../cli/integrate.js").IntegrationItem[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const item of items) {
    const installed = item.isInstalled();
    keyboard.text(
      installed ? `✅ ${item.name} — Uninstall` : `📦 ${item.name} — Install`,
      installed ? `i:uninstall:${agentName}:${item.id}` : `i:install:${agentName}:${item.id}`,
    ).row();
  }
  keyboard.text("← Back", "i:back").row();
  return keyboard;
}

export function setupIntegrateCallbacks(
  bot: Bot,
  core: VibenCore,
): void {
  bot.callbackQuery(/^i:/, async (ctx) => {
    const data = ctx.callbackQuery.data;
    try {
      await ctx.answerCallbackQuery();
    } catch {
      /* expired */
    }

    // Back to agent list
    if (data === "i:back") {
      const { listIntegrations } = await import("../../../cli/integrate.js");
      const agents = listIntegrations();
      const keyboard = new InlineKeyboard();
      for (const agent of agents) {
        keyboard.text(`🤖 ${agent}`, `i:agent:${agent}`).row();
      }
      try {
        await ctx.editMessageText(
          `<b>🔗 Integrations</b>\n\nSelect an agent to manage its integrations.`,
          { parse_mode: "HTML", reply_markup: keyboard },
        );
      } catch { /* message unchanged */ }
      return;
    }

    // Show agent items
    const agentMatch = data.match(/^i:agent:(.+)$/);
    if (agentMatch) {
      const agentName = agentMatch[1];
      const { getIntegration } = await import("../../../cli/integrate.js");
      const integration = getIntegration(agentName);
      if (!integration) {
        await ctx.reply(`❌ No integration available for '${escapeHtml(agentName)}'.`, { parse_mode: "HTML" });
        return;
      }
      const keyboard = buildAgentItemsKeyboard(agentName, integration.items);
      try {
        await ctx.editMessageText(
          `<b>🔗 ${escapeHtml(agentName)} Integrations</b>\n\n${integration.items.map((i) => `• <b>${escapeHtml(i.name)}</b> — ${escapeHtml(i.description)}`).join("\n")}`,
          { parse_mode: "HTML", reply_markup: keyboard },
        );
      } catch {
        await ctx.reply(
          `<b>🔗 ${escapeHtml(agentName)} Integrations</b>`,
          { parse_mode: "HTML", reply_markup: keyboard },
        );
      }
      return;
    }

    // Install / uninstall item
    const actionMatch = data.match(/^i:(install|uninstall):([^:]+):(.+)$/);
    if (!actionMatch) return;

    const action = actionMatch[1] as "install" | "uninstall";
    const agentName = actionMatch[2];
    const itemId = actionMatch[3];

    const { getIntegration } = await import("../../../cli/integrate.js");
    const integration = getIntegration(agentName);
    if (!integration) return;

    const item = integration.items.find((i) => i.id === itemId);
    if (!item) return;

    const result = action === "install"
      ? await item.install()
      : await item.uninstall();

    // Save state to config
    const installed = action === "install" && result.success;
    await core.configManager.save({
      integrations: {
        [agentName]: {
          installed,
          installedAt: installed ? new Date().toISOString() : undefined,
        },
      },
    });

    const statusEmoji = result.success ? "✅" : "❌";
    const actionLabel = action === "install" ? "installed" : "uninstalled";
    const logsText = result.logs.map((l) => `<code>${escapeHtml(l)}</code>`).join("\n");
    const resultText = `${statusEmoji} <b>${escapeHtml(item.name)}</b> ${actionLabel}.\n\n${logsText}`;

    const keyboard = buildAgentItemsKeyboard(agentName, integration.items);
    try {
      await ctx.editMessageText(
        `<b>🔗 ${escapeHtml(agentName)} Integrations</b>\n\n${resultText}`,
        { parse_mode: "HTML", reply_markup: keyboard },
      );
    } catch {
      await ctx.reply(resultText, { parse_mode: "HTML" });
    }
  });
}
