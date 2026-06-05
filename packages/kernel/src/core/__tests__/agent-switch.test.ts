import { describe, it, expect, vi } from 'vitest';
import { Session } from '../sessions/session.js';
import { TypedEmitter } from '../utils/typed-emitter.js';
import type { AgentEvent } from '../types.js';
import { SessionBridge } from '../sessions/session-bridge.js';
import { SessionManager } from '../sessions/session-manager.js';

function mockAgentInstance(overrides?: { sessionId?: string }) {
  const emitter = new TypedEmitter<{ agent_event: (event: AgentEvent) => void }>();
  return Object.assign(emitter, {
    sessionId: overrides?.sessionId ?? 'agent-sess-1',
    prompt: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    onPermissionRequest: vi.fn(),
    promptCapabilities: {},
  }) as any;
}

function createTestSession(agentInstance?: any, agentName?: string) {
  return new Session({
    channelId: 'telegram',
    agentName: agentName ?? 'claude',
    workingDirectory: '/workspace',
    agentInstance: agentInstance ?? mockAgentInstance(),
  });
}

function mockAdapter() {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    renameSessionThread: vi.fn().mockResolvedValue(undefined),
    sendPermissionRequest: vi.fn().mockResolvedValue(undefined),
    sendSkillCommands: vi.fn().mockResolvedValue(undefined),
    cleanupSkillCommands: vi.fn(),
    cleanupSessionState: vi.fn().mockResolvedValue(undefined),
    stripTTSBlock: vi.fn(),
    flushPendingSkillCommands: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function mockBridgeDeps(overrides?: Partial<import('../sessions/session-bridge.js').BridgeDeps>) {
  return {
    messageTransformer: { transform: vi.fn().mockReturnValue({ type: 'text', text: '' }) } as any,
    notificationManager: { notify: vi.fn().mockResolvedValue(undefined), notifyAll: vi.fn().mockResolvedValue(undefined) } as any,
    sessionManager: { patchRecord: vi.fn().mockResolvedValue(undefined), getSessionRecord: vi.fn() } as any,
    eventBus: { emit: vi.fn() } as any,
    ...overrides,
  };
}

describe('SessionBridge config_option_update', () => {
  it('awaits updateConfigOptions before persisting ACP state', async () => {
    const agent = mockAgentInstance({ sessionId: 'sess-1' });
    const session = createTestSession(agent, 'claude');
    const adapter = mockAdapter();
    const deps = mockBridgeDeps();
    const bridge = new SessionBridge(session, adapter, deps);
    bridge.connect();

    // Track call order
    const callOrder: string[] = [];
    const originalUpdate = session.updateConfigOptions.bind(session);
    session.updateConfigOptions = vi.fn(async (options) => {
      callOrder.push('updateConfigOptions:start');
      await originalUpdate(options);
      callOrder.push('updateConfigOptions:end');
    });
    const originalPatch = deps.sessionManager.patchRecord;
    deps.sessionManager.patchRecord = vi.fn(async (...args: any[]) => {
      callOrder.push('patchRecord');
      return originalPatch(...args);
    });

    // Emit config_option_update from agent
    const configEvent = {
      type: 'config_option_update' as const,
      options: [{ id: 'mode', name: 'Mode', category: 'mode', type: 'select' as const, currentValue: 'code', options: [] }],
    };
    agent.emit('agent_event', configEvent);

    // Wait for async processing
    await vi.waitFor(() => {
      expect(deps.sessionManager.patchRecord).toHaveBeenCalled();
    });

    // persistAcpState should happen AFTER updateConfigOptions completes
    expect(callOrder.indexOf('updateConfigOptions:end')).toBeLessThan(callOrder.indexOf('patchRecord'));
  });
});

describe('Agent Switch — Session-level integration', () => {
  it('preserves session identity (same session.id) across switches', async () => {
    const session = createTestSession(mockAgentInstance({ sessionId: 'old' }), 'claude');
    const originalId = session.id;

    await session.switchAgent('gemini', async () => mockAgentInstance({ sessionId: 'new' }));

    expect(session.id).toBe(originalId);
    expect(session.agentName).toBe('gemini');
  });

  it('records switch history correctly with promptCount', async () => {
    const oldAgent = mockAgentInstance({ sessionId: 'claude-sess' });
    const session = createTestSession(oldAgent, 'claude');
    session.agentSessionId = 'claude-sess';

    // Process some prompts
    await session.enqueuePrompt('hello');
    await session.enqueuePrompt('world');
    expect(session.promptCount).toBe(2);

    await session.switchAgent('gemini', async () => mockAgentInstance({ sessionId: 'gemini-sess' }));

    expect(session.agentSwitchHistory).toHaveLength(1);
    expect(session.agentSwitchHistory[0]).toMatchObject({
      agentName: 'claude',
      agentSessionId: 'claude-sess',
      promptCount: 2,
    });
    expect(session.agentSwitchHistory[0].switchedAt).toBeTruthy();
  });

  it('resets promptCount after switch', async () => {
    const session = createTestSession(mockAgentInstance({ sessionId: 'old' }), 'claude');

    await session.enqueuePrompt('hi');
    expect(session.promptCount).toBe(1);

    await session.switchAgent('gemini', async () => mockAgentInstance({ sessionId: 'new' }));

    expect(session.promptCount).toBe(0);
  });

  it('handles multiple switches A -> B -> C -> A', async () => {
    const agentA = mockAgentInstance({ sessionId: 'a-sess' });
    const session = createTestSession(agentA, 'agentA');
    session.agentSessionId = 'a-sess';

    // A -> B
    await session.enqueuePrompt('prompt1');
    await session.switchAgent('agentB', async () => mockAgentInstance({ sessionId: 'b-sess' }));

    // B -> C
    await session.enqueuePrompt('prompt2');
    await session.enqueuePrompt('prompt3');
    await session.switchAgent('agentC', async () => mockAgentInstance({ sessionId: 'c-sess' }));

    // C -> A
    await session.enqueuePrompt('prompt4');
    await session.switchAgent('agentA', async () => mockAgentInstance({ sessionId: 'a-sess-2' }));

    expect(session.agentSwitchHistory).toHaveLength(3);
    expect(session.agentName).toBe('agentA');
    expect(session.agentSessionId).toBe('a-sess-2');
    expect(session.promptCount).toBe(0);
    expect(session.firstAgent).toBe('agentA');

    // Verify each history entry
    expect(session.agentSwitchHistory[0]).toMatchObject({
      agentName: 'agentA',
      agentSessionId: 'a-sess',
      promptCount: 1,
    });
    expect(session.agentSwitchHistory[1]).toMatchObject({
      agentName: 'agentB',
      agentSessionId: 'b-sess',
      promptCount: 2,
    });
    expect(session.agentSwitchHistory[2]).toMatchObject({
      agentName: 'agentC',
      agentSessionId: 'c-sess',
      promptCount: 1,
    });
  });

  describe('findLastSwitchEntry for resume logic', () => {
    it('finds most recent entry for a given agent', async () => {
      const session = createTestSession(mockAgentInstance({ sessionId: 'a1' }), 'agentA');
      session.agentSessionId = 'a1';

      // A -> B
      await session.switchAgent('agentB', async () => mockAgentInstance({ sessionId: 'b1' }));
      // B -> A (back)
      await session.switchAgent('agentA', async () => mockAgentInstance({ sessionId: 'a2' }));
      // A -> B (again)
      await session.switchAgent('agentB', async () => mockAgentInstance({ sessionId: 'b2' }));

      // findLastSwitchEntry('agentA') should find the most recent A entry (a2)
      const lastA = session.findLastSwitchEntry('agentA');
      expect(lastA).toBeDefined();
      expect(lastA!.agentSessionId).toBe('a2');

      // findLastSwitchEntry('agentB') should find b1 (the most recent B entry)
      const lastB = session.findLastSwitchEntry('agentB');
      expect(lastB).toBeDefined();
      expect(lastB!.agentSessionId).toBe('b1');
    });

    it('returns undefined for agent never used', () => {
      const session = createTestSession(undefined, 'claude');
      expect(session.findLastSwitchEntry('gemini')).toBeUndefined();
    });

    it('returns entry with promptCount=0 for agent with no prompts before switch', async () => {
      const session = createTestSession(mockAgentInstance({ sessionId: 'a1' }), 'agentA');
      session.agentSessionId = 'a1';

      // Switch without sending any prompts
      await session.switchAgent('agentB', async () => mockAgentInstance({ sessionId: 'b1' }));

      const lastA = session.findLastSwitchEntry('agentA');
      expect(lastA).toBeDefined();
      expect(lastA!.promptCount).toBe(0);
    });
  });

  it('firstAgent is preserved across all switches', async () => {
    const session = createTestSession(undefined, 'claude');
    expect(session.firstAgent).toBe('claude');

    await session.switchAgent('gemini', async () => mockAgentInstance({ sessionId: 'g1' }));
    expect(session.firstAgent).toBe('claude');

    await session.switchAgent('codex', async () => mockAgentInstance({ sessionId: 'c1' }));
    expect(session.firstAgent).toBe('claude');
  });

  it('session status remains unchanged after switch', async () => {
    const session = createTestSession(undefined, 'claude');
    session.activate();
    expect(session.status).toBe('active');

    await session.switchAgent('gemini', async () => mockAgentInstance({ sessionId: 'g1' }));
    expect(session.status).toBe('active');
  });

  it('channelId and workingDirectory are preserved after switch', async () => {
    const session = createTestSession(undefined, 'claude');
    const originalChannelId = session.channelId;
    const originalWorkDir = session.workingDirectory;

    await session.switchAgent('gemini', async () => mockAgentInstance({ sessionId: 'g1' }));

    expect(session.channelId).toBe(originalChannelId);
    expect(session.workingDirectory).toBe(originalWorkDir);
  });

  it('buffers commands_update from new agent after switch', async () => {
    const oldAgent = mockAgentInstance({ sessionId: 'old' });
    const session = createTestSession(oldAgent, 'claude');

    const newAgent = mockAgentInstance({ sessionId: 'new' });
    await session.switchAgent('gemini', async () => newAgent);

    // Emit commands_update from new agent BEFORE bridge connects
    newAgent.emit('agent_event', {
      type: 'commands_update',
      commands: [{ name: '/test', description: 'test cmd' }],
    });

    expect(session.latestCommands).toEqual([{ name: '/test', description: 'test cmd' }]);
  });
});

describe('SessionManager.shutdownAll()', () => {
  it('snapshots full session state including acpState and promptCount', async () => {
    const savedRecords: any[] = [];
    const mockStore = {
      save: vi.fn(async (record: any) => { savedRecords.push(structuredClone(record)); }),
      get: vi.fn((id: string) => ({
        sessionId: id,
        agentSessionId: 'agent-1',
        agentName: 'claude',
        workingDir: '/workspace',
        channelId: 'telegram',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        platform: {},
        acpState: { configOptions: [{ id: 'model', currentValue: 'old-model' }] },
      })),
      flush: vi.fn(),
      list: vi.fn(() => []),
      findByPlatform: vi.fn(),
      findByAgentSessionId: vi.fn(),
      remove: vi.fn(),
    } as any;

    const manager = new SessionManager(mockStore);
    const agent = mockAgentInstance({ sessionId: 'agent-1' });
    const session = createTestSession(agent, 'claude');
    session.name = 'test-session';
    session.configOptions = [
      { id: 'model', name: 'Model', category: 'model', type: 'select', currentValue: 'new-model', options: [] },
    ];
    session.clientOverrides = { bypassPermissions: true };
    await session.enqueuePrompt('test');
    manager.registerSession(session);

    await manager.shutdownAll();

    const saved = savedRecords[0];
    expect(saved.status).toBe('finished');
    expect(saved.acpState.configOptions[0].currentValue).toBe('new-model');
    expect(saved.clientOverrides).toEqual({ bypassPermissions: true });
    expect(saved.currentPromptCount).toBe(1);
    expect(mockStore.flush).toHaveBeenCalled();
  });
});

describe('Lazy resume — acpState restore ordering', () => {
  it('does not overwrite fresh agent configOptions with stale cache', () => {
    const agent = mockAgentInstance({ sessionId: 'sess-1' });
    (agent as any).initialSessionResponse = {
      configOptions: [{ id: 'model', name: 'Model', category: 'model', type: 'select', currentValue: 'opus', options: [] }],
    };
    (agent as any).agentCapabilities = { supportsResume: true };

    const session = createTestSession(agent, 'claude');
    session.applySpawnResponse(agent.initialSessionResponse, agent.agentCapabilities);

    expect(session.configOptions[0].currentValue).toBe('opus');

    const cachedOptions = [{ id: 'model', name: 'Model', category: 'model', type: 'select', currentValue: 'sonnet', options: [] }];
    if (session.configOptions.length === 0) {
      session.setInitialConfigOptions(cachedOptions);
    }

    expect(session.configOptions[0].currentValue).toBe('opus');
  });

  it('uses cached configOptions when agent provides none', () => {
    const agent = mockAgentInstance({ sessionId: 'sess-1' });
    (agent as any).initialSessionResponse = {};
    (agent as any).agentCapabilities = {};

    const session = createTestSession(agent, 'claude');
    session.applySpawnResponse(agent.initialSessionResponse, agent.agentCapabilities);

    expect(session.configOptions).toEqual([]);

    const cachedOptions = [{ id: 'model', name: 'Model', category: 'model', type: 'select', currentValue: 'sonnet', options: [] }];
    if (session.configOptions.length === 0) {
      session.setInitialConfigOptions(cachedOptions);
    }

    expect(session.configOptions[0].currentValue).toBe('sonnet');
  });
});
