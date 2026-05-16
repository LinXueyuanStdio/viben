import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import { clampInterpolate, loopSine, softSpring, stagger } from "./motion"

/* ─────────────────────────────────────────────────────────────────────────────
   WorldRouteMap — SVG world map outline with animated route paths
   ───────────────────────────────────────────────────────────────────────────── */

interface RouteItem {
  from: { x: number; y: number }
  to: { x: number; y: number }
  label?: string
  tone?: CinematicTone
}

interface CityItem {
  x: number
  y: number
  name: string
}

export function WorldRouteMap({
  routes,
  cities = [],
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
}: {
  routes: RouteItem[]
  cities?: CityItem[]
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

  // Simplified world map outline paths (continents)
  const worldOutline =
    "M80,120 Q100,100 130,105 L160,100 Q180,95 200,100 L220,110 Q240,115 250,130 L240,145 Q230,155 210,150 L180,145 Q160,140 140,145 L120,150 Q100,145 85,135 Z " +
    "M270,90 Q300,80 340,85 L380,90 Q420,85 460,90 L500,100 Q520,110 530,130 L520,150 Q510,165 490,170 L460,168 Q430,165 400,160 L370,155 Q340,150 320,145 L290,140 Q270,135 265,120 Z " +
    "M540,100 Q570,90 610,95 L650,100 Q680,105 700,115 L710,130 Q715,145 700,160 L680,170 Q660,175 640,172 L610,168 Q580,162 560,155 L545,140 Q535,125 540,100 Z " +
    "M150,200 Q170,195 190,200 L210,210 Q220,220 215,235 L200,250 Q185,260 170,255 L155,240 Q145,225 150,200 Z " +
    "M600,180 Q630,175 660,180 L690,190 Q710,200 720,220 L715,240 Q705,260 680,270 L650,275 Q620,272 600,260 L585,240 Q580,220 585,200 Z"

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 800,
        height: 420,
        marginLeft: -400,
        marginTop: -210,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 240}px) rotateX(${12 - enter * 6}deg) rotateY(${-4 + enter * 2}deg)`,
        borderRadius: 22,
        background: "linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)), rgba(10,10,15,0.62)",
        border: `1px solid ${accent}30`,
        boxShadow: `0 32px 80px rgba(0,0,0,0.5), 0 0 40px ${accent}18, inset 0 1px 0 rgba(255,255,255,0.14)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
        padding: 24,
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 800 380" fill="none">
        {/* World outline */}
        <path
          d={worldOutline}
          fill="none"
          stroke={`${accent}30`}
          strokeWidth={1}
          opacity={enter * 0.6}
        />
        {/* Grid lines */}
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={76 * i}
            x2={800}
            y2={76 * i}
            stroke="rgba(234,236,239,0.06)"
            strokeWidth={0.5}
          />
        ))}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <line
            key={`v${i}`}
            x1={100 * i}
            y1={0}
            x2={100 * i}
            y2={380}
            stroke="rgba(234,236,239,0.06)"
            strokeWidth={0.5}
          />
        ))}

        {/* Routes */}
        {routes.map((route, index) => {
          const routeDelay = delay + stagger(index, routes.length, 24)
          const progress = clampInterpolate(frame, [routeDelay + 8, routeDelay + 38], [0, 1])
          const routeAccent = toneColor(route.tone ?? tone)
          const midX = (route.from.x + route.to.x) / 2
          const midY = Math.min(route.from.y, route.to.y) - 40 - Math.abs(route.to.x - route.from.x) * 0.1
          const pathD = `M${route.from.x},${route.from.y} Q${midX},${midY} ${route.to.x},${route.to.y}`
          const dashLength = 600
          const glow = 0.4 + loopSine(frame, 48, index * 7) * 0.2

          return (
            <g key={index} opacity={progress}>
              {/* Route glow */}
              <path
                d={pathD}
                fill="none"
                stroke={routeAccent}
                strokeWidth={3}
                strokeDasharray={dashLength}
                strokeDashoffset={dashLength * (1 - progress)}
                opacity={glow}
                filter="url(#routeGlow)"
              />
              {/* Route line */}
              <path
                d={pathD}
                fill="none"
                stroke={routeAccent}
                strokeWidth={1.5}
                strokeDasharray={dashLength}
                strokeDashoffset={dashLength * (1 - progress)}
              />
              {/* Traveling particle */}
              {progress > 0.1 && (
                <circle
                  cx={route.from.x + (route.to.x - route.from.x) * ((frame - routeDelay) % 40) / 40}
                  cy={route.from.y + (route.to.y - route.from.y) * ((frame - routeDelay) % 40) / 40 - Math.sin(((frame - routeDelay) % 40) / 40 * Math.PI) * Math.abs(midY - route.from.y)}
                  r={2.5}
                  fill={routeAccent}
                  opacity={0.9}
                >
                  <animate attributeName="opacity" values="0.9;0.4;0.9" dur="1s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Label */}
              {route.label && progress > 0.5 && (
                <text
                  x={midX}
                  y={midY - 10}
                  textAnchor="middle"
                  fill={routeAccent}
                  fontSize={10}
                  fontFamily={cinematicTheme.font.mono}
                  opacity={clampInterpolate(frame, [routeDelay + 20, routeDelay + 32], [0, 0.8])}
                >
                  {route.label}
                </text>
              )}
            </g>
          )
        })}

        {/* Cities */}
        {cities.map((city, index) => {
          const cityDelay = delay + 4 + index * 3
          const cityEnter = softSpring(frame, fps, cityDelay)
          const pulse = 0.6 + loopSine(frame, 36, index * 11) * 0.3
          return (
            <g key={city.name} opacity={cityEnter}>
              <circle cx={city.x} cy={city.y} r={6} fill={`${accent}20`} opacity={pulse} />
              <circle cx={city.x} cy={city.y} r={3} fill={accent} opacity={0.9} />
              <text
                x={city.x}
                y={city.y - 10}
                textAnchor="middle"
                fill="rgba(234,236,239,0.72)"
                fontSize={9}
                fontFamily={cinematicTheme.font.mono}
                letterSpacing={0.8}
              >
                {city.name}
              </text>
            </g>
          )
        })}

        {/* Filter definitions */}
        <defs>
          <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   RegionHighlight — Rectangular regions that pulse/highlight on a map
   ───────────────────────────────────────────────────────────────────────────── */

interface RegionItem {
  x: number
  y: number
  width: number
  height: number
  label: string
  value?: string
  tone?: CinematicTone
}

export function RegionHighlight({
  regions,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
}: {
  regions: RegionItem[]
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

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 720,
        height: 400,
        marginLeft: -360,
        marginTop: -200,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 200}px) rotateX(${10 - enter * 5}deg)`,
        borderRadius: 20,
        background: "linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02)), rgba(10,10,15,0.58)",
        border: `1px solid ${accent}28`,
        boxShadow: `0 28px 72px rgba(0,0,0,0.48), 0 0 36px ${accent}14, inset 0 1px 0 rgba(255,255,255,0.12)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
      }}
    >
      {/* Background grid */}
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", left: 0, top: 0 }}
        viewBox="0 0 720 400"
        fill="none"
      >
        {Array.from({ length: 9 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={i * 50}
            x2={720}
            y2={i * 50}
            stroke="rgba(234,236,239,0.04)"
            strokeWidth={0.5}
          />
        ))}
        {Array.from({ length: 15 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={i * 50}
            y1={0}
            x2={i * 50}
            y2={400}
            stroke="rgba(234,236,239,0.04)"
            strokeWidth={0.5}
          />
        ))}
      </svg>

      {/* Regions */}
      {regions.map((region, index) => {
        const regionDelay = delay + stagger(index, regions.length, 20)
        const regionEnter = softSpring(frame, fps, regionDelay)
        const regionAccent = toneColor(region.tone ?? tone)
        const pulse = 0.3 + loopSine(frame, 44, index * 13) * 0.15
        const glowIntensity = 0.4 + loopSine(frame, 56, index * 9) * 0.2

        return (
          <div
            key={region.label}
            style={{
              position: "absolute",
              left: region.x,
              top: region.y,
              width: region.width,
              height: region.height,
              opacity: regionEnter,
              transform: `scale(${0.85 + regionEnter * 0.15})`,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${regionAccent}${Math.round(pulse * 255).toString(16).padStart(2, "0")}, transparent)`,
              border: `1.5px solid ${regionAccent}60`,
              boxShadow: `0 0 ${24 * glowIntensity}px ${regionAccent}30, inset 0 0 ${16 * glowIntensity}px ${regionAccent}10`,
              transition: "none",
            }}
          >
            {/* Corner marks */}
            <div style={{ position: "absolute", left: -1, top: -1, width: 8, height: 8, borderTop: `2px solid ${regionAccent}`, borderLeft: `2px solid ${regionAccent}` }} />
            <div style={{ position: "absolute", right: -1, top: -1, width: 8, height: 8, borderTop: `2px solid ${regionAccent}`, borderRight: `2px solid ${regionAccent}` }} />
            <div style={{ position: "absolute", left: -1, bottom: -1, width: 8, height: 8, borderBottom: `2px solid ${regionAccent}`, borderLeft: `2px solid ${regionAccent}` }} />
            <div style={{ position: "absolute", right: -1, bottom: -1, width: 8, height: 8, borderBottom: `2px solid ${regionAccent}`, borderRight: `2px solid ${regionAccent}` }} />

            {/* Label */}
            <div
              style={{
                position: "absolute",
                left: 8,
                top: -20,
                fontFamily: cinematicTheme.font.mono,
                fontSize: 9,
                letterSpacing: 1.2,
                color: regionAccent,
                textShadow: `0 0 10px ${regionAccent}60`,
                whiteSpace: "nowrap",
              }}
            >
              {region.label}
            </div>

            {/* Value badge */}
            {region.value && (
              <div
                style={{
                  position: "absolute",
                  right: 6,
                  bottom: 6,
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: "rgba(10,10,15,0.7)",
                  border: `1px solid ${regionAccent}40`,
                  fontFamily: cinematicTheme.font.mono,
                  fontSize: 11,
                  fontWeight: 700,
                  color: regionAccent,
                  textShadow: `0 0 8px ${regionAccent}50`,
                }}
              >
                {region.value}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   HeatmapGlobe — Stylized circular globe with grid lines and heat spots
   ───────────────────────────────────────────────────────────────────────────── */

export function HeatmapGlobe({
  hotspots,
  rotation = 0,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
}: {
  hotspots: Array<{ lat: number; lng: number; intensity: number; label?: string }>
  rotation?: number
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
  const globeRadius = 160
  const cx = 200
  const cy = 200

  // Slow rotation
  const rotAngle = rotation + frame * 0.3

  // Convert lat/lng to x/y on the globe circle
  function latLngToXY(lat: number, lng: number): { x: number; y: number; visible: boolean } {
    const lngRad = ((lng + rotAngle) * Math.PI) / 180
    const latRad = (lat * Math.PI) / 180
    const projX = cx + globeRadius * Math.cos(latRad) * Math.sin(lngRad)
    const projY = cy - globeRadius * Math.sin(latRad)
    const visible = Math.cos(lngRad) > -0.2
    return { x: projX, y: projY, visible }
  }

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 400,
        height: 400,
        marginLeft: -200,
        marginTop: -200,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 220}px) rotateX(${8 - enter * 4}deg) rotateY(${-6 + enter * 3}deg)`,
        borderRadius: "50%",
        background: "radial-gradient(circle at 35% 35%, rgba(40,40,60,0.6), rgba(10,10,15,0.85))",
        border: `1px solid ${accent}25`,
        boxShadow: `0 0 80px ${accent}12, 0 24px 60px rgba(0,0,0,0.5), inset 0 0 60px rgba(0,0,0,0.3)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 400 400" fill="none">
        {/* Globe outline */}
        <circle cx={cx} cy={cy} r={globeRadius} stroke={`${accent}30`} strokeWidth={1.5} fill="none" />
        <circle cx={cx} cy={cy} r={globeRadius} fill={`${accent}04`} />

        {/* Latitude lines */}
        {[-60, -30, 0, 30, 60].map((lat) => {
          const latRad = (lat * Math.PI) / 180
          const r = globeRadius * Math.cos(latRad)
          const yOff = cy - globeRadius * Math.sin(latRad)
          return (
            <ellipse
              key={`lat${lat}`}
              cx={cx}
              cy={yOff}
              rx={r}
              ry={r * 0.3}
              stroke="rgba(234,236,239,0.08)"
              strokeWidth={0.5}
              fill="none"
            />
          )
        })}

        {/* Longitude lines */}
        {[0, 30, 60, 90, 120, 150].map((lng) => {
          const lngRad = ((lng + rotAngle) * Math.PI) / 180
          const rx = Math.abs(globeRadius * Math.sin(lngRad)) * 0.3
          return (
            <ellipse
              key={`lng${lng}`}
              cx={cx + globeRadius * Math.sin(lngRad) * 0.02}
              cy={cy}
              rx={Math.max(1, rx)}
              ry={globeRadius}
              stroke="rgba(234,236,239,0.06)"
              strokeWidth={0.5}
              fill="none"
              opacity={Math.abs(Math.cos(lngRad)) * 0.8 + 0.2}
            />
          )
        })}

        {/* Hotspots */}
        {hotspots.map((spot, index) => {
          const spotDelay = delay + 10 + stagger(index, hotspots.length, 18)
          const spotEnter = softSpring(frame, fps, spotDelay)
          const { x: sx, y: sy, visible } = latLngToXY(spot.lat, spot.lng)
          const pulse = 0.5 + loopSine(frame, 32 + index * 4, index * 5) * 0.4
          const size = 6 + spot.intensity * 14
          const spotAccent = accent

          if (!visible) return null

          return (
            <g key={index} opacity={spotEnter * (visible ? 1 : 0.3)}>
              {/* Outer glow */}
              <circle
                cx={sx}
                cy={sy}
                r={size * pulse}
                fill={`${spotAccent}18`}
                stroke={`${spotAccent}30`}
                strokeWidth={0.5}
              />
              {/* Inner core */}
              <circle
                cx={sx}
                cy={sy}
                r={size * 0.35}
                fill={spotAccent}
                opacity={0.7 + pulse * 0.3}
              />
              {/* Intensity ring */}
              <circle
                cx={sx}
                cy={sy}
                r={size * 0.7 * pulse}
                fill="none"
                stroke={spotAccent}
                strokeWidth={1}
                opacity={0.4}
                strokeDasharray="3 3"
              />
              {/* Label */}
              {spot.label && (
                <text
                  x={sx}
                  y={sy - size - 4}
                  textAnchor="middle"
                  fill="rgba(234,236,239,0.7)"
                  fontSize={8}
                  fontFamily={cinematicTheme.font.mono}
                  letterSpacing={0.6}
                  opacity={spotEnter}
                >
                  {spot.label}
                </text>
              )}
            </g>
          )
        })}

        {/* Ambient glow at center */}
        <radialGradient id="globeAmbient">
          <stop offset="0%" stopColor={accent} stopOpacity="0.08" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <circle cx={cx} cy={cy} r={globeRadius * 0.7} fill="url(#globeAmbient)" />
      </svg>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   MigrationFlow — Animated curved arrows with particles showing directional flow
   ───────────────────────────────────────────────────────────────────────────── */

interface FlowItem {
  from: { x: number; y: number }
  to: { x: number; y: number }
  value: number
  tone?: CinematicTone
}

export function MigrationFlow({
  flows,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
}: {
  flows: FlowItem[]
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
  const maxValue = Math.max(...flows.map((f) => f.value), 1)

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 760,
        height: 440,
        marginLeft: -380,
        marginTop: -220,
        opacity: enter,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z - (1 - enter) * 230}px) rotateX(${10 - enter * 5}deg) rotateY(${-3 + enter * 1.5}deg)`,
        borderRadius: 22,
        background: "linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)), rgba(10,10,15,0.6)",
        border: `1px solid ${accent}28`,
        boxShadow: `0 30px 78px rgba(0,0,0,0.48), 0 0 38px ${accent}14, inset 0 1px 0 rgba(255,255,255,0.13)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 760 440" fill="none">
        {/* Background grid */}
        {Array.from({ length: 9 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={i * 55}
            x2={760}
            y2={i * 55}
            stroke="rgba(234,236,239,0.04)"
            strokeWidth={0.5}
          />
        ))}
        {Array.from({ length: 15 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={i * 55}
            y1={0}
            x2={i * 55}
            y2={440}
            stroke="rgba(234,236,239,0.04)"
            strokeWidth={0.5}
          />
        ))}

        {/* Arrow marker definition */}
        <defs>
          {flows.map((flow, i) => {
            const flowAccent = toneColor(flow.tone ?? tone)
            return (
              <marker
                key={`arrow${i}`}
                id={`flowArrow${i}`}
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
              >
                <polygon points="0,0 8,3 0,6" fill={flowAccent} opacity="0.7" />
              </marker>
            )
          })}
          <filter id="flowGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Flows */}
        {flows.map((flow, index) => {
          const flowDelay = delay + stagger(index, flows.length, 22)
          const flowEnter = softSpring(frame, fps, flowDelay)
          const flowAccent = toneColor(flow.tone ?? tone)
          const strokeW = 1 + (flow.value / maxValue) * 3

          // Curved path control point
          const dx = flow.to.x - flow.from.x
          const dy = flow.to.y - flow.from.y
          const perpX = -dy * 0.25
          const perpY = dx * 0.25
          const ctrlX = (flow.from.x + flow.to.x) / 2 + perpX
          const ctrlY = (flow.from.y + flow.to.y) / 2 + perpY
          const pathD = `M${flow.from.x},${flow.from.y} Q${ctrlX},${ctrlY} ${flow.to.x},${flow.to.y}`

          // Path length estimation for dash animation
          const pathLen = Math.sqrt(dx * dx + dy * dy) * 1.3

          // Particle positions along the curve
          const particleCount = Math.max(2, Math.round(flow.value / maxValue * 4))

          return (
            <g key={index} opacity={flowEnter}>
              {/* Flow glow */}
              <path
                d={pathD}
                fill="none"
                stroke={flowAccent}
                strokeWidth={strokeW + 3}
                opacity={0.15}
                strokeDasharray={pathLen}
                strokeDashoffset={pathLen * (1 - flowEnter)}
                filter="url(#flowGlow)"
              />
              {/* Flow line */}
              <path
                d={pathD}
                fill="none"
                stroke={flowAccent}
                strokeWidth={strokeW}
                opacity={0.7}
                strokeDasharray={pathLen}
                strokeDashoffset={pathLen * (1 - flowEnter)}
                markerEnd={`url(#flowArrow${index})`}
              />

              {/* Traveling particles */}
              {Array.from({ length: particleCount }, (_, pi) => {
                const particleT = ((frame * 1.5 + pi * (60 / particleCount)) % 60) / 60
                // Quadratic bezier point at t
                const t = particleT
                const px = (1 - t) * (1 - t) * flow.from.x + 2 * (1 - t) * t * ctrlX + t * t * flow.to.x
                const py = (1 - t) * (1 - t) * flow.from.y + 2 * (1 - t) * t * ctrlY + t * t * flow.to.y
                const particleOpacity = Math.sin(t * Math.PI) * 0.9

                return (
                  <circle
                    key={pi}
                    cx={px}
                    cy={py}
                    r={1.5 + (flow.value / maxValue) * 1.5}
                    fill={flowAccent}
                    opacity={particleOpacity * flowEnter}
                  />
                )
              })}

              {/* Source node */}
              <circle cx={flow.from.x} cy={flow.from.y} r={5} fill={`${flowAccent}30`} stroke={flowAccent} strokeWidth={1.5} opacity={flowEnter} />
              <circle cx={flow.from.x} cy={flow.from.y} r={2.5} fill={flowAccent} opacity={flowEnter * 0.8} />

              {/* Destination node */}
              <circle cx={flow.to.x} cy={flow.to.y} r={5} fill={`${flowAccent}30`} stroke={flowAccent} strokeWidth={1.5} opacity={flowEnter} />
              <circle cx={flow.to.x} cy={flow.to.y} r={2.5} fill={flowAccent} opacity={flowEnter * 0.8} />

              {/* Value label */}
              <text
                x={ctrlX}
                y={ctrlY - 10}
                textAnchor="middle"
                fill={flowAccent}
                fontSize={10}
                fontFamily={cinematicTheme.font.mono}
                fontWeight={700}
                opacity={clampInterpolate(frame, [flowDelay + 14, flowDelay + 26], [0, 0.85])}
              >
                {flow.value.toLocaleString()}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
