import { useMemo, useRef } from "react"
import type { PresentationCommand, PositionOrTarget, RegionOrTarget, TargetRef } from "../types"
import { useTargetRects, type TargetRectsMap } from "./use-target-rects"

/**
 * Resolves any TargetRef fields in a command to absolute pixel coordinates.
 * Reads positions from the reactive TargetRectsProvider context (no DOM queries).
 * Returns null if any target cannot be resolved (element not found).
 *
 * Stabilizes output reference: only returns a new object when resolved values actually change.
 */
export function useResolvedCommand(command: PresentationCommand): PresentationCommand | null {
  const rects = useTargetRects()
  const prevRef = useRef<PresentationCommand | null>(null)

  const resolved = useMemo(() => resolveCommand(command, rects), [command, rects])

  // Stabilize reference: if resolved values are identical to previous, keep old reference
  // This prevents downstream memo'd components from re-rendering
  if (resolved === null) {
    prevRef.current = null
    return null
  }
  if (prevRef.current !== null && shallowEqualCommand(prevRef.current, resolved)) {
    return prevRef.current
  }
  prevRef.current = resolved
  return resolved
}

/** Shallow comparison of command objects (checks own enumerable keys) */
function shallowEqualCommand(a: PresentationCommand, b: PresentationCommand): boolean {
  if (a.type !== b.type) return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const key of aKeys) {
    const av = (a as any)[key]
    const bv = (b as any)[key]
    if (av === bv) continue
    // Deep check for position/region objects ({x, y} or {x, y, width, height})
    if (typeof av === "object" && av !== null && typeof bv === "object" && bv !== null) {
      if (!shallowEqualObj(av, bv)) return false
    } else {
      return false
    }
  }
  return true
}

function shallowEqualObj(a: Record<string, any>, b: Record<string, any>): boolean {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false
  }
  return true
}

function resolvePositionFromRects(pos: PositionOrTarget, rects: TargetRectsMap): { x: number; y: number } | null {
  if ("x" in pos && "y" in pos) return pos

  const ref = pos as TargetRef
  const rect = rects.get(ref.targetId)
  if (!rect) return null

  // If placement is specified, position OUTSIDE the target's bounding box
  if (ref.placement) {
    const gap = 8
    const ox = ref.offsetX ?? 0
    const oy = ref.offsetY ?? 0
    let x: number
    let y: number

    switch (ref.placement) {
      // --- Above ---
      case "above":
        x = rect.left + rect.width / 2 + ox
        y = rect.top - gap + oy
        break
      case "above-start":
        x = rect.left + ox
        y = rect.top - gap + oy
        break
      case "above-end":
        x = rect.right + ox
        y = rect.top - gap + oy
        break
      // --- Below ---
      case "below":
        x = rect.left + rect.width / 2 + ox
        y = rect.bottom + gap + oy
        break
      case "below-start":
        x = rect.left + ox
        y = rect.bottom + gap + oy
        break
      case "below-end":
        x = rect.right + ox
        y = rect.bottom + gap + oy
        break
      // --- Left ---
      case "left-of":
        x = rect.left - gap + ox
        y = rect.top + rect.height / 2 + oy
        break
      case "left-of-start":
        x = rect.left - gap + ox
        y = rect.top + oy
        break
      case "left-of-end":
        x = rect.left - gap + ox
        y = rect.bottom + oy
        break
      // --- Right ---
      case "right-of":
        x = rect.right + gap + ox
        y = rect.top + rect.height / 2 + oy
        break
      case "right-of-start":
        x = rect.right + gap + ox
        y = rect.top + oy
        break
      case "right-of-end":
        x = rect.right + gap + ox
        y = rect.bottom + oy
        break
    }
    return { x: x!, y: y! }
  }

  // Anchor-based positioning (AT a specific point of the element)
  const anchor = ref.anchor ?? "center"
  let x: number
  let y: number

  switch (anchor) {
    case "center":
      x = rect.left + rect.width / 2; y = rect.top + rect.height / 2; break
    case "top-left":
      x = rect.left; y = rect.top; break
    case "top-right":
      x = rect.right; y = rect.top; break
    case "bottom-left":
      x = rect.left; y = rect.bottom; break
    case "bottom-right":
      x = rect.right; y = rect.bottom; break
    case "top":
      x = rect.left + rect.width / 2; y = rect.top; break
    case "bottom":
      x = rect.left + rect.width / 2; y = rect.bottom; break
    case "left":
      x = rect.left; y = rect.top + rect.height / 2; break
    case "right":
      x = rect.right; y = rect.top + rect.height / 2; break
    default:
      x = rect.left + rect.width / 2; y = rect.top + rect.height / 2
  }

  return { x: x + (ref.offsetX ?? 0), y: y + (ref.offsetY ?? 0) }
}

function resolveRegionFromRects(region: RegionOrTarget, rects: TargetRectsMap): { x: number; y: number; width: number; height: number } | null {
  if ("width" in region && "height" in region) return region

  const ref = region as TargetRef & { padding?: number }
  const rect = rects.get(ref.targetId)
  if (!rect) return null

  const padding = ref.padding ?? 0
  return {
    x: rect.left - padding,
    y: rect.top - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}

export function resolveCommand(cmd: PresentationCommand, rects: TargetRectsMap): PresentationCommand | null {
  switch (cmd.type) {
    case "spotlight": {
      const region = resolveRegionFromRects(cmd.region, rects)
      if (!region) return null
      return { ...cmd, region }
    }
    case "arrow": {
      const from = resolvePositionFromRects(cmd.from, rects)
      const to = resolvePositionFromRects(cmd.to, rects)
      if (!from || !to) return null
      return { ...cmd, from, to }
    }
    case "text": {
      const position = resolvePositionFromRects(cmd.position, rects)
      if (!position) return null
      return { ...cmd, position }
    }
    case "card": {
      const position = resolvePositionFromRects(cmd.position, rects)
      if (!position) return null
      return { ...cmd, position }
    }
    case "badge": {
      const position = resolvePositionFromRects(cmd.position, rects)
      if (!position) return null
      return { ...cmd, position }
    }
    case "progress": {
      const position = resolvePositionFromRects(cmd.position, rects)
      if (!position) return null
      return { ...cmd, position }
    }
    case "counter": {
      const position = resolvePositionFromRects(cmd.position, rects)
      if (!position) return null
      return { ...cmd, position }
    }
    case "typewriter": {
      const position = resolvePositionFromRects(cmd.position, rects)
      if (!position) return null
      return { ...cmd, position }
    }
    case "comparison": {
      const position = resolvePositionFromRects(cmd.position, rects)
      if (!position) return null
      return { ...cmd, position }
    }
    case "circle": {
      const center = resolvePositionFromRects(cmd.center, rects)
      if (!center) return null
      return { ...cmd, center }
    }
    case "pulse": {
      const center = resolvePositionFromRects(cmd.center, rects)
      if (!center) return null
      return { ...cmd, center }
    }
    case "highlight": {
      const region = resolveRegionFromRects(cmd.region, rects)
      if (!region) return null
      return { ...cmd, region }
    }
    case "underline": {
      const from = resolvePositionFromRects(cmd.from, rects)
      const to = resolvePositionFromRects(cmd.to, rects)
      if (!from || !to) return null
      return { ...cmd, from, to }
    }
    case "bracket": {
      const from = resolvePositionFromRects(cmd.from, rects)
      const to = resolvePositionFromRects(cmd.to, rects)
      if (!from || !to) return null
      return { ...cmd, from, to }
    }
    case "chart": {
      const position = resolvePositionFromRects(cmd.position, rects)
      if (!position) return null
      return { ...cmd, position }
    }
    case "trendline": {
      const points: { x: number; y: number }[] = []
      for (const p of cmd.points) {
        const resolved = resolvePositionFromRects(p as PositionOrTarget, rects)
        if (!resolved) return null
        points.push(resolved)
      }
      return { ...cmd, points }
    }
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
    case "confetti":
    case "countdown":
    case "morph":
    case "radar":
    case "sankey":
    case "kpi":
    case "matrix":
    case "annotation-group": {
      const position = resolvePositionFromRects(cmd.position, rects)
      if (!position) return null
      return { ...cmd, position }
    }
    case "reveal":
    case "zoom": {
      const region = resolveRegionFromRects(cmd.region, rects)
      if (!region) return null
      return { ...cmd, region }
    }
    case "clear":
    case "wait":
      return cmd
    default:
      return cmd
  }
}
