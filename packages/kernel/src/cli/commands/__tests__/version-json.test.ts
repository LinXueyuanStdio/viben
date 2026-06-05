import { describe, it, expect, vi, afterEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess } from './helpers/json-test-utils.js'

describe('version --json', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('outputs JSON with version string', async () => {
    const { cmdVersion } = await import('../version.js')
    const result = await captureJsonOutput(async () => {
      await cmdVersion(['--json'])
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('version')
    expect(typeof data.version).toBe('string')
    expect((data.version as string).length).toBeGreaterThan(0)
  })

  it('outputs plain text without --json', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { cmdVersion } = await import('../version.js')
    await cmdVersion([])
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('viben v'))
  })
})
