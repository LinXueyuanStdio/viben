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
