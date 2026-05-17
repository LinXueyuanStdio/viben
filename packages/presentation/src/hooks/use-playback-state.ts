import { useRef, useSyncExternalStore, useEffect } from "react"
import type { RefObject } from "react"
import type { PlayerRef } from "@remotion/player"
import { frameToMs } from "../utils/motion"

export interface PlaybackState {
  /** Current frame number */
  currentFrame: number
  /** Current time in milliseconds */
  currentMs: number
  /** Whether the player is currently playing */
  isPlaying: boolean
  /** Progress as a fraction 0-1 */
  progress: number
  /** Total duration in frames */
  totalFrames: number
}

const INITIAL_STATE: PlaybackState = {
  currentFrame: 0,
  currentMs: 0,
  isPlaying: false,
  progress: 0,
  totalFrames: 1,
}

/** Slow polling interval (ms) when player is paused */
const PAUSED_POLL_INTERVAL = 500

/**
 * Mutable playback store — single instance per hook call.
 * Supports param updates without recreation (avoids stale closures).
 *
 * Optimizations:
 * - rAF loop only runs while playing; falls back to slow setTimeout when paused
 * - Skips polling entirely when document is hidden
 * - Only creates new snapshot object when values actually change (reference stability)
 * - Starts/stops based on subscriber count
 */
class PlaybackStore {
  private state = INITIAL_STATE
  private prevFrame = -1
  private prevPlaying = false
  private listeners = new Set<() => void>()
  private rafId = 0
  private timerId = 0
  private running = false
  private mode: "raf" | "slow" | "none" = "none"

  constructor(
    private playerRef: RefObject<PlayerRef | null>,
    private fps: number,
    private totalDurationMs: number,
  ) {}

  /** Update params without recreating the store */
  updateParams(fps: number, totalDurationMs: number) {
    this.fps = fps
    this.totalDurationMs = totalDurationMs
  }

  private get totalFrames() {
    return Math.max(1, Math.ceil((this.totalDurationMs / 1000) * this.fps))
  }

  private poll = () => {
    // Skip polling when tab is hidden
    if (typeof document !== "undefined" && document.hidden) {
      this.scheduleNext()
      return
    }

    const player = this.playerRef.current
    if (player) {
      const frame = player.getCurrentFrame()
      const isPlaying = player.isPlaying()

      if (frame !== this.prevFrame || isPlaying !== this.prevPlaying) {
        this.prevFrame = frame
        this.prevPlaying = isPlaying
        const totalFrames = this.totalFrames
        const currentMs = frameToMs(frame, this.fps)
        const progress = Math.min(1, frame / totalFrames)
        this.state = { currentFrame: frame, currentMs, isPlaying, progress, totalFrames }
        this.notify()
      }

      // Switch polling mode based on play state
      this.switchMode(isPlaying ? "raf" : "slow")
    }

    this.scheduleNext()
  }

  /** Schedule next poll based on current mode */
  private scheduleNext() {
    if (!this.running) return
    if (this.mode === "raf") {
      this.rafId = requestAnimationFrame(this.poll)
    } else {
      this.timerId = window.setTimeout(this.poll, PAUSED_POLL_INTERVAL)
    }
  }

  /** Switch between fast (rAF) and slow (setTimeout) modes */
  private switchMode(newMode: "raf" | "slow") {
    if (this.mode === newMode) return
    // Cancel current schedule — next scheduleNext() will use new mode
    this.cancelScheduled()
    this.mode = newMode
  }

  private cancelScheduled() {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = 0 }
    if (this.timerId) { clearTimeout(this.timerId); this.timerId = 0 }
  }

  private notify() {
    for (const fn of this.listeners) fn()
  }

  private start() {
    if (this.running) return
    this.running = true
    this.mode = "raf" // Start with rAF to detect initial state quickly
    this.rafId = requestAnimationFrame(this.poll)
  }

  private stop() {
    if (!this.running) return
    this.running = false
    this.cancelScheduled()
    this.mode = "none"
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    if (this.listeners.size === 1) this.start()
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) this.stop()
    }
  }

  getSnapshot = () => this.state

  destroy() {
    this.stop()
    this.listeners.clear()
  }
}

/**
 * Hook that tracks Remotion PlayerRef playback state via useSyncExternalStore.
 *
 * Optimizations:
 * - Concurrent-mode safe (useSyncExternalStore)
 * - Single mutable store instance (no stale closures on param changes)
 * - rAF loop only when playing; slow poll (500ms) when paused — saves CPU/battery
 * - Skips polling when tab is hidden
 * - Only notifies on actual state changes (reference-stable snapshots)
 * - Proper cleanup on unmount
 */
export function usePlaybackState(
  playerRef: RefObject<PlayerRef | null>,
  fps: number,
  totalDurationMs: number,
): PlaybackState {
  const storeRef = useRef<PlaybackStore | null>(null)

  // Create store once, update params reactively
  if (!storeRef.current) {
    storeRef.current = new PlaybackStore(playerRef, fps, totalDurationMs)
  }

  // Update params without recreating store (avoids stale closure)
  storeRef.current.updateParams(fps, totalDurationMs)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      storeRef.current?.destroy()
      storeRef.current = null
    }
  }, [])

  const store = storeRef.current
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => INITIAL_STATE)
}
