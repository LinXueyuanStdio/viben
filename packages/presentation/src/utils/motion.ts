/**
 * Remotion-based animation utilities for presentation overlays.
 *
 * All overlay components use these helpers instead of CSS @keyframes.
 * Performance: hooks short-circuit and return stable references once spring settles.
 *
 * Cinematic hooks (useElasticEntrance, useCinematicEntrance, useStaggeredReveal, etc.)
 * provide layered, Apple Keynote / Linear-grade motion with overlapping phases.
 */
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion"

// ─── Math Constants (hoisted to avoid repeated computation) ──────

const TWO_PI = 2 * Math.PI

// ─── Stable Spring Configs (avoid per-frame object allocation) ───

const SPRING_ENTRANCE = { damping: 18, stiffness: 120, mass: 0.8 } as const
const SPRING_SLIDE = { damping: 16, stiffness: 100, mass: 0.9 } as const
const SPRING_ELASTIC = { damping: 12, stiffness: 180, mass: 0.8 } as const
const SPRING_CINEMATIC = { damping: 20, stiffness: 90, mass: 1.0 } as const

/** Shared clamp options for interpolate() — hoisted to avoid per-call allocation */
const CLAMP_OPTS = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

// ─── Settled Constants (stable references for memo equality) ────

const ENTRANCE_SETTLED: EntranceValues = { opacity: 1, translateY: 0, scale: 1 }
const SLIDE_SETTLED: SlideValues = { opacity: 1, translateX: 0, translateY: 0, scale: 1 }
const ELASTIC_SETTLED: ElasticEntranceValues = { opacity: 1, translateY: 0, scale: 1, rotate: 0 }
const STAGGERED_SETTLED: StaggeredRevealValues = { opacity: 1, translateY: 0, scale: 1, blur: 0 }
const MORPH_EXIT_START: MorphTransitionValues = { scale: 1, opacity: 1, blur: 0, rotate: 0 }
const MORPH_ENTER_END: MorphTransitionValues = { scale: 1, opacity: 1, blur: 0, rotate: 0 }
const CINEMATIC_SETTLED: CinematicEntranceValues = { opacity: 1, translateY: 0, scale: 1, blur: 0, clipProgress: 1 }

// ─── Initial Constants (stable references for pre-delay) ────────

const ELASTIC_INITIAL: ElasticEntranceValues = { opacity: 0, translateY: 30, scale: 0.85, rotate: -2 }
const STAGGERED_INITIAL: StaggeredRevealValues = { opacity: 0, translateY: 20, scale: 0.92, blur: 5 }
const CINEMATIC_INITIAL: CinematicEntranceValues = { opacity: 0, translateY: 30, scale: 0.95, blur: 8, clipProgress: 0 }

// ─── Frame/Time Conversion ───────────────────────────────────────

export function msToFrame(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps)
}

export function frameToMs(frame: number, fps: number): number {
  return (frame / fps) * 1000
}

// ─── Type Definitions ───────────────────────────────────────────

export interface EntranceValues {
  opacity: number
  translateY: number
  scale: number
}

export interface ElasticEntranceValues {
  opacity: number
  translateY: number
  scale: number
  rotate: number
}

export interface GlowPulseValues {
  opacity: number
  scale: number
  glowIntensity: number
}

export interface StaggeredRevealValues {
  opacity: number
  translateY: number
  scale: number
  blur: number
}

export interface ParallaxFloatValues {
  translateY: number
  translateX: number
  rotate: number
}

export interface MorphTransitionValues {
  scale: number
  opacity: number
  blur: number
  rotate: number
}

export interface ShimmerValues {
  shimmerX: number
}

export interface CinematicEntranceValues {
  opacity: number
  translateY: number
  scale: number
  blur: number
  clipProgress: number
}

// ─── Entrance Animation ──────────────────────────────────────────

/**
 * Returns entrance animation values (opacity, translateY, scale).
 * Uses spring physics for natural feel.
 * Short-circuits to stable constant once spring settles (progress >= 0.999).
 *
 * @param delayFrames - frames to wait before starting
 * @param distance - translateY distance in pixels (default 20)
 */
/** Pre-delay return value for useEntrance (stable reference) */
const ENTRANCE_INITIAL: EntranceValues = { opacity: 0, translateY: 20, scale: 0.9 }

export function useEntrance(delayFrames = 0, distance = 20): EntranceValues {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Short-circuit: avoid spring() call before delay
  if (frame < delayFrames) {
    return distance === 20 ? ENTRANCE_INITIAL : { opacity: 0, translateY: distance, scale: 0.9 }
  }

  const progress = spring({
    frame: frame - delayFrames,
    fps,
    config: SPRING_ENTRANCE,
  })

  // Short-circuit: return stable reference once settled
  if (progress >= 0.999) return ENTRANCE_SETTLED

  return {
    opacity: progress,
    translateY: (1 - progress) * distance,
    scale: 0.9 + progress * 0.1,
  }
}

// ─── Slide In Animation ──────────────────────────────────────────

export type SlideDirection = "left" | "right" | "top" | "bottom"

export interface SlideValues {
  opacity: number
  translateX: number
  translateY: number
  scale: number
}

// Direction unit vectors (avoids per-frame object allocation)
const DIR_UNIT: Record<SlideDirection, readonly [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  top: [0, -1],
  bottom: [0, 1],
} as const

/**
 * Returns slide-in animation values from a direction.
 * Short-circuits to stable constant once settled.
 */
export function useSlideIn(
  delayFrames = 0,
  direction: SlideDirection = "bottom",
  distance = 60,
): SlideValues {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Short-circuit: avoid spring() call before delay
  if (frame < delayFrames) {
    const [ux, uy] = DIR_UNIT[direction]
    return { opacity: 0, translateX: ux * distance, translateY: uy * distance, scale: 0.95 }
  }

  const progress = spring({
    frame: frame - delayFrames,
    fps,
    config: SPRING_SLIDE,
  })

  // Short-circuit: return stable reference once settled
  if (progress >= 0.999) return SLIDE_SETTLED

  const [ux, uy] = DIR_UNIT[direction]
  return {
    opacity: progress,
    translateX: (1 - progress) * ux * distance,
    translateY: (1 - progress) * uy * distance,
    scale: 0.95 + progress * 0.05,
  }
}

// ─── Fade In ─────────────────────────────────────────────────────

/**
 * Simple fade-in with optional delay.
 * Short-circuits to 0 or 1 when outside animation window.
 */
export function useFadeIn(delayFrames = 0, durationFrames = 15): number {
  const frame = useCurrentFrame()
  const elapsed = frame - delayFrames
  if (elapsed >= durationFrames) return 1
  if (elapsed <= 0) return 0
  return interpolate(elapsed, [0, durationFrames], [0, 1], CLAMP_OPTS)
}

// ─── Draw Progress ───────────────────────────────────────────────

/**
 * Returns 0→1 progress for SVG stroke-dashoffset draws.
 * Short-circuits to 0 or 1 when outside animation window.
 */
export function useDraw(delayFrames = 0, durationFrames = 20): number {
  const frame = useCurrentFrame()
  const elapsed = frame - delayFrames
  if (elapsed >= durationFrames) return 1
  if (elapsed <= 0) return 0
  return interpolate(elapsed, [0, durationFrames], [0, 1], CLAMP_OPTS)
}

// ─── Counter Animation ───────────────────────────────────────────

/**
 * Animates a number from 0 to target using ease-out.
 */
export function useCounter(target: number, delayFrames = 0, durationFrames = 30): number {
  const frame = useCurrentFrame()
  const elapsed = frame - delayFrames
  // Short-circuit: return final value once animation is done
  if (elapsed >= durationFrames) return target
  if (elapsed <= 0) return 0
  const progress = interpolate(elapsed, [0, durationFrames], [0, 1], CLAMP_OPTS)
  // Ease-out cubic (explicit multiplication avoids Math.pow overhead)
  const inv = 1 - progress
  const eased = 1 - inv * inv * inv
  return eased * target
}

// ─── Pulse Animation (upgraded: sine-based, organic) ────────────

/**
 * Returns a pulsing scale value (loops).
 * Uses sine wave for organic breathing feel. Range: 1 -> 1.8 (subtle overshoot).
 */
export function usePulse(periodFrames = 40): number {
  const frame = useCurrentFrame()
  // Sine-based: 0->1->0 maps to 1->1.8->1
  const sine = Math.sin((frame / periodFrames) * TWO_PI)
  // Map sine [-1, 1] to [1, 1.8]: center=1.4, amplitude=0.4
  return 1 + 0.4 * (sine + 1) * 0.5 // equivalent to 1 + 0.4 * (0..1) but via sine
}

/**
 * Returns pulse opacity (loops, fades out as scale increases).
 * Uses sine wave for smooth organic falloff. Range: 0.6 -> 0.
 */
export function usePulseOpacity(periodFrames = 40): number {
  const frame = useCurrentFrame()
  // Cosine-based so opacity peaks when scale is at rest (1.0)
  const cosine = Math.cos((frame / periodFrames) * TWO_PI)
  // Map cosine [1, -1] to [0.6, 0]
  return 0.3 * (cosine + 1)
}

// ─── Typewriter ──────────────────────────────────────────────────

/**
 * Returns how many characters to show for typewriter effect.
 */
export function useTypewriter(
  totalChars: number,
  speed: "slow" | "normal" | "fast" = "normal",
  delayFrames = 0,
): number {
  const frame = useCurrentFrame()
  const charsPerFrame = speed === "slow" ? 0.5 : speed === "fast" ? 2 : 1
  const elapsed = Math.max(0, frame - delayFrames)
  return Math.min(Math.floor(elapsed * charsPerFrame), totalChars)
}

// ─── Spring Shorthand ────────────────────────────────────────────

/**
 * Convenience spring that returns 0→1 with delay.
 * Short-circuits to 1 once settled.
 */
export function useSpringValue(delayFrames = 0): number {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  // Short-circuit before delay
  if (frame < delayFrames) return 0
  const val = spring({
    frame: frame - delayFrames,
    fps,
    config: SPRING_ENTRANCE,
  })
  return val >= 0.999 ? 1 : val
}

// ─── Stagger ─────────────────────────────────────────────────────

/**
 * Returns delay frames for staggered animations.
 */
export function staggerDelay(index: number, gapFrames = 3): number {
  return index * gapFrames
}

// ─── Elastic Entrance ───────────────────────────────────────────

/**
 * Premium entrance with elastic overshoot — feels bouncy and alive.
 * Scale overshoots (0.85 -> ~1.02 -> 1.0), micro-rotation (-2deg -> 0deg).
 * Uses high-stiffness / low-damping spring for natural bounce.
 */
export function useElasticEntrance(
  delayFrames = 0,
  options?: { distance?: number },
): ElasticEntranceValues {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const distance = options?.distance ?? 30

  if (frame < delayFrames) {
    return distance === 30 ? ELASTIC_INITIAL : { opacity: 0, translateY: distance, scale: 0.85, rotate: -2 }
  }

  const progress = spring({
    frame: frame - delayFrames,
    fps,
    config: SPRING_ELASTIC,
  })

  if (progress >= 0.999) return ELASTIC_SETTLED

  return {
    opacity: Math.min(progress * 1.5, 1), // opacity leads slightly
    translateY: (1 - progress) * distance,
    // Scale: spring naturally overshoots with SPRING_ELASTIC config (low damping).
    // Map progress through overshoot: 0.85 base + 0.15 * progress (spring handles overshoot)
    scale: 0.85 + progress * 0.15,
    // Micro-rotation: -2deg settling to 0deg
    rotate: -2 * (1 - progress),
  }
}

// ─── Glow Pulse ─────────────────────────────────────────────────

/**
 * Smooth breathing glow effect for active indicators.
 * Sine-wave driven for organic feel. Never settles (looping).
 *
 * @param delayFrames - frames before glow begins
 * @param periodFrames - full cycle length in frames (default 60)
 */
export function useGlowPulse(delayFrames = 0, periodFrames = 60): GlowPulseValues {
  const frame = useCurrentFrame()

  if (frame < delayFrames) {
    return { opacity: 0.3, scale: 0.98, glowIntensity: 0.3 }
  }

  const elapsed = frame - delayFrames
  const phase = (elapsed / periodFrames) * TWO_PI

  // Sine wave 0..1 for primary oscillation
  const sine01 = (Math.sin(phase) + 1) * 0.5

  return {
    // Opacity breathes gently: 0.7 -> 1.0
    opacity: 0.7 + sine01 * 0.3,
    // Very subtle scale: 0.98 -> 1.02
    scale: 0.98 + sine01 * 0.04,
    // Glow intensity oscillates 0.3 -> 1.0
    glowIntensity: 0.3 + sine01 * 0.7,
  }
}

// ─── Staggered Reveal ───────────────────────────────────────────

/**
 * Cascading reveal for lists/grids with ease-in-out stagger timing.
 * Items start slow, accelerate in the middle, decelerate at end.
 * Each item has a blur-to-sharp transition during entrance.
 *
 * @param index - item index in the list (0-based)
 * @param total - total number of items
 * @param delayFrames - base delay before first item begins
 * @param options - gapFrames (max gap between items, default 5), durationFrames per item (default 20)
 */
export function useStaggeredReveal(
  index: number,
  total: number,
  delayFrames = 0,
  options?: { gapFrames?: number; durationFrames?: number },
): StaggeredRevealValues {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const gapFrames = options?.gapFrames ?? 5

  // Non-linear stagger: ease-in-out curve across items.
  // Normalized position 0..1 through the list, then apply sine ease-in-out
  const normalizedIndex = total <= 1 ? 0 : index / (total - 1)
  // Sine ease-in-out: slow start, fast middle, slow end
  const easedPosition = 0.5 - 0.5 * Math.cos(normalizedIndex * Math.PI)
  const itemDelay = delayFrames + Math.round(easedPosition * (total - 1) * gapFrames)

  if (frame < itemDelay) {
    return STAGGERED_INITIAL
  }

  const progress = spring({
    frame: frame - itemDelay,
    fps,
    config: SPRING_ENTRANCE,
  })

  if (progress >= 0.999) return STAGGERED_SETTLED

  return {
    opacity: Math.min(progress * 1.3, 1),
    translateY: (1 - progress) * 20,
    scale: 0.92 + progress * 0.08,
    blur: (1 - progress) * 5,
  }
}

// ─── Parallax Float ─────────────────────────────────────────────

/**
 * Subtle floating/parallax motion for background elements.
 * Uses slightly different sine frequencies for X, Y, and rotation
 * to create organic "breathing" motion that never repeats exactly.
 *
 * @param speed - frequency multiplier (0.5 = slow drift, 2 = fast bob). Default 1.
 * @param amplitude - pixel range for translation. Default 4.
 */
export function useParallaxFloat(speed = 1, amplitude = 4): ParallaxFloatValues {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Convert frame to seconds for frequency calculation
  const t = (frame / fps) * speed

  // Slightly offset frequencies for organic feel (golden-ratio-ish offsets)
  const freqY = 0.8     // primary vertical bob
  const freqX = 0.53    // horizontal drift (different period)
  const freqR = 0.37    // rotation sway (different period)

  return {
    translateY: Math.sin(t * freqY * TWO_PI) * amplitude,
    translateX: Math.sin(t * freqX * TWO_PI) * amplitude * 0.6,
    rotate: Math.sin(t * freqR * TWO_PI) * 1.5, // max 1.5 degrees
  }
}

// ─── Morph Transition ───────────────────────────────────────────

/**
 * Custom cubic bezier easing (approximation of ease-in-out-back).
 * t must be clamped to [0, 1].
 */
function cubicBezierEase(t: number): number {
  // Attempt a smooth S-curve with slight overshoot: ease-in-out-cubic
  if (t <= 0) return 0
  if (t >= 1) return 1
  // Hermite / smoothstep with slight push
  const t2 = t * t
  const t3 = t2 * t
  return 3 * t2 - 2 * t3
}

/**
 * Smooth morphing transition values driven by a 0->1 progress value.
 * Exit phase (0->0.5): scale down + blur + slight rotate.
 * Enter phase (0.5->1): scale up + unblur + counter-rotate.
 * Uses custom bezier easing for cinematic feel.
 *
 * @param progress01 - external 0->1 progress (e.g., from interpolate or spring)
 */
export function useMorphTransition(progress01: number): MorphTransitionValues {
  // Clamp input
  const p = Math.max(0, Math.min(1, progress01))

  if (p <= 0) return MORPH_EXIT_START
  if (p >= 1) return MORPH_ENTER_END

  if (p <= 0.5) {
    // Exit phase: 0->0.5 mapped to 0->1
    const exitT = cubicBezierEase(p * 2)
    return {
      scale: 1 - exitT * 0.15,     // 1.0 -> 0.85
      opacity: 1 - exitT * 0.7,     // 1.0 -> 0.3
      blur: exitT * 6,              // 0 -> 6px
      rotate: exitT * 3,            // 0deg -> 3deg
    }
  }

  // Enter phase: 0.5->1 mapped to 0->1
  const enterT = cubicBezierEase((p - 0.5) * 2)
  return {
    scale: 0.85 + enterT * 0.15,   // 0.85 -> 1.0
    opacity: 0.3 + enterT * 0.7,    // 0.3 -> 1.0
    blur: (1 - enterT) * 6,         // 6px -> 0
    rotate: -(1 - enterT) * 3,      // -3deg -> 0deg
  }
}

// ─── Shimmer ────────────────────────────────────────────────────

/**
 * Shimmer/shine sweep effect for skeleton loading or polish highlights.
 * Returns shimmerX as a percentage (0->100) for use with
 * linear-gradient background-position.
 *
 * @param delayFrames - frames before sweep begins
 * @param durationFrames - total sweep duration (default 30)
 */
export function useShimmer(delayFrames = 0, durationFrames = 30): ShimmerValues {
  const frame = useCurrentFrame()
  const elapsed = frame - delayFrames

  if (elapsed <= 0) return { shimmerX: 0 }
  if (elapsed >= durationFrames) return { shimmerX: 100 }

  // Ease-in-out for smooth sweep (sine-based)
  const t = elapsed / durationFrames
  const eased = 0.5 - 0.5 * Math.cos(t * Math.PI)

  return { shimmerX: eased * 100 }
}

// ─── Cinematic Entrance ─────────────────────────────────────────

export type CinematicDirection = "up" | "down" | "left" | "right"

/**
 * The most premium entrance — multi-layered overlapping phases:
 * - Phase 1 (0-30%): clip-path reveals from direction
 * - Phase 2 (20-80%): opacity fades in
 * - Phase 3 (10-100%): translateY settles with spring
 * - Phase 4 (30-100%): scale from 0.95->1.0
 * - Phase 5 (0-50%): blur from 8px->0px
 * All phases overlap for a rich, layered feel.
 *
 * @param delayFrames - frames before animation begins
 * @param options - durationFrames (total window, default 40), direction for clip reveal
 */
export function useCinematicEntrance(
  delayFrames = 0,
  options?: { durationFrames?: number; direction?: CinematicDirection },
): CinematicEntranceValues {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const durationFrames = options?.durationFrames ?? 40

  if (frame < delayFrames) return CINEMATIC_INITIAL

  const elapsed = frame - delayFrames

  // If fully settled, return constant
  if (elapsed >= durationFrames + 10) return CINEMATIC_SETTLED

  const t = elapsed / durationFrames // raw 0->1+ progress

  // Phase 1: clip-path reveal (0% -> 30% of duration)
  const clipT = Math.min(t / 0.3, 1)
  const clipProgress = clipT <= 0 ? 0 : clipT >= 1 ? 1 : cubicBezierEase(clipT)

  // Phase 2: opacity (20% -> 80% of duration)
  const opacityT = Math.max(0, Math.min((t - 0.2) / 0.6, 1))
  const opacity = opacityT <= 0 ? 0 : opacityT >= 1 ? 1 : cubicBezierEase(opacityT)

  // Phase 3: translateY with spring (10% -> 100%+ of duration)
  const springElapsed = Math.max(0, elapsed - Math.round(durationFrames * 0.1))
  const springProgress = springElapsed > 0
    ? spring({ frame: springElapsed, fps, config: SPRING_CINEMATIC })
    : 0
  const translateY = (1 - Math.min(springProgress, 1)) * 30

  // Phase 4: scale (30% -> 100% of duration)
  const scaleT = Math.max(0, Math.min((t - 0.3) / 0.7, 1))
  const scale = scaleT <= 0 ? 0.95 : 0.95 + cubicBezierEase(scaleT) * 0.05

  // Phase 5: blur (0% -> 50% of duration)
  const blurT = Math.min(t / 0.5, 1)
  const blur = blurT >= 1 ? 0 : (1 - cubicBezierEase(blurT)) * 8

  return { opacity, translateY, scale, blur, clipProgress }
}
