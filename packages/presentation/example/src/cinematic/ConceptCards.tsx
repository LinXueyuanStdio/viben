import type { CSSProperties } from "react"
import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import { clampInterpolate, loopSine, softSpring } from "./motion"

export interface ConceptCardData {
  id: string
  title: string
  subtitle: string
  eyebrow?: string
  body?: string
  metric?: string
  tone?: CinematicTone
}

export interface CinematicConceptCardProps {
  card: ConceptCardData
  x?: number
  y?: number
  z?: number
  width?: number
  height?: number
  delay?: number
  rotateX?: number
  rotateY?: number
  rotateZ?: number
  scale?: number
  float?: number
  style?: CSSProperties
}

export function CinematicConceptCard({
  card,
  x = 0,
  y = 0,
  z = 0,
  width = 360,
  height = 214,
  delay = 0,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
  scale = 1,
  float = 1,
  style,
}: CinematicConceptCardProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(card.tone)
  const shimmer = clampInterpolate((frame - delay) % 150, [16, 86], [-80, 142])
  const breathe = loopSine(frame, 170, delay * 0.11) * float
  const blur = interpolateBlur(enter)

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        transformStyle: "preserve-3d",
        opacity: enter,
        filter: `blur(${blur}px)`,
        transform: [
          `translate3d(${x - width / 2}px, ${y - height / 2 + breathe * 8}px, ${z - (1 - enter) * 520}px)`,
          `rotateX(${rotateX + (1 - enter) * -18 + breathe * 0.35}deg)`,
          `rotateY(${rotateY + (1 - enter) * 24 + breathe * 0.5}deg)`,
          `rotateZ(${rotateZ + (1 - enter) * -3}deg)`,
          `scale(${scale * (0.82 + enter * 0.18)})`,
        ].join(" "),
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 22,
          padding: 1,
          background: `linear-gradient(145deg, ${accent}88, rgba(255,255,255,0.25) 30%, ${accent}44 60%, rgba(255,255,255,0.15))`,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: 21,
            background: `linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.035) 42%, rgba(255,255,255,0.08)),
              radial-gradient(circle at 15% 0%, ${accent}34, transparent 42%),
              rgba(12, 12, 18, 0.72)`,
            backdropFilter: "blur(26px) saturate(1.35)",
            boxShadow: `0 34px 90px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -40px 100px rgba(0,0,0,0.35), 0 0 42px ${accent}20`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.026) 1px, transparent 1px)",
              backgroundSize: "5px 5px",
              opacity: 0.42,
              mixBlendMode: "screen",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.045,
              mixBlendMode: "overlay" as const,
              filter: `url(#cinematic-noise-${Math.abs(Math.round(x)) % 5})`,
              background: "rgba(255,255,255,0.5)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${shimmer}%`,
              top: -40,
              width: 90,
              height: height + 80,
              transform: "rotate(18deg)",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.24), transparent)",
              filter: "blur(10px)",
              opacity: 0.72,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${clampInterpolate((frame - delay + 40) % 150, [16, 86], [-60, 120])}%`,
              top: -30,
              width: 40,
              height: height + 60,
              transform: "rotate(22deg)",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent)",
              filter: "blur(6px)",
              opacity: 0.5,
            }}
          />
          <CornerLines accent={accent} />
          <div style={{ position: "relative", padding: "24px 26px", height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 11, letterSpacing: 2.1, color: accent, opacity: 0.86 }}>
                {card.eyebrow ?? "CONCEPT LAYER"}
              </div>
              <div style={{ width: 38, height: 2, background: `linear-gradient(90deg, transparent, ${accent})`, boxShadow: `0 0 18px ${accent}` }} />
            </div>
            <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 33, fontWeight: 800, letterSpacing: 0, lineHeight: 1.08, color: cinematicTheme.colors.coldWhite }}>
              {card.title}
            </div>
            <div style={{ marginTop: 8, fontSize: 13, letterSpacing: 1.4, color: "rgba(234,236,239,0.58)", textTransform: "uppercase" }}>
              {card.subtitle}
            </div>
            {card.body && (
              <div style={{ marginTop: 18, fontFamily: cinematicTheme.font.zh, fontSize: 13, lineHeight: 1.7, color: "rgba(234,236,239,0.68)" }}>
                {card.body}
              </div>
            )}
            <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 10, color: "rgba(234,236,239,0.36)" }}>Z-DEPTH / {Math.round(z)}</div>
              {card.metric && <div style={{ fontSize: 25, fontWeight: 800, color: accent, textShadow: `0 0 26px ${accent}66` }}>{card.metric}</div>}
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          inset: 16,
          borderRadius: 22,
          transform: "translateZ(-46px)",
          background: `radial-gradient(circle, ${accent}2A, transparent 58%)`,
          filter: "blur(28px)",
          opacity: 0.8,
        }}
      />
    </div>
  )
}

export function ConceptCardMatrix({ cards, delay = 0 }: { cards: ConceptCardData[]; delay?: number }) {
  const positions = [
    { x: -470, y: -145, z: -60, ry: 12, rx: 3 },
    { x: -78, y: -168, z: 60, ry: 2, rx: 1 },
    { x: 316, y: -120, z: -110, ry: -12, rx: 2 },
    { x: -286, y: 120, z: 110, ry: 9, rx: -2 },
    { x: 124, y: 112, z: -25, ry: -6, rx: -1 },
  ]

  return (
    <>
      {cards.map((card, index) => {
        const p = positions[index % positions.length]
        return (
          <CinematicConceptCard
            key={card.id}
            card={card}
            x={p.x}
            y={p.y}
            z={p.z}
            rotateX={p.rx}
            rotateY={p.ry}
            delay={delay + index * 8}
            width={342}
            height={204}
            scale={index === 1 ? 1.06 : 0.96}
          />
        )
      })}
    </>
  )
}

export function PyramidConceptStack({ cards, delay = 0 }: { cards: ConceptCardData[]; delay?: number }) {
  const layers = [
    { y: 188, w: 840, h: 86, z: -80, tone: "gold" as CinematicTone },
    { y: 84, w: 660, h: 82, z: -20, tone: "amber" as CinematicTone },
    { y: -16, w: 500, h: 78, z: 45, tone: "purple" as CinematicTone },
    { y: -112, w: 330, h: 74, z: 115, tone: "magenta" as CinematicTone },
  ]
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  return (
    <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
      {layers.map((layer, index) => {
        const enter = softSpring(frame, fps, delay + index * 10)
        const accent = toneColor(cards[index]?.tone ?? layer.tone)
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: layer.w,
              height: layer.h,
              marginLeft: -layer.w / 2,
              marginTop: -layer.h / 2,
              borderRadius: 18,
              opacity: enter,
              transformStyle: "preserve-3d",
              transform: `translate3d(0, ${layer.y + (1 - enter) * 100}px, ${layer.z - (1 - enter) * 260}px) rotateX(${62 - index * 3}deg)`,
              background: `linear-gradient(90deg, rgba(255,255,255,0.04), ${accent}20, rgba(255,255,255,0.035))`,
              border: `1px solid ${accent}55`,
              boxShadow: `0 18px 56px rgba(0,0,0,0.38), 0 0 34px ${accent}24, inset 0 1px 0 rgba(255,255,255,0.16)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 32px",
            }}
          >
            <div>
              <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 24, fontWeight: 800, color: "#fff" }}>{cards[index]?.title ?? `Layer ${index + 1}`}</div>
              <div style={{ marginTop: 4, fontSize: 11, letterSpacing: 1.8, color: "rgba(234,236,239,0.52)" }}>{cards[index]?.subtitle ?? "STRUCTURE"}</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: accent }}>{cards[index]?.metric ?? `${(index + 1) * 25}%`}</div>
          </div>
        )
      })}
    </div>
  )
}

function CornerLines({ accent }: { accent: string }) {
  const common: CSSProperties = {
    position: "absolute",
    width: 26,
    height: 26,
    borderColor: accent,
    opacity: 0.72,
    filter: `drop-shadow(0 0 8px ${accent})`,
  }
  return (
    <>
      <div style={{ ...common, left: 13, top: 13, borderLeft: "1px solid", borderTop: "1px solid" }} />
      <div style={{ ...common, right: 13, top: 13, borderRight: "1px solid", borderTop: "1px solid" }} />
      <div style={{ ...common, left: 13, bottom: 13, borderLeft: "1px solid", borderBottom: "1px solid" }} />
      <div style={{ ...common, right: 13, bottom: 13, borderRight: "1px solid", borderBottom: "1px solid" }} />
    </>
  )
}

function interpolateBlur(value: number): number {
  return Math.max(0, (1 - value) * 18)
}

export function FloatingConceptCards({
  cards,
  centerX = 0,
  centerY = 0,
  centerZ = 0,
  radius = 380,
  rotateSpeed = 0.3,
  delay = 0,
}: {
  cards: ConceptCardData[]
  centerX?: number
  centerY?: number
  centerZ?: number
  radius?: number
  rotateSpeed?: number
  delay?: number
}) {
  const frame = useCurrentFrame()
  const count = Math.min(8, cards.length)

  return (
    <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
      {cards.slice(0, count).map((card, i) => {
        const baseAngle = (i / count) * Math.PI * 2
        const angle = baseAngle + (frame * rotateSpeed * Math.PI) / 180
        const x = centerX + Math.cos(angle) * radius
        const y = centerY + Math.sin(angle) * radius * 0.4
        const z = centerZ + Math.sin(angle) * radius * 0.6
        const ry = -(angle * 180) / Math.PI + 90

        return (
          <CinematicConceptCard
            key={card.id}
            card={card}
            x={x}
            y={y}
            z={z}
            rotateY={ry * 0.15}
            delay={delay + i * 6}
            width={300}
            height={180}
            scale={0.85 + (Math.cos(angle) + 1) * 0.08}
            float={0.6}
          />
        )
      })}
    </div>
  )
}

