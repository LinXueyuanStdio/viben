import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { HtmlCommand, Point } from "../types"
import type { SlideDirection } from "../utils/motion"

const ENTER_FROM_MAP: Record<string, SlideDirection> = {
  left: "left",
  right: "right",
  top: "top",
  bottom: "bottom",
}

const SPRING_CONFIG = { damping: 14, stiffness: 90, mass: 1.0 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

const DIR_UNIT: Record<SlideDirection, readonly [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  top: [0, -1],
  bottom: [0, 1],
} as const

interface HtmlProps {
  command: HtmlCommand
}

export function Html({ command }: HtmlProps) {
  const {
    position: _position,
    html,
    width = 400,
    height = 300,
    enterFrom = "bottom",
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const direction = ENTER_FROM_MAP[enterFrom] || "bottom"
  const [ux, uy] = DIR_UNIT[direction]

  const progress = spring({ frame, fps, config: SPRING_CONFIG })
  const settled = progress >= 0.999

  const clipInset = settled ? 0 : interpolate(progress, [0, 1], [50, 0], CLAMP)
  const clipTop = direction === "bottom" ? clipInset * 0.5 : clipInset
  const clipRight = direction === "left" ? clipInset * 0.5 : clipInset
  const clipBottom = direction === "top" ? clipInset * 0.5 : clipInset
  const clipLeft = direction === "right" ? clipInset * 0.5 : clipInset

  const blur = settled ? 0 : interpolate(progress, [0, 0.6], [8, 0], CLAMP)
  const translateX = settled ? 0 : (1 - progress) * ux * 40
  const translateY = settled ? 0 : (1 - progress) * uy * 40
  const scale = settled
    ? 1
    : interpolate(progress, [0, 0.3, 0.8, 1], [0.92, 0.96, 1.02, 1], CLAMP)
  const opacity = settled ? 1 : interpolate(progress, [0, 0.4], [0, 1], CLAMP)

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width,
        height,
        borderRadius: 12,
        overflow: "hidden",
        opacity,
        transform: `translateX(${translateX}px) translateY(${translateY}px) scale(${scale})`,
        filter: blur > 0.01 ? `blur(${blur}px)` : undefined,
        clipPath: settled
          ? undefined
          : `inset(${clipTop}% ${clipRight}% ${clipBottom}% ${clipLeft}%)`,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.15)",
      }}
    >
      <iframe
        srcDoc={html}
        sandbox="allow-scripts"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          background: "transparent",
        }}
      />
    </div>
  )
}
