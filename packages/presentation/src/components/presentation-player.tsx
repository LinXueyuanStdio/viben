import { forwardRef, useState, useEffect, useRef, memo, useMemo } from "react"
import { Player, type PlayerRef } from "@remotion/player"
import type { PresentationStep } from "../types"
import { msToFrame } from "../utils/motion"
import { computeTotalMs } from "../utils/timeline"
import { usePlaybackState } from "../hooks/use-playback-state"
import { PresentationOverlay } from "./presentation-overlay"
import { PerfProfiler } from "./perf-profiler"
import { OverlayLogger } from "./overlay-logger"
import { TransportBar } from "./transport-bar"
import { TimelinePanel } from "./timeline-panel"
import type { PerfMetrics } from "../utils/perf-monitor"

export interface PresentationPlayerProps {
  /** Presentation steps */
  steps: PresentationStep[]
  /** Frames per second (default 30) */
  fps?: number
  /** Total duration in ms. If omitted, computed from steps. */
  totalDurationMs?: number
  /** Show built-in Remotion controls (default true) */
  controls?: boolean
  /** Auto-play on mount (default false) */
  autoPlay?: boolean
  /** Enable dev logging to /__collision-log (default: true in dev) */
  enableLogger?: boolean
  /** Enable performance monitor HUD overlay (default false) */
  enablePerfMonitor?: boolean
  /** Callback with perf metrics when monitor reports */
  onPerfReport?: (metrics: PerfMetrics, formatted: string) => void
  /** Show built-in transport bar (default false) */
  showTransport?: boolean
  /** Show timeline lanes panel (default false) */
  showTimeline?: boolean
  /** Transport bar position (default 'bottom') */
  transportPosition?: "top" | "bottom"
  /** Timeline panel position (default 'bottom') */
  timelinePosition?: "top" | "bottom"
  /** Timeline panel height in px (default 140) */
  timelineHeight?: number
  /** Callback when active step changes */
  onStepChange?: (step: PresentationStep | null, index: number) => void
  /** Callback on time update (~30fps polling) */
  onTimeUpdate?: (currentMs: number) => void
  /** Additional style for the overlay container */
  style?: React.CSSProperties
  /** Class name */
  className?: string
}

const IS_DEV = typeof process !== "undefined" && process.env?.NODE_ENV !== "production"

/** Internal composition rendered by the Player — memoized to prevent reconciliation on frame changes */
const OverlayComposition = memo(function OverlayComposition({
  steps,
  enableLogger,
  enablePerfMonitor,
  onPerfReport,
  fps,
}: {
  steps: PresentationStep[]
  enableLogger: boolean
  enablePerfMonitor: boolean
  onPerfReport?: (metrics: PerfMetrics, formatted: string) => void
  fps: number
}) {
  if (enablePerfMonitor) {
    return (
      <>
        <PerfProfiler fps={fps} onReport={onPerfReport} showHud>
          <PresentationOverlay steps={steps} />
        </PerfProfiler>
        {enableLogger && <OverlayLogger steps={steps} />}
      </>
    )
  }
  return (
    <>
      <PresentationOverlay steps={steps} />
      {enableLogger && <OverlayLogger steps={steps} />}
    </>
  )
})

/** Stable style for Player element */
const PLAYER_STYLE_CONTROLS: React.CSSProperties = { width: "100%", height: "100%", pointerEvents: "auto" }
const PLAYER_STYLE_NO_CONTROLS: React.CSSProperties = { width: "100%", height: "100%", pointerEvents: "none" }

/**
 * PresentationPlayer — Transparent Remotion overlay player.
 *
 * Position this component ON TOP of your page content (absolute/fixed).
 * It renders only the annotation overlays with a transparent background.
 * Uses the container's actual dimensions as composition size to ensure
 * coordinates match the underlying DOM layout exactly.
 *
 * Optional: enable `showTransport` and/or `showTimeline` for built-in UI controls.
 */
export const PresentationPlayer = memo(forwardRef<PlayerRef, PresentationPlayerProps>(
  function PresentationPlayer(
    {
      steps,
      fps = 30,
      totalDurationMs: totalDurationMsProp,
      controls = true,
      autoPlay = false,
      enableLogger = IS_DEV,
      enablePerfMonitor = false,
      onPerfReport,
      showTransport = false,
      showTimeline = false,
      transportPosition = "bottom",
      timelinePosition = "bottom",
      timelineHeight = 140,
      onStepChange,
      onTimeUpdate,
      style,
      className,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const internalPlayerRef = useRef<PlayerRef>(null)
    const [size, setSize] = useState<{ width: number; height: number }>({
      width: typeof window !== "undefined" ? window.innerWidth : 1920,
      height: typeof window !== "undefined" ? window.innerHeight : 1080,
    })

    // Use the forwarded ref or the internal one
    const playerRef = (ref as React.RefObject<PlayerRef | null>) ?? internalPlayerRef

    // Measure container to set composition dimensions
    useEffect(() => {
      const el = containerRef.current
      if (!el) return

      const measure = () => {
        const rect = el.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          setSize((prev) => {
            const w = Math.round(rect.width)
            const h = Math.round(rect.height)
            if (prev.width === w && prev.height === h) return prev
            return { width: w, height: h }
          })
        }
      }

      measure()

      const observer = new ResizeObserver(measure)
      observer.observe(el)
      return () => observer.disconnect()
    }, [])

    const durationMs = totalDurationMsProp ?? computeTotalMs(steps)
    const durationInFrames = Math.max(1, msToFrame(durationMs, fps))

    // Playback state for transport/timeline
    const playback = usePlaybackState(playerRef, fps, durationMs)

    // Fire onTimeUpdate callback
    const prevMsRef = useRef(-1)
    useEffect(() => {
      if (onTimeUpdate && playback.currentMs !== prevMsRef.current) {
        prevMsRef.current = playback.currentMs
        onTimeUpdate(playback.currentMs)
      }
    }, [playback.currentMs, onTimeUpdate])

    // Fire onStepChange callback
    const prevStepIdRef = useRef<string>("")
    useEffect(() => {
      if (!onStepChange) return
      // Find current active step
      let activeIdx = -1
      for (let i = steps.length - 1; i >= 0; i--) {
        if (steps[i].startMs <= playback.currentMs) {
          activeIdx = i
          break
        }
      }
      const step = activeIdx >= 0 ? steps[activeIdx] : null
      const stepId = step?.id ?? ""
      if (stepId !== prevStepIdRef.current) {
        prevStepIdRef.current = stepId
        onStepChange(step, activeIdx)
      }
    }, [playback.currentMs, steps, onStepChange])

    // Memoize inputProps to prevent Player from re-rendering composition on every parent render
    const inputProps = useMemo(
      () => ({ steps, enableLogger, enablePerfMonitor, onPerfReport, fps }),
      [steps, enableLogger, enablePerfMonitor, onPerfReport, fps],
    )

    // Determine if Remotion native controls should show
    // When showTransport is enabled, hide native controls to avoid double UI
    const effectiveControls = showTransport ? false : controls
    const playerStyle = effectiveControls ? PLAYER_STYLE_CONTROLS : PLAYER_STYLE_NO_CONTROLS

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          ...style,
        }}
      >
        {size.width > 0 && size.height > 0 && (
          <Player
            ref={playerRef as React.Ref<PlayerRef>}
            component={OverlayComposition}
            inputProps={inputProps}
            durationInFrames={durationInFrames}
            fps={fps}
            compositionWidth={size.width}
            compositionHeight={size.height}
            style={playerStyle}
            controls={effectiveControls}
            autoPlay={autoPlay}
            acknowledgeRemotionLicense
          />
        )}

        {/* Built-in Transport Bar */}
        {showTransport && (
          <TransportBar
            playerRef={playerRef}
            steps={steps}
            playback={playback}
            fps={fps}
            totalDurationMs={durationMs}
            position={transportPosition}
          />
        )}

        {/* Built-in Timeline Panel */}
        {showTimeline && (
          <TimelinePanel
            playerRef={playerRef}
            steps={steps}
            playback={playback}
            fps={fps}
            totalDurationMs={durationMs}
            height={timelineHeight}
            position={timelinePosition}
          />
        )}
      </div>
    )
  },
))
