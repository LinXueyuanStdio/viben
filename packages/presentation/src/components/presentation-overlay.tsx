import { useMemo } from "react"
import type { PresentationStep, PresentationCommand } from "../types"
import { Spotlight } from "../overlays/spotlight"
import { Arrow } from "../overlays/arrow"
import { TextAnnotation } from "../overlays/text-annotation"
import { CircleAnnotation } from "../overlays/circle-annotation"
import { Highlight } from "../overlays/highlight"
import { Card } from "../overlays/card"
import { Pulse } from "../overlays/pulse"
import { Underline } from "../overlays/underline"
import { Badge } from "../overlays/badge"
import { Progress } from "../overlays/progress"
import { Counter } from "../overlays/counter"
import { Bracket } from "../overlays/bracket"

export interface PresentationOverlayProps {
  /** Whether the overlay is active */
  active: boolean
  /** All presentation steps */
  steps: PresentationStep[]
  /** Current step index being shown */
  currentStep: number
  /** z-index (default 9999) */
  zIndex?: number
  /** Callback when user clicks stop */
  onStop?: () => void
  /** Optional children (e.g., controls) rendered inside the overlay */
  children?: React.ReactNode
}

/** Render a single command as an overlay element */
function CommandRenderer({ command }: { command: PresentationCommand }) {
  switch (command.type) {
    case "spotlight":
      return <Spotlight command={command} />
    case "arrow":
      return <Arrow command={command} />
    case "text":
      return <TextAnnotation command={command} />
    case "circle":
      return <CircleAnnotation command={command} />
    case "highlight":
      return <Highlight command={command} />
    case "card":
      return <Card command={command} />
    case "pulse":
      return <Pulse command={command} />
    case "underline":
      return <Underline command={command} />
    case "badge":
      return <Badge command={command} />
    case "progress":
      return <Progress command={command} />
    case "counter":
      return <Counter command={command} />
    case "bracket":
      return <Bracket command={command} />
    case "clear":
    case "wait":
      return null
  }
}

/**
 * PresentationOverlay -- Full-screen transparent overlay container.
 *
 * Positioned `fixed` with `pointer-events: none` and high z-index.
 * Renders commands cumulatively up to `currentStep` (each new step adds on top
 * of previous, except `clear` which removes all prior annotations).
 */
export function PresentationOverlay({
  active,
  steps,
  currentStep,
  zIndex = 9999,
  onStop,
  children,
}: PresentationOverlayProps) {
  // Compute which commands to show (cumulative, with clear semantics)
  const visibleCommands = useMemo(() => {
    if (!active || steps.length === 0) return []

    const commands: Array<{ id: string; command: PresentationCommand }> = []
    const maxIndex = Math.min(currentStep, steps.length - 1)

    for (let i = 0; i <= maxIndex; i++) {
      const step = steps[i]
      if (step.command.type === "clear") {
        // Clear removes all previous annotations
        commands.length = 0
      } else if (step.command.type !== "wait") {
        commands.push({ id: step.id, command: step.command })
      }
    }

    return commands
  }, [active, steps, currentStep])

  if (!active) return null

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        pointerEvents: "none",
      }}
    >
      {/* CSS Keyframes injection */}
      <PresentationKeyframes />

      {/* Annotation layer */}
      {visibleCommands.map(({ id, command }) => (
        <CommandRenderer key={id} command={command} />
      ))}

      {/* Stop button (top-right) */}
      {onStop && (
        <button
          onClick={onStop}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            borderRadius: 20,
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            transition: "background 150ms",
          }}
        >
          <span style={{ fontSize: 14 }}>&#x2715;</span>
          Exit
        </button>
      )}

      {/* Children (e.g., controls) */}
      {children}
    </div>
  )
}

/**
 * Injects CSS @keyframes used by overlay components.
 * Rendered once inside the overlay container.
 */
function PresentationKeyframes() {
  return (
    <style>{`
      @keyframes presentationFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes presentationSlideUp {
        from {
          opacity: 0;
          transform: translateY(20px) scale(0.9);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes presentationDrawLine {
        to { stroke-dashoffset: 0; }
      }

      @keyframes presentationCircleDraw {
        to { stroke-dashoffset: 0; }
      }

      @keyframes presentationHighlightIn {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: var(--target-opacity, 0.3);
          transform: scale(1);
        }
      }

      @keyframes presentationSlideInRight {
        from {
          opacity: 0;
          transform: translateX(60px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateX(0) scale(1);
        }
      }

      @keyframes presentationSlideInLeft {
        from {
          opacity: 0;
          transform: translateX(-60px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateX(0) scale(1);
        }
      }

      @keyframes presentationSlideInUp {
        from {
          opacity: 0;
          transform: translateY(-60px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes presentationSlideInDown {
        from {
          opacity: 0;
          transform: translateY(60px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes presentationPulse {
        0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
        100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
      }
    `}</style>
  )
}
