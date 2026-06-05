import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess } from './helpers/json-test-utils.js'

vi.mock('../../../core/doctor/index.js', () => ({
  DoctorEngine: class {
    runAll = vi.fn().mockResolvedValue({
      categories: [
        { name: 'Config', results: [{ status: 'pass', message: 'Config valid' }] },
        { name: 'Agents', results: [{ status: 'warn', message: 'No agents installed' }] },
      ],
      pendingFixes: [],
      summary: { passed: 1, warnings: 1, failed: 0, fixed: 0 },
    })
  },
}))

describe('doctor --json', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('outputs JSON report with categories and summary', async () => {
    const { cmdDoctor } = await import('../doctor.js')
    const result = await captureJsonOutput(async () => {
      await cmdDoctor(['--json'], '/tmp/test')
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('categories')
    expect(data).toHaveProperty('summary')
    expect((data.summary as Record<string, number>).passed).toBe(1)
    expect((data.summary as Record<string, number>).warnings).toBe(1)
  })

  it('always exits 0 even with failures', async () => {
    // Override mock for this test by re-mocking before dynamic import
    vi.doMock('../../../core/doctor/index.js', () => ({
      DoctorEngine: class {
        runAll = vi.fn().mockResolvedValue({
          categories: [
            { name: 'Config', results: [{ status: 'fail', message: 'Config broken' }] },
          ],
          pendingFixes: [],
          summary: { passed: 0, warnings: 0, failed: 1, fixed: 0 },
        })
      },
    }))

    const { cmdDoctor } = await import('../doctor.js')
    const result = await captureJsonOutput(async () => {
      await cmdDoctor(['--json'], '/tmp/test')
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect((data.summary as Record<string, number>).failed).toBe(1)
  })
})
