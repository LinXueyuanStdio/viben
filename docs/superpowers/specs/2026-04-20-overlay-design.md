# Overlay 演示系统 - 技术设计文档

> 创建时间: 2026-04-20
> 更新时间: 2026-04-20
> 关联 PRD: [2026-04-20-overlay-prd.md](./2026-04-20-overlay-prd.md)

## 技术选型

| 层级 | 技术 | 理由 |
|------|------|------|
| 渲染引擎 | PixiJS v8 + @pixi/react | WebGL/WebGPU 加速，支持未来 Live2D 扩展 |
| 状态管理 | Zustand | 轻量、与现有架构一致 |
| 控制接口 | React Hooks | 组件化调用，易于使用 |
| 事件系统 | Window Events + Zustand | 全局监听 + 状态驱动 |
| 配置持久化 | YAML 文件 (`~/.viben/overlay.yaml`) | 符合项目 file-native 范式 |

## 架构设计

### 窗口架构

在 Viben 主窗口内部添加全局 Overlay 层，不创建独立窗口。采用 **双层架构**：PixiJS Canvas 负责高性能动画渲染，React DOM 层负责可交互元素。

```
┌─────────────────────────────────────────────────────┐
│  Viben Main Window                                  │
│  ┌───────────────────────────────────────────────┐  │
│  │  React Interactive Layer (DOM)                │  │  ← pointer-events: auto (可交互)
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  可交互元素区域                           │  │  │
│  │  │  - 字幕点击、对话选项、按钮等             │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  PixiJS Canvas (全屏覆盖)                     │  │  ← pointer-events: none (穿透)
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  弹幕层 (z: 60)                          │  │  │
│  │  │  按键层 (z: 50)                          │  │  │
│  │  │  点击层 (z: 40)                          │  │  │
│  │  │  字幕动画层 (z: 20)                       │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  React App (正常 UI)                          │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 层级定义

```typescript
enum OverlayZIndex {
  Background = 0,
  Live2D = 10,              // 预留: Live2D 角色
  Subtitle = 20,            // 字幕动画
  DialogueBox = 30,         // 预留: Galgame 对话框
  ClickIndicator = 40,      // 点击涟漪
  Keystroke = 50,           // 按键可视化
  Danmaku = 60,             // 弹幕
  Interactive = 70,         // 可交互元素 (DOM 层)
  Custom = 100,             // 用户自定义扩展
}
```

## 点击穿透与交互模型

### 双层交互架构

为支持未来可交互元素（列表选择、按钮点击、语音输入等），采用 PixiJS + DOM 双层架构：

| 层 | 技术 | pointer-events | 用途 |
|---|---|---|---|
| Interactive Layer | React DOM | `auto` | 可交互元素：按钮、选择列表、输入框 |
| Animation Layer | PixiJS Canvas | `none` | 纯动画：弹幕、点击涟漪、按键提示 |

### 交互元素类型定义

```typescript
// types/overlay.ts

// === 可交互元素基类 ===
interface InteractiveElement {
  id: string;
  type: InteractiveElementType;
  position: { x: number; y: number } | "center" | "bottom" | "top";
  visible: boolean;
  zIndex?: number;
}

type InteractiveElementType =
  | "button"           // 单个按钮
  | "button-group"     // 按钮组
  | "choice-list"      // 单选列表 (Galgame 选项)
  | "multi-select"     // 多选列表
  | "text-input"       // 文本输入
  | "voice-input"      // 语音输入
  | "slider"           // 滑块
  | "custom";          // 自定义组件

// === 按钮 ===
interface OverlayButton extends InteractiveElement {
  type: "button";
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  icon?: string;
  onClick?: () => void;
}

// === 按钮组 ===
interface OverlayButtonGroup extends InteractiveElement {
  type: "button-group";
  buttons: Array<{
    id: string;
    label: string;
    icon?: string;
  }>;
  direction?: "horizontal" | "vertical";
  onSelect?: (buttonId: string) => void;
}

// === 单选列表 (Galgame 风格选项) ===
interface OverlayChoiceList extends InteractiveElement {
  type: "choice-list";
  title?: string;
  choices: Array<{
    id: string;
    text: string;
    disabled?: boolean;
    icon?: string;
  }>;
  onSelect?: (choiceId: string) => void;
  animation?: "fade" | "slide-up" | "typewriter";
}

// === 多选列表 ===
interface OverlayMultiSelect extends InteractiveElement {
  type: "multi-select";
  title?: string;
  options: Array<{
    id: string;
    text: string;
    checked?: boolean;
  }>;
  minSelect?: number;
  maxSelect?: number;
  confirmLabel?: string;
  onConfirm?: (selectedIds: string[]) => void;
}

// === 语音输入 ===
interface OverlayVoiceInput extends InteractiveElement {
  type: "voice-input";
  placeholder?: string;
  maxDuration?: number;  // 最大录音时长 (秒)
  onResult?: (text: string, audioBlob?: Blob) => void;
  onCancel?: () => void;
}

// === 文本输入 ===
interface OverlayTextInput extends InteractiveElement {
  type: "text-input";
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  onSubmit?: (text: string) => void;
  onCancel?: () => void;
}

// 联合类型
type AnyInteractiveElement =
  | OverlayButton
  | OverlayButtonGroup
  | OverlayChoiceList
  | OverlayMultiSelect
  | OverlayVoiceInput
  | OverlayTextInput;
```

### 交互控制 Hook

```typescript
// hooks/use-overlay-interaction.ts

interface UseOverlayInteractionReturn {
  // 当前显示的交互元素
  elements: AnyInteractiveElement[];

  // 显示交互元素
  showButton: (config: Omit<OverlayButton, "id" | "type">) => string;
  showButtonGroup: (config: Omit<OverlayButtonGroup, "id" | "type">) => string;
  showChoiceList: (config: Omit<OverlayChoiceList, "id" | "type">) => Promise<string>;  // 返回选中的 choiceId
  showMultiSelect: (config: Omit<OverlayMultiSelect, "id" | "type">) => Promise<string[]>;
  showVoiceInput: (config?: Omit<OverlayVoiceInput, "id" | "type">) => Promise<{ text: string; audio?: Blob }>;
  showTextInput: (config?: Omit<OverlayTextInput, "id" | "type">) => Promise<string>;

  // 隐藏/移除
  hide: (elementId: string) => void;
  hideAll: () => void;

  // 更新元素
  update: (elementId: string, updates: Partial<AnyInteractiveElement>) => void;
}

// 使用示例
const interaction = useOverlayInteraction();

// Galgame 风格对话选项
const choice = await interaction.showChoiceList({
  title: "你要怎么回答？",
  choices: [
    { id: "a", text: "接受任务" },
    { id: "b", text: "拒绝" },
    { id: "c", text: "询问更多信息" },
  ],
  animation: "slide-up",
});
console.log("用户选择了:", choice);

// 语音输入
const { text } = await interaction.showVoiceInput({
  placeholder: "按住说话...",
  maxDuration: 60,
});
```

## 流式字幕系统

### 流式输入设计

为支持 AI 对话的实时流式输出，字幕系统提供专门的流式 API：

```typescript
// types/overlay.ts

// === 流式字幕状态 ===
interface StreamingSubtitleState {
  id: string;
  text: string;           // 当前累积的文本
  isStreaming: boolean;   // 是否正在流式输入
  cursor?: boolean;       // 是否显示光标
}

// === 字幕 Store 扩展 ===
interface SubtitleState {
  // ... existing fields

  // 流式字幕
  streamingSubtitle: StreamingSubtitleState | null;
}

interface SubtitleActions {
  // ... existing actions

  // 流式字幕控制
  startStream: (options?: Partial<SubtitleItem>) => string;  // 返回 stream id
  appendStream: (chunk: string) => void;                     // 追加文本
  finishStream: () => void;                                  // 结束流式输入
  cancelStream: () => void;                                  // 取消流式输入
}
```

### 字幕 Hook 完整接口

```typescript
// hooks/use-subtitle.ts

interface UseSubtitleReturn {
  // 状态
  enabled: boolean;
  current: SubtitleItem | null;
  streaming: StreamingSubtitleState | null;
  isStreaming: boolean;

  // 基础控制
  show: (text: string, options?: Partial<SubtitleItem>) => void;
  hide: () => void;
  setEnabled: (enabled: boolean) => void;

  // 动画效果
  typewriter: (text: string, options?: {
    speed?: number;      // 每字符间隔 ms，默认 50
    cursor?: boolean;    // 是否显示光标
  } & Partial<SubtitleItem>) => Promise<void>;

  // 流式输入 (用于 AI 对话)
  startStream: (options?: Partial<SubtitleItem>) => string;
  appendStream: (chunk: string) => void;
  finishStream: () => void;
  cancelStream: () => void;

  // 队列控制
  enqueue: (item: SubtitleItem) => void;
  clearQueue: () => void;

  // 便捷方法: 配合 AI SDK 使用
  streamFromAsyncIterator: (
    iterator: AsyncIterable<string>,
    options?: Partial<SubtitleItem>
  ) => Promise<string>;  // 返回完整文本
}

// 使用示例

// 1. 基础流式输入
const subtitle = useSubtitle();
subtitle.startStream({ position: "bottom", style: "dialogue", speaker: "AI" });
for await (const chunk of aiResponse) {
  subtitle.appendStream(chunk);
}
subtitle.finishStream();

// 2. 便捷方法 - 直接传入 AsyncIterable
const fullText = await subtitle.streamFromAsyncIterator(
  aiStream,
  { speaker: "助手", style: "dialogue" }
);

// 3. 配合 Anthropic SDK
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const stream = await client.messages.stream({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello" }],
});

subtitle.startStream({ speaker: "Claude" });
for await (const event of stream) {
  if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
    subtitle.appendStream(event.delta.text);
  }
}
subtitle.finishStream();
```

### 流式渲染实现

```typescript
// components/overlay/layers/subtitle-layer.tsx

function StreamingSubtitle({ state }: { state: StreamingSubtitleState }) {
  const [displayText, setDisplayText] = useState("");
  const textRef = useRef(state.text);

  // 平滑显示新增文本，避免闪烁
  useEffect(() => {
    const newText = state.text;
    const oldText = textRef.current;

    if (newText.length > oldText.length) {
      // 逐字符追加，每 16ms 一个字符 (约 60fps)
      const newChars = newText.slice(oldText.length);
      let i = 0;
      const timer = setInterval(() => {
        if (i < newChars.length) {
          setDisplayText(prev => prev + newChars[i]);
          i++;
        } else {
          clearInterval(timer);
        }
      }, 16);

      textRef.current = newText;
      return () => clearInterval(timer);
    }
  }, [state.text]);

  return (
    <div className="subtitle-streaming">
      <span>{displayText}</span>
      {state.cursor && state.isStreaming && (
        <span className="cursor">|</span>
      )}
    </div>
  );
}
```

## 目录结构

```
apps/desktop/src/
├── components/overlay/
│   ├── index.ts                      # 导出入口
│   ├── overlay-canvas.tsx            # PixiJS 主画布容器
│   ├── overlay-provider.tsx          # Context Provider
│   ├── overlay-interactive.tsx       # 可交互元素容器 (DOM)
│   ├── layers/
│   │   ├── danmaku-layer.tsx         # 弹幕层
│   │   ├── subtitle-layer.tsx        # 字幕层 (含流式)
│   │   ├── click-indicator-layer.tsx # 鼠标点击指示器
│   │   └── keystroke-layer.tsx       # 按键可视化
│   ├── elements/
│   │   ├── danmaku-item.tsx          # 单条弹幕
│   │   ├── subtitle-box.tsx          # 字幕框
│   │   ├── streaming-subtitle.tsx    # 流式字幕
│   │   ├── click-ripple.tsx          # 点击涟漪效果
│   │   └── key-badge.tsx             # 按键徽章
│   └── interactive/                  # 可交互元素组件
│       ├── overlay-button.tsx
│       ├── overlay-button-group.tsx
│       ├── overlay-choice-list.tsx
│       ├── overlay-multi-select.tsx
│       ├── overlay-voice-input.tsx
│       └── overlay-text-input.tsx
├── stores/
│   └── overlay-store.ts              # Zustand 状态
├── hooks/
│   ├── use-overlay.ts                # 主控制 hook
│   ├── use-danmaku.ts                # 弹幕控制
│   ├── use-subtitle.ts               # 字幕控制 (含流式)
│   ├── use-click-indicator.ts        # 点击指示器
│   ├── use-keystroke.ts              # 按键可视化
│   ├── use-overlay-interaction.ts    # 交互元素控制
│   └── use-global-input.ts           # 全局输入监听
├── types/
│   └── overlay.ts                    # 类型定义
└── components/settings/
    └── settings-overlay.tsx          # 设置组件
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

interface StreamingSubtitleState {
  id: string;
  text: string;
  isStreaming: boolean;
  cursor?: boolean;
  options?: Partial<SubtitleItem>;
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
// 使用 Tauri 风格: CommandOrControl+Shift+O
// Mac 显示为 ⌘⇧O, Windows 显示为 Ctrl+Shift+O
interface OverlayShortcuts {
  toggleOverlay: string;        // 默认 "CommandOrControl+Shift+O"
  toggleDanmaku: string;        // 默认 "CommandOrControl+Shift+D"
  toggleKeystroke: string;      // 默认 "CommandOrControl+Shift+K"
  toggleClickIndicator: string; // 默认 "CommandOrControl+Shift+C"
  toggleSubtitle: string;       // 默认 "CommandOrControl+Shift+S"
}

// === 完整设置 ===
interface OverlaySettings {
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
    show_modifiers_only: boolean;  // 只显示带修饰键的组合
    show_keys: string[];           // 白名单: 额外显示的按键 (如 ["Escape", "Enter"])
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
  streamingSubtitle: StreamingSubtitleState | null;

  // 点击
  clickEnabled: boolean;
  clickStyle: ClickStyle;
  clickEffects: ClickEffect[];

  // 按键
  keystrokeEnabled: boolean;
  keystrokePosition: KeystrokePosition;
  keystrokeItems: KeystrokeItem[];
  keystrokeShowModifiersOnly: boolean;
  keystrokeShowKeys: string[];

  // 交互元素
  interactiveElements: AnyInteractiveElement[];

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

  // 流式字幕
  startStream: (options?: Partial<SubtitleItem>) => string;
  appendStream: (chunk: string) => void;
  finishStream: () => void;
  cancelStream: () => void;

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

  // 交互元素
  addInteractiveElement: (element: AnyInteractiveElement) => void;
  updateInteractiveElement: (id: string, updates: Partial<AnyInteractiveElement>) => void;
  removeInteractiveElement: (id: string) => void;
  clearInteractiveElements: () => void;
}
```

## 配置持久化

### 存储位置

遵循项目 file-native 范式，配置存储在 `~/.viben/overlay.yaml`。

### YAML 配置格式

```yaml
# ~/.viben/overlay.yaml

default_enabled: false
opacity: 1.0

danmaku:
  enabled: true
  max_tracks: 8
  speed: normal      # slow | normal | fast
  font_size: 24
  opacity: 0.9

subtitle:
  enabled: true
  position: bottom   # top | center | bottom
  font_size: 20
  background_color: "rgba(0,0,0,0.7)"
  default_animation: fade  # fade | typewriter | slide

click_indicator:
  enabled: true
  style: ripple      # ripple | spotlight | ring
  color: "#ffffff"
  size: 40

keystroke:
  enabled: true
  position: bottom-right  # top-left | top-right | bottom-left | bottom-right
  show_modifiers_only: true
  show_keys:         # 白名单: 额外显示的按键
    - Escape
    - Enter
    - Tab
  duration: 1500

shortcuts:
  toggle_overlay: "CommandOrControl+Shift+O"
  toggle_danmaku: "CommandOrControl+Shift+D"
  toggle_keystroke: "CommandOrControl+Shift+K"
  toggle_click_indicator: "CommandOrControl+Shift+C"
  toggle_subtitle: "CommandOrControl+Shift+S"
```

### 配置读写

```typescript
// lib/overlay-config.ts
import { readTextFile, writeTextFile, exists, createDir } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";
import * as yaml from "js-yaml";

const CONFIG_PATH = ".viben/overlay.yaml";

export async function loadOverlayConfig(): Promise<OverlaySettings> {
  const home = await homeDir();
  const configPath = `${home}${CONFIG_PATH}`;

  if (await exists(configPath)) {
    const content = await readTextFile(configPath);
    return yaml.load(content) as OverlaySettings;
  }

  return DEFAULT_SETTINGS;
}

export async function saveOverlayConfig(settings: OverlaySettings): Promise<void> {
  const home = await homeDir();
  const vibenDir = `${home}.viben`;
  const configPath = `${home}${CONFIG_PATH}`;

  // 确保目录存在
  if (!(await exists(vibenDir))) {
    await createDir(vibenDir);
  }

  const content = yaml.dump(settings, {
    indent: 2,
    lineWidth: -1,  // 不换行
  });
  await writeTextFile(configPath, content);
}

const DEFAULT_SETTINGS: OverlaySettings = {
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
  shortcuts: {
    toggle_overlay: "CommandOrControl+Shift+O",
    toggle_danmaku: "CommandOrControl+Shift+D",
    toggle_keystroke: "CommandOrControl+Shift+K",
    toggle_click_indicator: "CommandOrControl+Shift+C",
    toggle_subtitle: "CommandOrControl+Shift+S",
  },
};
```

## OverlayProvider 职责

```typescript
// components/overlay/overlay-provider.tsx

interface OverlayContextValue {
  app: Application | null;          // PixiJS Application 实例
  isReady: boolean;                 // 是否初始化完成
  dimensions: { width: number; height: number };
}

/**
 * OverlayProvider 职责:
 * 1. 管理 PixiJS Application 生命周期
 * 2. 处理窗口 resize 事件
 * 3. 加载配置文件并初始化 store
 * 4. 提供 Context 给子组件
 */
export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [app, setApp] = useState<Application | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // 初始化 PixiJS
  useEffect(() => {
    const initPixi = async () => {
      const application = new Application();
      await application.init({
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio,
        autoDensity: true,
        powerPreference: "high-performance",
        width: window.innerWidth,
        height: window.innerHeight,
      });
      setApp(application);
      setIsReady(true);
    };

    initPixi().catch(console.error);

    return () => {
      app?.destroy(true, { children: true });
    };
  }, []);

  // 处理窗口 resize
  useEffect(() => {
    const handleResize = () => {
      const { innerWidth, innerHeight } = window;
      setDimensions({ width: innerWidth, height: innerHeight });
      app?.renderer.resize(innerWidth, innerHeight);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [app]);

  // 加载配置
  useEffect(() => {
    loadOverlayConfig().then(config => {
      useOverlayStore.getState().actions.loadConfig(config);
    });
  }, []);

  // 窗口最小化时暂停渲染
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        app?.ticker.stop();
      } else {
        app?.ticker.start();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [app]);

  return (
    <OverlayContext.Provider value={{ app, isReady, dimensions }}>
      {children}
    </OverlayContext.Provider>
  );
}
```

## 全局事件监听

```typescript
// hooks/use-global-input.ts

export function useGlobalMouseListener() {
  const clickEnabled = useOverlayStore(s => s.clickEnabled);
  const addClickEffect = useOverlayStore(s => s.actions.addClickEffect);
  const removeClickEffect = useOverlayStore(s => s.actions.removeClickEffect);

  // 使用 useCallback 稳定函数引用
  const handleMouseDown = useCallback((e: MouseEvent) => {
    const id = nanoid();
    addClickEffect({
      id,
      x: e.clientX,
      y: e.clientY,
      button: (["left", "right", "middle"] as const)[e.button] ?? "left",
      timestamp: Date.now(),
    });

    setTimeout(() => removeClickEffect(id), PERFORMANCE_LIMITS.clickEffectDuration);
  }, [addClickEffect, removeClickEffect]);

  useEffect(() => {
    if (!clickEnabled) return;

    window.addEventListener("mousedown", handleMouseDown, {
      capture: true,
      passive: true,  // 提高性能
    });
    return () => window.removeEventListener("mousedown", handleMouseDown, { capture: true });
  }, [clickEnabled, handleMouseDown]);
}

export function useGlobalKeyboardListener() {
  const keystrokeEnabled = useOverlayStore(s => s.keystrokeEnabled);
  const showModifiersOnly = useOverlayStore(s => s.keystrokeShowModifiersOnly);
  const showKeys = useOverlayStore(s => s.keystrokeShowKeys);
  const addKeystroke = useOverlayStore(s => s.actions.addKeystroke);
  const removeKeystroke = useOverlayStore(s => s.actions.removeKeystroke);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const hasModifier = e.metaKey || e.ctrlKey || e.altKey || e.shiftKey;
    const isInShowKeys = showKeys.includes(e.key);
    const isSpecial = isSpecialKey(e.key);

    // 过滤逻辑:
    // - showModifiersOnly=true: 只显示有修饰键的组合，或在 showKeys 白名单中的
    // - showModifiersOnly=false: 显示所有按键
    if (showModifiersOnly && !hasModifier && !isInShowKeys) {
      return;
    }

    const id = nanoid();
    addKeystroke({
      id,
      keys: buildKeyCombo(e),
      displayText: formatKeyDisplay(e),
      timestamp: Date.now(),
    });

    setTimeout(() => removeKeystroke(id), PERFORMANCE_LIMITS.keystrokeDuration);
  }, [showModifiersOnly, showKeys, addKeystroke, removeKeystroke]);

  useEffect(() => {
    if (!keystrokeEnabled) return;

    window.addEventListener("keydown", handleKeyDown, {
      capture: true,
      passive: true,
    });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [keystrokeEnabled, handleKeyDown]);
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
  return [
    "Escape", "Enter", "Tab", "Backspace", "Delete",
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
    "Home", "End", "PageUp", "PageDown", "Insert",
  ].includes(key);
}
```

## 性能配置

```typescript
const PERFORMANCE_LIMITS = {
  // 数量限制
  maxDanmakuOnScreen: 500,
  maxClickEffects: 10,
  maxKeystrokeItems: 5,
  maxInteractiveElements: 20,

  // 对象池
  danmakuPoolSize: 200,        // 与 maxDanmakuOnScreen 的比例约 40%

  // 动画时长
  clickEffectDuration: 400,
  keystrokeDuration: 1500,

  // 流式字幕
  streamingCharInterval: 16,   // 约 60fps
};
```

## 错误处理

```typescript
// components/overlay/overlay-canvas.tsx

function OverlayCanvas() {
  const { app, isReady } = useOverlayContext();
  const [error, setError] = useState<Error | null>(null);

  // WebGL 支持检测
  useEffect(() => {
    if (!isWebGLSupported()) {
      setError(new Error("WebGL is not supported in this browser"));
    }
  }, []);

  if (error) {
    // 降级: 不显示 overlay，但不影响主应用
    console.warn("[Overlay] Disabled due to error:", error.message);
    return null;
  }

  if (!isReady || !app) {
    return null;
  }

  return (
    <div
      className="overlay-container"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      {/* PixiJS Canvas */}
      <Stage app={app}>
        <DanmakuLayer />
        <KeystrokeLayer />
        <ClickIndicatorLayer />
        <SubtitleLayer />
      </Stage>

      {/* DOM 交互层 */}
      <OverlayInteractive />
    </div>
  );
}

function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
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

### Settings 页面集成

Settings 子路由使用 `element={null}` 是现有模式，具体渲染逻辑在 `SettingsPage` 组件内部通过 `useLocation` 判断。

新增 `settings-overlay.tsx` 组件，在 `SettingsPage` 中根据路由条件渲染：

```tsx
// pages/settings.tsx
import { SettingsOverlay } from "@/components/settings/settings-overlay";

function SettingsPage() {
  const location = useLocation();

  // ... existing sidebar

  return (
    <div>
      {/* sidebar */}
      <div className="content">
        {location.pathname === "/settings/overlay" && <SettingsOverlay />}
        {/* ... other settings */}
      </div>
    </div>
  );
}
```

## 依赖变更

```json
// package.json 新增
{
  "dependencies": {
    "pixi.js": "^8.0.0",
    "@pixi/react": "^8.0.0",
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9"
  }
}
```

## 文件变更清单

| 操作 | 文件路径 |
|------|----------|
| 新增 | `src/components/overlay/index.ts` |
| 新增 | `src/components/overlay/overlay-canvas.tsx` |
| 新增 | `src/components/overlay/overlay-provider.tsx` |
| 新增 | `src/components/overlay/overlay-interactive.tsx` |
| 新增 | `src/components/overlay/layers/danmaku-layer.tsx` |
| 新增 | `src/components/overlay/layers/subtitle-layer.tsx` |
| 新增 | `src/components/overlay/layers/click-indicator-layer.tsx` |
| 新增 | `src/components/overlay/layers/keystroke-layer.tsx` |
| 新增 | `src/components/overlay/elements/danmaku-item.tsx` |
| 新增 | `src/components/overlay/elements/subtitle-box.tsx` |
| 新增 | `src/components/overlay/elements/streaming-subtitle.tsx` |
| 新增 | `src/components/overlay/elements/click-ripple.tsx` |
| 新增 | `src/components/overlay/elements/key-badge.tsx` |
| 新增 | `src/components/overlay/interactive/overlay-button.tsx` |
| 新增 | `src/components/overlay/interactive/overlay-button-group.tsx` |
| 新增 | `src/components/overlay/interactive/overlay-choice-list.tsx` |
| 新增 | `src/components/overlay/interactive/overlay-multi-select.tsx` |
| 新增 | `src/components/overlay/interactive/overlay-voice-input.tsx` |
| 新增 | `src/components/overlay/interactive/overlay-text-input.tsx` |
| 新增 | `src/stores/overlay-store.ts` |
| 新增 | `src/hooks/use-overlay.ts` |
| 新增 | `src/hooks/use-danmaku.ts` |
| 新增 | `src/hooks/use-subtitle.ts` |
| 新增 | `src/hooks/use-click-indicator.ts` |
| 新增 | `src/hooks/use-keystroke.ts` |
| 新增 | `src/hooks/use-overlay-interaction.ts` |
| 新增 | `src/hooks/use-global-input.ts` |
| 新增 | `src/types/overlay.ts` |
| 新增 | `src/lib/overlay-config.ts` |
| 新增 | `src/components/settings/settings-overlay.tsx` |
| 修改 | `src/App.tsx` |
| 修改 | `src/pages/settings.tsx` |
| 修改 | `src/pages/index.ts` |
| 修改 | `package.json` |
