import type { CSSProperties, ReactNode } from "react"
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion"
import { clampInterpolate, loopSine, softSpring } from "./motion"

export interface DollyZoomProps {
  children: ReactNode
  startScale: number
  endScale: number
  startFov: number
  endFov: number
  duration: number
  delay?: number
  style?: CSSProperties
}

export function CinematicDollyZoom({
  children,
  startScale,
  endScale,
  startFov,
  endFov,
  duration,
  delay = 0,
  style,
}: DollyZoomProps) {
  const frame = useCurrentFrame()
  const t = clampInterpolate(frame, [delay, delay + duration], [0, 1])
  const perspective = startFov + (endFov - startFov) * t
  const scale = startScale + (endScale - startScale) * t
  const drift = loopSine(frame, 200) * 3

  return (
    <AbsoluteFill
      style={{
        perspective,
        transformStyle: "preserve-3d",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transform: `scale(${scale}) translate3d(${drift}px, ${drift * 0.4}px, 0)`,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  )
}

export interface FocusPullProps {
  children: ReactNode
  nearBlur: number
  farBlur: number
  pullFrame: number
  duration: number
  delay?: number
}

export function FocusPull({
  children,
  nearBlur,
  pullFrame,
  duration: _duration,
  delay = 0,
}: FocusPullProps) {
  const frame = useCurrentFrame()
  const t = clampInterpolate(frame, [delay, delay + pullFrame], [0, 1])
  const nearB = nearBlur * (1 - t)

  return (
    <AbsoluteFill style={{ perspective: 1400, transformStyle: "preserve-3d" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          filter: `blur(${nearB}px)`,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  )
}

export interface SlowOrbitProps {
  children: ReactNode
  radius: number
  speed: number
  elevation: number
  floating?: number
  delay?: number
}

export function SlowOrbit({
  children,
  radius,
  speed,
  elevation,
  floating = 1,
  delay = 0,
}: SlowOrbitProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const angle = (frame / speed) * 360
  const drift = loopSine(frame, 180) * floating * 4
  const lift = loopSine(frame, 220, 0.7) * floating * 6

  return (
    <AbsoluteFill
      style={{
        perspective: 1600,
        transformStyle: "preserve-3d",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          opacity: enter,
          transform: [
            `rotateX(${elevation + drift * 0.1}deg)`,
            `rotateY(${(angle * radius) / 360}deg)`,
            `translate3d(${drift}px, ${lift}px, 0)`,
          ].join(" "),
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  )
}

export interface ParallaxLayerDef {
  children: ReactNode
  depth: number
  blur?: number
}

export interface ParallaxLayersProps {
  layers: ParallaxLayerDef[]
  moveX?: number
  moveY?: number
  delay?: number
}

export function ParallaxLayers({
  layers,
  moveX = 30,
  moveY = 15,
  delay = 0,
}: ParallaxLayersProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const mx = loopSine(frame, 240) * moveX
  const my = loopSine(frame, 280, 0.6) * moveY

  return (
    <AbsoluteFill style={{ perspective: 1200, transformStyle: "preserve-3d" }}>
      {layers.map((layer, i) => {
        const parallax = 1 - layer.depth
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              transformStyle: "preserve-3d",
              opacity: enter,
              transform: `translate3d(${mx * parallax}px, ${my * parallax}px, ${-layer.depth * 300}px)`,
              filter: layer.blur ? `blur(${layer.blur * layer.depth}px)` : undefined,
            }}
          >
            {layer.children}
          </div>
        )
      })}
    </AbsoluteFill>
  )
}
