/** Reference viewport for card size calculations */
export const REFERENCE_VIEWPORT = { width: 1920, height: 1080 } as const

/** Page margin (px) surrounding all cards */
export const PAGE_MARGIN = 32

/** Gap between adjacent cards (px) */
export const CARD_GAP = 16

/** Standard card size modes */
export type CardSizeMode = "sm" | "md" | "lg"

/**
 * Preset card dimensions for each mode.
 * Derived from: (available - gap * (n-1)) / n
 * Available = REFERENCE_VIEWPORT - PAGE_MARGIN * 2
 */
export const CARD_SIZES: Record<CardSizeMode, { width: number; height: number }> = {
  sm: { width: 608, height: 328 },
  md: { width: 920, height: 500 },
  lg: { width: 1856, height: 1016 },
} as const
