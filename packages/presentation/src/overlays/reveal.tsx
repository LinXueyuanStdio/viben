import { useCurrentFrame, useVideoConfig, interpolate } from "remotion"
import type { RevealCommand, Rect } from "../types"

interface RevealProps {
  command: RevealCommand
}

/**
 * Reveal overlay -- Colored mask that wipes away to reveal content beneath.
 * The mask starts covering the full region, then animates out in the specified direction.
 * Premium visual: gradient mask, feathered edge with blur, shimmer at reveal edge, subtle grain texture.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Reveal({ command }: RevealProps) {
  const {
    region: _region,
    direction = "left",
    color = "#000000",
  } = command
  const region = _region as Rect

  const frame = useCurrentFrame()
  const { fps: _fps } = useVideoConfig()

  // Total reveal duration: 30 frames (1 second at 30fps)
  const revealDuration = 30
  const progress = interpolate(frame, [0, revealDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })

  // After reveal is complete, hide entirely
  if (progress >= 1) return null

  // Compute clip path based on direction
  // The mask shrinks away in the given direction
  let clipPath: string

  switch (direction) {
    case "left":
      // Mask slides to the left (right edge moves left)
      clipPath = `inset(0 ${progress * 100}% 0 0)`
      break
    case "right":
      // Mask slides to the right (left edge moves right)
      clipPath = `inset(0 0 0 ${progress * 100}%)`
      break
    case "top":
      // Mask slides up (bottom edge moves up)
      clipPath = `inset(0 0 ${progress * 100}% 0)`
      break
    case "bottom":
      // Mask slides down (top edge moves down)
      clipPath = `inset(${progress * 100}% 0 0 0)`
      break
    case "center":
      // Mask shrinks from center (all edges move inward)
      const halfProgress = progress * 50
      clipPath = `inset(${halfProgress}% ${halfProgress}% ${halfProgress}% ${halfProgress}%)`
      break
    default:
      clipPath = `inset(0 ${progress * 100}% 0 0)`
  }

  // Parse the color to build a gradient version
  const gradientAngle = direction === "left" ? "90deg"
    : direction === "right" ? "270deg"
    : direction === "top" ? "180deg"
    : direction === "bottom" ? "0deg"
    : "135deg"

  const isHorizontal = direction === "left" || direction === "right"

  return (
    <>
      {/* Main mask with gradient fill and grain texture */}
      <div
        style={{
          position: "absolute",
          left: region.x,
          top: region.y,
          width: region.width,
          height: region.height,
          background: `linear-gradient(${gradientAngle}, ${color} 0%, ${color}DD 60%, ${color}99 85%, ${color}44 95%, transparent 100%)`,
          clipPath,
          pointerEvents: "none",
        }}
      >
        {/* Subtle noise/grain texture overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.06,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundSize: "128px 128px",
          }}
        />
      </div>

      {/* Feathered blur edge at the reveal boundary */}
      <div
        style={{
          position: "absolute",
          left: region.x,
          top: region.y,
          width: region.width,
          height: region.height,
          clipPath,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            ...(isHorizontal
              ? {
                  top: 0,
                  bottom: 0,
                  width: 24,
                  right: direction === "left" ? 0 : undefined,
                  left: direction === "right" ? 0 : undefined,
                }
              : {
                  left: 0,
                  right: 0,
                  height: 24,
                  bottom: direction === "top" ? 0 : undefined,
                  top: direction === "bottom" ? 0 : undefined,
                }),
            background: isHorizontal
              ? `linear-gradient(${direction === "left" ? "to right" : "to left"}, transparent, rgba(255,255,255,0.08))`
              : `linear-gradient(${direction === "top" ? "to bottom" : "to top"}, transparent, rgba(255,255,255,0.08))`,
            filter: "blur(8px)",
          }}
        />
      </div>

      {/* Shimmer/sparkle line at the reveal edge */}
      {progress > 0.02 && progress < 0.98 && (
        <div
          style={{
            position: "absolute",
            left: region.x,
            top: region.y,
            width: region.width,
            height: region.height,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              ...(isHorizontal
                ? {
                    top: 0,
                    bottom: 0,
                    width: 3,
                    left: direction === "left"
                      ? `${(1 - progress) * 100}%`
                      : `${progress * 100}%`,
                  }
                : {
                    left: 0,
                    right: 0,
                    height: 3,
                    top: direction === "top"
                      ? `${(1 - progress) * 100}%`
                      : `${progress * 100}%`,
                  }),
              background: isHorizontal
                ? "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.6) 30%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.6) 70%, transparent 100%)"
                : "linear-gradient(to right, transparent 0%, rgba(255,255,255,0.6) 30%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.6) 70%, transparent 100%)",
              boxShadow: "0 0 12px 4px rgba(255,255,255,0.3)",
              transform: "translateZ(0)",
            }}
          />
        </div>
      )}
    </>
  )
}
