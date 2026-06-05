import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { Session } from '../session.js'
import { SessionFactory } from '../session-factory.js'
import { SessionManager } from '../session-manager.js'
import { JsonFileSessionStore } from '../session-store.js'
import type { AgentInstance } from '../../agents/agent-instance.js'
import type { ConfigOption, SessionRecord } from '../../types.js'

function mockAgentInstance(): AgentInstance {
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
    initialSessionResponse: undefined,
    agentCapabilities: undefined,
    addAllowedPath: vi.fn(),
    middlewareChain: undefined,
  } as unknown as AgentInstance
}

const MODE_OPTIONS: ConfigOption['options'] = [
  { value: 'normal', name: 'Normal' },
  { value: 'bypassPermissions', name: 'Bypass Permissions' },
]

/**
 * Builds a Session whose configOptions are pre-populated to simulate what happens
 * after the agent spawns and reports its defaults via applySpawnResponse.
 */
function buildResumedSession(agentInst: AgentInstance, agentDefaultMode: string): Session {
  const session = new Session({
    id: 'sess-resume',
    channelId: 'telegram',
    agentName: 'claude',
    workingDirectory: '/tmp',
    agentInstance: agentInst,
  })
  session.setInitialConfigOptions([
    {
      id: 'mode',
      name: 'Mode',
      category: 'mode',
      type: 'select',
      currentValue: agentDefaultMode,
      options: MODE_OPTIONS,
    },
  ])
  return session
}

describe('SessionFactory lazy resume — configOptions re-application', () => {
  let tmpDir: string
  let store: JsonFileSessionStore
  let sessionManager: SessionManager
  let factory: SessionFactory

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-sf-resume-'))
    store = new JsonFileSessionStore(path.join(tmpDir, 'sessions.json'), 30)
    sessionManager = new SessionManager(store)

    factory = new SessionFactory(
      null as any,
      sessionManager,
      null as any,
      null as any,
    )
    factory.sessionStore = store
  })

  afterEach(() => {
    store.destroy()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('calls setConfigOption for each persisted configOption that differs from agent defaults on getOrResume', async () => {
    const persistedRecord: SessionRecord = {
      sessionId: 'sess-resume',
      agentSessionId: 'agent-uuid',
      agentName: 'claude',
      workingDir: '/tmp',
      channelId: 'telegram',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      platform: { topicId: 777 },
      acpState: {
        configOptions: [
          {
            id: 'mode',
            name: 'Mode',
            category: 'mode',
            type: 'select',
            currentValue: 'bypassPermissions',
            options: MODE_OPTIONS,
          },
        ],
      },
    }
    await store.save(persistedRecord)

    // Agent spawns fresh and reports default mode = 'normal'
    const agentInst = mockAgentInstance()
    const resumedSession = buildResumedSession(agentInst, 'normal')
    factory.createFullSession = vi.fn().mockResolvedValue(resumedSession)

    const result = await factory.getOrResume('telegram', '777')

    expect(result).toBe(resumedSession)
    expect(agentInst.setConfigOption).toHaveBeenCalledWith('mode', { type: 'select', value: 'bypassPermissions' })
  })

  it('does NOT call setConfigOption when persisted value matches agent-reported value', async () => {
    const persistedRecord: SessionRecord = {
      sessionId: 'sess-resume-2',
      agentSessionId: 'agent-uuid-2',
      agentName: 'claude',
      workingDir: '/tmp',
      channelId: 'telegram',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      platform: { topicId: 888 },
      acpState: {
        configOptions: [
          {
            id: 'mode',
            name: 'Mode',
            category: 'mode',
            type: 'select',
            currentValue: 'normal',
            options: MODE_OPTIONS,
          },
        ],
      },
    }
    await store.save(persistedRecord)

    // Agent resumes with the same value — no re-apply needed
    const agentInst = mockAgentInstance()
    const resumedSession = buildResumedSession(agentInst, 'normal')
    resumedSession.id = 'sess-resume-2'
    factory.createFullSession = vi.fn().mockResolvedValue(resumedSession)

    const result = await factory.getOrResume('telegram', '888')

    expect(result).toBe(resumedSession)
    expect(agentInst.setConfigOption).not.toHaveBeenCalled()
  })

  it('calls setConfigOption for each persisted configOption that differs from agent defaults on getOrResumeById', async () => {
    const persistedRecord: SessionRecord = {
      sessionId: 'sess-resume-byid',
      agentSessionId: 'agent-uuid-byid',
      agentName: 'claude',
      workingDir: '/tmp',
      channelId: 'telegram',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      platform: { topicId: 999 },
      acpState: {
        configOptions: [
          {
            id: 'mode',
            name: 'Mode',
            category: 'mode',
            type: 'select',
            currentValue: 'bypassPermissions',
            options: MODE_OPTIONS,
          },
        ],
      },
    }
    await store.save(persistedRecord)

    const agentInst = mockAgentInstance()
    const resumedSession = buildResumedSession(agentInst, 'normal')
    resumedSession.id = 'sess-resume-byid'
    factory.createFullSession = vi.fn().mockResolvedValue(resumedSession)

    const result = await factory.getOrResumeById('sess-resume-byid')

    expect(result).toBe(resumedSession)
    expect(agentInst.setConfigOption).toHaveBeenCalledWith('mode', { type: 'select', value: 'bypassPermissions' })
  })
})
