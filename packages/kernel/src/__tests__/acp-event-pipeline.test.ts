import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionBridge } from '../core/sessions/session-bridge.js'
import { MessageTransformer } from '../core/message-transformer.js'
import { TypedEmitter } from '../core/utils/typed-emitter.js'
import type { IChannelAdapter } from '../core/channel.js'
import type { Session } from '../core/sessions/session.js'
import type { AgentEvent } from '../core/types.js'

function createMockSession() {
  const emitter = new TypedEmitter()
  return Object.assign(emitter, {
    id: 'test-session',
    channelId: 'test',
    name: 'Test',
    threadId: '123',
    agentName: 'claude',
    agentSessionId: 'agent-1',
    workingDirectory: '/tmp',
    status: 'active',
    createdAt: new Date(),
    promptCount: 0,
    configOptions: [],
    clientOverrides: {},
    agentCapabilities: undefined,
    permissionGate: { setPending: vi.fn() },
    agentInstance: Object.assign(new TypedEmitter(), {
      sessionId: 'agent-1',
      on: vi.fn(),
      off: vi.fn(),
      onPermissionRequest: vi.fn(),
    }),
    setName: vi.fn(),
    finish: vi.fn(),
    fail: vi.fn(),
    updateConfigOptions: vi.fn().mockResolvedValue(undefined),
    toAcpStateSnapshot: vi.fn().mockReturnValue({}),
  }) as unknown as Session
}

function createMockAdapter(): IChannelAdapter {
  return {
    name: 'test',
    capabilities: { streaming: false, richFormatting: false, threads: false, reactions: false, fileUpload: false, voice: false },
    start: vi.fn(),
    stop: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendPermissionRequest: vi.fn(),
    sendNotification: vi.fn(),
    createSessionThread: vi.fn().mockResolvedValue('t1'),
    renameSessionThread: vi.fn(),
  } as unknown as IChannelAdapter
}

describe('ACP Event Pipeline Integration', () => {
  let session: ReturnType<typeof createMockSession>
  let adapter: IChannelAdapter
  let bridge: SessionBridge

  beforeEach(() => {
    session = createMockSession()
    adapter = createMockAdapter()
    bridge = new SessionBridge(session as unknown as Session, adapter, {
      messageTransformer: new MessageTransformer(),
      notificationManager: { notify: vi.fn() } as any,
      sessionManager: { patchRecord: vi.fn() } as any,
    })
    bridge.connect()
  })

  describe('config options flow', () => {
    it('agent config update → session state + adapter message', async () => {
      const options = [{ id: 'model', name: 'Model', type: 'select' as const, currentValue: 'sonnet', options: [] }]
      session.emit('agent_event', { type: 'config_option_update', options } as AgentEvent)
      await vi.waitFor(() => {
        expect(session.updateConfigOptions).toHaveBeenCalledWith(options)
        expect(adapter.sendMessage).toHaveBeenCalledWith('test-session',
          expect.objectContaining({ type: 'config_update' }))
      })
    })
  })

  describe('session info flow', () => {
    it('agent session_info_update with title → setName + adapter message', async () => {
      session.emit('agent_event', { type: 'session_info_update', title: 'New Title' } as AgentEvent)
      await vi.waitFor(() => {
        expect(session.setName).toHaveBeenCalledWith('New Title')
        expect(adapter.sendMessage).toHaveBeenCalled()
      })
    })

    it('agent session_info_update without title → no adapter message', async () => {
      session.emit('agent_event', { type: 'session_info_update', updatedAt: '2026-03-26' } as AgentEvent)
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(session.setName).not.toHaveBeenCalled()
      expect(adapter.sendMessage).not.toHaveBeenCalled()
    })
  })

  describe('resource flow', () => {
    it('resource_content → adapter message with resource type', async () => {
      session.emit('agent_event', { type: 'resource_content', uri: 'file:///a.txt', name: 'a.txt', text: 'content' } as AgentEvent)
      await vi.waitFor(() => {
        expect(adapter.sendMessage).toHaveBeenCalledWith('test-session',
          expect.objectContaining({ type: 'resource', metadata: expect.objectContaining({ uri: 'file:///a.txt' }) }))
      })
    })

    it('resource_link → adapter message with resource_link type', async () => {
      session.emit('agent_event', { type: 'resource_link', uri: 'https://ex.com', name: 'Example' } as AgentEvent)
      await vi.waitFor(() => {
        expect(adapter.sendMessage).toHaveBeenCalledWith('test-session',
          expect.objectContaining({ type: 'resource_link' }))
      })
    })
  })

  describe('user message replay flow', () => {
    it('user_message_chunk → adapter message with user_replay type', async () => {
      session.emit('agent_event', { type: 'user_message_chunk', content: 'Hello from past' } as AgentEvent)
      await vi.waitFor(() => {
        expect(adapter.sendMessage).toHaveBeenCalledWith('test-session',
          expect.objectContaining({ type: 'user_replay', text: 'Hello from past' }))
      })
    })
  })

  describe('existing flows still work', () => {
    it('text event → adapter message', async () => {
      session.emit('agent_event', { type: 'text', content: 'Hello' } as AgentEvent)
      await vi.waitFor(() => {
        expect(adapter.sendMessage).toHaveBeenCalledWith('test-session',
          expect.objectContaining({ type: 'text', text: 'Hello' }))
      })
    })

    it('tool_call event → adapter message', async () => {
      session.emit('agent_event', {
        type: 'tool_call', id: 't1', name: 'Read', status: 'pending',
      } as AgentEvent)
      await vi.waitFor(() => {
        expect(adapter.sendMessage).toHaveBeenCalledWith('test-session',
          expect.objectContaining({ type: 'tool_call' }))
      })
    })
  })
})
