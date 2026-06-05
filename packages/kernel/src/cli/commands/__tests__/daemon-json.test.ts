import { describe, it, expect, vi, afterEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess, expectValidJsonError } from './helpers/json-test-utils.js'

vi.mock('../../daemon.js', () => ({
  startDaemon: vi.fn().mockReturnValue({ pid: 12345 }),
  stopDaemon: vi.fn().mockResolvedValue({ stopped: true, pid: 12345 }),
  getPidPath: vi.fn().mockReturnValue('/tmp/test.pid'),
  isProcessRunning: vi.fn().mockReturnValue(false),
  markRunning: vi.fn(),
}))

vi.mock('../../../core/config/config.js', () => ({
  ConfigManager: class {
    exists = vi.fn().mockResolvedValue(true)
    load = vi.fn().mockResolvedValue(undefined)
    get = vi.fn().mockReturnValue({ logging: { logDir: '/tmp/logs' }, runMode: 'daemon', api: { port: 21420 } })
  },
}))

vi.mock('../../version.js', () => ({
  checkAndPromptUpdate: vi.fn().mockResolvedValue(undefined),
  getCurrentVersion: vi.fn().mockReturnValue('2026.401.1'),
}))

vi.mock('../../instance-hint.js', () => ({
  printInstanceHint: vi.fn(),
}))

vi.mock('../../api-client.js', () => ({
  waitForPortFile: vi.fn().mockResolvedValue(21420),
  readApiPort: vi.fn().mockReturnValue(null),
  readApiSecret: vi.fn().mockReturnValue(null),
  removeStalePortFile: vi.fn(),
  apiCall: vi.fn(),
}))

vi.mock('../../autostart.js', () => ({
  installAutoStart: vi.fn().mockReturnValue({ success: true }),
  uninstallAutoStart: vi.fn().mockReturnValue({ success: true }),
  isAutoStartInstalled: vi.fn().mockReturnValue(false),
  isAutoStartSupported: vi.fn().mockReturnValue(false),
}))

describe('stop --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs JSON on successful stop', async () => {
    const { cmdStop } = await import('../stop.js')
    const result = await captureJsonOutput(async () => {
      await cmdStop(['--json'], '/tmp/test-instance')
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('stopped', true)
    expect(data).toHaveProperty('pid', 12345)
  })
})

describe('start --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs JSON on successful start', async () => {
    const { cmdStart } = await import('../start.js')
    const result = await captureJsonOutput(async () => {
      await cmdStart(['--json'], '/tmp/test-instance')
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('pid', 12345)
  })
})
