import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Session } from '../session.js'
import { TypedEmitter } from '../../utils/typed-emitter.js'
import type { AgentEvent } from '../../types.js'

function mockAgentInstance(overrides?: { sessionId?: string }) {
  const emitter = new TypedEmitter<{ agent_event: (event: AgentEvent) => void }>()
  return Object.assign(emitter, {
    sessionId: overrides?.sessionId ?? 'agent-sess-1',
    prompt: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    onPermissionRequest: vi.fn(),
  }) as any
}

function createTestSession(agentInstance?: any, agentName?: string) {
  return new Session({
    channelId: 'telegram',
    agentName: agentName ?? 'claude',
    workingDirectory: '/workspace',
    agentInstance: agentInstance ?? mockAgentInstance(),
  })
}

describe('Session.switchAgent', () => {
  it('tracks firstAgent on creation', () => {
    const session = createTestSession(undefined, 'claude')
    expect(session.firstAgent).toBe('claude')
  })

  it('initializes agentSwitchHistory as empty array', () => {
    const session = createTestSession()
    expect(session.agentSwitchHistory).toEqual([])
  })

  it('adds switchHistory entry when switching', async () => {
    const oldAgent = mockAgentInstance({ sessionId: 'old-sess' })
    const session = createTestSession(oldAgent, 'claude')
    session.agentSessionId = 'old-sess'

    // Process a prompt to increment promptCount
    await session.enqueuePrompt('hello')

    const newAgent = mockAgentInstance({ sessionId: 'new-sess' })
    await session.switchAgent('gemini', async () => newAgent)

    expect(session.agentSwitchHistory).toHaveLength(1)
    expect(session.agentSwitchHistory[0].agentName).toBe('claude')
    expect(session.agentSwitchHistory[0].agentSessionId).toBe('old-sess')
    expect(session.agentSwitchHistory[0].promptCount).toBe(1)
    expect(session.agentSwitchHistory[0].switchedAt).toBeTruthy()
  })

  it('updates agentName and agentSessionId after switch', async () => {
    const session = createTestSession(undefined, 'claude')
    const newAgent = mockAgentInstance({ sessionId: 'new-sess' })

    await session.switchAgent('gemini', async () => newAgent)

    expect(session.agentName).toBe('gemini')
    expect(session.agentSessionId).toBe('new-sess')
  })

  it('destroys old agent instance on switch', async () => {
    const oldAgent = mockAgentInstance()
    const session = createTestSession(oldAgent, 'claude')

    const newAgent = mockAgentInstance({ sessionId: 'new-sess' })
    await session.switchAgent('gemini', async () => newAgent)

    expect(oldAgent.destroy).toHaveBeenCalled()
  })

  it('resets promptCount to 0 and saves old count in history', async () => {
    const oldAgent = mockAgentInstance()
    const session = createTestSession(oldAgent, 'claude')

    // Process two prompts
    await session.enqueuePrompt('hello')
    await session.enqueuePrompt('world')
    expect(session.promptCount).toBe(2)

    const newAgent = mockAgentInstance({ sessionId: 'new-sess' })
    await session.switchAgent('gemini', async () => newAgent)

    expect(session.promptCount).toBe(0)
    expect(session.agentSwitchHistory[0].promptCount).toBe(2)
  })

  it('throws if switching to same agent', async () => {
    const session = createTestSession(undefined, 'claude')

    await expect(
      session.switchAgent('claude', async () => mockAgentInstance())
    ).rejects.toThrow('Already using claude')
  })

  it('firstAgent does not change after switching', async () => {
    const session = createTestSession(undefined, 'claude')

    await session.switchAgent('gemini', async () => mockAgentInstance({ sessionId: 'g-sess' }))

    expect(session.firstAgent).toBe('claude')
    expect(session.agentName).toBe('gemini')
  })

  describe('findLastSwitchEntry', () => {
    it('returns undefined when no history exists', () => {
      const session = createTestSession(undefined, 'claude')
      expect(session.findLastSwitchEntry('claude')).toBeUndefined()
    })

    it('finds correct entry by agent name', async () => {
      const session = createTestSession(
        mockAgentInstance({ sessionId: 'claude-sess' }),
        'claude'
      )
      session.agentSessionId = 'claude-sess'

      await session.switchAgent('gemini', async () =>
        mockAgentInstance({ sessionId: 'gemini-sess' })
      )

      const entry = session.findLastSwitchEntry('claude')
      expect(entry).toBeDefined()
      expect(entry!.agentName).toBe('claude')
      expect(entry!.agentSessionId).toBe('claude-sess')
    })

    it('returns undefined for agent not in history', async () => {
      const session = createTestSession(undefined, 'claude')
      await session.switchAgent('gemini', async () => mockAgentInstance({ sessionId: 'g' }))

      expect(session.findLastSwitchEntry('gpt')).toBeUndefined()
    })
  })

  describe('multiple switches A -> B -> C -> A', () => {
    it('tracks full history across multiple switches', async () => {
      const agentA = mockAgentInstance({ sessionId: 'a-sess' })
      const session = createTestSession(agentA, 'agentA')
      session.agentSessionId = 'a-sess'

      // A -> B
      await session.enqueuePrompt('prompt1')
      const agentB = mockAgentInstance({ sessionId: 'b-sess' })
      await session.switchAgent('agentB', async () => agentB)

      // B -> C
      await session.enqueuePrompt('prompt2')
      await session.enqueuePrompt('prompt3')
      const agentC = mockAgentInstance({ sessionId: 'c-sess' })
      await session.switchAgent('agentC', async () => agentC)

      // C -> A (back to original)
      await session.enqueuePrompt('prompt4')
      const agentA2 = mockAgentInstance({ sessionId: 'a-sess-2' })
      await session.switchAgent('agentA', async () => agentA2)

      expect(session.agentSwitchHistory).toHaveLength(3)

      // First entry: agentA with 1 prompt
      expect(session.agentSwitchHistory[0].agentName).toBe('agentA')
      expect(session.agentSwitchHistory[0].agentSessionId).toBe('a-sess')
      expect(session.agentSwitchHistory[0].promptCount).toBe(1)

      // Second entry: agentB with 2 prompts
      expect(session.agentSwitchHistory[1].agentName).toBe('agentB')
      expect(session.agentSwitchHistory[1].agentSessionId).toBe('b-sess')
      expect(session.agentSwitchHistory[1].promptCount).toBe(2)

      // Third entry: agentC with 1 prompt
      expect(session.agentSwitchHistory[2].agentName).toBe('agentC')
      expect(session.agentSwitchHistory[2].agentSessionId).toBe('c-sess')
      expect(session.agentSwitchHistory[2].promptCount).toBe(1)

      // Current agent is agentA again
      expect(session.agentName).toBe('agentA')
      expect(session.agentSessionId).toBe('a-sess-2')
      expect(session.promptCount).toBe(0)

      // firstAgent unchanged
      expect(session.firstAgent).toBe('agentA')

      // findLastSwitchEntry finds the most recent entry for agentA
      const lastA = session.findLastSwitchEntry('agentA')
      expect(lastA).toBeDefined()
      expect(lastA!.agentSessionId).toBe('a-sess')
    })
  })

  it('uses the new agent instance for subsequent prompts after switch', async () => {
    const oldAgent = mockAgentInstance()
    const session = createTestSession(oldAgent, 'claude')

    const newAgent = mockAgentInstance({ sessionId: 'new-sess' })
    await session.switchAgent('gemini', async () => newAgent)

    await session.enqueuePrompt('hello after switch')

    expect(newAgent.prompt).toHaveBeenCalledWith('hello after switch', undefined)
    // Old agent should not receive the new prompt (only destroy was called)
    expect(oldAgent.prompt).not.toHaveBeenCalled()
  })
})
