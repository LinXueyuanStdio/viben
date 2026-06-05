import { describe, it, expect, vi } from 'vitest'
import { handleModel, showModelPage } from '../model.js'
import type { VibenCore } from '../../../../core/index.js'
import type { Context } from 'grammy'

function makeChoices(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    value: `model-${i}`,
    name: `Model ${i}`,
  }))
}

function makeCore(opts: {
  sessionId?: string | null
  choices?: { value: string; name: string }[]
  currentValue?: string
  noConfig?: boolean
}): VibenCore {
  const { sessionId = 'sess-1', choices = makeChoices(3), currentValue = 'model-0', noConfig = false } = opts
  const configOption = noConfig ? undefined : {
    id: 'model-opt',
    name: 'Model',
    category: 'model',
    type: 'select' as const,
    currentValue,
    options: choices,
  }
  const session = {
    getConfigByCategory: (cat: string) => cat === 'model' ? configOption : undefined,
  }
  return {
    getOrResumeSession: vi.fn().mockResolvedValue(sessionId ? { id: sessionId } : null),
    sessionManager: { getSession: vi.fn().mockReturnValue(session) },
  } as unknown as VibenCore
}

function makeCtx(opts: { topicId?: number } = {}): Context {
  return {
    message: opts.topicId != null ? { message_thread_id: opts.topicId } : undefined,
    callbackQuery: undefined,
    reply: vi.fn().mockResolvedValue(undefined),
    editMessageText: vi.fn().mockResolvedValue(undefined),
    answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
  } as unknown as Context
}

function makeCtxCallback(opts: { topicId?: number } = {}): Context {
  return {
    message: undefined,
    callbackQuery: opts.topicId != null
      ? { message: { message_thread_id: opts.topicId } }
      : { message: undefined },
    reply: vi.fn().mockResolvedValue(undefined),
    editMessageText: vi.fn().mockResolvedValue(undefined),
    answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
  } as unknown as Context
}

describe('handleModel', () => {
  it('calls showModelPage with page 0 and send action', async () => {
    const core = makeCore({ choices: makeChoices(3) })
    const ctx = makeCtx({ topicId: 42 })
    await handleModel(ctx, core)
    expect(ctx.reply).toHaveBeenCalledOnce()
    const [title, options] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(title).toContain('Choose a model')
    expect(options.reply_markup).toBeDefined()
  })

  it('replies with error when no active session', async () => {
    const core = makeCore({ sessionId: null })
    const ctx = makeCtx({ topicId: 42 })
    await handleModel(ctx, core)
    expect(ctx.reply).toHaveBeenCalledWith('⚠️ No active session. Start a session first.')
  })

  it('replies with error when model config not available', async () => {
    const core = makeCore({ noConfig: true })
    const ctx = makeCtx({ topicId: 42 })
    await handleModel(ctx, core)
    expect(ctx.reply).toHaveBeenCalledWith('⚠️ This agent does not support switching models.')
  })
})

describe('showModelPage — pagination', () => {
  it('renders all models on one page when count <= 8', async () => {
    const choices = makeChoices(5)
    const core = makeCore({ choices })
    const ctx = makeCtx({ topicId: 1 })
    await showModelPage(ctx, core, 0, 'send')
    const [title, { reply_markup }] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]
    // No page indicator when only one page
    expect(title).not.toContain('Page')
    // 5 model buttons, no nav buttons
    const buttons = reply_markup.inline_keyboard.flat()
    expect(buttons).toHaveLength(5)
  })

  it('paginates and shows nav buttons when count > 8', async () => {
    const choices = makeChoices(20)
    const core = makeCore({ choices })
    const ctx = makeCtx({ topicId: 1 })
    await showModelPage(ctx, core, 0, 'send')
    const [title, { reply_markup }] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(title).toContain('Page 1/')
    const buttons = reply_markup.inline_keyboard.flat()
    // 8 model buttons + 1 Next button (no Prev on page 0)
    const nextBtn = buttons.find((b: { callback_data: string }) => b.callback_data === 'mod:1')
    expect(nextBtn).toBeDefined()
    const prevBtn = buttons.find((b: { callback_data: string }) => b.callback_data === 'mod:-1')
    expect(prevBtn).toBeUndefined()
  })

  it('shows Prev button on page > 0', async () => {
    const choices = makeChoices(20)
    const core = makeCore({ choices })
    const ctx = makeCtx({ topicId: 1 })
    await showModelPage(ctx, core, 1, 'send')
    const [, { reply_markup }] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]
    const buttons = reply_markup.inline_keyboard.flat()
    const prevBtn = buttons.find((b: { callback_data: string }) => b.callback_data === 'mod:0')
    expect(prevBtn).toBeDefined()
  })

  it('marks the current model with a checkmark', async () => {
    const choices = makeChoices(3)
    const core = makeCore({ choices, currentValue: 'model-1' })
    const ctx = makeCtx({ topicId: 1 })
    await showModelPage(ctx, core, 0, 'send')
    const [, { reply_markup }] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]
    const buttons = reply_markup.inline_keyboard.flat()
    const activeBtn = buttons.find((b: { text: string }) => b.text.startsWith('✅'))
    expect(activeBtn?.text).toBe('✅ Model 1')
  })

  it('uses answerCallbackQuery toast when action is edit and session is missing', async () => {
    const core = makeCore({ sessionId: null })
    const ctx = makeCtxCallback({ topicId: 1 })
    await showModelPage(ctx, core, 0, 'edit')
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({ text: 'Session no longer active.' })
    expect(ctx.editMessageText).not.toHaveBeenCalled()
  })

  it('uses answerCallbackQuery toast when action is edit and model config is missing', async () => {
    const core = makeCore({ noConfig: true })
    const ctx = makeCtxCallback({ topicId: 1 })
    await showModelPage(ctx, core, 0, 'edit')
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({ text: 'This agent does not support switching models.' })
    expect(ctx.editMessageText).not.toHaveBeenCalled()
  })

  it('edits message in-place when action is edit', async () => {
    const core = makeCore({ choices: makeChoices(3) })
    const ctx = makeCtxCallback({ topicId: 1 })
    await showModelPage(ctx, core, 0, 'edit')
    expect(ctx.editMessageText).toHaveBeenCalledOnce()
    expect(ctx.reply).not.toHaveBeenCalled()
  })

  it('clamps page to valid range', async () => {
    const choices = makeChoices(5)
    const core = makeCore({ choices })
    const ctx = makeCtx({ topicId: 1 })
    // page 99 should clamp to last valid page (0, since only 1 page)
    await showModelPage(ctx, core, 99, 'send')
    expect(ctx.reply).toHaveBeenCalledOnce()
    const [title] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(title).toContain('Choose a model')
    expect(title).not.toContain('Page') // clamped to page 0 of 1 — no page indicator
  })

  it('flattens grouped choices', async () => {
    const groupedChoices = [
      { group: 'Anthropic', name: 'Anthropic', options: [{ value: 'claude-3', name: 'Claude 3' }] },
      { group: 'OpenAI', name: 'OpenAI', options: [{ value: 'gpt-4', name: 'GPT-4' }, { value: 'gpt-3.5', name: 'GPT-3.5' }] },
    ]
    const configOption = {
      id: 'model-opt',
      name: 'Model',
      category: 'model',
      type: 'select' as const,
      currentValue: 'claude-3',
      options: groupedChoices,
    }
    const session = { getConfigByCategory: (cat: string) => cat === 'model' ? configOption : undefined }
    const core = {
      getOrResumeSession: vi.fn().mockResolvedValue({ id: 'sess-1' }),
      sessionManager: { getSession: vi.fn().mockReturnValue(session) },
    } as unknown as VibenCore
    const ctx = makeCtx({ topicId: 1 })
    await showModelPage(ctx, core, 0, 'send')
    const [, { reply_markup }] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]
    const buttons = reply_markup.inline_keyboard.flat()
    // 3 total models from 2 groups
    expect(buttons).toHaveLength(3)
    expect(buttons[0].callback_data).toBe('c//model claude-3')
  })
})
