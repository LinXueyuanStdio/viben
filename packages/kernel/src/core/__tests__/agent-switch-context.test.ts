import { describe, it, expect, vi } from 'vitest';
import { AgentSwitchHandler } from '../agent-switch-handler.js';
import { Session } from '../sessions/session.js';
import { TypedEmitter } from '../utils/typed-emitter.js';
import type { AgentEvent } from '../types.js';

vi.mock('../agents/agent-registry.js', () => ({
  getAgentCapabilities: () => ({ supportsResume: true }),
}));

function mockAgentInstance(id = 'agent-1') {
  const emitter = new TypedEmitter<{ agent_event: (event: AgentEvent) => void }>();
  return Object.assign(emitter, {
    sessionId: id,
    prompt: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    onPermissionRequest: vi.fn(),
    promptCapabilities: {},
    initialSessionResponse: undefined,
    agentCapabilities: undefined,
    addAllowedPath: vi.fn(),
  }) as any;
}

function makeSession(agentName = 'claude') {
  const session = new Session({
    channelId: 'telegram',
    agentName,
    workingDirectory: '/workspace',
    agentInstance: mockAgentInstance(),
  });
  return session;
}

function makeDeps(sessionOverride?: Session) {
  const session = sessionOverride ?? makeSession();
  const newAgentInstance = mockAgentInstance('new-agent');
  const resumedAgentInstance = mockAgentInstance('resumed-agent');

  const sessionManager = {
    getSession: vi.fn().mockReturnValue(session),
    patchRecord: vi.fn().mockResolvedValue(undefined),
  };
  const agentManager = {
    getAgent: vi.fn().mockReturnValue({ name: 'gemini' }),
    spawn: vi.fn().mockResolvedValue(newAgentInstance),
    resume: vi.fn().mockResolvedValue(resumedAgentInstance),
  };
  const contextService = {
    flushSession: vi.fn().mockResolvedValue(undefined),
    buildContext: vi.fn().mockResolvedValue({ markdown: '# History\n\nTurn 1' }),
  };
  const deps = {
    sessionManager,
    agentManager,
    configManager: { get: vi.fn().mockReturnValue({ agentSwitch: { labelHistory: true } }) },
    eventBus: { emit: vi.fn() },
    adapters: new Map(),
    bridges: new Map(),
    createBridge: vi.fn().mockReturnValue({ connect: vi.fn(), disconnect: vi.fn() }),
    getSessionBridgeKeys: vi.fn().mockReturnValue([]),
    getMiddlewareChain: vi.fn().mockReturnValue(undefined),
    getService: vi.fn().mockImplementation((name: string) => name === 'context' ? contextService : undefined),
  };
  return { deps, session, contextService, agentManager, newAgentInstance, resumedAgentInstance };
}

describe('AgentSwitchHandler — context injection on new agent', () => {
  it('flushes recorder state BEFORE reading context for new agent', async () => {
    const { deps, contextService } = makeDeps();
    const handler = new AgentSwitchHandler(deps as any);

    const callOrder: string[] = [];
    contextService.flushSession.mockImplementation(async () => { callOrder.push('flush'); });
    contextService.buildContext.mockImplementation(async () => { callOrder.push('buildContext'); return { markdown: '# History' }; });

    await handler.switch('session-1', 'gemini');

    expect(callOrder[0]).toBe('flush');
    expect(callOrder[1]).toBe('buildContext');
  });

  it('passes noCache: true to buildContext to avoid stale context on repeated switches', async () => {
    const { deps, contextService } = makeDeps();
    const handler = new AgentSwitchHandler(deps as any);

    await handler.switch('session-1', 'gemini');

    expect(contextService.buildContext).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'session' }),
      expect.objectContaining({ noCache: true }),
    );
  });

  it('sets context on session after spawning new agent', async () => {
    const { deps, session } = makeDeps();
    const setContext = vi.spyOn(session, 'setContext');
    const handler = new AgentSwitchHandler(deps as any);

    await handler.switch('session-1', 'gemini');

    expect(setContext).toHaveBeenCalledWith('# History\n\nTurn 1');
  });

  it('does not set context if buildContext returns null', async () => {
    const { deps, session, contextService } = makeDeps();
    contextService.buildContext.mockResolvedValue(null);
    const setContext = vi.spyOn(session, 'setContext');
    const handler = new AgentSwitchHandler(deps as any);

    await handler.switch('session-1', 'gemini');

    expect(setContext).not.toHaveBeenCalled();
  });
});

describe('AgentSwitchHandler — resume logic without promptCount restriction', () => {
  it('attempts to resume agent that previously had prompts (promptCount > 0)', async () => {
    const session = makeSession();
    // Simulate: agent 'gemini' was used before with 5 prompts
    session.agentSwitchHistory = [{
      agentName: 'gemini',
      agentSessionId: 'old-gemini-session',
      switchedAt: new Date().toISOString(),
      promptCount: 5,
    }];
    const { deps, agentManager } = makeDeps(session);
    const handler = new AgentSwitchHandler(deps as any);
    await handler.switch('session-1', 'gemini');

    expect(agentManager.resume).toHaveBeenCalledWith('gemini', '/workspace', 'old-gemini-session', []);
  });

  it('falls back to spawn with context when resume fails (e.g., session expired)', async () => {
    const session = makeSession();
    session.agentSwitchHistory = [{
      agentName: 'gemini',
      agentSessionId: 'expired-session',
      switchedAt: new Date().toISOString(),
      promptCount: 3,
    }];
    const { deps, agentManager, contextService } = makeDeps(session);
    agentManager.resume.mockRejectedValue(new Error('Session expired'));

    const handler = new AgentSwitchHandler(deps as any);
    await handler.switch('session-1', 'gemini');

    // Should fall back to spawn
    expect(agentManager.spawn).toHaveBeenCalledWith('gemini', '/workspace', []);
    // And inject context since it's a new agent
    expect(contextService.buildContext).toHaveBeenCalled();
  });
});
