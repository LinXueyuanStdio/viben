import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { SettingsManager } from '../../plugin/settings-manager.js'
import { summarizeConfig } from '../helpers.js'
import type { Config } from '../../config/config.js'

function makeEmptyConfig(): Config {
  return {
    channels: {},
    agents: {},
    defaultAgent: 'claude-code',
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

describe('summarizeConfig', () => {
  let tmpDir: string
  let settingsManager: SettingsManager

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-helpers-test-'))
    settingsManager = new SettingsManager(path.join(tmpDir, 'plugins', 'data'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('shows Telegram as enabled when plugin settings have botToken and chatId', async () => {
    await settingsManager.updatePluginSettings('@viben/telegram', {
      botToken: 'test-token',
      chatId: -1001234567890,
    })

    const config = makeEmptyConfig()
    const summary = await summarizeConfig(config, settingsManager)

    expect(summary).toContain('Telegram (enabled)')
    expect(summary).not.toContain('Telegram (not configured)')
  })

  it('shows Telegram as not configured when no config and no plugin settings', async () => {
    const config = makeEmptyConfig()
    const summary = await summarizeConfig(config)

    expect(summary).toContain('Telegram (not configured)')
  })

})
