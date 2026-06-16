import { useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from "react"
import type { RefObject } from "react"
import type { PlayerRef } from "@remotion/player"
import type { PresentationStep } from "../../types"
import { msToFrame, frameToMs } from "../../utils/motion"
import { getActiveSteps, getCurrentStepIndex } from "../../utils/timeline"
import { PlaybackConsole } from "./playback-console"
import { DEFAULT_FPS } from "./styles"
import type { PlaybackConsoleScript, JsonInspectorRenderProps, BashEditorRenderProps } from "./types"

export interface IsolatedPlaybackConsoleProps {
  script: PlaybackConsoleScript
  playerRef: RefObject<PlayerRef | null>
  fps?: number
  onStepsChange: (steps: PresentationStep[], totalMs: number) => void
  renderJsonInspector?: (props: JsonInspectorRenderProps) => ReactNode
  renderBashEditor?: (props: BashEditorRenderProps) => ReactNode
  stepsToScript?: (steps: PresentationStep[]) => string
  onEditorRun?: (text: string) => Promise<{ steps: PresentationStep[]; totalMs: number; errors: Map<number, string> } | null>
}

export function IsolatedPlaybackConsole({
  script,
  playerRef,
  fps = DEFAULT_FPS,
  onStepsChange,
  renderJsonInspector,
  renderBashEditor,
  stepsToScript,
  onEditorRun,
}: IsolatedPlaybackConsoleProps) {
  const [currentMs, setCurrentMs] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isLooping, setIsLooping] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const currentMsRef = useRef(0)
  const throttleRef = useRef<number | null>(null)
  const isLoopingRef = useRef(false)

  useEffect(() => {
    isLoopingRef.current = isLooping
  }, [isLooping])

  useEffect(() => {
    const player = playerRef.current
    if (!player) return

    const handleFrameUpdate = ({ detail }: { detail: { frame: number } }) => {
      const ms = frameToMs(detail.frame, fps)
      currentMsRef.current = ms
      if (throttleRef.current === null) {
        throttleRef.current = window.setTimeout(() => {
          throttleRef.current = null
          setCurrentMs(currentMsRef.current)
        }, 100)
      }
    }
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => {
      setIsPlaying(false)
      setCurrentMs(currentMsRef.current)
    }
    const handleEnded = () => {
      if (isLoopingRef.current) {
        player.seekTo(0)
        player.play()
        currentMsRef.current = 0
        setCurrentMs(0)
      } else {
        setCurrentMs(script.totalDurationMs)
        currentMsRef.current = script.totalDurationMs
        setIsPlaying(false)
      }
    }

    player.addEventListener("frameupdate", handleFrameUpdate)
    player.addEventListener("play", handlePlay)
    player.addEventListener("pause", handlePause)
    player.addEventListener("ended", handleEnded)

    return () => {
      player.removeEventListener("frameupdate", handleFrameUpdate)
      player.removeEventListener("play", handlePlay)
      player.removeEventListener("pause", handlePause)
      player.removeEventListener("ended", handleEnded)
      if (throttleRef.current !== null) {
        window.clearTimeout(throttleRef.current)
        throttleRef.current = null
      }
    }
  }, [script, playerRef, fps])

  const seekToMs = useCallback((ms: number) => {
    const safeMs = Math.max(0, Math.min(ms, script.totalDurationMs))
    playerRef.current?.seekTo(msToFrame(safeMs, fps))
    currentMsRef.current = safeMs
    setCurrentMs(safeMs)
  }, [script, playerRef, fps])

  const play = useCallback(() => {
    playerRef.current?.play()
    setIsPlaying(true)
  }, [playerRef])

  const pause = useCallback(() => {
    playerRef.current?.pause()
    setIsPlaying(false)
  }, [playerRef])

  const goToStart = useCallback(() => seekToMs(0), [seekToMs])

  const goToEnd = useCallback(() => {
    seekToMs(script.totalDurationMs)
    playerRef.current?.pause()
  }, [script, seekToMs, playerRef])

  const goToNext = useCallback(() => {
    const nextStep = script.steps.find((step) => step.startMs > currentMsRef.current + 80)
    seekToMs(nextStep?.startMs ?? script.totalDurationMs)
  }, [script, seekToMs])

  const goToPrevious = useCallback(() => {
    const previousStep = [...script.steps]
      .reverse()
      .find((step) => step.startMs < currentMsRef.current - 500)
    seekToMs(previousStep?.startMs ?? 0)
  }, [script, seekToMs])

  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => !prev)
  }, [])

  const handleSetPlaybackRate = useCallback((rate: number) => {
    setPlaybackRate(rate)
    const player = playerRef.current as PlayerRef & { setPlaybackRate?: (r: number) => void } | null
    if (player && typeof player.setPlaybackRate === "function") {
      player.setPlaybackRate(rate)
    }
  }, [playerRef])

  const frameStep = useCallback((direction: 1 | -1) => {
    const frameDurationMs = 1000 / fps
    const nextMs = currentMsRef.current + direction * frameDurationMs
    seekToMs(Math.max(0, Math.min(nextMs, script.totalDurationMs)))
    playerRef.current?.pause()
    setIsPlaying(false)
  }, [seekToMs, script, playerRef, fps])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      switch (e.key) {
        case " ": {
          e.preventDefault()
          if (isPlaying) pause()
          else play()
          break
        }
        case "ArrowLeft": {
          e.preventDefault()
          if (e.shiftKey) seekToMs(Math.max(0, currentMsRef.current - 5000))
          else goToPrevious()
          break
        }
        case "ArrowRight": {
          e.preventDefault()
          if (e.shiftKey) seekToMs(Math.min(script.totalDurationMs, currentMsRef.current + 5000))
          else goToNext()
          break
        }
        case ",": {
          e.preventDefault()
          frameStep(-1)
          break
        }
        case ".": {
          e.preventDefault()
          frameStep(1)
          break
        }
        case "l":
        case "L": {
          e.preventDefault()
          toggleLoop()
          break
        }
        case "Home": {
          e.preventDefault()
          goToStart()
          break
        }
        case "End": {
          e.preventDefault()
          goToEnd()
          break
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [script, isPlaying, play, pause, seekToMs, goToNext, goToPrevious, goToStart, goToEnd, frameStep, toggleLoop])

  const activeSteps = useMemo(
    () => getActiveSteps(script.steps, currentMs, script.totalDurationMs),
    [script, currentMs],
  )

  const currentStepIndex = useMemo(
    () => getCurrentStepIndex(script.steps, currentMs),
    [script, currentMs],
  )

  return (
    <PlaybackConsole
      script={script}
      currentMs={currentMs}
      currentStepIndex={currentStepIndex}
      activeSteps={activeSteps}
      isPlaying={isPlaying}
      isLooping={isLooping}
      playbackRate={playbackRate}
      fps={fps}
      onSeek={seekToMs}
      onPlay={play}
      onPause={pause}
      onNext={goToNext}
      onPrevious={goToPrevious}
      onGoToStart={goToStart}
      onGoToEnd={goToEnd}
      onToggleLoop={toggleLoop}
      onSetPlaybackRate={handleSetPlaybackRate}
      onFrameStep={frameStep}
      onStepsChange={onStepsChange}
      renderJsonInspector={renderJsonInspector}
      renderBashEditor={renderBashEditor}
      stepsToScript={stepsToScript}
      onEditorRun={onEditorRun}
    />
  )
}
