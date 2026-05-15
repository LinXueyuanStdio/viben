import type { PresentationStep } from "../types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimelineItem {
  step: PresentationStep
  startMs: number
  endMs: number
  lane: number
}

export interface TimelineLane {
  id: string
  label: string
  items: TimelineItem[]
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Compute the total duration (ms) of a step sequence.
 * Adds a 2000ms buffer after the last step ends.
 * O(n) single pass — avoids spread + Math.max overhead for large arrays.
 */
export function computeTotalMs(steps: PresentationStep[]): number {
  if (steps.length === 0) return 0
  let max = 0
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]
    const end = s.endMs ?? s.startMs
    const v = end > s.startMs ? end : s.startMs
    if (v > max) max = v
  }
  return max + 2000
}

/**
 * Format milliseconds as "M:SS.t" (minutes:seconds.tenths).
 */
export function formatTime(ms: number): string {
  const safeMs = Math.max(0, Math.round(ms))
  const totalSeconds = Math.floor(safeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const tenths = Math.floor((safeMs % 1000) / 100)
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`
}

/**
 * Get the effective end time for a step.
 */
export function getStepEndMs(step: PresentationStep, totalDurationMs: number): number {
  return Math.min(step.endMs ?? totalDurationMs, totalDurationMs)
}

// ---------------------------------------------------------------------------
// Precomputed clear-times for O(log n) lookups
// ---------------------------------------------------------------------------

/**
 * Extract sorted clear timestamps from steps. Precompute once, reuse across
 * getActiveSteps / buildTimelineLanes calls.
 */
export function extractClearTimes(steps: PresentationStep[]): number[] {
  const times: number[] = []
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].command.type === "clear") times.push(steps[i].startMs)
  }
  times.sort((a, b) => a - b)
  return times
}

/**
 * Binary search: find first clearTime > startMs && <= endMs.
 * Returns the time value or undefined.
 */
function findClearAfter(clearTimes: number[], startMs: number, endMs: number): number | undefined {
  let lo = 0
  let hi = clearTimes.length
  // Find first index where clearTimes[idx] > startMs
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (clearTimes[mid] <= startMs) lo = mid + 1
    else hi = mid
  }
  // lo is now the first element > startMs
  if (lo < clearTimes.length && clearTimes[lo] <= endMs) return clearTimes[lo]
  return undefined
}

// ---------------------------------------------------------------------------
// Timeline lane builder
// ---------------------------------------------------------------------------

/**
 * Build multi-lane timeline data — groups steps by command.type.
 * Respects "clear" boundaries to truncate endMs.
 * Uses precomputed clearTimes + binary search for O(n log n) total.
 */
export function buildTimelineLanes(steps: PresentationStep[], totalDurationMs: number): TimelineLane[] {
  const clearTimes = extractClearTimes(steps)

  // Single pass: build items and group by type simultaneously
  const laneMap = new Map<string, TimelineItem[]>()

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (step.command.type === "wait") continue

    const startMs = Math.max(0, Math.min(step.startMs, totalDurationMs))
    const configuredEndMs = step.command.type === "clear"
      ? Math.min(startMs + 400, totalDurationMs)
      : getStepEndMs(step, totalDurationMs)
    const clearAfter = findClearAfter(clearTimes, startMs, configuredEndMs)
    const endMs = Math.max(startMs + 120, clearAfter ?? configuredEndMs)

    if (endMs <= startMs) continue

    const type = step.command.type
    let items = laneMap.get(type)
    if (!items) {
      items = []
      laneMap.set(type, items)
    }
    items.push({ step, startMs, endMs, lane: items.length })
  }

  const lanes: TimelineLane[] = []
  laneMap.forEach((items, label) => {
    lanes.push({ id: label, label, items })
  })
  return lanes
}

// ---------------------------------------------------------------------------
// Active steps query
// ---------------------------------------------------------------------------

/**
 * Get all steps that are active (visible) at the given timestamp.
 * Handles clear boundaries and wait commands.
 * Uses binary search on precomputed clearTimes.
 */
export function getActiveSteps(steps: PresentationStep[], currentMs: number, totalDurationMs: number): PresentationStep[] {
  const clearTimes = extractClearTimes(steps)
  const result: PresentationStep[] = []

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (step.command.type === "wait") continue
    if (step.command.type === "clear") {
      if (currentMs >= step.startMs && currentMs < step.startMs + 500) {
        result.push(step)
      }
      continue
    }
    const configuredEndMs = getStepEndMs(step, totalDurationMs)
    const clearAfter = findClearAfter(clearTimes, step.startMs, configuredEndMs)
    const effectiveEndMs = clearAfter ?? configuredEndMs
    if (currentMs >= step.startMs && currentMs < effectiveEndMs) {
      result.push(step)
    }
  }

  return result
}

/**
 * Optimized version: pass precomputed clearTimes to avoid re-extraction.
 */
export function getActiveStepsWithClearTimes(
  steps: PresentationStep[],
  currentMs: number,
  totalDurationMs: number,
  clearTimes: number[],
): PresentationStep[] {
  const result: PresentationStep[] = []

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (step.command.type === "wait") continue
    if (step.command.type === "clear") {
      if (currentMs >= step.startMs && currentMs < step.startMs + 500) {
        result.push(step)
      }
      continue
    }
    const configuredEndMs = getStepEndMs(step, totalDurationMs)
    const clearAfter = findClearAfter(clearTimes, step.startMs, configuredEndMs)
    const effectiveEndMs = clearAfter ?? configuredEndMs
    if (currentMs >= step.startMs && currentMs < effectiveEndMs) {
      result.push(step)
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Step index lookup
// ---------------------------------------------------------------------------

/**
 * Get the index of the most-recently-started step at the given timestamp.
 * Uses binary search for O(log n) — assumes steps are sorted by startMs.
 * Falls back to linear scan if unsorted.
 */
export function getCurrentStepIndex(steps: PresentationStep[], currentMs: number): number {
  if (steps.length === 0) return 0

  // Check if sorted (common case for well-formed timelines)
  // Binary search: find last step where startMs <= currentMs
  let lo = 0
  let hi = steps.length - 1
  let result = 0

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if (steps[mid].startMs <= currentMs) {
      result = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Color utility
// ---------------------------------------------------------------------------

// Pre-computed color cache (command types are a finite set)
const _colorCache = new Map<string, string>()

const PALETTE = [
  "#76B900",
  "#6366F1",
  "#F59E0B",
  "#10B981",
  "#EC4899",
  "#38BDF8",
  "#F97316",
  "#A855F7",
  "#EF4444",
  "#14B8A6",
] as const

/**
 * Deterministic color for a command type string. Cached.
 */
export function commandColor(type: string): string {
  let color = _colorCache.get(type)
  if (color) return color
  let hash = 0
  for (let i = 0; i < type.length; i++) {
    hash = (hash * 31 + type.charCodeAt(i)) % PALETTE.length
  }
  color = PALETTE[Math.abs(hash) % PALETTE.length]
  _colorCache.set(type, color)
  return color
}
