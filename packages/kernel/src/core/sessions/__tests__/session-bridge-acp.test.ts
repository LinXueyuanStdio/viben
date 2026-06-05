import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionBridge } from '../session-bridge.js'
import { MessageTransformer } from '../../message-transformer.js'
import type { IChannelAdapter } from '../../channel.js'
import type { Session } from '../session.js'
import type { AgentEvent } from '../../types.js'
import { TypedEmitter } from '../../utils/typed-emitter.js'

function createMockSession() {
  const emitter = new TypedEmitter()
  return Object.assign(emitter, {
    id: 'test-session',
    channelId: 'telegram',
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
    getConfigByCategory: vi.fn(),
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
    sendPermissionRequest: vi.fn().mockResolvedValue(undefined),
    sendNotification: vi.fn().mockResolvedValue(undefined),
    createSessionThread: vi.fn().mockResolvedValue('thread-1'),
    renameSessionThread: vi.fn().mockResolvedValue(undefined),
  } as unknown as IChannelAdapter
}

describe('SessionBridge ACP events', () => {
  let session: ReturnType<typeof createMockSession>
  let adapter: IChannelAdapter
  let bridge: SessionBridge
  let mockPatchRecord: ReturnType<typeof vi.fn>

  beforeEach(() => {
    session = createMockSession()
    adapter = createMockAdapter()
    mockPatchRecord = vi.fn()
    bridge = new SessionBridge(session as unknown as Session, adapter, {
      messageTransformer: new MessageTransformer(),
      notificationManager: { notify: vi.fn() } as any,
      sessionManager: { patchRecord: mockPatchRecord } as any,
    })
    bridge.connect()
  })

  it('session_info_update with title calls setName and sends message', async () => {
    const event: AgentEvent = { type: 'session_info_update', title: 'New Title' }
    session.emit('agent_event', event)
    await vi.waitFor(() => {
      expect(session.setName).toHaveBeenCalledWith('New Title')
      expect(adapter.sendMessage).toHaveBeenCalled()
    })
  })

  it('session_info_update without title silently updates state without notifying adapter', async () => {
    const event: AgentEvent = { type: 'session_info_update', updatedAt: '2026-03-26' }
    session.emit('agent_event', event)
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(session.setName).not.toHaveBeenCalled()
    expect(adapter.sendMessage).not.toHaveBeenCalled()
  })

  it('config_option_update calls updateConfigOptions, persists ACP state, and sends message', async () => {
    const event: AgentEvent = {
      type: 'config_option_update',
      options: [{ id: 'model', name: 'Model', type: 'select', currentValue: 'sonnet', options: [] }],
    }
    session.emit('agent_event', event)
    await vi.waitFor(() => {
      expect(session.updateConfigOptions).toHaveBeenCalled()
      expect(mockPatchRecord).toHaveBeenCalledWith('test-session', expect.objectContaining({ acpState: expect.anything() }))
      expect(adapter.sendMessage).toHaveBeenCalledWith('test-session', expect.objectContaining({ type: 'config_update' }))
    })
  })

  it('does NOT handle current_mode_update event (removed from AgentEvent type)', () => {
    // current_mode_update is no longer a valid AgentEvent type.
    // Emitting it should not call updateMode (which no longer exists on Session).
    // This test verifies the bridge doesn't have a handler for it.
    const event = { type: 'current_mode_update', modeId: 'architect' } as any
    session.emit('agent_event', event)
    // updateMode no longer exists on mock, so just verify no crash and
    // message was NOT sent (no case matches in switch)
    expect(adapter.sendMessage).not.toHaveBeenCalled()
  })

  it('does NOT handle model_update event (removed from AgentEvent type)', () => {
    // model_update is no longer a valid AgentEvent type.
    const event = { type: 'model_update', modelId: 'opus' } as any
    session.emit('agent_event', event)
    // No handler should match
    expect(adapter.sendMessage).not.toHaveBeenCalled()
  })

  it('user_message_chunk sends message to adapter', async () => {
    const event: AgentEvent = { type: 'user_message_chunk', content: 'Hello' }
    session.emit('agent_event', event)
    await vi.waitFor(() => {
      expect(adapter.sendMessage).toHaveBeenCalledWith('test-session', expect.objectContaining({ type: 'user_replay' }))
    })
  })

  it('resource_content sends message to adapter', async () => {
    const event: AgentEvent = { type: 'resource_content', uri: 'file:///a.txt', name: 'a.txt', text: 'hi' }
    session.emit('agent_event', event)
    await vi.waitFor(() => {
      expect(adapter.sendMessage).toHaveBeenCalledWith('test-session', expect.objectContaining({ type: 'resource' }))
    })
  })

  it('resource_link sends message to adapter', async () => {
    const event: AgentEvent = { type: 'resource_link', uri: 'https://ex.com', name: 'Ex' }
    session.emit('agent_event', event)
    await vi.waitFor(() => {
      expect(adapter.sendMessage).toHaveBeenCalledWith('test-session', expect.objectContaining({ type: 'resource_link' }))
    })
  })
})
