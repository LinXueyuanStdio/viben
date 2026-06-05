import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ActivityTracker } from '../activity-tracker.js'

describe('ActivityTracker', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  function makeCallbacks() {
    return {
      sendThinkingIndicator: vi.fn().mockResolvedValue(undefined),
      updateThinkingIndicator: vi.fn().mockResolvedValue(undefined),
      removeThinkingIndicator: vi.fn().mockResolvedValue(undefined),
    }
  }

  it('calls sendThinkingIndicator on thinking start', async () => {
    const tracker = new ActivityTracker({
      thinkingRefreshInterval: 15000,
      maxThinkingDuration: 180000,
    })
    const cbs = makeCallbacks()
    tracker.onThinkingStart('s1', cbs)

    await vi.advanceTimersByTimeAsync(0)
    expect(cbs.sendThinkingIndicator).toHaveBeenCalledOnce()
  })

  it('calls updateThinkingIndicator on refresh interval', async () => {
    const tracker = new ActivityTracker({
      thinkingRefreshInterval: 15000,
      maxThinkingDuration: 180000,
    })
    const cbs = makeCallbacks()
    tracker.onThinkingStart('s1', cbs)

    await vi.advanceTimersByTimeAsync(15000)
    expect(cbs.updateThinkingIndicator).toHaveBeenCalled()
  })

  it('calls removeThinkingIndicator on text start', async () => {
    const tracker = new ActivityTracker({
      thinkingRefreshInterval: 15000,
      maxThinkingDuration: 180000,
    })
    const cbs = makeCallbacks()
    tracker.onThinkingStart('s1', cbs)
    await vi.advanceTimersByTimeAsync(0)

    tracker.onTextStart('s1')
    expect(cbs.removeThinkingIndicator).toHaveBeenCalledOnce()
  })

  it('stops refresh on session end', async () => {
    const tracker = new ActivityTracker({
      thinkingRefreshInterval: 15000,
      maxThinkingDuration: 180000,
    })
    const cbs = makeCallbacks()
    tracker.onThinkingStart('s1', cbs)
    await vi.advanceTimersByTimeAsync(0)

    tracker.onSessionEnd('s1')
    cbs.updateThinkingIndicator.mockClear()
    await vi.advanceTimersByTimeAsync(30000)
    expect(cbs.updateThinkingIndicator).not.toHaveBeenCalled()
  })

  it('stops refresh after maxThinkingDuration', async () => {
    const tracker = new ActivityTracker({
      thinkingRefreshInterval: 15000,
      maxThinkingDuration: 30000,
    })
    const cbs = makeCallbacks()
    tracker.onThinkingStart('s1', cbs)

    await vi.advanceTimersByTimeAsync(15000)
    expect(cbs.updateThinkingIndicator).toHaveBeenCalled()

    cbs.updateThinkingIndicator.mockClear()
    await vi.advanceTimersByTimeAsync(30000)
    expect(cbs.updateThinkingIndicator.mock.calls.length).toBeLessThanOrEqual(1)
  })

  it('handles multiple sessions independently', async () => {
    const tracker = new ActivityTracker({
      thinkingRefreshInterval: 15000,
      maxThinkingDuration: 180000,
    })
    const cbs1 = makeCallbacks()
    const cbs2 = makeCallbacks()

    tracker.onThinkingStart('s1', cbs1)
    tracker.onThinkingStart('s2', cbs2)

    await vi.advanceTimersByTimeAsync(0)
    expect(cbs1.sendThinkingIndicator).toHaveBeenCalledOnce()
    expect(cbs2.sendThinkingIndicator).toHaveBeenCalledOnce()

    tracker.onTextStart('s1')
    expect(cbs1.removeThinkingIndicator).toHaveBeenCalled()
    expect(cbs2.removeThinkingIndicator).not.toHaveBeenCalled()
  })

  it('destroy cleans up all sessions', async () => {
    const tracker = new ActivityTracker({
      thinkingRefreshInterval: 15000,
      maxThinkingDuration: 180000,
    })
    const cbs = makeCallbacks()
    tracker.onThinkingStart('s1', cbs)
    await vi.advanceTimersByTimeAsync(0)

    tracker.destroy()
    cbs.updateThinkingIndicator.mockClear()
    await vi.advanceTimersByTimeAsync(30000)
    expect(cbs.updateThinkingIndicator).not.toHaveBeenCalled()
  })

  it('calls removeThinkingIndicator on onSessionEnd even without onTextStart', async () => {
    const tracker = new ActivityTracker({
      thinkingRefreshInterval: 15000,
      maxThinkingDuration: 180000,
    })
    const cbs = makeCallbacks()
    tracker.onThinkingStart('s1', cbs)
    await vi.advanceTimersByTimeAsync(0)

    // End session without calling onTextStart
    tracker.onSessionEnd('s1')
    expect(cbs.removeThinkingIndicator).toHaveBeenCalledOnce()
  })
})
