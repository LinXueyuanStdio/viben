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
 */
export function computeTotalMs(steps: PresentationStep[]): number {
  if (steps.length === 0) return 0
  return Math.max(...steps.map((s) => Math.max(s.startMs, s.endMs ?? s.startMs))) + 2000
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

/**
 * Build multi-lane timeline data — groups steps by command.type.
 * Respects "clear" boundaries to truncate endMs.
 */
export function buildTimelineLanes(steps: PresentationStep[], totalDurationMs: number): TimelineLane[] {
  const clearTimes = [...steps]
    .filter((step) => step.command.type === "clear")
    .map((step) => step.startMs)
    .sort((a, b) => a - b)

  const items = [...steps]
    .filter((step) => step.command.type !== "wait")
    .map((step): TimelineItem | null => {
      const startMs = Math.max(0, Math.min(step.startMs, totalDurationMs))
      const configuredEndMs = step.command.type === "clear"
        ? Math.min(startMs + 400, totalDurationMs)
        : getStepEndMs(step, totalDurationMs)
      const clearAfterStart = clearTimes.find((time) => time > startMs && time <= configuredEndMs)
      const endMs = Math.max(startMs + 120, clearAfterStart ?? configuredEndMs)
      return endMs > startMs ? { step, startMs, endMs, lane: 0 } : null
    })
    .filter((item): item is TimelineItem => item !== null)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)

  const laneLabels = Array.from(new Set(items.map((item) => item.step.command.type)))
  return laneLabels.map((label) => {
    const laneItems = items
      .filter((item) => item.step.command.type === label)
      .map((item, lane) => ({ ...item, lane }))
    return { id: label, label, items: laneItems }
  })
}

/**
 * Get all steps that are active (visible) at the given timestamp.
 * Handles clear boundaries and wait commands.
 */
export function getActiveSteps(steps: PresentationStep[], currentMs: number, totalDurationMs: number): PresentationStep[] {
  const clearTimes = [...steps]
    .filter((step) => step.command.type === "clear")
    .map((step) => step.startMs)
    .sort((a, b) => a - b)

  return steps
    .filter((step) => {
      if (step.command.type === "wait") return false
      if (step.command.type === "clear") {
        return currentMs >= step.startMs && currentMs < step.startMs + 500
      }
      const configuredEndMs = getStepEndMs(step, totalDurationMs)
      const clearAfterStart = clearTimes.find((time) => time > step.startMs && time <= configuredEndMs)
      const effectiveEndMs = clearAfterStart ?? configuredEndMs
      return currentMs >= step.startMs && currentMs < effectiveEndMs
    })
    .sort((a, b) => a.startMs - b.startMs)
}

/**
 * Get the index of the most-recently-started step at the given timestamp.
 */
export function getCurrentStepIndex(steps: PresentationStep[], currentMs: number): number {
  let currentIndex = 0
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].startMs <= currentMs) currentIndex = i
  }
  return currentIndex
}

/**
 * Deterministic color for a command type string.
 */
export function commandColor(type: string): string {
  const palette = [
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
  ]
  let hash = 0
  for (let i = 0; i < type.length; i++) {
    hash = (hash * 31 + type.charCodeAt(i)) % palette.length
  }
  return palette[Math.abs(hash) % palette.length]
}
