# Workspace Pages 协议设计

> 为 Viben Desktop 工作空间添加自定义页面功能，支持静态页面、Markdown 页面、开发服务器和代理页面。包含全局 Tab 管理系统。

## 概述

在工作空间根目录下，`pages/` 文件夹用于存放自定义页面。每个页面是一个包含 `SKILL.md` 文件的子目录，Desktop 应用会在左侧边栏展示这些页面，右侧提供类似浏览器的视图来渲染页面内容。

## 目录结构

```
<workspace>/
└── pages/
    ├── my-dashboard/
    │   ├── SKILL.md              # 核心配置文件（必需）
    │   └── index.html            # 页面入口
    ├── admin-panel/
    │   ├── SKILL.md
    │   ├── package.json
    │   ├── src/
    │   └── ...
    └── docs-viewer/
        └── SKILL.md              # proxy 类型只需配置文件
```

## SKILL.md Schema

`SKILL.md` 是识别页面的唯一核心文件，使用 YAML frontmatter 定义配置。

### 通用字段

```yaml
---
page:
  type: static | markdown | server | proxy   # 页面类型（必填）
  permission: [read, write]       # 权限列表
name: "页面名称"                   # 显示名称（必填）
description: "页面描述"            # 鼠标悬停显示
icon: "file-text"                 # 页面图标（可选，用于 Tab 显示）
---
Markdown 内容（页面详细说明）
```

### Static 类型

直接提供静态 HTML 文件。

```yaml
---
page:
  type: static
  file: index.html                # 入口文件，相对于页面目录（必填）
  permission: [read, write]
name: "静态页面"
description: "一个简单的静态 HTML 页面"
---
```

### Markdown 类型

直接渲染 SKILL.md 的内容，不需要额外文件。**只能渲染 SKILL.md，无法切换到其他视图**。

```yaml
---
page:
  type: markdown
  permission: [read, write]
name: "文档页面"
description: "直接渲染 Markdown 内容"
icon: "book-open"                 # 可选图标
---

# 这是页面标题

这里的 Markdown 内容将直接渲染为页面。

- 支持标准 Markdown 语法
- 代码高亮
- 表格等

适用场景：
- 项目文档
- API 说明
- 操作指南
```

**特点**：
- 无需 `file` 字段，直接使用 SKILL.md 的 markdown body
- 渲染时只有单一视图（不显示 Preview/Live 切换按钮）
- 最轻量的页面类型

### Server 类型

启动本地开发服务器。

```yaml
---
page:
  type: server
  command: "pnpm dev"             # 启动命令（必填）
  port: 3000                      # 端口（可选，不填则自动分配）
  ready_pattern: "ready in"       # 控制台输出匹配，表示服务就绪（可选）
  timeout: 300                    # 闲置超时秒数，默认 300（可选）
  permission: [read, write]
name: "React 应用"
description: "开发中的 React 项目"
---
```

### Proxy 类型

反向代理到外部 URL。

```yaml
---
page:
  type: proxy
  url: "https://example.com"      # 代理目标 URL（必填）
  headers:                        # 额外请求头（可选）
    Authorization: "Bearer xxx"
  permission: [read]
name: "外部文档"
description: "代理到外部站点"
---
```

## 架构设计

采用 **Gateway 集中管理** 架构：

```
Desktop UI ──► Gateway ──┬─► Static Server (内置)
                         ├─► Proxy (反向代理)
                         └─► Dev Server Manager (spawn/kill)
```

**优点**：
- 统一的端口入口，简化 CORS 和路由
- 生命周期集中管理，便于超时清理
- 与现有 Gateway 架构一致

## 类型定义

### 与现有类型的复用关系

Page 模块复用 Artifact Preview 系统中的部分类型和组件：

| Page 模块 | 复用来源 | 说明 |
|-----------|----------|------|
| `ServerStatus` | `LivePreviewStatus` | 服务器运行状态，语义一致 |
| `MarkdownPreview` | `artifacts/markdown-preview.tsx` | markdown 类型页面渲染 |
| `VitePreview` | `chat/vite-preview.tsx` | server 类型页面 iframe 渲染 |

### 设计原则

1. **使用 const 枚举**：所有枚举类型使用 `as const` 模式，同时提供运行时值和编译时类型
2. **提供类型守卫**：每个枚举类型配套 `isXxx()` 函数用于运行时类型检查
3. **避免字符串字面量**：下游代码应使用类型而非 `type as "static"` 这样的硬编码

### 使用示例

```typescript
// ✅ 正确用法
import { PAGE_TYPES, isPageType, type PageType } from "@/page/ops/types";

// 类型检查
if (isPageType(unknownValue)) {
  // unknownValue 现在是 PageType
}

// 枚举遍历
PAGE_TYPES.forEach(type => console.log(type));

// ❌ 避免的用法
const type = value as "static" | "proxy"; // 不要硬编码字符串字面量
```

### Core 层类型定义

```typescript
// packages/core/src/page/ops/types.ts

// =============================================================================
// 枚举常量 (Const Enums)
// =============================================================================

/**
 * 页面类型枚举
 * - static: 静态 HTML 文件，直接提供文件服务
 * - markdown: 直接渲染 SKILL.md 内容，无视图切换
 * - server: 启动开发服务器（如 Vite），支持 HMR
 * - proxy: 反向代理到外部 URL
 */
export const PAGE_TYPES = ["static", "markdown", "server", "proxy"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

/**
 * 页面权限枚举
 * - read: 可查看页面
 * - write: 可编辑/删除页面
 */
export const PAGE_PERMISSIONS = ["read", "write"] as const;
export type PagePermission = (typeof PAGE_PERMISSIONS)[number];

/**
 * 页面视图模式
 * - skill: 显示 SKILL.md 内容（Markdown 渲染）
 * - page: 显示页面渲染内容（iframe/webview）
 *
 * 注意：markdown 类型页面只有 skill 视图，不显示切换按钮
 */
export const PAGE_VIEW_MODES = ["skill", "page"] as const;
export type PageViewMode = (typeof PAGE_VIEW_MODES)[number];

/**
 * 服务器运行状态
 * 与 apps/desktop/src/components/artifacts/types.ts 中的 LivePreviewStatus 语义一致
 */
export const SERVER_STATUSES = ["idle", "starting", "running", "error", "stopped"] as const;
export type ServerStatus = (typeof SERVER_STATUSES)[number];

// =============================================================================
// 枚举类型守卫 (用于运行时类型检查)
// =============================================================================

export function isPageType(value: unknown): value is PageType {
  return typeof value === "string" && PAGE_TYPES.includes(value as PageType);
}

export function isPagePermission(value: unknown): value is PagePermission {
  return typeof value === "string" && PAGE_PERMISSIONS.includes(value as PagePermission);
}

export function isPageViewMode(value: unknown): value is PageViewMode {
  return typeof value === "string" && PAGE_VIEW_MODES.includes(value as PageViewMode);
}

export function isServerStatus(value: unknown): value is ServerStatus {
  return typeof value === "string" && SERVER_STATUSES.includes(value as ServerStatus);
}

// =============================================================================
// Page Config 类型 (Discriminated Union)
// =============================================================================

/** 页面配置基础字段（内部使用，不导出） */
interface PageConfigBase {
  slug: string;                    // 目录名，如 "my-dashboard"
  name: string;                    // 显示名称
  description?: string;            // 鼠标悬停显示
  icon?: string;                   // 页面图标（用于 Tab 显示）
  permission: PagePermission[];    // 权限列表
  path: string;                    // 页面目录完整路径
  skill_content?: string;          // SKILL.md 的 markdown 内容
}

/** Static 类型：直接提供静态 HTML 文件 */
export interface StaticPageConfig extends PageConfigBase {
  type: "static";
  file: string;                    // 入口文件，相对于页面目录（必填）
}

/** Markdown 类型：直接渲染 SKILL.md 内容 */
export interface MarkdownPageConfig extends PageConfigBase {
  type: "markdown";
  // 无需额外字段，直接使用 skill_content
}

/** Server 类型：启动本地开发服务器 */
export interface ServerPageConfig extends PageConfigBase {
  type: "server";
  command: string;                 // 启动命令（必填）
  port?: number;                   // 端口（可选，不填则自动分配）
  ready_pattern?: string;          // 控制台输出匹配，表示服务就绪
  timeout?: number;                // 闲置超时秒数，默认 300
}

/** Proxy 类型：反向代理到外部 URL */
export interface ProxyPageConfig extends PageConfigBase {
  type: "proxy";
  url: string;                     // 代理目标 URL（必填）
  headers?: Record<string, string>;// 额外请求头
}

/** 页面配置联合类型 */
export type PageConfig = StaticPageConfig | MarkdownPageConfig | ServerPageConfig | ProxyPageConfig;

// =============================================================================
// Page Config 类型守卫
// =============================================================================

export function isStaticPage(page: PageConfig): page is StaticPageConfig {
  return page.type === "static";
}

export function isMarkdownPage(page: PageConfig): page is MarkdownPageConfig {
  return page.type === "markdown";
}

export function isServerPage(page: PageConfig): page is ServerPageConfig {
  return page.type === "server";
}

export function isProxyPage(page: PageConfig): page is ProxyPageConfig {
  return page.type === "proxy";
}

// =============================================================================
// 运行状态类型
// =============================================================================

/** 运行中的 Server 状态 */
export interface RunningServer {
  slug: string;                    // 页面 slug
  pid: number;                     // 进程 ID
  port: number;                    // 运行端口
  status: ServerStatus;            // 运行状态
  started_at: string;              // 启动时间 (ISO 8601)
  last_access: string;             // 最后访问时间（用于超时检测）
  last_health_check?: string;      // 最后健康检查时间
  restart_count: number;           // 重启次数
}

// =============================================================================
// API 结果类型
// =============================================================================

/** 操作结果基础类型 */
export interface PageResult {
  success: boolean;
  error?: string;
}

export interface ListPagesResult extends PageResult {
  pages: PageConfig[];
  count: number;
}

export interface ViewPageResult extends PageResult {
  page?: PageConfig;
}

export interface CreatePageResult extends PageResult {
  page?: PageConfig;
}

export interface DeletePageResult extends PageResult {
  deleted_path?: string;
}

export interface ServerStatusResult extends PageResult {
  servers: RunningServer[];
}

// =============================================================================
// 模板类型
// =============================================================================

/** 页面模板定义 */
export interface PageTemplate {
  id: string;                      // 模板 ID，如 "static-html"
  name: string;                    // 显示名称
  description: string;             // 模板描述
  type: PageType;                  // 对应的页面类型
  files: TemplateFile[];           // 模板文件列表
  default_config: Partial<PageConfig>; // 默认配置
  install_command?: string;        // server 类型的依赖安装命令
}

/** 模板文件定义 */
export interface TemplateFile {
  path: string;                    // 相对路径
  content: string;                 // 文件内容（支持 Handlebars 模板）
}

/** 模板变量 */
export interface TemplateVars {
  name: string;                    // 页面名称
  slug: string;                    // 页面 slug
  description: string;             // 页面描述
}

export interface ListTemplatesResult extends PageResult {
  templates: PageTemplate[];
}
```

### Desktop 层类型定义

```typescript
// apps/desktop/src/stores/tab-store.ts

import type { PageViewMode } from "@viben/core/page";

/**
 * Tab 类型
 * - page: 工作空间页面
 * - chat: 聊天会话
 * - settings: 设置页面
 * - new-tab: 新建 Tab 页（显示页面列表）
 */
export const TAB_TYPES = ["page", "chat", "settings", "new-tab"] as const;
export type TabType = (typeof TAB_TYPES)[number];

/** 页面 Tab 状态 */
export interface PageTab {
  id: string;                      // 唯一标识
  type: TabType;                   // Tab 类型
  slug?: string;                   // 页面 slug (type=page 时)
  workspace_id?: string;           // 工作空间 ID
  name: string;                    // 显示名称
  icon?: string;                   // 图标名
  pinned: boolean;                 // 是否固定
  view_mode?: PageViewMode;        // 当前视图模式 (type=page 时)
  history: string[];               // 导航历史（URL 列表）
  history_index: number;           // 当前历史位置
}

/** Tab Store 状态 */
export interface TabState {
  tabs: PageTab[];
  active_tab_id: string | null;
}

/** Tab Store Actions */
export interface TabActions {
  openTab: (tab: Omit<PageTab, "id">) => string;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  pinTab: (id: string) => void;
  unpinTab: (id: string) => void;
  reorderTabs: (from_index: number, to_index: number) => void;
  navigateBack: () => void;
  navigateForward: () => void;
  pushHistory: (url: string) => void;
  setViewMode: (id: string, mode: PageViewMode) => void;
}
```

## 模块结构

```
packages/core/
├── src/page/
│   ├── index.ts                   # 入口，re-export 所有操作
│   └── ops/
│       ├── index.ts               # 统一导出
│       ├── types.ts               # 类型定义
│       ├── crud.ts                # list, create, view, delete
│       ├── discovery.ts           # 扫描 pages/ 目录，解析 SKILL.md
│       ├── serve.ts               # 代理逻辑（static/server/proxy）
│       ├── lifecycle.ts           # server 启动/停止/超时管理
│       └── templates.ts           # 模板加载逻辑
├── templates/pages/
│   ├── static-html/               # 纯 HTML 模板
│   ├── static-tailwind/           # Tailwind CSS 模板
│   ├── markdown-docs/             # Markdown 文档模板
│   ├── markdown-guide/            # Markdown 指南模板
│   ├── server-vite-react/         # Vite + React 模板
│   ├── server-vite-vue/           # Vite + Vue 模板
│   ├── server-next/               # Next.js 模板
│   └── proxy-basic/               # Proxy 基础模板
└── gateway/routes/
    └── page.ts                    # Gateway 路由
```

## CLI 命令

```bash
# CRUD 操作
viben page list                    # 列出当前工作空间所有页面
viben page create <slug>           # 创建新页面（交互式选择模板）
viben page view <slug>             # 查看页面详情
viben page delete <slug>           # 删除页面

# Server 生命周期
viben page start <slug>            # 启动 server 类型页面
viben page stop <slug>             # 停止 server 类型页面
viben page restart <slug>          # 重启 server 类型页面
viben page status                  # 查看所有运行中的 server 状态

# 辅助
viben page open <slug>             # 在浏览器中打开页面
viben page logs <slug>             # 查看 server 类型页面的日志
```

## Gateway API

采用 **POST + body** 风格，与现有 task API 保持一致：

```
POST   /api/page/list        { workspace_path }                    列出页面
POST   /api/page/view        { workspace_path, slug }              获取页面详情
POST   /api/page/create      { workspace_path, slug, template_id, name, description }  创建页面
POST   /api/page/delete      { workspace_path, slug }              删除页面

POST   /api/page/serve       { workspace_path, slug, path }        页面内容代理（核心）
POST   /api/page/start       { workspace_path, slug }              启动 server
POST   /api/page/stop        { workspace_path, slug }              停止 server
POST   /api/page/status      { workspace_path }                    获取运行状态
POST   /api/page/logs        { workspace_path, slug }              获取 server 日志

POST   /api/page/templates   { }                                   获取可用模板列表
```

### 代理逻辑 `/api/page/serve`

| 页面类型 | 代理行为 |
|---------|---------|
| static | 直接读取文件并返回，Gateway 作为静态文件服务器 |
| markdown | 返回 skill_content（SKILL.md 的 markdown 内容），前端渲染 |
| server | 转发请求到 `localhost:{port}`，若未启动则自动启动 |
| proxy | 反向代理到配置的 `url`，注入 headers |

### Server 生命周期管理

- **自动启动**：访问 `/api/page/serve` 时，若 server 未运行则启动
- **超时停止**：定时任务检查 `last_access`，超过 `timeout` 则 kill 进程
- **手动控制**：`/api/page/start` 和 `/api/page/stop`
- **健康检查**：定期检查进程是否存活，更新 `health_status`
- **意外退出恢复**：检测到进程退出后，更新状态为 `unhealthy`，下次访问时自动重启
- **Gateway 重启恢复**：启动时扫描运行状态文件，清理僵尸进程

## Desktop UI 设计

### 全局 Tab 管理

类似 Notion 的标签页系统，位于窗口最顶部，支持多页面同时打开。

#### Tab 栏布局

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [<] [>] │ [📄] │ [📄 Dashboard ×] [📊 Analytics ×] [📝 Docs ×] │ [+] │ [−][□][×] │
│  导航   │固定Tab│                    普通 Tab                    │新建│  窗口控制  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**从左到右**：
1. **导航按钮**: `[<]` 后退、`[>]` 前进 - 控制当前 Tab 的历史导航
2. **固定 Tab**: 只显示图标，点击切换 - 右键菜单"取消固定"
3. **普通 Tab**: `[icon 页面名称 ×]` - 可拖动排序，点击切换，× 关闭
4. **新建按钮**: `[+]` 打开新选项卡（默认显示页面列表）
5. **窗口控制** (Windows): `[−]` 最小化、`[□]` 最大化、`[×]` 关闭窗口

#### Tab 状态

```typescript
// apps/desktop/src/stores/tab-store.ts

interface PageTab {
  id: string;                      // 唯一标识
  type: "page" | "chat" | "settings";  // Tab 类型
  slug?: string;                   // 页面 slug (type=page 时)
  name: string;                    // 显示名称
  icon?: string;                   // 图标名
  pinned: boolean;                 // 是否固定
  history: string[];               // 导航历史（URL 列表）
  historyIndex: number;            // 当前历史位置
}

interface TabStore {
  tabs: PageTab[];
  activeTabId: string | null;

  // Actions
  openTab: (tab: Omit<PageTab, "id">) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  pinTab: (id: string) => void;
  unpinTab: (id: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  navigateBack: () => void;
  navigateForward: () => void;
  pushHistory: (url: string) => void;
}
```

#### Tab 交互

| 操作 | 行为 |
|------|------|
| 单击 Tab | 切换到该 Tab |
| 双击 Tab | 重命名 Tab（可选） |
| 中键点击 | 关闭 Tab |
| 右键点击 | 显示上下文菜单（固定/取消固定、关闭、关闭其他） |
| 拖动 Tab | 重新排序 |
| Ctrl+W | 关闭当前 Tab |
| Ctrl+T | 新建 Tab |
| Ctrl+Tab | 切换到下一个 Tab |
| Ctrl+Shift+Tab | 切换到上一个 Tab |

#### 与 Tauri 窗口集成

```rust
// src-tauri/src/main.rs
// 设置无边框窗口，自定义标题栏

.decorations(false)  // 移除系统标题栏
```

```typescript
// apps/desktop/src/components/global-tab-bar.tsx
// 自定义窗口控制按钮

import { appWindow } from "@tauri-apps/api/window";

// 窗口控制
const handleMinimize = () => appWindow.minimize();
const handleMaximize = () => appWindow.toggleMaximize();
const handleClose = () => appWindow.close();

// 窗口拖动区域
<div data-tauri-drag-region className="flex-1" />
```

### 路由

```typescript
/workspace/page?workspace_id=<id>                              // 页面列表
/workspace/page?workspace_id=<id>&page_path=pages/xxx/SKILL.md // 页面详情
/workspace/page?workspace_id=<id>&page_path=...&view=skill     // SKILL.md 视图
/workspace/page?workspace_id=<id>&page_path=...&view=page      // 页面渲染视图（默认）
```

### 侧边栏结构

在工作空间导航项下方、GatewayStatusIndicator 上方添加 Pages Section：

```
┌─────────────────────────┐
│ 📂 Workspace Name    ▼  │
├─────────────────────────┤
│ 💬 Chat                 │
│ 📋 Kanban               │
│ ...其他导航项...         │
├─────────────────────────┤
│ 📄 Pages            [+] │  ← Pages Section
│  ▸ my-dashboard         │
│  ▾ admin-panel          │
│     └ settings          │
│     └ users             │
│  ▸ docs-viewer          │
├─────────────────────────┤
│ 🟢 Gateway: Running     │
│ 📄 Documents            │
│ ⚙️ Settings             │
└─────────────────────────┘
```

### 页面列表项

```
┌───────────────────────────────────────┐
│ ▸  my-dashboard           [+] [···]  │
└───────────────────────────────────────┘
  │      │                   │    │
  │      │                   │    └── 更多菜单（删除、权限）
  │      │                   └─────── 创建子页面
  │      └─────────────────────────── 页面名称（点击打开，hover 显示 description）
  └────────────────────────────────── 展开/折叠子页面
```

### 右侧浏览器视图

**注意**：由于全局 Tab 栏已包含后退/前进按钮，页面工具栏不再需要导航按钮。

```
┌─────────────────────────────────────────────────────────────┐
│ 📂 Workspace > 📄 admin-panel > settings  │ [SKILL.md|页面] │
├─────────────────────────────────────────────────────────────┤
│ [🔄 刷新] [🔧 DevTools] [↗️ 外部打开] [⛶ 全屏]  [● Running] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                     页面内容区域                             │
│  (iframe/webview 渲染页面，或 Markdown 渲染 SKILL.md)       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Markdown 类型页面渲染**：

```
┌─────────────────────────────────────────────────────────────┐
│ 📂 Workspace > 📝 docs-guide                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   # 文档标题                                                │
│                                                             │
│   这里是 SKILL.md 的 Markdown 内容...                       │
│   - 列表项                                                  │
│   - 代码高亮                                                │
│                                                             │
│   ```typescript                                             │
│   const hello = "world";                                    │
│   ```                                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**注意**：Markdown 类型页面没有视图切换按钮，直接渲染 SKILL.md 内容。

### Server 状态指示

| 状态 | 显示 | 说明 |
|------|------|------|
| stopped | ⚪ 灰点 | 未启动 |
| starting | 🟡 黄点 + 旋转 | 启动中 |
| running | 🟢 绿点 | 运行中 |
| error | 🔴 红点 | 启动失败 |

### 组件结构

```
apps/desktop/src/
├── components/
│   ├── global-tab-bar/           # 全局 Tab 管理组件
│   │   ├── index.tsx             # Tab 栏主组件
│   │   ├── tab-item.tsx          # 单个 Tab 项
│   │   ├── tab-navigation.tsx    # 后退/前进导航按钮
│   │   ├── window-controls.tsx   # 窗口控制按钮 (Windows)
│   │   └── new-tab-button.tsx    # 新建 Tab 按钮
│   ├── page/
│   │   ├── page-section.tsx          # 侧边栏 Pages Section
│   │   ├── page-list-item.tsx        # 页面列表项（支持嵌套）
│   │   ├── page-browser.tsx          # 右侧浏览器视图容器
│   │   ├── page-toolbar.tsx          # 浏览器工具栏（无导航按钮）
│   │   ├── page-breadcrumb.tsx       # 页面路径面包屑
│   │   ├── page-view-toggle.tsx      # SKILL.md / 页面 切换
│   │   ├── page-preview.tsx          # 页面预览（复用 VitePreview 模式）
│   │   ├── markdown-renderer.tsx     # Markdown 渲染器
│   │   ├── create-page-dialog.tsx    # 创建页面对话框
│   │   └── page-menu.tsx             # 页面操作菜单
├── pages/
│   └── workspace-page.tsx        # 页面详情路由页面
├── hooks/
│   ├── use-pages.ts              # 页面数据 hooks
│   └── use-page-tabs.ts          # Tab 管理 hooks
├── stores/
│   └── tab-store.ts              # Tab 状态管理 (Zustand)
└── lib/gateway/modules/
    └── pages.ts                  # Gateway API 客户端
```

## 页面模板

### 内置模板

| ID | 名称 | 类型 | 说明 |
|----|------|------|------|
| `static-html` | 纯 HTML | static | 最简单的 HTML 页面 |
| `static-tailwind` | Tailwind CSS | static | 带 Tailwind CDN 的 HTML |
| `markdown-docs` | 文档页面 | markdown | 纯 Markdown 文档 |
| `markdown-guide` | 使用指南 | markdown | 带目录结构的指南模板 |
| `server-vite-react` | Vite + React | server | React 18 + TypeScript |
| `server-vite-vue` | Vite + Vue | server | Vue 3 + TypeScript |
| `server-next` | Next.js | server | Next.js App Router |
| `proxy-basic` | 代理页面 | proxy | 基础代理配置 |

### 模板类型定义

```typescript
// packages/core/src/page/ops/templates.ts

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  type: PageType;
  files: TemplateFile[];
  defaultConfig: Partial<PageConfig>;
  installCommand?: string;         // server 类型的依赖安装命令
}

export interface TemplateFile {
  path: string;                    // 相对路径
  content: string | ((vars: TemplateVars) => string);
}

export interface TemplateVars {
  name: string;
  slug: string;
  description: string;
}
```

### 模板存储

模板文件存放在 `packages/core/templates/pages/` 目录：

```
packages/core/templates/pages/
├── static-html/
│   ├── template.json             # 模板元数据
│   ├── SKILL.md.hbs              # Handlebars 模板
│   └── index.html.hbs
├── server-vite-react/
│   ├── template.json
│   ├── SKILL.md.hbs
│   ├── package.json.hbs
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html.hbs
│   └── src/
│       ├── main.tsx
│       └── App.tsx.hbs
└── ...
```

## 权限模型

`permission` 字段控制用户在 Desktop UI 中的操作权限：

| 权限 | 说明 |
|------|------|
| `read` | 可查看页面 |
| `write` | 可编辑/删除页面 |

- 默认权限：`[read, write]`
- 权限在 UI 层面控制，不影响文件系统访问

## 子页面嵌套

支持无限层级嵌套：

```
pages/
├── admin/
│   ├── SKILL.md
│   ├── settings/
│   │   ├── SKILL.md
│   │   └── users/
│   │       └── SKILL.md
│   └── dashboard/
│       └── SKILL.md
```

### Slug 表示规则

嵌套页面的 `slug` 使用路径形式，用斜杠分隔：

| 目录路径 | slug |
|---------|------|
| `pages/admin/SKILL.md` | `admin` |
| `pages/admin/settings/SKILL.md` | `admin/settings` |
| `pages/admin/settings/users/SKILL.md` | `admin/settings/users` |

### 扫描规则

- 只扫描包含 `SKILL.md` 的目录
- UI 递归展示，支持展开/折叠
- 路径通过 `page_path` query param 传递

## 实现优先级

1. **P0 - 核心功能**
   - SKILL.md 解析（支持 markdown 类型）
   - Static 类型页面服务
   - Markdown 类型页面渲染
   - CLI: list, create, view, delete, templates
   - Gateway 基础路由
   - Desktop 侧边栏展示
   - **全局 Tab 管理**（Tab 栏、固定/普通 Tab、窗口控制）

2. **P1 - Server 类型**
   - Server 生命周期管理
   - 自动启动/超时停止
   - CLI: start, stop, status, logs
   - 状态指示器

3. **P2 - Proxy 类型**
   - 反向代理实现
   - Headers 注入

4. **P3 - 增强功能**
   - Tab 快捷键（Ctrl+T/W/Tab）
   - Tab 拖动排序
   - 更多模板
   - 子页面无限嵌套 UI 优化
