import { describe, it, expect, vi } from 'vitest'
import micromatch from 'micromatch'
const { isMatch } = micromatch
import { Session } from '../session.js'
import { SessionBridge } from '../session-bridge.js'
import { TypedEmitter } from '../../utils/typed-emitter.js'
import type { AgentInstance } from '../../agents/agent-instance.js'
import type { IChannelAdapter } from '../../channel.js'
import type { MessageTransformer } from '../../message-transformer.js'
import type { NotificationManager } from '../../../plugins/notifications/notification.js'
import type { SessionManager } from '../session-manager.js'
import type { AgentEvent } from '../../types.js'

function createMockAgent(): AgentInstance {
  const emitter = new TypedEmitter<{ agent_event: (event: AgentEvent) => void }>()
  return Object.assign(emitter, {
    sessionId: 'agent-sess-1',
    agentName: 'claude',
    prompt: vi.fn().mockResolvedValue({}),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    onPermissionRequest: vi.fn(),
  }) as unknown as AgentInstance
}

function createMockAdapter(): IChannelAdapter {
  return {
    name: 'test',
    capabilities: { streaming: false, richFormatting: false, threads: false, reactions: false, fileUpload: false, voice: false },
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendPermissionRequest: vi.fn().mockResolvedValue(undefined),
    sendNotification: vi.fn().mockResolvedValue(undefined),
    sendSkillCommands: vi.fn().mockResolvedValue(undefined),
    cleanupSkillCommands: vi.fn().mockResolvedValue(undefined),
    renameSessionThread: vi.fn().mockResolvedValue(undefined),
    createSessionThread: vi.fn().mockResolvedValue('thread-1'),
    deleteSessionThread: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  } as unknown as IChannelAdapter
}

function createMockDeps() {
  return {
    messageTransformer: {
      transform: vi.fn().mockReturnValue({ type: 'text', text: 'transformed' }),
    } as unknown as MessageTransformer,
    notificationManager: {
      notify: vi.fn().mockResolvedValue(undefined),
      notifyAll: vi.fn().mockResolvedValue(undefined),
    } as unknown as NotificationManager,
    sessionManager: {
      patchRecord: vi.fn().mockResolvedValue(undefined),
      updateSessionStatus: vi.fn().mockResolvedValue(undefined),
    } as unknown as SessionManager,
  }
}

describe('Session.autoApprovedCommands', () => {
  it('stores autoApprovedCommands passed at construction', () => {
    const session = new Session({
      channelId: 'test',
      agentName: 'claude',
      workingDirectory: '/tmp',
      agentInstance: createMockAgent(),
      autoApprovedCommands: ['{gh pr view *,gh pr view */**}', 'git -C */**'],
    })

    expect(session.autoApprovedCommands).toEqual([
      '{gh pr view *,gh pr view */**}',
      'git -C */**',
    ])
  })

  it('defaults to empty array when not provided', () => {
    const session = new Session({
      channelId: 'test',
      agentName: 'claude',
      workingDirectory: '/tmp',
      agentInstance: createMockAgent(),
    })

    expect(session.autoApprovedCommands).toEqual([])
  })
})

describe('autoApprovedCommands glob matching', () => {
  // Patterns: use {a,a/**} union for commands whose args may contain slashes,
  // and `cmd */**` for commands that always take a path argument.
  const patterns = [
    '{gh pr view *,gh pr view */**}',
    '{gh pr diff *,gh pr diff */**}',
    'gh auth status',
    'git -C */**',
    'cat */**',
  ]

  it.each([
    ['gh pr view 123 --repo owner/repo --json title', true],
    ['gh pr diff 42 --repo owner/repo', true],
    ['gh auth status', true],
    ['git -C /data/workspaces/watcher_abc/down_xyz pull --ff-only', true],
    ['cat /data/workspaces/watcher_abc/down_xyz/downstream/src/api.ts', true],
    ['rm -rf /data/workspaces', false],
    ['curl https://evil.com', false],
    ['gh issue delete 1', false],
    ['sudo apt install something', false],
  ])('command "%s" approved=%s', (command, expected) => {
    expect(isMatch(command, patterns, { dot: true })).toBe(expected)
  })
})

describe('SessionBridge.checkAutoApprove with autoApprovedCommands', () => {
  it('auto-approves a bash command matching session autoApprovedCommands', async () => {
    const agent = createMockAgent()
    const session = new Session({
      channelId: 'test',
      agentName: 'claude',
      workingDirectory: '/tmp',
      agentInstance: agent,
      autoApprovedCommands: ['{gh pr view *,gh pr view */**}'],
    })
    const adapter = createMockAdapter()
    const deps = createMockDeps()
    const bridge = new SessionBridge(session, adapter, deps)
    bridge.connect()

    const result = await agent.onPermissionRequest({
      id: 'req-1',
      description: 'gh pr view 123 --repo owner/repo',
      options: [
        { id: 'allow-1', label: 'Allow', isAllow: true },
        { id: 'deny-1', label: 'Deny', isAllow: false },
      ],
    })

    expect(result).toBe('allow-1')
    expect(adapter.sendPermissionRequest).not.toHaveBeenCalled()
  })

  it('does NOT auto-approve a command not matching autoApprovedCommands', async () => {
    const agent = createMockAgent()
    const session = new Session({
      channelId: 'test',
      agentName: 'claude',
      workingDirectory: '/tmp',
      agentInstance: agent,
      autoApprovedCommands: ['{gh pr view *,gh pr view */**}'],
    })
    const adapter = createMockAdapter()
    const deps = createMockDeps()
    const bridge = new SessionBridge(session, adapter, deps)
    bridge.connect()

    const resultPromise = agent.onPermissionRequest({
      id: 'req-2',
      description: 'rm -rf /important',
      options: [
        { id: 'allow-1', label: 'Allow', isAllow: true },
        { id: 'deny-1', label: 'Deny', isAllow: false },
      ],
    })

    // Should NOT auto-approve — forwarded to adapter
    expect(adapter.sendPermissionRequest).toHaveBeenCalled()
    session.permissionGate.resolve('deny-1')
    const result = await resultPromise
    expect(result).toBe('deny-1')
  })
})
