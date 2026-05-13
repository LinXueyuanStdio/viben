import { Easing, interpolate, spring } from "remotion"

export function clampInterpolate(
  frame: number,
  input: [number, number],
  output: [number, number],
  easing: readonly [number, number, number, number] = [0.16, 1, 0.3, 1],
): number {
  return interpolate(frame, input, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...easing),
  })
}

export function softSpring(frame: number, fps: number, delay = 0, config?: { damping?: number; stiffness?: number; mass?: number }): number {
  return spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: {
      damping: config?.damping ?? 24,
      stiffness: config?.stiffness ?? 88,
      mass: config?.mass ?? 0.95,
    },
    durationInFrames: 38,
  })
}

export function loopSine(frame: number, period: number, phase = 0): number {
  return Math.sin((frame / period) * Math.PI * 2 + phase)
}

export function formatCompactNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits,
  }).format(value)
}

export function particleTrail(
  frame: number,
  count: number,
  config: { spread: number; speed: number; decay: number; phase?: number },
): Array<{ x: number; y: number; opacity: number; size: number }> {
  const { spread, speed, decay, phase = 0 } = config
  return Array.from({ length: count }, (_, i) => {
    const t = ((frame * speed + phase + i * 17) % 60) / 60
    const angle = (i / count) * Math.PI * 2 + phase
    const dist = t * spread
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      opacity: Math.max(0, (1 - t) * decay),
      size: 1.5 + (1 - t) * 2,
    }
  })
}

export function noiseSeed(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return n - Math.floor(n)
}

export function smoothStep(t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  return clamped * clamped * (3 - 2 * clamped)
}

export function stagger(index: number, total: number, totalDelay: number): number {
  return Math.round((index / Math.max(1, total - 1)) * totalDelay)
}

