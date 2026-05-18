export const cinematicTheme = {
  colors: {
    black: "#0B0B0F",
    graphite: "#1A1A22",
    graphite2: "#252530",
    gold: "#D6B36A",
    purple: "#7A5AF8",
    magenta: "#FF3D8E",
    amber: "#F6C453",
    coldWhite: "#EAECEF",
    muted: "rgba(234, 236, 239, 0.62)",
    dim: "rgba(234, 236, 239, 0.34)",
    line: "rgba(214, 179, 106, 0.28)",
    glass: "rgba(16, 16, 24, 0.58)",
  },
  font: {
    zh: "'Source Han Sans SC', 'HarmonyOS Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    en: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "'SF Mono', 'Roboto Mono', 'Menlo', monospace",
  },
  easing: {
    outExpo: [0.16, 1, 0.3, 1] as const,
    inOut: [0.65, 0, 0.35, 1] as const,
    cinematic: [0.22, 1, 0.36, 1] as const,
  },
}

export type CinematicTone = "gold" | "purple" | "magenta" | "amber" | "cold"

export function toneColor(tone: CinematicTone = "gold"): string {
  switch (tone) {
    case "purple":
      return cinematicTheme.colors.purple
    case "magenta":
      return cinematicTheme.colors.magenta
    case "amber":
      return cinematicTheme.colors.amber
    case "cold":
      return cinematicTheme.colors.coldWhite
    case "gold":
      return cinematicTheme.colors.gold
  }
}

export function noiseFilterId(seed: number): string {
  return `cinematic-noise-${seed}`
}

export function volumetricGlow(color: string, radius: number, _opacity: number): string {
  return `radial-gradient(circle, ${color} 0%, transparent ${radius}%)`
}

export function colorMix(color: string, opacity: number): string {
  return `color-mix(in srgb, ${color} ${opacity}%, transparent)`
}

