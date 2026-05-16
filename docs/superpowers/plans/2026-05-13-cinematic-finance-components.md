# Cinematic Finance Component System - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增强 Remotion cinematic 金融视频组件系统，达到电影级视觉标准

**Architecture:** 增强现有 6 个文件 + 新增 2 个文件（Camera.tsx, Infographics.tsx），所有组件使用 CSS 3D transform + SVG，纯数学驱动粒子/动画，无外部依赖。

**Tech Stack:** React, TypeScript, Remotion 4.x, CSS 3D Transforms, SVG filters

**Verification:** 由于是纯视觉组件，使用 `pnpm remotion:still` 渲染静帧验证（无 unit test）。开发时使用 `pnpm remotion:studio` 预览。

**Base Path:** `packages/presentation/example/src/cinematic/`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `theme.ts` | Modify | +noiseFilterId, +volumetricGlow, +colorMix |
| `motion.ts` | Modify | +particleTrail, +noiseSeed, +smoothStep, +stagger |
| `CinematicStage.tsx` | Modify | +VolumetricFog, +NoiseFilterDefs, particles 72 |
| `Camera.tsx` | Create | DollyZoom, FocusPull, SlowOrbit, ParallaxLayers |
| `ConceptCards.tsx` | Modify | +noise texture, +metal border, +FloatingConceptCards |
| `CinematicCharts.tsx` | Modify | +particle trails, +CandlestickChart, +WorldMapHeatmap, +TimelineChart |
| `Structures.tsx` | Modify | +particle flow edges, +TreeStructure, +RadialStructure, +TimelineStructure |
| `DataHud.tsx` | Modify | +scan lines, +RealtimeTicker, +RankingList, +StatDashboard |
| `Infographics.tsx` | Create | PyramidInfoScene, CausalChainScene, CapitalFlowDiagram, LayeredExplanation |
| `CinematicFinanceShowcase.tsx` | Modify | 7 sequences, 900 frames, advanced camera |
| `index.ts` | Modify | Export all new components |

---

### Task 1: Foundation — theme.ts + motion.ts

**Files:**
- Modify: `packages/presentation/example/src/cinematic/theme.ts`
- Modify: `packages/presentation/example/src/cinematic/motion.ts`

- [ ] **Step 1: Add helpers to theme.ts**

Append after the existing `toneColor` function:

```typescript
let noiseCounter = 0
export function noiseFilterId(seed: number): string {
  return `cinematic-noise-${seed}`
}

export function volumetricGlow(color: string, radius: number, opacity: number): string {
  return `radial-gradient(circle, ${color} 0%, transparent ${radius}%)`
}

export function colorMix(color: string, opacity: number): string {
  return `color-mix(in srgb, ${color} ${opacity}%, transparent)`
}
```

- [ ] **Step 2: Add particle and utility functions to motion.ts**

Append after the existing `formatCompactNumber` function:

```typescript
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
```

- [ ] **Step 3: Verify compilation**

Run: `cd packages/presentation/example && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/presentation/example/src/cinematic/theme.ts packages/presentation/example/src/cinematic/motion.ts
git commit -m "feat(cinematic): add foundation helpers — noise, particles, stagger"
```

---

### Task 2: CinematicStage Enhancement

**Files:**
- Modify: `packages/presentation/example/src/cinematic/CinematicStage.tsx`

- [ ] **Step 1: Add NoiseFilterDefs component**

Add before the `CinematicStage` function:

```typescript
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
```

- [ ] **Step 2: Add VolumetricFog component**

Add after `NoiseFilterDefs`:

```typescript
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
```

- [ ] **Step 3: Enhance FloatingParticles count and depth**

Replace the existing `FloatingParticles` function body. Change `Array.from({ length: 46 })` to `Array.from({ length: 72 })` and update the z range:

```typescript
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
```

- [ ] **Step 4: Add second light sweep + integrate VolumetricFog and NoiseFilterDefs**

In the `CinematicStage` component, add a second sweep div after the existing one, and add `<NoiseFilterDefs />` and `<VolumetricFog />` before `{children}`:

```typescript
// After the existing sweep div, add:
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
```

In the return JSX of `CinematicStage`, before `{children}`, insert:
```typescript
<NoiseFilterDefs />
<VolumetricFog />
```

- [ ] **Step 5: Verify renders**

Run: `cd packages/presentation/example && npx remotion still src/remotion-entry.tsx CinematicFinanceShowcase --frame=45 --scale=0.25 --output=test-stage.png`
Expected: PNG output with enhanced particles and fog visible

- [ ] **Step 6: Commit**

```bash
git add packages/presentation/example/src/cinematic/CinematicStage.tsx
git commit -m "feat(cinematic): enhance stage — volumetric fog, noise defs, 72 particles"
```

---

### Task 3: Camera.tsx — Advanced Camera Presets

**Files:**
- Create: `packages/presentation/example/src/cinematic/Camera.tsx`

- [ ] **Step 1: Create Camera.tsx with all 4 camera presets**

```typescript
import type { CSSProperties, ReactNode } from "react"
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion"
import { clampInterpolate, loopSine, softSpring } from "./motion"
import { cinematicTheme } from "./theme"

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
  farBlur,
  pullFrame,
  duration,
  delay = 0,
}: FocusPullProps) {
  const frame = useCurrentFrame()
  const t = clampInterpolate(frame, [delay, delay + pullFrame], [0, 1])
  const nearB = nearBlur * (1 - t)
  const farB = farBlur * t

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
```

- [ ] **Step 2: Verify compilation**

Run: `cd packages/presentation/example && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/presentation/example/src/cinematic/Camera.tsx
git commit -m "feat(cinematic): add Camera.tsx — DollyZoom, FocusPull, SlowOrbit, ParallaxLayers"
```

---

### Task 4: ConceptCards Enhancement + FloatingConceptCards

**Files:**
- Modify: `packages/presentation/example/src/cinematic/ConceptCards.tsx`

- [ ] **Step 1: Enhance CinematicConceptCard — add noise texture layer**

In the `CinematicConceptCard` component, after the existing noise grid div (the `backgroundImage: "linear-gradient..."` div), add a second noise overlay:

```typescript
// After the existing grid pattern div, add:
<div
  style={{
    position: "absolute",
    inset: 0,
    opacity: 0.045,
    mixBlendMode: "overlay",
    filter: `url(#cinematic-noise-${Math.abs(Math.round(x)) % 5})`,
    background: "rgba(255,255,255,0.5)",
  }}
/>
```

- [ ] **Step 2: Enhance border to metallic gradient + deepen inner shadow**

Replace the existing `border` and `boxShadow` in the card's inner container:

```typescript
border: `1px solid transparent`,
backgroundClip: "padding-box",
boxShadow: `0 34px 90px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -40px 100px rgba(0,0,0,0.35), 0 0 42px ${accent}20`,
```

Add a pseudo border using an outer wrapper. Replace the entire card inner container wrapper with:

```typescript
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
    {/* existing content: noise grid, shimmer, CornerLines, text */}
  </div>
</div>
```

- [ ] **Step 3: Add second shimmer layer**

After the existing shimmer div, add:

```typescript
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
```

- [ ] **Step 4: Add FloatingConceptCards component**

Append at the end of the file:

```typescript
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
```

- [ ] **Step 5: Add import for clampInterpolate at top if not already there**

Ensure `clampInterpolate` is imported from `"./motion"` (it already is in existing code — verify).

- [ ] **Step 6: Verify compilation**

Run: `cd packages/presentation/example && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add packages/presentation/example/src/cinematic/ConceptCards.tsx
git commit -m "feat(cinematic): enhance cards — metallic border, noise, double shimmer, FloatingConceptCards"
```

---

### Task 5: CinematicCharts Enhancement + CandlestickChart

**Files:**
- Modify: `packages/presentation/example/src/cinematic/CinematicCharts.tsx`

- [ ] **Step 1: Add particle trail to CinematicLineChart data points**

Add import at top: `import { clampInterpolate, formatCompactNumber, loopSine, softSpring, particleTrail } from "./motion"`

In the data points mapping section (inside the SVG `{points.map(...)}`), after each point's `<g>` group, add particle rendering:

```typescript
{points.map((p, i) => {
  const on = clampInterpolate(frame, [delay + 44 + i * 4, delay + 58 + i * 4], [0, 1])
  const pulse = 1 + loopSine(frame, 42, i) * 0.12
  const particles = on > 0.8 ? particleTrail(frame, 6, { spread: 28, speed: 0.8, decay: 0.9, phase: i * 3 }) : []
  return (
    <g key={p.label} opacity={on} transform={`translate(${p.x} ${p.y}) scale(${on * pulse})`}>
      {particles.map((pt, pi) => (
        <circle key={pi} cx={pt.x} cy={pt.y} r={pt.size} fill={accent} opacity={pt.opacity * 0.7} />
      ))}
      <circle r={14} fill={accent} opacity={0.16} />
      <circle r={5.5} fill="#0B0B0F" stroke={accent} strokeWidth={2.5} />
      {i === points.length - 1 && <text x={18} y={4} fill={accent} fontSize={16} fontWeight={800}>{formatCompactNumber(p.value)}</text>}
    </g>
  )
})}
```

- [ ] **Step 2: Enhance CinematicBarChart — add 3D top face**

In `CinematicBarChart`, inside each bar's rendering, after the side face div, add:

```typescript
<div
  style={{
    position: "absolute",
    left: 0,
    top: -11,
    width: barW,
    height: 22,
    background: `linear-gradient(180deg, ${hue}CC, ${hue}88)`,
    transform: "skewX(-32deg) translateX(11px)",
    transformOrigin: "bottom left",
    border: `1px solid ${hue}88`,
  }}
/>
```

- [ ] **Step 3: Enhance PercentageRing — add orbiting micro-dots**

In `PercentageRing`, after the progress circle, add 8 orbiting dots:

```typescript
{Array.from({ length: 8 }).map((_, i) => {
  const dotAngle = ((frame * (0.8 + progress / 100)) / 30 + (i / 8) * Math.PI * 2)
  const dotR = radius + 18
  const dx = size / 2 + Math.cos(dotAngle) * dotR
  const dy = size / 2 + Math.sin(dotAngle) * dotR
  const dotOpacity = 0.15 + (Math.sin(dotAngle * 2) + 1) * 0.2
  return (
    <circle key={i} cx={dx} cy={dy} r={2} fill={accent} opacity={dotOpacity * enter} />
  )
})}
```

- [ ] **Step 4: Add CandlestickChart component**

Append to the file:

```typescript
export interface CandlestickData {
  label: string
  open: number
  close: number
  high: number
  low: number
}

export function CandlestickChart({
  data,
  title,
  subtitle,
  x = 0,
  y = 0,
  z = 0,
  width = 680,
  height = 380,
  delay = 0,
  tone = "gold",
}: {
  data: CandlestickData[]
  title: string
  subtitle?: string
  x?: number
  y?: number
  z?: number
  width?: number
  height?: number
  delay?: number
  tone?: CinematicTone
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)
  const drift = loopSine(frame, 180, 0.5)

  const allValues = data.flatMap((d) => [d.open, d.close, d.high, d.low])
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const range = Math.max(1, max - min)
  const pad = 60
  const chartW = width - pad * 2
  const chartH = height - 130
  const barWidth = Math.min(32, chartW / data.length - 8)

  const normalize = (v: number) => 90 + (1 - (v - min) / range) * chartH

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        marginLeft: -width / 2,
        marginTop: -height / 2,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y + drift * 4}px, ${z - (1 - enter) * 340}px) rotateX(${54 - enter * 14}deg) rotateY(${-10 + enter * 7}deg)`,
        filter: `blur(${(1 - enter) * 10}px)`,
      }}
    >
      <PanelShell accent={accent}>
        <ChartHeader title={title} subtitle={subtitle} accent={accent} value={`${data.length} CANDLES`} />
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <filter id="candle-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Grid */}
          <g opacity={clampInterpolate(frame, [delay, delay + 20], [0, 0.6])}>
            {Array.from({ length: 5 }).map((_, i) => {
              const gy = 90 + (i / 4) * chartH
              return <line key={i} x1={pad} x2={pad + chartW} y1={gy} y2={gy} stroke="rgba(234,236,239,0.1)" strokeWidth={1} />
            })}
          </g>
          {/* Candles */}
          {data.map((d, i) => {
            const candleEnter = softSpring(frame, fps, delay + 10 + i * 4)
            const cx = pad + (i + 0.5) * (chartW / data.length)
            const bullish = d.close >= d.open
            const bodyTop = normalize(bullish ? d.close : d.open)
            const bodyBottom = normalize(bullish ? d.open : d.close)
            const bodyH = Math.max(2, bodyBottom - bodyTop)
            const wickTop = normalize(d.high)
            const wickBottom = normalize(d.low)
            const color = bullish ? accent : cinematicTheme.colors.magenta

            return (
              <g key={d.label} opacity={candleEnter}>
                {/* Wick */}
                <line
                  x1={cx} x2={cx} y1={wickTop} y2={wickBottom}
                  stroke={color} strokeWidth={1.5}
                  filter="url(#candle-glow)"
                  opacity={0.8}
                />
                {/* Body */}
                <rect
                  x={cx - barWidth / 2} y={bodyTop}
                  width={barWidth} height={bodyH}
                  fill={bullish ? `${color}88` : `${color}55`}
                  stroke={color} strokeWidth={1.5}
                  rx={3}
                  filter="url(#candle-glow)"
                />
                {/* Label */}
                {i % 2 === 0 && (
                  <text x={cx} y={height - 28} fill="rgba(234,236,239,0.4)" fontSize={10} textAnchor="middle" fontFamily={cinematicTheme.font.mono}>
                    {d.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </PanelShell>
    </div>
  )
}
```

- [ ] **Step 5: Verify compilation**

Run: `cd packages/presentation/example && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add packages/presentation/example/src/cinematic/CinematicCharts.tsx
git commit -m "feat(cinematic): enhance charts — particle trails, 3D bars, orbiting dots, CandlestickChart"
```

---

### Task 6: WorldMapHeatmap + TimelineChart

**Files:**
- Modify: `packages/presentation/example/src/cinematic/CinematicCharts.tsx`

- [ ] **Step 1: Add MAP_PATHS constant and WorldMapHeatmap**

Append to `CinematicCharts.tsx`:

```typescript
const MAP_PATHS: Record<string, { d: string; cx: number; cy: number }> = {
  na: { d: "M 50 120 L 130 80 L 280 90 L 320 140 L 280 220 L 180 250 L 80 230 L 40 180 Z", cx: 170, cy: 155 },
  sa: { d: "M 200 270 L 250 260 L 290 300 L 280 380 L 240 440 L 210 430 L 190 370 L 180 300 Z", cx: 235, cy: 350 },
  eu: { d: "M 480 80 L 560 70 L 620 90 L 640 130 L 600 160 L 520 155 L 470 130 Z", cx: 555, cy: 115 },
  africa: { d: "M 470 180 L 540 170 L 600 200 L 620 280 L 580 370 L 520 390 L 470 350 L 450 260 Z", cx: 535, cy: 280 },
  mideast: { d: "M 620 140 L 700 130 L 740 170 L 720 210 L 660 220 L 630 190 Z", cx: 675, cy: 175 },
  "south-asia": { d: "M 740 180 L 800 160 L 840 200 L 830 260 L 780 270 L 740 240 Z", cx: 790, cy: 215 },
  "east-asia": { d: "M 840 90 L 950 80 L 1020 120 L 1000 190 L 940 220 L 860 200 L 830 150 Z", cx: 920, cy: 150 },
  oceania: { d: "M 900 320 L 980 300 L 1050 330 L 1040 380 L 970 400 L 910 370 Z", cx: 975, cy: 350 },
}

export interface MapRegion {
  id: "na" | "sa" | "eu" | "africa" | "mideast" | "south-asia" | "east-asia" | "oceania"
  value: number
  label: string
}

export function WorldMapHeatmap({
  regions,
  title,
  subtitle,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
}: {
  regions: MapRegion[]
  title: string
  subtitle?: string
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)
  const width = 800
  const height = 460
  const drift = loopSine(frame, 200) * 4

  const regionMap = new Map(regions.map((r) => [r.id, r]))

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        marginLeft: -width / 2,
        marginTop: -height / 2,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y + drift}px, ${z - (1 - enter) * 300}px) rotateX(${48 - enter * 12}deg) rotateY(${-6 + enter * 4}deg)`,
        filter: `blur(${(1 - enter) * 10}px)`,
      }}
    >
      <PanelShell accent={accent}>
        <ChartHeader title={title} subtitle={subtitle} accent={accent} value={`${regions.length} REGIONS`} />
        <svg width={1100} height={480} viewBox="0 0 1100 480" style={{ position: "absolute", left: "50%", top: "50%", marginLeft: -550, marginTop: -240, overflow: "visible" }}>
          <defs>
            <filter id="map-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {Object.entries(MAP_PATHS).map(([id, pathData], index) => {
            const region = regionMap.get(id as MapRegion["id"])
            const value = region?.value ?? 0
            const regionEnter = softSpring(frame, fps, delay + 8 + index * 5)
            const intensity = (value / 100) * 0.8
            const regionAccent = region ? toneColor(tone) : "rgba(234,236,239,0.1)"

            return (
              <g key={id} opacity={regionEnter}>
                <path
                  d={pathData.d}
                  fill={value > 0 ? `${regionAccent}` : "rgba(234,236,239,0.06)"}
                  fillOpacity={intensity + 0.08}
                  stroke={regionAccent}
                  strokeWidth={1.2}
                  strokeOpacity={0.5 + intensity * 0.4}
                  filter={value > 50 ? "url(#map-glow)" : undefined}
                />
                {region && (
                  <text
                    x={pathData.cx}
                    y={pathData.cy - 14}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={13}
                    fontWeight={800}
                    opacity={regionEnter}
                  >
                    {region.label}
                  </text>
                )}
                {region && (
                  <text
                    x={pathData.cx}
                    y={pathData.cy + 6}
                    textAnchor="middle"
                    fill={regionAccent}
                    fontSize={11}
                    fontFamily={cinematicTheme.font.mono}
                    opacity={regionEnter * 0.8}
                  >
                    {region.value}%
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </PanelShell>
    </div>
  )
}
```

- [ ] **Step 2: Add TimelineChart**

Append to `CinematicCharts.tsx`:

```typescript
export interface TimelineEvent {
  date: string
  label: string
  value?: number
  tone?: CinematicTone
}

export function TimelineChart({
  events,
  title,
  x = 0,
  y = 0,
  z = 0,
  width = 900,
  height = 280,
  delay = 0,
  tone = "gold",
}: {
  events: TimelineEvent[]
  title: string
  x?: number
  y?: number
  z?: number
  width?: number
  height?: number
  delay?: number
  tone?: CinematicTone
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)
  const drift = loopSine(frame, 210) * 3
  const pad = 60
  const lineY = height / 2

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        marginLeft: -width / 2,
        marginTop: -height / 2,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y + drift}px, ${z - (1 - enter) * 280}px) rotateX(${34 - enter * 10}deg)`,
        filter: `blur(${(1 - enter) * 8}px)`,
      }}
    >
      <PanelShell accent={accent}>
        <ChartHeader title={title} accent={accent} value={`${events.length} EVENTS`} />
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0 }}>
          {/* Timeline axis */}
          <line
            x1={pad} x2={width - pad}
            y1={lineY} y2={lineY}
            stroke={accent}
            strokeWidth={2}
            strokeOpacity={0.4}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - clampInterpolate(frame, [delay + 4, delay + 40], [0, 1])}
          />
          {/* Events */}
          {events.map((event, i) => {
            const eventEnter = softSpring(frame, fps, delay + 12 + i * 6)
            const ex = pad + (i / Math.max(1, events.length - 1)) * (width - pad * 2)
            const above = i % 2 === 0
            const ey = above ? lineY - 50 : lineY + 50
            const eventAccent = toneColor(event.tone ?? tone)

            return (
              <g key={i} opacity={eventEnter}>
                {/* Connector line */}
                <line x1={ex} x2={ex} y1={lineY} y2={ey + (above ? 20 : -20)} stroke={eventAccent} strokeWidth={1} strokeOpacity={0.5} />
                {/* Node dot */}
                <circle cx={ex} cy={lineY} r={5} fill={eventAccent} opacity={0.9}>
                </circle>
                <circle cx={ex} cy={lineY} r={10} fill={eventAccent} opacity={0.15} />
                {/* Label */}
                <text x={ex} y={ey} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={700} opacity={eventEnter}>
                  {event.label}
                </text>
                <text x={ex} y={ey + (above ? -14 : 16)} textAnchor="middle" fill="rgba(234,236,239,0.5)" fontSize={10} fontFamily={cinematicTheme.font.mono}>
                  {event.date}
                </text>
                {event.value !== undefined && (
                  <text x={ex} y={ey + (above ? 16 : -14)} textAnchor="middle" fill={eventAccent} fontSize={13} fontWeight={800}>
                    {event.value}%
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </PanelShell>
    </div>
  )
}
```

- [ ] **Step 3: Add stagger import**

Add `stagger` to the import from `"./motion"` if not already present.

- [ ] **Step 4: Verify compilation**

Run: `cd packages/presentation/example && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/presentation/example/src/cinematic/CinematicCharts.tsx
git commit -m "feat(cinematic): add WorldMapHeatmap + TimelineChart"
```

---

### Task 7: Structures Enhancement + Tree/Radial/Timeline

**Files:**
- Modify: `packages/presentation/example/src/cinematic/Structures.tsx`

- [ ] **Step 1: Add particle flow to existing FloatingNodeGraph edges**

Add import: `import { clampInterpolate, loopSine, softSpring, stagger } from "./motion"`

In the `edges.map(...)` section of `FloatingNodeGraph`, after the existing `<path>` and moving dot `<circle>`, add 3 additional flow particles:

```typescript
{/* Replace the single moving dot with multiple flow particles */}
{[0, 0.25, 0.5, 0.75].map((offset) => {
  const particleT = ((draw + offset) % 1)
  const px = x1 + (x2 - x1) * particleT
  const py = y1 + (y2 - y1) * particleT - 28 * Math.sin(particleT * Math.PI)
  return (
    <circle
      key={offset}
      cx={px} cy={py} r={2.5 - offset}
      fill={accent}
      opacity={draw > 0.3 ? 0.6 * (1 - offset * 0.6) : 0}
    />
  )
})}
```

- [ ] **Step 2: Add TreeStructure component**

Append to the file:

```typescript
export interface TreeNode {
  id: string
  title: string
  subtitle?: string
  tone?: CinematicTone
  children?: TreeNode[]
}

interface LayoutNode {
  node: TreeNode
  x: number
  y: number
  depth: number
}

function layoutTree(root: TreeNode, spacingX = 220, spacingY = 150): LayoutNode[] {
  const result: LayoutNode[] = []
  const maxDepth = 3
  const maxBreadth = 4

  function traverse(node: TreeNode, depth: number, offsetX: number, totalWidth: number) {
    if (depth > maxDepth) return
    const x = offsetX + totalWidth / 2
    const y = depth * spacingY
    result.push({ node, x, y, depth })

    const children = (node.children ?? []).slice(0, maxBreadth)
    if (children.length === 0) return
    const childWidth = totalWidth / children.length
    children.forEach((child, i) => {
      traverse(child, depth + 1, offsetX + i * childWidth, childWidth)
    })
  }

  const estimatedWidth = Math.pow(maxBreadth, Math.min(2, countDepth(root) - 1)) * spacingX
  traverse(root, 0, -estimatedWidth / 2, estimatedWidth)
  return result
}

function countDepth(node: TreeNode): number {
  if (!node.children || node.children.length === 0) return 1
  return 1 + Math.max(...node.children.map(countDepth))
}

export function TreeStructure({
  root,
  delay = 0,
  tone = "gold",
  orientation = "vertical",
}: {
  root: TreeNode
  delay?: number
  tone?: CinematicTone
  orientation?: "vertical" | "horizontal"
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const nodes = layoutTree(root)
  const accent = toneColor(tone)

  // Build parent→children edges
  const edges: Array<{ from: LayoutNode; to: LayoutNode; index: number }> = []
  let edgeIndex = 0
  function buildEdges(parentNode: TreeNode, layoutNodes: LayoutNode[]) {
    const parent = layoutNodes.find((n) => n.node.id === parentNode.id)
    if (!parent) return
    for (const child of (parentNode.children ?? []).slice(0, 4)) {
      const childLayout = layoutNodes.find((n) => n.node.id === child.id)
      if (childLayout) {
        edges.push({ from: parent, to: childLayout, index: edgeIndex++ })
        buildEdges(child, layoutNodes)
      }
    }
  }
  buildEdges(root, nodes)

  return (
    <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <filter id="tree-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {edges.map((edge) => {
          const d = delay + edge.index * 4 + 8
          const draw = clampInterpolate(frame, [d, d + 30], [0, 1])
          const fromX = 960 + edge.from.x
          const fromY = 340 + edge.from.y
          const toX = 960 + edge.to.x
          const toY = 340 + edge.to.y
          const midY = (fromY + toY) / 2
          const edgeAccent = toneColor(edge.to.node.tone ?? tone)

          return (
            <g key={`${edge.from.node.id}-${edge.to.node.id}`} opacity={draw}>
              <path
                d={`M ${fromX} ${fromY + 30} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY - 30}`}
                fill="none"
                stroke={edgeAccent}
                strokeWidth={1.5}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - draw}
                filter="url(#tree-glow)"
                opacity={0.7}
              />
            </g>
          )
        })}
      </svg>
      {nodes.map((layoutNode, index) => {
        const enter = softSpring(frame, fps, delay + layoutNode.depth * 8 + index * 3)
        const nodeAccent = toneColor(layoutNode.node.tone ?? tone)
        const drift = loopSine(frame, 160 + index * 7, index) * 4

        return (
          <div
            key={layoutNode.node.id}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 200,
              minHeight: 72,
              marginLeft: -100,
              marginTop: -36,
              opacity: enter,
              transformStyle: "preserve-3d",
              transform: `translate3d(${layoutNode.x}px, ${layoutNode.y - 200 + drift}px, ${-(1 - enter) * 200 + layoutNode.depth * -40}px) scale(${0.88 + enter * 0.12})`,
              borderRadius: 14,
              padding: "14px 16px",
              background: "linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)), rgba(12,12,18,0.64)",
              border: `1px solid ${nodeAccent}40`,
              boxShadow: `0 16px 48px rgba(0,0,0,0.4), 0 0 24px ${nodeAccent}1A, inset 0 1px 0 rgba(255,255,255,0.14)`,
              backdropFilter: "blur(16px)",
            }}
          >
            <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 18, fontWeight: 800, color: "#fff" }}>{layoutNode.node.title}</div>
            {layoutNode.node.subtitle && <div style={{ marginTop: 4, fontSize: 10, letterSpacing: 1.2, color: "rgba(234,236,239,0.46)" }}>{layoutNode.node.subtitle}</div>}
            <div style={{ position: "absolute", right: 12, top: 12, width: 7, height: 7, borderRadius: "50%", background: nodeAccent, boxShadow: `0 0 12px ${nodeAccent}` }} />
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Add RadialStructure component**

```typescript
export function RadialStructure({
  center,
  orbits,
  delay = 0,
  tone = "gold",
}: {
  center: StructureNode
  orbits: Array<{ radius: number; nodes: StructureNode[] }>
  delay?: number
  tone?: CinematicTone
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const centerEnter = softSpring(frame, fps, delay)
  const centerAccent = toneColor(center.tone ?? tone)
  const rotateBase = (frame / 400) * 360

  // Flatten nodes with computed positions
  const allNodes: Array<StructureNode & { px: number; py: number; orbitIdx: number; nodeIdx: number }> = []
  orbits.forEach((orbit, oi) => {
    orbit.nodes.forEach((node, ni) => {
      const angle = (ni / orbit.nodes.length) * Math.PI * 2 + (rotateBase * Math.PI) / 180 * (0.3 + oi * 0.15)
      allNodes.push({
        ...node,
        px: Math.cos(angle) * orbit.radius,
        py: Math.sin(angle) * orbit.radius * 0.55,
        orbitIdx: oi,
        nodeIdx: ni,
      })
    })
  })

  return (
    <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <filter id="radial-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Orbit rings */}
        {orbits.map((orbit, oi) => {
          const ringEnter = clampInterpolate(frame, [delay + 6 + oi * 8, delay + 26 + oi * 8], [0, 1])
          return (
            <ellipse
              key={oi}
              cx={960} cy={540}
              rx={orbit.radius} ry={orbit.radius * 0.55}
              fill="none"
              stroke={centerAccent}
              strokeWidth={1}
              strokeOpacity={ringEnter * 0.2}
              strokeDasharray="4 8"
            />
          )
        })}
        {/* Connection lines */}
        {allNodes.map((node, i) => {
          const lineEnter = clampInterpolate(frame, [delay + 14 + i * 3, delay + 34 + i * 3], [0, 1])
          return (
            <line
              key={`line-${node.id}`}
              x1={960} y1={540}
              x2={960 + node.px} y2={540 + node.py}
              stroke={toneColor(node.tone ?? tone)}
              strokeWidth={1.2}
              opacity={lineEnter * 0.4}
              filter="url(#radial-glow)"
            />
          )
        })}
      </svg>
      {/* Center node */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 160,
          height: 80,
          marginLeft: -80,
          marginTop: -40,
          opacity: centerEnter,
          transform: `scale(${0.8 + centerEnter * 0.2})`,
          borderRadius: 16,
          padding: "16px 18px",
          background: `linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04)), rgba(12,12,18,0.7)`,
          border: `1.5px solid ${centerAccent}60`,
          boxShadow: `0 0 40px ${centerAccent}30, 0 20px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.18)`,
          backdropFilter: "blur(18px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 20, fontWeight: 800, color: "#fff" }}>{center.title}</div>
        {center.subtitle && <div style={{ marginTop: 3, fontSize: 10, color: "rgba(234,236,239,0.5)" }}>{center.subtitle}</div>}
      </div>
      {/* Orbit nodes */}
      {allNodes.map((node, i) => {
        const nodeEnter = softSpring(frame, fps, delay + 18 + node.orbitIdx * 8 + node.nodeIdx * 4)
        const nodeAccent = toneColor(node.tone ?? tone)
        return (
          <div
            key={node.id}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 160,
              minHeight: 60,
              marginLeft: -80,
              marginTop: -30,
              opacity: nodeEnter,
              transform: `translate(${node.px}px, ${node.py}px) scale(${0.85 + nodeEnter * 0.15})`,
              borderRadius: 12,
              padding: "12px 14px",
              background: "linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03)), rgba(12,12,18,0.6)",
              border: `1px solid ${nodeAccent}38`,
              boxShadow: `0 12px 36px rgba(0,0,0,0.36), 0 0 18px ${nodeAccent}18, inset 0 1px 0 rgba(255,255,255,0.12)`,
              backdropFilter: "blur(14px)",
            }}
          >
            <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 15, fontWeight: 700, color: "#fff" }}>{node.title}</div>
            {node.subtitle && <div style={{ marginTop: 3, fontSize: 9, letterSpacing: 1, color: "rgba(234,236,239,0.44)" }}>{node.subtitle}</div>}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Add TimelineStructure component**

```typescript
export function TimelineStructure({
  events,
  delay = 0,
  tone = "gold",
  direction = "horizontal",
}: {
  events: Array<{ id: string; title: string; subtitle?: string; tone?: CinematicTone }>
  delay?: number
  tone?: CinematicTone
  direction?: "horizontal" | "vertical"
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)
  const count = events.length
  // Camera follow: translate all content to center on active node
  const activeIndex = Math.min(count - 1, Math.floor(clampInterpolate(frame, [delay + 20, delay + 20 + count * 20], [0, count - 0.01])))
  const followOffset = direction === "horizontal" ? -activeIndex * 200 : -activeIndex * 140

  return (
    <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transform: direction === "horizontal"
            ? `translateX(${followOffset * 0.3}px)`
            : `translateY(${followOffset * 0.3}px)`,
          transition: "transform 0.3s ease-out",
        }}
      >
        <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {/* Main axis line */}
          <line
            x1={direction === "horizontal" ? 200 : 960}
            y1={direction === "horizontal" ? 540 : 180}
            x2={direction === "horizontal" ? 200 + (count - 1) * 200 : 960}
            y2={direction === "horizontal" ? 540 : 180 + (count - 1) * 140}
            stroke={accent}
            strokeWidth={2}
            strokeOpacity={0.3}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - clampInterpolate(frame, [delay, delay + 40], [0, 1])}
          />
        </svg>
        {events.map((event, i) => {
          const nodeEnter = softSpring(frame, fps, delay + 10 + i * 8)
          const nodeAccent = toneColor(event.tone ?? tone)
          const isActive = i <= activeIndex
          const px = direction === "horizontal" ? -460 + i * 200 : 0
          const py = direction === "horizontal" ? 0 : -320 + i * 140
          const drift = loopSine(frame, 150 + i * 11, i) * 3

          return (
            <div
              key={event.id}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 180,
                minHeight: 66,
                marginLeft: -90,
                marginTop: -33,
                opacity: nodeEnter,
                transform: `translate3d(${px}px, ${py + drift}px, ${isActive ? 20 : -30}px) scale(${isActive ? 1 : 0.9})`,
                borderRadius: 13,
                padding: "13px 15px",
                background: isActive
                  ? `linear-gradient(145deg, rgba(255,255,255,0.13), rgba(255,255,255,0.04)), rgba(12,12,18,0.68)`
                  : "rgba(12,12,18,0.45)",
                border: `1px solid ${isActive ? `${nodeAccent}50` : "rgba(234,236,239,0.1)"}`,
                boxShadow: isActive
                  ? `0 14px 42px rgba(0,0,0,0.38), 0 0 22px ${nodeAccent}1A, inset 0 1px 0 rgba(255,255,255,0.14)`
                  : "0 8px 24px rgba(0,0,0,0.2)",
                backdropFilter: "blur(14px)",
              }}
            >
              <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 16, fontWeight: 700, color: isActive ? "#fff" : "rgba(234,236,239,0.5)" }}>{event.title}</div>
              {event.subtitle && <div style={{ marginTop: 3, fontSize: 10, color: "rgba(234,236,239,0.4)" }}>{event.subtitle}</div>}
              <div style={{ position: "absolute", left: -8, top: "50%", marginTop: -5, width: 10, height: 10, borderRadius: "50%", background: isActive ? nodeAccent : "rgba(234,236,239,0.2)", boxShadow: isActive ? `0 0 12px ${nodeAccent}` : "none" }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify compilation**

Run: `cd packages/presentation/example && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add packages/presentation/example/src/cinematic/Structures.tsx
git commit -m "feat(cinematic): enhance structures — particle flow, TreeStructure, RadialStructure, TimelineStructure"
```

---

### Task 8: DataHud Enhancement + Ticker/Ranking/StatDashboard

**Files:**
- Modify: `packages/presentation/example/src/cinematic/DataHud.tsx`

- [ ] **Step 1: Enhance KpiBlock — improved scan line**

In the `KpiBlock` component, replace the existing scan line div (the `position: "absolute", left: 0, right: 0, top: clampInterpolate(...)` div) with:

```typescript
{/* Scan line — triggers on value change animation */}
<div
  style={{
    position: "absolute",
    left: 0,
    right: 0,
    top: clampInterpolate((frame - delay) % 96, [0, 96], [-4, 140]),
    height: 2,
    background: `linear-gradient(90deg, transparent 5%, ${accent}60 30%, ${accent} 50%, ${accent}60 70%, transparent 95%)`,
    boxShadow: `0 0 12px ${accent}40`,
    opacity: 0.6,
    filter: "blur(0.5px)",
  }}
/>
{/* Secondary faint scan */}
<div
  style={{
    position: "absolute",
    left: 0,
    right: 0,
    top: clampInterpolate((frame - delay + 48) % 96, [0, 96], [-4, 140]),
    height: 12,
    background: `linear-gradient(180deg, transparent, ${accent}10, transparent)`,
    opacity: 0.4,
  }}
/>
```

- [ ] **Step 2: Enhance MarketTable — add left glow bar on row reveal**

In `MarketTable`, inside the `rows.map(...)`, add a left accent bar that sweeps in:

```typescript
{/* Left accent sweep */}
<div
  style={{
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    background: `linear-gradient(180deg, transparent, ${accent}, transparent)`,
    opacity: reveal * 0.6,
    boxShadow: `0 0 8px ${accent}40`,
    transform: `scaleY(${reveal})`,
    transformOrigin: "top",
  }}
/>
```

Add `position: "relative"` to the row container style.

- [ ] **Step 3: Add RealtimeTicker component**

Append to `DataHud.tsx`:

```typescript
export interface TickerItem {
  symbol: string
  value: string
  change: string
  positive: boolean
}

export function RealtimeTicker({
  items,
  speed = 1.2,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
}: {
  items: TickerItem[]
  speed?: number
  x?: number
  y?: number
  z?: number
  delay?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const totalWidth = items.length * 200
  const offset = ((frame - delay) * speed) % totalWidth

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 900,
        height: 56,
        marginLeft: -450,
        marginTop: -28,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px)`,
        borderRadius: 12,
        background: "rgba(12, 12, 18, 0.6)",
        border: "1px solid rgba(214, 179, 106, 0.18)",
        backdropFilter: "blur(16px)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          transform: `translateX(${-offset}px)`,
          whiteSpace: "nowrap",
        }}
      >
        {[...items, ...items].map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 24px",
              borderRight: "1px solid rgba(234,236,239,0.08)",
              height: "100%",
            }}
          >
            <span style={{ fontFamily: cinematicTheme.font.mono, fontSize: 12, color: "rgba(234,236,239,0.6)", letterSpacing: 1 }}>
              {item.symbol}
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
              {item.value}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: item.positive ? cinematicTheme.colors.gold : cinematicTheme.colors.magenta,
                textShadow: `0 0 8px ${item.positive ? cinematicTheme.colors.gold : cinematicTheme.colors.magenta}44`,
              }}
            >
              {item.change}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add RankingList component**

```typescript
export function RankingList({
  items,
  title,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
}: {
  items: Array<{ rank: number; name: string; value: string; tone?: CinematicTone }>
  title: string
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)
  const accent = toneColor(tone)
  const maxValue = Math.max(...items.map((it) => parseFloat(it.value) || 0), 1)

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 420,
        marginLeft: -210,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 200}px) rotateX(${12 - enter * 5}deg)`,
        borderRadius: 18,
        background: "rgba(12,12,18,0.6)",
        border: `1px solid ${accent}28`,
        boxShadow: `0 24px 70px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.12)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "18px 20px 10px", fontFamily: cinematicTheme.font.zh, fontSize: 18, fontWeight: 800, color: "#fff", borderBottom: "1px solid rgba(234,236,239,0.08)" }}>
        {title}
      </div>
      {items.map((item, index) => {
        const rowEnter = softSpring(frame, fps, delay + 8 + index * 5)
        const itemAccent = toneColor(item.tone ?? tone)
        const barWidth = (parseFloat(item.value) || 0) / maxValue * 100

        return (
          <div
            key={item.rank}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 20px",
              gap: 14,
              opacity: rowEnter,
              transform: `translateX(${(1 - rowEnter) * -20}px)`,
              borderBottom: index === items.length - 1 ? "none" : "1px solid rgba(234,236,239,0.05)",
              position: "relative",
            }}
          >
            {/* Background bar */}
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${barWidth * rowEnter}%`, background: `linear-gradient(90deg, ${itemAccent}12, transparent)` }} />
            <div style={{ fontSize: 22, fontWeight: 900, color: itemAccent, width: 32, textAlign: "center", textShadow: `0 0 14px ${itemAccent}44` }}>
              {item.rank}
            </div>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#fff" }}>{item.name}</div>
            <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 13, color: itemAccent }}>{item.value}</div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Add StatDashboard component**

```typescript
export function StatDashboard({
  metrics,
  columns = 3,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
}: {
  metrics: Array<{ label: string; value: number; suffix?: string; prefix?: string; tone?: CinematicTone }>
  columns?: number
  x?: number
  y?: number
  z?: number
  delay?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = softSpring(frame, fps, delay)

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 180}px) rotateX(${8 - enter * 4}deg)`,
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 16,
        marginLeft: -(columns * 170) / 2,
      }}
    >
      {metrics.map((metric, i) => {
        const metricEnter = softSpring(frame, fps, delay + 4 + i * 4)
        const accent = toneColor(metric.tone ?? "gold")
        const display = clampInterpolate(frame, [delay + 6 + i * 4, delay + 52 + i * 4], [0, metric.value])

        return (
          <div
            key={metric.label}
            style={{
              width: 154,
              padding: "16px 14px",
              borderRadius: 14,
              background: "rgba(12,12,18,0.55)",
              border: `1px solid ${accent}30`,
              boxShadow: `0 14px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)`,
              backdropFilter: "blur(14px)",
              opacity: metricEnter,
              transform: `translateY(${(1 - metricEnter) * 16}px)`,
            }}
          >
            <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 10, letterSpacing: 1.5, color: "rgba(234,236,239,0.44)" }}>{metric.label}</div>
            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900, color: "#fff" }}>
              <span style={{ color: accent }}>{metric.prefix ?? ""}</span>
              {display >= 100 ? Math.round(display) : display.toFixed(1)}
              <span style={{ color: accent, fontSize: 16, marginLeft: 2 }}>{metric.suffix ?? ""}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 6: Verify compilation**

Run: `cd packages/presentation/example && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add packages/presentation/example/src/cinematic/DataHud.tsx
git commit -m "feat(cinematic): enhance DataHud — scan lines, RealtimeTicker, RankingList, StatDashboard"
```

---

### Task 9: Infographics.tsx — New File

**Files:**
- Create: `packages/presentation/example/src/cinematic/Infographics.tsx`

- [ ] **Step 1: Create Infographics.tsx with PyramidInfoScene**

```typescript
import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import { clampInterpolate, loopSine, softSpring, stagger } from "./motion"

export interface PyramidLayer {
  title: string
  subtitle: string
  value?: string
  tone: CinematicTone
}

export function PyramidInfoScene({
  layers,
  title,
  delay = 0,
}: {
  layers: PyramidLayer[]
  title: string
  delay?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const titleEnter = softSpring(frame, fps, delay)
  const count = layers.length
  // Camera tilt up as layers build
  const buildProgress = clampInterpolate(frame, [delay + 10, delay + 10 + count * 12], [0, 1])
  const cameraTilt = 58 - buildProgress * 8

  return (
    <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
      {/* Title */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 60,
          opacity: titleEnter,
          transform: `translateY(${(1 - titleEnter) * 20}px)`,
          zIndex: 5,
        }}
      >
        <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 11, letterSpacing: 2.2, color: cinematicTheme.colors.gold }}>{title.toUpperCase()}</div>
      </div>

      {/* Pyramid layers */}
      {layers.map((layer, index) => {
        const layerDelay = delay + 10 + (count - 1 - index) * 12
        const enter = softSpring(frame, fps, layerDelay)
        const accent = toneColor(layer.tone)
        const w = 840 - index * (400 / count)
        const h = 72
        const yPos = 180 + (count - 1 - index) * 94
        const z = -80 + index * 50
        const drift = loopSine(frame, 200 + index * 15, index) * 2

        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: w,
              height: h,
              marginLeft: -w / 2,
              marginTop: -h / 2,
              opacity: enter,
              transformStyle: "preserve-3d",
              transform: `translate3d(0, ${yPos - 340 + (1 - enter) * 80 + drift}px, ${z - (1 - enter) * 200}px) rotateX(${cameraTilt}deg)`,
              borderRadius: 16,
              background: `linear-gradient(90deg, rgba(255,255,255,0.04), ${accent}18, rgba(255,255,255,0.03))`,
              border: `1px solid ${accent}45`,
              boxShadow: `0 16px 48px rgba(0,0,0,0.36), 0 0 28px ${accent}1A, inset 0 1px 0 rgba(255,255,255,0.14)`,
              backdropFilter: "blur(14px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 28px",
            }}
          >
            <div>
              <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 22, fontWeight: 800, color: "#fff" }}>{layer.title}</div>
              <div style={{ marginTop: 3, fontSize: 10, letterSpacing: 1.4, color: "rgba(234,236,239,0.5)" }}>{layer.subtitle}</div>
            </div>
            {layer.value && (
              <div style={{ fontSize: 22, fontWeight: 800, color: accent, textShadow: `0 0 18px ${accent}44` }}>{layer.value}</div>
            )}
            {/* Edge glow */}
            <div style={{ position: "absolute", inset: -1, borderRadius: 16, border: `1px solid ${accent}30`, opacity: enter * 0.5, boxShadow: `0 0 16px ${accent}20` }} />
          </div>
        )
      })}

      {/* Volumetric fog between layers */}
      <div
        style={{
          position: "absolute",
          left: "30%",
          bottom: "15%",
          width: "40%",
          height: "20%",
          background: `radial-gradient(ellipse, rgba(214,179,106,0.08) 0%, transparent 70%)`,
          filter: "blur(40px)",
          transform: `translateY(${loopSine(frame, 180) * 10}px)`,
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Add CausalChainScene**

```typescript
export interface ChainStep {
  title: string
  body?: string
  tone: CinematicTone
}

export function CausalChainScene({
  steps,
  title,
  layout = "horizontal",
  delay = 0,
}: {
  steps: ChainStep[]
  title: string
  layout?: "horizontal" | "s-curve"
  delay?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const titleEnter = softSpring(frame, fps, delay)
  const count = steps.length

  // Compute positions
  const positions = steps.map((_, i) => {
    if (layout === "s-curve") {
      const row = Math.floor(i / 3)
      const col = row % 2 === 0 ? i % 3 : 2 - (i % 3)
      return { x: -340 + col * 340, y: -180 + row * 200 }
    }
    return { x: -((count - 1) * 180) / 2 + i * 180, y: 0 }
  })

  return (
    <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
      {/* Title */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 60,
          opacity: titleEnter,
          zIndex: 5,
        }}
      >
        <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 11, letterSpacing: 2.2, color: cinematicTheme.colors.gold }}>{title.toUpperCase()}</div>
      </div>

      {/* Connection lines with particle flow */}
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <filter id="chain-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {steps.slice(0, -1).map((step, i) => {
          const lineDelay = delay + 14 + i * 10
          const draw = clampInterpolate(frame, [lineDelay, lineDelay + 28], [0, 1])
          const from = positions[i]
          const to = positions[i + 1]
          const accent = toneColor(steps[i + 1].tone)
          const fx = 960 + from.x + 80
          const fy = 540 + from.y
          const tx = 960 + to.x - 80
          const ty = 540 + to.y
          const mx = (fx + tx) / 2
          const my = (fy + ty) / 2 - 30

          return (
            <g key={i} opacity={draw}>
              <path
                d={`M ${fx} ${fy} Q ${mx} ${my} ${tx} ${ty}`}
                fill="none"
                stroke={accent}
                strokeWidth={2}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - draw}
                filter="url(#chain-glow)"
                opacity={0.6}
              />
              {/* Flow particles */}
              {[0, 0.3, 0.6].map((offset) => {
                const t = ((frame * 0.02 + offset) % 1) * draw
                const px = fx + (tx - fx) * t
                const py = fy + (ty - fy) * t - 30 * Math.sin(t * Math.PI)
                return <circle key={offset} cx={px} cy={py} r={2.5} fill={accent} opacity={0.7 * draw} />
              })}
              {/* Arrow head */}
              <polygon
                points={`${tx},${ty} ${tx - 10},${ty - 5} ${tx - 10},${ty + 5}`}
                fill={accent}
                opacity={draw * 0.7}
              />
            </g>
          )
        })}
      </svg>

      {/* Step nodes */}
      {steps.map((step, i) => {
        const nodeEnter = softSpring(frame, fps, delay + 8 + i * 10)
        const accent = toneColor(step.tone)
        const pos = positions[i]
        const drift = loopSine(frame, 170 + i * 13, i) * 3

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 160,
              minHeight: 76,
              marginLeft: -80,
              marginTop: -38,
              opacity: nodeEnter,
              transform: `translate3d(${pos.x}px, ${pos.y + drift}px, ${-(1 - nodeEnter) * 180}px) scale(${0.86 + nodeEnter * 0.14})`,
              borderRadius: 14,
              padding: "14px 16px",
              background: `linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03)), radial-gradient(circle at 20% 0%, ${accent}28, transparent 50%), rgba(12,12,18,0.66)`,
              border: `1px solid ${accent}40`,
              boxShadow: `0 16px 46px rgba(0,0,0,0.4), 0 0 22px ${accent}18, inset 0 1px 0 rgba(255,255,255,0.14)`,
              backdropFilter: "blur(16px)",
            }}
          >
            <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 17, fontWeight: 800, color: "#fff" }}>{step.title}</div>
            {step.body && <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.5, color: "rgba(234,236,239,0.56)" }}>{step.body}</div>}
            <div style={{ position: "absolute", left: 14, top: 14, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: accent, background: `${accent}20`, border: `1px solid ${accent}40` }}>
              {i + 1}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Add CapitalFlowDiagram**

```typescript
export interface FlowTarget {
  title: string
  value: string
  percentage: number
  tone: CinematicTone
}

export function CapitalFlowDiagram({
  source,
  targets,
  title,
  delay = 0,
}: {
  source: { title: string; value: string }
  targets: FlowTarget[]
  title: string
  delay?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const centerEnter = softSpring(frame, fps, delay)
  const count = targets.length

  // Position targets in a semicircle
  const targetPositions = targets.map((_, i) => {
    const angle = -Math.PI * 0.7 + (i / Math.max(1, count - 1)) * Math.PI * 1.4
    const radius = 320
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.6 }
  })

  return (
    <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
      {/* Title */}
      <div style={{ position: "absolute", left: 80, top: 60, opacity: centerEnter, zIndex: 5 }}>
        <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 11, letterSpacing: 2.2, color: cinematicTheme.colors.gold }}>{title.toUpperCase()}</div>
      </div>

      {/* Flow lines */}
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <filter id="flow-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {targets.map((target, i) => {
          const lineDelay = delay + 16 + i * 6
          const draw = clampInterpolate(frame, [lineDelay, lineDelay + 24], [0, 1])
          const pos = targetPositions[i]
          const accent = toneColor(target.tone)
          const lineWidth = 1 + (target.percentage / 100) * 4

          return (
            <g key={i} opacity={draw}>
              <line
                x1={960} y1={540}
                x2={960 + pos.x} y2={540 + pos.y}
                stroke={accent}
                strokeWidth={lineWidth}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - draw}
                filter="url(#flow-glow)"
                opacity={0.5}
              />
              {/* Flowing particles */}
              {[0.2, 0.5, 0.8].map((offset) => {
                const t = ((frame * 0.025 + offset) % 1) * draw
                return (
                  <circle
                    key={offset}
                    cx={960 + pos.x * t}
                    cy={540 + pos.y * t}
                    r={2 + lineWidth * 0.5}
                    fill={accent}
                    opacity={0.6 * draw}
                  />
                )
              })}
            </g>
          )
        })}
      </svg>

      {/* Source (center) node */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 180,
          height: 90,
          marginLeft: -90,
          marginTop: -45,
          opacity: centerEnter,
          transform: `scale(${0.7 + centerEnter * 0.3})`,
          borderRadius: 18,
          background: `linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04)), rgba(12,12,18,0.72)`,
          border: `1.5px solid ${cinematicTheme.colors.gold}60`,
          boxShadow: `0 0 50px ${cinematicTheme.colors.gold}28, 0 24px 60px rgba(0,0,0,0.44), inset 0 1px 0 rgba(255,255,255,0.18)`,
          backdropFilter: "blur(20px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 20, fontWeight: 800, color: "#fff" }}>{source.title}</div>
        <div style={{ marginTop: 4, fontSize: 18, fontWeight: 800, color: cinematicTheme.colors.gold }}>{source.value}</div>
      </div>

      {/* Target nodes */}
      {targets.map((target, i) => {
        const nodeEnter = softSpring(frame, fps, delay + 20 + i * 6)
        const accent = toneColor(target.tone)
        const pos = targetPositions[i]
        const valueDisplay = clampInterpolate(frame, [delay + 26 + i * 6, delay + 60 + i * 6], [0, target.percentage])

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 150,
              minHeight: 70,
              marginLeft: -75,
              marginTop: -35,
              opacity: nodeEnter,
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${0.84 + nodeEnter * 0.16})`,
              borderRadius: 13,
              padding: "12px 14px",
              background: `linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03)), rgba(12,12,18,0.6)`,
              border: `1px solid ${accent}38`,
              boxShadow: `0 14px 40px rgba(0,0,0,0.36), 0 0 20px ${accent}16, inset 0 1px 0 rgba(255,255,255,0.12)`,
              backdropFilter: "blur(14px)",
              textAlign: "center",
            }}
          >
            <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 14, fontWeight: 700, color: "#fff" }}>{target.title}</div>
            <div style={{ marginTop: 4, fontSize: 18, fontWeight: 800, color: accent }}>{Math.round(valueDisplay)}%</div>
            <div style={{ marginTop: 2, fontSize: 11, color: "rgba(234,236,239,0.5)", fontFamily: cinematicTheme.font.mono }}>{target.value}</div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Add LayeredExplanation**

```typescript
export interface ExplanationLayer {
  depth: number
  title: string
  body: string
  tone: CinematicTone
}

export function LayeredExplanation({
  layers,
  title,
  delay = 0,
}: {
  layers: ExplanationLayer[]
  title: string
  delay?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const titleEnter = softSpring(frame, fps, delay)
  const sorted = [...layers].sort((a, b) => b.depth - a.depth) // farthest first

  return (
    <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", perspective: 1400 }}>
      {/* Title */}
      <div style={{ position: "absolute", left: 80, top: 60, opacity: titleEnter, zIndex: 10 }}>
        <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 11, letterSpacing: 2.2, color: cinematicTheme.colors.gold }}>{title.toUpperCase()}</div>
      </div>

      {sorted.map((layer, i) => {
        const layerDelay = delay + 6 + i * 12
        const enter = softSpring(frame, fps, layerDelay)
        const accent = toneColor(layer.tone)
        const zOffset = -layer.depth * 200
        const blur = layer.depth * 2.5
        const drift = loopSine(frame, 180 + i * 20, i) * 3
        const width = 460 - layer.depth * 40
        const yOffset = -140 + i * 120

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width,
              minHeight: 100,
              marginLeft: -width / 2,
              marginTop: -50,
              opacity: enter * (1 - layer.depth * 0.15),
              transformStyle: "preserve-3d",
              transform: `translate3d(0, ${yOffset + drift}px, ${zOffset - (1 - enter) * 300}px)`,
              filter: `blur(${blur * (1 - enter * 0.5)}px)`,
              borderRadius: 18,
              padding: "20px 22px",
              background: `linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03)), radial-gradient(circle at 20% 10%, ${accent}20, transparent 50%), rgba(12,12,18,0.6)`,
              border: `1px solid ${accent}35`,
              boxShadow: `0 20px 56px rgba(0,0,0,0.38), 0 0 24px ${accent}14, inset 0 1px 0 rgba(255,255,255,0.12)`,
              backdropFilter: "blur(14px)",
            }}
          >
            <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 20, fontWeight: 800, color: "#fff" }}>{layer.title}</div>
            <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.7, color: "rgba(234,236,239,0.6)" }}>{layer.body}</div>
            <div style={{ position: "absolute", right: 16, top: 16, fontFamily: cinematicTheme.font.mono, fontSize: 9, color: accent, opacity: 0.6 }}>
              DEPTH / {layer.depth}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Verify compilation**

Run: `cd packages/presentation/example && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add packages/presentation/example/src/cinematic/Infographics.tsx
git commit -m "feat(cinematic): add Infographics.tsx — PyramidInfo, CausalChain, CapitalFlow, LayeredExplanation"
```

---

### Task 10: Update Showcase + index.ts + Root.tsx

**Files:**
- Modify: `packages/presentation/example/src/cinematic/CinematicFinanceShowcase.tsx`
- Modify: `packages/presentation/example/src/cinematic/index.ts`
- Modify: `packages/presentation/example/src/Root.tsx`

- [ ] **Step 1: Rewrite CinematicFinanceShowcase.tsx with 7 sequences**

Replace the entire file:

```typescript
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion"
import { CinematicStage, CameraRig } from "./CinematicStage"
import { ConceptCardMatrix, type ConceptCardData } from "./ConceptCards"
import { CinematicLineChart, CinematicBarChart, PercentageRing, CandlestickChart, WorldMapHeatmap, TimelineChart, type CandlestickData, type MapRegion, type TimelineEvent } from "./CinematicCharts"
import { FloatingNodeGraph, TreeStructure, type StructureEdge, type StructureNode, type TreeNode } from "./Structures"
import { KpiBlock, MarketTable, RealtimeTicker, type TickerItem } from "./DataHud"
import { PyramidInfoScene, CausalChainScene, CapitalFlowDiagram, type PyramidLayer, type ChainStep, type FlowTarget } from "./Infographics"
import { CinematicDollyZoom, SlowOrbit, FocusPull } from "./Camera"
import { cinematicTheme } from "./theme"
import { clampInterpolate, loopSine } from "./motion"

// ─── DATA ──────────────────────────────────────────────────

const conceptCards: ConceptCardData[] = [
  { id: "central-bank", title: "央行", subtitle: "Central Bank", eyebrow: "MONETARY CORE", body: "利率、资产负债表与预期管理共同塑造流动性边界。", metric: "5.25%", tone: "gold" },
  { id: "investment", title: "投资", subtitle: "Investment", eyebrow: "CAPITAL FLOW", body: "风险溢价在周期转折中重新定价，资金向确定性聚集。", metric: "$2.8T", tone: "purple" },
  { id: "technology", title: "科技", subtitle: "Technology", eyebrow: "PRODUCTIVITY", body: "算力、模型与数据基础设施形成新的生产函数。", metric: "41%", tone: "magenta" },
  { id: "hedge", title: "避险", subtitle: "Safe Haven", eyebrow: "DEFENSIVE LAYER", body: "黄金、现金流资产与期限结构承担组合缓冲。", metric: "0.72β", tone: "amber" },
  { id: "geopolitics", title: "地缘政治", subtitle: "Geopolitics", eyebrow: "RISK SURFACE", body: "供应链、能源与资本管制抬升尾部风险。", metric: "HIGH", tone: "cold" },
]

const lineData = [
  { label: "Q1'22", value: 1120 },
  { label: "Q3'22", value: 1280 },
  { label: "Q1'23", value: 1210 },
  { label: "Q3'23", value: 1480 },
  { label: "Q1'24", value: 1760 },
  { label: "Q3'24", value: 2140 },
  { label: "Q1'25", value: 2460 },
  { label: "Q3'25", value: 2890 },
]

const candlestickData: CandlestickData[] = [
  { label: "Mon", open: 142, close: 148, high: 151, low: 140 },
  { label: "Tue", open: 148, close: 144, high: 150, low: 142 },
  { label: "Wed", open: 144, close: 152, high: 155, low: 143 },
  { label: "Thu", open: 152, close: 158, high: 160, low: 150 },
  { label: "Fri", open: 158, close: 154, high: 162, low: 152 },
  { label: "Sat", open: 154, close: 163, high: 166, low: 153 },
  { label: "Sun", open: 163, close: 168, high: 172, low: 161 },
]

const mapRegions: MapRegion[] = [
  { id: "na", value: 82, label: "North America" },
  { id: "eu", value: 64, label: "Europe" },
  { id: "east-asia", value: 78, label: "East Asia" },
  { id: "south-asia", value: 45, label: "South Asia" },
  { id: "mideast", value: 38, label: "Middle East" },
  { id: "africa", value: 22, label: "Africa" },
]

const tickerItems: TickerItem[] = [
  { symbol: "SPX", value: "5,420.8", change: "+1.2%", positive: true },
  { symbol: "NDX", value: "18,960.4", change: "+1.8%", positive: true },
  { symbol: "DXY", value: "104.32", change: "-0.3%", positive: false },
  { symbol: "XAUUSD", value: "2,385", change: "+0.6%", positive: true },
  { symbol: "BTC", value: "67,840", change: "-2.1%", positive: false },
  { symbol: "VIX", value: "14.2", change: "-8.4%", positive: false },
]

const graphNodes: StructureNode[] = [
  { id: "liquidity", title: "流动性", subtitle: "Liquidity Regime", x: -420, y: -120, z: 80, tone: "gold" },
  { id: "rates", title: "利率路径", subtitle: "Rate Path", x: -120, y: -210, z: 40, tone: "amber" },
  { id: "earnings", title: "盈利修正", subtitle: "Earnings Revision", x: 210, y: -126, z: 95, tone: "purple" },
  { id: "risk", title: "风险溢价", subtitle: "Risk Premium", x: 430, y: 70, z: -10, tone: "magenta" },
  { id: "allocation", title: "资产配置", subtitle: "Allocation Map", x: 34, y: 146, z: 130, tone: "cold" },
  { id: "hedge", title: "尾部对冲", subtitle: "Tail Hedge", x: -320, y: 142, z: 30, tone: "gold" },
]

const graphEdges: StructureEdge[] = [
  { from: "liquidity", to: "rates" },
  { from: "rates", to: "earnings" },
  { from: "earnings", to: "risk" },
  { from: "risk", to: "allocation" },
  { from: "liquidity", to: "hedge" },
  { from: "hedge", to: "allocation" },
]

const treeRoot: TreeNode = {
  id: "macro",
  title: "宏观框架",
  subtitle: "MACRO FRAMEWORK",
  tone: "gold",
  children: [
    { id: "monetary", title: "货币政策", tone: "amber", children: [
      { id: "rates-tree", title: "利率", tone: "gold" },
      { id: "qe", title: "量化宽松", tone: "amber" },
    ]},
    { id: "fiscal", title: "财政政策", tone: "purple", children: [
      { id: "spending", title: "政府支出", tone: "purple" },
      { id: "tax", title: "税收", tone: "magenta" },
    ]},
  ],
}

const pyramidLayers: PyramidLayer[] = [
  { title: "系统性风险", subtitle: "Systemic Risk — tail events, contagion", value: "极端", tone: "magenta" },
  { title: "市场风险", subtitle: "Market Risk — volatility, drawdown", value: "β=1.2", tone: "purple" },
  { title: "信用风险", subtitle: "Credit Risk — default, spread", value: "BBB+", tone: "amber" },
  { title: "流动性风险", subtitle: "Liquidity Risk — bid-ask, depth", value: "中等", tone: "gold" },
]

const causalSteps: ChainStep[] = [
  { title: "央行加息", body: "抑制通胀", tone: "gold" },
  { title: "流动性收紧", body: "资金成本上升", tone: "amber" },
  { title: "估值压缩", body: "PE 下行", tone: "purple" },
  { title: "风险重定价", body: "波动率上升", tone: "magenta" },
]

const flowTargets: FlowTarget[] = [
  { title: "美股", value: "$1.2T", percentage: 42, tone: "purple" },
  { title: "美债", value: "$800B", percentage: 28, tone: "gold" },
  { title: "新兴市场", value: "$400B", percentage: 14, tone: "amber" },
  { title: "商品", value: "$300B", percentage: 10, tone: "magenta" },
  { title: "现金", value: "$180B", percentage: 6, tone: "cold" },
]

// ─── SHOWCASE ──────────────────────────────────────────────

export function CinematicFinanceShowcase() {
  const frame = useCurrentFrame()
  const titleIn = clampInterpolate(frame, [8, 44], [0, 1])
  const titleY = clampInterpolate(frame, [8, 44], [26, 0])

  // Cross-fade helper
  const seqOpacity = (start: number, duration: number) => {
    const fadeIn = clampInterpolate(frame, [start, start + 10], [0, 1])
    const fadeOut = clampInterpolate(frame, [start + duration - 10, start + duration], [1, 0])
    return Math.min(fadeIn, fadeOut)
  }

  return (
    <CinematicStage intensity={1.1}>
      <AbsoluteFill style={{ transformStyle: "preserve-3d" }}>
        {/* Title overlay */}
        <div
          style={{
            position: "absolute",
            left: 90,
            top: 70,
            opacity: titleIn,
            transform: `translateY(${titleY}px)`,
            zIndex: 5,
          }}
        >
          <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 12, letterSpacing: 2.8, color: cinematicTheme.colors.gold }}>
            CINEMATIC FINANCE COMPONENT SYSTEM
          </div>
          <div style={{ marginTop: 12, fontFamily: cinematicTheme.font.zh, fontSize: 52, lineHeight: 1.05, fontWeight: 900, color: "#fff" }}>
            金融 / 商业 / 科技<br />动态信息图组件
          </div>
          <div style={{ marginTop: 16, width: 520, fontSize: 15, lineHeight: 1.7, color: "rgba(234,236,239,0.62)" }}>
            Glass cards, volumetric charts, 3D structure maps, KPI HUD and camera rigs for Remotion timelines.
          </div>
        </div>

        {/* Seq 1: Concept Cards */}
        <Sequence from={0} durationInFrames={155}>
          <div style={{ opacity: seqOpacity(0, 155) }}>
            <SlowOrbit radius={2.8} speed={400} elevation={-1} floating={1.2}>
              <ConceptCardMatrix cards={conceptCards} delay={22} />
            </SlowOrbit>
          </div>
        </Sequence>

        {/* Seq 2: Charts */}
        <Sequence from={145} durationInFrames={150}>
          <div style={{ opacity: seqOpacity(145, 150) }}>
            <FocusPull nearBlur={0} farBlur={3} pullFrame={80} duration={150}>
              <CinematicLineChart data={lineData} title="资本轮动 / Capital Rotation" subtitle="Holographic area + glow line" delay={8} x={-240} y={20} z={50} tone="gold" />
              <CandlestickChart data={candlestickData} title="K线走势 / Price Action" delay={28} x={380} y={60} z={-60} tone="gold" width={520} height={320} />
              <PercentageRing value={72} label="RISK HEDGE" delay={48} x={420} y={-240} z={80} tone="amber" />
            </FocusPull>
          </div>
        </Sequence>

        {/* Seq 3: Structures */}
        <Sequence from={285} durationInFrames={145}>
          <div style={{ opacity: seqOpacity(285, 145) }}>
            <CinematicDollyZoom startScale={0.9} endScale={1.05} startFov={2000} endFov={1200} duration={145}>
              <FloatingNodeGraph nodes={graphNodes} edges={graphEdges} delay={8} />
            </CinematicDollyZoom>
          </div>
        </Sequence>

        {/* Seq 4: World Map + Ticker */}
        <Sequence from={420} durationInFrames={145}>
          <div style={{ opacity: seqOpacity(420, 145) }}>
            <SlowOrbit radius={3.5} speed={500} elevation={-3} floating={1}>
              <WorldMapHeatmap regions={mapRegions} title="全球资本热力 / Global Capital" subtitle="Regional allocation intensity" delay={8} y={-40} tone="gold" />
              <RealtimeTicker items={tickerItems} speed={1.5} delay={30} y={340} />
            </SlowOrbit>
          </div>
        </Sequence>

        {/* Seq 5: Pyramid + KPIs */}
        <Sequence from={555} durationInFrames={145}>
          <div style={{ opacity: seqOpacity(555, 145) }}>
            <CameraRig orbit={2} tilt={-4} floating={0.8}>
              <PyramidInfoScene layers={pyramidLayers} title="RISK HIERARCHY" delay={6} />
              <KpiBlock label="TOTAL AUM" value={4.8} prefix="$" suffix="T" x={-540} y={-280} z={100} delay={40} tone="gold" />
              <KpiBlock label="SHARPE RATIO" value={1.82} suffix="" x={540} y={-260} z={60} delay={50} tone="purple" />
            </CameraRig>
          </div>
        </Sequence>

        {/* Seq 6: Causal Chain + Capital Flow */}
        <Sequence from={690} durationInFrames={130}>
          <div style={{ opacity: seqOpacity(690, 130) }}>
            <CameraRig orbit={3} tilt={-2} floating={1.1}>
              <CausalChainScene steps={causalSteps} title="TRANSMISSION MECHANISM" delay={6} />
            </CameraRig>
          </div>
        </Sequence>

        {/* Seq 7: Finale — Capital Flow + Zoom Out */}
        <Sequence from={810} durationInFrames={90}>
          <div style={{ opacity: seqOpacity(810, 90) }}>
            <CinematicDollyZoom startScale={1.1} endScale={0.85} startFov={1200} endFov={2400} duration={90}>
              <CapitalFlowDiagram
                source={{ title: "全球资本", value: "$2.9T" }}
                targets={flowTargets}
                title="CAPITAL ALLOCATION"
                delay={4}
              />
            </CinematicDollyZoom>
          </div>
        </Sequence>
      </AbsoluteFill>
    </CinematicStage>
  )
}
```

- [ ] **Step 2: Update index.ts exports**

Replace entire `index.ts`:

```typescript
export { CinematicStage, CameraRig } from "./CinematicStage"
export type { CameraRigProps } from "./CinematicStage"
export { CinematicConceptCard, ConceptCardMatrix, PyramidConceptStack, FloatingConceptCards } from "./ConceptCards"
export type { CinematicConceptCardProps, ConceptCardData } from "./ConceptCards"
export { CinematicLineChart, CinematicBarChart, PercentageRing, CandlestickChart, WorldMapHeatmap, TimelineChart } from "./CinematicCharts"
export type { CinematicLineChartProps, DataPoint, CandlestickData, MapRegion, TimelineEvent } from "./CinematicCharts"
export { FloatingNodeGraph, TreeStructure, RadialStructure, TimelineStructure } from "./Structures"
export type { StructureEdge, StructureNode, TreeNode } from "./Structures"
export { KpiBlock, MarketTable, RealtimeTicker, RankingList, StatDashboard } from "./DataHud"
export type { TickerItem } from "./DataHud"
export { PyramidInfoScene, CausalChainScene, CapitalFlowDiagram, LayeredExplanation } from "./Infographics"
export type { PyramidLayer, ChainStep, FlowTarget, ExplanationLayer } from "./Infographics"
export { CinematicDollyZoom, FocusPull, SlowOrbit, ParallaxLayers } from "./Camera"
export type { DollyZoomProps, FocusPullProps, SlowOrbitProps, ParallaxLayersProps } from "./Camera"
export { CinematicFinanceShowcase } from "./CinematicFinanceShowcase"
export { cinematicTheme, toneColor, noiseFilterId, volumetricGlow, colorMix } from "./theme"
export type { CinematicTone } from "./theme"
export { clampInterpolate, softSpring, loopSine, particleTrail, noiseSeed, smoothStep, stagger, formatCompactNumber } from "./motion"
```

- [ ] **Step 3: Update Root.tsx — increase duration to 900 frames**

```typescript
import { Composition } from "remotion"
import { CinematicFinanceShowcase } from "./cinematic"

export function RemotionRoot() {
  return (
    <Composition
      id="CinematicFinanceShowcase"
      component={CinematicFinanceShowcase}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
    />
  )
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd packages/presentation/example && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Render test still at multiple frames**

```bash
cd packages/presentation/example
npx remotion still src/remotion-entry.tsx CinematicFinanceShowcase --frame=80 --scale=0.25 --output=test-seq1.png
npx remotion still src/remotion-entry.tsx CinematicFinanceShowcase --frame=220 --scale=0.25 --output=test-seq2.png
npx remotion still src/remotion-entry.tsx CinematicFinanceShowcase --frame=480 --scale=0.25 --output=test-seq4.png
npx remotion still src/remotion-entry.tsx CinematicFinanceShowcase --frame=650 --scale=0.25 --output=test-seq5.png
npx remotion still src/remotion-entry.tsx CinematicFinanceShowcase --frame=850 --scale=0.25 --output=test-seq7.png
```

Expected: 5 PNG files generated without errors, showing different sequences

- [ ] **Step 6: Clean up test files and commit**

```bash
rm -f packages/presentation/example/test-*.png
git add packages/presentation/example/src/cinematic/CinematicFinanceShowcase.tsx packages/presentation/example/src/cinematic/index.ts packages/presentation/example/src/Root.tsx
git commit -m "feat(cinematic): update showcase 7 sequences 900 frames, update all exports"
```

---
