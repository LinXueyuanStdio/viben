import type { CSSProperties, ReactNode } from "react"
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme } from "./theme"
import { clampInterpolate, loopSine } from "./motion"

export interface CameraRigProps {
  children: ReactNode
  orbit?: number
  dolly?: number
  tilt?: number
  roll?: number
  focusBlur?: number
  floating?: number
  style?: CSSProperties
}

export function CameraRig({
  children,
  orbit = 0,
  dolly = 0,
  tilt = 0,
  roll = 0,
  focusBlur = 0,
  floating = 1,
  style,
}: CameraRigProps) {
  const frame = useCurrentFrame()
  const drift = loopSine(frame, 220) * floating
  const yaw = loopSine(frame, 260, 0.8) * orbit
  const lift = loopSine(frame, 190, 1.1) * floating * 6

  return (
    <AbsoluteFill
      style={{
        perspective: 1600,
        transformStyle: "preserve-3d",
        filter: focusBlur > 0 ? `blur(${focusBlur}px)` : undefined,
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transform: [
            `translate3d(${drift * 5}px, ${lift}px, ${dolly}px)`,
            `rotateX(${tilt + drift * 0.08}deg)`,
            `rotateY(${yaw}deg)`,
            `rotateZ(${roll}deg)`,
          ].join(" "),
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  )
}

function NoiseFilterDefs() {
  return (
    <svg width={0} height={0} style={{ position: "absolute" }}>
      <defs>
        {[0, 1, 2, 3, 4].map((seed) => (
          <filter key={seed} id={`cinematic-noise-${seed}`} x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency={0.65 + seed * 0.05} numOctaves={4} seed={seed * 7} result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="mono" />
            <feBlend in="SourceGraphic" in2="mono" mode="overlay" result="blended" />
            <feComposite in="blended" in2="SourceGraphic" operator="in" />
          </filter>
        ))}
      </defs>
    </svg>
  )
}

function VolumetricFog() {
  const frame = useCurrentFrame()
  const driftX = loopSine(frame, 300) * 60
  const driftY = loopSine(frame, 260, 1.2) * 30

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: "10%",
          bottom: "-8%",
          width: "80%",
          height: "45%",
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${cinematicTheme.colors.gold}18 0%, transparent 70%)`,
          filter: "blur(60px)",
          transform: `translate(${driftX}px, ${driftY}px)`,
          opacity: 0.6,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "20%",
          bottom: "-12%",
          width: "60%",
          height: "38%",
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${cinematicTheme.colors.purple}12 0%, transparent 65%)`,
          filter: "blur(50px)",
          transform: `translate(${-driftX * 0.6}px, ${driftY * 0.8}px)`,
          opacity: 0.5,
        }}
      />
    </>
  )
}

export function CinematicStage({ children, intensity = 1 }: { children: ReactNode; intensity?: number }) {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const sweep = clampInterpolate(frame % 240, [40, 180], [-28, 128])

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 42%, rgba(122, 90, 248, ${0.1 * intensity}) 0%, transparent 32%),
          radial-gradient(circle at 22% 70%, rgba(214, 179, 106, ${0.11 * intensity}) 0%, transparent 28%),
          linear-gradient(145deg, #07070A 0%, ${cinematicTheme.colors.black} 48%, #111019 100%)`,
        color: cinematicTheme.colors.coldWhite,
        overflow: "hidden",
        fontFamily: cinematicTheme.font.en,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0, opacity: 0.45 }}
      >
        <defs>
          <linearGradient id="stage-grid" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(214,179,106,0.26)" />
            <stop offset="55%" stopColor="rgba(122,90,248,0.18)" />
            <stop offset="100%" stopColor="rgba(255,61,142,0.13)" />
          </linearGradient>
        </defs>
        {Array.from({ length: 18 }).map((_, i) => {
          const y = height * 0.18 + i * 44
          return <line key={`h-${i}`} x1={120} x2={width - 120} y1={y} y2={y + 70} stroke="url(#stage-grid)" strokeWidth={0.7} opacity={0.15 + i * 0.012} />
        })}
        {Array.from({ length: 22 }).map((_, i) => {
          const x = 90 + i * 84
          return <line key={`v-${i}`} x1={x} x2={x + 240} y1={80} y2={height - 60} stroke="url(#stage-grid)" strokeWidth={0.55} opacity={0.13} />
        })}
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
          backgroundSize: "6px 6px",
          mixBlendMode: "screen",
          opacity: 0.26,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: `${sweep}%`,
          top: "-18%",
          width: 360,
          height: "136%",
          transform: "rotate(18deg)",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.075), transparent)",
          filter: "blur(24px)",
          opacity: 0.55,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: `${clampInterpolate((frame + 90) % 180, [0, 180], [110, -20])}%`,
          top: "-12%",
          width: 120,
          height: "130%",
          transform: "rotate(-14deg)",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.055), transparent)",
          filter: "blur(16px)",
          opacity: 0.45,
        }}
      />

      <FloatingParticles />
      <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 160px rgba(0,0,0,0.86), inset 0 -140px 240px rgba(0,0,0,0.78)" }} />
      <NoiseFilterDefs />
      <VolumetricFog />
      {children}
    </AbsoluteFill>
  )
}

function FloatingParticles() {
  const frame = useCurrentFrame()

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {Array.from({ length: 72 }).map((_, i) => {
        const x = (i * 137) % 1920
        const y = (i * 73) % 1080
        const z = -400 + (i % 13) * 48
        const drift = loopSine(frame, 190 + (i % 7) * 18, i) * (10 + (i % 5) * 3)
        const size = 1 + (i % 4) * 0.7
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: i % 3 === 0 ? cinematicTheme.colors.gold : i % 5 === 0 ? cinematicTheme.colors.purple : "rgba(234,236,239,0.62)",
              boxShadow: `0 0 ${8 + size * 3}px currentColor`,
              color: i % 4 === 0 ? cinematicTheme.colors.purple : i % 7 === 0 ? cinematicTheme.colors.magenta : cinematicTheme.colors.gold,
              opacity: 0.14 + (i % 6) * 0.022,
              transform: `translate3d(${drift}px, ${drift * 0.45}px, ${z}px)`,
            }}
          />
        )
      })}
    </div>
  )
}

