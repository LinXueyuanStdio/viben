import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Session } from '../session.js'
import type { AgentInstance } from '../../agents/agent-instance.js'
import type { AgentCapabilities, ConfigOption } from '../../types.js'
import { MiddlewareChain } from '../../plugin/middleware-chain.js'

function mockAgentInstance() {
  return {
    sessionId: 'agent-sess-1',
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    prompt: vi.fn().mockResolvedValue({ stopReason: 'end_turn' }),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    onPermissionRequest: vi.fn(),
  } as unknown as AgentInstance
}

function createTestSession() {
  return new Session({
    id: 'test-session',
    channelId: 'telegram',
    agentName: 'claude',
    workingDirectory: '/tmp',
    agentInstance: mockAgentInstance(),
  })
}

const sampleSelectOption: ConfigOption = {
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

const sampleModelOption: ConfigOption = {
  id: 'model',
  name: 'Model',
  type: 'select',
  category: 'model',
  currentValue: 'sonnet',
  options: [
    { value: 'sonnet', name: 'Sonnet' },
    { value: 'opus', name: 'Opus' },
  ],
}

const sampleBooleanOption: ConfigOption = {
  id: 'thinking',
  name: 'Thinking',
  type: 'boolean',
  category: 'thought_level',
  currentValue: true,
}

const sampleNoCategoryOption: ConfigOption = {
  id: 'custom-toggle',
  name: 'Custom Toggle',
  type: 'boolean',
  currentValue: false,
}

describe('Session configOptions migration', () => {
  let session: Session

  beforeEach(() => {
    session = createTestSession()
  })

  // ========================================
  // 1. Initial state
  // ========================================
  describe('initial state', () => {
    it('starts with empty configOptions array', () => {
      expect(session.configOptions).toEqual([])
    })

    it('starts with empty clientOverrides object', () => {
      expect(session.clientOverrides).toEqual({})
    })

    it('starts with undefined agentCapabilities', () => {
      expect(session.agentCapabilities).toBeUndefined()
    })

    it('does not have legacy dangerousMode field', () => {
      expect('dangerousMode' in session).toBe(false)
    })

    it('does not have legacy currentMode field', () => {
      expect('currentMode' in session).toBe(false)
    })

    it('does not have legacy availableModes field', () => {
      expect('availableModes' in session).toBe(false)
    })

    it('does not have legacy currentModel field', () => {
      expect('currentModel' in session).toBe(false)
    })

    it('does not have legacy availableModels field', () => {
      expect('availableModels' in session).toBe(false)
    })
  })

  // ========================================
  // 2. setInitialConfigOptions()
  // ========================================
  describe('setInitialConfigOptions()', () => {
    it('sets configOptions from array', () => {
      session.setInitialConfigOptions([sampleSelectOption, sampleBooleanOption])
      expect(session.configOptions).toHaveLength(2)
      expect(session.configOptions[0].id).toBe('mode')
      expect(session.configOptions[1].id).toBe('thinking')
    })

    it('handles empty array', () => {
      session.setInitialConfigOptions([])
      expect(session.configOptions).toEqual([])
    })

    it('handles null gracefully by setting empty array', () => {
      session.setInitialConfigOptions(null as any)
      expect(session.configOptions).toEqual([])
    })

    it('handles undefined gracefully by setting empty array', () => {
      session.setInitialConfigOptions(undefined as any)
      expect(session.configOptions).toEqual([])
    })

    it('replaces previous configOptions if called twice (resume override)', () => {
      session.setInitialConfigOptions([sampleSelectOption])
      expect(session.configOptions).toHaveLength(1)

      session.setInitialConfigOptions([sampleBooleanOption, sampleModelOption])
      expect(session.configOptions).toHaveLength(2)
      expect(session.configOptions[0].id).toBe('thinking')
      expect(session.configOptions[1].id).toBe('model')
    })
  })

  // ========================================
  // 3. setAgentCapabilities()
  // ========================================
  describe('setAgentCapabilities()', () => {
    it('sets agentCapabilities', () => {
      const caps: AgentCapabilities = {
        name: 'claude',
        loadSession: true,
        sessionCapabilities: { list: true, fork: false, close: true },
      }
      session.setAgentCapabilities(caps)
      expect(session.agentCapabilities).toEqual(caps)
    })

    it('handles undefined by clearing agentCapabilities', () => {
      session.setAgentCapabilities({ name: 'claude' })
      session.setAgentCapabilities(undefined as any)
      expect(session.agentCapabilities).toBeUndefined()
    })
  })

  // ========================================
  // 4. getConfigOption(id)
  // ========================================
  describe('getConfigOption(id)', () => {
    beforeEach(() => {
      session.setInitialConfigOptions([sampleSelectOption, sampleModelOption, sampleBooleanOption])
    })

    it('finds option by id', () => {
      const result = session.getConfigOption('mode')
      expect(result).toBeDefined()
      expect(result!.id).toBe('mode')
      expect(result!.name).toBe('Mode')
    })

    it('returns undefined for missing id', () => {
      expect(session.getConfigOption('nonexistent')).toBeUndefined()
    })

    it('returns first match if duplicates exist', () => {
      const duplicate: ConfigOption = {
        id: 'mode',
        name: 'Mode Duplicate',
        type: 'select',
        currentValue: 'architect',
        options: [],
      }
      session.setInitialConfigOptions([sampleSelectOption, duplicate])
      const result = session.getConfigOption('mode')
      expect(result!.name).toBe('Mode') // first match
    })
  })

  // ========================================
  // 5. getConfigByCategory(category)
  // ========================================
  describe('getConfigByCategory(category)', () => {
    beforeEach(() => {
      session.setInitialConfigOptions([
        sampleSelectOption,
        sampleModelOption,
        sampleBooleanOption,
        sampleNoCategoryOption,
      ])
    })

    it('finds option by category "mode"', () => {
      const result = session.getConfigByCategory('mode')
      expect(result).toBeDefined()
      expect(result!.id).toBe('mode')
    })

    it('finds option by category "model"', () => {
      const result = session.getConfigByCategory('model')
      expect(result).toBeDefined()
      expect(result!.id).toBe('model')
    })

    it('finds option by category "thought_level"', () => {
      const result = session.getConfigByCategory('thought_level')
      expect(result).toBeDefined()
      expect(result!.id).toBe('thinking')
    })

    it('returns undefined for missing category', () => {
      expect(session.getConfigByCategory('nonexistent')).toBeUndefined()
    })

    it('handles options without category field', () => {
      // sampleNoCategoryOption has no category, should not match any category search
      session.setInitialConfigOptions([sampleNoCategoryOption])
      expect(session.getConfigByCategory('mode')).toBeUndefined()
    })

    it('returns first match if multiple options share category', () => {
      const secondMode: ConfigOption = {
        id: 'mode2',
        name: 'Second Mode',
        type: 'select',
        category: 'mode',
        currentValue: 'x',
        options: [],
      }
      session.setInitialConfigOptions([sampleSelectOption, secondMode])
      const result = session.getConfigByCategory('mode')
      expect(result!.id).toBe('mode') // first match
    })
  })

  // ========================================
  // 6. getConfigValue(id)
  // ========================================
  describe('getConfigValue(id)', () => {
    beforeEach(() => {
      session.setInitialConfigOptions([sampleSelectOption, sampleBooleanOption])
    })

    it('returns currentValue as string for select option', () => {
      expect(session.getConfigValue('mode')).toBe('code')
    })

    it('returns undefined for missing id', () => {
      expect(session.getConfigValue('nonexistent')).toBeUndefined()
    })

    it('handles boolean currentValue by converting to string', () => {
      expect(session.getConfigValue('thinking')).toBe('true')
    })

    it('handles boolean false value', () => {
      const falseOption: ConfigOption = {
        id: 'disabled',
        name: 'Disabled',
        type: 'boolean',
        currentValue: false,
      }
      session.setInitialConfigOptions([falseOption])
      expect(session.getConfigValue('disabled')).toBe('false')
    })
  })

  // ========================================
  // 7. updateConfigOptions()
  // ========================================
  describe('updateConfigOptions()', () => {
    it('replaces entire array (full state replacement)', async () => {
      session.setInitialConfigOptions([sampleSelectOption])
      const newOptions: ConfigOption[] = [sampleBooleanOption, sampleModelOption]
      await session.updateConfigOptions(newOptions)
      expect(session.configOptions).toEqual(newOptions)
      expect(session.configOptions).toHaveLength(2)
    })

    it('fires config:beforeChange middleware hook', async () => {
      const chain = new MiddlewareChain()
      const hookSpy = vi.fn(async (payload: any) => payload)
      chain.add('config:beforeChange', 'test-plugin', { handler: hookSpy })
      session.middlewareChain = chain

      await session.updateConfigOptions([sampleSelectOption])
      expect(hookSpy).toHaveBeenCalled()
    })

    it('blocked by middleware returns without updating', async () => {
      const chain = new MiddlewareChain()
      // Middleware that blocks by returning null
      chain.add('config:beforeChange', 'test-plugin', {
        handler: async () => null,
      })
      session.middlewareChain = chain

      session.setInitialConfigOptions([sampleSelectOption])
      await session.updateConfigOptions([sampleBooleanOption])
      // Should still have the original options since middleware blocked
      expect(session.configOptions[0].id).toBe('mode')
    })

    it('works without middleware chain (null)', async () => {
      session.middlewareChain = undefined
      await session.updateConfigOptions([sampleBooleanOption])
      expect(session.configOptions).toEqual([sampleBooleanOption])
    })
  })

  // ========================================
  // 8. toAcpStateSnapshot()
  // ========================================
  describe('toAcpStateSnapshot()', () => {
    it('returns configOptions and agentCapabilities only', () => {
      session.setInitialConfigOptions([sampleSelectOption])
      session.setAgentCapabilities({ name: 'claude' })
      const snapshot = session.toAcpStateSnapshot()
      expect(snapshot).toEqual({
        configOptions: [sampleSelectOption],
        agentCapabilities: { name: 'claude' },
      })
    })

    it('does NOT include legacy fields', () => {
      session.setInitialConfigOptions([sampleSelectOption])
      const snapshot = session.toAcpStateSnapshot()
      expect('currentMode' in snapshot).toBe(false)
      expect('availableModes' in snapshot).toBe(false)
      expect('currentModel' in snapshot).toBe(false)
      expect('availableModels' in snapshot).toBe(false)
    })

    it('returns undefined configOptions for empty array', () => {
      const snapshot = session.toAcpStateSnapshot()
      expect(snapshot.configOptions).toBeUndefined()
    })

    it('includes agentCapabilities when set', () => {
      const caps: AgentCapabilities = { name: 'claude', loadSession: true }
      session.setAgentCapabilities(caps)
      const snapshot = session.toAcpStateSnapshot()
      expect(snapshot.agentCapabilities).toEqual(caps)
    })

    it('returns undefined agentCapabilities when not set', () => {
      const snapshot = session.toAcpStateSnapshot()
      expect(snapshot.agentCapabilities).toBeUndefined()
    })
  })

  // ========================================
  // 9. clientOverrides
  // ========================================
  describe('clientOverrides', () => {
    it('default is empty object', () => {
      expect(session.clientOverrides).toEqual({})
    })

    it('can set bypassPermissions to true', () => {
      session.clientOverrides.bypassPermissions = true
      expect(session.clientOverrides.bypassPermissions).toBe(true)
    })

    it('can set bypassPermissions to false', () => {
      session.clientOverrides.bypassPermissions = true
      session.clientOverrides.bypassPermissions = false
      expect(session.clientOverrides.bypassPermissions).toBe(false)
    })

    it('persists through session lifecycle', async () => {
      session.clientOverrides.bypassPermissions = true
      session.activate()
      expect(session.clientOverrides.bypassPermissions).toBe(true)
    })
  })

  // ========================================
  // Legacy methods should not exist
  // ========================================
  describe('removed legacy methods', () => {
    it('does not have updateMode method', () => {
      expect('updateMode' in session).toBe(false)
    })

    it('does not have updateModel method', () => {
      expect('updateModel' in session).toBe(false)
    })

    it('does not have setInitialAcpState method', () => {
      expect('setInitialAcpState' in session).toBe(false)
    })
  })
})
