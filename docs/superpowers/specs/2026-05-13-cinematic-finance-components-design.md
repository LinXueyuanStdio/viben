# Cinematic Finance Component System - Enhancement Design

## Overview

增强 `packages/presentation/example/src/cinematic/` 中的 Remotion 视频组件系统，达到 Netflix 金融纪录片 / Bloomberg Terminal 未来版 / Apple Keynote 级别的视觉标准。

**方案**: 增强现有组件 + 新增 2 个文件（Infographics.tsx, Camera.tsx）
**组织**: 按模块分文件（方案 A）
**目标**: 30 秒 showcase（~900 frames @ 30fps, 1920x1080）
**依赖**: 无新外部依赖，Remotion 4.x（Chromium 111+）
**性能**: 所有粒子使用数学位置计算（纯函数返回坐标数组），非 React state/DOM 生成销毁

---

## File Structure

```
cinematic/
├── theme.ts              ← 增强：noise/volumetric helpers
├── motion.ts             ← 增强：particle/stagger/smoothStep
├── CinematicStage.tsx    ← 增强：VolumetricFog, 粒子密度
├── ConceptCards.tsx       ← 增强：噪声纹理、金属描边、FloatingLayout
├── CinematicCharts.tsx   ← 增强：粒子拖尾 + 新增 Candlestick/WorldMap/Timeline
├── Structures.tsx        ← 增强：粒子流连线 + 新增 Tree/Radial/Timeline
├── DataHud.tsx           ← 增强：扫描线 + 新增 Ticker/Ranking/StatDashboard
├── Infographics.tsx      ← [NEW] 金字塔/因果链/资本流向/多层解释
├── Camera.tsx            ← [NEW] DollyZoom/FocusPull/SlowOrbit/ParallaxLayers
├── CinematicFinanceShowcase.tsx ← 更新：7 Sequences
└── index.ts              ← 更新：导出新组件
```

---

## Color System

| Name | Hex | Usage |
|------|-----|-------|
| Deep Black | `#0B0B0F` | 主背景 |
| Graphite | `#1A1A22` | 次级背景 |
| Gold | `#D6B36A` | 主要高亮、金融 |
| Purple | `#7A5AF8` | 科技、结构 |
| Magenta | `#FF3D8E` | 风险、警示 |
| Amber | `#F6C453` | 数据、增长 |
| Cold White | `#EAECEF` | 文字、中性 |

整体低饱和、电影调色。禁止鲜艳互联网配色。

---

## Section 1: Foundation Layer

### theme.ts 增强

```typescript
// 新增
export function noiseFilterId(seed: number): string
// 返回 filter ID string (e.g. "noise-42")
// 对应的 <filter> 定义由 CinematicStage 内的 <NoiseFilterDefs /> 统一渲染在共享 <svg> defs 中
// 组件通过 style={{ filter: `url(#${noiseFilterId(seed)})` }} 引用

export function volumetricGlow(color: string, radius: number, opacity: number): string
// 返回 radial-gradient CSS string

export function colorMix(color: string, opacity: number): string
// 返回 color-mix(in srgb, color opacity%, transparent) string
// 需要 Remotion 4.x (Chromium 111+)
```

### motion.ts 增强

```typescript
// 新增
export function particleTrail(frame: number, count: number, config: {
  spread: number; speed: number; decay: number;
  phase?: number  // 时间偏移量，防止多个粒子系统同步（不同 phase 值产生不同动画相位）
}): Array<{ x: number; y: number; opacity: number; size: number }>
// 纯函数：返回 count 个粒子的当前帧位置，用于 map 渲染，不涉及 state

export function noiseSeed(x: number, y: number): number
// 伪随机值 [0,1]，确定性（基于坐标的 hash）

export function smoothStep(t: number): number
// Hermite 插值：3t² - 2t³

export function stagger(index: number, total: number, totalDelay: number): number
// 返回第 index 个元素的延迟帧数
```

### CinematicStage.tsx 增强

- `FloatingParticles`: 数量 46→72，增加 z 轴分层（-400 ~ +200）
- 新增 `<VolumetricFog />`:
  - 底部 1/3 区域半透明径向雾
  - 随 frame 缓慢 X/Y 漂移
  - 双层：暖色调（gold 10%）+ 冷色调（purple 6%）
- 光扫描增强：
  - 第一层：宽 360px, 慢速 240 帧周期
  - 第二层：窄 120px, 快速 180 帧周期, 反向角度

### Camera.tsx [NEW]

**与现有 CameraRig 的关系**: Camera.tsx 中的组件是高级摄影机预设，内部使用/组合现有 `CameraRig` 作为基础层。`CameraRig` 保持不变，继续作为低级别 API 使用。新组件是更高级别的 wrapper，提供特定镜头语言（dolly zoom, focus pull 等）。在 Showcase 中可混用：简单场景用 CameraRig，复杂镜头用 Camera.tsx 预设。

**Timing 模型说明**: 视觉元素组件（cards, charts 等）使用 `delay` 表示入场偏移；Camera 组件使用 `duration` 表示镜头运动总时长。Camera 组件同样支持 `delay` 作为启动偏移。这两类组件职责不同：视觉元素是"被拍摄物"，Camera 是"镜头"。

```typescript
export interface DollyZoomProps {
  children: ReactNode
  startScale: number    // 起始缩放 (e.g. 0.8)
  endScale: number      // 终止缩放 (e.g. 1.2)
  startFov: number      // 起始 perspective (e.g. 2400)
  endFov: number        // 终止 perspective (e.g. 900)
  duration: number      // 镜头运动总帧数
  delay?: number        // 启动偏移帧数
}
export function CinematicDollyZoom(props: DollyZoomProps): JSX.Element

export interface FocusPullProps {
  children: ReactNode
  nearBlur: number      // 近景模糊 px
  farBlur: number       // 远景模糊 px
  pullFrame: number     // 焦点切换的帧
  duration: number
  delay?: number
}
export function FocusPull(props: FocusPullProps): JSX.Element

export interface SlowOrbitProps {
  children: ReactNode
  radius: number        // 轨道半径 (deg)
  speed: number         // 周期 (frames per revolution)
  elevation: number     // 俯角 (deg)
  floating?: number     // 漂浮幅度
  delay?: number
}
export function SlowOrbit(props: SlowOrbitProps): JSX.Element

export interface ParallaxLayersProps {
  layers: Array<{
    children: ReactNode
    depth: number       // 0=最近, 1=最远
    blur?: number       // 景深模糊
  }>
  moveX?: number        // 水平视差量
  moveY?: number        // 垂直视差量
  delay?: number
}
export function ParallaxLayers(props: ParallaxLayersProps): JSX.Element
```

---

## Section 2: Visual Components

### ConceptCards.tsx 增强

**现有 CinematicConceptCard 增强：**
- 背景层增加 SVG `<feTurbulence baseFrequency="0.65" numOctaves="4">` 噪声
- 噪声层 opacity: 0.03-0.06，mixBlendMode: "overlay"
- 内阴影加深：`inset 0 -40px 100px rgba(0,0,0,0.35)`
- 光泽扫过：增加第二层（宽 40px, delay 40 frames, opacity 0.5）
- Border：使用双层 linear-gradient 模拟金属光泽反射

**新增 FloatingConceptCards：**
```typescript
export function FloatingConceptCards({
  cards,
  centerX?: number,
  centerY?: number,
  centerZ?: number,     // 中心 z 轴偏移
  radius?: number,      // 环绕半径 (px)
  rotateSpeed?: number, // 环绕速度 (degrees per frame)
  delay?: number,
}: { cards: ConceptCardData[]; ... }): JSX.Element
```
卡片在 3D 空间中环绕中心点漂浮，适合包围人物或主题的场景。每张卡片的 tone 由 ConceptCardData 自身决定。

### CinematicCharts.tsx 增强 + 新组件

**CinematicLineChart 增强：**
- 数据点点亮时生成 6-8 个粒子向外发散（使用 particleTrail）
- 粒子颜色继承 tone accent
- 粒子生命周期 20 帧，opacity 衰减

**CinematicBarChart 增强：**
- 柱体增加顶面：skewX 渲染的梯形面（模拟 3D 顶面）
- 顶面颜色比正面亮 20%

**PercentageRing 增强：**
- 外圈增加 8 个微光点环绕动画
- 光点速度随 progress 加速

**新增 CandlestickChart：**
```typescript
export interface CandlestickData {
  label: string
  open: number
  close: number
  high: number
  low: number
}
export function CandlestickChart({
  data: CandlestickData[]
  title: string
  subtitle?: string
  x?: number; y?: number; z?: number
  width?: number; height?: number
  delay?: number
  tone?: CinematicTone
}): JSX.Element
```
- 阳线 (close > open): accent color, 阴线: magenta
- 影线发光，实体半透明填充
- 逐根 spring 入场

**新增 WorldMapHeatmap：**
```typescript
export interface MapRegion {
  id: "na" | "sa" | "eu" | "africa" | "mideast" | "south-asia" | "east-asia" | "oceania"
  value: number        // 0-100 热力值
  label: string
}
export function WorldMapHeatmap({
  regions: MapRegion[]
  title: string
  subtitle?: string
  delay?: number
  tone?: CinematicTone
}): JSX.Element
```
- SVG viewBox: `0 0 1200 600`
- 8 个简化区域 path（实现时内联，每个 path 约 100-300 chars 的简化轮廓）
- 地图 path 数据在组件内以常量 `MAP_PATHS: Record<string, string>` 存储
- 热力值映射到 accent 颜色 opacity（value/100 * maxOpacity）
- 区域逐个点亮（stagger delay）+ 发光扩散（drop-shadow）
- 数值标注浮于区域重心上方

**新增 TimelineChart：**
```typescript
export interface TimelineEvent {
  date: string
  label: string
  value?: number
  tone?: CinematicTone
}
export function TimelineChart({
  events: TimelineEvent[]
  title: string
  delay?: number
}): JSX.Element
```
- 水平时间轴，节点分布在轴线上下
- 轴线逐段绘制 + 节点逐个弹出
- 连接线发光

### Structures.tsx 新增

**所有连线增强：粒子流动画**
- 现有 FloatingNodeGraph 的边增加移动光点（3-5 个/边）
- 光点沿贝塞尔路径匀速移动
- 循环往复

**新增 TreeStructure：**
```typescript
export interface TreeNode {
  id: string
  title: string
  subtitle?: string
  tone?: CinematicTone
  children?: TreeNode[]
}
export function TreeStructure({
  root: TreeNode
  delay?: number
  tone?: CinematicTone       // 默认 tone（节点未指定时使用）
  orientation?: "vertical" | "horizontal"
}): JSX.Element
```
- 从根向外展开
- 动画：根先出现 → 连线绘制 → 子节点依次弹出
- 布局算法：简化 Reingold-Tilford，水平间距 220px，垂直间距 150px，子树居中
- 最大支持 3 层深度、每层 4 节点（超出截断）

**新增 RadialStructure：**
```typescript
export interface RadialOrbit {
  radius: number
  nodes: StructureNode[]
}
export function RadialStructure({
  center: StructureNode
  orbits: RadialOrbit[]
  delay?: number
  tone?: CinematicTone       // 默认 tone
}): JSX.Element
```
- 中心节点 + 环形分布
- 动画：中心脉冲 → 连线射出 → 环绕节点逐个亮
- 整体缓慢旋转

**新增 TimelineStructure：**
```typescript
export function TimelineStructure({
  events: Array<{ id: string; title: string; subtitle?: string; tone?: CinematicTone }>
  delay?: number
  tone?: CinematicTone       // 默认 tone
  direction?: "horizontal" | "vertical"
}): JSX.Element
```
- 节点沿直线排列，连线串联
- 逐节点激活 + 所有子元素整体 translateX 模拟 camera 跟随（非真实 viewport 移动）
- 与 TimelineChart 的区别：TimelineStructure 用于定性流程展示，TimelineChart 用于定量时间序列数据可视化

### DataHud.tsx 增强 + 新组件

**KpiBlock 增强：**
- 数值变化时触发水平扫描线（从上到下，单次）
- 扫描线颜色 = accent, opacity 0.3, blur 2px

**MarketTable 增强：**
- 行 reveal 时左侧增加 2px 宽光条扫入（从上到下，delay stagger）

**新增 RealtimeTicker：**
```typescript
export interface TickerItem {
  symbol: string
  value: string
  change: string
  positive: boolean
}
export function RealtimeTicker({
  items: TickerItem[]
  speed?: number        // px per frame
  delay?: number
}): JSX.Element
```
- 横向滚动跑马灯
- 涨跌颜色区分（gold/magenta）
- 背景半透明玻璃条

**新增 RankingList：**
```typescript
export function RankingList({
  items: Array<{ rank: number; name: string; value: string; tone?: CinematicTone }>
  title: string
  delay?: number
}): JSX.Element
```
- 列表逐行 spring 入场
- 排名数字大号 accent 色
- 条形进度条背景

**新增 StatDashboard：**
```typescript
export function StatDashboard({
  metrics: Array<{ label: string; value: number; suffix?: string; tone?: CinematicTone }>
  columns?: number
  delay?: number
}): JSX.Element
```
- Grid 布局多个 KPI
- 统一入场 stagger

---

## Section 3: Infographics.tsx [NEW]

### PyramidInfoScene

**与现有 PyramidConceptStack 的关系**: `PyramidConceptStack`（ConceptCards.tsx）是卡片式金字塔，显示 metric 数值，适合数据展示。`PyramidInfoScene` 是信息图式金字塔，强调层级解释和叙事，带 volumetric fog 和 camera 动画，适合纪录片式概念解说。两者共存，用途不同。

```typescript
export interface PyramidLayer {
  title: string
  subtitle: string
  value?: string
  tone: CinematicTone
}
export function PyramidInfoScene({
  layers: PyramidLayer[]
  title: string
  delay?: number
}): JSX.Element
```

视觉效果：
- 每层独立面板，宽度从下到上递减
- 3D 透视倾斜（rotateX ~55deg）
- 动画：底层先 build → 逐层向上 → camera 缓慢 tilt up
- 每层边缘发光，颜色按 tone
- 层间有 volumetric fog 分隔

### CausalChainScene

```typescript
export interface ChainStep {
  title: string
  body?: string
  tone: CinematicTone
}
export function CausalChainScene({
  steps: ChainStep[]
  title: string
  layout?: "horizontal" | "s-curve"
  delay?: number
}): JSX.Element
```

视觉效果：
- 节点为圆角矩形（glassmorphism）
- 箭头为发光路径 + 流动粒子
- 动画：逐节点激活 → 箭头绘制 → 粒子开始流动
- S-curve 布局：节点交错分布，曲线连接

### CapitalFlowDiagram

```typescript
export interface FlowTarget {
  title: string
  value: string
  percentage: number
  tone: CinematicTone
}
export function CapitalFlowDiagram({
  source: { title: string; value: string }
  targets: FlowTarget[]
  title: string
  delay?: number
}): JSX.Element
```

视觉效果：
- 中心大节点（source）+ 环绕小节点（targets）
- 连接线宽度 proportional to percentage
- 动画：中心脉冲 → 射线射出 → targets 点亮 → 数值滚动
- 射线上有粒子流向 target

### LayeredExplanation

```typescript
export interface ExplanationLayer {
  depth: number         // 0-4, 0=最近
  title: string
  body: string
  tone: CinematicTone
}
export function LayeredExplanation({
  layers: ExplanationLayer[]
  title: string
  delay?: number
}): JSX.Element
```

视觉效果：
- 面板在 Z 轴不同深度
- 最远层半透明 + 高 blur
- 动画：从最远层开始出现 → 逐层向观众推进 → focus pull 到最近层
- 背景层自动 defocus

---

## Section 4: Showcase Composition

7 个 Sequence，总 900 帧（30s @ 30fps）：

| Seq | Frames | Content | Camera |
|-----|--------|---------|--------|
| 1 | 0-155 | Title + ConceptCardMatrix | SlowOrbit(2.8°) |
| 2 | 145-295 | LineChart + BarChart + Candlestick + Ring | FocusPull |
| 3 | 285-430 | FloatingNodeGraph + TreeStructure | DollyZoom |
| 4 | 420-565 | WorldMapHeatmap + RealtimeTicker | SlowOrbit(4°) |
| 5 | 555-700 | PyramidInfoScene + KPI blocks | CameraRig(tilt up) |
| 6 | 690-820 | CausalChain + CapitalFlow | ParallaxLayers |
| 7 | 810-900 | 终场：元素汇聚缩小 + 品牌落版 | DollyZoom(zoom out) |

---

## Animation Principles

所有组件遵循：
1. **入场**: spring (damping 24, stiffness 88) + blur 恢复 + z-depth 推进
2. **呼吸**: loopSine 持续微浮动（1-2px Y轴 + 0.3-0.5° rotation）
3. **光泽**: shimmer sweep 150 帧周期
4. **粒子**: 关键节点周围 6-8 个衰减粒子
5. **镜头**: 慢速、电影感、不使用短视频风格快速切换

---

## Sequence Transitions

Sequence 之间有 10 帧重叠，使用 opacity cross-fade：
- 上一个 Sequence 的最后 10 帧：opacity 从 1 → 0（使用 clampInterpolate）
- 下一个 Sequence 的前 10 帧：opacity 从 0 → 1
- 实现方式：每个 Sequence 最外层 wrapper div 上的 opacity interpolation

---

## Edge Cases

- 空数据数组：组件渲染空容器（不崩溃，不渲染任何可视元素）
- 单项数据：正常渲染单个元素，无 stagger
- CandlestickChart 所有值相同：渲染为平线（high=low=open=close → 水平短横）
- TreeStructure 超过 3 层或每层超 4 节点：截断，只渲染前 3 层 × 4 节点
- FloatingConceptCards 超过 8 张：取前 8 张，均匀分布

---

## Technical Constraints

- React + TypeScript, Remotion 4.x API（Chromium 111+）
- 所有组件可参数化（position, delay, tone, scale）
- 使用 `useCurrentFrame()` + `useVideoConfig()` 驱动
- CSS 3D transform + SVG 为主，不引入 WebGL
- 不引入新外部依赖（不使用 three.js, d3 等）
- 世界地图使用内联 SVG path（简化 8 区块，组件内常量）
- 粒子系统：纯数学计算（particleTrail 返回坐标数组），避免 DOM 频繁创建销毁
