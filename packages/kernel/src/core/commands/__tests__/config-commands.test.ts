import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CommandRegistry } from '../../command-registry.js'
import type { CommandArgs, CommandResponse } from '../../plugin/types.js'
import type { ConfigOption } from '../../types.js'

// ── Sample config options used across tests ──────────────────────────
const modeOption: ConfigOption = {
  id: 'mode',
  name: 'Mode',
  type: 'select',
  category: 'mode',
  currentValue: 'code',
  options: [
    { value: 'code', name: 'Code', description: 'Full tool access' },
    { value: 'architect', name: 'Architect', description: 'Read-only planning' },
    { value: 'bypassPermissions', name: 'Bypass Permissions', description: 'Skip all permission prompts' },
  ],
}

const modelOption: ConfigOption = {
  id: 'model',
  name: 'Model',
  type: 'select',
  category: 'model',
  currentValue: 'sonnet',
  options: [
    { value: 'sonnet', name: 'Sonnet', description: 'Fast and capable' },
    { value: 'opus', name: 'Opus', description: 'Most intelligent' },
  ],
}

const thoughtOption: ConfigOption = {
  id: 'thinking',
  name: 'Thinking',
  type: 'select',
  category: 'thought_level',
  currentValue: 'normal',
  options: [
    { value: 'none', name: 'None' },
    { value: 'normal', name: 'Normal' },
    { value: 'extended', name: 'Extended' },
  ],
}

const booleanOption: ConfigOption = {
  id: 'verbose',
  name: 'Verbose',
  type: 'boolean',
  category: 'mode',
  currentValue: true,
}

// ── Helpers ──────────────────────────────────────────────────────────

function mockSession(configOptions: ConfigOption[] = [], overrides?: Partial<any>) {
  const session: any = {
    id: 'test-session',
    configOptions,
    clientOverrides: {} as { bypassPermissions?: boolean },
    getConfigByCategory: vi.fn((cat: string) => configOptions.find(o => o.category === cat)),
    getConfigOption: vi.fn((id: string) => configOptions.find(o => o.id === id)),
    getConfigValue: vi.fn((id: string) => {
      const opt = configOptions.find(o => o.id === id)
      return opt ? String(opt.currentValue) : undefined
    }),
    updateConfigOptions: vi.fn().mockResolvedValue(undefined),
    agentInstance: {
      setConfigOption: vi.fn().mockResolvedValue({
        configOptions: configOptions.map(o => ({ ...o })),
      }),
    },
    middlewareChain: undefined as any,
    ...overrides,
  }
  // session.setConfigOption delegates to agentInstance and updates configOptions
  session.setConfigOption = vi.fn(async (configId: string, value: any) => {
    const response = await session.agentInstance.setConfigOption(configId, value)
    if (response.configOptions && response.configOptions.length > 0) {
      session.configOptions = response.configOptions
    } else if (value.type === 'select') {
      session.configOptions = session.configOptions.map((o: ConfigOption) =>
        o.id === configId && o.type === 'select' ? { ...o, currentValue: value.value } : o
      )
    }
  })
  return session
}

function mockCore(session?: ReturnType<typeof mockSession>) {
  return {
    sessionManager: {
      getSession: vi.fn().mockReturnValue(session ?? null),
      patchRecord: vi.fn().mockResolvedValue(undefined),
    },
    eventBus: { emit: vi.fn() },
  }
}

function baseArgs(sessionId: string | null): CommandArgs {
  return {
    sessionId,
    channelId: 'telegram',
    userId: 'user-1',
    raw: '',
    reply: vi.fn().mockResolvedValue(undefined),
  }
}

// ── Test Suite ───────────────────────────────────────────────────────

// Lazy import so we can write tests first, implementation second
async function loadModule() {
  return import('../config.js')
}

describe('Config Commands', () => {
  let registry: CommandRegistry
  let session: ReturnType<typeof mockSession>
  let core: ReturnType<typeof mockCore>

  // =============================================
  // /mode
  // =============================================
  describe('/mode', () => {
    beforeEach(async () => {
      session = mockSession([modeOption])
      core = mockCore(session)
      registry = new CommandRegistry()
      const { registerConfigCommands } = await loadModule()
      registerConfigCommands(registry, core)
    })

    it('returns error when no active session', async () => {
      core.sessionManager.getSession.mockReturnValue(null)
      const res = await registry.execute('/mode', baseArgs(null))
      expect(res.type).toBe('error')
    })

    it('returns error when agent has no config option with category "mode"', async () => {
      session = mockSession([modelOption]) // no mode option
      core = mockCore(session)
      registry = new CommandRegistry()
      const { registerConfigCommands } = await loadModule()
      registerConfigCommands(registry, core)

      const res = await registry.execute('/mode', baseArgs('test-session'))
      expect(res.type).toBe('error')
      if (res.type === 'error') {
        expect(res.message).toContain('not support')
      }
    })

    it('returns menu with available modes when no args', async () => {
      const res = await registry.execute('/mode', baseArgs('test-session'))
      expect(res.type).toBe('menu')
      if (res.type === 'menu') {
        expect(res.options.length).toBe(3)
      }
    })

    it('menu title contains current mode name', async () => {
      const res = await registry.execute('/mode', baseArgs('test-session'))
      expect(res.type).toBe('menu')
      if (res.type === 'menu') {
        // Current value is 'code', name is 'Code'
        expect(res.title).toContain('Code')
      }
    })

    it('current value highlighted with check prefix in menu', async () => {
      const res = await registry.execute('/mode', baseArgs('test-session'))
      expect(res.type).toBe('menu')
      if (res.type === 'menu') {
        const current = res.options.find(o => o.command === '/mode code')
        expect(current).toBeDefined()
        expect(current!.label).toMatch(/✅/)
        // Non-current should not have check
        const other = res.options.find(o => o.command === '/mode architect')
        expect(other).toBeDefined()
        expect(other!.label).not.toMatch(/✅/)
      }
    })

    it('menu options have hint from description', async () => {
      const res = await registry.execute('/mode', baseArgs('test-session'))
      if (res.type === 'menu') {
        const codeOpt = res.options.find(o => o.command === '/mode code')
        expect(codeOpt!.hint).toBe('Full tool access')
      }
    })

    it('sets mode when valid value provided', async () => {
      const res = await registry.execute('/mode architect', baseArgs('test-session'))
      expect(res.type).toBe('text')
      expect(session.setConfigOption).toHaveBeenCalledWith(
        'mode',
        { type: 'select', value: 'architect' },
      )
    })

    it('success message uses "switched to" phrasing', async () => {
      const res = await registry.execute('/mode architect', baseArgs('test-session'))
      expect(res.type).toBe('text')
      if (res.type === 'text') {
        expect(res.text).toContain('switched to')
        expect(res.text).toContain('Architect')
      }
    })

    it('returns text when already using current value', async () => {
      // current value is 'code', set to 'code' again
      const res = await registry.execute('/mode code', baseArgs('test-session'))
      expect(res.type).toBe('text')
      if (res.type === 'text') {
        expect(res.text).toContain('Already using')
        expect(res.text).toContain('Code')
      }
      // Agent should NOT be called when already at target value
      expect(session.setConfigOption).not.toHaveBeenCalled()
    })

    it('returns error for invalid value with "Unknown option" message', async () => {
      const res = await registry.execute('/mode nonexistent', baseArgs('test-session'))
      expect(res.type).toBe('error')
      if (res.type === 'error') {
        expect(res.message).toContain('Unknown option')
        expect(res.message).toContain('nonexistent')
      }
    })

    it('returns error for invalid value', async () => {
      const res = await registry.execute('/mode nonexistent', baseArgs('test-session'))
      expect(res.type).toBe('error')
    })

    it('updates session configOptions after successful set', async () => {
      const updatedOptions: ConfigOption[] = [
        { ...modeOption, currentValue: 'architect' },
      ]
      session.agentInstance.setConfigOption.mockResolvedValue({
        configOptions: updatedOptions,
      })

      await registry.execute('/mode architect', baseArgs('test-session'))
      // setConfigOption on session updates configOptions from agent response
      expect(session.setConfigOption).toHaveBeenCalledWith(
        'mode',
        { type: 'select', value: 'architect' },
      )
      expect(session.configOptions).toEqual(updatedOptions)
    })

    it('handles boolean type config gracefully (not select)', async () => {
      session = mockSession([booleanOption])
      session.getConfigByCategory.mockReturnValue(booleanOption)
      core = mockCore(session)
      registry = new CommandRegistry()
      const { registerConfigCommands } = await loadModule()
      registerConfigCommands(registry, core)

      const res = await registry.execute('/mode', baseArgs('test-session'))
      expect(res.type).toBe('error')
    })

    it('handles config option with empty options array', async () => {
      const emptyMode: ConfigOption = {
        id: 'mode',
        name: 'Mode',
        type: 'select',
        category: 'mode',
        currentValue: 'code',
        options: [],
      }
      session = mockSession([emptyMode])
      session.getConfigByCategory.mockReturnValue(emptyMode)
      core = mockCore(session)
      registry = new CommandRegistry()
      const { registerConfigCommands } = await loadModule()
      registerConfigCommands(registry, core)

      const res = await registry.execute('/mode', baseArgs('test-session'))
      expect(res.type).toBe('menu')
      if (res.type === 'menu') {
        expect(res.options.length).toBe(0)
      }
    })
  })

  // =============================================
  // /model
  // =============================================
  describe('/model', () => {
    beforeEach(async () => {
      session = mockSession([modelOption])
      core = mockCore(session)
      registry = new CommandRegistry()
      const { registerConfigCommands } = await loadModule()
      registerConfigCommands(registry, core)
    })

    it('returns error when no model config', async () => {
      session = mockSession([modeOption]) // no model
      core = mockCore(session)
      registry = new CommandRegistry()
      const { registerConfigCommands } = await loadModule()
      registerConfigCommands(registry, core)

      const res = await registry.execute('/model', baseArgs('test-session'))
      expect(res.type).toBe('error')
      if (res.type === 'error') {
        expect(res.message).toContain('not support')
      }
    })

    it('returns menu with model options when no args', async () => {
      const res = await registry.execute('/model', baseArgs('test-session'))
      expect(res.type).toBe('menu')
      if (res.type === 'menu') {
        expect(res.options.length).toBe(2)
        expect(res.options.some(o => o.command === '/model sonnet')).toBe(true)
        expect(res.options.some(o => o.command === '/model opus')).toBe(true)
      }
    })

    it('menu title contains current model name', async () => {
      const res = await registry.execute('/model', baseArgs('test-session'))
      if (res.type === 'menu') {
        expect(res.title).toContain('Sonnet')
      }
    })

    it('current model highlighted in menu', async () => {
      const res = await registry.execute('/model', baseArgs('test-session'))
      if (res.type === 'menu') {
        const current = res.options.find(o => o.command === '/model sonnet')
        expect(current!.label).toMatch(/✅/)
      }
    })

    it('sets model correctly with valid value', async () => {
      const res = await registry.execute('/model opus', baseArgs('test-session'))
      expect(res.type).toBe('text')
      expect(session.setConfigOption).toHaveBeenCalledWith(
        'model',
        { type: 'select', value: 'opus' },
      )
    })

    it('returns error for invalid model', async () => {
      const res = await registry.execute('/model gpt5', baseArgs('test-session'))
      expect(res.type).toBe('error')
    })

    it('returns text when already using current model', async () => {
      const res = await registry.execute('/model sonnet', baseArgs('test-session'))
      expect(res.type).toBe('text')
      if (res.type === 'text') {
        expect(res.text).toContain('Already using')
      }
      expect(session.setConfigOption).not.toHaveBeenCalled()
    })
  })

  // =============================================
  // /thought
  // =============================================
  describe('/thought', () => {
    beforeEach(async () => {
      session = mockSession([thoughtOption])
      core = mockCore(session)
      registry = new CommandRegistry()
      const { registerConfigCommands } = await loadModule()
      registerConfigCommands(registry, core)
    })

    it('returns error when no thought_level config', async () => {
      session = mockSession([modeOption])
      core = mockCore(session)
      registry = new CommandRegistry()
      const { registerConfigCommands } = await loadModule()
      registerConfigCommands(registry, core)

      const res = await registry.execute('/thought', baseArgs('test-session'))
      expect(res.type).toBe('error')
    })

    it('returns menu with thought options when no args', async () => {
      const res = await registry.execute('/thought', baseArgs('test-session'))
      expect(res.type).toBe('menu')
      if (res.type === 'menu') {
        expect(res.options.length).toBe(3)
        const current = res.options.find(o => o.command === '/thought normal')
        expect(current!.label).toMatch(/✅/)
      }
    })

    it('sets thought level correctly', async () => {
      const res = await registry.execute('/thought extended', baseArgs('test-session'))
      expect(res.type).toBe('text')
      expect(session.setConfigOption).toHaveBeenCalledWith(
        'thinking',
        { type: 'select', value: 'extended' },
      )
    })
  })

  // =============================================
  // /bypass_permissions (formerly /dangerous)
  // =============================================
  describe('/bypass_permissions', () => {
    describe('agent has mode config with bypass value', () => {
      beforeEach(async () => {
        session = mockSession([modeOption])
        core = mockCore(session)
        registry = new CommandRegistry()
        const { registerConfigCommands } = await loadModule()
        registerConfigCommands(registry, core)
      })

      it('/bypass_permissions on switches to bypass mode', async () => {
        const res = await registry.execute('/bypass_permissions on', baseArgs('test-session'))
        expect(res.type).toBe('text')
        expect(session.setConfigOption).toHaveBeenCalledWith(
          'mode',
          { type: 'select', value: 'bypassPermissions' },
        )
      })

      it('/bypass_permissions off switches back to non-bypass default', async () => {
        // Current value is code (non-bypass), but let's set it to bypass first
        session.getConfigByCategory.mockReturnValue({
          ...modeOption,
          currentValue: 'bypassPermissions',
        })
        const res = await registry.execute('/bypass_permissions off', baseArgs('test-session'))
        expect(res.type).toBe('text')
        // Should set to first non-bypass option
        expect(session.setConfigOption).toHaveBeenCalledWith(
          'mode',
          { type: 'select', value: 'code' },
        )
      })

      it('/bypass_permissions with no args shows current status as off with toggle menu', async () => {
        const res = await registry.execute('/bypass_permissions', baseArgs('test-session'))
        expect(res.type).toBe('menu')
        if (res.type === 'menu') {
          // Current mode is 'code' (non-bypass), so bypass is off
          expect(res.title).toContain('OFF')
          // Should show option to turn on
          expect(res.options.some(o => o.command === '/bypass_permissions on')).toBe(true)
        }
      })

      it('/bypass_permissions with no args shows current status as on when bypass active', async () => {
        session.getConfigByCategory.mockReturnValue({
          ...modeOption,
          currentValue: 'bypassPermissions',
        })
        const res = await registry.execute('/bypass_permissions', baseArgs('test-session'))
        expect(res.type).toBe('menu')
        if (res.type === 'menu') {
          expect(res.title).toContain('ON')
          expect(res.options.some(o => o.command === '/bypass_permissions off')).toBe(true)
        }
      })

      it('/bypass_permissions on when already bypassing returns "already enabled" text', async () => {
        session.getConfigByCategory.mockReturnValue({
          ...modeOption,
          currentValue: 'bypassPermissions',
        })
        const res = await registry.execute('/bypass_permissions on', baseArgs('test-session'))
        expect(res.type).toBe('text')
        if (res.type === 'text') {
          expect(res.text).toContain('already')
        }
        expect(session.setConfigOption).not.toHaveBeenCalled()
      })

      it('/bypass_permissions off when already off returns "already disabled" text', async () => {
        // current is 'code' (non-bypass), so bypass is already off
        const res = await registry.execute('/bypass_permissions off', baseArgs('test-session'))
        expect(res.type).toBe('text')
        if (res.type === 'text') {
          expect(res.text).toContain('already')
        }
        expect(session.setConfigOption).not.toHaveBeenCalled()
      })
    })

    describe('agent has no bypass value in mode options', () => {
      const modeNoBypas: ConfigOption = {
        id: 'mode',
        name: 'Mode',
        type: 'select',
        category: 'mode',
        currentValue: 'code',
        options: [
          { value: 'code', name: 'Code' },
          { value: 'architect', name: 'Architect' },
        ],
      }

      beforeEach(async () => {
        session = mockSession([modeNoBypas])
        core = mockCore(session)
        registry = new CommandRegistry()
        const { registerConfigCommands } = await loadModule()
        registerConfigCommands(registry, core)
      })

      it('/bypass_permissions on sets clientOverrides.bypassPermissions = true', async () => {
        const res = await registry.execute('/bypass_permissions on', baseArgs('test-session'))
        expect(res.type).toBe('text')
        expect(session.clientOverrides.bypassPermissions).toBe(true)
        expect(core.sessionManager.patchRecord).toHaveBeenCalled()
      })

      it('/bypass_permissions off sets clientOverrides.bypassPermissions = false', async () => {
        session.clientOverrides.bypassPermissions = true
        const res = await registry.execute('/bypass_permissions off', baseArgs('test-session'))
        expect(res.type).toBe('text')
        expect(session.clientOverrides.bypassPermissions).toBe(false)
      })

      it('shows message about client-side fallback', async () => {
        const res = await registry.execute('/bypass_permissions on', baseArgs('test-session'))
        if (res.type === 'text') {
          expect(res.text).toContain('client')
        }
      })
    })

    describe('agent has no mode config at all', () => {
      beforeEach(async () => {
        session = mockSession([]) // no config options
        core = mockCore(session)
        registry = new CommandRegistry()
        const { registerConfigCommands } = await loadModule()
        registerConfigCommands(registry, core)
      })

      it('/bypass_permissions on falls back to clientOverrides', async () => {
        const res = await registry.execute('/bypass_permissions on', baseArgs('test-session'))
        expect(res.type).toBe('text')
        expect(session.clientOverrides.bypassPermissions).toBe(true)
      })

      it('/bypass_permissions off falls back to clientOverrides', async () => {
        session.clientOverrides.bypassPermissions = true
        const res = await registry.execute('/bypass_permissions off', baseArgs('test-session'))
        expect(res.type).toBe('text')
        expect(session.clientOverrides.bypassPermissions).toBe(false)
      })

      it('/bypass_permissions with no args shows current status as off', async () => {
        const res = await registry.execute('/bypass_permissions', baseArgs('test-session'))
        expect(res.type).toBe('menu')
        if (res.type === 'menu') {
          expect(res.title).toContain('OFF')
        }
      })

      it('/bypass_permissions with no args shows on when clientOverrides enabled', async () => {
        session.clientOverrides.bypassPermissions = true
        const res = await registry.execute('/bypass_permissions', baseArgs('test-session'))
        expect(res.type).toBe('menu')
        if (res.type === 'menu') {
          expect(res.title).toContain('ON')
        }
      })
    })

    describe('bypass keyword detection', () => {
      it('detects "bypass" keyword', async () => {
        const { isPermissionBypass } = await loadModule()
        expect(isPermissionBypass('bypassPermissions')).toBe(true)
      })

      it('detects "dangerous" keyword', async () => {
        const { isPermissionBypass } = await loadModule()
        expect(isPermissionBypass('dangerous_mode')).toBe(true)
      })

      it('does NOT treat "skip" as bypass (skip means deny)', async () => {
        const { isPermissionBypass } = await loadModule()
        expect(isPermissionBypass('skipAll')).toBe(false)
      })

      it('does NOT treat "dontask" as bypass (dont_ask denies unknown)', async () => {
        const { isPermissionBypass } = await loadModule()
        expect(isPermissionBypass('dontask')).toBe(false)
      })

      it('does NOT treat "dont_ask" as bypass (dont_ask denies unknown)', async () => {
        const { isPermissionBypass } = await loadModule()
        expect(isPermissionBypass('dont_ask_mode')).toBe(false)
      })

      it('detects "auto_accept" keyword', async () => {
        const { isPermissionBypass } = await loadModule()
        expect(isPermissionBypass('auto_accept')).toBe(true)
      })

      it('detects "yolo" keyword', async () => {
        const { isPermissionBypass } = await loadModule()
        expect(isPermissionBypass('yolo')).toBe(true)
        expect(isPermissionBypass('yolo_mode')).toBe(true)
      })

      it('is case-insensitive', async () => {
        const { isPermissionBypass } = await loadModule()
        expect(isPermissionBypass('BypassPermissions')).toBe(true)
        expect(isPermissionBypass('DANGEROUS')).toBe(true)
        expect(isPermissionBypass('YOLO')).toBe(true)
      })

      it('returns false for non-bypass values', async () => {
        const { isPermissionBypass } = await loadModule()
        expect(isPermissionBypass('code')).toBe(false)
        expect(isPermissionBypass('architect')).toBe(false)
        expect(isPermissionBypass('normal')).toBe(false)
      })
    })

    it('returns error when no active session', async () => {
      session = mockSession([])
      core = mockCore(session)
      core.sessionManager.getSession.mockReturnValue(null)
      registry = new CommandRegistry()
      const { registerConfigCommands } = await loadModule()
      registerConfigCommands(registry, core)

      const res = await registry.execute('/bypass_permissions', baseArgs(null))
      expect(res.type).toBe('error')
    })
  })

  // =============================================
  // Edge cases
  // =============================================
  describe('edge cases', () => {
    it('no active session returns error for all config commands', async () => {
      core = mockCore(undefined) // no session
      registry = new CommandRegistry()
      const { registerConfigCommands } = await loadModule()
      registerConfigCommands(registry, core)

      for (const cmd of ['/mode', '/model', '/thought', '/bypass_permissions']) {
        const res = await registry.execute(cmd, baseArgs(null))
        expect(res.type).toBe('error')
      }
    })

    it('session exists but sessionId is null returns error', async () => {
      session = mockSession([modeOption])
      core = mockCore(session)
      registry = new CommandRegistry()
      const { registerConfigCommands } = await loadModule()
      registerConfigCommands(registry, core)

      const res = await registry.execute('/mode', baseArgs(null))
      expect(res.type).toBe('error')
    })

    it('setConfigOption failure returns error', async () => {
      session = mockSession([modeOption])
      session.setConfigOption.mockRejectedValue(new Error('Agent rejected'))
      core = mockCore(session)
      registry = new CommandRegistry()
      const { registerConfigCommands } = await loadModule()
      registerConfigCommands(registry, core)

      const res = await registry.execute('/mode architect', baseArgs('test-session'))
      expect(res.type).toBe('error')
      if (res.type === 'error') {
        expect(res.message).toContain('Agent rejected')
      }
    })

    it('config option with grouped options flattens choices in menu', async () => {
      const groupedMode: ConfigOption = {
        id: 'mode',
        name: 'Mode',
        type: 'select',
        category: 'mode',
        currentValue: 'code',
        options: [
          {
            group: 'Standard',
            name: 'Standard Modes',
            options: [
              { value: 'code', name: 'Code' },
              { value: 'architect', name: 'Architect' },
            ],
          },
          { value: 'custom', name: 'Custom' },
        ],
      }
      session = mockSession([groupedMode])
      session.getConfigByCategory.mockReturnValue(groupedMode)
      core = mockCore(session)
      registry = new CommandRegistry()
      const { registerConfigCommands } = await loadModule()
      registerConfigCommands(registry, core)

      const res = await registry.execute('/mode', baseArgs('test-session'))
      expect(res.type).toBe('menu')
      if (res.type === 'menu') {
        // Should have 3 options: code, architect (from group) + custom (standalone)
        expect(res.options.length).toBe(3)
      }
    })

    it('setConfigOption returns no configOptions, falls back to optimistic update', async () => {
      session = mockSession([modeOption])
      session.agentInstance.setConfigOption.mockResolvedValue({})
      core = mockCore(session)
      registry = new CommandRegistry()
      const { registerConfigCommands } = await loadModule()
      registerConfigCommands(registry, core)

      const res = await registry.execute('/mode architect', baseArgs('test-session'))
      expect(res.type).toBe('text')
      // session.setConfigOption is still called — optimistic update path handles empty response
      expect(session.setConfigOption).toHaveBeenCalledWith(
        'mode',
        { type: 'select', value: 'architect' },
      )
    })
  })
})
