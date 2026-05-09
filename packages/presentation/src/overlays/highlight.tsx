import type { HighlightCommand } from "../types"

interface HighlightProps {
  command: HighlightCommand
}

/**
 * Highlight overlay -- Div with CSS opacity transition.
 * Semi-transparent color block covering the target region.
 */
export function Highlight({ command }: HighlightProps) {
  const {
    region,
    color = "rgba(99, 102, 241, 0.3)",
    opacity: targetOpacity = 0.3,
    borderRadius = 4,
    animate = true,
  } = command

  return (
    <div
      style={{
        position: "absolute",
        left: region.x,
        top: region.y,
        width: region.width,
        height: region.height,
        background: color,
        opacity: animate ? 0 : targetOpacity,
        borderRadius,
        transform: animate ? "scale(0.95)" : undefined,
        animation: animate
          ? `presentationHighlightIn 500ms ease-out forwards`
          : undefined,
        // Pass target opacity via custom property
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ["--target-opacity" as any]: targetOpacity,
      }}
    />
  )
}
