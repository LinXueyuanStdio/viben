import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { RibbonCommand, Point } from "../types"
import { useCardSize } from "../hooks/use-card-size"

// Spring configs for layered timing
const SPRING_CONTAINER = { damping: 16, stiffness: 100, mass: 0.9 } as const
const SPRING_UNFURL = { damping: 10, stiffness: 90, mass: 0.8 } as const
const SPRING_TEXT = { damping: 14, stiffness: 130, mass: 0.6 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface RibbonProps {
  command: RibbonCommand
}

/**
 * Ribbon overlay -- A flowing ribbon/banner with text, like an award ribbon.
 *
 * Motion layers:
 *   1. Container: fade + scale entrance
 *   2. Ribbon body: unfurl from center with width spring
 *   3. Ribbon tails: drop down with gravity spring
 *   4. Text: fade in after ribbon settles
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Ribbon({ command }: RibbonProps) {
  const {
    position: _position,
    text,
    width: _width = 240,
    color = "#6366F1",
    textColor = "#FFFFFF",
    fontSize: _fontSize = 14,
    variant = "flat",
    cardSize: _cardSize,
  } = command
  const position = _position as Point

  const cardSizeResult = useCardSize({ width: _width, cardSize: _cardSize })
  const width = cardSizeResult?.width ?? _width
  const fontSize = _fontSize

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // ── Container entrance ──
  const containerProgress = spring({ frame, fps, config: SPRING_CONTAINER })
  const containerSettled = containerProgress >= 0.999
  const containerOpacity = containerSettled ? 1 : interpolate(containerProgress, [0, 0.3], [0, 1], CLAMP)
  const containerScale = containerSettled
    ? 1
    : interpolate(containerProgress, [0, 0.3, 0.8, 1], [0.9, 0.93, 1.02, 1], CLAMP)

  // ── Ribbon unfurl: width grows from 0 ──
  const unfurlDelay = 4
  const unfurlFrame = Math.max(0, frame - unfurlDelay)
  const unfurlSpring = frame < unfurlDelay ? 0 : spring({ frame: unfurlFrame, fps, config: SPRING_UNFURL })
  const unfurlSettled = unfurlSpring >= 0.999
  const ribbonWidth = unfurlSettled ? width : width * interpolate(unfurlSpring, [0, 0.7, 1], [0, 0.85, 1], CLAMP)

  // ── Tail drop ──
  const tailDelay = 10
  const tailFrame = Math.max(0, frame - tailDelay)
  const tailSpring = frame < tailDelay ? 0 : spring({ frame: tailFrame, fps, config: SPRING_UNFURL })
  const tailSettled = tailSpring >= 0.999
  const tailDrop = tailSettled ? 1 : interpolate(tailSpring, [0, 1], [0, 1], CLAMP)

  // ── Text entrance ──
  const textDelay = 14
  const textFrame = Math.max(0, frame - textDelay)
  const textSpring = frame < textDelay ? 0 : spring({ frame: textFrame, fps, config: SPRING_TEXT })
  const textSettled = textSpring >= 0.999
  const textOpacity = textSettled ? 1 : interpolate(textSpring, [0, 0.4], [0, 1], CLAMP)
  const textScale = textSettled
    ? 1
    : interpolate(textSpring, [0, 0.6, 1], [0.8, 1.03, 1], CLAMP)

  const ribbonHeight = 36
  const tailHeight = variant === "award" ? 20 : 12
  const darkerColor = adjustColor(color, -30)

  const uid = useMemo(() => `ribbon-${position.x}-${position.y}`, [position.x, position.y])

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        transform: `scale(${containerScale})`,
        opacity: containerOpacity,
        willChange: "transform, opacity",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <svg
        width={ribbonWidth + 40}
        height={ribbonHeight + tailHeight + 10}
        style={{ overflow: "visible" }}
        viewBox={`0 0 ${width + 40} ${ribbonHeight + tailHeight + 10}`}
      >
        <defs>
          <linearGradient id={`${uid}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={adjustColor(color, 20)} />
          </linearGradient>
          <filter id={`${uid}-shadow`} x="-10%" y="-10%" width="120%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="rgba(0,0,0,0.3)" />
          </filter>
        </defs>

        {/* Main ribbon body */}
        <rect
          x={20}
          y={4}
          width={ribbonWidth}
          height={ribbonHeight}
          rx={3}
          ry={3}
          fill={`url(#${uid}-grad)`}
          filter={`url(#${uid}-shadow)`}
        />

        {/* Left fold */}
        <polygon
          points={`20,4 14,${4 + ribbonHeight / 2} 20,${4 + ribbonHeight}`}
          fill={darkerColor}
          opacity={unfurlSpring > 0.5 ? 1 : 0}
        />

        {/* Right fold */}
        <polygon
          points={`${20 + ribbonWidth},4 ${26 + ribbonWidth},${4 + ribbonHeight / 2} ${20 + ribbonWidth},${4 + ribbonHeight}`}
          fill={darkerColor}
          opacity={unfurlSpring > 0.5 ? 1 : 0}
        />

        {/* Left tail */}
        {variant === "award" && (
          <polygon
            points={`20,${4 + ribbonHeight} 20,${4 + ribbonHeight + tailHeight * tailDrop} ${20 + 15},${4 + ribbonHeight + tailHeight * tailDrop * 0.6}`}
            fill={darkerColor}
            opacity={tailDrop}
          />
        )}

        {/* Right tail */}
        {variant === "award" && (
          <polygon
            points={`${20 + ribbonWidth},${4 + ribbonHeight} ${20 + ribbonWidth},${4 + ribbonHeight + tailHeight * tailDrop} ${20 + ribbonWidth - 15},${4 + ribbonHeight + tailHeight * tailDrop * 0.6}`}
            fill={darkerColor}
            opacity={tailDrop}
          />
        )}

        {/* Text */}
        <text
          x={20 + ribbonWidth / 2}
          y={4 + ribbonHeight / 2 + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fill={textColor}
          fontSize={fontSize}
          fontFamily="system-ui, sans-serif"
          fontWeight={700}
          opacity={textOpacity}
          transform={`scale(${textScale})`}
          style={{ transformOrigin: `${20 + ribbonWidth / 2}px ${4 + ribbonHeight / 2}px` } as React.CSSProperties}
        >
          {text}
        </text>
      </svg>
    </div>
  )
}

/** Lighten/darken a hex color */
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16)
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount))
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`
}
