# Overlay 演示系统 - 技术设计文档

> 创建时间: 2026-04-20
> 关联 PRD: [2026-04-20-overlay-prd.md](./2026-04-20-overlay-prd.md)

## 技术选型

| 层级 | 技术 | 理由 |
|------|------|------|
| 渲染引擎 | PixiJS v8 + @pixi/react | WebGL/WebGPU 加速，支持未来 Live2D 扩展 |
| 状态管理 | Zustand | 轻量、与现有架构一致 |
| 控制接口 | React Hooks | 组件化调用，易于使用 |
| 事件系统 | Window Events + Zustand | 全局监听 + 状态驱动 |

## 架构设计

### 窗口架构

在 Viben 主窗口内部添加全局 Overlay 层，不创建独立窗口:

```
┌─────────────────────────────────────┐
│  Viben Main Window                  │
│  ┌───────────────────────────────┐  │
│  │  PixiJS Canvas (全屏覆盖)      │  │  ← pointer-events: none
│  │  ┌─────────────────────────┐  │  │
│  │  │  弹幕层 (z: 60)          │  │  │
│  │  │  按键层 (z: 50)          │  │  │
│  │  │  点击层 (z: 40)          │  │  │
│  │  │  字幕层 (z: 20)          │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  React App (正常 UI)          │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 层级定义

```typescript
enum OverlayZIndex {
  Background = 0,
  Live2D = 10,              // 预留
  Subtitle = 20,
  DialogueBox = 30,         // Galgame 对话框预留
  ClickIndicator = 40,
  Keystroke = 50,
  Danmaku = 60,
  Custom = 100,
}
```

## 目录结构

```
apps/desktop/src/
├── components/overlay/
│   ├── index.ts                      # 导出入口
│   ├── overlay-canvas.tsx            # PixiJS 主画布容器
│   ├── overlay-provider.tsx          # Context Provider
│   ├── layers/
│   │   ├── danmaku-layer.tsx         # 弹幕层
│   │   ├── subtitle-layer.tsx        # 字幕层
│   │   ├── click-indicator-layer.tsx # 鼠标点击指示器
│   │   └── keystroke-layer.tsx       # 按键可视化
│   └── elements/
│       ├── danmaku-item.tsx          # 单条弹幕
│       ├── subtitle-box.tsx          # 字幕框
│       ├── click-ripple.tsx          # 点击涟漪效果
│       └── key-badge.tsx             # 按键徽章
├── stores/
│   └── overlay-store.ts              # Zustand 状态
├── hooks/
│   ├── use-overlay.ts                # 主控制 hook
│   ├── use-danmaku.ts                # 弹幕控制
│   ├── use-subtitle.ts               # 字幕控制
│   ├── use-click-indicator.ts        # 点击指示器
│   └── use-keystroke.ts              # 按键可视化
├── types/
│   └── overlay.ts                    # 类型定义
└── pages/
    └── settings-overlay.tsx          # 设置页面
```

## 类型定义

```typescript
// types/overlay.ts

// === 弹幕 ===
interface DanmakuItem {
  id: string;
  text: string;
  color?: string;           // 默认 #fff
  fontSize?: number;        // 默认 24
  speed?: "slow" | "normal" | "fast";
  track?: number;           // 轨道号
  timestamp: number;
}

interface DanmakuConfig {
  maxTracks: number;        // 默认 8
  defaultSpeed: number;     // px/s
  opacity: number;
  fontFamily: string;
}

// === 字幕 ===
interface SubtitleItem {
  id: string;
  text: string;
  position: "top" | "center" | "bottom";
  style: "plain" | "dialogue" | "narrator";
  speaker?: string;
  duration?: number;        // ms, 0 = 手动关闭
  animation?: "fade" | "typewriter" | "slide";
}

interface SubtitleConfig {
  defaultPosition: "top" | "center" | "bottom";
  defaultDuration: number;
  fontSize: number;
  backgroundColor: string;
  padding: number;
}

// === 点击指示器 ===
interface ClickEffect {
  id: string;
  x: number;
  y: number;
  button: "left" | "right" | "middle";
  timestamp: number;
}

type ClickStyle = "ripple" | "spotlight" | "ring";

// === 按键可视化 ===
interface KeystrokeItem {
  id: string;
  keys: string[];           // ["Meta", "Shift", "K"]
  displayText: string;      // "⌘⇧K"
  timestamp: number;
}

type KeystrokePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

// === 快捷键 ===
interface OverlayShortcuts {
  toggleOverlay: string;
  toggleDanmaku: string;
  toggleKeystroke: string;
  toggleClickIndicator: string;
  toggleSubtitle: string;
}

// === 完整设置 ===
interface OverlaySettings {
  defaultEnabled: boolean;
  opacity: number;

  danmaku: {
    enabled: boolean;
    maxTracks: number;
    speed: "slow" | "normal" | "fast";
    fontSize: number;
    opacity: number;
  };

  subtitle: {
    enabled: boolean;
    position: "top" | "center" | "bottom";
    fontSize: number;
    backgroundColor: string;
    defaultAnimation: "fade" | "typewriter" | "slide";
  };

  clickIndicator: {
    enabled: boolean;
    style: ClickStyle;
    color: string;
    size: number;
  };

  keystroke: {
    enabled: boolean;
    position: KeystrokePosition;
    showModifiersOnly: boolean;
    duration: number;
  };

  shortcuts: OverlayShortcuts;
}
```

## 状态管理

```typescript
// stores/overlay-store.ts

interface OverlayState {
  // 全局
  visible: boolean;
  opacity: number;

  // 弹幕
  danmakuEnabled: boolean;
  danmakuItems: DanmakuItem[];
  danmakuConfig: DanmakuConfig;
  danmakuPaused: boolean;

  // 字幕
  subtitleEnabled: boolean;
  currentSubtitle: SubtitleItem | null;
  subtitleQueue: SubtitleItem[];
  subtitleConfig: SubtitleConfig;

  // 点击
  clickEnabled: boolean;
  clickStyle: ClickStyle;
  clickEffects: ClickEffect[];

  // 按键
  keystrokeEnabled: boolean;
  keystrokePosition: KeystrokePosition;
  keystrokeItems: KeystrokeItem[];
  keystrokeFilter: string[];

  // Actions
  actions: OverlayActions;
}

interface OverlayActions {
  // 全局
  show: () => void;
  hide: () => void;
  toggle: () => void;
  setOpacity: (opacity: number) => void;

  // 弹幕
  sendDanmaku: (text: string, options?: Partial<DanmakuItem>) => void;
  sendDanmakuBatch: (items: Array<{ text: string; options?: Partial<DanmakuItem> }>) => void;
  clearDanmaku: () => void;
  pauseDanmaku: () => void;
  resumeDanmaku: () => void;
  removeDanmaku: (id: string) => void;

  // 字幕
  showSubtitle: (text: string, options?: Partial<SubtitleItem>) => void;
  hideSubtitle: () => void;
  enqueueSubtitle: (item: SubtitleItem) => void;

  // 点击
  setClickEnabled: (enabled: boolean) => void;
  setClickStyle: (style: ClickStyle) => void;
  addClickEffect: (effect: ClickEffect) => void;
  removeClickEffect: (id: string) => void;

  // 按键
  setKeystrokeEnabled: (enabled: boolean) => void;
  setKeystrokePosition: (position: KeystrokePosition) => void;
  addKeystroke: (item: KeystrokeItem) => void;
  removeKeystroke: (id: string) => void;
}
```

## Hook 接口

```typescript
// === 主控制 ===
function useOverlay(): {
  visible: boolean;
  opacity: number;
  show: () => void;
  hide: () => void;
  toggle: () => void;
  setOpacity: (opacity: number) => void;
};

// === 弹幕 ===
function useDanmaku(): {
  enabled: boolean;
  paused: boolean;
  items: DanmakuItem[];
  send: (text: string, options?: Partial<DanmakuItem>) => void;
  sendBatch: (items: Array<{ text: string; options?: Partial<DanmakuItem> }>) => void;
  clear: () => void;
  pause: () => void;
  resume: () => void;
  setEnabled: (enabled: boolean) => void;
};

// === 字幕 ===
function useSubtitle(): {
  enabled: boolean;
  current: SubtitleItem | null;
  show: (text: string, options?: Partial<SubtitleItem>) => void;
  hide: () => void;
  typewriter: (text: string, options?: { speed?: number } & Partial<SubtitleItem>) => void;
  enqueue: (item: SubtitleItem) => void;
  setEnabled: (enabled: boolean) => void;
};

// === 点击指示器 ===
function useClickIndicator(): {
  enabled: boolean;
  style: ClickStyle;
  enable: () => void;
  disable: () => void;
  setStyle: (style: ClickStyle) => void;
};

// === 按键可视化 ===
function useKeystroke(): {
  enabled: boolean;
  position: KeystrokePosition;
  items: KeystrokeItem[];
  enable: () => void;
  disable: () => void;
  setPosition: (position: KeystrokePosition) => void;
  setFilter: (keys: string[]) => void;
};
```

## PixiJS 渲染实现

### Application 配置

```typescript
const pixiConfig: ApplicationOptions = {
  backgroundAlpha: 0,              // 透明背景
  antialias: true,
  resolution: window.devicePixelRatio,
  autoDensity: true,
  powerPreference: "high-performance",
};
```

### 弹幕轨道分配

```typescript
class TrackManager {
  private tracks: number[];  // 每轨道结束时间戳

  constructor(maxTracks: number) {
    this.tracks = new Array(maxTracks).fill(0);
  }

  allocate(duration: number): number {
    const now = Date.now();
    // 找最早空闲轨道
    for (let i = 0; i < this.tracks.length; i++) {
      if (this.tracks[i] < now) {
        this.tracks[i] = now + duration;
        return i;
      }
    }
    // 全忙则用最早结束的
    const minIndex = this.tracks.indexOf(Math.min(...this.tracks));
    this.tracks[minIndex] = now + duration;
    return minIndex;
  }

  release(track: number): void {
    this.tracks[track] = 0;
  }
}
```

### 点击涟漪效果

```typescript
class ClickRipple extends Container {
  private graphics: Graphics;
  private elapsed: number = 0;
  private readonly duration: number = 400;
  private readonly maxRadius: number = 40;

  constructor(x: number, y: number, color: number = 0xffffff) {
    super();
    this.position.set(x, y);
    this.graphics = new Graphics();
    this.addChild(this.graphics);
  }

  update(deltaMs: number): boolean {
    this.elapsed += deltaMs;
    const progress = Math.min(this.elapsed / this.duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);  // ease-out-cubic

    const radius = eased * this.maxRadius;
    const alpha = 0.6 * (1 - eased);

    this.graphics.clear();
    this.graphics.circle(0, 0, radius);
    this.graphics.fill({ color: 0xffffff, alpha });

    return progress >= 1;  // 返回是否完成
  }
}
```

### 对象池

```typescript
class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize: number = 50) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    return this.pool.pop() ?? this.factory();
  }

  release(obj: T): void {
    this.reset(obj);
    this.pool.push(obj);
  }
}
```

## 全局事件监听

```typescript
// hooks/use-global-input.ts

export function useGlobalMouseListener() {
  const { clickEnabled, addClickEffect, removeClickEffect } = useOverlayStore();

  useEffect(() => {
    if (!clickEnabled) return;

    const handleMouseDown = (e: MouseEvent) => {
      const id = nanoid();
      addClickEffect({
        id,
        x: e.clientX,
        y: e.clientY,
        button: (["left", "right", "middle"] as const)[e.button],
        timestamp: Date.now(),
      });

      // 自动移除
      setTimeout(() => removeClickEffect(id), 500);
    };

    window.addEventListener("mousedown", handleMouseDown, { capture: true });
    return () => window.removeEventListener("mousedown", handleMouseDown, { capture: true });
  }, [clickEnabled]);
}

export function useGlobalKeyboardListener() {
  const { keystrokeEnabled, keystrokeFilter, addKeystroke, removeKeystroke } = useOverlayStore();

  useEffect(() => {
    if (!keystrokeEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 过滤非修饰键组合
      const hasModifier = e.metaKey || e.ctrlKey || e.altKey || e.shiftKey;
      if (!hasModifier && !isSpecialKey(e.key)) return;

      const id = nanoid();
      addKeystroke({
        id,
        keys: buildKeyCombo(e),
        displayText: formatKeyDisplay(e),
        timestamp: Date.now(),
      });

      // 自动移除
      setTimeout(() => removeKeystroke(id), 1500);
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [keystrokeEnabled, keystrokeFilter]);
}

function buildKeyCombo(e: KeyboardEvent): string[] {
  const keys: string[] = [];
  if (e.metaKey) keys.push("Meta");
  if (e.ctrlKey) keys.push("Control");
  if (e.altKey) keys.push("Alt");
  if (e.shiftKey) keys.push("Shift");
  if (!["Meta", "Control", "Alt", "Shift"].includes(e.key)) {
    keys.push(e.key);
  }
  return keys;
}

function formatKeyDisplay(e: KeyboardEvent): string {
  const isMac = navigator.platform.includes("Mac");
  const symbols: Record<string, string> = isMac
    ? { Meta: "⌘", Control: "⌃", Alt: "⌥", Shift: "⇧" }
    : { Meta: "Win", Control: "Ctrl", Alt: "Alt", Shift: "Shift" };

  return buildKeyCombo(e)
    .map(k => symbols[k] ?? k.toUpperCase())
    .join(isMac ? "" : "+");
}

function isSpecialKey(key: string): boolean {
  return ["Escape", "Enter", "Tab", "Backspace", "Delete", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"].includes(key);
}
```

## 集成方式

### App.tsx 修改

```tsx
import { OverlayProvider, OverlayCanvas } from "@/components/overlay";

function App() {
  return (
    <OverlayProvider>
      <BrowserRouter>
        <Routes>
          {/* existing routes */}
        </Routes>
      </BrowserRouter>
      <OverlayCanvas />
    </OverlayProvider>
  );
}
```

### Settings 页面路由

```tsx
// App.tsx routes
<Route path="settings" element={<SettingsPage />}>
  {/* existing settings routes */}
  <Route path="overlay" element={null} />  {/* 新增 */}
</Route>
```

## 性能配置

```typescript
const PERFORMANCE_LIMITS = {
  maxDanmakuOnScreen: 500,
  maxClickEffects: 10,
  maxKeystrokeItems: 5,
  danmakuPoolSize: 200,
  clickEffectDuration: 400,
  keystrokeDuration: 1500,
};
```

## 配置持久化

```typescript
const STORAGE_KEY = "viben:overlay-settings";

const DEFAULT_SETTINGS: OverlaySettings = {
  defaultEnabled: false,
  opacity: 1,
  danmaku: {
    enabled: true,
    maxTracks: 8,
    speed: "normal",
    fontSize: 24,
    opacity: 0.9,
  },
  subtitle: {
    enabled: true,
    position: "bottom",
    fontSize: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    defaultAnimation: "fade",
  },
  clickIndicator: {
    enabled: true,
    style: "ripple",
    color: "#ffffff",
    size: 40,
  },
  keystroke: {
    enabled: true,
    position: "bottom-right",
    showModifiersOnly: true,
    duration: 1500,
  },
  shortcuts: {
    toggleOverlay: "CommandOrControl+Shift+O",
    toggleDanmaku: "CommandOrControl+Shift+D",
    toggleKeystroke: "CommandOrControl+Shift+K",
    toggleClickIndicator: "CommandOrControl+Shift+C",
    toggleSubtitle: "CommandOrControl+Shift+S",
  },
};
```

## 依赖变更

```json
// package.json 新增
{
  "dependencies": {
    "pixi.js": "^8.x",
    "@pixi/react": "^8.x"
  }
}
```

## 文件变更清单

| 操作 | 文件路径 |
|------|----------|
| 新增 | `src/components/overlay/index.ts` |
| 新增 | `src/components/overlay/overlay-canvas.tsx` |
| 新增 | `src/components/overlay/overlay-provider.tsx` |
| 新增 | `src/components/overlay/layers/danmaku-layer.tsx` |
| 新增 | `src/components/overlay/layers/subtitle-layer.tsx` |
| 新增 | `src/components/overlay/layers/click-indicator-layer.tsx` |
| 新增 | `src/components/overlay/layers/keystroke-layer.tsx` |
| 新增 | `src/components/overlay/elements/danmaku-item.tsx` |
| 新增 | `src/components/overlay/elements/subtitle-box.tsx` |
| 新增 | `src/components/overlay/elements/click-ripple.tsx` |
| 新增 | `src/components/overlay/elements/key-badge.tsx` |
| 新增 | `src/stores/overlay-store.ts` |
| 新增 | `src/hooks/use-overlay.ts` |
| 新增 | `src/hooks/use-danmaku.ts` |
| 新增 | `src/hooks/use-subtitle.ts` |
| 新增 | `src/hooks/use-click-indicator.ts` |
| 新增 | `src/hooks/use-keystroke.ts` |
| 新增 | `src/types/overlay.ts` |
| 新增 | `src/pages/settings-overlay.tsx` |
| 修改 | `src/App.tsx` |
| 修改 | `src/pages/settings.tsx` |
| 修改 | `src/pages/index.ts` |
| 修改 | `package.json` |
