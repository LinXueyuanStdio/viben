# Viben Pets V1 设计文档

> **状态**: 已批准
> **日期**: 2026-05-31
> **作者**: Claude + User

## 概述

为 Viben 实现桌面宠物（Desktop Pet）功能，提供一个可交互的虚拟伴侣。V1 版本聚焦于：

1. **桌面伴侣模式**：独立透明窗口，浮动在其他应用之上
2. **简单交互**：点击、拖拽、悬停触发动画
3. **预设宠物**：提供 3-5 个预设宠物，支持切换
4. **功能完整**：参照 open-design 实现完整的动画状态机和 ambient 循环

后续版本将扩展应用内嵌入模式和 AI 生成自定义宠物。

## 架构设计

### 目录结构

```
viben/
├── packages/pet/                        # 完整宠物包（逻辑 + 组件 + 状态）
│   ├── src/
│   │   ├── types.ts                     # Pet 类型定义
│   │   ├── atlas.ts                     # 精灵图 atlas 处理（8×9 格式）
│   │   ├── animation.ts                 # 动画状态机
│   │   ├── interaction.ts               # 交互逻辑（拖拽、悬停、点击）
│   │   ├── store.ts                     # zustand 状态管理
│   │   ├── components/
│   │   │   ├── PetContainer.tsx         # 宠物主容器（处理定位、拖拽）
│   │   │   ├── PetSprite.tsx            # 精灵渲染（CSS sprite animation）
│   │   │   ├── PetBubble.tsx            # 对话气泡
│   │   │   └── PetSettings.tsx          # 设置面板
│   │   ├── hooks/
│   │   │   ├── usePetAnimation.ts       # 动画控制 hook
│   │   │   ├── usePetDrag.ts            # 拖拽逻辑 hook
│   │   │   └── usePetInteraction.ts     # 交互状态 hook
│   │   └── index.ts                     # 统一导出
│   ├── example/                         # 本地调试 demo
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── vite.config.ts
│   │   └── package.json
│   ├── package.json
│   └── tsconfig.json
│
├── packages/core/templates/viben/pets/  # 预设宠物资源
│   ├── viben-mascot/
│   │   ├── pet.json
│   │   ├── spritesheet.webp
│   │   └── thumbnail.png
│   ├── pixel-cat/
│   └── coding-duck/
│
├── apps/desktop/
│   ├── src-tauri/
│   │   └── tauri.conf.json              # 新增 pet-window 透明窗口配置
│   └── src/
│       ├── pages/pet/
│       │   └── index.tsx                # 独立宠物窗口入口
│       └── stores/
│           └── pet-store.ts             # 继承/扩展 packages/pet store
```

### 设计原则

1. **packages/pet 自包含**：所有宠物相关代码（类型、逻辑、组件、hooks、状态）集中在一个包
2. **独立可调试**：`packages/pet/example/` 提供独立 Vite 开发环境
3. **预设与 skill 兼容**：精灵图格式兼容现有 `hatch-pet` skill，未来可 AI 生成

## 精灵图格式

沿用 open-design/Codex 已验证的 8×9 atlas 格式：

| 属性 | 值 |
|------|-----|
| 总尺寸 | 1536 × 1872 px |
| 网格 | 8 列 × 9 行 |
| 单格 | 192 × 208 px |
| 格式 | WebP/PNG，透明背景 |

### 9 行动画状态

| 行号 | ID | 帧数 | FPS | 用途 |
|------|-----|------|-----|------|
| 0 | idle | 6 | 6 | 默认呼吸动画 |
| 1 | running-right | 8 | 8 | 向右拖拽 |
| 2 | running-left | 8 | 8 | 向左拖拽 |
| 3 | waving | 4 | 6 | 悬停挥手 |
| 4 | jumping | 5 | 7 | 向上拖拽 |
| 5 | failed | 8 | 7 | 失败/沮丧状态 |
| 6 | waiting | 6 | 6 | 长时间无交互 |
| 7 | running | 6 | 8 | 原地跑步 |
| 8 | review | 6 | 6 | 思考/审视 |

## 数据结构

### pet.json 格式

```json
{
  "id": "viben-mascot",
  "name": "Viben",
  "description": "Viben 官方吉祥物，一只热爱编程的小精灵",
  "accent": "#6366f1",
  "greeting": "嗨！我是 Viben，随时准备陪你一起创造！",
  "spritesheet": "spritesheet.webp",
  "atlas": {
    "cols": 8,
    "rows": 9,
    "cellWidth": 192,
    "cellHeight": 208,
    "animations": [
      { "id": "idle", "row": 0, "frames": 6, "fps": 6 },
      { "id": "running-right", "row": 1, "frames": 8, "fps": 8 },
      { "id": "running-left", "row": 2, "frames": 8, "fps": 8 },
      { "id": "waving", "row": 3, "frames": 4, "fps": 6 },
      { "id": "jumping", "row": 4, "frames": 5, "fps": 7 },
      { "id": "failed", "row": 5, "frames": 8, "fps": 7 },
      { "id": "waiting", "row": 6, "frames": 6, "fps": 6 },
      { "id": "running", "row": 7, "frames": 6, "fps": 8 },
      { "id": "review", "row": 8, "frames": 6, "fps": 6 }
    ]
  },
  "ambient": {
    "pool": ["waving", "review", "jumping"],
    "playMs": { "min": 1400, "variance": 900 },
    "restMs": { "min": 9000, "variance": 9000 },
    "initialDelayMs": { "min": 4000, "variance": 3000 }
  },
  "idleTimeoutMs": 45000
}
```

### TypeScript 类型定义

```typescript
// packages/pet/src/types.ts

/** 动画行定义 */
export interface PetAnimationDef {
  id: string;
  row: number;
  frames: number;
  fps: number;
}

/** Atlas 布局 */
export interface PetAtlasLayout {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  animations: PetAnimationDef[];
}

/** Ambient 动画配置 */
export interface PetAmbientConfig {
  pool: string[];
  playMs: { min: number; variance: number };
  restMs: { min: number; variance: number };
  initialDelayMs: { min: number; variance: number };
}

/** 完整宠物配置 */
export interface PetConfig {
  id: string;
  name: string;
  description: string;
  accent: string;
  greeting: string;
  spritesheet: string;
  atlas: PetAtlasLayout;
  ambient?: PetAmbientConfig;
  idleTimeoutMs?: number;
}

/** 交互状态 */
export type PetInteraction =
  | 'idle'
  | 'hover'
  | 'drag-right'
  | 'drag-left'
  | 'drag-up'
  | 'drag-down'
  | 'waiting';

/** 宠物位置 */
export interface PetPosition {
  right: number;
  bottom: number;
}

/** 持久化存储的用户偏好 */
export interface PetUserPrefs {
  adopted: boolean;
  petId: string;
  position: PetPosition;
  customPet?: PetConfig;
}
```

### 预设清单

```typescript
// packages/core/src/pet/index.ts

export interface PetPreset {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  path: string;
}

export const PET_PRESETS: PetPreset[] = [
  {
    id: 'viben-mascot',
    name: 'Viben',
    description: 'Viben 官方吉祥物',
    thumbnail: './viben-mascot/thumbnail.png',
    path: './viben-mascot',
  },
  {
    id: 'pixel-cat',
    name: '像素猫',
    description: '慵懒的像素风格小猫',
    thumbnail: './pixel-cat/thumbnail.png',
    path: './pixel-cat',
  },
  {
    id: 'coding-duck',
    name: '代码鸭',
    description: '橡皮鸭调试法的最佳伙伴',
    thumbnail: './coding-duck/thumbnail.png',
    path: './coding-duck',
  },
];
```

## 交互状态机

```
                    ┌─────────────────┐
                    │                 │
         ┌──────────│      idle       │◄─────────────┐
         │          │   (默认状态)     │              │
         │          └────────┬────────┘              │
         │                   │                       │
    45s 无交互          hover │ pointerdown          │ pointerup
         │                   │                       │
         ▼                   ▼                       │
    ┌─────────┐        ┌──────────┐           ┌─────┴─────┐
    │ waiting │        │  waving  │           │  拖拽状态  │
    │ (发呆)  │        │ (挥手)   │           │           │
    └─────────┘        └──────────┘           │ drag-right│
                                              │ drag-left │
                                              │ drag-up   │
                                              │ drag-down │
                                              └───────────┘
```

### 交互映射

| 交互状态 | 对应动画行 |
|----------|-----------|
| idle | idle |
| hover | waving |
| drag-right | running-right |
| drag-left | running-left |
| drag-up | jumping |
| drag-down | waving |
| waiting | waiting |

### 拖拽检测参数

| 参数 | 值 | 说明 |
|------|-----|------|
| DRAG_GESTURE_MIN_PX | 14 | 最小拖拽距离，过滤抖动 |
| DRAG_AXIS_BIAS | 1.18 | 轴向偏置，避免斜向拖拽频繁切换 |

### Ambient 动画

当宠物处于 `idle` 状态时，会随机播放 ambient 动画池中的动画，让宠物看起来有生命力：

1. 初始延迟（4-7 秒）后开始
2. 随机选择一个 ambient 动画播放（1.4-2.3 秒）
3. 返回 idle 休息（9-18 秒）
4. 重复步骤 2-3

## 组件 API

### PetContainer

```tsx
interface PetContainerProps {
  pet?: PetConfig;
  position?: PetPosition;
  onPositionChange?: (position: PetPosition) => void;
  onTap?: () => void;
  showBubble?: boolean;
  bubbleContent?: React.ReactNode;
}

<PetContainer
  pet={currentPet}
  position={{ right: 24, bottom: 24 }}
  onPositionChange={savePosition}
  onTap={openSettings}
/>
```

### PetSprite

```tsx
interface PetSpriteProps {
  pet: PetConfig;
  animationId: string;
  className?: string;
}

<PetSprite
  pet={currentPet}
  animationId="idle"
/>
```

### PetSettings

```tsx
interface PetSettingsProps {
  presets: PetPreset[];
  currentPetId?: string;
  onSelectPreset: (preset: PetPreset) => Promise<void>;
  onClose: () => void;
}
```

## 状态管理

### Zustand Store

```typescript
// packages/pet/src/store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PetState {
  pet: PetConfig | null;
  position: PetPosition;
  interaction: PetInteraction;
  ambientRowId: string | null;
  bubbleOpen: boolean;

  // Actions
  setPet: (pet: PetConfig | null) => void;
  setPosition: (pos: PetPosition) => void;
  setInteraction: (state: PetInteraction) => void;
  setAmbientRowId: (id: string | null) => void;
  setBubbleOpen: (open: boolean) => void;
}

export const createPetStore = (storageKey = 'viben:pet') =>
  create<PetState>()(
    persist(
      (set) => ({
        pet: null,
        position: { right: 24, bottom: 24 },
        interaction: 'idle',
        ambientRowId: null,
        bubbleOpen: false,

        setPet: (pet) => set({ pet }),
        setPosition: (position) => set({ position }),
        setInteraction: (interaction) => set({ interaction }),
        setAmbientRowId: (ambientRowId) => set({ ambientRowId }),
        setBubbleOpen: (bubbleOpen) => set({ bubbleOpen }),
      }),
      {
        name: storageKey,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          pet: state.pet,
          position: state.position,
        }),
      }
    )
  );

export const usePetStore = createPetStore();
```

## Desktop 集成

### Tauri 窗口配置

```json
{
  "label": "pet-window",
  "title": "Viben Pet",
  "width": 200,
  "height": 240,
  "visible": false,
  "decorations": false,
  "transparent": true,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "resizable": false,
  "url": "/pet"
}
```

### 关键特性

- `transparent: true` + `decorations: false`：实现透明悬浮窗口
- `alwaysOnTop: true`：保持在最上层
- `skipTaskbar: true`：不在任务栏显示
- 拖拽时调用 Tauri window API 移动窗口位置

### 托盘菜单集成

在现有托盘菜单中添加：
- "显示/隐藏宠物" 切换项
- "宠物设置" 打开设置面板

## V1 功能清单

| 模块 | 功能 | 优先级 | 状态 |
|------|------|--------|------|
| **packages/pet** | | | |
| └ types.ts | 类型定义 | P0 | 待开发 |
| └ atlas.ts | 精灵图加载、行切片 | P0 | 待开发 |
| └ animation.ts | CSS sprite 动画 | P0 | 待开发 |
| └ interaction.ts | 状态机、交互映射 | P0 | 待开发 |
| └ store.ts | zustand 状态 + 持久化 | P0 | 待开发 |
| └ PetSprite | 精灵渲染组件 | P0 | 待开发 |
| └ PetContainer | 容器（定位、拖拽） | P0 | 待开发 |
| └ PetBubble | 对话气泡 | P1 | 待开发 |
| └ PetSettings | 设置面板 | P1 | 待开发 |
| └ hooks | usePetDrag, usePetAnimation | P0 | 待开发 |
| └ example/ | Vite demo 环境 | P0 | 待开发 |
| **预设宠物** | | | |
| └ viben-mascot | 官方吉祥物 | P0 | 需设计 |
| └ pixel-cat | 像素猫 | P1 | 需设计 |
| └ coding-duck | 代码鸭 | P1 | 需设计 |
| **apps/desktop** | | | |
| └ pet-window 配置 | Tauri 透明窗口 | P0 | 待开发 |
| └ /pet 页面 | 集成 packages/pet | P0 | 待开发 |
| └ 托盘菜单集成 | 显示/隐藏宠物 | P1 | 待开发 |

## 技术依赖

| 依赖 | 用途 | 版本 |
|------|------|------|
| react | UI 框架 | ^18.x |
| zustand | 状态管理 | ^4.x |
| framer-motion | 动画（可选） | ^12.x |
| vite | example 构建 | ^5.x |

## 参考资料

- [~/github/others/open-design/apps/web/src/components/pet/](https://github.com/nexu-io/open-design) - 参考实现
- [hatch-pet skill](../../../packages/core/templates/viben/skills/hatch-pet/SKILL.md) - 精灵图生成规范
- [Codex Pet Atlas 规范](https://github.com/openai/skills/tree/main/skills/.curated/hatch-pet/references) - 8×9 atlas 格式

## 后续版本规划

### V2 计划
- 应用内嵌入模式（与 Agent 任务状态联动）
- AI 生成自定义宠物（集成 hatch-pet skill）
- 更多预设宠物

### V3 计划
- 屏幕漫游、边缘检测
- 随机行为系统
- 与系统状态联动（CPU、天气等）
