import type { SpotlightCommand } from "../types"

interface SpotlightProps {
  command: SpotlightCommand
}

/**
 * Spotlight overlay -- SVG mask with CSS transition for smooth movement.
 * Dark overlay with a transparent cutout highlighting the target region.
 */
export function Spotlight({ command }: SpotlightProps) {
  const { region, maskOpacity = 0.7, borderRadius = 8, animate = true } = command

  const maskId = `spotlight-mask-${region.x}-${region.y}`

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        animation: animate ? "presentationFadeIn 500ms ease-out forwards" : undefined,
        opacity: animate ? 0 : 1,
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={region.x}
              y={region.y}
              width={region.width}
              height={region.height}
              rx={borderRadius}
              ry={borderRadius}
              fill="black"
              style={{
                transition: animate ? "all 400ms ease-out" : undefined,
              }}
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={`rgba(0, 0, 0, ${maskOpacity})`}
          mask={`url(#${maskId})`}
        />
      </svg>
      {/* Spotlight border glow */}
      <div
        style={{
          position: "absolute",
          left: region.x,
          top: region.y,
          width: region.width,
          height: region.height,
          borderRadius,
          border: `2px solid rgba(255, 255, 255, ${maskOpacity * 0.5})`,
          boxShadow: `0 0 20px rgba(255, 255, 255, ${maskOpacity * 0.2})`,
          pointerEvents: "none",
          transition: animate ? "all 400ms ease-out" : undefined,
        }}
      />
    </div>
  )
}
