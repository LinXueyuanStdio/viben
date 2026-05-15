import { useState, useEffect, useCallback, useRef } from "react"
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
 * Hook that polls a Remotion PlayerRef for playback state at ~30fps.
 * Uses requestAnimationFrame for efficient, frame-aligned polling.
 */
export function usePlaybackState(
  playerRef: RefObject<PlayerRef | null>,
  fps: number,
  totalDurationMs: number,
): PlaybackState {
  const [state, setState] = useState<PlaybackState>(INITIAL_STATE)
  const rafRef = useRef<number>(0)
  const prevFrameRef = useRef(-1)
  const prevPlayingRef = useRef(false)

  const poll = useCallback(() => {
    const player = playerRef.current
    if (!player) {
      rafRef.current = requestAnimationFrame(poll)
      return
    }

    const frame = player.getCurrentFrame()
    const isPlaying = player.isPlaying()
    const totalFrames = Math.max(1, Math.ceil((totalDurationMs / 1000) * fps))

    // Only update state if something changed
    if (frame !== prevFrameRef.current || isPlaying !== prevPlayingRef.current) {
      prevFrameRef.current = frame
      prevPlayingRef.current = isPlaying
      const currentMs = frameToMs(frame, fps)
      const progress = totalFrames > 0 ? Math.min(1, frame / totalFrames) : 0
      setState({ currentFrame: frame, currentMs, isPlaying, progress, totalFrames })
    }

    rafRef.current = requestAnimationFrame(poll)
  }, [playerRef, fps, totalDurationMs])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(rafRef.current)
  }, [poll])

  return state
}
