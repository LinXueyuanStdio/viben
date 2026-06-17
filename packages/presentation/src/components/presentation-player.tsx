import { forwardRef, useState, useEffect, useRef, memo, useMemo, useImperativeHandle } from "react"
import { Player, type PlayerRef } from "@remotion/player"
import type { PresentationStep } from "../types"
import { msToFrame } from "../utils/motion"
import { computeTotalMs, getCurrentStepIndex } from "../utils/timeline"
import { usePlaybackState } from "../hooks/use-playback-state"
import { TargetRectsProvider } from "../hooks/use-target-rects"
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
      <TargetRectsProvider>
        <PerfProfiler fps={fps} onReport={onPerfReport} showHud>
          <PresentationOverlay steps={steps} />
        </PerfProfiler>
        {enableLogger && <OverlayLogger steps={steps} />}
      </TargetRectsProvider>
    )
  }
  return (
    <TargetRectsProvider>
      <PresentationOverlay steps={steps} />
      {enableLogger && <OverlayLogger steps={steps} />}
    </TargetRectsProvider>
  )
})

// ---------------------------------------------------------------------------
// Module-level style constants (zero allocation per render)
// ---------------------------------------------------------------------------

const PLAYER_STYLE_CONTROLS: React.CSSProperties = { width: "100%", height: "100%", pointerEvents: "auto" }
const PLAYER_STYLE_NO_CONTROLS: React.CSSProperties = { width: "100%", height: "100%", pointerEvents: "none" }
const CONTAINER_STYLE_BASE: React.CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" }

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

    useImperativeHandle(ref, () => internalPlayerRef.current as PlayerRef)

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

    // Force play after mount when autoPlay is set (bypasses browser autoplay restrictions)
    useEffect(() => {
      if (!autoPlay) return
      const timer = setTimeout(() => {
        internalPlayerRef.current?.play()
      }, 100)
      return () => clearTimeout(timer)
    }, [autoPlay])

    // Memoize durationMs to avoid O(n) computeTotalMs on every render
    const durationMs = useMemo(
      () => totalDurationMsProp ?? computeTotalMs(steps),
      [totalDurationMsProp, steps],
    )
    const durationInFrames = Math.max(1, msToFrame(durationMs, fps))

    // Resume playback when durationInFrames grows (streaming append scenario).
    // When Remotion Player has ended (frame === oldDuration - 1), calling play()
    // restarts from frame 0. Instead we seek to where new content begins, then play.
    const prevDurationRef = useRef(durationInFrames)
    useEffect(() => {
      const prevDuration = prevDurationRef.current
      if (durationInFrames > prevDuration) {
        const player = internalPlayerRef.current
        if (player && !player.isPlaying()) {
          const currentFrame = player.getCurrentFrame()
          // If player ended at the old last frame, seek forward to new content
          if (currentFrame >= prevDuration - 1) {
            player.seekTo(prevDuration)
          }
          player.play()
        }
      }
      prevDurationRef.current = durationInFrames
    }, [durationInFrames])

    // Playback state for transport/timeline (useSyncExternalStore-based)
    const playback = usePlaybackState(internalPlayerRef, fps, durationMs)

    // Latest-ref pattern: avoid re-running effects when callback identity changes
    const onTimeUpdateRef = useRef(onTimeUpdate)
    onTimeUpdateRef.current = onTimeUpdate
    const onStepChangeRef = useRef(onStepChange)
    onStepChangeRef.current = onStepChange

    // Fire onTimeUpdate callback — dep array excludes callback (latest-ref)
    const prevMsRef = useRef(-1)
    useEffect(() => {
      if (playback.currentMs !== prevMsRef.current) {
        prevMsRef.current = playback.currentMs
        onTimeUpdateRef.current?.(playback.currentMs)
      }
    }, [playback.currentMs])

    // Fire onStepChange callback — uses binary search O(log n)
    const prevStepIdRef = useRef<string>("")
    useEffect(() => {
      const cb = onStepChangeRef.current
      if (!cb) return
      const activeIdx = getCurrentStepIndex(steps, playback.currentMs)
      const step = activeIdx >= 0 ? steps[activeIdx] : null
      const stepId = step?.id ?? ""
      if (stepId !== prevStepIdRef.current) {
        prevStepIdRef.current = stepId
        cb(step ?? null, activeIdx)
      }
    }, [playback.currentMs, steps])

    // Memoize inputProps — use latest-ref for onPerfReport to keep props stable
    const onPerfReportRef = useRef(onPerfReport)
    onPerfReportRef.current = onPerfReport
    const stablePerfReport = useMemo(
      () => (metrics: PerfMetrics, formatted: string) => onPerfReportRef.current?.(metrics, formatted),
      [],
    )

    const inputProps = useMemo(
      () => ({ steps, enableLogger, enablePerfMonitor, onPerfReport: stablePerfReport, fps }),
      [steps, enableLogger, enablePerfMonitor, stablePerfReport, fps],
    )

    // Determine if Remotion native controls should show
    const effectiveControls = showTransport ? false : controls
    const playerStyle = effectiveControls ? PLAYER_STYLE_CONTROLS : PLAYER_STYLE_NO_CONTROLS

    // Container style: avoid spread allocation when no custom style
    const containerStyle = style ? { ...CONTAINER_STYLE_BASE, ...style } : CONTAINER_STYLE_BASE

    return (
      <div
        ref={containerRef}
        className={className}
        style={containerStyle}
      >
        {size.width > 0 && size.height > 0 && (
          <Player
            ref={internalPlayerRef}
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
            playerRef={internalPlayerRef}
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
            playerRef={internalPlayerRef}
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
