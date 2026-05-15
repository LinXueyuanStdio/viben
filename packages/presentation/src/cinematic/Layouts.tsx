import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import { clampInterpolate, loopSine, noiseSeed, softSpring, smoothStep, stagger } from "./motion"

// ─── SplitScreen ────────────────────────────────────────────────────────────────

interface SplitPanel {
  title: string
  content?: string
  bullets?: string[]
  color?: string
}

export interface SplitScreenProps {
  left: SplitPanel
  right: SplitPanel
  dividerLabel?: string
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}

export function SplitScreen({
  left,
  right,
  dividerLabel,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 720,
  height = 400,
}: SplitScreenProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const accent = toneColor(tone)
  const leftAccent = left.color ?? accent
  const rightAccent = right.color ?? toneColor(tone === "gold" ? "purple" : "gold")

  const leftEnter = softSpring(frame, fps, delay)
  const rightEnter = softSpring(frame, fps, delay + 6)
  const dividerEnter = softSpring(frame, fps, delay + 12)

  const dividerGlow = loopSine(frame, 90, 0) * 0.3 + 0.7
  const leftDrift = loopSine(frame, 200, 0) * 2
  const rightDrift = loopSine(frame, 200, Math.PI) * 2

  const panelWidth = (width - 24) / 2
  const scanLine = clampInterpolate(frame, [delay + 8, delay + 60], [0, height])

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x - width / 2}px, ${y - height / 2}px, ${z}px)`,
      }}
    >
      {/* Left Panel */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: panelWidth,
          height: "100%",
          opacity: leftEnter,
          transformStyle: "preserve-3d",
          transform: `translate3d(${-(1 - leftEnter) * 80}px, ${leftDrift}px, 0px) rotateY(${2 * leftEnter}deg)`,
          borderRadius: 16,
          padding: "22px 20px",
          background: `linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)), rgba(10,10,15,0.58)`,
          border: `1px solid ${leftAccent}40`,
          boxShadow: `0 24px 70px rgba(0,0,0,0.42), 0 0 28px ${leftAccent}22, inset 0 1px 0 rgba(255,255,255,0.16)`,
          backdropFilter: "blur(18px)",
          overflow: "hidden",
        }}
      >
        {/* Scan line effect */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: scanLine,
            width: "100%",
            height: 1,
            background: `linear-gradient(90deg, transparent, ${leftAccent}40, transparent)`,
            opacity: leftEnter > 0.5 ? 0.6 : 0,
          }}
        />
        {/* Accent border top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "10%",
            width: "80%",
            height: 2,
            background: `linear-gradient(90deg, transparent, ${leftAccent}, transparent)`,
            opacity: leftEnter * 0.7,
          }}
        />
        <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 20, fontWeight: 800, color: leftAccent, letterSpacing: -0.5 }}>
          {left.title}
        </div>
        {left.content && (
          <div style={{ marginTop: 12, fontFamily: cinematicTheme.font.zh, fontSize: 13, lineHeight: 1.7, color: cinematicTheme.colors.muted }}>
            {left.content}
          </div>
        )}
        {left.bullets && left.bullets.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {left.bullets.map((bullet, i) => {
              const bulletEnter = clampInterpolate(frame, [delay + 18 + i * 6, delay + 32 + i * 6], [0, 1])
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    marginTop: i > 0 ? 8 : 0,
                    opacity: bulletEnter,
                    transform: `translateX(${(1 - bulletEnter) * -12}px)`,
                  }}
                >
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: leftAccent, marginTop: 6, flexShrink: 0, boxShadow: `0 0 8px ${leftAccent}60` }} />
                  <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 12, lineHeight: 1.6, color: cinematicTheme.colors.coldWhite }}>{bullet}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Right Panel */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: panelWidth,
          height: "100%",
          opacity: rightEnter,
          transformStyle: "preserve-3d",
          transform: `translate3d(${(1 - rightEnter) * 80}px, ${rightDrift}px, 0px) rotateY(${-2 * rightEnter}deg)`,
          borderRadius: 16,
          padding: "22px 20px",
          background: `linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)), rgba(10,10,15,0.58)`,
          border: `1px solid ${rightAccent}40`,
          boxShadow: `0 24px 70px rgba(0,0,0,0.42), 0 0 28px ${rightAccent}22, inset 0 1px 0 rgba(255,255,255,0.16)`,
          backdropFilter: "blur(18px)",
          overflow: "hidden",
        }}
      >
        {/* Scan line effect */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: scanLine,
            width: "100%",
            height: 1,
            background: `linear-gradient(90deg, transparent, ${rightAccent}40, transparent)`,
            opacity: rightEnter > 0.5 ? 0.6 : 0,
          }}
        />
        {/* Accent border top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "10%",
            width: "80%",
            height: 2,
            background: `linear-gradient(90deg, transparent, ${rightAccent}, transparent)`,
            opacity: rightEnter * 0.7,
          }}
        />
        <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 20, fontWeight: 800, color: rightAccent, letterSpacing: -0.5 }}>
          {right.title}
        </div>
        {right.content && (
          <div style={{ marginTop: 12, fontFamily: cinematicTheme.font.zh, fontSize: 13, lineHeight: 1.7, color: cinematicTheme.colors.muted }}>
            {right.content}
          </div>
        )}
        {right.bullets && right.bullets.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {right.bullets.map((bullet, i) => {
              const bulletEnter = clampInterpolate(frame, [delay + 22 + i * 6, delay + 36 + i * 6], [0, 1])
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    marginTop: i > 0 ? 8 : 0,
                    opacity: bulletEnter,
                    transform: `translateX(${(1 - bulletEnter) * -12}px)`,
                  }}
                >
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: rightAccent, marginTop: 6, flexShrink: 0, boxShadow: `0 0 8px ${rightAccent}60` }} />
                  <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 12, lineHeight: 1.6, color: cinematicTheme.colors.coldWhite }}>{bullet}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Center Divider */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: 2,
          height: "100%",
          marginLeft: -1,
          opacity: dividerEnter,
          background: `linear-gradient(180deg, transparent 5%, ${accent}${Math.round(dividerGlow * 99).toString().padStart(2, "0")} 30%, ${accent} 50%, ${accent}${Math.round(dividerGlow * 99).toString().padStart(2, "0")} 70%, transparent 95%)`,
          boxShadow: `0 0 ${12 * dividerGlow}px ${accent}55, 0 0 ${28 * dividerGlow}px ${accent}22`,
        }}
      />

      {/* Divider Label Badge */}
      {dividerLabel && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) scale(${0.7 + dividerEnter * 0.3})`,
            opacity: dividerEnter,
            padding: "6px 14px",
            borderRadius: 20,
            background: `linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04)), rgba(10,10,15,0.82)`,
            border: `1px solid ${accent}60`,
            boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 ${18 * dividerGlow}px ${accent}33`,
            fontFamily: cinematicTheme.font.en,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.5,
            color: accent,
            textTransform: "uppercase" as const,
          }}
        >
          {dividerLabel}
        </div>
      )}
    </div>
  )
}

// ─── HeroSection ────────────────────────────────────────────────────────────────

export interface HeroSectionProps {
  headline: string
  subheadline?: string
  metric?: { value: number; label: string; prefix?: string; suffix?: string }
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
}

export function HeroSection({
  headline,
  subheadline,
  metric,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 800,
}: HeroSectionProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const accent = toneColor(tone)
  const headlineEnter = softSpring(frame, fps, delay)
  const wipeProgress = clampInterpolate(frame, [delay + 4, delay + 28], [0, 1], cinematicTheme.easing.cinematic)
  const subEnter = softSpring(frame, fps, delay + 16)
  const metricEnter = softSpring(frame, fps, delay + 22)
  const glowPulse = loopSine(frame, 120, 0) * 0.15 + 0.85

  // Animated metric counter
  const metricProgress = metric ? clampInterpolate(frame, [delay + 24, delay + 60], [0, 1]) : 0
  const displayValue = metric ? Math.round(metric.value * smoothStep(metricProgress)) : 0

  // Dot grid positions using noiseSeed
  const dotCount = 40
  const dots = Array.from({ length: dotCount }, (_, i) => ({
    px: noiseSeed(i, 0) * width - width * 0.1,
    py: noiseSeed(i, 1) * 200 - 60,
    size: 1.5 + noiseSeed(i, 2) * 2,
    opacity: noiseSeed(i, 3) * 0.2 + 0.05,
    phase: noiseSeed(i, 4) * Math.PI * 2,
  }))

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x - width / 2}px, ${y - 120}px, ${z}px)`,
      }}
    >
      {/* Background dot grid */}
      <div style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {dots.map((dot, i) => {
          const dotFloat = loopSine(frame, 180 + i * 7, dot.phase) * 3
          const dotEnter = clampInterpolate(frame, [delay + 2 + i * 0.5, delay + 14 + i * 0.5], [0, 1])
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: dot.px,
                top: dot.py + dotFloat,
                width: dot.size,
                height: dot.size,
                borderRadius: "50%",
                background: accent,
                opacity: dot.opacity * dotEnter,
              }}
            />
          )
        })}
      </div>

      {/* Gradient accent line */}
      <div
        style={{
          position: "absolute",
          top: -16,
          left: 0,
          width: width * wipeProgress,
          height: 3,
          background: `linear-gradient(90deg, ${accent}, ${accent}00)`,
          borderRadius: 2,
          boxShadow: `0 0 12px ${accent}55`,
          opacity: headlineEnter,
        }}
      />

      {/* Corner decorations */}
      <div style={{ position: "absolute", top: -24, left: -8, width: 20, height: 20, borderLeft: `2px solid ${accent}55`, borderTop: `2px solid ${accent}55`, opacity: headlineEnter * 0.6 }} />
      <div style={{ position: "absolute", top: -24, right: -8, width: 20, height: 20, borderRight: `2px solid ${accent}55`, borderTop: `2px solid ${accent}55`, opacity: headlineEnter * 0.6 }} />

      {/* Volumetric glow behind headline */}
      <div
        style={{
          position: "absolute",
          top: -20,
          left: "10%",
          width: "50%",
          height: 100,
          background: `radial-gradient(ellipse at center, ${accent}18, transparent 70%)`,
          opacity: glowPulse * headlineEnter,
          filter: "blur(20px)",
          pointerEvents: "none",
        }}
      />

      {/* Headline with clip wipe */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          opacity: headlineEnter,
        }}
      >
        <div
          style={{
            fontFamily: cinematicTheme.font.zh,
            fontSize: 56,
            fontWeight: 900,
            letterSpacing: -2,
            lineHeight: 1.1,
            color: cinematicTheme.colors.coldWhite,
            textShadow: `0 0 40px ${accent}22`,
            clipPath: `inset(0 ${(1 - wipeProgress) * 100}% 0 0)`,
          }}
        >
          {headline}
        </div>
      </div>

      {/* Subheadline */}
      {subheadline && (
        <div
          style={{
            marginTop: 18,
            fontFamily: cinematicTheme.font.zh,
            fontSize: 18,
            fontWeight: 400,
            lineHeight: 1.6,
            color: cinematicTheme.colors.muted,
            opacity: subEnter,
            transform: `translateY(${(1 - subEnter) * 14}px)`,
          }}
        >
          {subheadline}
        </div>
      )}

      {/* Metric counter */}
      {metric && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            opacity: metricEnter,
            transform: `translateX(${(1 - metricEnter) * 30}px)`,
            textAlign: "right",
          }}
        >
          <div
            style={{
              fontFamily: cinematicTheme.font.mono,
              fontSize: 48,
              fontWeight: 800,
              color: accent,
              letterSpacing: -1,
              textShadow: `0 0 32px ${accent}44`,
            }}
          >
            {metric.prefix ?? ""}{displayValue.toLocaleString()}{metric.suffix ?? ""}
          </div>
          <div
            style={{
              marginTop: 4,
              fontFamily: cinematicTheme.font.en,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: 1.5,
              textTransform: "uppercase" as const,
              color: cinematicTheme.colors.dim,
            }}
          >
            {metric.label}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CardCarousel ───────────────────────────────────────────────────────────────

export interface CardCarouselCard {
  title: string
  description?: string
  metric?: string
  color?: string
  icon?: string
}

export interface CardCarouselProps {
  cards: CardCarouselCard[]
  activeIndex?: number
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  cardWidth?: number
  cardHeight?: number
}

export function CardCarousel({
  cards,
  activeIndex = 0,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  cardWidth = 240,
  cardHeight = 160,
}: CardCarouselProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const accent = toneColor(tone)
  const total = cards.length

  // Active card float
  const activeFloat = loopSine(frame, 140, 0) * 4

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px)`,
        perspective: 1200,
      }}
    >
      {cards.map((card, i) => {
        const offset = i - activeIndex
        const isActive = offset === 0

        // Fan angle: spread cards in arc
        const fanAngle = offset * 22
        const fanZ = -Math.abs(offset) * 80
        const fanX = offset * (cardWidth * 0.65)
        const fanScale = isActive ? 1.08 : Math.max(0.72, 1 - Math.abs(offset) * 0.12)
        const fanOpacity = Math.max(0.25, 1 - Math.abs(offset) * 0.25)

        const cardDelay = delay + stagger(i, total, 20)
        const enter = softSpring(frame, fps, cardDelay)

        const cardAccent = card.color ?? accent
        const cardGlow = isActive ? loopSine(frame, 100, 0) * 0.2 + 0.8 : 0.4

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              width: cardWidth,
              height: cardHeight,
              marginLeft: -cardWidth / 2,
              marginTop: -cardHeight / 2,
              transformStyle: "preserve-3d",
              opacity: enter * fanOpacity,
              transform: [
                `translate3d(${fanX}px, ${isActive ? activeFloat : 0}px, ${fanZ - (1 - enter) * 300}px)`,
                `rotateY(${fanAngle * enter}deg)`,
                `scale(${fanScale * (0.8 + enter * 0.2)})`,
              ].join(" "),
              borderRadius: 18,
              padding: "20px 18px",
              background: `linear-gradient(145deg, rgba(255,255,255,${isActive ? 0.14 : 0.08}), rgba(255,255,255,0.03)), rgba(10,10,15,0.58)`,
              border: `1px solid ${cardAccent}${isActive ? "60" : "30"}`,
              boxShadow: isActive
                ? `0 24px 70px rgba(0,0,0,0.42), 0 0 ${38 * cardGlow}px ${cardAccent}33, inset 0 1px 0 rgba(255,255,255,0.16)`
                : `0 12px 36px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)`,
              backdropFilter: "blur(18px)",
              zIndex: isActive ? 10 : 10 - Math.abs(offset),
            }}
          >
            {/* Icon */}
            {card.icon && (
              <div
                style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  fontSize: 22,
                  opacity: 0.8,
                }}
              >
                {card.icon}
              </div>
            )}

            {/* Title */}
            <div
              style={{
                fontFamily: cinematicTheme.font.zh,
                fontSize: 17,
                fontWeight: 800,
                color: isActive ? "#fff" : cinematicTheme.colors.muted,
                letterSpacing: -0.3,
              }}
            >
              {card.title}
            </div>

            {/* Description */}
            {card.description && (
              <div
                style={{
                  marginTop: 8,
                  fontFamily: cinematicTheme.font.zh,
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: cinematicTheme.colors.dim,
                }}
              >
                {card.description}
              </div>
            )}

            {/* Metric */}
            {card.metric && (
              <div
                style={{
                  position: "absolute",
                  bottom: 16,
                  left: 18,
                  fontFamily: cinematicTheme.font.mono,
                  fontSize: 22,
                  fontWeight: 700,
                  color: cardAccent,
                  textShadow: isActive ? `0 0 16px ${cardAccent}44` : "none",
                }}
              >
                {card.metric}
              </div>
            )}

            {/* Active glow indicator */}
            {isActive && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: "15%",
                  width: "70%",
                  height: 2,
                  borderRadius: 1,
                  background: `linear-gradient(90deg, transparent, ${cardAccent}, transparent)`,
                  boxShadow: `0 0 12px ${cardAccent}66`,
                  opacity: cardGlow,
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── MagazineGrid ───────────────────────────────────────────────────────────────

export interface MagazineGridItem {
  title: string
  content?: string
  span?: 1 | 2
  color?: string
  size?: "sm" | "md" | "lg"
}

export interface MagazineGridProps {
  items: MagazineGridItem[]
  columns?: number
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  gap?: number
}

const sizeHeightMap = { sm: 80, md: 140, lg: 200 } as const

export function MagazineGrid({
  items,
  columns = 3,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 680,
  gap = 12,
}: MagazineGridProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const accent = toneColor(tone)

  // Calculate grid layout positions
  const colWidth = (width - gap * (columns - 1)) / columns
  const positions: Array<{ itemIndex: number; col: number; row: number; x: number; y: number; w: number; h: number }> = []
  const colHeights = new Array(columns).fill(0)

  items.forEach((item, idx) => {
    const itemSpan = Math.min(item.span ?? 1, columns)
    const itemHeight = sizeHeightMap[item.size ?? "md"]

    // Find the best column(s) for this item
    let bestCol = 0
    if (itemSpan === 1) {
      bestCol = colHeights.indexOf(Math.min(...colHeights))
    } else {
      // For span=2, find consecutive columns with lowest combined height
      let minH = Infinity
      for (let c = 0; c <= columns - itemSpan; c++) {
        const maxColH = Math.max(...colHeights.slice(c, c + itemSpan))
        if (maxColH < minH) {
          minH = maxColH
          bestCol = c
        }
      }
    }

    const topY = itemSpan === 1
      ? colHeights[bestCol]
      : Math.max(...colHeights.slice(bestCol, bestCol + itemSpan))

    const w = itemSpan * colWidth + (itemSpan - 1) * gap
    const posX = bestCol * (colWidth + gap)

    positions.push({ itemIndex: idx, col: bestCol, row: positions.length, x: posX, y: topY, w, h: itemHeight })

    // Update column heights
    for (let c = bestCol; c < bestCol + itemSpan; c++) {
      colHeights[c] = topY + itemHeight + gap
    }
  })

  const totalHeight = Math.max(...colHeights)

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height: totalHeight,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x - width / 2}px, ${y - totalHeight / 2}px, ${z}px)`,
      }}
    >
      {positions.map((pos) => {
        const item = items[pos.itemIndex]
        const itemAccent = item.color ?? accent
        const itemDelay = delay + stagger(pos.itemIndex, items.length, 30)
        const enter = softSpring(frame, fps, itemDelay)

        // Subtle per-card tilt
        const tiltX = noiseSeed(pos.itemIndex, 10) * 2.4 - 1.2
        const tiltY = noiseSeed(pos.itemIndex, 11) * 2.4 - 1.2
        const drift = loopSine(frame, 180 + pos.itemIndex * 13, pos.itemIndex) * 2

        return (
          <div
            key={pos.itemIndex}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              width: pos.w,
              height: pos.h,
              opacity: enter,
              transformStyle: "preserve-3d",
              transform: `translate3d(0px, ${drift + (1 - enter) * 24}px, ${-(1 - enter) * 60}px) rotateX(${tiltX * enter}deg) rotateY(${tiltY * enter}deg) scale(${0.88 + enter * 0.12})`,
              borderRadius: 14,
              padding: "16px 18px 16px 22px",
              background: `linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)), rgba(10,10,15,0.58)`,
              border: `1px solid ${itemAccent}30`,
              boxShadow: `0 16px 48px rgba(0,0,0,0.36), 0 0 18px ${itemAccent}14, inset 0 1px 0 rgba(255,255,255,0.12)`,
              backdropFilter: "blur(16px)",
              overflow: "hidden",
            }}
          >
            {/* Left accent border */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: "12%",
                width: 3,
                height: "76%",
                borderRadius: 2,
                background: `linear-gradient(180deg, ${itemAccent}, ${itemAccent}44)`,
                boxShadow: `0 0 10px ${itemAccent}44`,
                opacity: enter,
              }}
            />

            {/* Title */}
            <div
              style={{
                fontFamily: cinematicTheme.font.zh,
                fontSize: item.size === "lg" ? 18 : item.size === "sm" ? 13 : 15,
                fontWeight: 700,
                color: cinematicTheme.colors.coldWhite,
                letterSpacing: -0.3,
              }}
            >
              {item.title}
            </div>

            {/* Content */}
            {item.content && (
              <div
                style={{
                  marginTop: 8,
                  fontFamily: cinematicTheme.font.zh,
                  fontSize: 11,
                  lineHeight: 1.65,
                  color: cinematicTheme.colors.dim,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: item.size === "lg" ? 6 : item.size === "sm" ? 2 : 4,
                  WebkitBoxOrient: "vertical" as const,
                }}
              >
                {item.content}
              </div>
            )}

            {/* Corner glow */}
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 60,
                height: 60,
                background: `radial-gradient(circle at top right, ${itemAccent}14, transparent 70%)`,
                pointerEvents: "none",
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
