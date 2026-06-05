import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import type { AgentCommand } from "../../../core/index.js";
import type { MenuRegistry } from "../../../core/menu-registry.js";

/**
 * Build the main Viben menu keyboard from the MenuRegistry.
 * Falls back to a hardcoded keyboard when the registry is not available.
 * Items are grouped by their `group` property, with a row break between groups.
 */
export function buildMenuKeyboard(menuRegistry?: MenuRegistry): InlineKeyboard {
  if (!menuRegistry) {
    return new InlineKeyboard()
      .text('🆕 New Session', 'm:core:new')
      .text('📋 Sessions', 'm:core:sessions')
      .row()
      .text('📊 Status', 'm:core:status')
      .text('🤖 Agents', 'm:core:agents')
      .row()
      .text('❓ Help', 'm:core:help')
  }

  const items = menuRegistry.getItems()
  const kb = new InlineKeyboard()
  let currentGroup: string | undefined
  let rowCount = 0

  for (const item of items) {
    if (item.group !== currentGroup && rowCount > 0) {
      kb.row()
      rowCount = 0
    }
    currentGroup = item.group
    if (rowCount >= 2) {
      kb.row()
      rowCount = 0
    }
    kb.text(item.label, `m:${item.id}`)
    rowCount++
  }

  return kb
}

export async function handleMenu(ctx: Context, menuRegistry?: MenuRegistry): Promise<void> {
  await ctx.reply(`<b>Viben Menu</b>\nChoose an action:`, {
    parse_mode: "HTML",
    reply_markup: buildMenuKeyboard(menuRegistry),
  });
}

export async function handleHelp(ctx: Context): Promise<void> {
  await ctx.reply(
    `📖 <b>Viben Help</b>\n\n` +
      `🚀 <b>Getting Started</b>\n` +
      `Tap 🆕 New Session to start coding with AI.\n` +
      `Each session gets its own topic — chat there to work with the agent.\n\n` +
      `💡 <b>Common Tasks</b>\n` +
      `/new [agent] [workspace] — Create new session\n` +
      `/cancel — Cancel session (in session topic)\n` +
      `/status — Show session or system status\n` +
      `/sessions — List all sessions\n` +
      `/agents — Browse & install agents\n` +
      `/install &lt;name&gt; — Install an agent\n\n` +
      `⚙️ <b>System</b>\n` +
      `/restart — Restart Viben\n` +
      `/update — Update to latest version\n` +
      `/integrate — Manage agent integrations\n` +
      `/menu — Show action menu\n\n` +
      `🔒 <b>Session Options</b>\n` +
      `/bypass_permissions — Toggle bypass permissions\n` +
      `/handoff — Continue session in terminal\n` +
      `/archive — Archive session topic\n\n` +
      `💬 Need help? Just ask me in this topic!`,
    { parse_mode: "HTML" },
  );
}


const TELEGRAM_MSG_LIMIT = 4096;

/**
 * Build plain-text skill command messages. Each command is on its own line
 * wrapped in <code> for tap-to-copy. If the list exceeds Telegram's message
 * limit, it is split into multiple messages (cut at line boundaries).
 */
export function buildSkillMessages(commands: AgentCommand[]): string[] {
  const sorted = [...commands].sort((a, b) => a.name.localeCompare(b.name));
  const header = "🛠 <b>Available Skills</b>\n";
  const lines = sorted.map((c) => `<code>/${c.name}</code>`);

  const messages: string[] = [];
  let current = header;

  for (const line of lines) {
    const candidate = current + "\n" + line;
    if (candidate.length > TELEGRAM_MSG_LIMIT) {
      messages.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) messages.push(current);
  return messages;
}
