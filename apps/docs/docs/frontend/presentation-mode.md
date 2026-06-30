---
sidebar_position: 8
title: "演示模式"
description: "通过 tldraw overlay canvas 实现 Agent 驱动的可视化演示"
---

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

- `position: fixed, inset: 0`
- z-index 介于 OverlayCanvas 和 InteractiveLayer 之间
- `pointerEvents: "none"`（仅视觉，不阻碍用户操作）
- 退出按钮: `pointerEvents: "auto"`

### tldraw 配置

```tsx
import { Tldraw, Editor } from 'tldraw'
import 'tldraw/tldraw.css'

<Tldraw
  hideUi                          // 隐藏所有 UI
  onMount={(editor: Editor) => {
    editorRef.current = editor
    editor.user.updateUserPreferences({ colorScheme: 'light' })
  }}
  options={{ maxPages: 1 }}
  className="presentation-canvas"  // --tl-background: transparent
/>
```

### 退出演示模式按钮

固定在右上角，半透明胶囊按钮，hover 时高亮：

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

## PresentationCommand 类型

Agent 通过 tool_call 发送绘制指令，映射为 tldraw Editor API 调用。

```ts
type PresentationCommand =
  | { type: 'arrow'; from: Point; to: Point; color?: TldrawColor; label?: string; size?: 's' | 'm' | 'l'; animate?: boolean }
  | { type: 'highlight'; region: Rect; color?: TldrawColor; animate?: boolean }
  | { type: 'line'; points: Point[]; color?: TldrawColor; size?: 's' | 'm' | 'l'; animate?: boolean }
  | { type: 'circle'; center: Point; radius: number; color?: TldrawColor; animate?: boolean }
  | { type: 'text'; position: Point; content: string; color?: TldrawColor; fontSize?: number }
  | { type: 'clear' }
  | { type: 'wait'; ms: number }
```

## 使用方式

### 前端组件内调用

```tsx
import { useOverlayStore } from "@/stores/overlay-store"

const { actions } = useOverlayStore.getState()

// 启动演示模式
actions.startPresentation()

// 添加绘制指令
actions.addPresentationCommands([
  { type: 'highlight', region: { x: 50, y: 120, width: 300, height: 80 }, color: 'yellow', animate: true },
  { type: 'wait', ms: 500 },
  { type: 'arrow', from: { x: 400, y: 160 }, to: { x: 320, y: 160 }, color: 'red', label: '关注此处', animate: true },
])
```

### 非 React 上下文调用

```ts
import { useOverlayStore } from "@/stores/overlay-store"

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

### Agent Tool Call 集成

Agent 的 tool_call 返回后，在 chat handler 中映射为 store 操作：

```ts
function handleToolCall(toolName: string, args: unknown) {
  if (toolName === 'presentation_draw') {
    const { commands } = args as { commands: PresentationCommand[] }
    const { actions } = useOverlayStore.getState()
    if (!useOverlayStore.getState().presentationActive) {
      actions.startPresentation()
    }
    actions.addPresentationCommands(commands)
  }
}
```

## Store Actions API

| Action | 说明 |
|--------|------|
| `actions.startPresentation()` | 启动演示模式，显示 tldraw overlay + 退出按钮 |
| `actions.stopPresentation()` | 退出演示模式，清空画布并隐藏 overlay |
| `actions.addPresentationCommand(cmd)` | 添加单条绘制指令 |
| `actions.addPresentationCommands(cmds)` | 批量添加绘制指令序列 |
| `actions.clearPresentationCommands()` | 清空指令队列（不清空已绘制内容） |

## 坐标系

- 原点 `(0, 0)` 为屏幕左上角
- 单位为 CSS 像素（与 `window.innerWidth/Height` 一致）
- Agent 可通过截图分析获取目标元素的屏幕坐标

## 依赖

- `tldraw`: ^4.5.0

## 参考

- 规范文件: `docs/specs/frontend/features/presentation-mode.md`
- [组件开发指南](./components.md)
- [状态管理](./state-management.md)
