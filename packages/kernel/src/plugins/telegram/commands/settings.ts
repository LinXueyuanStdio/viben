import type { Bot, Context } from "grammy";
import { InlineKeyboard } from "grammy";
import type { VibenCore } from "../../../core/index.js";
import {
  getSafeFields,
  resolveOptions,
  getConfigValue,
  setFieldValueAsync,
  isHotReloadable,
  type ConfigFieldDef,
} from "../../../core/config/config-registry.js";
import { createChildLogger } from "../../../core/utils/log.js";

const log = createChildLogger({ module: "telegram-settings" });

async function buildSettingsKeyboard(core: VibenCore): Promise<InlineKeyboard> {
  const fields = getSafeFields();
  const kb = new InlineKeyboard();

  for (const field of fields) {
    const value = getConfigValue(core.configManager.get() as any, field.path);
    const label = formatFieldLabel(field, value);

    if (field.type === 'toggle') {
      kb.text(`${label}`, `s:toggle:${field.path}`).row();
    } else if (field.type === 'select') {
      kb.text(`${label}`, `s:select:${field.path}`).row();
    } else {
      kb.text(`${label}`, `s:input:${field.path}`).row();
    }
  }

  kb.text("◀️ Back to Menu", "s:back");
  return kb;
}

function formatFieldLabel(field: ConfigFieldDef, value: unknown): string {
  const icons: Record<string, string> = {
    agent: '🤖', logging: '📝', tunnel: '🔗',
    security: '🔒', workspace: '📁', storage: '💾', speech: '🎤',
  };
  const icon = icons[field.group] ?? '⚙️';

  if (field.type === 'toggle') {
    return `${icon} ${field.displayName}: ${value ? 'ON' : 'OFF'}`;
  }
  const displayValue = value === null || value === undefined ? 'Not set' : String(value);
  return `${icon} ${field.displayName}: ${displayValue}`;
}

/**
 * Handle `/settings` — display an inline keyboard of all safe config fields.
 * Each button triggers a toggle, select, or delegated-to-assistant input flow.
 */
export async function handleSettings(ctx: Context, core: VibenCore): Promise<void> {
  const kb = await buildSettingsKeyboard(core);
  await ctx.reply(`<b>⚙️ Settings</b>\nTap to change:`, {
    parse_mode: "HTML",
    reply_markup: kb,
  });
}

/**
 * Register all `s:` settings callback handlers.
 *
 * For string/number fields that need free-form input (`s:input:`), the
 * handler delegates to the assistant session so the user can type a value
 * conversationally rather than using a keyboard.
 *
 * STT provider selection (`s:pick:speech.stt.provider`) checks whether an
 * API key is already configured; if not, it redirects to the assistant to
 * collect the key before applying the change.
 */
export function setupSettingsCallbacks(
  bot: Bot,
  core: VibenCore,
  getAssistantSession: () => { topicId: number; enqueuePrompt: (p: string) => Promise<string> } | undefined,
): void {
  bot.callbackQuery(/^s:toggle:/, async (ctx) => {
    const fieldPath = ctx.callbackQuery.data.replace('s:toggle:', '');
    const fieldDef = getSafeFields().find(f => f.path === fieldPath);
    if (!fieldDef) return;

    const currentValue = getConfigValue(core.configManager.get() as any, fieldDef.path);
    const newValue = !currentValue;

    try {
      await setFieldValueAsync(fieldDef, newValue, core.configManager);
      const toast = isHotReloadable(fieldPath)
        ? `✅ ${fieldPath} = ${newValue}`
        : `✅ ${fieldPath} = ${newValue} (restart needed)`;
      try { await ctx.answerCallbackQuery({ text: toast }); } catch { /* expired */ }
      try {
        await ctx.editMessageReplyMarkup({ reply_markup: await buildSettingsKeyboard(core) });
      } catch { /* ignore */ }
    } catch (err) {
      log.error({ err, fieldPath }, 'Failed to toggle config');
      try { await ctx.answerCallbackQuery({ text: '❌ Failed to update' }); } catch { /* expired */ }
    }
  });

  bot.callbackQuery(/^s:select:/, async (ctx) => {
    const fieldPath = ctx.callbackQuery.data.replace('s:select:', '');
    const config = core.configManager.get();
    const fieldDef = getSafeFields().find(f => f.path === fieldPath);
    if (!fieldDef) return;

    const options = resolveOptions(fieldDef, config) ?? [];
    const currentValue = getConfigValue(core.configManager.get() as any, fieldDef.path);
    const kb = new InlineKeyboard();

    for (const opt of options) {
      const marker = opt === String(currentValue) ? ' ✓' : '';
      kb.text(`${opt}${marker}`, `s:pick:${fieldPath}:${opt}`).row();
    }
    kb.text("◀️ Back", "s:back:refresh");

    try { await ctx.answerCallbackQuery(); } catch { /* expired */ }

    try {
      await ctx.editMessageText(`<b>⚙️ ${fieldDef.displayName}</b>\nSelect a value:`, {
        parse_mode: "HTML",
        reply_markup: kb,
      });
    } catch { /* ignore */ }
  });

  bot.callbackQuery(/^s:pick:/, async (ctx) => {
    const parts = ctx.callbackQuery.data.replace('s:pick:', '').split(':');
    const fieldPath = parts.slice(0, -1).join(':');
    const newValue = parts[parts.length - 1];
    const fieldDef = getSafeFields().find(f => f.path === fieldPath);
    if (!fieldDef) return;

    try {
      // For speech.stt.provider: check if the selected provider has an API key configured
      if (fieldPath === 'speech.stt.provider') {
        const sm = core.settingsManager;
        let hasApiKey = false;
        if (sm) {
          const speechSettings = await sm.loadSettings('@viben/speech');
          hasApiKey = !!(speechSettings.groqApiKey as string);
        } else {
          // speech config migrated to plugin settings; no API key available without settingsManager
          hasApiKey = false;
        }
        if (!hasApiKey) {
          // No API key — delegate to assistant to collect it
          const assistant = getAssistantSession();
          if (assistant) {
            try { await ctx.answerCallbackQuery({ text: `🔑 API key needed — check Assistant topic` }); } catch { /* expired */ }
            const prompt = `User wants to enable ${newValue} as Speech-to-Text provider, but no API key is configured yet. Guide them to get a ${newValue} API key and set it up. After they provide the key, run both commands: \`viben config set speech.stt.providers.${newValue}.apiKey <key>\` and \`viben config set speech.stt.provider ${newValue}\``;
            await assistant.enqueuePrompt(prompt);
            return;
          }
          // No assistant — just warn
          try { await ctx.answerCallbackQuery({ text: `⚠️ Set API key first: viben config set speech.stt.providers.${newValue}.apiKey <key>` }); } catch { /* expired */ }
          return;
        }
      }

      await setFieldValueAsync(fieldDef, newValue, core.configManager);

      try { await ctx.answerCallbackQuery({ text: `✅ ${fieldPath} = ${newValue}` }); } catch { /* expired */ }
      try {
        await ctx.editMessageText(`<b>⚙️ Settings</b>\nTap to change:`, {
          parse_mode: "HTML",
          reply_markup: await buildSettingsKeyboard(core),
        });
      } catch { /* ignore */ }
    } catch (err) {
      log.error({ err, fieldPath }, 'Failed to set config');
      try { await ctx.answerCallbackQuery({ text: '❌ Failed to update' }); } catch { /* expired */ }
    }
  });

  bot.callbackQuery(/^s:input:/, async (ctx) => {
    const fieldPath = ctx.callbackQuery.data.replace('s:input:', '');
    const fieldDef = getSafeFields().find(f => f.path === fieldPath);
    if (!fieldDef) return;

    const currentValue = getConfigValue(core.configManager.get() as any, fieldDef.path);
    const assistant = getAssistantSession();

    if (!assistant) {
      try { await ctx.answerCallbackQuery({ text: '⚠️ Start the assistant first (/assistant)' }); } catch { /* expired */ }
      return;
    }

    try { await ctx.answerCallbackQuery({ text: `Delegating to assistant...` }); } catch { /* expired */ }

    const prompt = `User wants to change ${fieldDef.displayName} (config path: ${fieldPath}). Current value: ${JSON.stringify(currentValue)}. Ask them for the new value and apply it using: viben config set ${fieldPath} <value>`;
    await assistant.enqueuePrompt(prompt);
  });

  bot.callbackQuery("s:back", async (ctx) => {
    try { await ctx.answerCallbackQuery(); } catch { /* expired */ }
    const { buildMenuKeyboard } = await import('./menu.js');
    const menuRegistry = core.lifecycleManager?.serviceRegistry?.get('menu-registry') as import('../../../core/menu-registry.js').MenuRegistry | undefined;
    try {
      await ctx.editMessageText(`<b>Viben Menu</b>\nChoose an action:`, {
        parse_mode: "HTML",
        reply_markup: buildMenuKeyboard(menuRegistry),
      });
    } catch { /* ignore */ }
  });

  bot.callbackQuery("s:back:refresh", async (ctx) => {
    try { await ctx.answerCallbackQuery(); } catch { /* expired */ }
    try {
      await ctx.editMessageText(`<b>⚙️ Settings</b>\nTap to change:`, {
        parse_mode: "HTML",
        reply_markup: await buildSettingsKeyboard(core),
      });
    } catch { /* ignore */ }
  });
}
