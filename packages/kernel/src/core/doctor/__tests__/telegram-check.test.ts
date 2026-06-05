import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { SettingsManager } from '../../plugin/settings-manager.js'
import { telegramCheck } from '../checks/telegram.js'
import type { DoctorContext } from '../types.js'

function makeContext(overrides: Partial<DoctorContext> = {}): DoctorContext {
  return {
    config: { channels: {}, agents: {}, defaultAgent: 'test' } as any,
    rawConfig: {},
    configPath: '/tmp/config.json',
    dataDir: '/tmp',
    sessionsPath: '/tmp/sessions',
    pidPath: '/tmp/pid',
    portFilePath: '/tmp/port',
    pluginsDir: '/tmp/plugins',
    logsDir: '/tmp/logs',
    ...overrides,
  }
}

describe('telegramCheck', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-doctor-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('skips when no config.channels and no plugin settings', async () => {
    const ctx = makeContext({ pluginsDir: path.join(tmpDir, 'plugins') })
    const results = await telegramCheck.run(ctx)

    expect(results).toHaveLength(1)
    expect(results[0]!.status).toBe('pass')
    expect(results[0]!.message).toMatch(/not (enabled|configured)/i)
  })

  it('proceeds with validation when plugin settings have botToken and chatId', async () => {
    const pluginsDir = path.join(tmpDir, 'plugins')
    const sm = new SettingsManager(path.join(pluginsDir, 'data'))
    await sm.updatePluginSettings('@viben/telegram', {
      botToken: 'invalid-token-for-testing',
      chatId: -1001234567890,
    })

    const ctx = makeContext({ pluginsDir })
    const results = await telegramCheck.run(ctx)

    // Should not skip — should attempt validation (token format check)
    expect(results.some(r => r.message.toLowerCase().includes('token'))).toBe(true)
    // The skip message should NOT appear
    expect(results.every(r => !r.message.toLowerCase().includes('not configured'))).toBe(true)
  })
})
