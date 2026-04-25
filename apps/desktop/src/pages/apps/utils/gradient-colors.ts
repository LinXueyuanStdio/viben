// Gradient color configurations for dock icons and page app icons

export const GRADIENT_COLORS = {
  green: { from: "#4ade80", to: "#16a34a" },    // green-400 to green-600
  violet: { from: "#a78bfa", to: "#7c3aed" },   // violet-400 to violet-600
  orange: { from: "#fb923c", to: "#ea580c" },   // orange-400 to orange-600
  yellow: { from: "#facc15", to: "#ca8a04" },   // yellow-400 to yellow-600
  cyan: { from: "#22d3ee", to: "#0891b2" },     // cyan-400 to cyan-600
  blue: { from: "#60a5fa", to: "#2563eb" },     // blue-400 to blue-600
  rose: { from: "#fb7185", to: "#e11d48" },     // rose-400 to rose-600
  zinc: { from: "#71717a", to: "#3f3f46" },     // zinc-500 to zinc-700 (darker for visibility)
  sky: { from: "#38bdf8", to: "#0284c7" },      // sky-400 to sky-600
  purple: { from: "#c084fc", to: "#9333ea" },   // purple-400 to purple-600
} as const;

export type GradientColorKey = keyof typeof GRADIENT_COLORS;

/**
 * Get gradient colors for a page based on its name (djb2 hash).
 */
export function getPageGradientColors(name: string): { from: string; to: string } {
  const keys = Object.keys(GRADIENT_COLORS) as GradientColorKey[];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return GRADIENT_COLORS[keys[Math.abs(hash) % keys.length]];
}
