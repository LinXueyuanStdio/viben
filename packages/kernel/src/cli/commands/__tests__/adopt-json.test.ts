import { describe, it, expect, vi, afterEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess, expectValidJsonError } from './helpers/json-test-utils.js'

vi.mock('../../api-client.js', () => ({
  readApiPort: vi.fn().mockReturnValue(3000),
  apiCall: vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ ok: true, sessionId: 'sess-1', threadId: 'thread-1', status: 'new' }),
  }),
}))

vi.mock('../../../core/instance/instance-context.js', () => ({
  resolveRunningInstance: vi.fn().mockResolvedValue('/tmp/viben-test/.viben'),
}))

describe('adopt --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs JSON on successful adopt', async () => {
    const { cmdAdopt } = await import('../adopt.js')
    const result = await captureJsonOutput(async () => {
      await cmdAdopt(['claude', 'ext-session-1', '--json'])
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('sessionId', 'sess-1')
    expect(data).toHaveProperty('threadId', 'thread-1')
    expect(data).toHaveProperty('agent', 'claude')
    expect(data).toHaveProperty('status', 'new')
  })

  it('outputs JSON error when missing arguments', async () => {
    const { cmdAdopt } = await import('../adopt.js')
    const result = await captureJsonOutput(async () => {
      await cmdAdopt(['--json'])
    })
    expect(result.exitCode).toBe(1)
    expectValidJsonError(result.stdout, 'MISSING_ARGUMENT')
  })

  it('outputs JSON error when daemon not running', async () => {
    const apiClient = await import('../../api-client.js')
    vi.mocked(apiClient.readApiPort).mockReturnValue(null)

    const { cmdAdopt } = await import('../adopt.js')
    const result = await captureJsonOutput(async () => {
      await cmdAdopt(['claude', 'sess-1', '--json'])
    })
    expect(result.exitCode).toBe(1)
    expectValidJsonError(result.stdout, 'DAEMON_NOT_RUNNING')
  })
})
