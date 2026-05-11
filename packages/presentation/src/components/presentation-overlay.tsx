import { useMemo, useRef, useEffect } from "react"
import type { PresentationStep, PresentationCommand } from "../types"
import { useResolvedCommand } from "../hooks/use-resolved-command"
import { logCollisionReport } from "../utils/collision-detect"
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
import { Trendline } from "../overlays/trendline"
import { Comparison } from "../overlays/comparison"
import { Typewriter } from "../overlays/typewriter"
import { Chart } from "../overlays/chart"

export interface PresentationOverlayProps {
  /** Whether the overlay is active */
  active: boolean
  /** All presentation steps */
  steps: PresentationStep[]
  /**
   * Current step index (legacy sequential mode).
   * If elapsedMs is provided, this is ignored.
   */
  currentStep?: number
  /**
   * Timeline mode: elapsed time in ms from presentation start.
   * Determines which steps are visible based on startMs/endMs.
   */
  elapsedMs?: number
  /** z-index (default 9999) */
  zIndex?: number
  /** Callback when user clicks stop */
  onStop?: () => void
  /** Optional children (e.g., controls) rendered inside the overlay */
  children?: React.ReactNode
}

/**
 * Resolves any TargetRef fields in a command before rendering.
 * Returns null (renders nothing) if a target element is not found in the DOM.
 */
function ResolvedCommandRenderer({ command, stepId }: { command: PresentationCommand; stepId?: string }) {
  const resolved = useResolvedCommand(command)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Set data-presentation-id on the first child element so subsequent steps can reference it
  useEffect(() => {
    if (wrapperRef.current && stepId) {
      const firstChild = wrapperRef.current.firstElementChild as HTMLElement | null
      if (firstChild) {
        firstChild.setAttribute("data-presentation-id", `overlay-${stepId}`)
      }
    }
  })

  if (!resolved) {
    console.warn(`[Overlay] ❌ step="${stepId}" type="${command.type}" → resolved to NULL (target not found, not rendering)`, command)
    return null
  }

  return (
    <div ref={wrapperRef} style={{ display: "contents" }}>
      <CommandRenderer command={resolved} />
    </div>
  )
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
    case "trendline":
      return <Trendline command={command} />
    case "comparison":
      return <Comparison command={command} />
    case "typewriter":
      return <Typewriter command={command} />
    case "chart":
      return <Chart command={command} />
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
  elapsedMs,
  zIndex = 9999,
  onStop,
  children,
}: PresentationOverlayProps) {
  // Compute which commands to show
  const visibleCommands = useMemo(() => {
    if (!active || steps.length === 0) return []

    // Timeline mode: use elapsedMs to determine visible steps
    if (elapsedMs != null) {
      return computeTimelineVisible(steps, elapsedMs)
    }

    // Legacy sequential mode: cumulative up to currentStep
    const commands: Array<{ id: string; command: PresentationCommand }> = []
    const maxIndex = Math.min(currentStep ?? 0, steps.length - 1)

    for (let i = 0; i <= maxIndex; i++) {
      const step = steps[i]
      if (step.command.type === "clear") {
        commands.length = 0
      } else if (step.command.type !== "wait") {
        commands.push({ id: step.id, command: step.command })
      }
    }

    return commands
  }, [active, steps, currentStep, elapsedMs])

  // Collision detection — log overlaps and boundary violations
  useEffect(() => {
    if (visibleCommands.length > 0 && elapsedMs != null) {
      logCollisionReport(visibleCommands, elapsedMs)
    }
  }, [visibleCommands, elapsedMs])

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

      {/* Annotation layer -- resolves TargetRef fields to pixel coords */}
      {visibleCommands.map(({ id, command }) => (
        <ResolvedCommandRenderer key={id} command={command} stepId={id} />
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
 * Timeline mode: compute visible commands at a given elapsed time.
 * Steps are sorted by startMs. "clear" commands at time T remove all prior visible annotations.
 * Steps with endMs are hidden after that time.
 */
function computeTimelineVisible(
  steps: PresentationStep[],
  elapsedMs: number,
): Array<{ id: string; command: PresentationCommand }> {
  // Sort by startMs (stable — preserve order for same startMs)
  const sorted = [...steps].sort((a, b) => a.startMs - b.startMs)

  const commands: Array<{ id: string; command: PresentationCommand }> = []
  const skippedFuture: string[] = []
  const expired: string[] = []

  for (const step of sorted) {
    if (step.startMs > elapsedMs) {
      skippedFuture.push(`${step.id}(${step.command.type}@${step.startMs}ms)`)
      continue // don't break — steps might not be perfectly sorted if same startMs
    }

    if (step.command.type === "clear") {
      commands.length = 0
      continue
    }
    if (step.command.type === "wait") continue

    // Check if step has expired
    if (step.endMs != null && step.endMs <= elapsedMs) {
      expired.push(`${step.id}(${step.command.type})`)
      continue
    }

    commands.push({ id: step.id, command: step.command })
  }

  // Log every 500ms to avoid spam (use rounded time)
  const logKey = Math.floor(elapsedMs / 500)
  if ((globalThis as any).__lastLogKey !== logKey) {
    (globalThis as any).__lastLogKey = logKey
    console.log(
      `[Timeline] t=${(elapsedMs / 1000).toFixed(1)}s → visible: [${commands.map((c) => `${c.id}(${c.command.type})`).join(", ")}]`,
      `| expired: ${expired.length}`,
      `| future: ${skippedFuture.length}`,
    )
  }

  return commands
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

      @keyframes presentationSlideUpCentered {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(20px) scale(0.9);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0) scale(1);
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

      @keyframes presentationTypewriterCursor {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }
    `}</style>
  )
}
