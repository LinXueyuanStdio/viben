import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Bot, Context } from 'grammy'
import type { VibenCore } from '../../../../core/index.js'

const doctorMocks = vi.hoisted(() => {
  const state = {
    options: [] as unknown[],
    runAll: vi.fn(),
    DoctorEngine: undefined as unknown as ReturnType<typeof vi.fn>,
  }
  state.DoctorEngine = vi.fn(function DoctorEngineMock(options: unknown) {
    state.options.push(options)
    return { runAll: state.runAll }
  })
  return state
})

vi.mock('../../../../core/doctor/index.js', () => ({
  DoctorEngine: doctorMocks.DoctorEngine,
}))

const instanceRoot = '/tmp/viben-test/.viben'

function makeCore(): VibenCore {
  return {
    instanceContext: { root: instanceRoot },
  } as VibenCore
}

function makeReport(pendingFixes: unknown[] = []) {
  return {
    categories: [
      { name: 'Config', results: [{ status: 'pass', message: 'Config valid' }] },
    ],
    pendingFixes,
    summary: { passed: 1, warnings: 0, failed: 0, fixed: 0 },
  }
}

function makeCtx(): Context {
  return {
    chat: { id: 123 },
    reply: vi.fn().mockResolvedValue({ message_id: 456 }),
    api: { editMessageText: vi.fn().mockResolvedValue(undefined) },
  } as unknown as Context
}

describe('Telegram doctor command', () => {
  beforeEach(() => {
    doctorMocks.options = []
    doctorMocks.DoctorEngine.mockClear()
    doctorMocks.runAll.mockReset()
  })

  it('passes the active instance root to DoctorEngine', async () => {
    doctorMocks.runAll.mockResolvedValue(makeReport())
    const { handleDoctor } = await import('../doctor.js')

    await handleDoctor(makeCtx(), makeCore())

    expect(doctorMocks.DoctorEngine).toHaveBeenCalledWith({ dataDir: instanceRoot })
  })

  it('uses the active instance root when rerunning after a doctor fix', async () => {
    const fix = vi.fn().mockResolvedValue({ success: true, message: 'fixed' })
    doctorMocks.runAll
      .mockResolvedValueOnce(makeReport([{ message: 'Missing config', fix }]))
      .mockResolvedValueOnce(makeReport())

    const { handleDoctor, setupDoctorCallbacks } = await import('../doctor.js')
    const handlers: Array<{ pattern: RegExp | string; handler: (ctx: Context) => Promise<void> }> = []
    const bot = {
      callbackQuery: (pattern: RegExp | string, handler: (ctx: Context) => Promise<void>) => {
        handlers.push({ pattern, handler })
      },
    }

    await handleDoctor(makeCtx(), makeCore())
    setupDoctorCallbacks(bot as unknown as Bot, makeCore())

    const fixHandler = handlers.find(({ pattern }) => pattern instanceof RegExp)
    expect(fixHandler).toBeDefined()

    await fixHandler!.handler({
      callbackQuery: {
        data: 'm:doctor:fix:0',
        message: { chat: { id: 123 }, message_id: 456 },
      },
      answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
      editMessageText: vi.fn().mockResolvedValue(undefined),
    } as unknown as Context)

    expect(fix).toHaveBeenCalledOnce()
    expect(doctorMocks.options).toEqual([
      { dataDir: instanceRoot },
      { dataDir: instanceRoot },
    ])
  })
})
