import type { Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import type { VibenCore } from '../../../core/index.js'
import type { ConfigSelectChoice, ConfigSelectGroup } from '../../../core/types.js'

const MODELS_PER_PAGE = 8

function flattenChoices(options: (ConfigSelectChoice | ConfigSelectGroup)[]): ConfigSelectChoice[] {
  const result: ConfigSelectChoice[] = []
  for (const item of options) {
    if ('group' in item && 'options' in item) {
      result.push(...(item as ConfigSelectGroup).options)
    } else {
      result.push(item as ConfigSelectChoice)
    }
  }
  return result
}

/**
 * Entry point for /model — shows page 0 of the paginated model selection menu.
 * Registered in TELEGRAM_OVERRIDES to intercept both direct-command and menu-callback flows.
 */
export async function handleModel(ctx: Context, core: VibenCore): Promise<void> {
  await showModelPage(ctx, core, 0, 'send')
}

/**
 * Render a paginated model selection keyboard.
 *
 * Model buttons use `c//model <value>` callback data, handled by the existing
 * c/ dispatcher in adapter.ts. Navigation buttons use `mod:<page>`.
 */
export async function showModelPage(
  ctx: Context,
  core: VibenCore,
  page: number,
  action: 'send' | 'edit',
): Promise<void> {
  const topicId = (ctx.message ?? ctx.callbackQuery?.message)?.message_thread_id

  const sessionId = topicId != null
    ? ((await core.getOrResumeSession('telegram', String(topicId)))?.id ?? null)
    : null

  if (!sessionId) {
    if (action === 'edit') {
      await ctx.answerCallbackQuery({ text: 'Session no longer active.' }).catch(() => {})
    } else {
      await ctx.reply('⚠️ No active session. Start a session first.').catch(() => {})
    }
    return
  }

  const session = core.sessionManager.getSession(sessionId)
  const configOption = session?.getConfigByCategory('model')

  if (!configOption || configOption.type !== 'select') {
    if (action === 'edit') {
      await ctx.answerCallbackQuery({ text: 'This agent does not support switching models.' }).catch(() => {})
    } else {
      await ctx.reply('⚠️ This agent does not support switching models.').catch(() => {})
    }
    return
  }

  const choices = flattenChoices(configOption.options)
  const totalPages = Math.ceil(choices.length / MODELS_PER_PAGE)
  const safePage = Math.max(0, Math.min(page, totalPages - 1))
  const pageChoices = choices.slice(safePage * MODELS_PER_PAGE, (safePage + 1) * MODELS_PER_PAGE)

  const currentChoice = choices.find(c => c.value === configOption.currentValue)
  const currentLabel = currentChoice?.name ?? String(configOption.currentValue)
  const pageInfo = totalPages > 1 ? ` — Page ${safePage + 1}/${totalPages}` : ''
  const title = `Choose a model (current: ${currentLabel})${pageInfo}`

  const kb = new InlineKeyboard()
  for (const choice of pageChoices) {
    const label = choice.value === configOption.currentValue ? `✅ ${choice.name}` : choice.name
    kb.text(label, `c//model ${choice.value}`).row()
  }

  // Navigation row — only shown when there is more than one page
  if (totalPages > 1) {
    if (safePage > 0) kb.text('◀️ Prev', `mod:${safePage - 1}`)
    if (safePage < totalPages - 1) kb.text('Next ▶️', `mod:${safePage + 1}`)
    kb.row()
  }

  if (action === 'edit') {
    await ctx.editMessageText(title, { reply_markup: kb }).catch(() => {})
  } else {
    await ctx.reply(title, { reply_markup: kb }).catch(() => {})
  }
}
