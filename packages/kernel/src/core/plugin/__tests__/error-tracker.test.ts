import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ErrorTracker } from '../error-tracker.js'

describe('ErrorTracker', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('is not disabled initially', () => {
    const tracker = new ErrorTracker()
    expect(tracker.isDisabled('plugin')).toBe(false)
  })

  it('disables after exceeding error budget', () => {
    const tracker = new ErrorTracker({ maxErrors: 3, windowMs: 60000 })
    tracker.increment('plugin')
    tracker.increment('plugin')
    expect(tracker.isDisabled('plugin')).toBe(false)
    tracker.increment('plugin')
    expect(tracker.isDisabled('plugin')).toBe(true)
  })

  it('resets error count after window expires', () => {
    const tracker = new ErrorTracker({ maxErrors: 3, windowMs: 60000 })
    tracker.increment('plugin')
    tracker.increment('plugin')
    vi.advanceTimersByTime(60001)
    tracker.increment('plugin')
    expect(tracker.isDisabled('plugin')).toBe(false)
  })

  it('reset clears disabled state', () => {
    const tracker = new ErrorTracker({ maxErrors: 1, windowMs: 60000 })
    tracker.increment('plugin')
    expect(tracker.isDisabled('plugin')).toBe(true)
    tracker.reset('plugin')
    expect(tracker.isDisabled('plugin')).toBe(false)
  })

  it('exempt plugins are never disabled', () => {
    const tracker = new ErrorTracker({ maxErrors: 1, windowMs: 60000 })
    tracker.setExempt('builtin')
    tracker.increment('builtin')
    tracker.increment('builtin')
    tracker.increment('builtin')
    expect(tracker.isDisabled('builtin')).toBe(false)
  })

  it('calls onDisabled callback when budget exceeded', () => {
    const onDisabled = vi.fn()
    const tracker = new ErrorTracker({ maxErrors: 1, windowMs: 60000 })
    tracker.onDisabled = onDisabled
    tracker.increment('plugin')
    expect(onDisabled).toHaveBeenCalledWith('plugin', expect.any(String))
  })

  it('does not call onDisabled for exempt plugins', () => {
    const onDisabled = vi.fn()
    const tracker = new ErrorTracker({ maxErrors: 1, windowMs: 60000 })
    tracker.onDisabled = onDisabled
    tracker.setExempt('builtin')
    tracker.increment('builtin')
    expect(onDisabled).not.toHaveBeenCalled()
  })
})
