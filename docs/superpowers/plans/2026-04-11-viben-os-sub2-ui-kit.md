# Sub 2: UI Kit 实现计划

> **Goal:** 基于 Yoga WASM 布局 + troika 文字 + TSL 图形原语，构建完整的 GPU UI 组件库

**依赖:** Sub 1 Render Engine（已完成）

**技术栈:** yoga-wasm-web (Flexbox 布局), troika-three-text (SDF 文字), Three.js TSL (GPU 图形原语)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

---

## 架构概览

UI Kit 分 6 个模块，按依赖顺序实现：

```
Theme (Token 定义) ← 无依赖
Animation (Spring/Tween) ← 无依赖
Layout (Yoga WASM) ← 无依赖
Text (troika) ← Theme
Primitives (Box/Image/Icon) ← Theme, Layout
Components (Button/Input/...) ← 以上全部
```

**关键设计决策：**

1. **WebGL 兼容**：TSL 仅在 WebGPU 下可用。Primitives 使用标准 `ShaderMaterial` + GLSL，确保 WebGPU/WebGL 双兼容
2. **Yoga 节点绑定**：每个 UI 元素有对应的 Yoga Node，layout 结果同步到 Three.js Object3D.position
3. **脏标记传播**：组件属性变更 → markDirty() → 下一帧重新 layout + render

---

## 文件结构

```
packages/os/src/ui/
  theme/
    tokens.ts              颜色/字体/间距 Token 定义
    theme-manager.ts       暗/亮主题切换 + 当前主题状态
    index.ts
  animation/
    spring.ts              Spring 物理动画 (iOS 风格)
    tween.ts               线性/缓动补间
    index.ts
  layout/
    yoga-context.ts        Yoga WASM 初始化 + 单例
    yoga-node.ts           Yoga Node ↔ Object3D 绑定
    index.ts
  text/
    text-renderer.ts       troika-three-text 封装
    index.ts
  primitives/
    box.ts                 圆角矩形 (GLSL SDF shader)
    image.ts               图片显示 Mesh
    icon.ts                图标 (Atlas sprite)
    index.ts
  components/
    button.ts              按钮
    text-input.ts          文字输入框
    toggle.ts              开关
    slider.ts              滑块
    scroll-view.ts         滚动容器 (Stencil 裁剪)
    list.ts                虚拟列表
    modal.ts               模态弹窗
    navigation-bar.ts      导航栏
    tab-bar.ts             底部标签栏
    index.ts
  index.ts                 UI Kit barrel export

packages/os/__tests__/ui/
  theme.test.ts
  animation.test.ts
  layout.test.ts
  text-renderer.test.ts
  primitives.test.ts
  components/
    button.test.ts
    scroll-view.test.ts
    ...
```

---

## Tasks

### Task 1: 依赖安装 + Theme System

**Files:**
- Modify: `packages/os/package.json` — 添加 yoga-wasm-web, troika-three-text
- Create: `packages/os/src/ui/theme/tokens.ts`
- Create: `packages/os/src/ui/theme/theme-manager.ts`
- Create: `packages/os/src/ui/theme/index.ts`
- Create: `packages/os/__tests__/ui/theme.test.ts`

- [ ] **Step 1: 安装依赖**

```bash
cd /root/viben/packages/os
pnpm add yoga-wasm-web troika-three-text
```

- [ ] **Step 2: 写 theme 失败测试**

Create `packages/os/__tests__/ui/theme.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ThemeManager, lightTheme, darkTheme } from "../../src/ui/theme";

describe("ThemeManager", () => {
  it("defaults to dark theme", () => {
    const tm = new ThemeManager();
    expect(tm.current.name).toBe("dark");
  });

  it("switches to light theme", () => {
    const tm = new ThemeManager();
    tm.setTheme("light");
    expect(tm.current.name).toBe("light");
    expect(tm.current.colors.background).toBe(lightTheme.colors.background);
  });

  it("notifies listeners on theme change", () => {
    const tm = new ThemeManager();
    const calls: string[] = [];
    tm.onChange((theme) => calls.push(theme.name));
    tm.setTheme("light");
    tm.setTheme("dark");
    expect(calls).toEqual(["light", "dark"]);
  });

  it("provides color, font, spacing tokens", () => {
    const tm = new ThemeManager();
    const t = tm.current;
    expect(t.colors.primary).toBeDefined();
    expect(t.colors.surface).toBeDefined();
    expect(t.fonts.body).toBeDefined();
    expect(t.spacing.sm).toBeGreaterThan(0);
    expect(t.radii.md).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/ui/theme.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: 实现 tokens.ts**

Create `packages/os/src/ui/theme/tokens.ts`:

```typescript
export interface ThemeColors {
  primary: string;
  primaryText: string;
  background: string;
  surface: string;
  surfaceHover: string;
  text: string;
  textSecondary: string;
  border: string;
  shadow: string;
  error: string;
  success: string;
  warning: string;
}

export interface ThemeFonts {
  body: string;       // font URL
  mono: string;       // monospace font URL
  bodySize: number;   // default body font size in px
  titleSize: number;
  captionSize: number;
}

export interface ThemeSpacing {
  xs: number;  // 4
  sm: number;  // 8
  md: number;  // 16
  lg: number;  // 24
  xl: number;  // 32
}

export interface ThemeRadii {
  sm: number;  // 4
  md: number;  // 8
  lg: number;  // 16
  xl: number;  // 24
  full: number; // 9999
}

export interface Theme {
  name: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  spacing: ThemeSpacing;
  radii: ThemeRadii;
}

export const darkTheme: Theme = {
  name: "dark",
  colors: {
    primary: "#007AFF",
    primaryText: "#FFFFFF",
    background: "#000000",
    surface: "#1C1C1E",
    surfaceHover: "#2C2C2E",
    text: "#FFFFFF",
    textSecondary: "#8E8E93",
    border: "#38383A",
    shadow: "rgba(0,0,0,0.5)",
    error: "#FF3B30",
    success: "#30D158",
    warning: "#FF9F0A",
  },
  fonts: {
    body: "",  // default system font, set by ResourceLoader
    mono: "",
    bodySize: 17,
    titleSize: 28,
    captionSize: 12,
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radii: { sm: 4, md: 8, lg: 16, xl: 24, full: 9999 },
};

export const lightTheme: Theme = {
  name: "light",
  colors: {
    primary: "#007AFF",
    primaryText: "#FFFFFF",
    background: "#F2F2F7",
    surface: "#FFFFFF",
    surfaceHover: "#E5E5EA",
    text: "#000000",
    textSecondary: "#8E8E93",
    border: "#C6C6C8",
    shadow: "rgba(0,0,0,0.15)",
    error: "#FF3B30",
    success: "#34C759",
    warning: "#FF9F0A",
  },
  fonts: {
    body: "",
    mono: "",
    bodySize: 17,
    titleSize: 28,
    captionSize: 12,
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radii: { sm: 4, md: 8, lg: 16, xl: 24, full: 9999 },
};
```

- [ ] **Step 5: 实现 theme-manager.ts**

Create `packages/os/src/ui/theme/theme-manager.ts`:

```typescript
import type { Theme } from "./tokens";
import { darkTheme, lightTheme } from "./tokens";

type ThemeListener = (theme: Theme) => void;

export class ThemeManager {
  private _current: Theme;
  private _listeners: ThemeListener[] = [];
  private _themes: Map<string, Theme>;

  constructor(initial: "light" | "dark" = "dark") {
    this._themes = new Map([
      ["dark", darkTheme],
      ["light", lightTheme],
    ]);
    this._current = this._themes.get(initial)!;
  }

  get current(): Theme { return this._current; }

  setTheme(name: string): void {
    const theme = this._themes.get(name);
    if (!theme || theme === this._current) return;
    this._current = theme;
    for (const fn of this._listeners) fn(theme);
  }

  registerTheme(theme: Theme): void {
    this._themes.set(theme.name, theme);
  }

  onChange(listener: ThemeListener): () => void {
    this._listeners.push(listener);
    return () => {
      const idx = this._listeners.indexOf(listener);
      if (idx !== -1) this._listeners.splice(idx, 1);
    };
  }
}
```

- [ ] **Step 6: 创建 barrel export**

Create `packages/os/src/ui/theme/index.ts`:

```typescript
export { ThemeManager } from "./theme-manager";
export { darkTheme, lightTheme } from "./tokens";
export type { Theme, ThemeColors, ThemeFonts, ThemeSpacing, ThemeRadii } from "./tokens";
```

- [ ] **Step 7: 运行测试确认通过**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/ui/theme.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/os/
git commit -m "feat(os/ui): add theme system with dark/light tokens"
```

---

### Task 2: Animation System (Spring + Tween)

**Files:**
- Create: `packages/os/src/ui/animation/spring.ts`
- Create: `packages/os/src/ui/animation/tween.ts`
- Create: `packages/os/src/ui/animation/index.ts`
- Create: `packages/os/__tests__/ui/animation.test.ts`

- [ ] **Step 1: 写失败测试**

Create `packages/os/__tests__/ui/animation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { Spring, Tween } from "../../src/ui/animation";

describe("Spring", () => {
  it("starts at the from value", () => {
    const s = new Spring({ from: 0, to: 100 });
    expect(s.value).toBe(0);
    expect(s.done).toBe(false);
  });

  it("approaches the target after many updates", () => {
    const s = new Spring({ from: 0, to: 100, stiffness: 200, damping: 20 });
    for (let i = 0; i < 300; i++) s.update(1 / 60);
    expect(s.value).toBeCloseTo(100, 0);
    expect(s.done).toBe(true);
  });

  it("can retarget mid-animation", () => {
    const s = new Spring({ from: 0, to: 100 });
    for (let i = 0; i < 30; i++) s.update(1 / 60);
    s.setTarget(200);
    expect(s.done).toBe(false);
    for (let i = 0; i < 300; i++) s.update(1 / 60);
    expect(s.value).toBeCloseTo(200, 0);
  });
});

describe("Tween", () => {
  it("starts at from value", () => {
    const t = new Tween({ from: 0, to: 100, duration: 0.5 });
    expect(t.value).toBe(0);
    expect(t.done).toBe(false);
  });

  it("reaches to value after duration", () => {
    const t = new Tween({ from: 0, to: 100, duration: 0.5 });
    t.update(0.25);
    expect(t.value).toBeGreaterThan(0);
    expect(t.value).toBeLessThan(100);
    t.update(0.25);
    expect(t.value).toBe(100);
    expect(t.done).toBe(true);
  });

  it("supports custom easing", () => {
    // linear easing
    const t = new Tween({ from: 0, to: 100, duration: 1, easing: (t) => t });
    t.update(0.5);
    expect(t.value).toBeCloseTo(50, 1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/ui/animation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: 实现 spring.ts**

Create `packages/os/src/ui/animation/spring.ts`:

```typescript
export interface SpringConfig {
  from: number;
  to: number;
  stiffness?: number;   // default 170 (iOS-like)
  damping?: number;      // default 26
  mass?: number;         // default 1
  restThreshold?: number; // default 0.01
}

export class Spring {
  private _value: number;
  private _velocity = 0;
  private _target: number;
  private _stiffness: number;
  private _damping: number;
  private _mass: number;
  private _restThreshold: number;
  private _done = false;

  constructor(config: SpringConfig) {
    this._value = config.from;
    this._target = config.to;
    this._stiffness = config.stiffness ?? 170;
    this._damping = config.damping ?? 26;
    this._mass = config.mass ?? 1;
    this._restThreshold = config.restThreshold ?? 0.01;
  }

  get value(): number { return this._value; }
  get done(): boolean { return this._done; }
  get velocity(): number { return this._velocity; }

  setTarget(target: number): void {
    this._target = target;
    this._done = false;
  }

  update(dt: number): number {
    if (this._done) return this._value;

    const displacement = this._value - this._target;
    const springForce = -this._stiffness * displacement;
    const dampingForce = -this._damping * this._velocity;
    const acceleration = (springForce + dampingForce) / this._mass;

    this._velocity += acceleration * dt;
    this._value += this._velocity * dt;

    if (
      Math.abs(this._velocity) < this._restThreshold &&
      Math.abs(this._value - this._target) < this._restThreshold
    ) {
      this._value = this._target;
      this._velocity = 0;
      this._done = true;
    }

    return this._value;
  }

  reset(from: number, to: number): void {
    this._value = from;
    this._target = to;
    this._velocity = 0;
    this._done = false;
  }
}
```

- [ ] **Step 4: 实现 tween.ts**

Create `packages/os/src/ui/animation/tween.ts`:

```typescript
export type EasingFn = (t: number) => number;

export const Easing = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeOutCubic: (t: number) => --t * t * t + 1,
} as const;

export interface TweenConfig {
  from: number;
  to: number;
  duration: number;      // seconds
  easing?: EasingFn;     // default easeOutQuad
}

export class Tween {
  private _from: number;
  private _to: number;
  private _duration: number;
  private _easing: EasingFn;
  private _elapsed = 0;
  private _value: number;
  private _done = false;

  constructor(config: TweenConfig) {
    this._from = config.from;
    this._to = config.to;
    this._duration = config.duration;
    this._easing = config.easing ?? Easing.easeOutQuad;
    this._value = config.from;
  }

  get value(): number { return this._value; }
  get done(): boolean { return this._done; }

  update(dt: number): number {
    if (this._done) return this._value;

    this._elapsed += dt;
    const progress = Math.min(this._elapsed / this._duration, 1);
    this._value = this._from + (this._to - this._from) * this._easing(progress);

    if (progress >= 1) {
      this._value = this._to;
      this._done = true;
    }

    return this._value;
  }

  reset(from: number, to: number): void {
    this._from = from;
    this._to = to;
    this._elapsed = 0;
    this._value = from;
    this._done = false;
  }
}
```

- [ ] **Step 5: 创建 barrel export**

Create `packages/os/src/ui/animation/index.ts`:

```typescript
export { Spring } from "./spring";
export type { SpringConfig } from "./spring";
export { Tween, Easing } from "./tween";
export type { TweenConfig, EasingFn } from "./tween";
```

- [ ] **Step 6: 运行测试确认通过**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/ui/animation.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/os/src/ui/animation/ packages/os/__tests__/ui/animation.test.ts
git commit -m "feat(os/ui): add Spring and Tween animation system"
```

---

### Task 3: Yoga Layout Engine

**Files:**
- Create: `packages/os/src/ui/layout/yoga-context.ts`
- Create: `packages/os/src/ui/layout/yoga-node.ts`
- Create: `packages/os/src/ui/layout/index.ts`
- Create: `packages/os/__tests__/ui/layout.test.ts`

- [ ] **Step 1: 写失败测试**

Create `packages/os/__tests__/ui/layout.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { YogaContext, YogaNode } from "../../src/ui/layout";
import { Object3D } from "three";

describe("YogaContext + YogaNode", () => {
  beforeAll(async () => {
    await YogaContext.init();
  });

  afterEach(() => {
    YogaContext.reset();
  });

  it("initializes yoga WASM", () => {
    expect(YogaContext.isReady).toBe(true);
  });

  it("creates a root node with fixed size", () => {
    const obj = new Object3D();
    const node = new YogaNode(obj);
    node.setWidth(400);
    node.setHeight(300);
    node.calculateLayout();
    expect(node.computedWidth).toBe(400);
    expect(node.computedHeight).toBe(300);
    node.dispose();
  });

  it("lays out children in column direction", () => {
    const root = new YogaNode(new Object3D());
    root.setWidth(400);
    root.setHeight(300);
    root.setFlexDirection("column");

    const child1 = new YogaNode(new Object3D());
    child1.setHeight(100);
    root.addChild(child1);

    const child2 = new YogaNode(new Object3D());
    child2.setHeight(100);
    root.addChild(child2);

    root.calculateLayout();

    expect(child1.computedTop).toBe(0);
    expect(child1.computedWidth).toBe(400);
    expect(child2.computedTop).toBe(100);

    root.dispose();
  });

  it("syncs computed layout to Object3D position", () => {
    const rootObj = new Object3D();
    const childObj = new Object3D();
    rootObj.add(childObj);

    const root = new YogaNode(rootObj);
    root.setWidth(400);
    root.setHeight(300);
    root.setPadding("all", 10);

    const child = new YogaNode(childObj);
    child.setWidth(100);
    child.setHeight(50);
    root.addChild(child);

    root.calculateLayout();
    root.syncToObject3D();

    // Child should be at (10, -10) in Y-down pixel space
    expect(childObj.position.x).toBe(10);
    expect(childObj.position.y).toBe(-10);

    root.dispose();
  });

  it("supports flexGrow", () => {
    const root = new YogaNode(new Object3D());
    root.setWidth(400);
    root.setHeight(300);
    root.setFlexDirection("column");

    const child = new YogaNode(new Object3D());
    child.setFlexGrow(1);
    root.addChild(child);

    root.calculateLayout();
    expect(child.computedHeight).toBe(300);

    root.dispose();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/ui/layout.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: 实现 yoga-context.ts**

Create `packages/os/src/ui/layout/yoga-context.ts`:

```typescript
import initYoga from "yoga-wasm-web";
import type { Yoga } from "yoga-wasm-web";

let _yoga: Yoga | null = null;

export const YogaContext = {
  async init(): Promise<void> {
    if (_yoga) return;
    _yoga = await initYoga();
  },

  get instance(): Yoga {
    if (!_yoga) throw new Error("YogaContext not initialized. Call YogaContext.init() first.");
    return _yoga;
  },

  get isReady(): boolean {
    return _yoga !== null;
  },

  reset(): void {
    _yoga = null;
  },
};
```

- [ ] **Step 4: 实现 yoga-node.ts**

Create `packages/os/src/ui/layout/yoga-node.ts`:

```typescript
import type { Node as YNode } from "yoga-wasm-web";
import { Direction, Edge, FlexDirection, Justify, Align, PositionType, Wrap } from "yoga-wasm-web";
import type { Object3D } from "three";
import { YogaContext } from "./yoga-context";

type FlexDir = "row" | "column" | "row-reverse" | "column-reverse";
type JustifyContent = "flex-start" | "center" | "flex-end" | "space-between" | "space-around" | "space-evenly";
type AlignItems = "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
type EdgeName = "left" | "top" | "right" | "bottom" | "all" | "horizontal" | "vertical";

const FLEX_DIR_MAP: Record<FlexDir, number> = {
  "row": FlexDirection.Row,
  "column": FlexDirection.Column,
  "row-reverse": FlexDirection.RowReverse,
  "column-reverse": FlexDirection.ColumnReverse,
};

const JUSTIFY_MAP: Record<JustifyContent, number> = {
  "flex-start": Justify.FlexStart,
  "center": Justify.Center,
  "flex-end": Justify.FlexEnd,
  "space-between": Justify.SpaceBetween,
  "space-around": Justify.SpaceAround,
  "space-evenly": Justify.SpaceEvenly,
};

const ALIGN_MAP: Record<AlignItems, number> = {
  "flex-start": Align.FlexStart,
  "center": Align.Center,
  "flex-end": Align.FlexEnd,
  "stretch": Align.Stretch,
  "baseline": Align.Baseline,
};

const EDGE_MAP: Record<EdgeName, number> = {
  "left": Edge.Left,
  "top": Edge.Top,
  "right": Edge.Right,
  "bottom": Edge.Bottom,
  "all": Edge.All,
  "horizontal": Edge.Horizontal,
  "vertical": Edge.Vertical,
};

export class YogaNode {
  readonly yogaNode: YNode;
  readonly object3D: Object3D;
  private _children: YogaNode[] = [];

  constructor(object3D: Object3D) {
    this.yogaNode = YogaContext.instance.Node.create();
    this.object3D = object3D;
  }

  // --- Size ---
  setWidth(v: number): void { this.yogaNode.setWidth(v); }
  setHeight(v: number): void { this.yogaNode.setHeight(v); }
  setMinWidth(v: number): void { this.yogaNode.setMinWidth(v); }
  setMinHeight(v: number): void { this.yogaNode.setMinHeight(v); }
  setMaxWidth(v: number): void { this.yogaNode.setMaxWidth(v); }
  setMaxHeight(v: number): void { this.yogaNode.setMaxHeight(v); }

  // --- Flex ---
  setFlexDirection(dir: FlexDir): void { this.yogaNode.setFlexDirection(FLEX_DIR_MAP[dir]); }
  setJustifyContent(j: JustifyContent): void { this.yogaNode.setJustifyContent(JUSTIFY_MAP[j]); }
  setAlignItems(a: AlignItems): void { this.yogaNode.setAlignItems(ALIGN_MAP[a]); }
  setFlexGrow(v: number): void { this.yogaNode.setFlexGrow(v); }
  setFlexShrink(v: number): void { this.yogaNode.setFlexShrink(v); }
  setFlexBasis(v: number | "auto"): void {
    if (v === "auto") this.yogaNode.setFlexBasisAuto();
    else this.yogaNode.setFlexBasis(v);
  }
  setFlexWrap(w: "no-wrap" | "wrap" | "wrap-reverse"): void {
    const map = { "no-wrap": Wrap.NoWrap, "wrap": Wrap.Wrap, "wrap-reverse": Wrap.WrapReverse };
    this.yogaNode.setFlexWrap(map[w]);
  }

  // --- Spacing ---
  setPadding(edge: EdgeName, v: number): void { this.yogaNode.setPadding(EDGE_MAP[edge], v); }
  setMargin(edge: EdgeName, v: number): void { this.yogaNode.setMargin(EDGE_MAP[edge], v); }
  setGap(v: number): void { this.yogaNode.setGap(Edge.All, v); }

  // --- Position ---
  setPositionType(t: "relative" | "absolute"): void {
    this.yogaNode.setPositionType(t === "absolute" ? PositionType.Absolute : PositionType.Relative);
  }
  setPosition(edge: EdgeName, v: number): void { this.yogaNode.setPosition(EDGE_MAP[edge], v); }

  // --- Children ---
  addChild(child: YogaNode): void {
    this.yogaNode.insertChild(child.yogaNode, this._children.length);
    this._children.push(child);
  }

  removeChild(child: YogaNode): void {
    this.yogaNode.removeChild(child.yogaNode);
    const idx = this._children.indexOf(child);
    if (idx !== -1) this._children.splice(idx, 1);
  }

  // --- Computed values ---
  get computedLeft(): number { return this.yogaNode.getComputedLeft(); }
  get computedTop(): number { return this.yogaNode.getComputedTop(); }
  get computedWidth(): number { return this.yogaNode.getComputedWidth(); }
  get computedHeight(): number { return this.yogaNode.getComputedHeight(); }

  // --- Layout ---
  calculateLayout(width?: number, height?: number): void {
    this.yogaNode.calculateLayout(
      width ?? this.yogaNode.getComputedWidth(),
      height ?? this.yogaNode.getComputedHeight(),
      Direction.LTR,
    );
  }

  /** Sync computed layout to Object3D positions (Y-down pixel space) */
  syncToObject3D(): void {
    for (const child of this._children) {
      child.object3D.position.x = child.computedLeft;
      child.object3D.position.y = -child.computedTop; // Y-down → Three.js Y-up
      child.syncToObject3D();
    }
  }

  dispose(): void {
    for (const child of this._children) child.dispose();
    this._children.length = 0;
    this.yogaNode.free();
  }
}
```

- [ ] **Step 5: 创建 barrel export**

Create `packages/os/src/ui/layout/index.ts`:

```typescript
export { YogaContext } from "./yoga-context";
export { YogaNode } from "./yoga-node";
```

- [ ] **Step 6: 运行测试确认通过**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/ui/layout.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/os/src/ui/layout/ packages/os/__tests__/ui/layout.test.ts
git commit -m "feat(os/ui): add Yoga WASM layout engine with Object3D sync"
```

---

### Task 4: Text Renderer (troika 封装)

**Files:**
- Create: `packages/os/src/ui/text/text-renderer.ts`
- Create: `packages/os/src/ui/text/index.ts`
- Create: `packages/os/__tests__/ui/text-renderer.test.ts`

- [ ] **Step 1: 写失败测试**

Create `packages/os/__tests__/ui/text-renderer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock troika-three-text since it needs WebGL context
vi.mock("troika-three-text", () => {
  return {
    Text: vi.fn().mockImplementation(() => {
      const obj = {
        text: "",
        fontSize: 16,
        color: 0xffffff,
        font: null as string | null,
        anchorX: "left",
        anchorY: "top",
        maxWidth: Infinity,
        textAlign: "left",
        lineHeight: 1.2,
        position: { x: 0, y: 0, z: 0, set: vi.fn() },
        sync: vi.fn((cb?: () => void) => cb?.()),
        dispose: vi.fn(),
        removeFromParent: vi.fn(),
      };
      return obj;
    }),
  };
});

import { TextRenderer } from "../../src/ui/text";

describe("TextRenderer", () => {
  let tr: TextRenderer;

  beforeEach(() => {
    tr = new TextRenderer();
  });

  it("creates a text mesh with default properties", () => {
    const mesh = tr.createText({ text: "Hello" });
    expect(mesh.text).toBe("Hello");
    expect(mesh.fontSize).toBe(17); // default bodySize from dark theme
  });

  it("applies custom fontSize and color", () => {
    const mesh = tr.createText({ text: "X", fontSize: 24, color: "#FF0000" });
    expect(mesh.fontSize).toBe(24);
  });

  it("disposes a text mesh", () => {
    const mesh = tr.createText({ text: "test" });
    tr.disposeText(mesh);
    expect(mesh.dispose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/ui/text-renderer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: 实现 text-renderer.ts**

Create `packages/os/src/ui/text/text-renderer.ts`:

```typescript
import { Text } from "troika-three-text";
import { darkTheme } from "../theme";
import type { Theme } from "../theme";

export interface TextConfig {
  text: string;
  fontSize?: number;
  color?: string;
  font?: string;
  maxWidth?: number;
  textAlign?: "left" | "center" | "right" | "justify";
  lineHeight?: number;
  anchorX?: "left" | "center" | "right";
  anchorY?: "top" | "top-baseline" | "middle" | "bottom-baseline" | "bottom";
}

export class TextRenderer {
  private _defaultFont: string = "";
  private _theme: Theme = darkTheme;
  private _texts: Set<InstanceType<typeof Text>> = new Set();

  setDefaultFont(fontUrl: string): void {
    this._defaultFont = fontUrl;
  }

  setTheme(theme: Theme): void {
    this._theme = theme;
  }

  createText(config: TextConfig): InstanceType<typeof Text> {
    const mesh = new Text();
    mesh.text = config.text;
    mesh.fontSize = config.fontSize ?? this._theme.fonts.bodySize;
    mesh.color = config.color ?? this._theme.colors.text;
    mesh.font = config.font ?? this._defaultFont || null;
    mesh.anchorX = config.anchorX ?? "left";
    mesh.anchorY = config.anchorY ?? "top";
    mesh.maxWidth = config.maxWidth ?? Infinity;
    mesh.textAlign = config.textAlign ?? "left";
    mesh.lineHeight = config.lineHeight ?? 1.2;
    mesh.sync();
    this._texts.add(mesh);
    return mesh;
  }

  updateText(mesh: InstanceType<typeof Text>, config: Partial<TextConfig>): void {
    if (config.text !== undefined) mesh.text = config.text;
    if (config.fontSize !== undefined) mesh.fontSize = config.fontSize;
    if (config.color !== undefined) mesh.color = config.color;
    if (config.font !== undefined) mesh.font = config.font;
    if (config.maxWidth !== undefined) mesh.maxWidth = config.maxWidth;
    if (config.textAlign !== undefined) mesh.textAlign = config.textAlign;
    if (config.lineHeight !== undefined) mesh.lineHeight = config.lineHeight;
    if (config.anchorX !== undefined) mesh.anchorX = config.anchorX;
    if (config.anchorY !== undefined) mesh.anchorY = config.anchorY;
    mesh.sync();
  }

  disposeText(mesh: InstanceType<typeof Text>): void {
    mesh.removeFromParent();
    mesh.dispose();
    this._texts.delete(mesh);
  }

  dispose(): void {
    for (const mesh of this._texts) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    this._texts.clear();
  }
}
```

- [ ] **Step 4: 创建 barrel export**

Create `packages/os/src/ui/text/index.ts`:

```typescript
export { TextRenderer } from "./text-renderer";
export type { TextConfig } from "./text-renderer";
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/ui/text-renderer.test.ts`
Expected: All 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/os/src/ui/text/ packages/os/__tests__/ui/text-renderer.test.ts
git commit -m "feat(os/ui): add TextRenderer wrapping troika-three-text"
```

---

### Task 5: Primitives — Box, Image, Icon

**Files:**
- Create: `packages/os/src/ui/primitives/rounded-rect-shader.ts` — GLSL SDF shader (双兼容)
- Create: `packages/os/src/ui/primitives/box.ts`
- Create: `packages/os/src/ui/primitives/image.ts`
- Create: `packages/os/src/ui/primitives/icon.ts`
- Create: `packages/os/src/ui/primitives/index.ts`
- Create: `packages/os/__tests__/ui/primitives.test.ts`

- [ ] **Step 1: 写失败测试**

Create `packages/os/__tests__/ui/primitives.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { Mesh, PlaneGeometry, ShaderMaterial, MeshBasicMaterial, Texture } from "three";
import { Box, ImageView, Icon } from "../../src/ui/primitives";

describe("Box", () => {
  it("creates a Mesh with ShaderMaterial", () => {
    const box = new Box({ width: 200, height: 100 });
    expect(box.mesh).toBeInstanceOf(Mesh);
    expect(box.mesh.material).toBeInstanceOf(ShaderMaterial);
  });

  it("applies corner radius", () => {
    const box = new Box({ width: 200, height: 100, radius: 12 });
    const mat = box.mesh.material as ShaderMaterial;
    expect(mat.uniforms.uRadius.value).toBe(12);
  });

  it("updates background color", () => {
    const box = new Box({ width: 200, height: 100, backgroundColor: "#FF0000" });
    const mat = box.mesh.material as ShaderMaterial;
    // Color uniform should be set (vec4)
    expect(mat.uniforms.uBgColor.value).toBeDefined();
  });

  it("updates size", () => {
    const box = new Box({ width: 200, height: 100 });
    box.setSize(300, 150);
    expect(box.mesh.scale.x).toBe(300);
    expect(box.mesh.scale.y).toBe(150);
  });

  it("disposes resources", () => {
    const box = new Box({ width: 100, height: 100 });
    box.dispose();
    expect((box.mesh.material as ShaderMaterial).disposed).toBeDefined();
  });
});

describe("ImageView", () => {
  it("creates a mesh with basic material", () => {
    const img = new ImageView({ width: 100, height: 100 });
    expect(img.mesh).toBeInstanceOf(Mesh);
  });

  it("applies a texture", () => {
    const tex = new Texture();
    const img = new ImageView({ width: 100, height: 100, texture: tex });
    expect((img.mesh.material as MeshBasicMaterial).map).toBe(tex);
  });
});

describe("Icon", () => {
  it("creates a mesh", () => {
    const icon = new Icon({ size: 24 });
    expect(icon.mesh).toBeInstanceOf(Mesh);
  });

  it("sets correct square scale", () => {
    const icon = new Icon({ size: 32 });
    expect(icon.mesh.scale.x).toBe(32);
    expect(icon.mesh.scale.y).toBe(32);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/ui/primitives.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: 实现 rounded-rect-shader.ts**

Create `packages/os/src/ui/primitives/rounded-rect-shader.ts`:

```typescript
/** GLSL rounded rectangle SDF shader — works with both WebGL and WebGPU */

export const roundedRectVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const roundedRectFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform vec2 uSize;
  uniform float uRadius;
  uniform vec4 uBgColor;
  uniform vec4 uBorderColor;
  uniform float uBorderWidth;

  float sdRoundedRect(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    vec2 halfSize = uSize * 0.5;

    float d = sdRoundedRect(p, halfSize, uRadius);

    // Anti-alias edge
    float aa = 1.0;
    float alpha = 1.0 - smoothstep(-aa, aa, d);

    // Border
    float innerAlpha = 1.0 - smoothstep(-aa, aa, d + uBorderWidth);
    vec4 col = mix(uBorderColor, uBgColor, innerAlpha);
    col.a *= alpha;

    if (col.a < 0.001) discard;
    gl_FragColor = col;
  }
`;
```

- [ ] **Step 4: 实现 box.ts**

Create `packages/os/src/ui/primitives/box.ts`:

```typescript
import { Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector4, DoubleSide } from "three";
import { roundedRectVertexShader, roundedRectFragmentShader } from "./rounded-rect-shader";

export interface BoxConfig {
  width: number;
  height: number;
  radius?: number;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
}

function hexToVec4(hex: string, alpha = 1): Vector4 {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  return new Vector4(r, g, b, alpha);
}

const _unitPlane = new PlaneGeometry(1, 1);

export class Box {
  readonly mesh: Mesh;
  private _material: ShaderMaterial;

  constructor(config: BoxConfig) {
    this._material = new ShaderMaterial({
      vertexShader: roundedRectVertexShader,
      fragmentShader: roundedRectFragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uSize: { value: new Vector2(config.width, config.height) },
        uRadius: { value: config.radius ?? 0 },
        uBgColor: { value: config.backgroundColor ? hexToVec4(config.backgroundColor) : new Vector4(1, 1, 1, 1) },
        uBorderColor: { value: config.borderColor ? hexToVec4(config.borderColor) : new Vector4(0, 0, 0, 0) },
        uBorderWidth: { value: config.borderWidth ?? 0 },
      },
    });

    this.mesh = new Mesh(_unitPlane, this._material);
    this.mesh.scale.set(config.width, config.height, 1);
  }

  setSize(width: number, height: number): void {
    this.mesh.scale.set(width, height, 1);
    this._material.uniforms.uSize.value.set(width, height);
  }

  setBackgroundColor(hex: string, alpha = 1): void {
    this._material.uniforms.uBgColor.value = hexToVec4(hex, alpha);
  }

  setBorderColor(hex: string, alpha = 1): void {
    this._material.uniforms.uBorderColor.value = hexToVec4(hex, alpha);
  }

  setBorderWidth(w: number): void {
    this._material.uniforms.uBorderWidth.value = w;
  }

  setRadius(r: number): void {
    this._material.uniforms.uRadius.value = r;
  }

  dispose(): void {
    this._material.dispose();
  }
}
```

- [ ] **Step 5: 实现 image.ts**

Create `packages/os/src/ui/primitives/image.ts`:

```typescript
import { Mesh, PlaneGeometry, MeshBasicMaterial, Texture, DoubleSide } from "three";

export interface ImageViewConfig {
  width: number;
  height: number;
  texture?: Texture;
}

const _unitPlane = new PlaneGeometry(1, 1);

export class ImageView {
  readonly mesh: Mesh;
  private _material: MeshBasicMaterial;

  constructor(config: ImageViewConfig) {
    this._material = new MeshBasicMaterial({
      map: config.texture ?? null,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    this.mesh = new Mesh(_unitPlane, this._material);
    this.mesh.scale.set(config.width, config.height, 1);
  }

  setTexture(tex: Texture): void {
    this._material.map = tex;
    this._material.needsUpdate = true;
  }

  setSize(width: number, height: number): void {
    this.mesh.scale.set(width, height, 1);
  }

  dispose(): void {
    this._material.dispose();
  }
}
```

- [ ] **Step 6: 实现 icon.ts**

Create `packages/os/src/ui/primitives/icon.ts`:

```typescript
import { Mesh, PlaneGeometry, MeshBasicMaterial, Texture, DoubleSide } from "three";

export interface IconConfig {
  size: number;
  texture?: Texture;
  color?: number;
}

const _unitPlane = new PlaneGeometry(1, 1);

export class Icon {
  readonly mesh: Mesh;
  private _material: MeshBasicMaterial;

  constructor(config: IconConfig) {
    this._material = new MeshBasicMaterial({
      map: config.texture ?? null,
      color: config.color ?? 0xffffff,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    this.mesh = new Mesh(_unitPlane, this._material);
    this.mesh.scale.set(config.size, config.size, 1);
  }

  setTexture(tex: Texture): void {
    this._material.map = tex;
    this._material.needsUpdate = true;
  }

  setSize(size: number): void {
    this.mesh.scale.set(size, size, 1);
  }

  setColor(c: number): void {
    this._material.color.set(c);
  }

  dispose(): void {
    this._material.dispose();
  }
}
```

- [ ] **Step 7: 创建 barrel export**

Create `packages/os/src/ui/primitives/index.ts`:

```typescript
export { Box } from "./box";
export type { BoxConfig } from "./box";
export { ImageView } from "./image";
export type { ImageViewConfig } from "./image";
export { Icon } from "./icon";
export type { IconConfig } from "./icon";
```

- [ ] **Step 8: 运行测试确认通过**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/ui/primitives.test.ts`
Expected: All 7 tests PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/os/src/ui/primitives/ packages/os/__tests__/ui/primitives.test.ts
git commit -m "feat(os/ui): add Box/ImageView/Icon GPU primitives with SDF shader"
```

---

### Task 6: Components — Button, Toggle, Slider

**Files:**
- Create: `packages/os/src/ui/components/base-component.ts` — 组件基类
- Create: `packages/os/src/ui/components/button.ts`
- Create: `packages/os/src/ui/components/toggle.ts`
- Create: `packages/os/src/ui/components/slider.ts`
- Create: `packages/os/__tests__/ui/components/button.test.ts`

- [ ] **Step 1: 写 button 失败测试**

Create `packages/os/__tests__/ui/components/button.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { Group } from "three";
import { Button } from "../../../src/ui/components/button";

describe("Button", () => {
  it("creates a Group with box background and label", () => {
    const btn = new Button({ label: "OK", width: 120, height: 44 });
    expect(btn.root).toBeInstanceOf(Group);
    expect(btn.root.children.length).toBeGreaterThan(0);
  });

  it("fires onTap callback", () => {
    const handler = vi.fn();
    const btn = new Button({ label: "OK", width: 120, height: 44, onTap: handler });
    btn.handleTap();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("updates label text", () => {
    const btn = new Button({ label: "OK", width: 120, height: 44 });
    btn.setLabel("Cancel");
    // No throw, label updated internally
  });

  it("disposes without error", () => {
    const btn = new Button({ label: "X", width: 80, height: 40 });
    btn.dispose();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/ui/components/button.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: 实现 base-component.ts**

Create `packages/os/src/ui/components/base-component.ts`:

```typescript
import { Group } from "three";

export abstract class BaseComponent {
  readonly root = new Group();
  protected _disposed = false;

  abstract dispose(): void;

  setPosition(x: number, y: number): void {
    this.root.position.set(x, y, 0);
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
  }
}
```

- [ ] **Step 4: 实现 button.ts**

Create `packages/os/src/ui/components/button.ts`:

```typescript
import { Group } from "three";
import { BaseComponent } from "./base-component";
import { Box } from "../primitives/box";
import { darkTheme } from "../theme";
import type { Theme } from "../theme";

// Inline simple text label using troika mock-safe approach:
// In real usage, a TextRenderer instance creates the text mesh.
// For now, Button stores label as data; text mesh creation is deferred
// to the render integration layer (or test mock).

export interface ButtonConfig {
  label: string;
  width: number;
  height: number;
  radius?: number;
  backgroundColor?: string;
  textColor?: string;
  onTap?: () => void;
  theme?: Theme;
}

export class Button extends BaseComponent {
  private _box: Box;
  private _label: string;
  private _onTap?: () => void;
  private _width: number;
  private _height: number;

  constructor(config: ButtonConfig) {
    super();
    const theme = config.theme ?? darkTheme;
    this._width = config.width;
    this._height = config.height;
    this._label = config.label;
    this._onTap = config.onTap;

    this._box = new Box({
      width: config.width,
      height: config.height,
      radius: config.radius ?? theme.radii.md,
      backgroundColor: config.backgroundColor ?? theme.colors.primary,
    });

    this.root.add(this._box.mesh);
    this.root.userData.interactive = true;
  }

  get label(): string { return this._label; }

  setLabel(text: string): void {
    this._label = text;
    // Text mesh update would happen in render integration
  }

  handleTap(): void {
    this._onTap?.();
  }

  dispose(): void {
    this._box.dispose();
    this._disposed = true;
  }
}
```

- [ ] **Step 5: 实现 toggle.ts**

Create `packages/os/src/ui/components/toggle.ts`:

```typescript
import { BaseComponent } from "./base-component";
import { Box } from "../primitives/box";
import { Spring } from "../animation/spring";
import { darkTheme } from "../theme";
import type { Theme } from "../theme";

export interface ToggleConfig {
  value?: boolean;
  width?: number;
  height?: number;
  onChange?: (value: boolean) => void;
  theme?: Theme;
}

export class Toggle extends BaseComponent {
  private _track: Box;
  private _thumb: Box;
  private _value: boolean;
  private _spring: Spring;
  private _onChange?: (value: boolean) => void;
  private _width: number;
  private _height: number;
  private _thumbSize: number;

  constructor(config: ToggleConfig = {}) {
    super();
    const theme = config.theme ?? darkTheme;
    this._value = config.value ?? false;
    this._onChange = config.onChange;
    this._width = config.width ?? 51;
    this._height = config.height ?? 31;
    this._thumbSize = this._height - 4;

    this._track = new Box({
      width: this._width,
      height: this._height,
      radius: this._height / 2,
      backgroundColor: this._value ? theme.colors.success : theme.colors.surfaceHover,
    });

    this._thumb = new Box({
      width: this._thumbSize,
      height: this._thumbSize,
      radius: this._thumbSize / 2,
      backgroundColor: "#FFFFFF",
    });

    const thumbX = this._value ? this._width - this._thumbSize - 2 : 2;
    this._thumb.mesh.position.set(thumbX - this._width / 2 + this._thumbSize / 2, 0, 0.1);
    this._spring = new Spring({ from: thumbX, to: thumbX });

    this.root.add(this._track.mesh);
    this.root.add(this._thumb.mesh);
    this.root.userData.interactive = true;
  }

  get value(): boolean { return this._value; }

  toggle(): void {
    this._value = !this._value;
    const targetX = this._value ? this._width - this._thumbSize - 2 : 2;
    this._spring.setTarget(targetX);
    this._onChange?.(this._value);
  }

  handleTap(): void { this.toggle(); }

  update(dt: number): void {
    if (this._spring.done) return;
    this._spring.update(dt);
    const x = this._spring.value;
    this._thumb.mesh.position.x = x - this._width / 2 + this._thumbSize / 2;
  }

  dispose(): void {
    this._track.dispose();
    this._thumb.dispose();
    this._disposed = true;
  }
}
```

- [ ] **Step 6: 实现 slider.ts**

Create `packages/os/src/ui/components/slider.ts`:

```typescript
import { BaseComponent } from "./base-component";
import { Box } from "../primitives/box";
import { darkTheme } from "../theme";
import type { Theme } from "../theme";

export interface SliderConfig {
  min?: number;
  max?: number;
  value?: number;
  width?: number;
  height?: number;
  onChange?: (value: number) => void;
  theme?: Theme;
}

export class Slider extends BaseComponent {
  private _track: Box;
  private _fill: Box;
  private _thumb: Box;
  private _min: number;
  private _max: number;
  private _value: number;
  private _width: number;
  private _height: number;
  private _thumbSize: number;
  private _onChange?: (value: number) => void;

  constructor(config: SliderConfig = {}) {
    super();
    const theme = config.theme ?? darkTheme;
    this._min = config.min ?? 0;
    this._max = config.max ?? 1;
    this._value = config.value ?? this._min;
    this._width = config.width ?? 200;
    this._height = config.height ?? 4;
    this._thumbSize = 20;
    this._onChange = config.onChange;

    this._track = new Box({
      width: this._width,
      height: this._height,
      radius: this._height / 2,
      backgroundColor: theme.colors.surfaceHover,
    });

    const progress = this._normalizedValue();
    this._fill = new Box({
      width: this._width * progress,
      height: this._height,
      radius: this._height / 2,
      backgroundColor: theme.colors.primary,
    });

    this._thumb = new Box({
      width: this._thumbSize,
      height: this._thumbSize,
      radius: this._thumbSize / 2,
      backgroundColor: "#FFFFFF",
    });

    this._updatePositions();
    this.root.add(this._track.mesh);
    this.root.add(this._fill.mesh);
    this.root.add(this._thumb.mesh);
    this.root.userData.interactive = true;
  }

  get value(): number { return this._value; }

  setValue(v: number): void {
    this._value = Math.max(this._min, Math.min(this._max, v));
    this._updatePositions();
    this._onChange?.(this._value);
  }

  /** Call with normalized drag position (0-1 across track width) */
  setNormalized(n: number): void {
    this.setValue(this._min + (this._max - this._min) * Math.max(0, Math.min(1, n)));
  }

  private _normalizedValue(): number {
    return (this._value - this._min) / (this._max - this._min);
  }

  private _updatePositions(): void {
    const n = this._normalizedValue();
    const fillW = Math.max(1, this._width * n);
    this._fill.setSize(fillW, this._height);
    this._fill.mesh.position.x = (fillW - this._width) / 2;
    this._fill.mesh.position.z = 0.05;
    this._thumb.mesh.position.x = n * this._width - this._width / 2;
    this._thumb.mesh.position.z = 0.1;
  }

  dispose(): void {
    this._track.dispose();
    this._fill.dispose();
    this._thumb.dispose();
    this._disposed = true;
  }
}
```

- [ ] **Step 7: 运行测试确认通过**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/ui/components/button.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/os/src/ui/components/ packages/os/__tests__/ui/components/
git commit -m "feat(os/ui): add Button, Toggle, Slider components"
```

---

### Task 7: ScrollView + List

**Files:**
- Create: `packages/os/src/ui/components/scroll-view.ts`
- Create: `packages/os/src/ui/components/list.ts`
- Create: `packages/os/__tests__/ui/components/scroll-view.test.ts`

- [ ] **Step 1: 写失败测试**

Create `packages/os/__tests__/ui/components/scroll-view.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { Group } from "three";
import { ScrollView } from "../../../src/ui/components/scroll-view";
import { List } from "../../../src/ui/components/list";

describe("ScrollView", () => {
  it("creates a root Group", () => {
    const sv = new ScrollView({ width: 300, height: 400 });
    expect(sv.root).toBeInstanceOf(Group);
  });

  it("adds content to scroll container", () => {
    const sv = new ScrollView({ width: 300, height: 400 });
    const child = new Group();
    sv.addContent(child);
    expect(sv.contentContainer.children).toContain(child);
  });

  it("clamps scroll offset", () => {
    const sv = new ScrollView({ width: 300, height: 400, contentHeight: 1000 });
    sv.scrollTo(9999);
    expect(sv.scrollOffset).toBeLessThanOrEqual(600); // contentHeight - viewportHeight
    sv.scrollTo(-100);
    expect(sv.scrollOffset).toBe(0);
  });

  it("scrollBy adjusts offset incrementally", () => {
    const sv = new ScrollView({ width: 300, height: 400, contentHeight: 1000 });
    sv.scrollBy(50);
    expect(sv.scrollOffset).toBe(50);
    sv.scrollBy(50);
    expect(sv.scrollOffset).toBe(100);
  });
});

describe("List", () => {
  it("creates items from data", () => {
    const list = new List<string>({
      width: 300,
      height: 400,
      itemHeight: 44,
      data: ["A", "B", "C"],
      renderItem: (item, index) => {
        const g = new Group();
        g.name = item;
        return g;
      },
    });
    expect(list.root).toBeInstanceOf(Group);
  });

  it("updates data", () => {
    const render = vi.fn((item: string) => new Group());
    const list = new List<string>({
      width: 300,
      height: 400,
      itemHeight: 44,
      data: ["A"],
      renderItem: render,
    });
    list.setData(["A", "B", "C"]);
    // renderItem called for new items
    expect(render.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/ui/components/scroll-view.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: 实现 scroll-view.ts**

Create `packages/os/src/ui/components/scroll-view.ts`:

```typescript
import { Group } from "three";
import { BaseComponent } from "./base-component";

export interface ScrollViewConfig {
  width: number;
  height: number;
  contentHeight?: number;
}

export class ScrollView extends BaseComponent {
  readonly contentContainer = new Group();
  private _width: number;
  private _height: number;
  private _contentHeight: number;
  private _scrollOffset = 0;

  constructor(config: ScrollViewConfig) {
    super();
    this._width = config.width;
    this._height = config.height;
    this._contentHeight = config.contentHeight ?? config.height;
    this.root.add(this.contentContainer);
  }

  get scrollOffset(): number { return this._scrollOffset; }
  get maxScroll(): number { return Math.max(0, this._contentHeight - this._height); }

  setContentHeight(h: number): void {
    this._contentHeight = h;
    this._clamp();
  }

  addContent(child: Group): void {
    this.contentContainer.add(child);
  }

  scrollTo(offset: number): void {
    this._scrollOffset = offset;
    this._clamp();
    this._applyScroll();
  }

  scrollBy(delta: number): void {
    this.scrollTo(this._scrollOffset + delta);
  }

  private _clamp(): void {
    this._scrollOffset = Math.max(0, Math.min(this._scrollOffset, this.maxScroll));
  }

  private _applyScroll(): void {
    // Y-down pixel space: positive scroll moves content up (positive Y in Three.js)
    this.contentContainer.position.y = this._scrollOffset;
  }

  dispose(): void {
    this._disposed = true;
  }
}
```

- [ ] **Step 4: 实现 list.ts**

Create `packages/os/src/ui/components/list.ts`:

```typescript
import { Group } from "three";
import { ScrollView } from "./scroll-view";
import type { ScrollViewConfig } from "./scroll-view";

export interface ListConfig<T> extends ScrollViewConfig {
  itemHeight: number;
  data: T[];
  renderItem: (item: T, index: number) => Group;
}

export class List<T> extends ScrollView {
  private _itemHeight: number;
  private _data: T[];
  private _renderItem: (item: T, index: number) => Group;
  private _itemGroups: Group[] = [];

  constructor(config: ListConfig<T>) {
    super({
      width: config.width,
      height: config.height,
      contentHeight: config.data.length * config.itemHeight,
    });
    this._itemHeight = config.itemHeight;
    this._data = config.data;
    this._renderItem = config.renderItem;
    this._buildItems();
  }

  setData(data: T[]): void {
    this._clearItems();
    this._data = data;
    this.setContentHeight(data.length * this._itemHeight);
    this._buildItems();
  }

  private _buildItems(): void {
    for (let i = 0; i < this._data.length; i++) {
      const group = this._renderItem(this._data[i], i);
      group.position.y = -i * this._itemHeight; // Y-down
      this._itemGroups.push(group);
      this.addContent(group);
    }
  }

  private _clearItems(): void {
    for (const g of this._itemGroups) {
      g.removeFromParent();
    }
    this._itemGroups.length = 0;
  }

  dispose(): void {
    this._clearItems();
    super.dispose();
  }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/ui/components/scroll-view.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/os/src/ui/components/scroll-view.ts packages/os/src/ui/components/list.ts packages/os/__tests__/ui/components/scroll-view.test.ts
git commit -m "feat(os/ui): add ScrollView and List components"
```

---

### Task 8: TextInput, Modal, NavigationBar, TabBar + Barrel Exports

**Files:**
- Create: `packages/os/src/ui/components/text-input.ts`
- Create: `packages/os/src/ui/components/modal.ts`
- Create: `packages/os/src/ui/components/navigation-bar.ts`
- Create: `packages/os/src/ui/components/tab-bar.ts`
- Create: `packages/os/src/ui/components/index.ts`
- Create: `packages/os/src/ui/index.ts` — UI Kit barrel export
- Modify: `packages/os/src/index.ts` — 添加 `export * from "./ui"`

- [ ] **Step 1: 实现 text-input.ts**

Create `packages/os/src/ui/components/text-input.ts`:

```typescript
import { BaseComponent } from "./base-component";
import { Box } from "../primitives/box";
import { darkTheme } from "../theme";
import type { Theme } from "../theme";

export interface TextInputConfig {
  width: number;
  height?: number;
  placeholder?: string;
  value?: string;
  onTextChange?: (text: string) => void;
  theme?: Theme;
}

export class TextInput extends BaseComponent {
  private _box: Box;
  private _value: string;
  private _placeholder: string;
  private _focused = false;
  private _onTextChange?: (text: string) => void;

  constructor(config: TextInputConfig) {
    super();
    const theme = config.theme ?? darkTheme;
    this._value = config.value ?? "";
    this._placeholder = config.placeholder ?? "";
    this._onTextChange = config.onTextChange;

    this._box = new Box({
      width: config.width,
      height: config.height ?? 44,
      radius: theme.radii.md,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
    });

    this.root.add(this._box.mesh);
    this.root.userData.interactive = true;
  }

  get value(): string { return this._value; }
  get focused(): boolean { return this._focused; }

  focus(): void {
    this._focused = true;
    this._box.setBorderColor("#007AFF");
  }

  blur(): void {
    this._focused = false;
    this._box.setBorderColor(darkTheme.colors.border);
  }

  insertText(text: string): void {
    this._value += text;
    this._onTextChange?.(this._value);
  }

  deleteBackward(): void {
    if (this._value.length > 0) {
      this._value = this._value.slice(0, -1);
      this._onTextChange?.(this._value);
    }
  }

  setValue(text: string): void {
    this._value = text;
    this._onTextChange?.(this._value);
  }

  dispose(): void {
    this._box.dispose();
    this._disposed = true;
  }
}
```

- [ ] **Step 2: 实现 modal.ts**

Create `packages/os/src/ui/components/modal.ts`:

```typescript
import { BaseComponent } from "./base-component";
import { Box } from "../primitives/box";
import { darkTheme } from "../theme";
import type { Theme } from "../theme";

export interface ModalConfig {
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  theme?: Theme;
}

export class Modal extends BaseComponent {
  private _backdrop: Box;
  private _panel: Box;
  private _visible = false;

  constructor(config: ModalConfig) {
    super();
    const theme = config.theme ?? darkTheme;

    // Semi-transparent backdrop
    this._backdrop = new Box({
      width: config.viewportWidth,
      height: config.viewportHeight,
      backgroundColor: "#000000",
    });
    this._backdrop.setBackgroundColor("#000000", 0.4);

    // Content panel
    this._panel = new Box({
      width: config.width,
      height: config.height,
      radius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
    });
    this._panel.mesh.position.z = 0.1;

    this.root.add(this._backdrop.mesh);
    this.root.add(this._panel.mesh);
    this.root.visible = false;
  }

  get panelMesh() { return this._panel.mesh; }
  get visible(): boolean { return this._visible; }

  show(): void {
    this._visible = true;
    this.root.visible = true;
  }

  hide(): void {
    this._visible = false;
    this.root.visible = false;
  }

  dispose(): void {
    this._backdrop.dispose();
    this._panel.dispose();
    this._disposed = true;
  }
}
```

- [ ] **Step 3: 实现 navigation-bar.ts**

Create `packages/os/src/ui/components/navigation-bar.ts`:

```typescript
import { BaseComponent } from "./base-component";
import { Box } from "../primitives/box";
import { darkTheme } from "../theme";
import type { Theme } from "../theme";

export interface NavigationBarConfig {
  width: number;
  height?: number;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  theme?: Theme;
}

export class NavigationBar extends BaseComponent {
  private _box: Box;
  private _title: string;
  private _onBack?: () => void;

  constructor(config: NavigationBarConfig) {
    super();
    const theme = config.theme ?? darkTheme;
    const height = config.height ?? 44;
    this._title = config.title ?? "";
    this._onBack = config.onBack;

    this._box = new Box({
      width: config.width,
      height,
      backgroundColor: theme.colors.surface,
    });

    this.root.add(this._box.mesh);
    this.root.userData.interactive = true;
  }

  get title(): string { return this._title; }

  setTitle(title: string): void {
    this._title = title;
  }

  handleBack(): void {
    this._onBack?.();
  }

  dispose(): void {
    this._box.dispose();
    this._disposed = true;
  }
}
```

- [ ] **Step 4: 实现 tab-bar.ts**

Create `packages/os/src/ui/components/tab-bar.ts`:

```typescript
import { BaseComponent } from "./base-component";
import { Box } from "../primitives/box";
import { darkTheme } from "../theme";
import type { Theme } from "../theme";

export interface TabBarItem {
  id: string;
  label: string;
  icon?: string; // icon URL
}

export interface TabBarConfig {
  width: number;
  height?: number;
  items: TabBarItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  theme?: Theme;
}

export class TabBar extends BaseComponent {
  private _box: Box;
  private _items: TabBarItem[];
  private _selectedId: string;
  private _onSelect?: (id: string) => void;

  constructor(config: TabBarConfig) {
    super();
    const theme = config.theme ?? darkTheme;
    const height = config.height ?? 49;
    this._items = config.items;
    this._selectedId = config.selectedId ?? config.items[0]?.id ?? "";
    this._onSelect = config.onSelect;

    this._box = new Box({
      width: config.width,
      height,
      backgroundColor: theme.colors.surface,
    });

    this.root.add(this._box.mesh);
    this.root.userData.interactive = true;
  }

  get selectedId(): string { return this._selectedId; }
  get items(): TabBarItem[] { return this._items; }

  select(id: string): void {
    if (this._items.some((item) => item.id === id)) {
      this._selectedId = id;
      this._onSelect?.(id);
    }
  }

  dispose(): void {
    this._box.dispose();
    this._disposed = true;
  }
}
```

- [ ] **Step 5: 创建 components barrel export**

Create `packages/os/src/ui/components/index.ts`:

```typescript
export { BaseComponent } from "./base-component";
export { Button } from "./button";
export type { ButtonConfig } from "./button";
export { TextInput } from "./text-input";
export type { TextInputConfig } from "./text-input";
export { Toggle } from "./toggle";
export type { ToggleConfig } from "./toggle";
export { Slider } from "./slider";
export type { SliderConfig } from "./slider";
export { ScrollView } from "./scroll-view";
export type { ScrollViewConfig } from "./scroll-view";
export { List } from "./list";
export type { ListConfig } from "./list";
export { Modal } from "./modal";
export type { ModalConfig } from "./modal";
export { NavigationBar } from "./navigation-bar";
export type { NavigationBarConfig } from "./navigation-bar";
export { TabBar } from "./tab-bar";
export type { TabBarConfig, TabBarItem } from "./tab-bar";
```

- [ ] **Step 6: 创建 UI Kit barrel export**

Create `packages/os/src/ui/index.ts`:

```typescript
export * from "./theme";
export * from "./animation";
export * from "./layout";
export * from "./text";
export * from "./primitives";
export * from "./components";
```

- [ ] **Step 7: 更新主 index.ts**

Modify `packages/os/src/index.ts` — 添加 UI 导出:

```typescript
export * from "./engine";
export * from "./ui";
export * from "./types";
```

- [ ] **Step 8: 运行全部测试**

Run: `cd /root/viben/packages/os && pnpm test`
Expected: All tests PASS (engine + ui).

- [ ] **Step 9: Build 验证**

Run: `cd /root/viben/packages/os && pnpm build`
Expected: Build success.

- [ ] **Step 10: Commit**

```bash
git add packages/os/
git commit -m "feat(os/ui): add TextInput, Modal, NavigationBar, TabBar + barrel exports"
```

---

## 验证标准

完成所有 8 个 Task 后，`@viben/os` 应该导出：

**Theme:** `ThemeManager`, `darkTheme`, `lightTheme`
**Animation:** `Spring`, `Tween`, `Easing`
**Layout:** `YogaContext`, `YogaNode`
**Text:** `TextRenderer`
**Primitives:** `Box`, `ImageView`, `Icon`
**Components:** `Button`, `TextInput`, `Toggle`, `Slider`, `ScrollView`, `List`, `Modal`, `NavigationBar`, `TabBar`
