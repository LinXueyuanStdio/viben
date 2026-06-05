import { describe, it, expect, vi, afterEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess, expectValidJsonError } from './helpers/json-test-utils.js'

vi.mock('../../api-client.js', () => ({
  readApiPort: vi.fn().mockReturnValue(null),
  apiCall: vi.fn(),
}))

vi.mock('../../../core/config/config.js', () => ({
  ConfigManager: class {
    exists = vi.fn().mockResolvedValue(true)
    load = vi.fn().mockResolvedValue(undefined)
    save = vi.fn().mockResolvedValue(undefined)
  },
  ConfigSchema: { shape: { defaultAgent: {}, telegram: {}, security: {}, logging: {} } },
}))

describe('config set --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs JSON on successful config set (file mode)', async () => {
    const { cmdConfig } = await import('../config.js')
    const result = await captureJsonOutput(async () => {
      await cmdConfig(['set', 'defaultAgent', 'claude', '--json'])
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('path', 'defaultAgent')
    expect(data).toHaveProperty('value', 'claude')
    expect(data).toHaveProperty('needsRestart', false)
  })

  it('outputs JSON error for unknown config key', async () => {
    const { cmdConfig } = await import('../config.js')
    const result = await captureJsonOutput(async () => {
      await cmdConfig(['set', 'nonexistent', 'value', '--json'])
    })
    expect(result.exitCode).toBe(1)
    expectValidJsonError(result.stdout, 'CONFIG_INVALID')
  })

  it('outputs JSON error for missing arguments', async () => {
    const { cmdConfig } = await import('../config.js')
    const result = await captureJsonOutput(async () => {
      await cmdConfig(['set', '--json'])
    })
    expect(result.exitCode).toBe(1)
    expectValidJsonError(result.stdout, 'MISSING_ARGUMENT')
  })
})
