import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
}))

// Mock autostart
vi.mock('../cli/autostart.js', () => ({
  installAutoStart: vi.fn(() => ({ success: true })),
  uninstallAutoStart: vi.fn(() => ({ success: true })),
  isAutoStartInstalled: vi.fn(() => false),
  isAutoStartSupported: vi.fn(() => true),
}))

// Mock setup validators
vi.mock('../core/setup.js', () => ({
  validateBotToken: vi.fn(() => ({ ok: true, botName: 'Test', botUsername: 'testbot' })),
  validateChatId: vi.fn(() => ({ ok: true, title: 'Test Group', isForum: true })),
}))

describe('config-editor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exports runConfigEditor function', async () => {
    const mod = await import('../core/config/config-editor.js')
    expect(typeof mod.runConfigEditor).toBe('function')
  })

  it('exits without saving when no changes are made', async () => {
    const clack = await import('@clack/prompts')
    const { runConfigEditor } = await import('../core/config/config-editor.js')

    vi.mocked(clack.select).mockResolvedValueOnce('exit')

    const mockConfigManager = {
      load: vi.fn(),
      get: vi.fn(() => ({
        channels: { telegram: { enabled: true, botToken: 'token', chatId: -100 } },
        agents: { claude: { command: 'claude-agent-acp', args: [], env: {} } },
        defaultAgent: 'claude',
        workspace: { allowExternalWorkspaces: true, security: { allowedPaths: [], envWhitelist: [] } },
        security: { allowedUserIds: [], maxConcurrentSessions: 5, sessionTimeoutMinutes: 60 },
        logging: { level: 'info', logDir: '~/.viben/logs', maxFileSize: '10m', maxFiles: 7, sessionLogRetentionDays: 30 },
        runMode: 'foreground',
        autoStart: false,
      })),
      save: vi.fn(),
      getConfigPath: vi.fn(() => '/tmp/config.json'),
    }

    await runConfigEditor(mockConfigManager as any)
    expect(mockConfigManager.save).not.toHaveBeenCalled()
  })

  it('discards changes on Ctrl+C (cancel)', async () => {
    const clack = await import('@clack/prompts')
    const { runConfigEditor } = await import('../core/config/config-editor.js')

    vi.mocked(clack.isCancel).mockReturnValueOnce(true)
    vi.mocked(clack.select).mockResolvedValueOnce(Symbol('cancel'))

    // Mock process.exit to throw so execution stops (like real exit would)
    const exitError = new Error('process.exit')
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => { throw exitError })

    const mockConfigManager = {
      load: vi.fn(),
      get: vi.fn(() => ({
        channels: {}, agents: { claude: { command: 'c', args: [], env: {} } },
        defaultAgent: 'claude', workspace: {},
        security: { allowedUserIds: [], maxConcurrentSessions: 5, sessionTimeoutMinutes: 60 },
        logging: { level: 'info', logDir: '~/.viben/logs', maxFileSize: '10m', maxFiles: 7, sessionLogRetentionDays: 30 },
        runMode: 'foreground', autoStart: false,
      })),
      save: vi.fn(),
      getConfigPath: vi.fn(() => '/tmp/config.json'),
    }

    await expect(runConfigEditor(mockConfigManager as any)).rejects.toThrow('process.exit')
    expect(mockConfigManager.save).not.toHaveBeenCalled()
    expect(mockExit).toHaveBeenCalledWith(0)
    mockExit.mockRestore()
  })
})
