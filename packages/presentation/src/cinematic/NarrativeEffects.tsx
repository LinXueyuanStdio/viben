import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import { clampInterpolate, softSpring, stagger, loopSine } from "./motion"

/* ─────────────────────────────────────────────────────────────────────────────
 * ChapterTitle
 * A cinematic chapter/section title card with reveal animation.
 * ────────────────────────────────────────────────────────────────────────── */

export interface ChapterTitleProps {
  chapter?: string
  title: string
  subtitle?: string
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  align?: "left" | "center"
}

export function ChapterTitle({
  chapter,
  title,
  subtitle,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  align = "left",
}: ChapterTitleProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)
  const enter = softSpring(frame, fps, delay)
  const lineProgress = clampInterpolate(frame, [delay + 8, delay + 42], [0, 1], cinematicTheme.easing.outExpo)
  const titleReveal = clampInterpolate(frame, [delay + 4, delay + 32], [0, 1], cinematicTheme.easing.cinematic)
  const subtitleFade = clampInterpolate(frame, [delay + 22, delay + 44], [0, 1], cinematicTheme.easing.cinematic)
  const verticalLine = clampInterpolate(frame, [delay, delay + 38], [0, 1], cinematicTheme.easing.outExpo)
  const glow = loopSine(frame, 120, delay * 0.13) * 0.3 + 0.7

  const isCenter = align === "center"

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y + (1 - enter) * 40}px, ${z}px)`,
        opacity: enter,
        textAlign: isCenter ? "center" : "left",
      }}
    >
      {/* Chapter number — large semi-transparent background element */}
      {chapter && (
        <div
          style={{
            position: "absolute",
            top: isCenter ? -70 : -50,
            left: isCenter ? "50%" : -10,
            transform: isCenter ? "translateX(-50%)" : "none",
            fontFamily: cinematicTheme.font.en,
            fontSize: 120,
            fontWeight: 900,
            color: accent,
            opacity: 0.12 * enter,
            lineHeight: 1,
            letterSpacing: -4,
            userSelect: "none",
            textShadow: `0 0 ${60 * glow}px ${accent}44`,
          }}
        >
          {chapter}
        </div>
      )}

      {/* Vertical accent line on the left (left-aligned only) */}
      {!isCenter && (
        <div
          style={{
            position: "absolute",
            left: -24,
            top: 0,
            width: 2,
            height: `${verticalLine * 72}px`,
            background: `linear-gradient(180deg, ${accent}, ${accent}00)`,
            boxShadow: `0 0 12px ${accent}66`,
            borderRadius: 1,
          }}
        />
      )}

      {/* Title */}
      <div
        style={{
          position: "relative",
          fontFamily: cinematicTheme.font.zh,
          fontSize: 30,
          fontWeight: 800,
          color: cinematicTheme.colors.coldWhite,
          letterSpacing: 0.5,
          lineHeight: 1.2,
          clipPath: `inset(0 ${(1 - titleReveal) * 100}% 0 0)`,
          textShadow: `0 2px 16px rgba(0,0,0,0.5)`,
        }}
      >
        {title}
      </div>

      {/* Horizontal accent line */}
      <div
        style={{
          marginTop: 12,
          height: 2,
          width: isCenter ? `${lineProgress * 180}px` : `${lineProgress * 260}px`,
          marginLeft: isCenter ? "auto" : 0,
          marginRight: isCenter ? "auto" : 0,
          background: `linear-gradient(90deg, ${accent}, ${accent}88, transparent)`,
          boxShadow: `0 0 ${18 * glow}px ${accent}55`,
          borderRadius: 1,
        }}
      />

      {/* Subtitle */}
      {subtitle && (
        <div
          style={{
            marginTop: 14,
            fontFamily: cinematicTheme.font.zh,
            fontSize: 14,
            fontWeight: 400,
            color: cinematicTheme.colors.muted,
            letterSpacing: 0.8,
            lineHeight: 1.6,
            opacity: subtitleFade,
            transform: `translateY(${(1 - subtitleFade) * 8}px)`,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * FlipCard
 * An animated card that flips to reveal back content.
 * ────────────────────────────────────────────────────────────────────────── */

export interface FlipCardFace {
  title: string
  content?: string
  color?: string
}

export interface FlipCardProps {
  front: FlipCardFace
  back: FlipCardFace
  flipDelay?: number
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}

export function FlipCard({
  front,
  back,
  flipDelay = 45,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 320,
  height = 200,
}: FlipCardProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)
  const enter = softSpring(frame, fps, delay)
  const flipFrame = delay + flipDelay
  const flipProgress = clampInterpolate(frame, [flipFrame, flipFrame + 28], [0, 180], cinematicTheme.easing.inOut)
  const glow = loopSine(frame, 140, delay * 0.17) * 0.25 + 0.75

  const frontColor = front.color || accent
  const backColor = back.color || toneColor(tone === "gold" ? "purple" : tone === "purple" ? "magenta" : "gold")

  const shadowShift = Math.sin((flipProgress / 180) * Math.PI) * 20

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        perspective: 1200,
        opacity: enter,
        transform: `translate3d(${x - width / 2}px, ${y - height / 2 + (1 - enter) * 50}px, ${z}px)`,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transform: `rotateY(${flipProgress}deg)`,
          transition: "none",
        }}
      >
        {/* Front face */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 18,
            backfaceVisibility: "hidden",
            background: `linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)), ${cinematicTheme.colors.glass}`,
            backdropFilter: "blur(18px)",
            border: `1px solid ${frontColor}40`,
            boxShadow: `0 24px 70px rgba(0,0,0,0.42), 0 0 ${38 * glow}px ${frontColor}33, inset 0 1px 0 rgba(255,255,255,0.16), ${shadowShift}px 12px 40px rgba(0,0,0,0.3)`,
            padding: "28px 26px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {/* Scan-line overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              fontFamily: cinematicTheme.font.zh,
              fontSize: 22,
              fontWeight: 800,
              color: cinematicTheme.colors.coldWhite,
              marginBottom: 10,
            }}
          >
            {front.title}
          </div>
          {front.content && (
            <div
              style={{
                fontFamily: cinematicTheme.font.zh,
                fontSize: 13,
                fontWeight: 400,
                lineHeight: 1.7,
                color: cinematicTheme.colors.muted,
              }}
            >
              {front.content}
            </div>
          )}
          {/* Corner accent */}
          <div
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              width: 28,
              height: 28,
              borderTop: `2px solid ${frontColor}`,
              borderRight: `2px solid ${frontColor}`,
              borderRadius: "0 6px 0 0",
              opacity: 0.6,
            }}
          />
        </div>

        {/* Back face */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 18,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: `linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)), ${cinematicTheme.colors.glass}`,
            backdropFilter: "blur(18px)",
            border: `1px solid ${backColor}40`,
            boxShadow: `0 24px 70px rgba(0,0,0,0.42), 0 0 ${38 * glow}px ${backColor}33, inset 0 1px 0 rgba(255,255,255,0.16), ${-shadowShift}px 12px 40px rgba(0,0,0,0.3)`,
            padding: "28px 26px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {/* Scan-line overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px)",
              pointerEvents: "none",
            }}
          />
          {/* Radial glow accent */}
          <div
            style={{
              position: "absolute",
              top: -40,
              right: -40,
              width: 160,
              height: 160,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${backColor}22, transparent 60%)`,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              fontFamily: cinematicTheme.font.zh,
              fontSize: 22,
              fontWeight: 800,
              color: cinematicTheme.colors.coldWhite,
              marginBottom: 10,
            }}
          >
            {back.title}
          </div>
          {back.content && (
            <div
              style={{
                fontFamily: cinematicTheme.font.zh,
                fontSize: 13,
                fontWeight: 400,
                lineHeight: 1.7,
                color: cinematicTheme.colors.muted,
              }}
            >
              {back.content}
            </div>
          )}
          {/* Corner accent */}
          <div
            style={{
              position: "absolute",
              bottom: 14,
              left: 14,
              width: 28,
              height: 28,
              borderBottom: `2px solid ${backColor}`,
              borderLeft: `2px solid ${backColor}`,
              borderRadius: "0 0 0 6px",
              opacity: 0.6,
            }}
          />
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * TerminalBlock
 * A simulated terminal/console output with typing animation.
 * ────────────────────────────────────────────────────────────────────────── */

export interface TerminalLine {
  text: string
  type?: "command" | "output" | "error" | "success" | "comment"
}

export interface TerminalBlockProps {
  lines: TerminalLine[]
  prompt?: string
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}

export function TerminalBlock({
  lines,
  prompt = "$",
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 520,
  height = 300,
}: TerminalBlockProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)
  const enter = softSpring(frame, fps, delay)

  // Each line reveals with typing animation, staggered
  const framesPerLine = 18
  const typingSpeed = 2 // chars per frame

  // Scan-line position
  const scanY = ((frame - delay) % 80) / 80

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x - width / 2}px, ${y - height / 2 + (1 - enter) * 30}px, ${z}px)`,
        opacity: enter,
      }}
    >
      {/* Terminal window */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: 14,
          background: `linear-gradient(180deg, rgba(20,20,28,0.95), rgba(12,12,18,0.98))`,
          border: `1px solid ${accent}30`,
          boxShadow: `0 24px 70px rgba(0,0,0,0.52), 0 0 32px ${accent}18, inset 0 1px 0 rgba(255,255,255,0.08)`,
          overflow: "hidden",
        }}
      >
        {/* Title bar with traffic lights */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "12px 16px",
            gap: 7,
            borderBottom: `1px solid rgba(255,255,255,0.06)`,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#FF5F57", boxShadow: "inset 0 -1px 2px rgba(0,0,0,0.2)" }} />
          <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#FEBC2E", boxShadow: "inset 0 -1px 2px rgba(0,0,0,0.2)" }} />
          <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#28C840", boxShadow: "inset 0 -1px 2px rgba(0,0,0,0.2)" }} />
          <div
            style={{
              marginLeft: "auto",
              fontFamily: cinematicTheme.font.mono,
              fontSize: 10,
              color: cinematicTheme.colors.dim,
              letterSpacing: 1,
            }}
          >
            terminal
          </div>
        </div>

        {/* Terminal content */}
        <div
          style={{
            padding: "14px 18px",
            fontFamily: cinematicTheme.font.mono,
            fontSize: 13,
            lineHeight: 1.8,
            overflowY: "hidden",
            height: height - 50,
          }}
        >
          {lines.map((line, index) => {
            const lineDelay = delay + 10 + index * framesPerLine
            const lineAge = frame - lineDelay
            if (lineAge < 0) return null

            const isCommand = line.type === "command" || (!line.type && index === 0)
            const totalChars = line.text.length
            const visibleChars = isCommand
              ? Math.min(totalChars, Math.floor(lineAge * typingSpeed))
              : totalChars
            const lineComplete = visibleChars >= totalChars
            const lineOpacity = clampInterpolate(frame, [lineDelay, lineDelay + 6], [0, 1])

            let textColor = cinematicTheme.colors.coldWhite
            if (line.type === "error") textColor = "#FF5F57"
            else if (line.type === "success") textColor = "#28C840"
            else if (line.type === "comment") textColor = cinematicTheme.colors.dim
            else if (line.type === "output") textColor = "rgba(234,236,239,0.78)"

            // Cursor blink for the currently typing line
            const showCursor = isCommand && !lineComplete
            const cursorVisible = showCursor && Math.floor((frame - lineDelay) / 8) % 2 === 0

            return (
              <div key={index} style={{ opacity: lineOpacity, display: "flex", alignItems: "center" }}>
                {isCommand && (
                  <span style={{ color: accent, marginRight: 8, fontWeight: 600, textShadow: `0 0 8px ${accent}44` }}>
                    {prompt}
                  </span>
                )}
                <span style={{ color: textColor, textShadow: line.type === "error" ? "0 0 6px rgba(255,95,87,0.4)" : line.type === "success" ? "0 0 6px rgba(40,200,64,0.3)" : "none" }}>
                  {line.text.slice(0, visibleChars)}
                </span>
                {cursorVisible && (
                  <span style={{ color: accent, marginLeft: 1, fontWeight: 700 }}>{"\u2588"}</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Scan-line overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `linear-gradient(180deg, transparent ${scanY * 100 - 2}%, rgba(255,255,255,0.025) ${scanY * 100}%, transparent ${scanY * 100 + 2}%)`,
          }}
        />

        {/* CRT vignette effect */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            borderRadius: 14,
            boxShadow: "inset 0 0 80px rgba(0,0,0,0.5)",
          }}
        />

        {/* Subtle horizontal lines (CRT) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)",
            opacity: 0.4,
          }}
        />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * AnnotatedTimeline
 * A vertical timeline with rich milestone cards and connecting narrative.
 * ────────────────────────────────────────────────────────────────────────── */

export interface TimelineMilestone {
  date: string
  title: string
  description?: string
  highlight?: boolean
  tone?: CinematicTone
}

export interface AnnotatedTimelineProps {
  milestones: TimelineMilestone[]
  x?: number
  y?: number
  z?: number
  delay?: number
  baseTone?: CinematicTone
  width?: number
}

export function AnnotatedTimeline({
  milestones,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  baseTone = "gold",
  width = 480,
}: AnnotatedTimelineProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const baseAccent = toneColor(baseTone)

  const nodeSpacing = 100
  const totalHeight = (milestones.length - 1) * nodeSpacing + 60
  const centerX = width / 2

  // Vertical line draw progress
  const lineDrawProgress = clampInterpolate(
    frame,
    [delay + 6, delay + 6 + milestones.length * 12],
    [0, 1],
    cinematicTheme.easing.cinematic,
  )

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height: totalHeight,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x - width / 2}px, ${y - totalHeight / 2 + (1 - enter) * 40}px, ${z}px)`,
        opacity: enter,
      }}
    >
      {/* SVG center line + connectors */}
      <svg
        width={width}
        height={totalHeight}
        viewBox={`0 0 ${width} ${totalHeight}`}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <defs>
          <linearGradient id="timeline-line-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={baseAccent} stopOpacity={0.9} />
            <stop offset="100%" stopColor={baseAccent} stopOpacity={0.2} />
          </linearGradient>
          <filter id="timeline-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Main vertical line */}
        <line
          x1={centerX}
          y1={30}
          x2={centerX}
          y2={30 + (totalHeight - 60) * lineDrawProgress}
          stroke="url(#timeline-line-grad)"
          strokeWidth={2}
          strokeLinecap="round"
          filter="url(#timeline-glow)"
        />

        {/* Horizontal connector lines to each card */}
        {milestones.map((milestone, index) => {
          const nodeY = 30 + index * nodeSpacing
          const isLeft = index % 2 === 0
          const milestoneDelay = delay + 8 + stagger(index, milestones.length, milestones.length * 10)
          const connectorProgress = clampInterpolate(
            frame,
            [milestoneDelay + 4, milestoneDelay + 18],
            [0, 1],
            cinematicTheme.easing.outExpo,
          )
          const accent = toneColor(milestone.tone ?? baseTone)
          const connectorLength = 60

          const startX = centerX
          const endX = isLeft ? centerX - connectorLength : centerX + connectorLength

          return (
            <line
              key={`connector-${index}`}
              x1={startX}
              y1={nodeY}
              x2={startX + (endX - startX) * connectorProgress}
              y2={nodeY}
              stroke={accent}
              strokeWidth={1.2}
              strokeLinecap="round"
              opacity={connectorProgress * 0.7}
            />
          )
        })}
      </svg>

      {/* Milestone nodes and cards */}
      {milestones.map((milestone, index) => {
        const nodeY = 30 + index * nodeSpacing
        const isLeft = index % 2 === 0
        const milestoneDelay = delay + 8 + stagger(index, milestones.length, milestones.length * 10)
        const nodeEnter = softSpring(frame, fps, milestoneDelay)
        const cardEnter = softSpring(frame, fps, milestoneDelay + 6)
        const accent = toneColor(milestone.tone ?? baseTone)
        const isHighlight = milestone.highlight
        const pulseRing = loopSine(frame, 60, index * 11) * 0.5 + 0.5

        const cardWidth = isHighlight ? 168 : 148
        const connectorLength = 60

        return (
          <div key={index}>
            {/* Node circle */}
            <div
              style={{
                position: "absolute",
                left: centerX - 7,
                top: nodeY - 7,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: accent,
                opacity: nodeEnter,
                transform: `scale(${0.5 + nodeEnter * 0.5})`,
                boxShadow: `0 0 12px ${accent}88, 0 0 24px ${accent}44`,
              }}
            >
              {/* Pulse ring for highlighted */}
              {isHighlight && (
                <div
                  style={{
                    position: "absolute",
                    inset: -6,
                    borderRadius: "50%",
                    border: `2px solid ${accent}`,
                    opacity: (1 - pulseRing) * 0.7 * nodeEnter,
                    transform: `scale(${1 + pulseRing * 0.8})`,
                  }}
                />
              )}
            </div>

            {/* Card */}
            <div
              style={{
                position: "absolute",
                left: isLeft ? centerX - connectorLength - cardWidth - 8 : centerX + connectorLength + 8,
                top: nodeY - (isHighlight ? 32 : 24),
                width: cardWidth,
                opacity: cardEnter,
                transform: `translateX(${(1 - cardEnter) * (isLeft ? 20 : -20)}px)`,
                borderRadius: 12,
                background: `linear-gradient(145deg, rgba(255,255,255,0.09), rgba(255,255,255,0.02)), ${cinematicTheme.colors.glass}`,
                backdropFilter: "blur(14px)",
                border: `1px solid ${accent}${isHighlight ? "55" : "30"}`,
                boxShadow: isHighlight
                  ? `0 16px 50px rgba(0,0,0,0.4), 0 0 28px ${accent}28, inset 0 1px 0 rgba(255,255,255,0.12)`
                  : `0 12px 36px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.1)`,
                padding: isHighlight ? "16px 18px" : "12px 14px",
                overflow: "hidden",
              }}
            >
              {/* Highlight glow */}
              {isHighlight && (
                <div
                  style={{
                    position: "absolute",
                    top: -20,
                    left: -20,
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${accent}20, transparent 60%)`,
                    pointerEvents: "none",
                  }}
                />
              )}
              <div
                style={{
                  fontFamily: cinematicTheme.font.zh,
                  fontSize: isHighlight ? 15 : 13,
                  fontWeight: 800,
                  color: cinematicTheme.colors.coldWhite,
                  marginBottom: 4,
                  lineHeight: 1.3,
                }}
              >
                {milestone.title}
              </div>
              {milestone.description && (
                <div
                  style={{
                    fontFamily: cinematicTheme.font.zh,
                    fontSize: 11,
                    fontWeight: 400,
                    lineHeight: 1.6,
                    color: cinematicTheme.colors.muted,
                  }}
                >
                  {milestone.description}
                </div>
              )}
            </div>

            {/* Date label on opposite side */}
            <div
              style={{
                position: "absolute",
                left: isLeft ? centerX + connectorLength + 8 : centerX - connectorLength - 70,
                top: nodeY - 8,
                width: 62,
                textAlign: isLeft ? "left" : "right",
                fontFamily: cinematicTheme.font.mono,
                fontSize: 10,
                fontWeight: 600,
                color: accent,
                opacity: cardEnter * 0.8,
                letterSpacing: 0.8,
                textShadow: `0 0 8px ${accent}44`,
              }}
            >
              {milestone.date}
            </div>
          </div>
        )
      })}
    </div>
  )
}
