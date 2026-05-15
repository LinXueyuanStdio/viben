import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { CountdownCommand, Point } from "../types"

// Spring configs
const SPRING_NUMBER_IN = { damping: 10, stiffness: 180, mass: 0.5 } as const
const SPRING_GO = { damping: 8, stiffness: 200, mass: 0.6 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface CountdownProps {
  command: CountdownCommand
}

/**
 * Countdown overlay -- Large countdown number with cinematic transitions.
 *
 * Motion layers:
 *   1. Number transition: scale UP to 1.3 -> fade out, new number fades in from 0.8
 *   2. Ring progress: SVG circle stroke-dashoffset counting down
 *   3. Each number: radial shockwave (expanding circle opacity ring)
 *   4. Final "0" or "GO": extra dramatic scale + glow burst
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Countdown({ command }: CountdownProps) {
  const {
    position: _position,
    from = 3,
    color = "#FFFFFF",
    fontSize = 120,
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const framesPerNumber = 30
  const totalNumbers = from + 1
  const totalFrames = totalNumbers * framesPerNumber

  // Determine which segment we're in
  const segmentIndex = Math.floor(frame / framesPerNumber)
  const segmentFrame = frame % framesPerNumber

  // Past the total duration, show nothing
  if (frame >= totalFrames) return null

  // Determine what to display
  const isGo = segmentIndex >= from
  const displayText = isGo ? "GO!" : String(from - segmentIndex)
  const displayColor = isGo ? "#4ADE80" : color
  const springConfig = isGo ? SPRING_GO : SPRING_NUMBER_IN

  // ── Number entrance: scale from 0.8 with elastic spring ──
  const numSpring = spring({
    frame: segmentFrame,
    fps,
    config: springConfig,
  })

  // Phase 1: entrance (0-22 frames) — scale in with overshoot
  const entranceScale = isGo
    ? interpolate(numSpring, [0, 0.4, 0.7, 1], [0.3, 1.25, 0.95, 1.0], CLAMP)
    : interpolate(numSpring, [0, 0.5, 0.8, 1], [0.8, 1.08, 0.98, 1.0], CLAMP)

  // Phase 2: exit (last 8 frames) — scale UP to 1.3 and fade out
  const exitStart = framesPerNumber - 8
  const isExiting = segmentFrame > exitStart
  const exitProgress = isExiting
    ? interpolate(segmentFrame, [exitStart, framesPerNumber], [0, 1], CLAMP)
    : 0
  const exitScale = isExiting ? 1 + exitProgress * 0.3 : 1
  const exitOpacity = isExiting ? 1 - exitProgress : 1

  // Combined scale
  const scale = entranceScale * exitScale

  // Blur: sharp on entrance, slight blur on exit
  const entranceBlur = interpolate(numSpring, [0, 0.4], [6, 0], CLAMP)
  const exitBlur = isExiting ? exitProgress * 4 : 0
  const totalBlur = entranceBlur + exitBlur

  // ── Circular progress ring ──
  const ringProgress = segmentFrame / framesPerNumber
  const ringRadius = fontSize * 0.75
  const ringCircumference = 2 * Math.PI * ringRadius
  // Ring fills up and then resets each segment
  const ringDashOffset = ringCircumference * (1 - ringProgress)

  // Ring entrance scale
  const ringScale = interpolate(numSpring, [0, 0.3], [0.9, 1], CLAMP)

  // ── Radial shockwave: expanding circle ring on each number entrance ──
  const shockwaveRadius = interpolate(segmentFrame, [0, 20], [0, fontSize * 1.2], CLAMP)
  const shockwaveOpacity = interpolate(segmentFrame, [0, 5, 20], [0, 0.4, 0], CLAMP)
  const shockwaveWidth = interpolate(segmentFrame, [0, 20], [4, 1], CLAMP)

  // ── GO! glow burst ──
  const goGlowRadius = isGo ? interpolate(segmentFrame, [0, 15], [0, fontSize * 2], CLAMP) : 0
  const goGlowOpacity = isGo ? interpolate(segmentFrame, [0, 5, 15], [0, 0.5, 0], CLAMP) : 0

  // Glass plate size
  const plateSize = fontSize * 1.8
  const glowColor = isGo ? "rgba(74, 222, 128, 0.3)" : "rgba(255, 255, 255, 0.15)"

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        transform: `translate(-50%, -50%)`,
        pointerEvents: "none",
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Glass plate container */}
      <div
        style={{
          position: "absolute",
          width: plateSize,
          height: plateSize,
          borderRadius: "50%",
          background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 50%, rgba(0,0,0,0.3) 100%)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.15)",
          boxShadow: `
            0 8px 32px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(255,255,255,0.1),
            0 0 60px ${glowColor}
          `,
          opacity: exitOpacity,
        }}
      />

      {/* Radial shockwave ring */}
      {shockwaveOpacity > 0.01 && (
        <svg
          width={plateSize * 1.5}
          height={plateSize * 1.5}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
        >
          <circle
            cx={plateSize * 0.75}
            cy={plateSize * 0.75}
            r={shockwaveRadius}
            fill="none"
            stroke={displayColor}
            strokeWidth={shockwaveWidth}
            opacity={shockwaveOpacity}
          />
        </svg>
      )}

      {/* GO! glow burst */}
      {isGo && goGlowOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            width: goGlowRadius * 2,
            height: goGlowRadius * 2,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(74, 222, 128, ${goGlowOpacity}) 0%, transparent 70%)`,
            transform: "translate(-50%, -50%)",
            left: "50%",
            top: "50%",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Circular progress ring */}
      <svg
        width={plateSize}
        height={plateSize}
        style={{
          position: "absolute",
          transform: `rotate(-90deg) scale(${ringScale})`,
          opacity: exitOpacity,
        }}
      >
        {/* Track ring */}
        <circle
          cx={plateSize / 2}
          cy={plateSize / 2}
          r={ringRadius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={3}
        />
        {/* Progress ring */}
        <circle
          cx={plateSize / 2}
          cy={plateSize / 2}
          r={ringRadius}
          fill="none"
          stroke={displayColor}
          strokeWidth={3}
          strokeDasharray={ringCircumference}
          strokeDashoffset={ringDashOffset}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 6px ${displayColor})`,
          }}
        />
      </svg>

      {/* Countdown number — scale + blur transitions */}
      <div
        style={{
          position: "relative",
          color: displayColor,
          fontSize: isGo ? fontSize * 0.7 : fontSize,
          fontWeight: 900,
          fontFamily: "system-ui, -apple-system, sans-serif",
          textShadow: `
            0 2px 4px rgba(0,0,0,0.6),
            0 0 40px ${isGo ? "rgba(74,222,128,0.5)" : "rgba(255,255,255,0.3)"},
            0 0 80px ${isGo ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.1)"},
            0 4px 8px rgba(0,0,0,0.4)
          `,
          zIndex: 2,
          transform: `scale(${scale})`,
          opacity: exitOpacity,
          filter: totalBlur > 0.01 ? `blur(${totalBlur}px)` : undefined,
        }}
      >
        {displayText}
      </div>
    </div>
  )
}
