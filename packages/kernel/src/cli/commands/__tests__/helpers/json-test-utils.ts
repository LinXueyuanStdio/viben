import { vi } from 'vitest'

export interface CapturedOutput {
  stdout: string
  exitCode: number | null
}

/**
 * IMPORTANT: When using this in test files that also use vi.mock() at top level,
 * add vi.resetModules() in beforeEach to avoid mock leaking between tests.
 */
export async function captureJsonOutput(fn: () => Promise<void>): Promise<CapturedOutput> {
  let stdout = ''
  let exitCode: number | null = null

  const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdout += args.map(String).join(' ')
  })
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code: number) => {
    exitCode = code ?? 0
    throw new Error(`process.exit(${code})`)
  }) as any)

  try {
    await fn()
  } catch (err) {
    if (!(err instanceof Error && err.message.startsWith('process.exit'))) {
      throw err
    }
  } finally {
    logSpy.mockRestore()
    exitSpy.mockRestore()
  }

  return { stdout, exitCode }
}

export function expectValidJsonSuccess(stdout: string, dataShape?: Record<string, unknown>): Record<string, unknown> {
  const parsed = JSON.parse(stdout)
  if (parsed.success !== true) {
    throw new Error(`Expected success: true, got: ${JSON.stringify(parsed)}`)
  }
  if (!('data' in parsed)) {
    throw new Error('Missing "data" field in success response')
  }
  if (dataShape) {
    for (const [key] of Object.entries(dataShape)) {
      if (!(key in parsed.data)) {
        throw new Error(`Missing key "${key}" in data`)
      }
    }
  }
  return parsed.data
}

export function expectValidJsonError(stdout: string, expectedCode?: string): { code: string; message: string } {
  const parsed = JSON.parse(stdout)
  if (parsed.success !== false) {
    throw new Error(`Expected success: false, got: ${JSON.stringify(parsed)}`)
  }
  if (!parsed.error || typeof parsed.error.code !== 'string' || typeof parsed.error.message !== 'string') {
    throw new Error(`Invalid error shape: ${JSON.stringify(parsed.error)}`)
  }
  if (expectedCode && parsed.error.code !== expectedCode) {
    throw new Error(`Expected error code "${expectedCode}", got "${parsed.error.code}"`)
  }
  return parsed.error
}
