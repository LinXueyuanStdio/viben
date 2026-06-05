import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Session } from '../session.js'
import type { AgentInstance } from '../../agents/agent-instance.js'
import type { AgentCapabilities, ConfigOption } from '../../types.js'

function mockAgentInstance() {
  return {
    sessionId: 'agent-sess-1',
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    prompt: vi.fn().mockResolvedValue({ stopReason: 'end_turn' }),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    setConfigOption: vi.fn().mockResolvedValue({ configOptions: [] }),
    onPermissionRequest: vi.fn(),
  } as unknown as AgentInstance
}

describe('Session ACP state', () => {
  let session: Session

  beforeEach(() => {
    session = new Session({
      id: 'test-session',
      channelId: 'telegram',
      agentName: 'claude',
      workingDirectory: '/tmp',
      agentInstance: mockAgentInstance(),
    })
  })

  it('initializes with empty configOptions', () => {
    expect(session.configOptions).toEqual([])
  })

  it('initializes with undefined agentCapabilities', () => {
    expect(session.agentCapabilities).toBeUndefined()
  })

  it('setInitialConfigOptions stores config options', () => {
    const configOptions: ConfigOption[] = [
      {
        id: 'mode',
        name: 'Mode',
        category: 'mode',
        type: 'select',
        currentValue: 'code',
        options: [
          { value: 'code', name: 'Code' },
          { value: 'architect', name: 'Architect' },
        ],
      },
      {
        id: 'model',
        name: 'Model',
        type: 'select',
        currentValue: 'sonnet',
        options: [{ value: 'sonnet', name: 'Sonnet' }],
      },
    ]

    session.setInitialConfigOptions(configOptions)

    expect(session.configOptions).toHaveLength(2)
    expect(session.getConfigValue('mode')).toBe('code')
    expect(session.getConfigValue('model')).toBe('sonnet')
  })

  it('getConfigByCategory returns option by category', () => {
    const configOptions: ConfigOption[] = [
      {
        id: 'mode',
        name: 'Mode',
        category: 'mode',
        type: 'select',
        currentValue: 'code',
        options: [{ value: 'code', name: 'Code' }],
      },
    ]
    session.setInitialConfigOptions(configOptions)

    const modeOption = session.getConfigByCategory('mode')
    expect(modeOption).toBeDefined()
    expect(modeOption?.currentValue).toBe('code')
  })

  it('updateConfigOptions replaces options', async () => {
    const opts: ConfigOption[] = [
      {
        id: 'thought',
        name: 'Thinking',
        type: 'boolean',
        currentValue: true,
      },
    ]
    await session.updateConfigOptions(opts)
    expect(session.configOptions).toEqual(opts)
  })

  it('setAgentCapabilities stores capabilities', () => {
    session.setAgentCapabilities({ name: 'claude', loadSession: true } as AgentCapabilities)
    expect(session.agentCapabilities?.name).toBe('claude')
  })

  it('toAcpStateSnapshot returns configOptions and agentCapabilities', () => {
    const configOptions: ConfigOption[] = [
      {
        id: 'model',
        name: 'Model',
        type: 'select',
        currentValue: 'sonnet',
        options: [{ value: 'sonnet', name: 'Sonnet' }],
      },
    ]
    session.setInitialConfigOptions(configOptions)
    session.setAgentCapabilities({ name: 'claude' } as AgentCapabilities)

    const snapshot = session.toAcpStateSnapshot()
    expect(snapshot.configOptions).toHaveLength(1)
    expect(snapshot.agentCapabilities?.name).toBe('claude')
  })

  it('toAcpStateSnapshot omits configOptions when empty', () => {
    const snapshot = session.toAcpStateSnapshot()
    expect(snapshot.configOptions).toBeUndefined()
    expect(snapshot.agentCapabilities).toBeUndefined()
  })

  it('getConfigOption returns option by id', () => {
    const configOptions: ConfigOption[] = [
      {
        id: 'model',
        name: 'Model',
        type: 'select',
        currentValue: 'sonnet',
        options: [{ value: 'sonnet', name: 'Sonnet' }],
      },
    ]
    session.setInitialConfigOptions(configOptions)

    expect(session.getConfigOption('model')).toBeDefined()
    expect(session.getConfigOption('nonexistent')).toBeUndefined()
  })

  it('clientOverrides starts empty', () => {
    expect(session.clientOverrides).toEqual({})
    expect(session.clientOverrides.bypassPermissions).toBeUndefined()
  })
})

describe('Session.setConfigOption legacy fallback (empty configOptions response)', () => {
  const initialOptions: ConfigOption[] = [
    {
      id: 'mode',
      name: 'Mode',
      category: 'mode',
      type: 'select',
      currentValue: 'code',
      options: [
        { value: 'code', name: 'Code' },
        { value: 'architect', name: 'Architect' },
      ],
    },
    {
      id: 'model',
      name: 'Model',
      category: 'model',
      type: 'select',
      currentValue: 'sonnet',
      options: [
        { value: 'sonnet', name: 'Sonnet' },
        { value: 'opus', name: 'Opus' },
      ],
    },
  ]

  let session: Session
  let agent: ReturnType<typeof mockAgentInstance>

  beforeEach(() => {
    agent = mockAgentInstance()
    session = new Session({
      id: 'test-session',
      channelId: 'telegram',
      agentName: 'gemini',
      workingDirectory: '/tmp',
      agentInstance: agent,
    })
    session.setInitialConfigOptions(initialOptions)
  })

  it('updates currentValue optimistically when agent returns empty configOptions', async () => {
    // Simulate legacy agent (e.g. Gemini) returning empty configOptions
    vi.mocked(agent.setConfigOption).mockResolvedValueOnce({ configOptions: [] })

    await session.setConfigOption('mode', { type: 'select', value: 'architect' })

    expect(session.getConfigValue('mode')).toBe('architect')
  })

  it('preserves other options when updating one optimistically', async () => {
    vi.mocked(agent.setConfigOption).mockResolvedValueOnce({ configOptions: [] })

    await session.setConfigOption('mode', { type: 'select', value: 'architect' })

    // model option should be unchanged
    expect(session.getConfigValue('model')).toBe('sonnet')
    expect(session.configOptions).toHaveLength(2)
  })

  it('uses full response configOptions when agent returns them (non-legacy)', async () => {
    const updatedOptions: ConfigOption[] = [
      { id: 'mode', name: 'Mode', category: 'mode', type: 'select', currentValue: 'architect', options: [] },
      { id: 'model', name: 'Model', category: 'model', type: 'select', currentValue: 'opus', options: [] },
    ]
    vi.mocked(agent.setConfigOption).mockResolvedValueOnce({ configOptions: updatedOptions })

    await session.setConfigOption('mode', { type: 'select', value: 'architect' })

    // Should use the full response, including model change returned by agent
    expect(session.configOptions).toEqual(updatedOptions)
    expect(session.getConfigValue('model')).toBe('opus')
  })

  it('does not touch boolean options when updating a select option optimistically', async () => {
    const withBoolean: ConfigOption[] = [
      ...initialOptions,
      { id: 'verbose', name: 'Verbose', type: 'boolean', currentValue: true },
    ]
    session.setInitialConfigOptions(withBoolean)
    vi.mocked(agent.setConfigOption).mockResolvedValueOnce({ configOptions: [] })

    await session.setConfigOption('mode', { type: 'select', value: 'architect' })

    const verboseOpt = session.getConfigOption('verbose')
    expect(verboseOpt?.type).toBe('boolean')
    if (verboseOpt?.type === 'boolean') {
      expect(verboseOpt.currentValue).toBe(true)
    }
  })

  it('model currentValue updated optimistically when agent returns empty configOptions', async () => {
    vi.mocked(agent.setConfigOption).mockResolvedValueOnce({ configOptions: [] })

    await session.setConfigOption('model', { type: 'select', value: 'opus' })

    expect(session.getConfigValue('model')).toBe('opus')
    expect(session.getConfigValue('mode')).toBe('code') // mode unchanged
  })
})
