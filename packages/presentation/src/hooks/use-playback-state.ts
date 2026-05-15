import { useRef, useEffect, useSyncExternalStore } from "react"
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

/**
 * Playback state store — useSyncExternalStore compatible.
 * Concurrent-mode safe, avoids tearing between frame reads and React renders.
 * Uses requestAnimationFrame polling with change detection to minimize re-renders.
 */
function createPlaybackStore(
  playerRef: RefObject<PlayerRef | null>,
  fps: number,
  totalDurationMs: number,
) {
  let state = INITIAL_STATE
  let prevFrame = -1
  let prevPlaying = false
  const listeners = new Set<() => void>()
  let rafId = 0

  const totalFrames = Math.max(1, Math.ceil((totalDurationMs / 1000) * fps))

  function poll() {
    const player = playerRef.current
    if (player) {
      const frame = player.getCurrentFrame()
      const isPlaying = player.isPlaying()

      if (frame !== prevFrame || isPlaying !== prevPlaying) {
        prevFrame = frame
        prevPlaying = isPlaying
        const currentMs = frameToMs(frame, fps)
        const progress = Math.min(1, frame / totalFrames)
        state = { currentFrame: frame, currentMs, isPlaying, progress, totalFrames }
        // Notify all subscribers
        listeners.forEach((fn) => fn())
      }
    }
    rafId = requestAnimationFrame(poll)
  }

  function start() {
    rafId = requestAnimationFrame(poll)
  }

  function stop() {
    cancelAnimationFrame(rafId)
  }

  function subscribe(listener: () => void) {
    listeners.add(listener)
    if (listeners.size === 1) start()
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) stop()
    }
  }

  function getSnapshot() {
    return state
  }

  return { subscribe, getSnapshot }
}

/**
 * Hook that tracks Remotion PlayerRef playback state via useSyncExternalStore.
 * Concurrent-mode safe — no tearing between reads.
 * Only triggers re-renders when frame or playing state actually changes.
 */
export function usePlaybackState(
  playerRef: RefObject<PlayerRef | null>,
  fps: number,
  totalDurationMs: number,
): PlaybackState {
  const storeRef = useRef<ReturnType<typeof createPlaybackStore> | null>(null)

  // Recreate store if params change (rare — usually stable)
  if (
    !storeRef.current ||
    // Store identity changes only if fps/duration change
    false
  ) {
    storeRef.current = createPlaybackStore(playerRef, fps, totalDurationMs)
  }

  // Update store params reactively
  const store = storeRef.current

  // Recreate on param change
  useEffect(() => {
    storeRef.current = createPlaybackStore(playerRef, fps, totalDurationMs)
  }, [playerRef, fps, totalDurationMs])

  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => INITIAL_STATE)
}
