# @viben/os 总体架构设计

> iPad/车机风格操作系统 UI，基于 Three.js WebGPU 全量 GPU 渲染

## 1. 概述

### 1.1 目标

在浏览器中构建一个类 iPad/小米车机风格的操作系统 UI。全屏 App 为主，手势驱动导航，GPU 全量渲染（不依赖 DOM），作为 `apps/desktop` 的独立页面（`/os` 路由）。

### 1.2 设计原则

- **全量 GPU 渲染**：所有 UI 元素通过 Three.js WebGPU 渲染，不使用 DOM（除隐藏 textarea 用于 IME 输入）
- **前后端解耦**：`@viben/os` 纯前端逻辑，`@viben/os-bridge` 独立包处理后端集成
- **iPad 交互范式**：全屏 App、有限分屏、手势导航、Spring 物理动画
- **插件式 App**：App 通过注册 API 接入，使用 OS 提供的 UI 组件库构建界面
- **按需渲染**：静态时不消耗 GPU，仅在变化或动画时渲染

### 1.3 核心技术栈

| 层面 | 技术选型 | 理由 |
|------|---------|------|
| 渲染引擎 | Three.js r175+ WebGPURenderer | 成熟的 WebGPU 封装，fallback WebGL |
| 布局引擎 | yoga-wasm-web | React Native 同款 Flexbox，久经考验 |
| 文字渲染 | troika-three-text | 运行时加载任意字体，完美 CJK 支持 |
| 图形着色 | TSL (Three Shading Language) | 圆角矩形/毛玻璃/阴影，WebGPU+WebGL 双编译 |
| 物理动画 | 自建 Spring Animator | iOS 风格弹性动画 |
| 文字输入 | 隐藏 DOM textarea | 原生 IME/剪贴板/中文输入法支持 |
| 窗口合成 | Render-to-Texture | 每窗口独立 RTT，脏标记按需渲染 |
| 构建工具 | tsup | ESM + CJS + DTS，与项目其他包一致 |

## 2. 架构分层

```
┌─────────────────────────────────────────────────────────────────┐
│  apps/desktop        Route: /os (全屏 Canvas)                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ OsPage.tsx (React 薄壳)                                    │ │
│  │  • 挂载 canvas + 隐藏 textarea (IME 输入)                   │ │
│  │  • 调用 @viben/os 的 boot() 函数                            │ │
│  │  • 传入 @viben/os-bridge 的 adapter 实例                    │ │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  @viben/os  (纯 TS，零 React 依赖)                               │
│                                                                 │
│  Layer 5: OS Shell                                              │
│    Desktop · Dock · 通知中心 · 控制中心 · Spotlight               │
│    设置面板 · 壁纸管理 · 锁屏 · 多任务视图 · 启动动画             │
│                                                                 │
│  Layer 4: App Framework                                         │
│    ProcessManager (PID) · App 注册 API · 生命周期                │
│    App 间通信 (IPC EventBus) · VFS 虚拟文件系统                   │
│    NavigationStack (App 内页面导航)                               │
│    内置 App: 文件管理器 · 设置 · 终端 · 便签                      │
│                                                                 │
│  Layer 3: Scene Compositor                                      │
│    布局状态机 (HOME/FULLSCREEN/SPLIT/SLIDE_OVER/MULTITASK)       │
│    RTT 窗口合成 · Spring 过渡动画 · 毛玻璃特效                    │
│    系统手势路由 · 多任务卡片视图                                   │
│                                                                 │
│  Layer 2: UI Kit                                                │
│    Yoga WASM 布局 · troika 文字 · TSL 图形原语                   │
│    组件: Button·Input·ScrollView·List·Modal·Toggle·Slider        │
│    主题系统 · Spring 动画系统 · 图标系统                          │
│                                                                 │
│  Layer 1: Render Engine                                         │
│    Three.js WebGPURenderer (fallback WebGLRenderer)              │
│    OrthographicCamera · Raycaster 事件 · RTT 池                  │
│    按需渲染调度 · 资源加载 · 手势识别                              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  @viben/os-bridge  (独立包，后端集成)                             │
│    VFS Adapters: local (Gateway API) · indexeddb · memory        │
│    Agent 通信 · Session 管理 · 通知推送 · 设置同步                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 3. 交互模型

### 3.1 iPad/车机风格（非自由窗口）

本 OS 采用 iPad/小米车机的交互范式，不支持自由窗口拖拽：

- **全屏模式**（默认）：App 占满整个屏幕
- **分屏模式**：左右 50/50 或 30/70
- **Slide Over**：小窗悬浮在右侧
- **画中画**：小浮窗固定在角落

### 3.2 手势系统

| 手势 | 触发区域 | 动作 |
|------|---------|------|
| 底部上滑 | 屏幕底部 Home Indicator | 回到主屏幕 |
| 底部上滑暂停 | 屏幕底部 | 进入多任务视图 |
| 底部左右滑 | Home Indicator 区域 | 快速切换上一个 App |
| 右上角下滑 | 屏幕右上角 | 控制中心 |
| 顶部下滑 | 屏幕顶部 | 通知中心 |
| App 内边缘右滑 | 屏幕左边缘 | 返回上一页 |
| 长按 | 主屏幕图标 | 编辑模式 / 上下文菜单 |

### 3.3 动画过渡

所有动画使用 Spring 物理驱动（非线性 Tween），操作 RTT 纹理四边形的 transform：

- **App 启动**：从图标位置缩放展开至全屏（~300ms）
- **App 关闭**：从全屏缩回图标位置
- **分屏进入**：右侧滑入，主 App 缩到左半边
- **多任务视图**：所有 App 缩小为 3D 透视卡片
- **通知/控制中心**：毛玻璃面板从顶部/右上角滑入
- **页面推入**：App 内子页面从右侧推入（iOS Navigation 风格）

## 4. 场景图结构

```
Scene (root)
│
├── WallpaperLayer (z=0)
│   └── Mesh (全屏 Plane + 壁纸纹理)
│
├── HomeScreenLayer (z=1)        ← 主屏幕（显示/隐藏切换）
│   ├── AppGrid (Group)           App 图标网格
│   │   ├── AppIcon_0 (Group)     背景圆角矩形 + 图标纹理 + 文字
│   │   └── ...
│   ├── PageDots (Group)          页面指示器
│   └── SearchBar (Group)         Spotlight 搜索入口
│
├── AppLayer (z=2)               ← App 内容层
│   ├── PrimaryApp (Mesh)         全屏/左半屏 App 的 RTT 四边形
│   ├── SecondaryApp (Mesh)       分屏右侧 App
│   ├── SlideOverApp (Mesh)       Slide Over 小窗
│   └── PIPApp (Mesh)             画中画小窗
│
├── MultitaskLayer (z=5)         ← 多任务视图
│   ├── AppCard_0 (Mesh)          RTT 快照卡片
│   └── ...
│
├── OverlayLayer (z=10)          ← 覆盖层
│   ├── NotificationCenter
│   ├── ControlCenter
│   ├── ContextMenu
│   └── AlertDialog
│
├── DockLayer (z=15)             ← Dock 栏
│   └── Dock (Group)
│
└── StatusBarLayer (z=20)        ← 状态栏
    └── StatusBar (Group)
```

每个 App 拥有独立的 RTT Scene（独立 Scene + OrthographicCamera），内容渲染到 OffscreenRenderTarget，主场景通过纹理四边形合成。

## 5. 数据流

### 5.1 输入管线

```
Canvas DOM Events → GestureRecognizer → EventRouter → 目标组件
(pointer/wheel/key)  (tap/drag/swipe/    (系统手势优先,
                      pinch/long-press)   然后分发到 App)

Hidden textarea → IME Compositor → 聚焦的 TextInput
(键盘输入/中文输入法)
```

### 5.2 状态管理

```
SceneCompositor (状态机)          ProcessManager
  mode: HOME|FULLSCREEN|          processes: [{pid, app, state}]
        SPLIT|SLIDE_OVER|         focused: pid
        MULTITASK|CONTROL_CENTER
  primary: pid
  secondary: pid
         ↓                              ↓
  AnimationScheduler              App Lifecycle
  (Spring 物理动画)               (mount/focus/blur/destroy)
```

### 5.3 渲染管线

1. **脏 App RTT 重渲染**：遍历所有脏 App，对每个 App 设置 RenderTarget 并渲染其 Scene
2. **主场景合成**：将 RenderTarget 置 null，渲染主场景（壁纸 + RTT 四边形 + Dock + 状态栏 + 覆盖层）
3. **按需调度**：若 dirty 或 animating 则 requestAnimationFrame，否则休眠等待 markDirty()

### 5.4 Scene Compositor 状态机

```
                  ┌─────────┐
       ┌──────────│  HOME   │──────────┐
       │          └────┬────┘          │
       │               │               │
  点击 App 图标    底部上滑暂停    右上角下滑
       │               │               │
       ▼               ▼               ▼
  ┌──────────┐   ┌──────────┐   ┌───────────┐
  │FULLSCREEN│   │MULTITASK │   │  CONTROL  │
  └────┬─────┘   └────┬─────┘   │  CENTER   │
       │               │        └───────────┘
  ┌────┴────┐     点击卡片
  │         │          │
拖入分屏  Slide Over   │
  │         │          │
  ▼         ▼          │
┌───────┐ ┌────────┐   │
│ SPLIT │ │ SLIDE  │   │
│       │ │ OVER   │   │
└───────┘ └────────┘   │
  │                     │
  └─────────────────────┘
       底部上滑 → HOME
```

## 6. 包结构

### 6.1 @viben/os

```
packages/os/
  src/
    engine/                    # Layer 1: Render Engine
      renderer.ts               WebGPU/WebGL 初始化 + resize
      render-scheduler.ts       按需渲染 + 动画循环
      rtt-pool.ts               OffscreenRenderTarget 管理
      event-system.ts           Raycaster + 冒泡/捕获
      gesture-recognizer.ts     tap/drag/swipe/long-press 识别
      input-manager.ts          隐藏 textarea + IME + 键盘路由
      resource-loader.ts        纹理/字体/图标异步加载
      index.ts

    ui/                        # Layer 2: UI Kit
      layout/
        yoga-bridge.ts          Yoga WASM ↔ Three.js 同步
        index.ts
      text/
        text-renderer.ts        troika-three-text 封装
        index.ts
      primitives/
        box.ts                  TSL 圆角矩形/阴影/渐变
        image.ts                图片显示
        icon.ts                 图标(Atlas)
        index.ts
      components/
        button.ts
        text-input.ts
        toggle.ts
        slider.ts
        scroll-view.ts
        list.ts
        modal.ts
        navigation-bar.ts
        tab-bar.ts
        index.ts
      theme/
        theme-manager.ts        主题 Token + 暗/亮切换
        default-theme.ts
        index.ts
      animation/
        spring.ts               Spring 物理动画
        tween.ts                基础缓动
        keyframe.ts             关键帧动画
        index.ts
      index.ts

    compositor/                # Layer 3: Scene Compositor
      scene-compositor.ts       布局状态机
      app-slot.ts               RTT 四边形 + 动画状态
      transition-engine.ts      模式切换 Spring 动画
      gesture-router.ts         系统手势拦截 + 分发
      blur-effect.ts            TSL Gaussian Blur
      multitask-view.ts         3D 透视卡片视图
      index.ts

    app/                       # Layer 4: App Framework
      process-manager.ts        PID 分配/生命周期
      app-registry.ts           App 注册 API
      app-host.ts               RTT Scene 创建 + UI 容器
      navigation-stack.ts       App 内页面导航
      ipc-bus.ts                App 间通信
      os-context.ts             App 可访问的 OS API
      index.ts

    shell/                     # Layer 5: OS Shell
      home-screen.ts            App 图标网格 + 多页 + 文件夹
      dock.ts                   底部 Dock
      status-bar.ts             顶部状态栏
      notification-center.ts    通知面板
      control-center.ts         控制中心
      spotlight.ts              全局搜索
      lock-screen.ts            锁屏
      boot-animation.ts         启动动画
      index.ts

    apps/                      # 内置 App
      file-manager/
      settings/
      terminal/
      notes/

    types.ts                   # 公共类型定义
    index.ts                   # boot() 入口

  assets/
    fonts/                     # 默认字体 (.woff2)
    icons/                     # 图标 Atlas
    wallpapers/                # 默认壁纸

  package.json                 # @viben/os
  tsconfig.json
  tsup.config.ts
```

### 6.2 @viben/os-bridge

```
packages/os-bridge/
  src/
    vfs/
      types.ts                  VFS 接口定义
      local-adapter.ts          Gateway API 文件操作
      indexeddb-adapter.ts      浏览器持久化存储
      memory-adapter.ts         内存文件系统
      vfs.ts                    VFS 路由 (URI scheme)
      index.ts
    gateway/
      client.ts                 Gateway HTTP API 封装
      index.ts
    agent/
      agent-client.ts           Agent 启动/对话/状态
      index.ts
    settings/
      settings-sync.ts          OS 设置持久化
      index.ts
    notification/
      notification-stream.ts    WebSocket 实时通知
      index.ts
    types.ts
    index.ts

  package.json                 # @viben/os-bridge
  tsconfig.json
  tsup.config.ts
```

## 7. 关键接口定义

### 7.1 OS Boot API

```typescript
// @viben/os 入口
export interface OsBootConfig {
  canvas: HTMLCanvasElement;
  textarea: HTMLTextAreaElement;     // 隐藏的 IME textarea
  width: number;
  height: number;
  bridge?: OsBridge;                // 可选后端集成
  apps?: AppManifest[];             // 额外注册的 App
  theme?: 'light' | 'dark';
  wallpaper?: string;               // 壁纸 URL
  locale?: string;
}

export async function boot(config: OsBootConfig): Promise<OsInstance>;

export interface OsInstance {
  resize(width: number, height: number): void;
  registerApp(manifest: AppManifest): void;
  getProcessManager(): ProcessManager;
  getThemeManager(): ThemeManager;
  destroy(): void;
}
```

### 7.2 App 注册 API

```typescript
export interface AppManifest {
  id: string;                        // 唯一标识 "com.viben.files"
  name: string;                      // 显示名称
  icon: string;                      // 图标 URL
  category?: string;                 // 分类
  supportsSplit?: boolean;           // 是否支持分屏
  supportsPIP?: boolean;             // 是否支持画中画
  create: (host: AppHost) => App;    // App 工厂函数
}

export interface App {
  onMount(container: UIContainer): void;
  onUnmount(): void;
  onFocus(): void;
  onBlur(): void;
  onResize(width: number, height: number): void;
  onDestroy(): void;
}

export interface AppHost {
  readonly pid: number;
  readonly navigation: NavigationStack;
  readonly os: OSContext;
  markDirty(): void;                 // 请求重渲染
}
```

### 7.3 OS Context（App 可访问的 OS API）

```typescript
export interface OSContext {
  readonly vfs: VFS;                 // 虚拟文件系统
  readonly theme: ThemeManager;
  readonly notifications: NotificationAPI;
  readonly settings: SettingsAPI;
  readonly ipc: IPCBus;

  openApp(appId: string): void;
  closeApp(pid: number): void;
  showAlert(config: AlertConfig): Promise<boolean>;
}
```

### 7.4 VFS 接口

```typescript
export interface VFS {
  readFile(uri: string): Promise<Uint8Array>;
  writeFile(uri: string, data: Uint8Array): Promise<void>;
  readdir(uri: string): Promise<FileEntry[]>;
  stat(uri: string): Promise<FileStat>;
  mkdir(uri: string): Promise<void>;
  unlink(uri: string): Promise<void>;
  copy(src: string, dst: string): Promise<void>;
  move(src: string, dst: string): Promise<void>;
}

// URI scheme: "local:/Documents/file.txt", "memory:/tmp/draft"
export interface VFSAdapter {
  readonly scheme: string;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  readdir(path: string): Promise<FileEntry[]>;
  stat(path: string): Promise<FileStat>;
  mkdir(path: string): Promise<void>;
  unlink(path: string): Promise<void>;
}
```

### 7.5 Bridge 接口

```typescript
// @viben/os-bridge 入口
export interface OsBridge {
  readonly vfs: VFSAdapter;          // local:/ 适配器
  readonly agent: AgentClient;
  readonly settings: SettingsSync;
  readonly notifications: NotificationStream;
}

export function createBridge(gatewayUrl: string): Promise<OsBridge>;
```

## 8. Desktop 集成

在 `apps/desktop` 中作为独立路由页面：

```typescript
// apps/desktop/src/pages/OsPage.tsx
import { boot } from '@viben/os';
import { createBridge } from '@viben/os-bridge';

export function OsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let os: OsInstance;
    (async () => {
      const bridge = await createBridge('http://127.0.0.1:18790');
      os = await boot({
        canvas: canvasRef.current!,
        textarea: textareaRef.current!,
        width: window.innerWidth,
        height: window.innerHeight,
        bridge,
        theme: 'dark',
      });
    })();
    return () => os?.destroy();
  }, []);

  return (
    <>
      <canvas ref={canvasRef} style={{ width: '100vw', height: '100vh' }} />
      <textarea ref={textareaRef} style={{ position: 'fixed', opacity: 0, pointerEvents: 'none' }} />
    </>
  );
}
```

路由配置：在 `App.tsx` 中添加 `/os` 路由。

## 9. 子项目拆分

### 9.1 依赖关系

```
Sub 6: OS Shell ← Sub 4, 5
Sub 5: 内置 App ← Sub 4
Sub 4: App Framework ← Sub 2, 3
Sub 3: Scene Compositor ← Sub 1, 2
Sub 3b: Bridge (可并行) — 独立包
Sub 2: UI Kit ← Sub 1
Sub 1: Render Engine — 基础层
```

### 9.2 Sub 1: Render Engine

**范围**：Three.js WebGPU 初始化、事件系统、RTT 管理、渲染调度、手势识别、IME 输入

**核心模块**：
- `Renderer` — WebGPURenderer 初始化 + WebGL fallback + resize
- `RenderScheduler` — 按需渲染 + 动画连续循环 + markDirty()
- `RTTPool` — OffscreenRenderTarget 创建/回收/resize
- `EventSystem` — Raycaster + 冒泡/捕获
- `GestureRecognizer` — tap/drag/swipe/long-press 识别
- `InputManager` — 隐藏 textarea + IME 合成 + 键盘路由
- `ResourceLoader` — 纹理/字体/图标异步加载 + 缓存

**验证标准**：渲染一个可交互的彩色方块 + FPS 显示 + RTT 预览 + 手势识别日志

### 9.3 Sub 2: UI Kit

**范围**：Yoga 布局引擎、troika 文字渲染、UI 组件库、主题系统、动画系统

**核心模块**：
- `LayoutEngine` — Yoga WASM 封装，Yoga Node ↔ Three.js Object3D 同步
- `TextRenderer` — troika-three-text 封装，字体预加载
- `Primitives` — Box (TSL 圆角矩形/阴影) · Image · Icon
- `Components` — Button · TextInput · Toggle · Slider · ScrollView · List · Modal · NavigationBar · TabBar
- `ThemeSystem` — 颜色/字体/间距 Token，暗/亮主题
- `AnimationSystem` — Spring 物理 + Tween + 关键帧

**验证标准**：组件 Storybook — 所有组件展示 + 滚动 + 中文输入 + 主题切换

### 9.4 Sub 3: Scene Compositor

**范围**：布局状态机、RTT 窗口合成、过渡动画、系统手势路由、毛玻璃效果

**核心模块**：
- `SceneCompositor` — 状态机 (HOME/FULLSCREEN/SPLIT/SLIDE_OVER/MULTITASK/CONTROL_CENTER)
- `AppSlot` — RTT 四边形 + Spring 动画 (位置/缩放/透明度/圆角)
- `TransitionEngine` — 模式切换动画
- `GestureRouter` — 系统手势拦截（底部上滑/边缘滑动）+ 分发
- `BlurEffect` — TSL Gaussian Blur
- `MultitaskView` — 3D 透视卡片 + 滚动 + 上滑关闭

**验证标准**：3 个彩色 dummy App，全部手势和动画过渡可用

### 9.5 Sub 3b: Bridge (@viben/os-bridge)

**范围**：VFS 虚拟文件系统、Gateway API 对接、Agent 通信、设置同步

**核心模块**：
- `VFS` — 虚拟文件系统 (适配器模式: local/indexeddb/memory)
- `GatewayAdapter` — 对接 Viben Gateway HTTP API
- `AgentClient` — Agent 启动/对话/状态查询
- `SettingsSync` — OS 设置持久化到 Gateway
- `NotificationStream` — WebSocket 实时通知

**验证标准**：单元测试 + Gateway API 集成测试

### 9.6 Sub 4: App Framework

**范围**：进程管理、App 注册、App 宿主环境、页面导航、IPC 通信

**核心模块**：
- `ProcessManager` — PID 分配/管理/生命周期 (launch/suspend/destroy)
- `AppRegistry` — App 注册 API (manifest + factory)
- `AppHost` — 为每个 App 创建独立 RTT Scene + Camera + UI 容器
- `NavigationStack` — App 内页面导航 (push/pop/replace + 过渡动画)
- `IPCBus` — App 间通信 (EventBus + 请求/响应模式)
- `OSContext` — App 可访问的 OS API (VFS/通知/设置/主题)

**验证标准**：编写一个 "Hello World" App，展示导航、VFS 读写、发送通知

### 9.7 Sub 5: 内置 App

**范围**：4 个内置应用，验证 App Framework 的完整性

- **FileManager** — 文件浏览 · 预览 · CRUD（对接 VFS）
- **Settings** — 壁纸/主题/字体/关于
- **Terminal** — GPU 渲染终端模拟器（对接 Bridge shell）
- **Notes** — 简单便签（验证文字输入 + 持久化）

**验证标准**：4 个 App 全部可用，支持分屏

### 9.8 Sub 6: OS Shell

**范围**：完整 OS 外壳体验

- **HomeScreen** — App 图标网格 · 多页滑动 · 文件夹 · 搜索
- **Dock** — 常驻底部 · 最近 App · 弹跳动画
- **StatusBar** — 时间 · 电量 · 网络
- **NotificationCenter** — 通知列表 · 分组 · 清除
- **ControlCenter** — 快捷开关网格 · 亮度/音量
- **Spotlight** — 全局搜索 (App/文件/设置)
- **LockScreen** — 时间 · 通知预览 · 滑动解锁
- **BootAnimation** — 启动动画 (Logo + 进度)

**验证标准**：完整 OS 体验，从启动动画到使用 App 到锁屏

## 10. 性能策略

| 策略 | 描述 |
|------|------|
| 按需渲染 | 静态时不调用 requestAnimationFrame，仅在 markDirty() 时触发 |
| RTT 脏标记 | 仅重渲染内容变化的 App 的 RTT |
| 对象池 | ScrollView/List 的可见行复用 |
| 纹理 Atlas | 图标打包为单张 Atlas 减少 draw call |
| Stencil 裁剪 | ScrollView 使用 stencil buffer 裁剪溢出内容 |
| devicePixelRatio 上限 | 限制为 2，避免 Retina 3x 的性能浪费 |
| Yoga 批量更新 | 收集所有布局变更后一次性 calculateLayout() |

## 11. 最佳实践来源

| 实践 | 来源项目 |
|------|---------|
| Render-to-Texture 窗口 | Unreal UMG, Flutter Impeller |
| Yoga WASM 布局 | React Native, @react-three/uikit |
| troika-three-text | react-three-fiber 生态, Mapbox |
| 隐藏 textarea IME | @react-three/uikit, Zed GPUI |
| Process/PID 模型 | daedalOS, OS.js |
| VFS 适配器模式 | OS.js VFS |
| 按需渲染 + 脏标记 | Zed GPUI, Flutter |
| Stencil 裁剪滚动 | @react-three/uikit |
| Spring 物理动画 | iOS UIKit, react-spring |
