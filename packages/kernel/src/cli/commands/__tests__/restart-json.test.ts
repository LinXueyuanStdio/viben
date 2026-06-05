import { describe, it, expect, vi, afterEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess } from './helpers/json-test-utils.js'

vi.mock('../../daemon.js', () => ({
  startDaemon: vi.fn().mockReturnValue({ pid: 99999 }),
  stopDaemon: vi.fn().mockResolvedValue({ stopped: false }),
  getPidPath: vi.fn().mockReturnValue('/tmp/test.pid'),
  markRunning: vi.fn(),
}))

vi.mock('../../../core/config/config.js', () => ({
  ConfigManager: class {
    exists = vi.fn().mockResolvedValue(true)
    load = vi.fn().mockResolvedValue(undefined)
    get = vi.fn().mockReturnValue({ logging: { logDir: '/tmp/logs' }, runMode: 'foreground' })
  },
}))

vi.mock('../../version.js', () => ({
  checkAndPromptUpdate: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../instance-hint.js', () => ({
  printInstanceHint: vi.fn(),
}))

vi.mock('../../../core/instance/instance-context.js', () => ({
  createInstanceContext: vi.fn().mockReturnValue({}),
  getGlobalRoot: vi.fn().mockReturnValue('/tmp/global'),
}))

describe('restart --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('forces daemon mode when --json is passed even if config says foreground', async () => {
    const { cmdRestart } = await import('../restart.js')
    const result = await captureJsonOutput(async () => {
      await cmdRestart(['--json'], '/tmp/test-instance')
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('pid', 99999)

    // Verify startDaemon was called (not startServer for foreground)
    const daemon = await import('../../daemon.js')
    expect(daemon.startDaemon).toHaveBeenCalled()
  })
})
