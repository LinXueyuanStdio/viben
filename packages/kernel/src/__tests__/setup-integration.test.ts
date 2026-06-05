import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { ConfigManager } from '../core/config/config.js'

// Mock @clack/prompts before importing setup
vi.mock('@clack/prompts', () => ({
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  multiselect: vi.fn(),
  autocompleteMultiselect: vi.fn().mockResolvedValue([]),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  note: vi.fn(),
  isCancel: vi.fn(() => false),
}))

// Mock child_process for agent detection
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn((_cmd: string, args?: string[]) => {
    if (args && args[0] === 'claude-agent-acp') {
      return Buffer.from('/usr/local/bin/claude-agent-acp\n')
    }
    throw new Error('not found')
  }),
}))

// Mock autostart module
vi.mock('../cli/autostart.js', () => ({
  isAutoStartSupported: vi.fn(() => false),
  installAutoStart: vi.fn(() => ({ success: true })),
}))

// Mock AgentCatalog to avoid real registry/fs operations during setup
vi.mock('../core/agents/agent-catalog.js', () => {
  class MockAgentCatalog {
    load = vi.fn()
    refreshRegistryIfStale = vi.fn().mockResolvedValue(undefined)
    getInstalledAgent = vi.fn((_key: string) => undefined)
    findRegistryAgent = vi.fn((_key: string) => null)
    install = vi.fn().mockResolvedValue({ ok: true })
    registerFallbackAgent = vi.fn()
    getAvailable = vi.fn(() => [])
    getInstalledEntries = vi.fn(() => ({
      claude: { name: 'Claude Agent', command: 'npx', version: 'bundled', distribution: 'npx' },
    }))
  }
  return {
    AgentCatalog: MockAgentCatalog,
  }
})

// Mock AgentStore for the fallback path in setupAgents
vi.mock('../core/agents/agent-store.js', () => {
  class MockAgentStore {
    load = vi.fn()
    addAgent = vi.fn()
  }
  return {
    AgentStore: MockAgentStore,
  }
})

// Mock cloudflared download to avoid real network calls
vi.mock('../tunnel/providers/install-cloudflared.js', () => ({
  ensureCloudflared: vi.fn(() => Promise.resolve('/usr/local/bin/cloudflared')),
}))

// Track plugin install calls
const telegramInstallFn = vi.fn()

// Mock the telegram plugin module — install writes to settings via ctx
vi.mock('../plugins/telegram/index.js', () => ({
  default: {
    name: '@viben/telegram',
    version: '1.0.0',
    description: 'Telegram adapter with forum topics',
    install: telegramInstallFn,
  },
}))

import * as clack from '@clack/prompts'
import { runSetup, runReconfigure } from '../core/setup/index.js'

const mockedText = vi.mocked(clack.text)
const mockedSelect = vi.mocked(clack.select)
const mockedConfirm = vi.mocked(clack.confirm)
const mockedMultiselect = vi.mocked(clack.multiselect)

describe('runSetup integration', () => {
  let tmpDir: string
  let configPath: string
  const originalEnv = process.env.VIBEN_CONFIG_PATH

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-setup-'))
    configPath = path.join(tmpDir, 'config.json')
    process.env.VIBEN_CONFIG_PATH = configPath

    // Mock fetch for Telegram API validation
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/getMe')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            ok: true,
            result: { id: 123456, first_name: 'TestBot', username: 'test_bot' },
          }),
        })
      }
      if (url.includes('/getChatMember')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            ok: true,
            result: { status: 'administrator' },
          }),
        })
      }
      if (url.includes('/getChat')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            ok: true,
            result: { title: 'Test Group', type: 'supergroup', is_forum: true },
          }),
        })
      }
      if (url.includes('/getUpdates')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            ok: true,
            result: [
              {
                update_id: 1,
                message: {
                  chat: { id: -1001234567890, title: 'Test Group', type: 'supergroup' },
                },
              },
            ],
          }),
        })
      }
      return Promise.reject(new Error(`unexpected URL: ${url}`))
    }))

    telegramInstallFn.mockReset()
    telegramInstallFn.mockResolvedValue(undefined)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    if (originalEnv === undefined) {
      delete process.env.VIBEN_CONFIG_PATH
    } else {
      process.env.VIBEN_CONFIG_PATH = originalEnv
    }
    vi.restoreAllMocks()
  })

  it('creates valid config file via plugin install and auto-starts', { timeout: 15000 }, async () => {
    // text() call order:
    // 1. Instance name prompt
    mockedText.mockResolvedValueOnce('Main' as any)

    // Confirm call order:
    // 1. Claude CLI integration prompt (decline to avoid needing ClaudeIntegration mock)
    mockedConfirm.mockResolvedValueOnce(false as any)

    // Multiselect: channel selection (Telegram only)
    mockedMultiselect.mockResolvedValueOnce(['telegram'] as any)

    // Select call order:
    // 1. setupRunMode: run mode selection
    mockedSelect.mockResolvedValueOnce('foreground' as any)

    // Create mock settingsManager and pluginRegistry
    const pluginsDir = path.join(tmpDir, 'plugins')
    fs.mkdirSync(pluginsDir, { recursive: true })

    const mockSettingsManager = {
      getBasePath: () => pluginsDir,
      getSettingsPath: (name: string) => path.join(pluginsDir, name, 'settings.json'),
      createAPI: () => ({
        get: vi.fn(),
        set: vi.fn(),
        getAll: vi.fn().mockResolvedValue({}),
        setAll: vi.fn(),
        clear: vi.fn(),
      }),
    }

    const registeredPlugins = new Map<string, Record<string, unknown>>()
    const mockPluginRegistry = {
      register: vi.fn((name: string, entry: Record<string, unknown>) => {
        registeredPlugins.set(name, entry)
      }),
      get: vi.fn((name: string) => registeredPlugins.get(name)),
      save: vi.fn().mockResolvedValue(undefined),
    }

    const cm = new ConfigManager()
    const instanceRoot = path.join(tmpDir, '.viben')
    fs.mkdirSync(instanceRoot, { recursive: true })
    const shouldStart = await runSetup(cm, {
      settingsManager: mockSettingsManager as any,
      pluginRegistry: mockPluginRegistry as any,
      instanceRoot,
    })

    expect(shouldStart).toBe(true)
    expect(fs.existsSync(configPath)).toBe(true)

    // Telegram plugin install was called
    expect(telegramInstallFn).toHaveBeenCalledOnce()

    // Plugin was registered in the registry
    expect(mockPluginRegistry.register).toHaveBeenCalledWith(
      '@viben/telegram',
      expect.objectContaining({
        version: '1.0.0',
        source: 'builtin',
        enabled: true,
      }),
    )

    const written = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    expect(written.defaultAgent).toBe('claude')

    // Built-in plugins were auto-registered
    expect(mockPluginRegistry.save).toHaveBeenCalled()
  })
})

describe('runReconfigure integration', () => {
  let tmpDir: string
  let configPath: string
  const originalEnv = process.env.VIBEN_CONFIG_PATH

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-reconfig-'))
    configPath = path.join(tmpDir, 'config.json')
    process.env.VIBEN_CONFIG_PATH = configPath
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    if (originalEnv === undefined) {
      delete process.env.VIBEN_CONFIG_PATH
    } else {
      process.env.VIBEN_CONFIG_PATH = originalEnv
    }
    vi.restoreAllMocks()
  })

  it('shows section menu and allows channel reconfiguration', { timeout: 15000 }, async () => {
    // Pre-create config file with existing Telegram config
    const existingConfig = {
      channels: {
        telegram: {
          enabled: true,
          botToken: '123:OLD_TOKEN',
          chatId: -1001234567890,
        },
      },
      agents: {},
      defaultAgent: 'claude',
      workspace: { allowExternalWorkspaces: true, security: { allowedPaths: [], envWhitelist: [] } },
      security: {
        allowedUserIds: [],
        maxConcurrentSessions: 20,
        sessionTimeoutMinutes: 60,
      },
      logging: {
        level: 'info',
        logDir: '~/.viben/logs',
        maxFileSize: '10m',
        maxFiles: 7,
        sessionLogRetentionDays: 30,
      },
      runMode: 'foreground',
      autoStart: false,
      api: { port: 21420, host: '127.0.0.1' },
      sessionStore: { ttlDays: 30 },
      tunnel: {
        enabled: true,
        port: 3100,
        provider: 'cloudflare',
        options: {},
        maxUserTunnels: 5,
        storeTtlMinutes: 60,
        auth: { enabled: false },
      },
      usage: {
        enabled: true,
        warningThreshold: 0.8,
        currency: 'USD',
        retentionDays: 90,
      },
      integrations: {},
      speech: {
        stt: { provider: null, providers: {} },
        tts: { provider: null, providers: {} },
      },
    }
    fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2))

    // Mock select calls in order:
    // 1. section menu → 'channels'
    // 2. channel loop → 'telegram'
    // 3. configured action → 'skip'
    // 4. channel loop → '__done__'
    // 5. section menu → '__continue'
    mockedSelect
      .mockResolvedValueOnce('channels' as any)
      .mockResolvedValueOnce('telegram' as any)
      .mockResolvedValueOnce('skip' as any)
      .mockResolvedValueOnce('__done__' as any)
      .mockResolvedValueOnce('__continue' as any)

    const cm = new ConfigManager()
    await runReconfigure(cm)

    // Config file should be unchanged: skip means no modifications
    const written = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    expect(written.channels.telegram.botToken).toBe('123:OLD_TOKEN')
    expect(written.channels.telegram.enabled).toBe(true)
  })
})
