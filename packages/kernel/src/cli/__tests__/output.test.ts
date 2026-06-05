import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('isJsonMode', () => {
  it('returns true when args contain --json', async () => {
    const { isJsonMode } = await import('../output.js')
    expect(isJsonMode(['list', '--json'])).toBe(true)
  })

  it('returns false when args do not contain --json', async () => {
    const { isJsonMode } = await import('../output.js')
    expect(isJsonMode(['list'])).toBe(false)
  })

  it('returns false for empty args', async () => {
    const { isJsonMode } = await import('../output.js')
    expect(isJsonMode([])).toBe(false)
  })

  it('returns true when --json is the only arg', async () => {
    const { isJsonMode } = await import('../output.js')
    expect(isJsonMode(['--json'])).toBe(true)
  })

  it('does not match partial flags like --json-pretty', async () => {
    const { isJsonMode } = await import('../output.js')
    expect(isJsonMode(['--json-pretty'])).toBe(false)
  })
})

describe('jsonSuccess', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('outputs valid JSON with success: true and data', async () => {
    const { jsonSuccess } = await import('../output.js')
    try { jsonSuccess({ foo: 'bar' }) } catch {}
    expect(logSpy).toHaveBeenCalledOnce()
    const output = logSpy.mock.calls[0][0] as string
    const parsed = JSON.parse(output)
    expect(parsed).toEqual({ success: true, data: { foo: 'bar' } })
  })

  it('calls process.exit(0)', async () => {
    const { jsonSuccess } = await import('../output.js')
    try { jsonSuccess({}) } catch {}
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('outputs single-line JSON (no newlines in output)', async () => {
    const { jsonSuccess } = await import('../output.js')
    try { jsonSuccess({ nested: { a: 1, b: [2, 3] } }) } catch {}
    const output = logSpy.mock.calls[0][0] as string
    expect(output).not.toContain('\n')
    JSON.parse(output) // should not throw
  })
})

describe('jsonError', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('outputs valid JSON with success: false and error object', async () => {
    const { jsonError, ErrorCodes } = await import('../output.js')
    try { jsonError(ErrorCodes.DAEMON_NOT_RUNNING, 'Not running') } catch {}
    const output = logSpy.mock.calls[0][0] as string
    const parsed = JSON.parse(output)
    expect(parsed).toEqual({
      success: false,
      error: { code: 'DAEMON_NOT_RUNNING', message: 'Not running' },
    })
  })

  it('calls process.exit(1)', async () => {
    const { jsonError, ErrorCodes } = await import('../output.js')
    try { jsonError(ErrorCodes.UNKNOWN_ERROR, 'oops') } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('outputs single-line JSON', async () => {
    const { jsonError, ErrorCodes } = await import('../output.js')
    try { jsonError(ErrorCodes.API_ERROR, 'msg') } catch {}
    const output = logSpy.mock.calls[0][0] as string
    expect(output).not.toContain('\n')
    JSON.parse(output)
  })
})

describe('ErrorCodes', () => {
  it('all values are unique strings', async () => {
    const { ErrorCodes } = await import('../output.js')
    const values = Object.values(ErrorCodes)
    expect(new Set(values).size).toBe(values.length)
    for (const v of values) {
      expect(typeof v).toBe('string')
      expect(v.length).toBeGreaterThan(0)
    }
  })
})
