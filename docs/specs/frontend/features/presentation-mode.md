# 演示模式 (Presentation Mode)

Agent 通过全局 overlay canvas 进行可视化演示 — 画线、框选高亮、箭头标识、文字标注（带动画）。

## 技术选型

**tldraw SDK** (v4.x) — React infinite canvas SDK，提供完整的程序化 Editor API。

选型依据：
- 官方 `agent-template` 项目验证了 AI agent 驱动 canvas 的可行性
- `editor.createShape()` / `editor.run()` 提供事务化批量操作
- `hideUi` + 透明背景实现纯程序化 overlay
- 内置 arrow、geo、draw、text 等形状，无需自定义 ShapeUtil

## 架构

```
┌─────────────────────────────────────────────────┐
│  OverlayRoot (已有)                              │
│  ├── OverlayCanvas (PixiJS 弹幕等)              │
│  ├── DanmakuLayer / SubtitleLayer / ...         │
│  └── PresentationLayer ← 新增                   │
│       ├── <Tldraw hideUi />                     │
│       └── 退出按钮                               │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  overlay-store.ts (zustand) ← 扩展              │
│  └── presentation slice                         │
│       ├── active: boolean                       │
│       ├── commands: PresentationCommand[]       │
│       └── actions: start / stop / addCommand    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Agent Tool Interface                            │
│  └── gateway API / chat tool_call               │
│       → overlay-store.addCommand()              │
│       → PresentationLayer 消费执行              │
└─────────────────────────────────────────────────┘
```

## PresentationLayer 组件

### 布局与样式

```tsx
// position: fixed, inset: 0
// z-index: DOMZIndex.PresentationLayer (介于 OverlayCanvas 和 InteractiveLayer 之间)
// pointerEvents: "none" (仅视觉，不阻碍用户操作)
// 退出按钮: pointerEvents: "auto"
```

### tldraw 配置 (官方最佳实践)

```tsx
import { Tldraw, Editor, createShapeId } from 'tldraw'
import 'tldraw/tldraw.css'

<Tldraw
  hideUi                          // 隐藏所有 UI (toolbar, menus, panels)
  onMount={(editor: Editor) => {
    // 存储 editor ref 供 command executor 使用
    editorRef.current = editor
    // 设置透明背景
    editor.user.updateUserPreferences({ colorScheme: 'light' })
  }}
  options={{
    maxPages: 1,
  }}
  // 透明背景
  className="presentation-canvas"  // .presentation-canvas { --tl-background: transparent }
/>
```

### 退出演示模式按钮

- 固定在右上角
- `pointerEvents: "auto"` (可点击)
- 点击后调用 `presentationActions.stop()`
- 样式: 半透明胶囊按钮，hover 时高亮

```tsx
<button
  className="presentation-exit-btn"
  onClick={() => presentationActions.stop()}
  style={{ pointerEvents: 'auto' }}
>
  退出演示
</button>
```

## Zustand Store 扩展

在 `overlay-store.ts` 中新增 presentation slice：

```ts
// --- Presentation ---
interface PresentationState {
  presentationActive: boolean
  presentationCommands: PresentationCommand[]
}

interface PresentationActions {
  startPresentation: () => void
  stopPresentation: () => void
  addPresentationCommand: (cmd: PresentationCommand) => void
  addPresentationCommands: (cmds: PresentationCommand[]) => void
  clearPresentationCommands: () => void
}
```

## PresentationCommand 类型 (Agent Tool 接口)

Agent 通过 tool_call 发送绘制指令，映射为 tldraw Editor API 调用。

```ts
interface Point { x: number; y: number }
interface Rect { x: number; y: number; width: number; height: number }

type PresentationCommand =
  // 箭头: 从 from 指向 to
  | {
      type: 'arrow'
      from: Point
      to: Point
      color?: TldrawColor       // 'red' | 'blue' | 'green' | 'orange' | ...
      label?: string            // 箭头上的文字标注
      size?: 's' | 'm' | 'l'
      animate?: boolean         // 是否带入场动画
    }
  // 高亮框: 矩形半透明高亮
  | {
      type: 'highlight'
      region: Rect
      color?: TldrawColor
      animate?: boolean
    }
  // 画线: 自由线条
  | {
      type: 'line'
      points: Point[]
      color?: TldrawColor
      size?: 's' | 'm' | 'l'
      animate?: boolean
    }
  // 圆圈: 圈选标记
  | {
      type: 'circle'
      center: Point
      radius: number
      color?: TldrawColor
      animate?: boolean
    }
  // 文字: 屏幕标注
  | {
      type: 'text'
      position: Point
      content: string
      color?: TldrawColor
      fontSize?: number
    }
  // 清空画布
  | { type: 'clear' }
  // 等待: 控制演示节奏
  | { type: 'wait'; ms: number }

// tldraw 内置颜色
type TldrawColor =
  | 'black' | 'grey' | 'light-violet' | 'violet' | 'blue'
  | 'light-blue' | 'yellow' | 'orange' | 'green' | 'light-green'
  | 'light-red' | 'red' | 'white'
```

## Command Executor (核心逻辑)

在 PresentationLayer 内部，监听 store 中的 commands 队列并逐个执行。

### 映射规则: Command → tldraw Editor API

```ts
// 使用 editor.run() 事务化批量操作 (tldraw 官方最佳实践)
function executeCommand(editor: Editor, cmd: PresentationCommand) {
  switch (cmd.type) {
    case 'arrow': {
      const id = createShapeId()
      editor.createShape({
        id,
        type: 'arrow',
        x: cmd.from.x,
        y: cmd.from.y,
        props: {
          start: { x: 0, y: 0 },
          end: { x: cmd.to.x - cmd.from.x, y: cmd.to.y - cmd.from.y },
          color: cmd.color ?? 'red',
          size: cmd.size ?? 'm',
          arrowheadEnd: 'arrow',
          arrowheadStart: 'none',
          ...(cmd.label ? { richText: toRichText(cmd.label) } : {}),
        },
      })
      break
    }

    case 'highlight': {
      const id = createShapeId()
      editor.createShape({
        id,
        type: 'geo',
        x: cmd.region.x,
        y: cmd.region.y,
        props: {
          geo: 'rectangle',
          w: cmd.region.width,
          h: cmd.region.height,
          color: cmd.color ?? 'yellow',
          fill: 'semi',        // 半透明填充
          dash: 'dashed',
          size: 'm',
        },
      })
      break
    }

    case 'circle': {
      const id = createShapeId()
      editor.createShape({
        id,
        type: 'geo',
        x: cmd.center.x - cmd.radius,
        y: cmd.center.y - cmd.radius,
        props: {
          geo: 'ellipse',
          w: cmd.radius * 2,
          h: cmd.radius * 2,
          color: cmd.color ?? 'red',
          fill: 'none',
          size: 'm',
        },
      })
      break
    }

    case 'text': {
      const id = createShapeId()
      editor.createShape({
        id,
        type: 'text',
        x: cmd.position.x,
        y: cmd.position.y,
        props: {
          richText: toRichText(cmd.content),
          color: cmd.color ?? 'black',
          size: cmd.fontSize ? 'l' : 'm',
        },
      })
      break
    }

    case 'line': {
      // 使用 draw shape + b64Vecs 编码
      const id = createShapeId()
      const points = cmd.points.map(p => ({ x: p.x, y: p.y, z: 0.5 }))
      editor.createShape({
        id,
        type: 'draw',
        x: cmd.points[0]?.x ?? 0,
        y: cmd.points[0]?.y ?? 0,
        props: {
          color: cmd.color ?? 'red',
          size: cmd.size ?? 'm',
          segments: [{
            type: 'free',
            path: b64Vecs.encodePoints(points.map(p => ({
              x: p.x - (cmd.points[0]?.x ?? 0),
              y: p.y - (cmd.points[0]?.y ?? 0),
              z: p.z,
            }))),
          }],
          isComplete: true,
          isClosed: false,
          isPen: false,
        },
      })
      break
    }

    case 'clear':
      editor.selectAll()
      editor.deleteShapes(editor.getSelectedShapeIds())
      break

    case 'wait':
      // 由 executor 调度层处理延时
      break
  }
}
```

### 动画入场

当 `animate: true` 时，shape 创建后通过 CSS opacity transition 实现淡入：

```ts
// 方案: 创建时 opacity=0, 然后 updateShape 设为 1
// tldraw shape 支持 opacity 属性 (0-1)
if (cmd.animate) {
  editor.createShape({ ...shapeData, opacity: 0 })
  requestAnimationFrame(() => {
    editor.updateShape({ id, type: shapeData.type, opacity: 1 })
  })
}
```

### 队列执行器

```ts
async function executeQueue(editor: Editor, commands: PresentationCommand[]) {
  for (const cmd of commands) {
    if (cmd.type === 'wait') {
      await sleep(cmd.ms)
    } else {
      executeCommand(editor, cmd)
      // 每个 command 之间最小间隔，保证视觉节奏
      await sleep(50)
    }
  }
}
```

## 文件结构

```
apps/desktop/src/
├── components/overlay/
│   ├── layers/
│   │   └── presentation-layer.tsx    ← 新增: PresentationLayer 组件
│   └── overlay-root.tsx              ← 修改: 引入 PresentationLayer
├── stores/
│   └── overlay-store.ts              ← 修改: 新增 presentation slice
├── lib/
│   └── presentation/
│       ├── index.ts                  ← 新增: 导出
│       ├── types.ts                  ← 新增: PresentationCommand 类型
│       └── command-executor.ts       ← 新增: Command → tldraw API 映射
└── types/
    └── overlay.ts                    ← 修改: 新增 DOMZIndex.PresentationLayer
```

## 依赖

```json
{
  "tldraw": "^4.5.0"
}
```

注意: tldraw SDK 4.0+ 生产环境需要 license key。开发阶段会显示 "Made with tldraw" 水印。

## 使用方式

### 前端组件内调用 (React)

```tsx
import { useOverlayStore } from "@/stores/overlay-store"

function SomeComponent() {
  const { actions } = useOverlayStore.getState()

  const startDemo = () => {
    // 1. 启动演示模式
    actions.startPresentation()

    // 2. 逐条或批量添加绘制指令
    actions.addPresentationCommands([
      // 高亮一个区域
      { type: 'highlight', region: { x: 50, y: 120, width: 300, height: 80 }, color: 'yellow', animate: true },
      // 等待 500ms
      { type: 'wait', ms: 500 },
      // 画箭头指向关键位置
      { type: 'arrow', from: { x: 400, y: 160 }, to: { x: 320, y: 160 }, color: 'red', label: '关注此处', animate: true },
      // 等待 800ms
      { type: 'wait', ms: 800 },
      // 圈选一个指标
      { type: 'circle', center: { x: 600, y: 300 }, radius: 40, color: 'blue', animate: true },
      // 文字标注
      { type: 'text', position: { x: 560, y: 350 }, content: 'RSI 超卖信号', color: 'blue' },
      // 画趋势线
      { type: 'line', points: [{ x: 100, y: 400 }, { x: 300, y: 350 }, { x: 500, y: 380 }], color: 'green', size: 'l' },
    ])
  }

  return <button onClick={startDemo}>开始演示</button>
}
```

### 在 hooks/store 外部调用 (非 React 上下文)

```ts
import { useOverlayStore } from "@/stores/overlay-store"

// 直接访问 store（适用于 gateway 回调、agent tool handler 等）
const store = useOverlayStore.getState()
store.actions.startPresentation()
store.actions.addPresentationCommand({
  type: 'arrow',
  from: { x: 100, y: 100 },
  to: { x: 300, y: 200 },
  color: 'red',
  animate: true,
})
```

### Agent Tool Call 集成示例

Agent 的 tool_call 返回后，在 chat handler 中映射为 store 操作：

```ts
// 在 agent chat 响应处理中
function handleToolCall(toolName: string, args: unknown) {
  if (toolName === 'presentation_draw') {
    const { commands } = args as { commands: PresentationCommand[] }
    const { actions } = useOverlayStore.getState()

    // 首次调用自动启动演示模式
    if (!useOverlayStore.getState().presentationActive) {
      actions.startPresentation()
    }
    actions.addPresentationCommands(commands)
  }

  if (toolName === 'presentation_clear') {
    useOverlayStore.getState().actions.clearPresentationCommands()
    // 同时清空 tldraw canvas — command executor 会处理 { type: 'clear' }
    useOverlayStore.getState().actions.addPresentationCommand({ type: 'clear' })
  }

  if (toolName === 'presentation_stop') {
    useOverlayStore.getState().actions.stopPresentation()
  }
}
```

### Agent Tool 定义 (供 LLM function calling 使用)

```json
{
  "name": "presentation_draw",
  "description": "在用户屏幕上绘制可视化标注进行演示讲解。支持箭头、高亮框、圆圈、文字、线条，可设置颜色和动画。坐标以屏幕像素为单位，左上角为 (0,0)。",
  "parameters": {
    "type": "object",
    "properties": {
      "commands": {
        "type": "array",
        "description": "绘制指令序列，按顺序执行",
        "items": {
          "oneOf": [
            {
              "type": "object",
              "properties": {
                "type": { "const": "arrow" },
                "from": { "type": "object", "properties": { "x": { "type": "number" }, "y": { "type": "number" } }, "required": ["x", "y"] },
                "to": { "type": "object", "properties": { "x": { "type": "number" }, "y": { "type": "number" } }, "required": ["x", "y"] },
                "color": { "type": "string", "enum": ["black","grey","violet","blue","light-blue","yellow","orange","green","light-green","light-red","red","white"] },
                "label": { "type": "string", "description": "箭头上的文字标注" },
                "size": { "type": "string", "enum": ["s", "m", "l"] },
                "animate": { "type": "boolean", "description": "是否带淡入动画" }
              },
              "required": ["type", "from", "to"]
            },
            {
              "type": "object",
              "properties": {
                "type": { "const": "highlight" },
                "region": { "type": "object", "properties": { "x": { "type": "number" }, "y": { "type": "number" }, "width": { "type": "number" }, "height": { "type": "number" } }, "required": ["x", "y", "width", "height"] },
                "color": { "type": "string" },
                "animate": { "type": "boolean" }
              },
              "required": ["type", "region"]
            },
            {
              "type": "object",
              "properties": {
                "type": { "const": "circle" },
                "center": { "type": "object", "properties": { "x": { "type": "number" }, "y": { "type": "number" } }, "required": ["x", "y"] },
                "radius": { "type": "number" },
                "color": { "type": "string" },
                "animate": { "type": "boolean" }
              },
              "required": ["type", "center", "radius"]
            },
            {
              "type": "object",
              "properties": {
                "type": { "const": "text" },
                "position": { "type": "object", "properties": { "x": { "type": "number" }, "y": { "type": "number" } }, "required": ["x", "y"] },
                "content": { "type": "string" },
                "color": { "type": "string" },
                "size": { "type": "string", "enum": ["s", "m", "l"] }
              },
              "required": ["type", "position", "content"]
            },
            {
              "type": "object",
              "properties": {
                "type": { "const": "line" },
                "points": { "type": "array", "items": { "type": "object", "properties": { "x": { "type": "number" }, "y": { "type": "number" } }, "required": ["x", "y"] } },
                "color": { "type": "string" },
                "size": { "type": "string", "enum": ["s", "m", "l"] },
                "animate": { "type": "boolean" }
              },
              "required": ["type", "points"]
            },
            {
              "type": "object",
              "properties": { "type": { "const": "clear" } },
              "required": ["type"]
            },
            {
              "type": "object",
              "properties": { "type": { "const": "wait" }, "ms": { "type": "number", "description": "等待毫秒数" } },
              "required": ["type", "ms"]
            }
          ]
        }
      }
    },
    "required": ["commands"]
  }
}
```

### Store Actions API 速查

| Action | 说明 |
|--------|------|
| `actions.startPresentation()` | 启动演示模式，显示 tldraw overlay + 退出按钮 |
| `actions.stopPresentation()` | 退出演示模式，清空画布并隐藏 overlay |
| `actions.addPresentationCommand(cmd)` | 添加单条绘制指令 |
| `actions.addPresentationCommands(cmds)` | 批量添加绘制指令序列 |
| `actions.clearPresentationCommands()` | 清空指令队列（不清空已绘制内容） |

### 坐标系说明

- 原点 `(0, 0)` 为屏幕左上角
- 单位为 CSS 像素 (与 `window.innerWidth/Height` 一致)
- Agent 可通过截图分析获取目标元素的屏幕坐标

## 实现步骤

1. 安装 tldraw 依赖
2. 定义 `PresentationCommand` 类型 (`lib/presentation/types.ts`)
3. 扩展 `overlay-store.ts` 添加 presentation slice
4. 实现 `command-executor.ts` (Command → Editor API 映射)
5. 实现 `PresentationLayer` 组件 (tldraw + 退出按钮 + 队列消费)
6. 在 `OverlayRoot` 中注册 PresentationLayer
7. 更新 `DOMZIndex` 枚举
