import type { Bot, Context } from "grammy";
import type { VibenCore } from "../../../core/index.js";

// Domain modules
import { handleNew, handleNewChat, createSessionDirect, showAgentPicker, setupNewSessionCallbacks } from './new-session.js'
import { handleCancel, handleStatus, handleTopics, handleArchive, handleArchiveConfirm, setupSessionCallbacks } from './session.js'
import { handleUpdate, handleRestart, handleTTS, handleVerbosity, handleOutputMode } from './admin.js'
import { handleMenu, handleHelp, buildMenuKeyboard } from './menu.js'
import { handleAgents, handleInstall, handleAgentCallback } from "./agents.js";
import { handleIntegrate } from "./integrate.js";
import { showModelPage } from './model.js'
import {
  handleResume,
  setupResumeCallbacks,
} from "./resume.js";
import { handleSettings, setupSettingsCallbacks } from "./settings.js";
import { handleDoctor, setupDoctorCallbacks } from "./doctor.js";
import { handleTunnel, handleTunnels, setupTunnelCallbacks } from "./tunnel.js";
import { handleSwitch, setupSwitchCallbacks } from "./switch.js";
import type { CommandRegistry } from "../../../core/command-registry.js";
import type { MenuRegistry } from "../../../core/menu-registry.js";
import { TELEGRAM_OVERRIDES } from './telegram-overrides.js'
import { createChildLogger } from '../../../core/utils/log.js'
const log = createChildLogger({ module: 'telegram-menu-callbacks' })

/**
 * Register all callback query handlers for the Telegram bot.
 *
 * Handler registration order is significant in grammY: more specific prefix
 * handlers (ns:, ar:, ag:) must be registered before the broad `m:` dispatcher,
 * otherwise the broad handler would consume callbacks intended for specific flows.
 */
export function setupAllCallbacks(
  bot: Bot,
  core: VibenCore,
  chatId: number,
  systemTopicIds?: { notificationTopicId: number; assistantTopicId: number },
  getAssistantSession?: () =>
    | { topicId: number; enqueuePrompt: (p: string) => Promise<string> }
    | undefined,
  onControlMessage?: (sessionId: string, msgId: number) => void,
): void {
  // Register specific prefix handlers FIRST (grammY middleware order matters)
  setupResumeCallbacks(bot, core, chatId, onControlMessage);
  setupSessionCallbacks(bot, core, chatId, systemTopicIds);

  // Settings handlers — must be before broad m: handler
  setupSettingsCallbacks(bot, core, getAssistantSession ?? (() => undefined));

  // Doctor handlers — must be before broad m: handler
  setupDoctorCallbacks(bot, core);

  // Tunnel callbacks — must be before broad m: handler
  setupTunnelCallbacks(bot, core);

  // Switch agent callbacks — must be before broad m: handler
  setupSwitchCallbacks(bot, core);

  // Agent callbacks (install + pagination) — must be before broad m: handler
  bot.callbackQuery(/^ag:/, (ctx) => handleAgentCallback(ctx, core));

  // Model pagination callbacks — must be before broad m: handler
  bot.callbackQuery(/^mod:/, async (ctx) => {
    const page = parseInt(ctx.callbackQuery.data.replace('mod:', ''), 10)
    try { await ctx.answerCallbackQuery() } catch { /* expired */ }
    await showModelPage(ctx, core, page, 'edit')
  })

  // New session with specific agent callback — must be before broad m: handler
  bot.callbackQuery(/^na:/, async (ctx) => {
    const agentKey = ctx.callbackQuery.data!.replace("na:", "");
    await ctx.answerCallbackQuery();
    await createSessionDirect(
      ctx,
      core,
      chatId,
      agentKey,
      core.configManager.resolveWorkspace(),
    );
  });

  // New Session button flow — must be before broad m: handler
  setupNewSessionCallbacks(bot, core, chatId);

  // Archive confirmation callbacks
  bot.callbackQuery(/^ar:/, (ctx) => handleArchiveConfirm(ctx, core, chatId));

  // Broad m: handler for MenuRegistry dispatch — LAST
  bot.callbackQuery(/^m:/, async (ctx) => {
    const itemId = ctx.callbackQuery.data.replace('m:', '')
    try { await ctx.answerCallbackQuery() } catch { /* expired */ }

    const menuRegistry = core.lifecycleManager?.serviceRegistry?.get('menu-registry') as MenuRegistry | undefined
    if (!menuRegistry) return

    const item = menuRegistry.getItem(itemId)
    if (!item) {
      log.warn({ itemId }, 'Menu item not found in registry')
      return
    }

    const topicId = ctx.callbackQuery.message?.message_thread_id
    const registry = core.lifecycleManager?.serviceRegistry?.get('command-registry') as CommandRegistry | undefined

    switch (item.action.type) {
      case 'command': {
        // Check Telegram-specific override first
        const cmdName = item.action.command.replace(/^\//, '').split(' ')[0]
        const telegramOverride = TELEGRAM_OVERRIDES[cmdName]
        if (telegramOverride) {
          try {
            await telegramOverride(ctx, core)
          } catch (err) {
            await ctx.reply(`⚠️ Command failed: ${String(err)}`).catch(() => {})
          }
          break
        }

        // Fallback: dispatch through CommandRegistry for commands without overrides
        if (!registry) return
        const response = await registry.execute(item.action.command, {
          raw: '',
          channelId: 'telegram',
          userId: String(ctx.from.id),
          sessionId: null,
          reply: async () => {},
        })
        if (response.type !== 'delegated' && response.type !== 'silent') {
          if (response.type === 'text') {
            await ctx.reply(response.text, { parse_mode: 'HTML' }).catch(() => {})
          } else if (response.type === 'error') {
            await ctx.reply(`⚠️ ${response.message}`).catch(() => {})
          } else if (response.type === 'list') {
            const lines = response.items.map((i: { label: string; detail?: string }) => `• ${i.label}${i.detail ? ` — ${i.detail}` : ''}`).join('\n')
            await ctx.reply(`${response.title}\n${lines}`, { parse_mode: 'HTML' }).catch(() => {})
          } else if (response.type === 'menu') {
            const { InlineKeyboard } = await import('grammy')
            const kb = new InlineKeyboard()
            for (const opt of response.options) {
              kb.text(opt.label, `c/${opt.command}`).row()
            }
            await ctx.reply(response.title, { parse_mode: 'HTML', reply_markup: kb }).catch(() => {})
          } else if (response.type === 'confirm') {
            const { InlineKeyboard } = await import('grammy')
            const kb = new InlineKeyboard()
              .text('✅ Yes', `c/${response.onYes}`)
              .text('❌ No', `c/${response.onNo}`)
            await ctx.reply(response.question, { reply_markup: kb }).catch(() => {})
          }
        }
        break
      }
      case 'delegate': {
        // Telegram-specific override: New Session uses button flow instead of AI
        if (itemId === 'core:new') {
          await showAgentPicker(ctx, core, chatId)
          break
        }

        const assistant = core.assistantManager?.get('telegram')
        if (assistant) {
          if (topicId && systemTopicIds && topicId !== systemTopicIds.assistantTopicId) {
            const { redirectToAssistant } = await import('../assistant.js')
            await ctx.reply(redirectToAssistant(chatId, systemTopicIds.assistantTopicId), { parse_mode: 'HTML' }).catch(() => {})
          } else {
            await assistant.enqueuePrompt(item.action.prompt)
          }
        } else {
          await ctx.reply('⚠️ Assistant is not available.').catch(() => {})
        }
        break
      }
      case 'callback': {
        const cbData = item.action.callbackData
        if (cbData === 's:settings') {
          await handleSettings(ctx, core)
        }
        break
      }
    }
  })
}

// Backward compat alias
export { setupAllCallbacks as setupMenuCallbacks };

// Re-exports for external consumers (adapter.ts)
export { buildMenuKeyboard } from "./menu.js";
export { buildSkillMessages } from "./menu.js";
export { TELEGRAM_OVERRIDES } from './telegram-overrides.js'
export {
  executeNewSession,
} from "./new-session.js";
export { executeCancelSession } from "./session.js";
export {
  setupDangerousModeCallbacks,
  buildDangerousModeKeyboard,
} from "./admin.js";
export {
  setupTTSCallbacks,
  setupVerbosityCallbacks,
  buildTTSKeyboard,
  buildSessionControlKeyboard,
  handleTTS,
  handleVerbosity,
  handleOutputMode,
} from "./admin.js";
export { setupIntegrateCallbacks } from "./integrate.js";
export { setupSettingsCallbacks } from "./settings.js";
export { setupDoctorCallbacks } from "./doctor.js";
export { setupResumeCallbacks } from "./resume.js";

export const STATIC_COMMANDS = [
  { command: "new", description: "Create new session" },
  { command: "newchat", description: "New chat, same agent & workspace" },
  { command: "cancel", description: "Cancel current session" },
  { command: "status", description: "Show status" },
  { command: "sessions", description: "List all sessions" },
  { command: "agents", description: "List available agents" },
  { command: "install", description: "Install a new agent" },
  { command: "help", description: "Help" },
  { command: "menu", description: "Show menu" },
  { command: "integrate", description: "Manage agent integrations" },
  { command: "handoff", description: "Continue this session in your terminal" },
  { command: "restart", description: "Restart Viben" },
  { command: "update", description: "Update to latest version and restart" },
  { command: "doctor", description: "Run system diagnostics" },
  { command: "retry", description: "Re-check setup prerequisites (use if bot is stuck on startup)" },
  { command: "tunnel", description: "Create/stop tunnel for a local port" },
  { command: "tunnels", description: "List active tunnels" },
  { command: 'archive', description: 'Archive session topic (recreate with clean history)' },
  { command: 'text_to_speech', description: 'Toggle Text to Speech (/text_to_speech on, /text_to_speech off)' },
  { command: 'verbosity', description: 'Deprecated: use /outputmode instead' },
  { command: "outputmode", description: "Control output display level (low/medium/high)" },
  { command: 'resume', description: 'Resume with conversation history from Entire checkpoints' },
  { command: 'switch', description: 'Switch agent in current session' },
  { command: 'mode', description: 'Change session mode' },
  { command: 'model', description: 'Change AI model' },
  { command: 'thought', description: 'Change thinking level' },
  { command: 'bypass_permissions', description: 'Toggle bypass permissions (on/off)' },
];
