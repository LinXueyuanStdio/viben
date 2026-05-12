import { useMemo } from "react"
import type { PresentationCommand, PositionOrTarget, RegionOrTarget, TargetRef } from "../types"
import { useTargetRects, type TargetRectsMap } from "./use-target-rects"

/**
 * Resolves any TargetRef fields in a command to absolute pixel coordinates.
 * Reads positions from the reactive TargetRectsProvider context (no DOM queries).
 * Returns null if any target cannot be resolved (element not found).
 */
export function useResolvedCommand(command: PresentationCommand): PresentationCommand | null {
  const rects = useTargetRects()

  return useMemo(() => {
    const result = resolveCommand(command, rects)
    if (!result) {
      console.warn(`[ResolvedCommand] FAILED to resolve command type="${command.type}"`, command, "rects.size=", rects.size)
    }
    return result
  }, [command, rects])
}

function resolvePositionFromRects(pos: PositionOrTarget, rects: TargetRectsMap): { x: number; y: number } | null {
  if ("x" in pos && "y" in pos) return pos

  const ref = pos as TargetRef
  const rect = rects.get(ref.targetId)
  if (!rect) {
    console.warn(`[ResolvedCommand] Target "${ref.targetId}" NOT FOUND in rects map. Available keys:`, [...rects.keys()])
    return null
  }
  console.log(`[ResolvedCommand] Resolved target "${ref.targetId}" anchor="${ref.anchor ?? "center"}" placement="${ref.placement ?? "none"}" → rect:`, { left: rect.left, top: rect.top, width: rect.width, height: rect.height })

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
  if (!rect) {
    console.warn(`[ResolvedCommand] Region target "${ref.targetId}" NOT FOUND in rects map. Available keys:`, [...rects.keys()])
    return null
  }
  console.log(`[ResolvedCommand] Resolved region target "${ref.targetId}" padding=${ref.padding ?? 0} → rect:`, { left: rect.left, top: rect.top, width: rect.width, height: rect.height })

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
    case "clear":
    case "wait":
      return cmd
    default:
      return cmd
  }
}
