import { describe, it, expect } from 'vitest'
import { MessageTransformer } from '../message-transformer.js'
import type { AgentEvent } from '../types.js'

describe('MessageTransformer ACP events', () => {
  const transformer = new MessageTransformer()

  it('transforms session_info_update', () => {
    const event: AgentEvent = { type: 'session_info_update', title: 'My Session', updatedAt: '2026-03-26' }
    const msg = transformer.transform(event)
    expect(msg.type).toBe('system_message')
    expect(msg.text).toContain('My Session')
    expect(msg.metadata?.title).toBe('My Session')
  })

  it('transforms config_option_update', () => {
    const event: AgentEvent = {
      type: 'config_option_update',
      options: [{ id: 'model', name: 'Model', type: 'select', currentValue: 'sonnet', options: [] }],
    }
    const msg = transformer.transform(event)
    expect(msg.type).toBe('config_update')
    expect(msg.metadata?.options).toHaveLength(1)
  })

  it('transforms user_message_chunk', () => {
    const event: AgentEvent = { type: 'user_message_chunk', content: 'Hello replay' }
    const msg = transformer.transform(event)
    expect(msg.type).toBe('user_replay')
    expect(msg.text).toBe('Hello replay')
  })

  it('transforms resource_content', () => {
    const event: AgentEvent = { type: 'resource_content', uri: 'file:///a.txt', name: 'a.txt', text: 'content' }
    const msg = transformer.transform(event)
    expect(msg.type).toBe('resource')
    expect(msg.metadata?.uri).toBe('file:///a.txt')
  })

  it('transforms resource_link', () => {
    const event: AgentEvent = { type: 'resource_link', uri: 'https://example.com', name: 'Example', title: 'Ex' }
    const msg = transformer.transform(event)
    expect(msg.type).toBe('resource_link')
    expect(msg.metadata?.uri).toBe('https://example.com')
  })
})
