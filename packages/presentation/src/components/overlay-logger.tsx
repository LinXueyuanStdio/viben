import { useRef, memo } from "react"
import { useCurrentFrame, useVideoConfig } from "remotion"
import type { PresentationStep, PresentationCommand, Point } from "../types"
import { useTargetRects } from "../hooks/use-target-rects"
import { frameToMs, msToFrame } from "../utils/motion"
import { estimateBBox, detectCollisions } from "../utils/collision-detect"

export interface OverlayLoggerProps {
  steps: PresentationStep[]
}

/**
 * OverlayLogger — Dev-only logging component that writes per-second diagnostics.
 *
 * Renders nothing. Isolated from the overlay render tree so its `useCurrentFrame()`
 * does NOT cause overlay components to re-render.
 *
 * Logs to /__collision-log endpoint (picked up by Vite plugin → collision-report.log).
 * Uses requestIdleCallback to avoid blocking frame rendering.
 */
export const OverlayLogger = memo(function OverlayLogger({ steps }: OverlayLoggerProps) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const rects = useTargetRects()
  const lastSecRef = useRef(-1)
  const pendingRef = useRef(false)

  const elapsedMs = frameToMs(frame, fps)
  const sec = Math.floor(elapsedMs / 1000)

  // Only log once per second, skip if already pending
  if (sec !== lastSecRef.current && !pendingRef.current) {
    lastSecRef.current = sec
    pendingRef.current = true

    // Capture values for async callback
    const capturedFrame = frame
    const capturedSteps = steps
    const capturedRects = rects
    const capturedFps = fps
    const capturedDuration = durationInFrames
    const capturedMs = elapsedMs

    // Schedule logging during idle time (won't block frame)
    const schedule = typeof requestIdleCallback !== "undefined" ? requestIdleCallback : setTimeout
    schedule(() => {
      pendingRef.current = false
      const report = buildReport(capturedSteps, capturedFrame, capturedFps, capturedDuration, capturedMs, capturedRects)
      postLog(report)
    })
  }

  return null
})

function buildReport(
  steps: PresentationStep[],
  frame: number,
  fps: number,
  durationInFrames: number,
  elapsedMs: number,
  rects: Map<string, DOMRect>,
): string {
  // Find visible commands at this frame
  const visible: Array<{ id: string; step: PresentationStep }> = []
  for (const step of steps) {
    if (step.command.type === "clear" || step.command.type === "wait") continue
    const startFrame = msToFrame(step.startMs, fps)
    const endFrame = step.endMs != null ? msToFrame(step.endMs, fps) : durationInFrames
    if (frame >= startFrame && frame < endFrame) {
      visible.push({ id: step.id, step })
    }
  }

  const lines: string[] = []
  const ts = `[t=${Math.floor(elapsedMs / 1000)}s]`

  lines.push(`${ts} ${visible.length} elements:`)

  // --- targets section ---
  lines.push("  --- targets ---")
  for (const [targetId, rect] of rects) {
    if (rect.width === 0 && rect.height === 0) {
      lines.push(`  [${targetId}] NOT FOUND`)
    } else {
      lines.push(`  [${targetId}] ${Math.round(rect.width)}x${Math.round(rect.height)} @${Math.round(rect.left)},${Math.round(rect.top)}`)
    }
  }

  // --- overlays section ---
  lines.push("  --- overlays ---")

  // Run collision detection
  const collisionInput = visible.map(v => ({ id: v.id, command: v.step.command }))
  const collisions = detectCollisions(collisionInput)
  const collisionMap = new Map<string, Array<{ otherId: string; pct: number }>>()
  for (const c of collisions) {
    if (!collisionMap.has(c.a.id)) collisionMap.set(c.a.id, [])
    if (!collisionMap.has(c.b.id)) collisionMap.set(c.b.id, [])
    collisionMap.get(c.a.id)!.push({ otherId: c.b.id, pct: c.overlapPct })
    collisionMap.get(c.b.id)!.push({ otherId: c.a.id, pct: c.overlapPct })
  }

  for (const { id, step } of visible) {
    const bbox = estimateBBox(id, step.command)
    const type = step.command.type

    if (!bbox) {
      lines.push(`  ${id} (${type}) — no bbox`)
      continue
    }

    let line = `  ${id} (${type}) ${bbox.width}x${bbox.height} @${Math.round(bbox.x)},${Math.round(bbox.y)}`

    // Collision warnings
    const hits = collisionMap.get(id)
    if (hits && hits.length > 0) {
      line += ` ⚠️ ${hits.map(h => `${h.otherId}(${h.pct}%)`).join(" ")}`
    }

    // Position verification: compare bbox with expected from command
    const expected = getExpectedPosition(step.command)
    if (expected) {
      const dx = Math.abs(bbox.x - expected.x)
      const dy = Math.abs(bbox.y - expected.y)
      if (dx <= 2 && dy <= 2) {
        line += ` ✅ expect@${Math.round(expected.x)},${Math.round(expected.y)}`
      } else {
        line += ` ❌ expect@${Math.round(expected.x)},${Math.round(expected.y)} got@${Math.round(bbox.x)},${Math.round(bbox.y)}`
      }
    }

    lines.push(line)
  }

  return lines.join("\n")
}

function getExpectedPosition(command: PresentationCommand): Point | null {
  switch (command.type) {
    case "text":
    case "card":
    case "badge":
    case "counter":
    case "typewriter":
    case "progress":
    case "comparison":
    case "chart":
    case "gauge":
    case "sparkline":
    case "heatmap":
    case "funnel":
    case "waterfall":
    case "callout":
    case "timeline":
    case "flowchart":
    case "table":
    case "list":
    case "countdown":
    case "morph": {
      const pos = (command as any).position
      if (pos && "x" in pos && "y" in pos) return pos
      return null
    }
    case "circle":
    case "pulse": {
      const center = (command as any).center
      if (center && "x" in center && "y" in center) {
        const r = (command as any).radius ?? 20
        return { x: center.x - r, y: center.y - r }
      }
      return null
    }
    default:
      return null
  }
}

function postLog(report: string): void {
  if (typeof fetch !== "undefined") {
    fetch("/__collision-log", {
      method: "POST",
      body: report + "\n",
      headers: { "Content-Type": "text/plain" },
    }).catch(() => {})
  }
}
