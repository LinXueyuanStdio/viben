import type { PresentationCommand, Point } from "../types"

/**
 * Estimated bounding box for a rendered overlay command.
 */
export interface OverlayBBox {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
}

/**
 * Collision report entry — two overlapping overlays.
 */
export interface Collision {
  a: OverlayBBox
  b: OverlayBBox
  overlapArea: number
  overlapPct: number // percentage of smaller element occluded
}

/**
 * Viewport boundary violation report.
 */
export interface BoundaryViolation {
  bbox: OverlayBBox
  issue: "off-top" | "off-bottom" | "off-left" | "off-right"
  overflow: number // how many px outside
}

/**
 * Estimate the bounding box of a resolved command.
 * All position fields must already be resolved to {x, y} (not TargetRef).
 */
export function estimateBBox(id: string, command: PresentationCommand): OverlayBBox | null {
  switch (command.type) {
    case "text": {
      const pos = command.position as Point
      const fontSize = command.fontSize ?? 14
      const charWidth = fontSize * 0.55
      const contentWidth = Math.min(command.content.length * charWidth, 500)
      const padding = 16 // horizontal padding
      const width = contentWidth + padding * 2
      const height = fontSize + 16 // vertical padding
      const isCentered = command.textAlign === "center"
      return {
        id, type: "text",
        x: isCentered ? pos.x - width / 2 : pos.x,
        y: pos.y,
        width,
        height,
      }
    }
    case "card": {
      const pos = command.position as Point
      const width = command.width ?? 280
      // Estimate: title(20) + content lines(lineCount * 20) + padding(24+12) + tag(20)
      const lineCount = (command.content?.split("\n").length ?? 1)
      const height = 24 + 20 + lineCount * 20 + 12 + (command.tag ? 20 : 0)
      return { id, type: "card", x: pos.x, y: pos.y, width, height }
    }
    case "badge": {
      const pos = command.position as Point
      const sizeMap = { sm: 22, md: 28, lg: 34 }
      const height = sizeMap[command.size ?? "md"]
      const charWidth = height * 0.45
      const width = command.text.length * charWidth + 16
      return { id, type: "badge", x: pos.x, y: pos.y - height, width, height }
    }
    case "counter": {
      const pos = command.position as Point
      const fontSize = command.fontSize ?? 32
      const text = `${command.prefix ?? ""}${command.value}${command.suffix ?? ""}`
      const width = text.length * fontSize * 0.6 + 8
      const height = fontSize + 8
      return { id, type: "counter", x: pos.x, y: pos.y, width, height }
    }
    case "typewriter": {
      const pos = command.position as Point
      const fontSize = command.fontSize ?? 14
      const charWidth = fontSize * 0.55
      const width = Math.min(command.content.length * charWidth + 32, 600)
      const height = fontSize + 16
      return { id, type: "typewriter", x: pos.x, y: pos.y, width, height }
    }
    case "progress": {
      const pos = command.position as Point
      const width = command.width ?? 200
      const height = 24
      return { id, type: "progress", x: pos.x, y: pos.y, width, height }
    }
    case "comparison": {
      const pos = command.position as Point
      const width = command.width
      const height = 80
      return { id, type: "comparison", x: pos.x, y: pos.y, width, height }
    }
    case "chart": {
      const pos = command.position as Point
      const width = command.width ?? 360
      const height = (command.height ?? 200) + 40 // extra for title + padding
      return { id, type: "chart", x: pos.x, y: pos.y, width, height }
    }
    case "highlight": {
      const region = command.region as { x: number; y: number; width: number; height: number }
      return { id, type: "highlight", x: region.x, y: region.y, width: region.width, height: region.height }
    }
    case "spotlight": {
      // Spotlight is a full-screen mask, doesn't collide in the same way
      return null
    }
    case "pulse": {
      const center = command.center as Point
      const r = command.radius ?? 20
      return { id, type: "pulse", x: center.x - r, y: center.y - r, width: r * 2, height: r * 2 }
    }
    case "circle": {
      const center = command.center as Point
      const r = command.radius
      return { id, type: "circle", x: center.x - r, y: center.y - r, width: r * 2, height: r * 2 }
    }
    case "arrow":
    case "underline":
    case "bracket":
    case "trendline":
      // Line-based elements — skip collision for now (thin, decorative)
      return null
    case "clear":
    case "wait":
      return null
  }
}

/**
 * Check if two bounding boxes overlap. Returns overlap area (0 = no overlap).
 */
function getOverlapArea(a: OverlayBBox, b: OverlayBBox): number {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return xOverlap * yOverlap
}

/**
 * Detect all pairwise collisions among visible overlay commands.
 */
export function detectCollisions(
  commands: Array<{ id: string; command: PresentationCommand }>,
): Collision[] {
  const boxes: OverlayBBox[] = []
  for (const { id, command } of commands) {
    const bbox = estimateBBox(id, command)
    if (bbox) boxes.push(bbox)
  }

  const collisions: Collision[] = []
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const area = getOverlapArea(boxes[i], boxes[j])
      if (area > 0) {
        const smallerArea = Math.min(
          boxes[i].width * boxes[i].height,
          boxes[j].width * boxes[j].height,
        )
        collisions.push({
          a: boxes[i],
          b: boxes[j],
          overlapArea: area,
          overlapPct: Math.round((area / smallerArea) * 100),
        })
      }
    }
  }
  return collisions
}

/**
 * Detect elements that overflow viewport boundaries.
 * @param safeBottom - maximum Y before control panels (default: window.innerHeight - 340)
 */
export function detectBoundaryViolations(
  commands: Array<{ id: string; command: PresentationCommand }>,
  viewportWidth?: number,
  safeBottom?: number,
): BoundaryViolation[] {
  const vw = viewportWidth ?? (typeof window !== "undefined" ? window.innerWidth : 1024)
  const sb = safeBottom ?? (typeof window !== "undefined" ? window.innerHeight - 340 : 428)

  const violations: BoundaryViolation[] = []
  for (const { id, command } of commands) {
    const bbox = estimateBBox(id, command)
    if (!bbox) continue

    if (bbox.y < 0) {
      violations.push({ bbox, issue: "off-top", overflow: -bbox.y })
    }
    if (bbox.y + bbox.height > sb) {
      violations.push({ bbox, issue: "off-bottom", overflow: bbox.y + bbox.height - sb })
    }
    if (bbox.x < 0) {
      violations.push({ bbox, issue: "off-left", overflow: -bbox.x })
    }
    if (bbox.x + bbox.width > vw) {
      violations.push({ bbox, issue: "off-right", overflow: bbox.x + bbox.width - vw })
    }
  }
  return violations
}

/**
 * Log collision and boundary analysis for the current visible commands.
 * Writes to local file via Vite dev server endpoint (/__collision-log).
 * Call this inside the overlay render loop (throttled to avoid spam).
 */
export function logCollisionReport(
  commands: Array<{ id: string; command: PresentationCommand }>,
  elapsedMs: number,
): void {
  const collisions = detectCollisions(commands)
  const violations = detectBoundaryViolations(commands)

  if (collisions.length === 0 && violations.length === 0) return

  const logKey = Math.floor(elapsedMs / 1000) // log at most once per second
  if ((globalThis as any).__lastCollisionLogKey === logKey) return
  ;(globalThis as any).__lastCollisionLogKey = logKey

  const lines: string[] = []
  const ts = `t=${(elapsedMs / 1000).toFixed(1)}s`

  if (collisions.length > 0) {
    lines.push(`[Collision] ${ts} — ${collisions.length} overlaps`)
    for (const c of collisions) {
      lines.push(
        `  ⚠️ "${c.a.id}" (${c.a.type} ${c.a.width}x${c.a.height} @${c.a.x},${c.a.y})` +
        ` ↔ "${c.b.id}" (${c.b.type} ${c.b.width}x${c.b.height} @${c.b.x},${c.b.y})` +
        ` | overlap: ${c.overlapArea}px² (${c.overlapPct}%)`,
      )
    }
  }

  if (violations.length > 0) {
    lines.push(`[Boundary] ${ts} — ${violations.length} violations`)
    for (const v of violations) {
      const icon = v.issue === "off-top" ? "⬆️" : v.issue === "off-bottom" ? "⬇️" : v.issue === "off-left" ? "⬅️" : "➡️"
      lines.push(
        `  ${icon} "${v.bbox.id}" (${v.bbox.type} ${v.bbox.width}x${v.bbox.height} @${v.bbox.x},${v.bbox.y})` +
        ` → ${v.issue} by ${v.overflow}px`,
      )
    }
  }

  const report = lines.join("\n")

  // Write to local file via dev server
  if (typeof fetch !== "undefined") {
    fetch("/__collision-log", {
      method: "POST",
      body: report,
      headers: { "Content-Type": "text/plain" },
    }).catch(() => {/* ignore in production */})
  }
}
