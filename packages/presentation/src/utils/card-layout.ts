import type { CardSizeMode } from "./card-sizes"

export interface CardLayout {
  mode: CardSizeMode
  fontSize: {
    /** Title text (sm: 18, md: 22, lg: 32) */
    title: number
    /** Primary value/number (sm: 20, md: 28, lg: 42) */
    value: number
    /** Labels (sm: 16, md: 16, lg: 18) */
    label: number
    /** Axis ticks, secondary text (sm: 14, md: 14, lg: 16) */
    axis: number
    /** Smallest allowed text (sm: 14, md: 14, lg: 16) */
    small: number
  }
  /** Padding inside card container */
  padding: number
  /** Gap between internal elements */
  gap: number
  /** SVG stroke width for chart lines */
  strokeWidth: number
  /** Dot/point radius for charts */
  dotRadius: number
  /** Available content width (width - padding * 2) */
  contentWidth: number
  /** Available content height (height - padding * 2) */
  contentHeight: number
}

const LAYOUT_PRESETS: Record<CardSizeMode, Omit<CardLayout, "contentWidth" | "contentHeight" | "mode">> = {
  sm: {
    fontSize: { title: 18, value: 20, label: 16, axis: 14, small: 14 },
    padding: 12,
    gap: 8,
    strokeWidth: 1.5,
    dotRadius: 3,
  },
  md: {
    fontSize: { title: 22, value: 28, label: 16, axis: 14, small: 14 },
    padding: 16,
    gap: 12,
    strokeWidth: 2,
    dotRadius: 4,
  },
  lg: {
    fontSize: { title: 32, value: 42, label: 18, axis: 16, small: 16 },
    padding: 24,
    gap: 16,
    strokeWidth: 3,
    dotRadius: 6,
  },
}

/**
 * Compute layout parameters for a given card size mode and dimensions.
 * Pure function -- safe for useMemo.
 */
export function getCardLayout(mode: CardSizeMode, width: number, height: number): CardLayout {
  const preset = LAYOUT_PRESETS[mode]
  return {
    ...preset,
    mode,
    contentWidth: width - preset.padding * 2,
    contentHeight: height - preset.padding * 2,
  }
}
