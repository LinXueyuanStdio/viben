import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Session } from '../session.js'
import { TypedEmitter } from '../../utils/typed-emitter.js'
import type { AgentEvent } from '../../types.js'
import { MiddlewareChain } from '../../plugin/middleware-chain.js'

function mockAgentInstance() {
  const emitter = new TypedEmitter<{ agent_event: (event: AgentEvent) => void }>()
  return Object.assign(emitter, {
    sessionId: 'agent-sess-1',
    prompt: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    onPermissionRequest: vi.fn(),
  }) as any
}

function createTestSession(agentInstance?: any) {
  return new Session({
    channelId: 'telegram',
    agentName: 'claude',
    workingDirectory: '/workspace',
    agentInstance: agentInstance || mockAgentInstance(),
  })
}

describe('Session - Lifecycle & Prompt Processing', () => {
  describe('constructor', () => {
    it('generates id when not provided', () => {
      const session = createTestSession()
      expect(session.id).toBeTruthy()
      expect(session.id.length).toBeGreaterThan(0)
    })

    it('uses provided id', () => {
      const session = new Session({
        id: 'custom-id',
        channelId: 'telegram',
        agentName: 'claude',
        workingDirectory: '/workspace',
        agentInstance: mockAgentInstance(),
      })
      expect(session.id).toBe('custom-id')
    })

    it('starts in initializing status', () => {
      const session = createTestSession()
      expect(session.status).toBe('initializing')
    })

    it('initializes with correct properties', () => {
      const session = createTestSession()
      expect(session.channelId).toBe('telegram')
      expect(session.agentName).toBe('claude')
      expect(session.workingDirectory).toBe('/workspace')
      expect(session.threadId).toBe('')
      expect(session.name).toBeUndefined()
      expect(session.clientOverrides).toEqual({})
    })
  })

  describe('enqueuePrompt()', () => {
    it('processes prompt through agent', async () => {
      const agent = mockAgentInstance()
      const session = createTestSession(agent)

      await session.enqueuePrompt('hello')

      expect(agent.prompt).toHaveBeenCalledWith('hello', undefined)
    })

    it('activates session on first user prompt from initializing', async () => {
      const session = createTestSession()
      const statusChanges: [string, string][] = []
      session.on('status_change', (from, to) => statusChanges.push([from, to]))

      await session.enqueuePrompt('hello')

      expect(session.status).toBe('active')
      expect(statusChanges).toContainEqual(['initializing', 'active'])
    })

    it('auto-names session after first prompt', async () => {
      const agent = mockAgentInstance()
      // Simulate agent responding with title during auto-name prompt
      agent.prompt.mockImplementation(async (text: string) => {
        if (text.includes('Summarize')) {
          // Simulate agent emitting a text event during auto-name prompt
          agent.emit('agent_event', { type: 'text', content: 'Test Title' })
        }
      })

      const session = createTestSession(agent)
      const names: string[] = []
      session.on('named', (name) => names.push(name))

      await session.enqueuePrompt('hello world')

      // Agent should have been called twice: once for user prompt, once for auto-name
      expect(agent.prompt).toHaveBeenCalledTimes(2)
      expect(agent.prompt).toHaveBeenCalledWith(
        expect.stringContaining('Summarize'),
      )
    })

    it('does not auto-name if already named', async () => {
      const agent = mockAgentInstance()
      const session = createTestSession(agent)
      session.name = 'Already Named'

      await session.enqueuePrompt('hello')

      // Only the user prompt, no auto-name
      expect(agent.prompt).toHaveBeenCalledTimes(1)
    })

    it('processes prompts serially through queue', async () => {
      const order: string[] = []
      let resolve1!: () => void
      const p1 = new Promise<void>((r) => { resolve1 = r })
      const agent = mockAgentInstance()
      agent.prompt.mockImplementation(async (text: string) => {
        order.push(`start:${text}`)
        if (text === 'first') await p1
        order.push(`end:${text}`)
      })

      const session = createTestSession(agent)
      session.name = 'skip-autoname' // prevent auto-name interfering

      const e1 = session.enqueuePrompt('first')
      const e2 = session.enqueuePrompt('second')

      expect(session.queueDepth).toBe(1)
      expect(session.promptRunning).toBe(true)

      resolve1()
      await Promise.all([e1, e2])

      expect(order).toEqual([
        'start:first', 'end:first',
        'start:second', 'end:second',
      ])
    })
  })

  describe('abortPrompt()', () => {
    it('is a no-op when no turn is in-flight', async () => {
      const agent = mockAgentInstance()
      const session = createTestSession(agent)
      session.activate()

      await session.abortPrompt()

      // No active turn context → agent.cancel should NOT be called
      expect(agent.cancel).not.toHaveBeenCalled()
    })
  })

  describe('destroy()', () => {
    it('destroys agent instance', async () => {
      const agent = mockAgentInstance()
      const session = createTestSession(agent)

      await session.destroy()

      expect(agent.destroy).toHaveBeenCalled()
    })

    it('rejects pending permission promise on destroy', async () => {
      const agent = mockAgentInstance()
      const session = createTestSession(agent)

      // Set up a pending permission gate
      const permissionPromise = session.permissionGate.setPending({
        id: 'req-1',
        description: 'Run a command',
        options: [{ id: 'allow', label: 'Allow', isAllow: true }, { id: 'deny', label: 'Deny', isAllow: false }],
      })

      expect(session.permissionGate.isPending).toBe(true)

      // destroy() should reject the pending permission promise
      await session.destroy()

      await expect(permissionPromise).rejects.toThrow('Session destroyed')
      expect(session.permissionGate.isPending).toBe(false)
      expect(agent.destroy).toHaveBeenCalled()
    })

    it('clears queued prompts on destroy', async () => {
      let resolvePrompt!: () => void
      const agent = mockAgentInstance()
      // Block the first prompt so we can queue a second
      agent.prompt.mockImplementation(async () => {
        await new Promise<void>((r) => { resolvePrompt = r })
      })

      const session = createTestSession(agent)
      session.name = 'skip-autoname'

      // Start first prompt (will be blocked)
      const p1 = session.enqueuePrompt('first')
      // Queue a second prompt while first is running
      const p2 = session.enqueuePrompt('second')

      expect(session.queueDepth).toBe(1)

      // Destroy clears the queue; both promises should resolve without hanging
      await session.destroy()
      resolvePrompt()

      await expect(Promise.all([p1, p2])).resolves.not.toThrow()
      // Only the first prompt should have been sent to agent
      expect(agent.prompt).toHaveBeenCalledTimes(1)
    })
  })

  describe('permissionGate', () => {
    it('exposes a PermissionGate instance', () => {
      const session = createTestSession()
      expect(session.permissionGate).toBeDefined()
      expect(session.permissionGate.isPending).toBe(false)
    })
  })

  describe('autoName edge cases', () => {
    it('falls back to session ID prefix if agent returns empty', async () => {
      const agent = mockAgentInstance()
      agent.prompt.mockResolvedValue(undefined) // Agent returns nothing for auto-name
      const session = createTestSession(agent)
      const names: string[] = []
      session.on('named', (n) => names.push(n))

      await session.enqueuePrompt('hello')

      // Name should be set to fallback
      expect(session.name).toBeTruthy()
      expect(session.name).toContain('Session')
    })

    it('truncates long names to 50 chars', async () => {
      const agent = mockAgentInstance()
      const longTitle = 'A'.repeat(100)
      agent.prompt.mockImplementation(async (text: string) => {
        if (text.includes('Summarize')) {
          agent.emit('agent_event', { type: 'text', content: longTitle })
        }
      })

      const session = createTestSession(agent)
      await session.enqueuePrompt('hello')

      expect(session.name!.length).toBeLessThanOrEqual(50)
    })

    it('falls back if auto-name prompt throws', async () => {
      const agent = mockAgentInstance()
      let callCount = 0
      agent.prompt.mockImplementation(async (text: string) => {
        callCount++
        if (callCount === 2) throw new Error('auto-name error')
      })

      const session = createTestSession(agent)
      await session.enqueuePrompt('hello')

      expect(session.name).toContain('Session')
    })

    it('cleans up capture listener after auto-name', async () => {
      const agent = mockAgentInstance()
      const session = createTestSession(agent)

      // After auto-name, the agent emitter should not be paused
      // and no lingering capture listeners should remain
      await session.enqueuePrompt('hello')
      expect(agent.isPaused).toBe(false)
    })
  })
})

describe("Session - Context Injection", () => {
  it("prepends context to first prompt only", async () => {
    const agent = mockAgentInstance();
    const session = createTestSession(agent);
    session.name = "skip-autoname";
    session.setContext("Previous conversation context here");

    await session.enqueuePrompt("fix the bug");
    await vi.waitFor(() => expect(agent.prompt).toHaveBeenCalledTimes(1));

    const promptText = agent.prompt.mock.calls[0][0];
    expect(promptText).toContain("[CONVERSATION HISTORY");
    expect(promptText).toContain("Previous conversation context here");
    expect(promptText).toContain("[END CONVERSATION HISTORY]");
    expect(promptText).toContain("fix the bug");
  });

  it("does not inject context on second prompt", async () => {
    const agent = mockAgentInstance();
    const session = createTestSession(agent);
    session.setContext("context");
    session.name = "skip-autoname";

    await session.enqueuePrompt("first");
    await vi.waitFor(() => expect(agent.prompt).toHaveBeenCalledTimes(1));

    await session.enqueuePrompt("second");
    await vi.waitFor(() => expect(agent.prompt).toHaveBeenCalledTimes(2));

    const secondPrompt = agent.prompt.mock.calls[1][0];
    expect(secondPrompt).not.toContain("[CONVERSATION HISTORY");
    expect(secondPrompt).toBe("second");
  });

  it("works without context set (no injection)", async () => {
    const agent = mockAgentInstance();
    const session = createTestSession(agent);
    session.name = "skip-autoname";

    await session.enqueuePrompt("hello");
    await vi.waitFor(() => expect(agent.prompt).toHaveBeenCalledTimes(1));
    expect(agent.prompt.mock.calls[0][0]).toBe("hello");
  });

  it("processPrompt silently returns if session is finished", async () => {
    const agent = mockAgentInstance();
    const session = createTestSession(agent);
    session.activate();
    session.finish("done");
    const callsBefore = agent.prompt.mock.calls.length;
    await session.enqueuePrompt("hello after finish");
    await new Promise((r) => setTimeout(r, 50));
    expect(agent.prompt.mock.calls.length).toBe(callsBefore);
  });
});

describe("Session - turn:end middleware on error", () => {
  it("fires turn:end with stopReason 'error' even when prompt throws", async () => {
    const agent = mockAgentInstance();
    agent.prompt.mockRejectedValue(new Error("agent crash"));

    const turnEndPayloads: { stopReason: string }[] = [];
    const chain = new MiddlewareChain();
    chain.add("turn:end", "test", {
      priority: 100,
      handler: async (payload: any, next: any) => {
        turnEndPayloads.push({ stopReason: payload.stopReason });
        return next(payload);
      },
    });

    const session = createTestSession(agent);
    session.name = "skip-autoname";
    session.middlewareChain = chain;

    await session.enqueuePrompt("hello");
    await vi.waitFor(() => expect(turnEndPayloads).toHaveLength(1), { timeout: 1000 });

    expect(turnEndPayloads[0].stopReason).toBe("error");
  });

  it("fires turn:end with stopReason 'end_turn' on success", async () => {
    const agent = mockAgentInstance();
    agent.prompt.mockResolvedValue(undefined);

    const turnEndPayloads: { stopReason: string }[] = [];
    const chain = new MiddlewareChain();
    chain.add("turn:end", "test", {
      priority: 100,
      handler: async (payload: any, next: any) => {
        turnEndPayloads.push({ stopReason: payload.stopReason });
        return next(payload);
      },
    });

    const session = createTestSession(agent);
    session.name = "skip-autoname";
    session.middlewareChain = chain;

    await session.enqueuePrompt("hello");
    await vi.waitFor(() => expect(turnEndPayloads).toHaveLength(1), { timeout: 1000 });

    expect(turnEndPayloads[0].stopReason).toBe("end_turn");
  });
});
