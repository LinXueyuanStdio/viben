import { useState, useRef, useCallback } from "react"
import { formatTime } from "../../utils/timeline"

export function ProgressStrip({
  currentMs,
  totalDurationMs,
  onSeek,
}: {
  currentMs: number
  totalDurationMs: number
  onSeek: (ms: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const progress = totalDurationMs > 0 ? Math.min(1, currentMs / totalDurationMs) : 0

  const getTimeAtX = useCallback((clientX: number) => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * totalDurationMs
  }, [totalDurationMs])

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label="Playback position"
      aria-valuemin={0}
      aria-valuemax={totalDurationMs}
      aria-valuenow={Math.round(currentMs)}
      aria-valuetext={formatTime(currentMs)}
      tabIndex={0}
      onClick={(e) => onSeek(getTimeAtX(e.clientX))}
      onMouseMove={(e) => {
        const rect = trackRef.current?.getBoundingClientRect()
        if (rect) setHoverX(e.clientX - rect.left)
      }}
      onMouseLeave={() => setHoverX(null)}
      style={{
        position: "relative",
        height: 5,
        background: "rgba(255,255,255,0.06)",
        cursor: "pointer",
        overflow: "visible",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: `${progress * 100}%`,
          background: "linear-gradient(90deg, #76B900, #38BDF8)",
          borderRadius: "0 2px 2px 0",
          transition: "width 80ms linear",
        }}
      />
      {hoverX !== null && trackRef.current && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: Math.max(24, Math.min(hoverX, trackRef.current.getBoundingClientRect().width - 24)),
            transform: "translateX(-50%)",
            padding: "2px 7px",
            borderRadius: 4,
            background: "rgba(0,0,0,0.85)",
            border: "1px solid rgba(255,255,255,0.15)",
            fontSize: 10,
            fontWeight: 600,
            color: "#fff",
            fontVariantNumeric: "tabular-nums",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 5,
          }}
        >
          {formatTime(getTimeAtX(hoverX + (trackRef.current?.getBoundingClientRect().left ?? 0)))}
        </div>
      )}
    </div>
  )
}
