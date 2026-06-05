import type { Bot } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { nanoid } from 'nanoid'
import type { PermissionRequest, NotificationMessage, Session } from '../../core/index.js'
import { escapeHtml } from './formatting.js'
import { buildDeepLink } from './topics.js'
import { createChildLogger } from '../../core/utils/log.js'
const log = createChildLogger({ module: 'telegram-permissions' })

// In-memory map from short callback key → pending permission data.
// Keys are 8-character nanoid strings to stay within Telegram's 64-byte callback_data limit.
interface PendingPermission {
  sessionId: string
  requestId: string
  options: { id: string; isAllow: boolean }[]
}

/**
 * Renders PermissionRequest objects as Telegram inline keyboard buttons and
 * routes the user's approval/denial back to the PermissionGate.
 *
 * Each request is assigned a short callback key (`p:<key>:<optionId>`) to avoid
 * Telegram's 64-byte limit on callback_data. The resolved option is passed to
 * `session.permissionGate.resolve()` to unblock the waiting agent prompt.
 */
export class PermissionHandler {
  private pending: Map<string, PendingPermission> = new Map()

  constructor(
    private bot: Bot,
    private chatId: number,
    private getSession: (sessionId: string) => Session | undefined,
    private sendNotification: (notification: NotificationMessage) => Promise<void>,
  ) {}

  /**
   * Send a permission request to the session's topic as an inline keyboard message,
   * and fire a notification to the Notifications topic so the user is alerted.
   *
   * Each button encodes `p:<callbackKey>:<optionId>`. The callbackKey is a short
   * nanoid that maps to the full pending state stored in-memory, avoiding the
   * 64-byte Telegram callback_data limit.
   */
  async sendPermissionRequest(session: Session, request: PermissionRequest): Promise<void> {
    const threadId = Number(session.threadId)

    // nanoid(8) = 8-char key; well within the 64-byte callback_data budget
    const callbackKey = nanoid(8)
    this.pending.set(callbackKey, {
      sessionId: session.id,
      requestId: request.id,
      options: request.options.map(o => ({ id: o.id, isAllow: o.isAllow })),
    })

    // Build inline keyboard
    const keyboard = new InlineKeyboard()
    for (const option of request.options) {
      const emoji = option.isAllow ? '✅' : '❌'
      keyboard.text(`${emoji} ${option.label}`, `p:${callbackKey}:${option.id}`)
    }

    // Send in session topic WITH notification
    const msg = await this.bot.api.sendMessage(this.chatId,
      `🔐 <b>Permission request:</b>\n\n${escapeHtml(request.description)}`,
      {
        message_thread_id: threadId,
        parse_mode: 'HTML',
        reply_markup: keyboard,
        disable_notification: false,
      }
    )

    // Deep link for notification — include threadId so link navigates into the topic
    const deepLink = buildDeepLink(this.chatId, threadId, msg.message_id)

    // Notify in notification topic (fire-and-forget to avoid sendQueue deadlock:
    // this method runs INSIDE a sendQueue item, so awaiting another enqueue() deadlocks)
    void this.sendNotification({
      sessionId: session.id,
      sessionName: session.name,
      type: 'permission',
      summary: request.description,
      deepLink,
    })
  }

  /**
   * Register the `p:` callback handler in the bot's middleware chain.
   *
   * Must be called during setup so grammY processes permission responses
   * before other generic callback handlers.
   */
  setupCallbackHandler(): void {
    this.bot.on('callback_query:data', async (ctx, next) => {
      const data = ctx.callbackQuery.data
      // Only handle permission callbacks; pass everything else to the next handler
      if (!data.startsWith('p:')) return next()

      const parts = data.split(':')
      if (parts.length < 3) return next()
      const [, callbackKey, optionId] = parts

      const pending = this.pending.get(callbackKey)
      if (!pending) {
        try { await ctx.answerCallbackQuery({ text: '❌ Expired' }) } catch { /* old query */ }
        return
      }

      const session = this.getSession(pending.sessionId)
      const isAllow = pending.options.find(o => o.id === optionId)?.isAllow ?? false
      log.info({ requestId: pending.requestId, optionId, isAllow }, 'Permission responded')
      if (session?.permissionGate.requestId === pending.requestId) {
        session.permissionGate.resolve(optionId)
      }
      this.pending.delete(callbackKey)

      try { await ctx.answerCallbackQuery({ text: '✅ Responded' }) } catch { /* old query */ }

      // Remove buttons
      try {
        await ctx.editMessageReplyMarkup({ reply_markup: undefined })
      } catch { /* ignore */ }
    })
  }
}
