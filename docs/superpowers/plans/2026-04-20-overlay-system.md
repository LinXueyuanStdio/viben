# Overlay 演示系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Viben Desktop 添加全局透明遮罩层，支持弹幕、字幕、点击指示器、按键可视化和状态波浪。

**Architecture:** 双层架构 - PixiJS Canvas (pointer-events: none) 负责高性能动画，React DOM 层负责可交互元素。Zustand 管理状态，YAML 持久化配置。

**Tech Stack:** PixiJS v8, @pixi/react, Zustand, js-yaml, Tauri FS API

---

## File Structure

```
apps/desktop/src/
├── types/overlay.ts                    # 所有类型定义
├── lib/
│   ├── overlay-config.ts               # YAML 配置读写
│   └── overlay/
│       ├── constants.ts                # 性能常量、z-index 枚举
│       ├── danmaku-pool.ts             # 弹幕对象池
│       └── track-allocator.ts          # 轨道分配器
├── stores/overlay-store.ts             # Zustand 状态管理
├── hooks/
│   ├── use-overlay.ts                  # 主控制 hook
│   ├── use-danmaku.ts                  # 弹幕控制
│   ├── use-subtitle.ts                 # 字幕控制 (含流式)
│   ├── use-click-indicator.ts          # 点击指示器
│   ├── use-keystroke.ts                # 按键可视化
│   ├── use-wave.ts                     # 状态波浪
│   └── use-global-input.ts             # 全局输入监听
├── components/overlay/
│   ├── index.ts                        # 导出入口
│   ├── overlay-provider.tsx            # Context Provider
│   ├── overlay-canvas.tsx              # PixiJS 主画布
│   ├── layers/
│   │   ├── danmaku-layer.tsx           # 弹幕层
│   │   ├── subtitle-layer.tsx          # 字幕层
│   │   ├── click-indicator-layer.tsx   # 点击指示器层
│   │   ├── keystroke-layer.tsx         # 按键可视化层
│   │   └── wave-layer.tsx              # 状态波浪层
│   └── elements/
│       ├── click-ripple.tsx            # 点击涟漪
│       └── key-badge.tsx               # 按键徽章
└── components/settings/
    └── settings-overlay.tsx            # 设置页面
```

---

## Task 1: 添加依赖和类型定义

**Files:**
- Modify: `apps/desktop/package.json`
- Create: `apps/desktop/src/types/overlay.ts`

- [ ] **Step 1: 安装 PixiJS 依赖**

```bash
cd apps/desktop && pnpm add pixi.js@^8.0.0 @pixi/react@^8.0.0 js-yaml@^4.1.0 && pnpm add -D @types/js-yaml@^4.0.9
```

- [ ] **Step 2: 验证依赖安装**

Run: `cd apps/desktop && pnpm list pixi.js @pixi/react js-yaml`
Expected: 显示已安装的版本

- [ ] **Step 3: 创建类型定义文件**

Create `apps/desktop/src/types/overlay.ts`:

```typescript
// === Z-Index 定义 ===
export enum PixiZIndex {
  Background = 0,
  StatusWave = 5,
  Live2D = 10,
  Subtitle = 20,
  DialogueBox = 30,
  ClickIndicator = 40,
  Keystroke = 50,
  Danmaku = 60,
  Custom = 100,
}

export enum DOMZIndex {
  OverlayCanvas = 9998,
  InteractiveLayer = 9999,
}

// === 弹幕 ===
export interface DanmakuItem {
  id: string;
  text: string;
  color?: string;
  fontSize?: number;
  speed?: "slow" | "normal" | "fast";
  track?: number;
  timestamp: number;
}

export interface DanmakuConfig {
  maxTracks: number;
  defaultSpeed: number;
  opacity: number;
  fontFamily: string;
}

// === 字幕 ===
export interface SubtitleItem {
  id: string;
  text: string;
  position: "top" | "center" | "bottom";
  style: "plain" | "dialogue" | "narrator";
  speaker?: string;
  duration?: number;
  animation?: "fade" | "typewriter" | "slide";
}

export interface SubtitleConfig {
  defaultPosition: "top" | "center" | "bottom";
  defaultDuration: number;
  fontSize: number;
  backgroundColor: string;
  padding: number;
}

export interface StreamingSubtitleState {
  id: string;
  text: string;
  isStreaming: boolean;
  cursor?: boolean;
  options?: Partial<SubtitleItem>;
}

// === 点击指示器 ===
export interface ClickEffect {
  id: string;
  x: number;
  y: number;
  button: "left" | "right" | "middle";
  timestamp: number;
}

export type ClickStyle = "ripple" | "spotlight" | "ring";

// === 按键可视化 ===
export interface KeystrokeItem {
  id: string;
  keys: string[];
  displayText: string;
  timestamp: number;
}

export type KeystrokePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

// === 状态波浪 ===
export type WaveState =
  | "idle"
  | "listening"
  | "speaking-calm"
  | "speaking-excited"
  | "speaking-happy"
  | "ending";

export interface WaveColorTheme {
  primary: string;
  secondary: string;
  accent?: string;
}

export interface WaveConfig {
  enabled: boolean;
  height: number;
  opacity: number;
  speed: number;
  particlesEnabled: boolean;
  customThemes?: Partial<Record<WaveState, WaveColorTheme>>;
}

export interface WaveAnimationParams {
  amplitude: number;
  frequency: number;
  speed: number;
  layers: number;
  particles?: {
    count: number;
    size: number;
    speed: number;
  };
}

// === 快捷键 ===
export interface OverlayShortcuts {
  toggleOverlay: string;
  toggleDanmaku: string;
  toggleKeystroke: string;
  toggleClickIndicator: string;
  toggleSubtitle: string;
}

// === 完整设置 ===
export interface OverlaySettings {
  version: number;
  default_enabled: boolean;
  opacity: number;

  danmaku: {
    enabled: boolean;
    max_tracks: number;
    speed: "slow" | "normal" | "fast";
    font_size: number;
    opacity: number;
  };

  subtitle: {
    enabled: boolean;
    position: "top" | "center" | "bottom";
    font_size: number;
    background_color: string;
    default_animation: "fade" | "typewriter" | "slide";
  };

  click_indicator: {
    enabled: boolean;
    style: ClickStyle;
    color: string;
    size: number;
  };

  keystroke: {
    enabled: boolean;
    position: KeystrokePosition;
    show_modifiers_only: boolean;
    show_keys: string[];
    duration: number;
  };

  wave: {
    enabled: boolean;
    height: number;
    opacity: number;
    speed: number;
    particles_enabled: boolean;
    custom_themes?: Partial<Record<WaveState, WaveColorTheme>>;
  };

  shortcuts: OverlayShortcuts;
}
```

- [ ] **Step 4: 更新类型导出**

Edit `apps/desktop/src/types/index.ts`, 添加:

```typescript
export * from "./overlay";
```

- [ ] **Step 5: 验证类型编译**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/package.json apps/desktop/pnpm-lock.yaml apps/desktop/src/types/overlay.ts apps/desktop/src/types/index.ts
git commit -m "feat(overlay): add dependencies and type definitions"
```

---

## Task 2: 常量和工具函数

**Files:**
- Create: `apps/desktop/src/lib/overlay/constants.ts`
- Create: `apps/desktop/src/lib/overlay/danmaku-pool.ts`
- Create: `apps/desktop/src/lib/overlay/track-allocator.ts`
- Create: `apps/desktop/src/lib/overlay/index.ts`

- [ ] **Step 1: 创建常量文件**

Create `apps/desktop/src/lib/overlay/constants.ts`:

```typescript
import type { WaveState, WaveColorTheme, WaveAnimationParams } from "@/types/overlay";

export const PERFORMANCE_LIMITS = {
  maxDanmakuOnScreen: 500,
  maxClickEffects: 10,
  maxKeystrokeItems: 5,
  maxInteractiveElements: 20,
  danmakuPoolSize: 350,
  clickEffectDuration: 400,
  keystrokeDuration: 1500,
  streamingCharInterval: 16,
  fpsThreshold: 30,
  degradedMaxDanmaku: 200,
} as const;

export const WAVE_THEMES: Record<WaveState, WaveColorTheme> = {
  idle: { primary: "#4a5568", secondary: "#2d3748" },
  listening: { primary: "#667eea", secondary: "#764ba2" },
  "speaking-calm": { primary: "#38b2ac", secondary: "#48bb78" },
  "speaking-excited": { primary: "#ed8936", secondary: "#f56565" },
  "speaking-happy": { primary: "#ed64a6", secondary: "#fbd38d", accent: "#faf089" },
  ending: { primary: "#a0aec0", secondary: "#718096" },
};

export const WAVE_PARAMS: Record<WaveState, WaveAnimationParams> = {
  idle: { amplitude: 5, frequency: 0.5, speed: 0.3, layers: 2 },
  listening: { amplitude: 15, frequency: 1, speed: 0.5, layers: 3 },
  "speaking-calm": { amplitude: 20, frequency: 1.2, speed: 0.6, layers: 3 },
  "speaking-excited": { amplitude: 35, frequency: 2, speed: 1.2, layers: 4 },
  "speaking-happy": {
    amplitude: 25,
    frequency: 1.5,
    speed: 0.8,
    layers: 4,
    particles: { count: 20, size: 4, speed: 1.5 },
  },
  ending: { amplitude: 10, frequency: 0.8, speed: 0.4, layers: 2 },
};

export const SPEED_VALUES: Record<"slow" | "normal" | "fast", number> = {
  slow: 80,
  normal: 150,
  fast: 250,
};
```

- [ ] **Step 2: 创建弹幕对象池**

Create `apps/desktop/src/lib/overlay/danmaku-pool.ts`:

```typescript
import { Graphics } from "pixi.js";
import { PERFORMANCE_LIMITS } from "./constants";

export class DanmakuPool {
  private pool: Graphics[] = [];
  private maxSize: number;

  constructor(maxSize: number = PERFORMANCE_LIMITS.danmakuPoolSize) {
    this.maxSize = maxSize;
    for (let i = 0; i < maxSize / 2; i++) {
      this.pool.push(new Graphics());
    }
  }

  acquire(): Graphics {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return new Graphics();
  }

  release(item: Graphics): void {
    item.clear();
    item.visible = false;
    if (this.pool.length < this.maxSize) {
      this.pool.push(item);
    } else {
      item.destroy();
    }
  }

  get size(): number {
    return this.pool.length;
  }

  destroy(): void {
    this.pool.forEach((item) => item.destroy());
    this.pool = [];
  }
}
```

- [ ] **Step 3: 创建轨道分配器**

Create `apps/desktop/src/lib/overlay/track-allocator.ts`:

```typescript
import type { DanmakuItem } from "@/types/overlay";

interface TrackOccupancy {
  endTime: number;
  itemId: string;
}

export class GreedyTrackAllocator {
  private tracks: Map<number, TrackOccupancy> = new Map();
  private maxTracks: number;

  constructor(maxTracks: number = 8) {
    this.maxTracks = maxTracks;
  }

  allocate(item: DanmakuItem, duration: number): number {
    const now = Date.now();
    const endTime = now + duration;

    for (let i = 0; i < this.maxTracks; i++) {
      const occupancy = this.tracks.get(i);
      if (!occupancy || occupancy.endTime < now) {
        this.tracks.set(i, { endTime, itemId: item.id });
        return i;
      }
    }

    let minEndTime = Infinity;
    let bestTrack = 0;
    for (let i = 0; i < this.maxTracks; i++) {
      const occupancy = this.tracks.get(i)!;
      if (occupancy.endTime < minEndTime) {
        minEndTime = occupancy.endTime;
        bestTrack = i;
      }
    }

    if (now - minEndTime < 500) {
      this.tracks.set(bestTrack, { endTime, itemId: item.id });
      return bestTrack;
    }

    return -1;
  }

  release(trackIndex: number, itemId: string): void {
    const occupancy = this.tracks.get(trackIndex);
    if (occupancy?.itemId === itemId) {
      this.tracks.delete(trackIndex);
    }
  }

  setMaxTracks(maxTracks: number): void {
    this.maxTracks = maxTracks;
    for (const [track] of this.tracks) {
      if (track >= maxTracks) {
        this.tracks.delete(track);
      }
    }
  }
}
```

- [ ] **Step 4: 创建导出入口**

Create `apps/desktop/src/lib/overlay/index.ts`:

```typescript
export * from "./constants";
export { DanmakuPool } from "./danmaku-pool";
export { GreedyTrackAllocator } from "./track-allocator";
```

- [ ] **Step 5: 验证编译**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/lib/overlay/
git commit -m "feat(overlay): add constants, object pool, and track allocator"
```

---

## Task 3: 配置读写和默认值

**Files:**
- Create: `apps/desktop/src/lib/overlay-config.ts`

- [ ] **Step 1: 创建配置读写模块**

Create `apps/desktop/src/lib/overlay-config.ts`:

```typescript
import { readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";
import * as yaml from "js-yaml";
import type { OverlaySettings } from "@/types/overlay";

const CONFIG_PATH = ".viben/overlay.yaml";

export const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
  version: 1,
  default_enabled: false,
  opacity: 1,
  danmaku: {
    enabled: true,
    max_tracks: 8,
    speed: "normal",
    font_size: 24,
    opacity: 0.9,
  },
  subtitle: {
    enabled: true,
    position: "bottom",
    font_size: 20,
    background_color: "rgba(0,0,0,0.7)",
    default_animation: "fade",
  },
  click_indicator: {
    enabled: true,
    style: "ripple",
    color: "#ffffff",
    size: 40,
  },
  keystroke: {
    enabled: true,
    position: "bottom-right",
    show_modifiers_only: true,
    show_keys: ["Escape", "Enter", "Tab"],
    duration: 1500,
  },
  wave: {
    enabled: true,
    height: 60,
    opacity: 0.6,
    speed: 1,
    particles_enabled: true,
  },
  shortcuts: {
    toggleOverlay: "CommandOrControl+Shift+O",
    toggleDanmaku: "CommandOrControl+Shift+D",
    toggleKeystroke: "CommandOrControl+Shift+K",
    toggleClickIndicator: "CommandOrControl+Shift+C",
    toggleSubtitle: "CommandOrControl+Shift+S",
  },
};

export async function loadOverlayConfig(): Promise<OverlaySettings> {
  try {
    const home = await homeDir();
    const configPath = `${home}${CONFIG_PATH}`;

    if (await exists(configPath)) {
      const content = await readTextFile(configPath);
      const loaded = yaml.load(content) as Partial<OverlaySettings>;
      return { ...DEFAULT_OVERLAY_SETTINGS, ...loaded };
    }
  } catch (error) {
    console.warn("[Overlay] Failed to load config:", error);
  }

  return DEFAULT_OVERLAY_SETTINGS;
}

export async function saveOverlayConfig(settings: OverlaySettings): Promise<void> {
  try {
    const home = await homeDir();
    const vibenDir = `${home}.viben`;
    const configPath = `${home}${CONFIG_PATH}`;

    if (!(await exists(vibenDir))) {
      await mkdir(vibenDir);
    }

    const content = yaml.dump(settings, {
      indent: 2,
      lineWidth: -1,
    });
    await writeTextFile(configPath, content);
  } catch (error) {
    console.error("[Overlay] Failed to save config:", error);
    throw error;
  }
}
```

- [ ] **Step 2: 验证编译**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/overlay-config.ts
git commit -m "feat(overlay): add config load/save with YAML persistence"
```

---

## Task 4: Zustand Store

**Files:**
- Create: `apps/desktop/src/stores/overlay-store.ts`
- Modify: `apps/desktop/src/stores/index.ts`

- [ ] **Step 1: 创建 Overlay Store**

Create `apps/desktop/src/stores/overlay-store.ts`:

```typescript
import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  DanmakuItem,
  DanmakuConfig,
  SubtitleItem,
  SubtitleConfig,
  StreamingSubtitleState,
  ClickEffect,
  ClickStyle,
  KeystrokeItem,
  KeystrokePosition,
  WaveState,
  WaveConfig,
  OverlaySettings,
} from "@/types/overlay";
import { DEFAULT_OVERLAY_SETTINGS } from "@/lib/overlay-config";
import { PERFORMANCE_LIMITS } from "@/lib/overlay/constants";

interface OverlayState {
  // Global
  visible: boolean;
  opacity: number;
  configLoaded: boolean;

  // Danmaku
  danmakuEnabled: boolean;
  danmakuItems: DanmakuItem[];
  danmakuConfig: DanmakuConfig;
  danmakuPaused: boolean;

  // Subtitle
  subtitleEnabled: boolean;
  currentSubtitle: SubtitleItem | null;
  subtitleQueue: SubtitleItem[];
  subtitleConfig: SubtitleConfig;
  streamingSubtitle: StreamingSubtitleState | null;

  // Click
  clickEnabled: boolean;
  clickStyle: ClickStyle;
  clickEffects: ClickEffect[];

  // Keystroke
  keystrokeEnabled: boolean;
  keystrokePosition: KeystrokePosition;
  keystrokeItems: KeystrokeItem[];
  keystrokeShowModifiersOnly: boolean;
  keystrokeShowKeys: string[];

  // Wave
  waveEnabled: boolean;
  waveState: WaveState;
  waveConfig: WaveConfig;
}

interface OverlayActions {
  // Config
  loadConfig: (settings: OverlaySettings) => void;

  // Global
  show: () => void;
  hide: () => void;
  toggle: () => void;
  setOpacity: (opacity: number) => void;

  // Danmaku
  sendDanmaku: (text: string, options?: Partial<DanmakuItem>) => void;
  clearDanmaku: () => void;
  pauseDanmaku: () => void;
  resumeDanmaku: () => void;
  removeDanmaku: (id: string) => void;
  setDanmakuEnabled: (enabled: boolean) => void;

  // Subtitle
  showSubtitle: (text: string, options?: Partial<SubtitleItem>) => void;
  hideSubtitle: () => void;
  setSubtitleEnabled: (enabled: boolean) => void;
  startStream: (options?: Partial<SubtitleItem>) => string;
  appendStream: (chunk: string) => void;
  finishStream: () => void;
  cancelStream: () => void;

  // Click
  setClickEnabled: (enabled: boolean) => void;
  setClickStyle: (style: ClickStyle) => void;
  addClickEffect: (effect: ClickEffect) => void;
  removeClickEffect: (id: string) => void;

  // Keystroke
  setKeystrokeEnabled: (enabled: boolean) => void;
  setKeystrokePosition: (position: KeystrokePosition) => void;
  addKeystroke: (item: KeystrokeItem) => void;
  removeKeystroke: (id: string) => void;

  // Wave
  setWaveEnabled: (enabled: boolean) => void;
  setWaveState: (state: WaveState) => void;
  setWaveConfig: (config: Partial<WaveConfig>) => void;
}

const initialState: OverlayState = {
  visible: false,
  opacity: 1,
  configLoaded: false,

  danmakuEnabled: true,
  danmakuItems: [],
  danmakuConfig: {
    maxTracks: 8,
    defaultSpeed: 150,
    opacity: 0.9,
    fontFamily: "system-ui",
  },
  danmakuPaused: false,

  subtitleEnabled: true,
  currentSubtitle: null,
  subtitleQueue: [],
  subtitleConfig: {
    defaultPosition: "bottom",
    defaultDuration: 5000,
    fontSize: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 12,
  },
  streamingSubtitle: null,

  clickEnabled: true,
  clickStyle: "ripple",
  clickEffects: [],

  keystrokeEnabled: true,
  keystrokePosition: "bottom-right",
  keystrokeItems: [],
  keystrokeShowModifiersOnly: true,
  keystrokeShowKeys: ["Escape", "Enter", "Tab"],

  waveEnabled: true,
  waveState: "idle",
  waveConfig: {
    enabled: true,
    height: 60,
    opacity: 0.6,
    speed: 1,
    particlesEnabled: true,
  },
};

export const useOverlayStore = create<OverlayState & { actions: OverlayActions }>((set, get) => ({
  ...initialState,

  actions: {
    loadConfig: (settings) => {
      set({
        configLoaded: true,
        visible: settings.default_enabled,
        opacity: settings.opacity,
        danmakuEnabled: settings.danmaku.enabled,
        danmakuConfig: {
          maxTracks: settings.danmaku.max_tracks,
          defaultSpeed: settings.danmaku.speed === "slow" ? 80 : settings.danmaku.speed === "fast" ? 250 : 150,
          opacity: settings.danmaku.opacity,
          fontFamily: "system-ui",
        },
        subtitleEnabled: settings.subtitle.enabled,
        subtitleConfig: {
          defaultPosition: settings.subtitle.position,
          defaultDuration: 5000,
          fontSize: settings.subtitle.font_size,
          backgroundColor: settings.subtitle.background_color,
          padding: 12,
        },
        clickEnabled: settings.click_indicator.enabled,
        clickStyle: settings.click_indicator.style,
        keystrokeEnabled: settings.keystroke.enabled,
        keystrokePosition: settings.keystroke.position,
        keystrokeShowModifiersOnly: settings.keystroke.show_modifiers_only,
        keystrokeShowKeys: settings.keystroke.show_keys,
        waveEnabled: settings.wave.enabled,
        waveConfig: {
          enabled: settings.wave.enabled,
          height: settings.wave.height,
          opacity: settings.wave.opacity,
          speed: settings.wave.speed,
          particlesEnabled: settings.wave.particles_enabled,
          customThemes: settings.wave.custom_themes,
        },
      });
    },

    show: () => set({ visible: true }),
    hide: () => set({ visible: false }),
    toggle: () => set((s) => ({ visible: !s.visible })),
    setOpacity: (opacity) => set({ opacity }),

    sendDanmaku: (text, options) => {
      const item: DanmakuItem = {
        id: nanoid(),
        text,
        timestamp: Date.now(),
        ...options,
      };
      set((s) => ({
        danmakuItems: [...s.danmakuItems, item].slice(-PERFORMANCE_LIMITS.maxDanmakuOnScreen),
      }));
    },
    clearDanmaku: () => set({ danmakuItems: [] }),
    pauseDanmaku: () => set({ danmakuPaused: true }),
    resumeDanmaku: () => set({ danmakuPaused: false }),
    removeDanmaku: (id) => set((s) => ({ danmakuItems: s.danmakuItems.filter((d) => d.id !== id) })),
    setDanmakuEnabled: (enabled) => set({ danmakuEnabled: enabled }),

    showSubtitle: (text, options) => {
      const item: SubtitleItem = {
        id: nanoid(),
        text,
        position: options?.position ?? get().subtitleConfig.defaultPosition,
        style: options?.style ?? "plain",
        ...options,
      };
      set({ currentSubtitle: item });
    },
    hideSubtitle: () => set({ currentSubtitle: null }),
    setSubtitleEnabled: (enabled) => set({ subtitleEnabled: enabled }),

    startStream: (options) => {
      const id = nanoid();
      set({
        streamingSubtitle: {
          id,
          text: "",
          isStreaming: true,
          cursor: true,
          options,
        },
      });
      return id;
    },
    appendStream: (chunk) => {
      set((s) => {
        if (!s.streamingSubtitle) return s;
        return {
          streamingSubtitle: {
            ...s.streamingSubtitle,
            text: s.streamingSubtitle.text + chunk,
          },
        };
      });
    },
    finishStream: () => {
      set((s) => {
        if (!s.streamingSubtitle) return s;
        return {
          streamingSubtitle: {
            ...s.streamingSubtitle,
            isStreaming: false,
            cursor: false,
          },
        };
      });
    },
    cancelStream: () => set({ streamingSubtitle: null }),

    setClickEnabled: (enabled) => set({ clickEnabled: enabled }),
    setClickStyle: (style) => set({ clickStyle: style }),
    addClickEffect: (effect) => {
      set((s) => ({
        clickEffects: [...s.clickEffects, effect].slice(-PERFORMANCE_LIMITS.maxClickEffects),
      }));
    },
    removeClickEffect: (id) => set((s) => ({ clickEffects: s.clickEffects.filter((e) => e.id !== id) })),

    setKeystrokeEnabled: (enabled) => set({ keystrokeEnabled: enabled }),
    setKeystrokePosition: (position) => set({ keystrokePosition: position }),
    addKeystroke: (item) => {
      set((s) => ({
        keystrokeItems: [...s.keystrokeItems, item].slice(-PERFORMANCE_LIMITS.maxKeystrokeItems),
      }));
    },
    removeKeystroke: (id) => set((s) => ({ keystrokeItems: s.keystrokeItems.filter((k) => k.id !== id) })),

    setWaveEnabled: (enabled) => set({ waveEnabled: enabled }),
    setWaveState: (state) => set({ waveState: state }),
    setWaveConfig: (config) => set((s) => ({ waveConfig: { ...s.waveConfig, ...config } })),
  },
}));
```

- [ ] **Step 2: 更新 stores/index.ts**

Edit `apps/desktop/src/stores/index.ts`, 添加:

```typescript
export { useOverlayStore } from "./overlay-store";
```

- [ ] **Step 3: 验证编译**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/stores/overlay-store.ts apps/desktop/src/stores/index.ts
git commit -m "feat(overlay): add Zustand store for overlay state management"
```

---

## Task 5: Hooks - use-overlay 和 use-danmaku

**Files:**
- Create: `apps/desktop/src/hooks/use-overlay.ts`
- Create: `apps/desktop/src/hooks/use-danmaku.ts`
- Modify: `apps/desktop/src/hooks/index.ts`

- [ ] **Step 1: 创建 use-overlay hook**

Create `apps/desktop/src/hooks/use-overlay.ts`:

```typescript
import { useEffect, useCallback, useState } from "react";
import { useOverlayStore } from "@/stores/overlay-store";
import { loadOverlayConfig, saveOverlayConfig } from "@/lib/overlay-config";
import type { OverlaySettings } from "@/types/overlay";

interface UseOverlayReturn {
  visible: boolean;
  opacity: number;
  configLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  show: () => void;
  hide: () => void;
  toggle: () => void;
  setOpacity: (opacity: number) => void;
  saveSettings: (settings: OverlaySettings) => Promise<void>;
}

export function useOverlay(): UseOverlayReturn {
  const store = useOverlayStore();
  const { visible, opacity, configLoaded, actions } = store;
  const [isLoading, setIsLoading] = useState(!configLoaded);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (configLoaded) return;

    setIsLoading(true);
    setError(null);

    loadOverlayConfig()
      .then((settings) => {
        actions.loadConfig(settings);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load config");
        console.error("[useOverlay] Failed to load config:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [configLoaded, actions]);

  const saveSettings = useCallback(async (settings: OverlaySettings) => {
    try {
      await saveOverlayConfig(settings);
      actions.loadConfig(settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config");
      throw err;
    }
  }, [actions]);

  return {
    visible,
    opacity,
    configLoaded,
    isLoading,
    error,
    show: actions.show,
    hide: actions.hide,
    toggle: actions.toggle,
    setOpacity: actions.setOpacity,
    saveSettings,
  };
}
```

- [ ] **Step 2: 创建 use-danmaku hook**

Create `apps/desktop/src/hooks/use-danmaku.ts`:

```typescript
import { useCallback, useMemo } from "react";
import { useOverlayStore } from "@/stores/overlay-store";
import type { DanmakuItem, DanmakuConfig } from "@/types/overlay";

interface UseDanmakuReturn {
  enabled: boolean;
  items: DanmakuItem[];
  config: DanmakuConfig;
  paused: boolean;
  send: (text: string, options?: Partial<DanmakuItem>) => void;
  sendBatch: (texts: string[], options?: Partial<DanmakuItem>) => void;
  clear: () => void;
  pause: () => void;
  resume: () => void;
  remove: (id: string) => void;
  setEnabled: (enabled: boolean) => void;
}

export function useDanmaku(): UseDanmakuReturn {
  const store = useOverlayStore();
  const {
    danmakuEnabled: enabled,
    danmakuItems: items,
    danmakuConfig: config,
    danmakuPaused: paused,
    actions,
  } = store;

  const sendBatch = useCallback(
    (texts: string[], options?: Partial<DanmakuItem>) => {
      const interval = 100;
      texts.forEach((text, i) => {
        setTimeout(() => {
          actions.sendDanmaku(text, options);
        }, i * interval);
      });
    },
    [actions]
  );

  return useMemo(
    () => ({
      enabled,
      items,
      config,
      paused,
      send: actions.sendDanmaku,
      sendBatch,
      clear: actions.clearDanmaku,
      pause: actions.pauseDanmaku,
      resume: actions.resumeDanmaku,
      remove: actions.removeDanmaku,
      setEnabled: actions.setDanmakuEnabled,
    }),
    [enabled, items, config, paused, actions, sendBatch]
  );
}
```

- [ ] **Step 3: 更新 hooks/index.ts**

Edit `apps/desktop/src/hooks/index.ts`, 添加:

```typescript
export { useOverlay } from "./use-overlay";
export { useDanmaku } from "./use-danmaku";
```

- [ ] **Step 4: 验证编译**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/hooks/use-overlay.ts apps/desktop/src/hooks/use-danmaku.ts apps/desktop/src/hooks/index.ts
git commit -m "feat(overlay): add use-overlay and use-danmaku hooks"
```

---

## Task 6: Hooks - use-subtitle (含流式)

**Files:**
- Create: `apps/desktop/src/hooks/use-subtitle.ts`
- Modify: `apps/desktop/src/hooks/index.ts`

- [ ] **Step 1: 创建 use-subtitle hook**

Create `apps/desktop/src/hooks/use-subtitle.ts`:

```typescript
import { useCallback, useMemo } from "react";
import { useOverlayStore } from "@/stores/overlay-store";
import type { SubtitleItem, SubtitleConfig, StreamingSubtitleState } from "@/types/overlay";

interface UseSubtitleReturn {
  enabled: boolean;
  current: SubtitleItem | null;
  config: SubtitleConfig;
  streaming: StreamingSubtitleState | null;
  show: (text: string, options?: Partial<SubtitleItem>) => void;
  hide: () => void;
  setEnabled: (enabled: boolean) => void;
  startStream: (options?: Partial<SubtitleItem>) => string;
  appendStream: (chunk: string) => void;
  finishStream: () => void;
  cancelStream: () => void;
  streamFromAsyncIterator: (
    iterator: AsyncIterable<string>,
    options?: Partial<SubtitleItem>
  ) => Promise<string>;
}

export function useSubtitle(): UseSubtitleReturn {
  const store = useOverlayStore();
  const {
    subtitleEnabled: enabled,
    currentSubtitle: current,
    subtitleConfig: config,
    streamingSubtitle: streaming,
    actions,
  } = store;

  const streamFromAsyncIterator = useCallback(
    async (
      iterator: AsyncIterable<string>,
      options?: Partial<SubtitleItem>
    ): Promise<string> => {
      actions.startStream(options);
      let fullText = "";

      try {
        for await (const chunk of iterator) {
          fullText += chunk;
          actions.appendStream(chunk);
        }
        actions.finishStream();
      } catch (error) {
        actions.cancelStream();
        throw error;
      }

      return fullText;
    },
    [actions]
  );

  return useMemo(
    () => ({
      enabled,
      current,
      config,
      streaming,
      show: actions.showSubtitle,
      hide: actions.hideSubtitle,
      setEnabled: actions.setSubtitleEnabled,
      startStream: actions.startStream,
      appendStream: actions.appendStream,
      finishStream: actions.finishStream,
      cancelStream: actions.cancelStream,
      streamFromAsyncIterator,
    }),
    [enabled, current, config, streaming, actions, streamFromAsyncIterator]
  );
}
```

- [ ] **Step 2: 更新 hooks/index.ts**

Edit `apps/desktop/src/hooks/index.ts`, 添加:

```typescript
export { useSubtitle } from "./use-subtitle";
```

- [ ] **Step 3: 验证编译**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/hooks/use-subtitle.ts apps/desktop/src/hooks/index.ts
git commit -m "feat(overlay): add use-subtitle hook with streaming support"
```

---

## Task 7: Hooks - use-click-indicator, use-keystroke, use-wave

**Files:**
- Create: `apps/desktop/src/hooks/use-click-indicator.ts`
- Create: `apps/desktop/src/hooks/use-keystroke.ts`
- Create: `apps/desktop/src/hooks/use-wave.ts`
- Modify: `apps/desktop/src/hooks/index.ts`

- [ ] **Step 1: 创建 use-click-indicator hook**

Create `apps/desktop/src/hooks/use-click-indicator.ts`:

```typescript
import { useMemo } from "react";
import { useOverlayStore } from "@/stores/overlay-store";
import type { ClickEffect, ClickStyle } from "@/types/overlay";

interface UseClickIndicatorReturn {
  enabled: boolean;
  style: ClickStyle;
  effects: ClickEffect[];
  setEnabled: (enabled: boolean) => void;
  setStyle: (style: ClickStyle) => void;
  addEffect: (effect: ClickEffect) => void;
  removeEffect: (id: string) => void;
}

export function useClickIndicator(): UseClickIndicatorReturn {
  const store = useOverlayStore();
  const { clickEnabled: enabled, clickStyle: style, clickEffects: effects, actions } = store;

  return useMemo(
    () => ({
      enabled,
      style,
      effects,
      setEnabled: actions.setClickEnabled,
      setStyle: actions.setClickStyle,
      addEffect: actions.addClickEffect,
      removeEffect: actions.removeClickEffect,
    }),
    [enabled, style, effects, actions]
  );
}
```

- [ ] **Step 2: 创建 use-keystroke hook**

Create `apps/desktop/src/hooks/use-keystroke.ts`:

```typescript
import { useMemo } from "react";
import { useOverlayStore } from "@/stores/overlay-store";
import type { KeystrokeItem, KeystrokePosition } from "@/types/overlay";

interface UseKeystrokeReturn {
  enabled: boolean;
  position: KeystrokePosition;
  items: KeystrokeItem[];
  showModifiersOnly: boolean;
  showKeys: string[];
  setEnabled: (enabled: boolean) => void;
  setPosition: (position: KeystrokePosition) => void;
  addKeystroke: (item: KeystrokeItem) => void;
  removeKeystroke: (id: string) => void;
}

export function useKeystroke(): UseKeystrokeReturn {
  const store = useOverlayStore();
  const {
    keystrokeEnabled: enabled,
    keystrokePosition: position,
    keystrokeItems: items,
    keystrokeShowModifiersOnly: showModifiersOnly,
    keystrokeShowKeys: showKeys,
    actions,
  } = store;

  return useMemo(
    () => ({
      enabled,
      position,
      items,
      showModifiersOnly,
      showKeys,
      setEnabled: actions.setKeystrokeEnabled,
      setPosition: actions.setKeystrokePosition,
      addKeystroke: actions.addKeystroke,
      removeKeystroke: actions.removeKeystroke,
    }),
    [enabled, position, items, showModifiersOnly, showKeys, actions]
  );
}
```

- [ ] **Step 3: 创建 use-wave hook**

Create `apps/desktop/src/hooks/use-wave.ts`:

```typescript
import { useCallback, useMemo, useRef } from "react";
import { useOverlayStore } from "@/stores/overlay-store";
import type { WaveState, WaveConfig } from "@/types/overlay";

interface UseWaveReturn {
  enabled: boolean;
  state: WaveState;
  config: WaveConfig;
  setEnabled: (enabled: boolean) => void;
  setState: (state: WaveState) => void;
  setConfig: (config: Partial<WaveConfig>) => void;
  startListening: () => void;
  startSpeaking: (mood?: "calm" | "excited" | "happy") => void;
  stopSpeaking: () => void;
  reset: () => void;
}

export function useWave(): UseWaveReturn {
  const store = useOverlayStore();
  const { waveEnabled: enabled, waveState: state, waveConfig: config, actions } = store;
  const endingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearEndingTimeout = useCallback(() => {
    if (endingTimeoutRef.current) {
      clearTimeout(endingTimeoutRef.current);
      endingTimeoutRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    clearEndingTimeout();
    actions.setWaveState("listening");
  }, [actions, clearEndingTimeout]);

  const startSpeaking = useCallback(
    (mood: "calm" | "excited" | "happy" = "calm") => {
      clearEndingTimeout();
      actions.setWaveState(`speaking-${mood}`);
    },
    [actions, clearEndingTimeout]
  );

  const stopSpeaking = useCallback(() => {
    clearEndingTimeout();
    actions.setWaveState("ending");
    endingTimeoutRef.current = setTimeout(() => {
      actions.setWaveState("idle");
    }, 300);
  }, [actions, clearEndingTimeout]);

  const reset = useCallback(() => {
    clearEndingTimeout();
    actions.setWaveState("idle");
  }, [actions, clearEndingTimeout]);

  return useMemo(
    () => ({
      enabled,
      state,
      config,
      setEnabled: actions.setWaveEnabled,
      setState: actions.setWaveState,
      setConfig: actions.setWaveConfig,
      startListening,
      startSpeaking,
      stopSpeaking,
      reset,
    }),
    [enabled, state, config, actions, startListening, startSpeaking, stopSpeaking, reset]
  );
}
```

- [ ] **Step 4: 更新 hooks/index.ts**

Edit `apps/desktop/src/hooks/index.ts`, 添加:

```typescript
export { useClickIndicator } from "./use-click-indicator";
export { useKeystroke } from "./use-keystroke";
export { useWave } from "./use-wave";
```

- [ ] **Step 5: 验证编译**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/hooks/use-click-indicator.ts apps/desktop/src/hooks/use-keystroke.ts apps/desktop/src/hooks/use-wave.ts apps/desktop/src/hooks/index.ts
git commit -m "feat(overlay): add click, keystroke, and wave hooks"
```

---

## Task 8: Hook - use-global-input (全局输入监听)

**Files:**
- Create: `apps/desktop/src/hooks/use-global-input.ts`
- Modify: `apps/desktop/src/hooks/index.ts`

- [ ] **Step 1: 创建 use-global-input hook**

Create `apps/desktop/src/hooks/use-global-input.ts`:

```typescript
import { useEffect, useCallback, useRef } from "react";
import { nanoid } from "nanoid";
import { useClickIndicator } from "./use-click-indicator";
import { useKeystroke } from "./use-keystroke";
import type { ClickEffect, KeystrokeItem } from "@/types/overlay";
import { PERFORMANCE_LIMITS } from "@/lib/overlay/constants";

const MODIFIER_KEYS = ["Meta", "Control", "Alt", "Shift"];

function formatKeyDisplay(keys: string[]): string {
  const isMac = navigator.platform.includes("Mac");
  const symbolMap: Record<string, string> = isMac
    ? { Meta: "⌘", Control: "⌃", Alt: "⌥", Shift: "⇧" }
    : { Meta: "Win", Control: "Ctrl", Alt: "Alt", Shift: "Shift" };

  return keys
    .map((key) => symbolMap[key] ?? key)
    .join(isMac ? "" : "+");
}

export function useGlobalInput(): void {
  const { enabled: clickEnabled, addEffect, removeEffect } = useClickIndicator();
  const {
    enabled: keystrokeEnabled,
    showModifiersOnly,
    showKeys,
    addKeystroke,
    removeKeystroke,
  } = useKeystroke();

  const pressedKeysRef = useRef<Set<string>>(new Set());

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!clickEnabled) return;

      const button: ClickEffect["button"] =
        e.button === 0 ? "left" : e.button === 2 ? "right" : "middle";

      const effect: ClickEffect = {
        id: nanoid(),
        x: e.clientX,
        y: e.clientY,
        button,
        timestamp: Date.now(),
      };

      addEffect(effect);

      setTimeout(() => {
        removeEffect(effect.id);
      }, PERFORMANCE_LIMITS.clickEffectDuration);
    },
    [clickEnabled, addEffect, removeEffect]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!keystrokeEnabled) return;

      const key = e.key;
      if (pressedKeysRef.current.has(key)) return;
      pressedKeysRef.current.add(key);

      const hasModifier = e.metaKey || e.ctrlKey || e.altKey || e.shiftKey;
      const isModifierKey = MODIFIER_KEYS.includes(key);

      if (showModifiersOnly && !hasModifier && !showKeys.includes(key)) {
        return;
      }

      const keys: string[] = [];
      if (e.metaKey && key !== "Meta") keys.push("Meta");
      if (e.ctrlKey && key !== "Control") keys.push("Control");
      if (e.altKey && key !== "Alt") keys.push("Alt");
      if (e.shiftKey && key !== "Shift") keys.push("Shift");
      if (!isModifierKey) keys.push(key);

      if (keys.length === 0) return;

      const item: KeystrokeItem = {
        id: nanoid(),
        keys,
        displayText: formatKeyDisplay(keys),
        timestamp: Date.now(),
      };

      addKeystroke(item);

      setTimeout(() => {
        removeKeystroke(item.id);
      }, PERFORMANCE_LIMITS.keystrokeDuration);
    },
    [keystrokeEnabled, showModifiersOnly, showKeys, addKeystroke, removeKeystroke]
  );

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    pressedKeysRef.current.delete(e.key);
  }, []);

  useEffect(() => {
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleMouseDown, handleKeyDown, handleKeyUp]);
}
```

- [ ] **Step 2: 更新 hooks/index.ts**

Edit `apps/desktop/src/hooks/index.ts`, 添加:

```typescript
export { useGlobalInput } from "./use-global-input";
```

- [ ] **Step 3: 验证编译**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/hooks/use-global-input.ts apps/desktop/src/hooks/index.ts
git commit -m "feat(overlay): add use-global-input hook for click and keystroke capture"
```

---

## Task 9: OverlayProvider 和 OverlayCanvas

**Files:**
- Create: `apps/desktop/src/components/overlay/overlay-provider.tsx`
- Create: `apps/desktop/src/components/overlay/overlay-canvas.tsx`
- Create: `apps/desktop/src/components/overlay/index.ts`

- [ ] **Step 1: 创建 OverlayProvider**

Create `apps/desktop/src/components/overlay/overlay-provider.tsx`:

```typescript
import { type ReactNode, createContext, useContext, useMemo, useEffect, useState } from "react";
import { Application } from "pixi.js";
import { useOverlay } from "@/hooks/use-overlay";
import { useGlobalInput } from "@/hooks/use-global-input";
import { DanmakuPool } from "@/lib/overlay/danmaku-pool";
import { GreedyTrackAllocator } from "@/lib/overlay/track-allocator";

interface OverlayContextValue {
  app: Application | null;
  danmakuPool: DanmakuPool;
  trackAllocator: GreedyTrackAllocator;
  isReady: boolean;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function useOverlayContext(): OverlayContextValue {
  const ctx = useContext(OverlayContext);
  if (!ctx) {
    throw new Error("useOverlayContext must be used within OverlayProvider");
  }
  return ctx;
}

interface OverlayProviderProps {
  children: ReactNode;
}

export function OverlayProvider({ children }: OverlayProviderProps): JSX.Element {
  const { configLoaded } = useOverlay();
  const [app, setApp] = useState<Application | null>(null);
  const [isReady, setIsReady] = useState(false);

  useGlobalInput();

  const danmakuPool = useMemo(() => new DanmakuPool(), []);
  const trackAllocator = useMemo(() => new GreedyTrackAllocator(), []);

  useEffect(() => {
    if (!configLoaded) return;

    const pixiApp = new Application();

    pixiApp
      .init({
        backgroundAlpha: 0,
        resizeTo: window,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      })
      .then(() => {
        setApp(pixiApp);
        setIsReady(true);
      })
      .catch(console.error);

    return () => {
      pixiApp.destroy(true, { children: true });
      danmakuPool.destroy();
    };
  }, [configLoaded, danmakuPool]);

  const value = useMemo(
    () => ({ app, danmakuPool, trackAllocator, isReady }),
    [app, danmakuPool, trackAllocator, isReady]
  );

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}
```

- [ ] **Step 2: 创建 OverlayCanvas**

Create `apps/desktop/src/components/overlay/overlay-canvas.tsx`:

```typescript
import { useEffect, useRef } from "react";
import { useOverlayContext } from "./overlay-provider";
import { useOverlay } from "@/hooks/use-overlay";
import { DOMZIndex } from "@/types/overlay";

export function OverlayCanvas(): JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null);
  const { app, isReady } = useOverlayContext();
  const { visible, opacity } = useOverlay();

  useEffect(() => {
    if (!containerRef.current || !app || !isReady) return;

    const canvas = app.canvas as HTMLCanvasElement;
    canvas.style.pointerEvents = "none";
    containerRef.current.appendChild(canvas);

    return () => {
      if (canvas.parentElement === containerRef.current) {
        containerRef.current.removeChild(canvas);
      }
    };
  }, [app, isReady]);

  if (!visible || !isReady) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: DOMZIndex.OverlayCanvas,
        opacity,
      }}
    />
  );
}
```

- [ ] **Step 3: 创建导出入口**

Create `apps/desktop/src/components/overlay/index.ts`:

```typescript
export { OverlayProvider, useOverlayContext } from "./overlay-provider";
export { OverlayCanvas } from "./overlay-canvas";
```

- [ ] **Step 4: 验证编译**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/overlay/
git commit -m "feat(overlay): add OverlayProvider and OverlayCanvas components"
```

---

## Task 10: 弹幕层 (DanmakuLayer)

**Files:**
- Create: `apps/desktop/src/components/overlay/layers/danmaku-layer.tsx`
- Create: `apps/desktop/src/components/overlay/layers/index.ts`
- Modify: `apps/desktop/src/components/overlay/index.ts`

- [ ] **Step 1: 创建 DanmakuLayer**

Create `apps/desktop/src/components/overlay/layers/danmaku-layer.tsx`:

```typescript
import { useEffect, useRef, useCallback } from "react";
import { Container, Text, TextStyle } from "pixi.js";
import { useOverlayContext } from "../overlay-provider";
import { useDanmaku } from "@/hooks/use-danmaku";
import { PixiZIndex } from "@/types/overlay";
import type { DanmakuItem } from "@/types/overlay";
import { SPEED_VALUES, PERFORMANCE_LIMITS } from "@/lib/overlay/constants";

interface ActiveDanmaku {
  item: DanmakuItem;
  text: Text;
  x: number;
  track: number;
  speed: number;
}

export function DanmakuLayer(): null {
  const { app, trackAllocator, isReady } = useOverlayContext();
  const { enabled, items, config, paused, remove } = useDanmaku();

  const containerRef = useRef<Container | null>(null);
  const activeDanmakuRef = useRef<Map<string, ActiveDanmaku>>(new Map());
  const processedIdsRef = useRef<Set<string>>(new Set());
  const lastFrameTimeRef = useRef(0);

  const getTrackY = useCallback(
    (track: number): number => {
      const trackHeight = (config.maxTracks > 0 ? window.innerHeight * 0.4 : 200) / config.maxTracks;
      return 20 + track * trackHeight;
    },
    [config.maxTracks]
  );

  useEffect(() => {
    if (!app || !isReady) return;

    const container = new Container();
    container.zIndex = PixiZIndex.Danmaku;
    container.sortableChildren = true;
    app.stage.addChild(container);
    containerRef.current = container;

    return () => {
      container.destroy({ children: true });
      containerRef.current = null;
      activeDanmakuRef.current.clear();
      processedIdsRef.current.clear();
    };
  }, [app, isReady]);

  useEffect(() => {
    if (!containerRef.current || !enabled) return;

    const container = containerRef.current;

    for (const item of items) {
      if (processedIdsRef.current.has(item.id)) continue;
      if (activeDanmakuRef.current.size >= PERFORMANCE_LIMITS.maxDanmakuOnScreen) continue;

      processedIdsRef.current.add(item.id);

      const speedKey = item.speed ?? "normal";
      const pixelSpeed = SPEED_VALUES[speedKey];
      const duration = (window.innerWidth + 400) / pixelSpeed * 1000;

      const track = trackAllocator.allocate(item, duration);
      if (track < 0) {
        remove(item.id);
        continue;
      }

      const style = new TextStyle({
        fontFamily: config.fontFamily,
        fontSize: item.fontSize ?? 24,
        fill: item.color ?? "#ffffff",
        dropShadow: {
          color: "#000000",
          blur: 2,
          distance: 1,
        },
      });

      const text = new Text({ text: item.text, style });
      text.x = window.innerWidth + 10;
      text.y = getTrackY(track);
      text.alpha = config.opacity;

      container.addChild(text);

      activeDanmakuRef.current.set(item.id, {
        item,
        text,
        x: text.x,
        track,
        speed: pixelSpeed,
      });
    }
  }, [items, enabled, config, trackAllocator, remove, getTrackY]);

  useEffect(() => {
    if (!app || !isReady || !enabled) return;

    const tick = (ticker: { deltaMS: number }): void => {
      if (paused) return;

      const delta = ticker.deltaMS / 1000;
      const toRemove: string[] = [];

      for (const [id, active] of activeDanmakuRef.current) {
        active.x -= active.speed * delta;
        active.text.x = active.x;

        if (active.x < -active.text.width - 50) {
          toRemove.push(id);
        }
      }

      for (const id of toRemove) {
        const active = activeDanmakuRef.current.get(id);
        if (active) {
          trackAllocator.release(active.track, id);
          active.text.destroy();
          activeDanmakuRef.current.delete(id);
          processedIdsRef.current.delete(id);
          remove(id);
        }
      }
    };

    app.ticker.add(tick);
    return () => app.ticker.remove(tick);
  }, [app, isReady, enabled, paused, trackAllocator, remove]);

  return null;
}
```

- [ ] **Step 2: 创建 layers/index.ts**

Create `apps/desktop/src/components/overlay/layers/index.ts`:

```typescript
export { DanmakuLayer } from "./danmaku-layer";
```

- [ ] **Step 3: 更新 overlay/index.ts**

Edit `apps/desktop/src/components/overlay/index.ts`, 添加:

```typescript
export * from "./layers";
```

- [ ] **Step 4: 验证编译**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/overlay/layers/
git commit -m "feat(overlay): add DanmakuLayer with object pooling and track allocation"
```

---

## Task 11: 字幕层 (SubtitleLayer)

**Files:**
- Create: `apps/desktop/src/components/overlay/layers/subtitle-layer.tsx`
- Modify: `apps/desktop/src/components/overlay/layers/index.ts`

- [ ] **Step 1: 创建 SubtitleLayer**

Create `apps/desktop/src/components/overlay/layers/subtitle-layer.tsx`:

```typescript
import { useEffect, useState } from "react";
import { useSubtitle } from "@/hooks/use-subtitle";
import { DOMZIndex } from "@/types/overlay";

const positionStyles: Record<"top" | "center" | "bottom", React.CSSProperties> = {
  top: { top: 60, left: "50%", transform: "translateX(-50%)" },
  center: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
  bottom: { bottom: 60, left: "50%", transform: "translateX(-50%)" },
};

export function SubtitleLayer(): JSX.Element | null {
  const { enabled, current, config, streaming } = useSubtitle();
  const [displayText, setDisplayText] = useState("");
  const [showCursor, setShowCursor] = useState(false);

  useEffect(() => {
    if (!streaming) {
      setDisplayText("");
      setShowCursor(false);
      return;
    }

    setDisplayText(streaming.text);
    setShowCursor(streaming.cursor ?? false);
  }, [streaming]);

  useEffect(() => {
    if (!showCursor) return;

    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);

    return () => clearInterval(interval);
  }, [showCursor]);

  if (!enabled) return null;

  const subtitle = streaming ?? (current ? { text: current.text, options: current } : null);
  if (!subtitle) return null;

  const position = streaming?.options?.position ?? current?.position ?? config.defaultPosition;
  const style = streaming?.options?.style ?? current?.style ?? "plain";
  const speaker = streaming?.options?.speaker ?? current?.speaker;

  const text = streaming ? displayText : subtitle.text;

  return (
    <div
      style={{
        position: "fixed",
        ...positionStyles[position],
        zIndex: DOMZIndex.InteractiveLayer,
        pointerEvents: "none",
        maxWidth: "80%",
      }}
    >
      <div
        style={{
          backgroundColor: config.backgroundColor,
          borderRadius: style === "dialogue" ? 12 : 8,
          padding: config.padding,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        {speaker && style === "dialogue" && (
          <div
            style={{
              color: "#a0aec0",
              fontSize: config.fontSize * 0.8,
              marginBottom: 4,
              fontWeight: 500,
            }}
          >
            {speaker}
          </div>
        )}
        <div
          style={{
            color: "#ffffff",
            fontSize: config.fontSize,
            fontStyle: style === "narrator" ? "italic" : "normal",
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          {text}
          {streaming?.isStreaming && (
            <span
              style={{
                display: "inline-block",
                width: 2,
                height: "1em",
                backgroundColor: showCursor ? "#ffffff" : "transparent",
                marginLeft: 2,
                verticalAlign: "text-bottom",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 更新 layers/index.ts**

Edit `apps/desktop/src/components/overlay/layers/index.ts`, 添加:

```typescript
export { SubtitleLayer } from "./subtitle-layer";
```

- [ ] **Step 3: 验证编译**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/overlay/layers/subtitle-layer.tsx apps/desktop/src/components/overlay/layers/index.ts
git commit -m "feat(overlay): add SubtitleLayer with streaming cursor support"
```

---

## Task 12: 点击指示器层 (ClickIndicatorLayer)

**Files:**
- Create: `apps/desktop/src/components/overlay/elements/click-ripple.tsx`
- Create: `apps/desktop/src/components/overlay/elements/index.ts`
- Create: `apps/desktop/src/components/overlay/layers/click-indicator-layer.tsx`
- Modify: `apps/desktop/src/components/overlay/layers/index.ts`
- Modify: `apps/desktop/src/components/overlay/index.ts`

- [ ] **Step 1: 创建 ClickRipple 元素**

Create `apps/desktop/src/components/overlay/elements/click-ripple.tsx`:

```typescript
import { useEffect, useRef } from "react";
import type { ClickEffect, ClickStyle } from "@/types/overlay";

interface ClickRippleProps {
  effect: ClickEffect;
  style: ClickStyle;
  color: string;
  size: number;
}

export function ClickRipple({ effect, style, color, size }: ClickRippleProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.animate(
      [
        { transform: "scale(0)", opacity: 0.8 },
        { transform: "scale(1)", opacity: 0 },
      ],
      { duration: 400, easing: "ease-out", fill: "forwards" }
    );
  }, []);

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: effect.x - size / 2,
    top: effect.y - size / 2,
    width: size,
    height: size,
    borderRadius: "50%",
    pointerEvents: "none",
  };

  if (style === "ripple") {
    return (
      <div
        ref={ref}
        style={{
          ...baseStyle,
          border: `2px solid ${color}`,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
    );
  }

  if (style === "spotlight") {
    return (
      <div
        ref={ref}
        style={{
          ...baseStyle,
          background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
        }}
      />
    );
  }

  return (
    <div
      ref={ref}
      style={{
        ...baseStyle,
        border: `3px solid ${color}`,
      }}
    />
  );
}
```

- [ ] **Step 2: 创建 elements/index.ts**

Create `apps/desktop/src/components/overlay/elements/index.ts`:

```typescript
export { ClickRipple } from "./click-ripple";
```

- [ ] **Step 3: 创建 ClickIndicatorLayer**

Create `apps/desktop/src/components/overlay/layers/click-indicator-layer.tsx`:

```typescript
import { useClickIndicator } from "@/hooks/use-click-indicator";
import { useOverlayStore } from "@/stores/overlay-store";
import { ClickRipple } from "../elements/click-ripple";
import { DOMZIndex } from "@/types/overlay";

export function ClickIndicatorLayer(): JSX.Element | null {
  const { enabled, style, effects } = useClickIndicator();
  const store = useOverlayStore();

  if (!enabled || effects.length === 0) return null;

  const color = store.clickStyle === "ripple" ? "#ffffff" : "#3182ce";
  const size = 40;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: DOMZIndex.InteractiveLayer,
      }}
    >
      {effects.map((effect) => (
        <ClickRipple key={effect.id} effect={effect} style={style} color={color} size={size} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 更新 layers/index.ts**

Edit `apps/desktop/src/components/overlay/layers/index.ts`, 添加:

```typescript
export { ClickIndicatorLayer } from "./click-indicator-layer";
```

- [ ] **Step 5: 更新 overlay/index.ts 添加 elements 导出**

Edit `apps/desktop/src/components/overlay/index.ts`, 添加:

```typescript
export * from "./elements";
```

- [ ] **Step 6: 验证编译**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/components/overlay/elements/ apps/desktop/src/components/overlay/layers/click-indicator-layer.tsx apps/desktop/src/components/overlay/layers/index.ts apps/desktop/src/components/overlay/index.ts
git commit -m "feat(overlay): add ClickIndicatorLayer with ripple, spotlight, and ring styles"
```

---

## Task 13: 按键可视化层 (KeystrokeLayer)

**Files:**
- Create: `apps/desktop/src/components/overlay/elements/key-badge.tsx`
- Create: `apps/desktop/src/components/overlay/layers/keystroke-layer.tsx`
- Modify: `apps/desktop/src/components/overlay/elements/index.ts`
- Modify: `apps/desktop/src/components/overlay/layers/index.ts`

- [ ] **Step 1: 创建 KeyBadge 元素**

Create `apps/desktop/src/components/overlay/elements/key-badge.tsx`:

```typescript
import { useEffect, useRef } from "react";
import type { KeystrokeItem } from "@/types/overlay";

interface KeyBadgeProps {
  item: KeystrokeItem;
}

export function KeyBadge({ item }: KeyBadgeProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }], {
      duration: 150,
      easing: "ease-out",
      fill: "forwards",
    });
  }, []);

  return (
    <div
      ref={ref}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "6px 12px",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        borderRadius: 8,
        border: "1px solid rgba(255, 255, 255, 0.2)",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 14,
        fontWeight: 500,
        color: "#ffffff",
        whiteSpace: "nowrap",
      }}
    >
      {item.displayText}
    </div>
  );
}
```

- [ ] **Step 2: 更新 elements/index.ts**

Edit `apps/desktop/src/components/overlay/elements/index.ts`, 添加:

```typescript
export { KeyBadge } from "./key-badge";
```

- [ ] **Step 3: 创建 KeystrokeLayer**

Create `apps/desktop/src/components/overlay/layers/keystroke-layer.tsx`:

```typescript
import { useKeystroke } from "@/hooks/use-keystroke";
import { KeyBadge } from "../elements/key-badge";
import { DOMZIndex } from "@/types/overlay";
import type { KeystrokePosition } from "@/types/overlay";

const positionStyles: Record<KeystrokePosition, React.CSSProperties> = {
  "top-left": { top: 20, left: 20 },
  "top-right": { top: 20, right: 20 },
  "bottom-left": { bottom: 20, left: 20 },
  "bottom-right": { bottom: 20, right: 20 },
};

export function KeystrokeLayer(): JSX.Element | null {
  const { enabled, position, items } = useKeystroke();

  if (!enabled || items.length === 0) return null;

  const isRight = position.includes("right");

  return (
    <div
      style={{
        position: "fixed",
        ...positionStyles[position],
        display: "flex",
        flexDirection: "column",
        alignItems: isRight ? "flex-end" : "flex-start",
        gap: 8,
        pointerEvents: "none",
        zIndex: DOMZIndex.InteractiveLayer,
      }}
    >
      {items.map((item) => (
        <KeyBadge key={item.id} item={item} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 更新 layers/index.ts**

Edit `apps/desktop/src/components/overlay/layers/index.ts`, 添加:

```typescript
export { KeystrokeLayer } from "./keystroke-layer";
```

- [ ] **Step 5: 验证编译**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/components/overlay/elements/key-badge.tsx apps/desktop/src/components/overlay/elements/index.ts apps/desktop/src/components/overlay/layers/keystroke-layer.tsx apps/desktop/src/components/overlay/layers/index.ts
git commit -m "feat(overlay): add KeystrokeLayer with KeyBadge element"
```

---

## Task 14: 状态波浪层 (WaveLayer)

**Files:**
- Create: `apps/desktop/src/components/overlay/layers/wave-layer.tsx`
- Modify: `apps/desktop/src/components/overlay/layers/index.ts`

- [ ] **Step 1: 创建 WaveLayer**

Create `apps/desktop/src/components/overlay/layers/wave-layer.tsx`:

```typescript
import { useEffect, useRef } from "react";
import { Container, Graphics } from "pixi.js";
import { useOverlayContext } from "../overlay-provider";
import { useWave } from "@/hooks/use-wave";
import { PixiZIndex } from "@/types/overlay";
import { WAVE_THEMES, WAVE_PARAMS } from "@/lib/overlay/constants";

export function WaveLayer(): null {
  const { app, isReady } = useOverlayContext();
  const { enabled, state, config } = useWave();

  const containerRef = useRef<Container | null>(null);
  const graphicsRef = useRef<Graphics | null>(null);
  const timeRef = useRef(0);

  useEffect(() => {
    if (!app || !isReady) return;

    const container = new Container();
    container.zIndex = PixiZIndex.StatusWave;
    app.stage.addChild(container);
    containerRef.current = container;

    const graphics = new Graphics();
    container.addChild(graphics);
    graphicsRef.current = graphics;

    return () => {
      container.destroy({ children: true });
      containerRef.current = null;
      graphicsRef.current = null;
    };
  }, [app, isReady]);

  useEffect(() => {
    if (!app || !isReady || !enabled || state === "idle") return;

    const graphics = graphicsRef.current;
    if (!graphics) return;

    const theme = config.customThemes?.[state] ?? WAVE_THEMES[state];
    const params = WAVE_PARAMS[state];
    const width = window.innerWidth;
    const height = config.height;

    const tick = (ticker: { deltaMS: number }): void => {
      timeRef.current += ticker.deltaMS * 0.001 * params.speed * config.speed;
      const t = timeRef.current;

      graphics.clear();

      for (let layer = 0; layer < params.layers; layer++) {
        const layerOffset = layer * 0.3;
        const layerAlpha = config.opacity * (1 - layer * 0.2);
        const color = layer % 2 === 0 ? theme.primary : theme.secondary;

        graphics.moveTo(0, 0);

        for (let x = 0; x <= width; x += 4) {
          const normalizedX = x / width;
          const wave1 = Math.sin((normalizedX * params.frequency * Math.PI * 2) + t + layerOffset);
          const wave2 = Math.sin((normalizedX * params.frequency * 1.5 * Math.PI * 2) + t * 1.3 + layerOffset);
          const combined = (wave1 + wave2 * 0.5) / 1.5;
          const y = height * 0.5 + combined * params.amplitude;

          graphics.lineTo(x, y);
        }

        graphics.lineTo(width, height);
        graphics.lineTo(0, height);
        graphics.closePath();
        graphics.fill({ color, alpha: layerAlpha });
      }
    };

    app.ticker.add(tick);
    return () => app.ticker.remove(tick);
  }, [app, isReady, enabled, state, config]);

  useEffect(() => {
    if (!graphicsRef.current) return;

    if (!enabled || state === "idle") {
      graphicsRef.current.clear();
    }
  }, [enabled, state]);

  return null;
}
```

- [ ] **Step 2: 更新 layers/index.ts**

Edit `apps/desktop/src/components/overlay/layers/index.ts`, 添加:

```typescript
export { WaveLayer } from "./wave-layer";
```

- [ ] **Step 3: 验证编译**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/overlay/layers/wave-layer.tsx apps/desktop/src/components/overlay/layers/index.ts
git commit -m "feat(overlay): add WaveLayer with multi-layer wave animation"
```

---

## Task 15: App.tsx 集成

**Files:**
- Create: `apps/desktop/src/components/overlay/overlay-root.tsx`
- Modify: `apps/desktop/src/components/overlay/index.ts`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: 创建 OverlayRoot 组件**

Create `apps/desktop/src/components/overlay/overlay-root.tsx`:

```typescript
import { OverlayProvider } from "./overlay-provider";
import { OverlayCanvas } from "./overlay-canvas";
import { DanmakuLayer } from "./layers/danmaku-layer";
import { SubtitleLayer } from "./layers/subtitle-layer";
import { ClickIndicatorLayer } from "./layers/click-indicator-layer";
import { KeystrokeLayer } from "./layers/keystroke-layer";
import { WaveLayer } from "./layers/wave-layer";

export function OverlayRoot(): JSX.Element {
  return (
    <OverlayProvider>
      <OverlayCanvas />
      <DanmakuLayer />
      <WaveLayer />
      <SubtitleLayer />
      <ClickIndicatorLayer />
      <KeystrokeLayer />
    </OverlayProvider>
  );
}
```

- [ ] **Step 2: 更新 overlay/index.ts**

Edit `apps/desktop/src/components/overlay/index.ts`, 添加:

```typescript
export { OverlayRoot } from "./overlay-root";
```

- [ ] **Step 3: 读取当前 App.tsx**

Run: `head -100 apps/desktop/src/App.tsx`
Expected: 查看当前 App.tsx 结构

- [ ] **Step 4: 在 App.tsx 中集成 OverlayRoot**

Edit `apps/desktop/src/App.tsx`:

在文件顶部导入部分添加:
```typescript
import { OverlayRoot } from "@/components/overlay";
```

在 return 语句的 JSX 中，在最外层组件内部、其他内容之后添加:
```typescript
<OverlayRoot />
```

示例结构:
```typescript
return (
  <ThemeProvider>
    <RouterProvider router={router} />
    <OverlayRoot />
  </ThemeProvider>
);
```

- [ ] **Step 5: 验证编译**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 6: 启动开发服务器验证**

Run: `cd apps/desktop && pnpm dev`
Expected: 应用正常启动，无控制台错误

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/components/overlay/overlay-root.tsx apps/desktop/src/components/overlay/index.ts apps/desktop/src/App.tsx
git commit -m "feat(overlay): integrate OverlayRoot into App.tsx"
```

---

## Task 16: 设置页面 - Overlay Tab

**Files:**
- Create: `apps/desktop/src/components/settings/settings-overlay.tsx`
- Modify: `apps/desktop/src/pages/settings.tsx`

- [ ] **Step 1: 创建 SettingsOverlay 组件**

Create `apps/desktop/src/components/settings/settings-overlay.tsx`:

```typescript
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useOverlay } from "@/hooks/use-overlay";
import { useOverlayStore } from "@/stores/overlay-store";
import { loadOverlayConfig, saveOverlayConfig, DEFAULT_OVERLAY_SETTINGS } from "@/lib/overlay-config";
import type { OverlaySettings } from "@/types/overlay";

export function SettingsOverlay(): JSX.Element {
  const { t } = useTranslation();
  const { isLoading, error } = useOverlay();
  const store = useOverlayStore();
  const [settings, setSettings] = useState<OverlaySettings>(DEFAULT_OVERLAY_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadOverlayConfig().then(setSettings);
  }, []);

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    try {
      await saveOverlayConfig(settings);
      store.actions.loadConfig(settings);
    } catch (err) {
      console.error("Failed to save overlay settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSettings = <K extends keyof OverlaySettings>(
    key: K,
    value: OverlaySettings[K]
  ): void => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateNestedSettings = <
    K extends keyof OverlaySettings,
    NK extends keyof OverlaySettings[K]
  >(
    key: K,
    nestedKey: NK,
    value: OverlaySettings[K][NK]
  ): void => {
    setSettings((prev) => ({
      ...prev,
      [key]: { ...prev[key], [nestedKey]: value },
    }));
  };

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{t("settings.overlay.title", "Overlay 演示")}</h3>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? t("common.saving", "保存中...") : t("common.save", "保存")}
        </Button>
      </div>

      {/* 全局设置 */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">{t("settings.overlay.global", "全局")}</h4>
        <div className="flex items-center justify-between">
          <Label>{t("settings.overlay.defaultEnabled", "默认启用")}</Label>
          <Switch
            checked={settings.default_enabled}
            onCheckedChange={(v) => updateSettings("default_enabled", v)}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("settings.overlay.opacity", "透明度")}: {Math.round(settings.opacity * 100)}%</Label>
          <Slider
            value={[settings.opacity * 100]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => updateSettings("opacity", v / 100)}
          />
        </div>
      </div>

      {/* 弹幕设置 */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">{t("settings.overlay.danmaku", "弹幕")}</h4>
        <div className="flex items-center justify-between">
          <Label>{t("settings.overlay.enabled", "启用")}</Label>
          <Switch
            checked={settings.danmaku.enabled}
            onCheckedChange={(v) => updateNestedSettings("danmaku", "enabled", v)}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("settings.overlay.danmakuSpeed", "速度")}</Label>
          <Select
            value={settings.danmaku.speed}
            onValueChange={(v) => updateNestedSettings("danmaku", "speed", v as "slow" | "normal" | "fast")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="slow">{t("settings.overlay.slow", "慢")}</SelectItem>
              <SelectItem value="normal">{t("settings.overlay.normal", "正常")}</SelectItem>
              <SelectItem value="fast">{t("settings.overlay.fast", "快")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("settings.overlay.maxTracks", "轨道数")}: {settings.danmaku.max_tracks}</Label>
          <Slider
            value={[settings.danmaku.max_tracks]}
            min={4}
            max={16}
            step={1}
            onValueChange={([v]) => updateNestedSettings("danmaku", "max_tracks", v)}
          />
        </div>
      </div>

      {/* 字幕设置 */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">{t("settings.overlay.subtitle", "字幕")}</h4>
        <div className="flex items-center justify-between">
          <Label>{t("settings.overlay.enabled", "启用")}</Label>
          <Switch
            checked={settings.subtitle.enabled}
            onCheckedChange={(v) => updateNestedSettings("subtitle", "enabled", v)}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("settings.overlay.position", "位置")}</Label>
          <Select
            value={settings.subtitle.position}
            onValueChange={(v) => updateNestedSettings("subtitle", "position", v as "top" | "center" | "bottom")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top">{t("settings.overlay.top", "顶部")}</SelectItem>
              <SelectItem value="center">{t("settings.overlay.center", "中部")}</SelectItem>
              <SelectItem value="bottom">{t("settings.overlay.bottom", "底部")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 点击指示器设置 */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">{t("settings.overlay.clickIndicator", "点击指示器")}</h4>
        <div className="flex items-center justify-between">
          <Label>{t("settings.overlay.enabled", "启用")}</Label>
          <Switch
            checked={settings.click_indicator.enabled}
            onCheckedChange={(v) => updateNestedSettings("click_indicator", "enabled", v)}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("settings.overlay.style", "样式")}</Label>
          <Select
            value={settings.click_indicator.style}
            onValueChange={(v) => updateNestedSettings("click_indicator", "style", v as "ripple" | "spotlight" | "ring")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ripple">{t("settings.overlay.ripple", "涟漪")}</SelectItem>
              <SelectItem value="spotlight">{t("settings.overlay.spotlight", "聚光灯")}</SelectItem>
              <SelectItem value="ring">{t("settings.overlay.ring", "圆环")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 按键可视化设置 */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">{t("settings.overlay.keystroke", "按键可视化")}</h4>
        <div className="flex items-center justify-between">
          <Label>{t("settings.overlay.enabled", "启用")}</Label>
          <Switch
            checked={settings.keystroke.enabled}
            onCheckedChange={(v) => updateNestedSettings("keystroke", "enabled", v)}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("settings.overlay.position", "位置")}</Label>
          <Select
            value={settings.keystroke.position}
            onValueChange={(v) => updateNestedSettings("keystroke", "position", v as "top-left" | "top-right" | "bottom-left" | "bottom-right")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top-left">{t("settings.overlay.topLeft", "左上")}</SelectItem>
              <SelectItem value="top-right">{t("settings.overlay.topRight", "右上")}</SelectItem>
              <SelectItem value="bottom-left">{t("settings.overlay.bottomLeft", "左下")}</SelectItem>
              <SelectItem value="bottom-right">{t("settings.overlay.bottomRight", "右下")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <Label>{t("settings.overlay.modifiersOnly", "仅显示修饰键组合")}</Label>
          <Switch
            checked={settings.keystroke.show_modifiers_only}
            onCheckedChange={(v) => updateNestedSettings("keystroke", "show_modifiers_only", v)}
          />
        </div>
      </div>

      {/* 状态波浪设置 */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">{t("settings.overlay.wave", "状态波浪")}</h4>
        <div className="flex items-center justify-between">
          <Label>{t("settings.overlay.enabled", "启用")}</Label>
          <Switch
            checked={settings.wave.enabled}
            onCheckedChange={(v) => updateNestedSettings("wave", "enabled", v)}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("settings.overlay.waveHeight", "高度")}: {settings.wave.height}px</Label>
          <Slider
            value={[settings.wave.height]}
            min={30}
            max={120}
            step={10}
            onValueChange={([v]) => updateNestedSettings("wave", "height", v)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label>{t("settings.overlay.particles", "粒子效果")}</Label>
          <Switch
            checked={settings.wave.particles_enabled}
            onCheckedChange={(v) => updateNestedSettings("wave", "particles_enabled", v)}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 读取当前 settings.tsx**

Run: `head -150 apps/desktop/src/pages/settings.tsx`
Expected: 查看当前设置页面结构

- [ ] **Step 3: 在 settings.tsx 中添加 Overlay Tab**

Edit `apps/desktop/src/pages/settings.tsx`:

在导入部分添加:
```typescript
import { SettingsOverlay } from "@/components/settings/settings-overlay";
```

在 Tabs.List 中添加新 Tab:
```typescript
<TabsTrigger value="overlay">
  {t("settings.tabs.overlay", "Overlay 演示")}
</TabsTrigger>
```

在 TabsContent 区域添加:
```typescript
<TabsContent value="overlay">
  <SettingsOverlay />
</TabsContent>
```

- [ ] **Step 4: 验证编译**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/settings/settings-overlay.tsx apps/desktop/src/pages/settings.tsx
git commit -m "feat(overlay): add Overlay settings tab with full configuration UI"
```

---

## Task 17: i18n 国际化支持

**Files:**
- Modify: `apps/desktop/src/i18n/locales/en.json`
- Modify: `apps/desktop/src/i18n/locales/zh-CN.json`

- [ ] **Step 1: 添加英文翻译**

Edit `apps/desktop/src/i18n/locales/en.json`, 在 `settings` 对象内添加:

```json
"overlay": {
  "title": "Overlay Demo",
  "global": "Global",
  "defaultEnabled": "Default Enabled",
  "opacity": "Opacity",
  "enabled": "Enabled",
  "danmaku": "Danmaku",
  "danmakuSpeed": "Speed",
  "maxTracks": "Max Tracks",
  "slow": "Slow",
  "normal": "Normal",
  "fast": "Fast",
  "subtitle": "Subtitle",
  "position": "Position",
  "top": "Top",
  "center": "Center",
  "bottom": "Bottom",
  "clickIndicator": "Click Indicator",
  "style": "Style",
  "ripple": "Ripple",
  "spotlight": "Spotlight",
  "ring": "Ring",
  "keystroke": "Keystroke Visualization",
  "topLeft": "Top Left",
  "topRight": "Top Right",
  "bottomLeft": "Bottom Left",
  "bottomRight": "Bottom Right",
  "modifiersOnly": "Modifiers Only",
  "wave": "Status Wave",
  "waveHeight": "Height",
  "particles": "Particle Effects"
}
```

在 `settings.tabs` 对象内添加:
```json
"overlay": "Overlay Demo"
```

- [ ] **Step 2: 添加中文翻译**

Edit `apps/desktop/src/i18n/locales/zh-CN.json`, 在 `settings` 对象内添加:

```json
"overlay": {
  "title": "Overlay 演示",
  "global": "全局",
  "defaultEnabled": "默认启用",
  "opacity": "透明度",
  "enabled": "启用",
  "danmaku": "弹幕",
  "danmakuSpeed": "速度",
  "maxTracks": "轨道数",
  "slow": "慢",
  "normal": "正常",
  "fast": "快",
  "subtitle": "字幕",
  "position": "位置",
  "top": "顶部",
  "center": "中部",
  "bottom": "底部",
  "clickIndicator": "点击指示器",
  "style": "样式",
  "ripple": "涟漪",
  "spotlight": "聚光灯",
  "ring": "圆环",
  "keystroke": "按键可视化",
  "topLeft": "左上",
  "topRight": "右上",
  "bottomLeft": "左下",
  "bottomRight": "右下",
  "modifiersOnly": "仅显示修饰键组合",
  "wave": "状态波浪",
  "waveHeight": "高度",
  "particles": "粒子效果"
}
```

在 `settings.tabs` 对象内添加:
```json
"overlay": "Overlay 演示"
```

- [ ] **Step 3: 验证编译**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/i18n/locales/en.json apps/desktop/src/i18n/locales/zh-CN.json
git commit -m "feat(overlay): add i18n translations for overlay settings"
```

---

## Task 18: 全局快捷键注册

**Files:**
- Create: `apps/desktop/src/hooks/use-overlay-shortcuts.ts`
- Modify: `apps/desktop/src/hooks/index.ts`
- Modify: `apps/desktop/src/components/overlay/overlay-provider.tsx`

- [ ] **Step 1: 创建 use-overlay-shortcuts hook**

Create `apps/desktop/src/hooks/use-overlay-shortcuts.ts`:

```typescript
import { useEffect } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { useOverlayStore } from "@/stores/overlay-store";
import { loadOverlayConfig } from "@/lib/overlay-config";
import type { OverlayShortcuts } from "@/types/overlay";

export function useOverlayShortcuts(): void {
  const actions = useOverlayStore((s) => s.actions);

  useEffect(() => {
    let shortcuts: OverlayShortcuts | null = null;
    let isUnmounted = false;

    const setupShortcuts = async (): Promise<void> => {
      try {
        const config = await loadOverlayConfig();
        shortcuts = config.shortcuts;

        if (isUnmounted) return;

        await register(shortcuts.toggleOverlay, () => {
          actions.toggle();
        });

        await register(shortcuts.toggleDanmaku, () => {
          const current = useOverlayStore.getState().danmakuEnabled;
          actions.setDanmakuEnabled(!current);
        });

        await register(shortcuts.toggleSubtitle, () => {
          const current = useOverlayStore.getState().subtitleEnabled;
          actions.setSubtitleEnabled(!current);
        });

        await register(shortcuts.toggleClickIndicator, () => {
          const current = useOverlayStore.getState().clickEnabled;
          actions.setClickEnabled(!current);
        });

        await register(shortcuts.toggleKeystroke, () => {
          const current = useOverlayStore.getState().keystrokeEnabled;
          actions.setKeystrokeEnabled(!current);
        });
      } catch (error) {
        console.warn("[Overlay] Failed to register shortcuts:", error);
      }
    };

    setupShortcuts();

    return () => {
      isUnmounted = true;
      if (shortcuts) {
        Promise.all([
          unregister(shortcuts.toggleOverlay),
          unregister(shortcuts.toggleDanmaku),
          unregister(shortcuts.toggleSubtitle),
          unregister(shortcuts.toggleClickIndicator),
          unregister(shortcuts.toggleKeystroke),
        ]).catch(console.warn);
      }
    };
  }, [actions]);
}
```

- [ ] **Step 2: 更新 hooks/index.ts**

Edit `apps/desktop/src/hooks/index.ts`, 添加:

```typescript
export { useOverlayShortcuts } from "./use-overlay-shortcuts";
```

- [ ] **Step 3: 在 OverlayProvider 中使用快捷键 hook**

Edit `apps/desktop/src/components/overlay/overlay-provider.tsx`:

在导入部分添加:
```typescript
import { useOverlayShortcuts } from "@/hooks/use-overlay-shortcuts";
```

在 `OverlayProvider` 函数组件内部，在 `useGlobalInput()` 调用之后添加:
```typescript
useOverlayShortcuts();
```

- [ ] **Step 4: 验证编译**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/hooks/use-overlay-shortcuts.ts apps/desktop/src/hooks/index.ts apps/desktop/src/components/overlay/overlay-provider.tsx
git commit -m "feat(overlay): add global shortcut registration for overlay controls"
```

---

## Task 19: 端到端验证

**Files:** 无新文件

- [ ] **Step 1: 启动开发服务器**

Run: `cd apps/desktop && pnpm dev`
Expected: 应用正常启动

- [ ] **Step 2: 验证 Overlay 可见性切换**

操作: 按 `⌘⇧O` (Mac) 或 `Ctrl+Shift+O` (Windows)
Expected: Overlay 层显示/隐藏

- [ ] **Step 3: 验证弹幕功能**

在浏览器控制台执行:
```javascript
window.__OVERLAY_TEST__ = true;
// 发送测试弹幕
const { useOverlayStore } = await import('@/stores/overlay-store');
useOverlayStore.getState().actions.sendDanmaku('测试弹幕');
```
Expected: 弹幕从右向左滚动

- [ ] **Step 4: 验证字幕功能**

在浏览器控制台执行:
```javascript
const { useOverlayStore } = await import('@/stores/overlay-store');
useOverlayStore.getState().actions.showSubtitle('这是测试字幕', { position: 'bottom' });
```
Expected: 字幕显示在底部

- [ ] **Step 5: 验证设置页面**

操作: 打开设置页面，切换到 "Overlay 演示" Tab
Expected: 所有设置项正常显示，可以修改和保存

- [ ] **Step 6: 验证配置持久化**

操作: 修改设置并保存，重启应用
Expected: 设置被保留

- [ ] **Step 7: 最终 Commit**

```bash
git add -A
git commit -m "feat(overlay): complete overlay demo system implementation"
```

---
