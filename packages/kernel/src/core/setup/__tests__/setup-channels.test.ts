import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { SettingsManager } from '../../plugin/settings-manager.js'
import { getChannelStatuses } from '../setup-channels.js'
import type { Config } from '../../config/config.js'

function makeEmptyConfig(): Config {
  return {
    channels: {},
    agents: {},
    defaultAgent: 'test-agent',
    workspace: {},
    security: { allowedUserIds: [], maxConcurrentSessions: 20, sessionTimeoutMinutes: 60 },
    logging: { level: 'info', logDir: '/tmp/logs', maxFileSize: '10m', maxFiles: 7, sessionLogRetentionDays: 30 },
    runMode: 'foreground',
    autoStart: false,
    api: { port: 21420, host: '127.0.0.1' },
    sessionStore: { ttlDays: 30 },
    tunnel: { enabled: false, port: 3100, provider: 'cloudflare', options: {}, maxUserTunnels: 5, storeTtlMinutes: 60, auth: { enabled: false } },
    usage: { enabled: false, warningThreshold: 0.8, currency: 'USD', retentionDays: 90 },
    integrations: {},
    speech: { stt: { provider: null, providers: {} }, tts: { provider: null, providers: {} } },
    agentSwitch: { labelHistory: true },
  } as unknown as Config
}

describe('getChannelStatuses', () => {
  let tmpDir: string
  let settingsManager: SettingsManager

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-channels-test-'))
    settingsManager = new SettingsManager(path.join(tmpDir, 'plugins', 'data'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('shows telegram as configured when plugin settings have botToken and chatId', async () => {
    await settingsManager.updatePluginSettings('@viben/telegram', {
      botToken: 'test-bot-token',
      chatId: -1001234567890,
    })

    const config = makeEmptyConfig()
    const statuses = await getChannelStatuses(config, settingsManager)

    const tg = statuses.find(s => s.id === 'telegram')
    expect(tg?.configured).toBe(true)
  })

  it('shows telegram as not configured when config.channels empty and no plugin settings', async () => {
    const config = makeEmptyConfig()
    const statuses = await getChannelStatuses(config, settingsManager)

    const tg = statuses.find(s => s.id === 'telegram')
    expect(tg?.configured).toBe(false)
  })

  it('prefers plugin settings over legacy config.channels', async () => {
    // Plugin settings exist (new-style)
    await settingsManager.updatePluginSettings('@viben/telegram', {
      botToken: 'plugin-token',
      chatId: -1009999999999,
    })

    // Also has legacy config (old-style) but with wrong/empty token
    const config = makeEmptyConfig()
    ;(config.channels as Record<string, unknown>).telegram = {}

    const statuses = await getChannelStatuses(config, settingsManager)

    const tg = statuses.find(s => s.id === 'telegram')
    expect(tg?.configured).toBe(true)
  })

})
