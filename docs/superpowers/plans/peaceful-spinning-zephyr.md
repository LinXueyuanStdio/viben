# 引入第三方截图库，实现复杂截图

## Context

当前截图功能仅支持全屏截图和隐藏窗口截图（使用 `screenshots` crate v0.8），无区域选择、无窗口截图、无标注功能。用户需要类似微信/QQ 截图的完整体验。

## 第三方库选型

| 层级 | 库 | 用途 | Stars |
|------|-----|------|-------|
| Rust 后端 | **`tauri-plugin-screenshots`** v2.2.0 (ayangweb) | 窗口枚举 + 窗口/显示器截图 | 137 |
| JS 前端 | **`region-screenshot-js`** (weijun-lab) | 区域选择 + 标注工具（矩形、圆、箭头、文字、马赛克、画笔） | 52 |

### 为什么选这两个库

- `tauri-plugin-screenshots`：专为 Tauri v2 设计，提供 `getScreenshotableWindows()` + `getWindowScreenshot(id)` + `getMonitorScreenshot(id)`，底层用 `xcap` crate，比当前 `screenshots` crate 更强（支持窗口级截图）
- `region-screenshot-js`：一体化的 web 端选区截图+标注插件，内置矩形、圆形、箭头、文字、画笔、马赛克 6 种工具，支持自定义扩展，中文作者维护

## 架构设计

```
用户触发截图 (快捷键/按钮)
     │
     ▼
┌─────────────────────────────────┐
│  Rust: tauri-plugin-screenshots │
│  - 隐藏主窗口                    │
│  - 截取全屏 (getMonitorScreenshot)│
│  - 保存到临时文件                 │
│  - 创建全屏 overlay 窗口          │
└────────────┬────────────────────┘
             ▼
┌─────────────────────────────────┐
│  Overlay Window (全屏无边框)      │
│  /screenshot-overlay 路由         │
│                                  │
│  1. 加载截图作为全屏背景 <img>     │
│  2. 初始化 region-screenshot-js   │
│     - 区域选择 (拖拽矩形)         │
│     - 标注工具栏                  │
│  3. 用户确认 → base64 结果        │
│  4. Tauri event 发送回主窗口       │
│  5. 关闭 overlay，恢复主窗口       │
└─────────────────────────────────┘
```

### region-screenshot-js 在 Tauri 中的工作原理

`region-screenshot-js` 核心依赖 WebRTC `getDisplayMedia` 获取屏幕画面。在 Tauri WKWebView 中 `getDisplayMedia` 不可用时，它 fallback 到 `dom-to-image` 捕获页面 DOM。我们的 overlay 页面只有一个全屏 `<img>` 显示 Rust 截取的屏幕图片，所以 `dom-to-image` fallback 捕获的就是我们的截图，效果等同于直接操作截图。

## 实现步骤

### Phase 1: 集成 tauri-plugin-screenshots（替换 screenshots crate）

**修改文件：**
- `apps/desktop/src-tauri/Cargo.toml` — 添加 `tauri-plugin-screenshots`，移除 `screenshots`
- `apps/desktop/src-tauri/src/lib.rs` — 注册 `.plugin(tauri_plugin_screenshots::init())`
- `apps/desktop/src-tauri/capabilities/desktop.json` — 添加 `"screenshots:default"` 权限
- `apps/desktop/package.json` — 添加 `tauri-plugin-screenshots-api`

**迁移 Rust 命令：**
- `apps/desktop/src-tauri/src/commands/screenshot.rs` — 用 plugin API 重写 `take_screenshot` 和 `take_screenshot_region`，新增：
  - `list_windows` — 列出可截图的窗口
  - `take_window_screenshot` — 截取指定窗口
  - `take_monitor_screenshot` — 截取指定显示器，保存到临时文件并返回路径

### Phase 2: 创建截图 overlay 窗口

**新建文件：**
- `apps/desktop/src/pages/screenshot-overlay/index.tsx` — 截图 overlay 页面组件
- `apps/desktop/src/pages/screenshot-overlay/screenshot-overlay.css` — overlay 专用样式（全屏、无滚动条、隐藏光标等）

**修改文件：**
- `apps/desktop/src/App.tsx` — 添加 `/screenshot-overlay` 路由
- `apps/desktop/src/pages/index.ts` — 导出 ScreenshotOverlayPage
- `apps/desktop/src-tauri/tauri.conf.json` — 无需静态配置 overlay 窗口（动态创建）

**Overlay 页面逻辑：**
```tsx
// 伪代码
1. 页面加载时，通过 URL query 或 Tauri event 获取截图文件路径
2. 将截图显示为全屏背景 <img>
3. 初始化 region-screenshot-js:
   new RegionScreenshot({
     maskColor: 'rgba(0,0,0,0.5)',
     regionColor: '#409eff',
     // 标注工具配置
   })
4. 监听 screenshotGenerated 事件 → 获取 base64
5. 通过 Tauri event emit 发送结果到主窗口
6. 关闭 overlay 窗口
```

### Phase 3: Rust 端创建/关闭 overlay 窗口

**修改文件：**
- `apps/desktop/src-tauri/src/commands/screenshot.rs` — 新增命令：
  - `start_region_screenshot` — 截全屏 → 保存临时文件 → 创建 overlay 窗口（fullscreen, decorations=false, always_on_top=true, transparent=false）
  - `close_screenshot_overlay` — 关闭 overlay 窗口并清理临时文件

### Phase 4: 更新前端截图调用入口

**修改文件：**
- `apps/desktop/src/hooks/use-screenshot.ts` — 新增方法：
  - `startRegionScreenshot()` — 调用 `start_region_screenshot` 命令
  - `startWindowScreenshot(windowId)` — 截取指定窗口
  - 监听 Tauri event `screenshot-result` 接收 overlay 返回的结果
- `apps/desktop/src/components/overlay/chat-popup.tsx` — 更新截图下拉菜单，增加选项：
  - 直接截图（现有）
  - 隐藏窗口截图（现有）
  - **区域截图**（新增，调用 `startRegionScreenshot`）
  - **窗口截图**（新增，弹出窗口列表选择）
- `apps/desktop/src/pages/conversation/components/desktop-chat-input.tsx` — 同步更新截图选项

### Phase 5: 安装依赖 & 调通

```bash
# Rust 依赖
cd apps/desktop/src-tauri
cargo add tauri-plugin-screenshots

# JS 依赖
cd apps/desktop
pnpm add tauri-plugin-screenshots-api region-screenshot-js
```

## 关键文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src-tauri/Cargo.toml` | 修改 | 添加 tauri-plugin-screenshots，移除 screenshots |
| `src-tauri/src/lib.rs` | 修改 | 注册 plugin |
| `src-tauri/src/commands/screenshot.rs` | 重写 | 用 plugin API 替代手写截图命令 |
| `src-tauri/capabilities/desktop.json` | 修改 | 添加 screenshots 权限 |
| `src/pages/screenshot-overlay/index.tsx` | **新建** | overlay 页面（region-screenshot-js 集成） |
| `src/pages/screenshot-overlay/screenshot-overlay.css` | **新建** | overlay 样式 |
| `src/App.tsx` | 修改 | 添加路由 |
| `src/pages/index.ts` | 修改 | 导出新页面 |
| `src/hooks/use-screenshot.ts` | 修改 | 新增区域/窗口截图方法 |
| `src/components/overlay/chat-popup.tsx` | 修改 | 更新截图菜单选项 |
| `src/pages/conversation/components/desktop-chat-input.tsx` | 修改 | 同步更新 |
| `package.json` | 修改 | 添加 JS 依赖 |

## 验证方式

1. **全屏截图**：点击"直接截图" → 截图出现在聊天附件中
2. **区域截图**：点击"区域截图" → overlay 窗口全屏显示 → 拖拽选区 → 使用标注工具 → 确认 → 截图出现在聊天附件中
3. **窗口截图**：点击"窗口截图" → 选择窗口 → 截图出现在聊天附件中
4. **标注功能**：在区域截图中使用矩形、箭头、文字、马赛克等工具
5. 运行 `pnpm typecheck` 确保无类型错误
