import type { PositionOrTarget, RegionOrTarget, TargetRef } from "../types"

/**
 * Resolves a TargetRef or position literal to absolute pixel coordinates.
 * Queries the DOM for elements with data-presentation-id="<targetId>".
 *
 * Returns the literal position if already absolute ({x, y}).
 * Returns null if the target element is not found in the DOM.
 */
export function resolvePosition(pos: PositionOrTarget): { x: number; y: number } | null {
  if ("x" in pos && "y" in pos) return pos // already absolute

  const ref = pos as TargetRef
  const el = document.querySelector(`[data-presentation-id="${ref.targetId}"]`)
  if (!el) return null

  const rect = el.getBoundingClientRect()
  const anchor = ref.anchor ?? "center"

  let x: number
  let y: number

  switch (anchor) {
    case "center":
      x = rect.left + rect.width / 2
      y = rect.top + rect.height / 2
      break
    case "top-left":
      x = rect.left
      y = rect.top
      break
    case "top-right":
      x = rect.right
      y = rect.top
      break
    case "bottom-left":
      x = rect.left
      y = rect.bottom
      break
    case "bottom-right":
      x = rect.right
      y = rect.bottom
      break
    case "top":
      x = rect.left + rect.width / 2
      y = rect.top
      break
    case "bottom":
      x = rect.left + rect.width / 2
      y = rect.bottom
      break
    case "left":
      x = rect.left
      y = rect.top + rect.height / 2
      break
    case "right":
      x = rect.right
      y = rect.top + rect.height / 2
      break
  }

  return { x: x + (ref.offsetX ?? 0), y: y + (ref.offsetY ?? 0) }
}

/**
 * Resolves a RegionOrTarget to absolute pixel coordinates and dimensions.
 * Queries the DOM for elements with data-presentation-id="<targetId>".
 *
 * Returns the literal region if already absolute ({x, y, width, height}).
 * Returns null if the target element is not found in the DOM.
 * Supports optional padding around the target element's bounding box.
 */
export function resolveRegion(
  region: RegionOrTarget,
): { x: number; y: number; width: number; height: number } | null {
  if ("width" in region && "height" in region) return region // already absolute

  const ref = region as TargetRef & { padding?: number }
  const el = document.querySelector(`[data-presentation-id="${ref.targetId}"]`)
  if (!el) return null

  const rect = el.getBoundingClientRect()
  const padding = ref.padding ?? 0

  return {
    x: rect.left - padding,
    y: rect.top - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}
