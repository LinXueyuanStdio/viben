import { useMemo, useRef, useEffect } from "react"
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion"
import type { ConfettiCommand, Point } from "../types"

interface ConfettiProps {
  command: ConfettiCommand
}

const DEFAULT_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"]

// Secondary gradient color for each primary color (slightly shifted hue)
const GRADIENT_PAIRS: Record<string, string> = {
  "#FF6B6B": "#FF9A9E",
  "#4ECDC4": "#44E0D2",
  "#45B7D1": "#67D5E8",
  "#96CEB4": "#B8E6CC",
  "#FFEAA7": "#FFD56B",
  "#DDA0DD": "#E8C0E8",
}

function createRng(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotationSpeed: number
  color: string
  colorEnd: string
  size: number
  shape: "rect" | "circle"
  depth: number // 0 = close, 1 = far (controls blur + size scaling)
}

/**
 * Confetti overlay -- Canvas-based particle burst with physics simulation.
 * Renders all particles on a single <canvas> element driven by useCurrentFrame().
 * Premium visual: gradient fills, depth-based blur, motion trails, radial vignette at burst origin.
 */
export function Confetti({ command }: ConfettiProps) {
  const {
    position: _position,
    count = 50,
    spread = 200,
    colors = DEFAULT_COLORS,
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps, width: compWidth, height: compHeight } = useVideoConfig()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const lifetimeFrames = fps * 3

  // Pre-compute particles once (stable across frames)
  const particles = useMemo((): Particle[] => {
    const rng = createRng(42)
    return Array.from({ length: count }, (_, i) => {
      const angle = rng() * Math.PI * 2
      const speed = rng() * spread * 0.06 + spread * 0.02
      const color = colors[i % colors.length]
      const depth = rng() // 0 = close, 1 = far away
      return {
        x: position.x,
        y: position.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (rng() * 4 + 2),
        rotation: rng() * 360,
        rotationSpeed: (rng() - 0.5) * 15,
        color,
        colorEnd: GRADIENT_PAIRS[color] || color,
        size: (rng() * 8 + 4) * (1 - depth * 0.4), // far particles are smaller
        shape: rng() > 0.5 ? "rect" : "circle",
        depth,
      }
    })
  }, [position.x, position.y, count, spread, colors])

  // Draw particles on canvas each frame
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    if (frame > lifetimeFrames) return

    const gravity = 0.15
    const fadeStart = lifetimeFrames * 0.6
    const globalOpacity = frame > fadeStart
      ? interpolate(frame, [fadeStart, lifetimeFrames], [1, 0], { extrapolateRight: "clamp" })
      : 1

    // -- Radial vignette glow at burst origin --
    if (frame < lifetimeFrames * 0.5) {
      const vignetteOpacity = globalOpacity * interpolate(frame, [0, lifetimeFrames * 0.5], [0.35, 0], { extrapolateRight: "clamp" })
      const vignetteGrad = ctx.createRadialGradient(position.x, position.y, 0, position.x, position.y, spread * 1.2)
      vignetteGrad.addColorStop(0, `rgba(255, 255, 255, ${vignetteOpacity * 0.15})`)
      vignetteGrad.addColorStop(0.3, `rgba(255, 200, 150, ${vignetteOpacity * 0.08})`)
      vignetteGrad.addColorStop(1, "rgba(0, 0, 0, 0)")
      ctx.fillStyle = vignetteGrad
      ctx.fillRect(0, 0, w, h)
    }

    for (const p of particles) {
      const px = p.x + p.vx * frame
      const py = p.y + p.vy * frame + 0.5 * gravity * frame * frame
      const rot = ((p.rotation + p.rotationSpeed * frame) * Math.PI) / 180

      // -- Motion trail: draw previous positions at lower opacity --
      const trailSteps = 3
      for (let t = trailSteps; t >= 0; t--) {
        const trailFrame = Math.max(0, frame - t * 2)
        const tpx = p.x + p.vx * trailFrame
        const tpy = p.y + p.vy * trailFrame + 0.5 * gravity * trailFrame * trailFrame
        const trot = ((p.rotation + p.rotationSpeed * trailFrame) * Math.PI) / 180

        const isMain = t === 0
        const trailOpacity = isMain ? globalOpacity : globalOpacity * (0.12 - t * 0.03)

        ctx.save()
        ctx.globalAlpha = trailOpacity
        ctx.translate(tpx, tpy)
        ctx.rotate(trot)

        // -- Depth-based blur: far particles get subtle blur --
        if (!isMain && p.depth > 0.5) {
          ctx.filter = `blur(${Math.round(p.depth * 1.5)}px)`
        } else if (isMain && p.depth > 0.6) {
          ctx.filter = `blur(${Math.round((p.depth - 0.6) * 2)}px)`
        }

        // -- Gradient fill per particle --
        if (p.shape === "circle") {
          const r = p.size / 2
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
          grad.addColorStop(0, p.colorEnd)
          grad.addColorStop(1, p.color)
          ctx.fillStyle = isMain ? grad : p.color
          ctx.beginPath()
          ctx.arc(0, 0, r, 0, Math.PI * 2)
          ctx.fill()
        } else {
          const hw = p.size / 2
          const hh = (p.size * 0.6) / 2
          if (isMain) {
            const grad = ctx.createLinearGradient(-hw, -hh, hw, hh)
            grad.addColorStop(0, p.color)
            grad.addColorStop(1, p.colorEnd)
            ctx.fillStyle = grad
          } else {
            ctx.fillStyle = p.color
          }
          ctx.fillRect(-hw, -hh, p.size, p.size * 0.6)
        }

        ctx.filter = "none"
        ctx.restore()
      }
    }
  }, [frame, particles, lifetimeFrames, position.x, position.y, spread])

  if (frame > lifetimeFrames) return null

  return (
    <canvas
      ref={canvasRef}
      width={compWidth}
      height={compHeight}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  )
}
