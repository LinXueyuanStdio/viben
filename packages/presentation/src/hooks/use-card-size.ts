import { useMemo } from "react"
import { CARD_SIZES, type CardSizeMode } from "../utils/card-sizes"

export interface CardSizeResult {
  width: number
  height: number
  mode: CardSizeMode
}

/**
 * Resolve card dimensions from command fields.
 * Returns null when no sizing info is provided (overlay should use its own defaults).
 *
 * Priority:
 * 1. width + height both present -> use them, infer mode
 * 2. Only width or only height -> use it + mode aspect ratio to fill the other
 * 3. Only cardSize -> look up CARD_SIZES
 * 4. None -> return null (backward compat)
 */
export function useCardSize(command: {
  width?: number
  height?: number
  cardSize?: CardSizeMode
}): CardSizeResult | null {
  const { width, height, cardSize } = command

  return useMemo(() => {
    // Rule 1: both width and height provided
    if (width != null && height != null) {
      return { width, height, mode: inferMode(width * height) }
    }

    // Rule 2: only one dimension + cardSize
    if (width != null && cardSize) {
      const preset = CARD_SIZES[cardSize]
      const aspectRatio = preset.height / preset.width
      return { width, height: Math.round(width * aspectRatio), mode: cardSize }
    }
    if (height != null && cardSize) {
      const preset = CARD_SIZES[cardSize]
      const aspectRatio = preset.width / preset.height
      return { width: Math.round(height * aspectRatio), height, mode: cardSize }
    }

    // Rule 2b: only one dimension, no cardSize -- infer mode from dimension
    if (width != null) {
      const mode = inferMode(width * (width / 1.84))
      const preset = CARD_SIZES[mode]
      const aspectRatio = preset.height / preset.width
      return { width, height: Math.round(width * aspectRatio), mode }
    }
    if (height != null) {
      const mode = inferMode(height * (height * 1.84))
      const preset = CARD_SIZES[mode]
      const aspectRatio = preset.width / preset.height
      return { width: Math.round(height * aspectRatio), height, mode }
    }

    // Rule 3: only cardSize
    if (cardSize) {
      const preset = CARD_SIZES[cardSize]
      return { width: preset.width, height: preset.height, mode: cardSize }
    }

    // Rule 4: nothing provided -- overlay uses its own defaults
    return null
  }, [width, height, cardSize])
}

/** Infer closest mode by comparing area ratios */
function inferMode(area: number): CardSizeMode {
  const smArea = CARD_SIZES.sm.width * CARD_SIZES.sm.height
  const mdArea = CARD_SIZES.md.width * CARD_SIZES.md.height
  const lgArea = CARD_SIZES.lg.width * CARD_SIZES.lg.height

  const smRatio = Math.abs(area / smArea - 1)
  const mdRatio = Math.abs(area / mdArea - 1)
  const lgRatio = Math.abs(area / lgArea - 1)

  if (smRatio <= mdRatio && smRatio <= lgRatio) return "sm"
  if (mdRatio <= lgRatio) return "md"
  return "lg"
}
