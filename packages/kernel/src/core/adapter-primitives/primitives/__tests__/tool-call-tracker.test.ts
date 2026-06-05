import { describe, it, expect } from 'vitest'
import { ToolCallTracker } from '../tool-call-tracker.js'

describe('ToolCallTracker', () => {
  it('tracks new tool call with messageId', () => {
    const tracker = new ToolCallTracker()
    tracker.track('s1', { id: 't1', name: 'Read', kind: 'read' }, 'msg-42')
    expect(tracker.getActive('s1')).toHaveLength(1)
    expect(tracker.getActive('s1')[0]).toMatchObject({
      id: 't1', name: 'Read', kind: 'read', messageId: 'msg-42',
    })
  })

  it('updates tool call status and returns tracked tool', () => {
    const tracker = new ToolCallTracker()
    tracker.track('s1', { id: 't1', name: 'Read' }, 'msg-1')

    const result = tracker.update('s1', 't1', 'completed')
    expect(result).toMatchObject({ id: 't1', status: 'completed', messageId: 'msg-1' })
  })

  it('accumulates state from intermediate updates', () => {
    const tracker = new ToolCallTracker()
    tracker.track('s1', { id: 't1', name: 'Read' }, 'msg-1')

    tracker.update('s1', 't1', 'running', { viewerLinks: { file: 'http://f' } })
    const result = tracker.update('s1', 't1', 'completed')
    expect(result?.viewerLinks).toEqual({ file: 'http://f' })
  })

  it('returns null for unknown tool', () => {
    const tracker = new ToolCallTracker()
    expect(tracker.update('s1', 'nonexistent', 'done')).toBeNull()
  })

  it('clears session', () => {
    const tracker = new ToolCallTracker()
    tracker.track('s1', { id: 't1', name: 'Read' }, 'msg-1')
    tracker.clear('s1')
    expect(tracker.getActive('s1')).toHaveLength(0)
  })

  it('handles multiple sessions independently', () => {
    const tracker = new ToolCallTracker()
    tracker.track('s1', { id: 't1', name: 'A' }, 'msg-1')
    tracker.track('s2', { id: 't2', name: 'B' }, 'msg-2')

    expect(tracker.getActive('s1')).toHaveLength(1)
    expect(tracker.getActive('s2')).toHaveLength(1)

    tracker.clear('s1')
    expect(tracker.getActive('s1')).toHaveLength(0)
    expect(tracker.getActive('s2')).toHaveLength(1)
  })

  it('clearAll removes everything', () => {
    const tracker = new ToolCallTracker()
    tracker.track('s1', { id: 't1', name: 'A' }, 'msg-1')
    tracker.track('s2', { id: 't2', name: 'B' }, 'msg-2')
    tracker.clearAll()
    expect(tracker.getActive('s1')).toHaveLength(0)
    expect(tracker.getActive('s2')).toHaveLength(0)
  })
})
