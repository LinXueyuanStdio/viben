import { forwardRef, useState, useEffect, useRef, useCallback, memo, useMemo } from "react"
import { Player, type PlayerRef } from "@remotion/player"
import type { PresentationStep } from "../types"
import { msToFrame } from "../utils/motion"
import { PresentationOverlay } from "./presentation-overlay"
import { PerfProfiler } from "./perf-profiler"
import { OverlayLogger } from "./overlay-logger"
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
  /** Additional style for the overlay container */
  style?: React.CSSProperties
  /** Class name */
  className?: string
}

function computeTotalMs(steps: PresentationStep[]): number {
  if (steps.length === 0) return 3000
  return Math.max(...steps.map((s) => Math.max(s.startMs, s.endMs ?? s.startMs))) + 2000
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
 */
export const PresentationPlayer = memo(forwardRef<PlayerRef, PresentationPlayerProps>(
  function PresentationPlayer(
    {
      steps,
      fps = 30,
      totalDurationMs,
      controls = true,
      autoPlay = false,
      enableLogger = IS_DEV,
      enablePerfMonitor = false,
      onPerfReport,
      style,
      className,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [size, setSize] = useState<{ width: number; height: number }>({
      width: typeof window !== "undefined" ? window.innerWidth : 1920,
      height: typeof window !== "undefined" ? window.innerHeight : 1080,
    })

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

    const durationMs = totalDurationMs ?? computeTotalMs(steps)
    const durationInFrames = Math.max(1, msToFrame(durationMs, fps))

    // Memoize inputProps to prevent Player from re-rendering composition on every parent render
    const inputProps = useMemo(
      () => ({ steps, enableLogger, enablePerfMonitor, onPerfReport, fps }),
      [steps, enableLogger, enablePerfMonitor, onPerfReport, fps],
    )

    // Stable player style
    const playerStyle = controls ? PLAYER_STYLE_CONTROLS : PLAYER_STYLE_NO_CONTROLS

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
            ref={ref}
            component={OverlayComposition}
            inputProps={inputProps}
            durationInFrames={durationInFrames}
            fps={fps}
            compositionWidth={size.width}
            compositionHeight={size.height}
            style={playerStyle}
            controls={controls}
            autoPlay={autoPlay}
          />
        )}
      </div>
    )
  },
))
