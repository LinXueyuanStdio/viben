# Viben Web 页面框架重构设计

**日期**: 2026-06-29
**状态**: 设计中
**版本**: 2.0

## 1. 概述

### 1.1 目标

参考 `pages/web/index.html` 的社区界面原型，重构 `apps/web` 的页面框架层。本次仅覆盖页面骨架（AppShell、Topbar、左侧可折叠侧边栏、面包屑、居中 Tabs、右侧滑出抽屉、搜索组件、图标按钮、导航弹出面板），不涉及页面内容布局的详细重构。

### 1.2 范围

**包含**：
- Design Tokens 和主题系统扩展
- AppShell 布局壳（Topbar + 左侧可折叠侧边栏 + 主内容区）
- Topbar（Header，纯客户端组件）
- 左侧可折叠侧边栏（替换现有的固定 256px 侧边栏）
- 面包屑导航（三段式 + Popover 下拉菜单）
- 图标按钮（`.icon-btn`）— 框架级交互原语
- 导航弹出面板（`.nav-popover`）— 顶栏通知/历史 hover 面板
- 用户 Chip（`.user-chip`）— 顶栏用户标识组件
- 统一 Tabs 组件（pill / drawer / default 三种 variant）
- Header 全局搜索（Popover 面板 + `/search` 搜索页面）
- 右侧滑出抽屉（阅读页专属）

**不包含**：
- 页面内容区的详细设计（卡片、列表、表单等）
- 数据层 API 对接（搜索建议、实时数据等）
- 移动端响应式优化
- 独立页面内容迁移（仅包裹框架，不重构页面内部）
- Author 面包屑变体（推迟至后续迭代）

### 1.3 参考来源

- `pages/web/index.html` — 社区界面 SPA 原型（3769 行 vanilla HTML/CSS/JS）
- `pages/web/SKILL.md` — 组件抽象清单和路由体系
- `apps/desktop/src/navigation/` — 桌面端面包屑路由注册表实现

## 2. 设计决策

| 决策 | 结论 | 理由 |
|------|------|------|
| 布局策略 | **混合布局** — Topbar + 左侧可折叠侧边栏，替换现有固定 sidebar | 保留多级导航能力 + 参考设计的简洁顶栏 |
| Topbar 组件类型 | **客户端组件** — 不直接调用 `getSession()` | 会话数据通过 props 或 context 传入，保持组件纯粹 |
| Header 模式 | **路由驱动** — pathname 自动推导 default/read/landing 模式 | 减少页面配置负担 |
| 侧边栏类型 | **可折叠** — 展开 256px，折叠 0px（仅图标或完全隐藏） | 节省空间，桌面端默认展开 |
| Drawer 范围 | **页面级** — 阅读页专属组件 | 避免过度设计 |
| 搜索组件 | **完整 UI 框架** — Header Popover + 搜索页面，数据层留接口 | 一次性搭建骨架 |
| Tabs 策略 | **统一组件** — 自建 Trigger，不使用 shadcn/ui TabsTrigger 的 `data-[state=active]:bg-primary` | 避免 active 样式冲突 |
| 面包屑参考 | **桌面端 route-registry** — Popover + 注册表模式 | 已验证的成熟方案 |
| 面包屑下拉交互 | **即时 hover 展开**（纯 CSS `:hover`），不使用 JS 延迟 | 与参考设计一致，减少 JS 复杂度 |
| 构建方式 | **组件优先** — 按依赖关系分批构建 | 风险可控，review 方便 |

## 3. 架构概览

### 3.1 新页面框架层级

```
Root Layout (app/layout.tsx)
├── ThemeProvider + I18nProvider + Toaster
│
├── (auth)/layout.tsx              ← 不动（登录/注册无 Topbar 无侧边栏）
│
├── (dashboard)/layout.tsx         ← 重写
│   └── AppShell                   ← 客户端组件，从 context 获取 session
│       ├── Topbar                 ← 根据 pathname 自动切换模式
│       │   ├── TopbarLeft         ← 侧边栏切换按钮 + 品牌 Logo + 面包屑
│       │   ├── TopbarCenter       ← 搜索框 OR 居中 Tabs
│       │   └── TopbarRight        ← 通知 Popover + 历史 Popover + 用户 Chip
│       ├── <div flex flex-1>
│       │   ├── Sidebar            ← 左侧可折叠侧边栏（展开 256px / 折叠 0px）
│       │   │   ├── Main（始终可见）
│       │   │   ├── My（登录后可见）
│       │   │   ├── Creator（登录后可见）
│       │   │   ├── Admin（管理员可见）
│       │   │   └── Footer（用户信息 or 登录按钮）
│       │   └── <main>             ← flex-1, max-w-[1280px] mx-auto
│       │       └── {children}
│       └──
│
├── (admin)/layout.tsx             ← 重写（复用 AppShell，服务端鉴权 + admin Sidebar 条目）
│
└── 独立路由（/, /landing, /leaderboard, /moment, /read/[...], /code-stats）
    ← 各自包裹 AppShell（landing 自动隐藏 Topbar + 侧边栏）
    ← 迁移注意：独立页面需移除自带的 <main>/<header>，仅保留内容区
```

### 3.2 Topbar 三种模式

| 模式 | 触发路由 | Left | Center | Right |
|------|---------|------|--------|-------|
| **default** | `/`, `/leaderboard`, `/moment`, `/mcp`, `/skills`, `/collections`, `/search`, `/notifications`, `/history` | 侧边栏切换 + 品牌 + 面包屑 | 搜索框 | 通知 Popover + 历史 Popover + 用户 Chip |
| **read** | `/read/*` | 侧边栏切换 + 紧凑面包屑 | 居中 Tabs（`absolute left-1/2 -translate-x-1/2`） | 抽屉切换 + 沉浸式切换 + 更多菜单 |
| **landing** | `/landing` | Topbar 隐藏 (`display: none`)，侧边栏隐藏 | — | — |

**阅读模式 Topbar 特殊样式**（与 default 分离）：
- 定位：`position: fixed`（非 sticky，阅读页全视口布局需要浮动顶栏）
- 毛玻璃：`bg-background/68 backdrop-blur-[18px] saturate-[1.18]`（透明度更高，模糊更强）
- 底部边框：`border-b border-border/52`（边框更透明）
- 左侧列宽：`minmax(430px, 1.45fr)`（比 default 更宽，容纳紧凑面包屑）
- Center 列：`absolute left-1/2 -translate-x-1/2`（脱离 grid 流，真居中）

### 3.3 左侧可折叠侧边栏

```
展开态 (256px)：                        折叠态 (0px)：
┌──────────────────┐                    ┌─┐
│ 📦 MCP 市场      │                    │ │ ← 仅显示一个窄
│ 🧩 技能市场      │                    │ │   切换按钮条
│ 📁 合集          │                    │ │   (或完全隐藏)
│ ─────────       │                    │ │
│ ⭐ 收藏          │                    │ │
│ 🔑 API 密钥     │                    │ │
│ ─────────       │                    │ │
│ ✍️ 发布          │                    │ │
│ 📦 我的包        │                    │ │
│ 📊 分析          │                    │ │
│ ─────────       │                    │ │
│ ⚙️ 管理          │ ← 仅管理员可见     │ │
│ ─────────       │                    │ │
│ 👤 用户名        │                    │ │
└──────────────────┘                    └─┘
```

**侧边栏区域**（从现有 `sidebar.tsx` 迁移，保持相同的分组逻辑）：

| 区域 | 路由项 | 可见性 |
|------|--------|--------|
| **Main** | MCP 市场、技能市场、合集 | 始终可见 |
| **My** | 收藏、API 密钥 | 登录后可见 |
| **Creator** | 发布、我的包、分析 | 登录后可见 |
| **Admin** | 管理仪表盘、包审核、用户管理 | 管理员角色可见 |
| **Footer** | 用户头像+名称+邮箱 or 登录按钮 | 始终可见 |

**交互行为**：
- 切换按钮：TopbarLeft 最左侧的汉堡/折叠图标按钮
- 展开/折叠：带动画过渡（`width transition 200ms ease`）
- 默认状态：桌面端默认展开，折叠状态可持久化到 localStorage
- 折叠态内容：侧边栏区域不可见，仅保留切换按钮

## 4. UI 设计稿

> 以下字符画展示各页面框架的预期视觉效果。边框使用 `─│┌┐└┘├┤┬┴┼` 字符绘制，标注用 `←` 指示。

### 4.1 默认模式 — 首页（展开侧边栏）

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Topbar (sticky, h-14, 毛玻璃 bg-background/88 backdrop-blur-[14px])            │
│ ┌──────┬──────────────────────────────────┬─────────────────────────────────┐ │
│ │ ☰ ◆  │  Viben  ›  首页                  │  🔍 搜索插件、页面...     ┌──┐ │ │
│ │      │                                  │                           │🔔│ │ │
│ │      │                                  │                           └──┘ │ │
│ │      │                                  │                           ┌──┐ │ │
│ │      │                                  │  ← 面包屑                   │🕐│ │ │
│ │      │                                  │                           └──┘ │ │
│ │      │                                  │                           ┌────┐│ │
│ │      │                                  │                           │ 👤 ││ │
│ │      │                                  │                           │兮尘▾││ │
│ └──────┴──────────────────────────────────┴───────────────────────────┴────┘│ │
└──────────────────────────────────────────────────────────────────────────────┘
┌──────────┬───────────────────────────────────────────────────────────────────┐
│ Sidebar  │ Main Content (max-w-[1280px] mx-auto py-4)                        │
│ (256px)  │                                                                   │
│          │ ┌─────────────────────────────────────────────────────────────┐   │
│ 📦 MCP   │ │  Hero Carousel                                   [‹] [›]   │   │
│ 市场     │ │ ┌─────────────────────────────────────────────────────────┐ │   │
│          │ │ │                                                         │ │   │
│ 🧩 技能  │ │ │              精选封面 + 标题 + 副标题                    │ │   │
│ 市场     │ │ │                                                         │ │   │
│          │ │ │  ████████░░░░░░░░░░░░░░░░░░ ████░░░░ ████░░░░ ████░░░░  │ │   │
│ 📁 合集  │ │ └─────────────────────────────────────────────────────────┘ │   │
│          │ └─────────────────────────────────────────────────────────────┘   │
│ ──────── │                                                                   │
│ ⭐ 收藏  │ ┌─ 精选推荐 ────────────────────────────────────────── 换一批 ─┐ │
│          │ │ ┌──────────┐ ┌──────────┐ ┌──────────┐                      │ │
│ 🔑 API   │ │ │ 封面     │ │ 封面     │ │ 封面     │                      │ │
│ 密钥     │ │ │ 标题     │ │ 标题     │ │ 标题     │                      │ │
│          │ │ │ 👤 作者  │ │ 👤 作者  │ │ 👤 作者  │                      │ │
│ ──────── │ │ └──────────┘ └──────────┘ └──────────┘                      │ │
│ ✍️ 发布  │ └──────────────────────────────────────────────────────────────┘ │
│          │                                                                   │
│ 📦 我的  │ ┌─ 最新动态 ────────────────────────────────────────────────────┐ │
│ 包       │ │ ┌──────────────────────────────────────────────────────────┐  │ │
│          │ │ │ 👤 宁舟 · @ningzhou · 2 小时前 · 更新                  │  │ │
│ 📊 分析  │ │ │ 发布了新版插件清单...                                    │  │ │
│          │ │ │ ┌─ 附件 ───────────────────────────────────────────┐    │  │ │
│ ──────── │ │ │ │ 插件发布清单 · 兮尘 · 1.2万浏览 · 328 评论      │    │  │ │
│ ──────── │ │ │ └──────────────────────────────────────────────────┘    │  │ │
│          │ │ └──────────────────────────────────────────────────────────┘  │ │
│ 👤 兮尘   │ │ ┌──────────────────────────────────────────────────────────┐  │ │
│ x@vi.com │ │ │ 👤 周一诺 · @yinuo · 3 小时前 · 发布                   │  │ │
│          │ │ │ MCP 开发完全指南...                                      │  │ │
│          │ │ └──────────────────────────────────────────────────────────┘  │ │
│          │ │                  ── 加载更多动态 ──                            │ │
│          │ └──────────────────────────────────────────────────────────────┘ │
│          │                                                                   │
│          │ ┌── 侧栏 (330px 固定宽, 仅首页) ─────────────────────────────┐  │
│          │ │ ┌─ 推荐关注 ────────────────────────────────────────────┐ │  │
│          │ │ │ 👤 周一诺 · 自动化产品设计 · 代表作 MCP 开发指南  [关注]│ │  │
│          │ │ │ 👤 林越 · AI 研究员      · 代表作 论文写作助手    [关注]│ │  │
│          │ │ └───────────────────────────────────────────────────────┘ │  │
│          │ └──────────────────────────────────────────────────────────────┘ │
└──────────┴───────────────────────────────────────────────────────────────────┘
```

### 4.2 侧边栏折叠态

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Topbar                                                                        │
│ ┌──┬─────┬────────────────────────────────┬─────────────────────────────────┐│
│ │☰│ ◆   │  Viben  ›  首页                │  🔍 搜索...     ┌──┐ ┌──┐ ┌────┐││
│ └──┴─────┴────────────────────────────────┴─────────────────┴──┘ └──┘ └────┘││
└──────────────────────────────────────────────────────────────────────────────┘
┌┬─────────────────────────────────────────────────────────────────────────────┐
││ Main Content (全宽, max-w-[1280px] mx-auto py-4)                            │
││                                                                             │
││ ┌───────────────────────────────────────────────────────────────────────┐   │
││ │  Hero Carousel                                                        │   │
││ └───────────────────────────────────────────────────────────────────────┘   │
││ ┌─ 精选推荐 ──────────────────────────────────────────────────── 换一批 ─┐ │
││ │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                  │ │
││ │ │ 封面     │ │ 封面     │ │ 封面     │ │ 封面     │  ← 4列网格       │ │
││ │ │ 标题     │ │ 标题     │ │ 标题     │ │ 标题     │                  │ │
││ │ └──────────┘ └──────────┘ └──────────┘ └──────────┘                  │ │
││ └──────────────────────────────────────────────────────────────────────┘ │
││                                                                             │
││ ┌─ 最新动态 ──────────────────────────────────────────────────────────────┐ │
││ │ ...                                                                     │ │
││ └─────────────────────────────────────────────────────────────────────────┘ │
││                                                                             │
││ ┌─ 侧栏 ──────────────────────────────────────────────────────────────────┐ │
││ │ ...                                                                     │ │
││ └─────────────────────────────────────────────────────────────────────────┘ │
│└─────────────────────────────────────────────────────────────────────────────┘
│ ← 侧边栏折叠为 0px，内容区占满全宽
```

### 4.3 阅读模式（Drawer 关闭 + 居中 Tabs）

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Topbar (fixed, 更透明毛玻璃)                                                   │
│ ┌──────────────────┬──────────────────┬─────────────────────────────────────┐│
│ │ ☰ 🏠 › 幽蓝塔纪事│  ┌─────┬─────┐  │  📋  🖥️  ⋯                         ││
│ │                  │  │ 📄页面│📋副页│  │  ↑ 抽屉  沉浸  更多                ││
│ │                  │  └─────┴─────┘  │                                      ││
│ │  ← 紧凑面包屑     │  ← 居中 Tabs    │  ← 阅读操作 (IconButton ×3)          ││
│ └──────────────────┴──────────────────┴─────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
┌┬─────────────────────────────────────────────────────────────────────────────┐
││                                                                             │
││                                                                             │
││                        ┌─────────────────────────┐                          │
││                        │                         │                          │
││                        │     iframe 阅读内容      │                          │
││                        │     (全宽, 自适应高度)    │                          │
││                        │                         │                          │
││                        │  files/read-novel.html   │                          │
││                        │  files/read-doc.html     │                          │
││                        │  ... (15 个 demo)        │                          │
││                        │                         │                          │
││                        └─────────────────────────┘                          │
││                                                                             │
││   ← 侧边栏折叠，内容区全宽，无边距                                           │
│└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 阅读模式（Drawer 打开 + 遮罩层）

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Topbar (fixed, 毛玻璃)                                                        │
│ ┌──────────────────┬──────────────────┬─────────────────────────────────────┐│
│ │ ☰ 🏠 › 幽蓝塔纪事│  📄页面  📋副页  │  📋  🖥️  ⋯                         ││
│ └──────────────────┴──────────────────┴─────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
┌┬──────────────────────────────────────────────┬──────────────────────────────┐
││                                              │  Drawer (420px, 从右滑入)     │
││                                              │  ┌────────────────────────┐  │
││        ┌─────────────────────────┐           │  │ 详情 │ 💬128 │ 📝笔记  │  │
││        │                         │  ░░░░░░░░ │  ├────────────────────────┤  │
││        │     iframe 阅读内容      │  ░遮罩层░░ │  │                        │  │
││        │                         │  ░░░░░░░░ │  │  👤 兮尘               │  │
││        │                         │           │  │  @xichen               │  │
││        │                         │           │  │  自动化产品设计          │  │
││        │                         │           │  │  代表作: 插件发布清单    │  │
││        │                         │           │  │  共同关注 3 人    [关注] │  │
││        └─────────────────────────┘           │  │                        │  │
││                                              │  │  幽蓝塔纪事              │  │
││                                              │  │  第一卷 · 暗涌           │  │
││                                              │  │                        │  │
││                                              │  │  👁 1.2万  ❤ 328  💬 128│  │
││                                              │  │  📤 转发                │  │
││                                              │  │  ─────────────────────  │  │
││                                              │  │  ❤ 点赞  ⭐ 收藏  📤 转发│  │
││                                              │  │  🔗 分享                │  │
││                                              │  │                        │  │
││                                              │  │  一段关于人工智能与人类   │  │
││                                              │  │  关系的互动叙事体验...    │  │
││                                              │  │                        │  │
││                                              │  │  [视觉小说] [长篇连载]    │  │
││                                              │  │  [互动页面] [AI生成]      │  │
││                                              │  │  [中文] [完结]            │  │
││                                              │  │                        │  │
││                                              │  │  页面 UID: pg_a1b2c3d4   │  │
││                                              │  │                        │  │
││                                              │  └────────────────────────┘  │
│└──────────────────────────────────────────────┴──────────────────────────────┘
```

### 4.5 面包屑下拉菜单（Hover 展开）

```
┌──────────────────────────────────────────────┐
│ Viben ▾  ›  首页 ▾  ›  MCP 市场             │
│ ┌────────┐  ┌──────────────┐                 │
│ │🔍 搜索  │  │🔍 搜索    ✓  │  ← 当前页 Check │
│ │🏠 首页  │  │📊 榜单       │                 │
│ │📊 榜单  │  │📦 MCP 市场   │  ← 分组菜单项    │
│ │📦 MCP  │  │🧩 技能市场   │                 │
│ │🧩 技能  │  │📁 合集       │                 │
│ │📁 合集  │  │✍️ 发布       │                 │
│ │💬 动态  │  │──────────   │  ← 分隔线        │
│ │🔔 通知  │  │⚙️ 管理后台  │  ← 仅管理员可见   │
│ │🕐 历史  │  └──────────────┘                 │
│ │✍️ 发布  │                                   │
│ └────────┘    ↑ hover 即时展开                 │
│               (纯 CSS :hover, 无 JS 延迟)       │
└──────────────────────────────────────────────┘
```

### 4.6 搜索 Popover（Focus 展开）

```
┌──────────────────────────────────────────────────┐
│  🔍 插件发布清单                           [×]   │  ← 输入框 + 清除按钮
│  ┌────────────────────────────────────────────┐  │
│  │  最近搜索                                   │  │
│  │  ┌──────────────┐ ┌───────────┐            │  │
│  │  │ 插件发布清单 ×│ │ viben教程 ×│  ← 可删除  │  │
│  │  └──────────────┘ └───────────┘   chips    │  │
│  │                                            │  │
│  │  热门搜索                                   │  │
│  │  ┌──────────────────────────────────────┐   │  │
│  │  │ 1.  插件发布清单           12,345 🔥 │   │  │
│  │  │ 2.  MCP 开发指南             8,920    │   │  │
│  │  │ 3.  Viben 入门教程           6,543    │   │  │
│  │  │ 4.  ClawHub 云开发           5,210    │   │  │
│  │  │ 5.  AI 工作流设计            4,876    │   │  │
│  │  │ 6.  页面发布教程             3,421    │   │  │
│  │  │ 7.  自动化部署指南           2,980    │   │  │
│  │  │ 8.  多智能体协同             2,450    │   │  │
│  │  └──────────────────────────────────────┘   │  │
│  │                                   ← 可滚动   │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 4.7 导航弹出面板 — 通知（Hover 铃铛图标, 260ms 延迟）

```
         ┌──┐
         │🔔│  ← 通知图标 (IconButton, badge 红点)
         └──┬
    ┌───────┴──────────────┐
    │  动态                │  ← Popover 面板 (340px)
    │  ┌──────────────────┐│
    │  │ 🖼️ 宁舟           ││
    │  │ 发布了 插件发布清单 ││  ← 缩略图 + 标题 + 副文本
    │  │ 6 分钟前 · 28 评论 ││
    │  ├──────────────────┤│
    │  │ 🖼️ 周一诺          ││
    │  │ 收藏了你的页面      ││
    │  │ 22 分钟前          ││
    │  ├──────────────────┤│
    │  │ 🖼️ 林越            ││
    │  │ 评论了 幽蓝塔纪事   ││
    │  │ 1 小时前           ││
    │  ├──────────────────┤│
    │  │ 🖼️ Viben 团队      ││
    │  │ v1.3.3 版本发布    ││
    │  │ 3 小时前           ││
    │  └──────────────────┘│
    │  ┌──────────────────┐│
    │  │   加载更多动态     ││  ← "更多"按钮
    │  └──────────────────┘│
    └──────────────────────┘
      ↑ 首次展开时加载内容
        (data-loaded 标记, 模拟异步)
```

### 4.8 导航弹出面板 — 浏览历史（Hover 时钟图标）

```
         ┌──┐
         │🕐│  ← 历史图标 (IconButton)
         └──┬
    ┌───────┴──────────────┐
    │  最近阅读             │
    │  ┌──────────────────┐│
    │  │ 🖼️ 幽蓝塔纪事      ││
    │  │ 读到 68%          ││  ← 进度条
    │  │ 第 2 章 · 昨天    ││
    │  │ ████████░░░░ 68%  ││
    │  ├──────────────────┤│
    │  │ 🖼️ MCP 开发指南    ││
    │  │ 读到 32%          ││
    │  │ 第 1 章 · 2 天前   ││
    │  │ ███░░░░░░░░░ 32%  ││
    │  ├──────────────────┤│
    │  │ 🖼️ 论文写作助手    ││
    │  │ 已读完             ││
    │  │ 3 天前 · 来自 榜单 ││
    │  │ ████████████ 100% ││
    │  └──────────────────┘│
    │  ┌──────────────────┐│
    │  │   查看全部历史     ││
    │  └──────────────────┘│
    └──────────────────────┘
```

### 4.9 用户菜单（点击用户 Chip）

```
                      ┌──────┐
                      │ 👤 ▾ │  ← 用户 Chip (rounded-full pill)
                      └──┬───┘
              ┌──────────┴──────────┐
              │  👤 个人资料         │
              │  ⚙️ 设置            │  ← DropdownMenu 菜单项
              │  ───────────        │
              │  🚪 退出登录         │
              └─────────────────────┘

  未登录状态：
  ┌──────┬──────┐
  │ 登录  │ 注册 │  ← HeaderAuthButtons (ghost + primary)
  └──────┴──────┘
```

### 4.10 阅读更多菜单（Hover "⋯" 图标）

```
                          ┌──┐
                          │⋯│  ← 更多图标 (IconButton compact)
                          └─┬┘
                    ┌───────┴──────┐
                    │ 🚩 举报       │  ← Popup 菜单 (180px)
                    │ 💬 反馈       │
                    └──────────────┘
```

### 4.11 搜索页面（`/search?q=xxx`）

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Topbar (default)                                                              │
│ ┌──────┬──────────────────────────────────┬─────────────────────────────────┐│
│ │ ☰ ◆  │  Viben  ›  搜索                  │  🔍 插件发布清单          ┌──┐ ││
│ └──────┴──────────────────────────────────┴─────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
┌──────────┬───────────────────────────────────────────────────────────────────┐
│ Sidebar  │                                                                   │
│ (折叠)   │  "插件发布清单" 的搜索结果  共 113 条           [排序 ▾]          │
│          │                                                                   │
│          │  ┌──────────┬──────────────────────────────────┬────────────┐     │
│          │  │  筛选     │                                  │            │     │
│          │  │          │ ┌──────────────────────────────┐ │            │     │
│          │  │ 页面 (45)│ │ 🖼️ 插件发布清单               │ │  👁 1.2万  │     │
│          │  │          │ │ 如何高效发布你的第一个MCP插件   │ │  ❤ 328   │     │
│          │  │ 作者 (23)│ │ 👤 兮尘 · 1.2万浏览 · 328评论  │ │  💬 128   │     │
│          │  │          │ └──────────────────────────────┘ │            │     │
│          │  │ 动态 (31)│ ┌──────────────────────────────┐ │            │     │
│          │  │          │ │ 🖼️ MCP 插件开发完全指南        │ │  👁 8.5k  │     │
│          │  │ 论文 (14)│ │ 从零开始构建你的MCP服务         │ │  ❤ 256   │     │
│          │  │          │ │ 👤 周一诺 · 8.5k浏览 · 256评论 │ │  💬 89   │     │
│          │  │          │ └──────────────────────────────┘ │            │     │
│          │  │          │ ┌──────────────────────────────┐ │            │     │
│          │  │          │ │ 🖼️ Viben 入门教程              │ │  👁 6.5k  │     │
│          │  │          │ │ 快速上手Viben的完整指南         │ │  ❤ 198   │     │
│          │  │          │ │ 👤 林越 · 6.5k浏览 · 198评论   │ │  💬 67   │     │
│          │  │          │ └──────────────────────────────┘ │            │     │
│          │  │          │                                  │            │     │
│          │  │          │  ─── 第 1/29 页 ───              │            │     │
│          │  └──────────┴──────────────────────────────────┴────────────┘     │
│          │                                                                   │
│          │  ┌────────────────────────────────────────────────────────────┐   │
│          │  │                         🔍                                 │   │
│          │  │                    没有找到结果                             │   │
│          │  │     换一个关键词，或减少限定词再试一次。                     │   │
│          │  │              [教程] [入门] [MCP]                            │   │
│          │  └────────────────────────────────────────────────────────────┘   │
│          │  ↑ 空状态（无结果 / 输入特定关键词时显示）                          │
└──────────┴───────────────────────────────────────────────────────────────────┘
```

### 4.12 页面切换状态对比

```
┌──────────────────────────────────────────────────────────────────┐
│                         Default 模式                             │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ ☰ ◆  Viben › 首页    │  🔍 搜索...      │  🔔 🕐 👤 ▾      │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ ┌──────────┬───────────────────────────────────────────────────┐ │
│ │ Sidebar  │                                                    │ │
│ │ (256px)  │                 Page Content                       │ │
│ │          │                                                    │ │
│ └──────────┴───────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                         Read 模式                                │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ ☰ 🏠 › 幽蓝塔纪事  │  📄页面  📋副页  │  📋  🖥️  ⋯       │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ ┌┬──────────────────────────────────────────────────────────────┐│
│ ││                                                              ││
│ ││                     iframe 阅读内容                          ││
│ ││                       (全宽无边距)                            ││
│ ││                                                              ││
│ └┴──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                        Landing 模式                              │
│                                                                  │
│  ← Topbar: display:none                                           │
│  ← Sidebar: display:none                                          │
│                                                                  │
│                    ┌────────────────────┐                         │
│                    │                    │                         │
│                    │    Landing Page    │                         │
│                    │    (全屏无边距)     │                         │
│                    │                    │                         │
│                    └────────────────────┘                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## 5. 组件设计

### 5.1 Design Tokens & 主题系统

**文件**: `apps/web/app/globals.css`（修改）

将 `index.html` 的语义变量映射到 Tailwind v4 体系（hex 参考值，实际使用 oklch 格式）：

| index.html | apps/web 变量 | oklch 参考值 | 用途 |
|------------|---------------|-------------|------|
| `--bg: #f4feff` | `--background` | `oklch(0.985 0.015 210)` | 页面背景 |
| `--surface: #ffffff` | `--surface` | `oklch(1 0 0)` | 卡片/面板背景 |
| `--surface-2: #ecfeff` | `--surface-secondary` | `oklch(0.97 0.02 200)` | 悬停态背景 |
| `--text: #164e63` | `--foreground` | `oklch(0.35 0.04 210)` | 主文本 |
| `--muted: #5f7f8c` | `--muted-foreground` | `oklch(0.55 0.03 210)` | 次要文本 |
| `--line: #cdeff5` | `--border` | `oklch(0.92 0.03 200)` | 边框 |
| `--primary: #0891b2` | `--primary` | `oklch(0.55 0.12 210)` | 主题色（青色系） |
| `--primary-2: #22d3ee` | `--primary-light` | `oklch(0.72 0.12 205)` | 浅主题色 |
| `--cta: #059669` | `--accent` | `oklch(0.55 0.15 170)` | CTA 绿色 |
| `--radius: 8px` | `--radius` | — | 圆角 |
| `--radius-lg: 12px` | `--radius-lg` | — | 大圆角 |
| `--nav-h: 56px` | `--nav-h` | — | Topbar 高度 |
| `--shadow-sm/md` | `--shadow-sm/md` | — | 阴影层级 |

**关键规则**：
- 使用 oklch 格式（项目规范，禁止 `hsl()` 包裹）
- body 渐变背景：`radial-gradient + linear-gradient`
- 新增 `--surface-secondary`、`--primary-light`、`--nav-h`、`--sidebar-w`（侧边栏宽度 256px）四个变量
- 暗色模式：在 `.dark` 类中提供对应的深色变量值

### 4.2 AppShell + Topbar

**文件**:
- `components/layout/app-shell.tsx`（新建）— 客户端组件，组合 Topbar + Sidebar + main
- `components/layout/topbar.tsx`（新建）— 客户端组件，Topbar 渲染
- `components/layout/topbar-mode.ts`（新建）— 路由模式映射（纯函数）

**AppShell 结构**：
```typescript
// components/layout/app-shell.tsx
"use client";

interface AppShellProps {
  children: React.ReactNode;
  session?: Session | null;     // 从服务端 layout 传入
  adminStats?: AdminStats;      // 管理员统计数据
}
```

AppShell 内部使用 `usePathname()` 推导 `topbarMode`，通过 React Context 向下传递 `session` 和 `sidebarCollapsed` 状态。

**Topbar 三列 Grid**：

```
默认模式：
grid-template-columns: minmax(180px, 1fr) minmax(260px, 520px) minmax(180px, 1fr)

阅读模式：
grid-template-columns: minmax(430px, 1.45fr) minmax(160px, 260px) auto
Center 列脱离 grid 流：absolute left-1/2 -translate-x-1/2
```

**关键样式**：
- 默认毛玻璃：`bg-background/88 backdrop-blur-[14px]`（sticky 定位）
- 阅读模式毛玻璃：`bg-background/68 backdrop-blur-[18px] saturate-[1.18]`（fixed 定位）
- 高度：`h-[var(--nav-h)]` (56px)
- 底部边框：`border-b border-border`

**模式判断逻辑**（`topbar-mode.ts`）：
```typescript
type TopbarMode = "default" | "read" | "landing";

function getTopbarMode(pathname: string): TopbarMode {
  if (pathname.startsWith("/landing")) return "landing";
  if (pathname.startsWith("/read/")) return "read";
  return "default";
}
```

### 4.3 左侧可折叠侧边栏

**文件**:
- `components/layout/sidebar.tsx`（重写）— 在现有版本基础上添加折叠动画
- `components/layout/sidebar-wrapper.tsx`（修改）— 从服务端获取 session + adminStats，传给 AppShell

**API**：
```typescript
interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  session: Session | null;
  adminStats?: AdminStats;
}
```

**折叠机制**：
- `collapsed=true` 时宽度 `0`（或 `48px` 仅图标模式），`overflow-hidden`
- 过渡：`transition-[width] duration-200 ease-out`
- 切换按钮在 TopbarLeft 中渲染（汉堡图标，`onClick` 调用 `onToggle`）
- 折叠状态通过 AppShell 内部的 `useState` 管理，可选持久化到 localStorage

**侧边栏导航配置**（从现有 `sidebar.tsx` 提取）：
```typescript
interface NavSection {
  label: string;                // 分组标签（"Main", "My", "Creator", "Admin"）
  requireAuth?: boolean;        // 是否需要登录
  requireAdmin?: boolean;       // 是否需要管理员角色
  items: NavItem[];
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;               // 可选计数 badge
}
```

**与现有 sidebar.tsx 的关系**：
- 保留现有完整的导航项配置和角色可见性逻辑
- 重写渲染层以支持折叠动画
- Footer 区域（用户信息 / 登录按钮）保持不变

### 4.4 面包屑导航

**文件**:
- `lib/navigation/route-registry.ts`（新建）— 简化为 `Record<string, RouteConfig>` 静态映射
- `components/layout/breadcrumb.tsx`（新建）— 面包屑 UI + 段解析 + 下拉菜单
- `components/layout/header-breadcrumb.tsx`（删除）
- `components/layout/header.tsx`（删除—被 AppShell + Topbar 替代）

**路由注册表**（简化，不使用桌面端的 pattern compiler）：
```typescript
// lib/navigation/route-registry.ts
interface RouteConfig {
  label: string;
  titleKey?: string;            // i18n key，如有则用 t(titleKey) 显示，否则显示 label
  icon: LucideIcon;
  dropdownCategory?: string;    // 下拉菜单分组标签
  parent?: string;              // 父路由路径
  mode?: "global" | "author" | "read"; // 面包屑变体
}

// 简化：Record<string, RouteConfig> — 路径→配置映射
const routeRegistry: Record<string, RouteConfig> = {
  "/": { label: "首页", icon: Home },
  "/leaderboard": { label: "榜单", icon: TrendingUp, parent: "/" },
  "/mcp": { label: "MCP 市场", icon: Package, parent: "/" },
  // ... 其他路由
};
```

**段解析逻辑**（内联在 `breadcrumb.tsx` 中）：
1. 取当前 pathname（如 `/mcp/mcp-123`）
2. 分割为 segments，逐段构建路径：`/mcp` → `/mcp/mcp-123`
3. 每个路径查找 `routeRegistry` 获取 label 和 icon
4. 最末段为纯文本（不可点击），非末段带下拉菜单

**下拉菜单**（`BreadcrumbDropdown`，co-located 在 `breadcrumb.tsx` 中）：
- UI：Popover + ScrollArea
- 触发：**即时 hover 展开**（纯 CSS `:hover`，与参考设计一致，不使用 JS 延迟）
- 内容：同级路由列表（按 `parent` 分组），当前页有 Check 标记
- 分组通过 `dropdownCategory` 字段实现

**三种面包屑变体**（与 Topbar mode 联动）：
- 阅读模式（`/read/*`）→ 阅读面包屑子集
- 其他 → 全局面包屑（Author 变体推迟至后续迭代）

### 4.5 图标按钮（Icon Button）

**文件**: `components/ui/icon-button.tsx`（新建）

框架级交互原语，用于 Topbar 操作、阅读模式操作、轮播控制等所有图标操作。

**样式**（直接匹配 index.html `.icon-btn`）：
```typescript
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "default" | "compact";  // default=44px, compact=36px
  label: string;                 // aria-label
}
```

| Size | 尺寸 | 边框 | 圆角 | Hover 效果 |
|------|------|------|------|-----------|
| `default` | 44×44px | `1px solid currentColor/22` | 10px | `bg-currentColor/14 translateY(-1px)` |
| `compact` | 36×36px | `1px solid currentColor/22` | 8px | `bg-currentColor/14 translateY(-1px)` |

### 4.6 导航弹出面板（Nav Popover）

**文件**: `components/layout/nav-popover.tsx`（新建）

顶栏通知和历史图标的 hover 弹出面板。它是一个可复用的 Popover 模式。

**API**：
```typescript
interface NavPopoverProps {
  icon: LucideIcon;              // 触发图标（铃铛/时钟等）
  label: string;                 // aria-label
  badge?: number;                // 未读数红点
  title: string;                 // 面板标题
  items: PopoverItem[];          // 列表项
  onLoadMore?: () => void;       // "加载更多"回调
  moreLabel?: string;            // 加载更多按钮文字
}

interface PopoverItem {
  thumb?: string;                // 缩略图 URL
  title: string;
  subtitle?: string;
  href: string;
}
```

**交互**：
- Hover 触发：260ms 延迟打开（匹配参考设计 `index.html` L3586-3624）
- 移出关闭：180ms 延迟
- 懒加载：首次展开后才加载内容（`data-loaded` 标记）
- 内容结构：`grid` 布局，每项包含缩略图 + 标题行 + 副文本

### 4.7 用户 Chip（User Chip）

**文件**: 内联在 `components/layout/topbar.tsx` 中（或在 `components/layout/user-chip.tsx` 新建）

顶栏用户标识组件：

```typescript
interface UserChipProps {
  user: {
    name: string;
    avatar?: string;
    slug: string;
  } | null;
}
```

**两种状态**：
- **已登录**：`rounded-full` pill 容器（`border border-border bg-surface shadow-sm`），内含 Avatar + 用户名 + 下拉指示箭头。点击展开用户菜单（DropdownMenu：个人资料/设置/退出）
- **未登录**：显示"登录"+"注册"按钮（复用现有 `header-auth-buttons.tsx`）

### 4.8 统一 Tabs 组件

**文件**: `components/ui/viben-tabs.tsx`（新建）

**三种 Variant**：

| Variant | 外观 | 用途 |
|---------|------|------|
| `default` | 分段按钮组，浅色背景 | 页面内分类筛选 |
| `pill` | 圆角胶囊，`min-w-[92px]`，`rounded-full` | 阅读页 Header 居中 Tabs |
| `drawer` | 小号胶囊，`min-w-[78px]`，`rounded-full` | Drawer 头部 Tabs |

**实现方式**：
- **不继承** shadcn/ui `TabsTrigger`（因为其硬编码了 `data-[state=active]:bg-primary` 会导致样式冲突）
- 自建 Trigger 组件，使用 `@radix-ui/react-tabs` 的底层 `Trigger` 原语
- 通过 `className` prop 条件性传入 active 样式（遵循 CLAUDE.md Tailwind v4 规范）
- 保留 shadcn/ui 的 `Tabs` + `TabsList` + `TabsContent` 不变

### 4.9 搜索组件

**4.9.1 Header 全局搜索**（`components/layout/global-search.tsx`）

与 v1 设计保持一致，新增 Search Chip 视觉规范：

**Search Chip**（`.search-chip`）样式：
- `rounded-full` 圆角胶囊
- `bg-surface-secondary` 背景
- 带 `×` 删除按钮（hover 显示或始终显示）
- 多个 chip 通过 `flex flex-wrap gap-1.5` 排列

**Props 接口**：
```typescript
interface GlobalSearchProps {
  recentSearches: string[];
  onRemoveRecent: (query: string) => void;
  hotSearches: { query: string; count: number }[];
}
```

**4.9.2 搜索页面**（`/search?q=xxx`）

与 v1 设计保持一致。空状态文案修正为与参考设计一致：

```
空状态：🔍 图标 + "没有找到结果" + "换一个关键词，或减少限定词再试一次。" + 建议关键词 chips
```

**文件**:
- `app/(dashboard)/search/page.tsx`（新建）
- `components/search/search-page-content.tsx`（新建）
- `components/search/search-result-card.tsx`（新建）
- `components/search/search-filter-sidebar.tsx`（新建）
- `components/search/search-empty.tsx`（新建）

### 4.10 右侧滑出抽屉（Read Drawer）

**文件**: `components/layout/read-drawer.tsx`（新建）

与 v1 设计保持一致。补充内容规范：

**Drawer 三个面板的内容结构**：

| 面板 | value | 内容 |
|------|-------|------|
| **详情** | `details` | 作者卡片 + 页面标题 + 统计行（浏览/点赞/评论/转发）+ 操作按钮行（点赞/收藏/转发/分享）+ 描述文本 + 标签列表 + 页面 UID |
| **评论** | `comments` | 评论排序 + 评论列表 + 评论编辑器 |
| **笔记** | `notes` | 笔记编辑器 + 笔记列表（推迟至后续迭代实现） |

**状态管理**：
- Drawer 打开/关闭状态使用 URL search params（`?drawer=open`），确保：
  - 页面内导航不重置抽屉状态
  - 可书签化
  - 符合 Next.js 平台惯例

**关闭方式**：
- 点击遮罩层
- 点击关闭按钮
- 按 Escape 键
- URL search param 变更

### 4.11 阅读更多菜单（Read More Menu）

**文件**: 内联在阅读模式 TopbarRight 中

Popup 菜单，由 TopbarRight 的 `IconButton`（"..." 图标）触发：

**内容项**：
- 举报（flag 图标）
- 反馈（message-square 图标）

**交互**：
- 触发：hover + focus-within（纯 CSS，与参考设计一致）
- 定位：`top: 100%; right: 0`
- 宽度：`min(180px, calc(100vw - 28px))`

## 6. 会话数据流

```
服务端 Layout（(dashboard)/layout.tsx, (admin)/layout.tsx）
  │
  ├── getSession()           ← 服务端鉴权
  ├── getAdminStats()        ← 管理员统计（仅 admin layout）
  │
  └── <AppShell session={session} adminStats={stats}>
        │                      ← AppShell 是客户端组件
        │                      ← session 通过 props 传入
        │
        ├── <Topbar>           ← 从 AppShell Context 读取 session
        │   ├── UserChip       ← 根据 session 显示用户或登录按钮
        │   ├── NavPopover     ← 通知/历史（登录后显示）
        │   └── ...
        │
        └── <Sidebar>          ← 从 AppShell Context 读取 session
            ├── 根据 session 控制 My/Creator 区域可见性
            ├── 根据 isAdmin(session.role) 控制 Admin 区域可见性
            └── Footer: 用户信息 or 登录按钮
```

**关键点**：
- `getSession()` 仅在服务端 layout 中调用一次
- session 数据通过 props 传递给客户端 AppShell
- AppShell 通过 React Context 向下分发 session 给 Topbar 和 Sidebar
- 避免在每个子组件中重复调用 `getSession()`

## 7. 组件依赖与构建顺序

### 7.1 依赖图

```
globals.css (Design Tokens)
┌─────────┼─────────┐
│         │         │
ui/popover  ui/tabs  ui/button, ui/input, ui/scroll-area, ui/icon-button
(新建)     (已有)   (已有 + icon-button 新建)
│         │         │
┌───┘         │    ┌──┴──────────────────┐
│             │    │                     │
route-registry  VibenTabs  GlobalSearch  ReadDrawer  NavPopover
│               │         │             │           │
│               │         │             │           │
Breadcrumb       │         │             │           │
│               │         │             │           │
└───┬───────────┼─────────┼─────────────┼───────────┘
    │           │         │             │
    └───────────┼─────────┼─────────────┘
                │         │
            Topbar       Sidebar
                │         │
            AppShell (组装 Topbar + Sidebar + main)
                │
          Root Layouts
```

### 7.2 构建顺序（3 批）

| 批次 | 内容 | 依赖 | 页面影响 |
|------|------|------|----------|
| **1. Foundation** | `globals.css` 扩展 + `Popover` + `IconButton` + `route-registry` + `VibenTabs` + `Breadcrumb` | — | 无（纯新增，无页面引用） |
| **2. Features** | `GlobalSearch` + `NavPopover` + `ReadDrawer` + `/search` 路由页面 | Popover + VibenTabs + IconButton | 新增 `/search` 路由 |
| **3. Integration** | `AppShell` + `Topbar` + `Sidebar`（重写）+ `(dashboard)/layout` + `(admin)/layout` 重写 | 所有上述组件 | **影响全部路由** |

## 8. 文件清单

| # | 文件 | 操作 | 批次 |
|---|------|------|------|
| 1 | `app/globals.css` | **修改** — 新增变量、渐变、重置 | 1 |
| 2 | `components/ui/popover.tsx` | **新建** — shadcn/ui Popover | 1 |
| 3 | `components/ui/icon-button.tsx` | **新建** — 图标按钮 | 1 |
| 4 | `lib/navigation/route-registry.ts` | **新建** — 路由注册表 | 1 |
| 5 | `components/ui/viben-tabs.tsx` | **新建** — 统一 Tabs | 1 |
| 6 | `components/layout/breadcrumb.tsx` | **新建** — 面包屑（含段解析+下拉） | 1 |
| 7 | `components/layout/global-search.tsx` | **新建** — Header 搜索 | 2 |
| 8 | `components/layout/nav-popover.tsx` | **新建** — 导航弹出面板 | 2 |
| 9 | `components/layout/read-drawer.tsx` | **新建** — 右侧抽屉 | 2 |
| 10 | `components/search/search-page-content.tsx` | **新建** — 搜索页面 | 2 |
| 11 | `components/search/search-result-card.tsx` | **新建** — 搜索结果卡片 | 2 |
| 12 | `components/search/search-filter-sidebar.tsx` | **新建** — 筛选侧栏 | 2 |
| 13 | `components/search/search-empty.tsx` | **新建** — 搜索空状态 | 2 |
| 14 | `app/(dashboard)/search/page.tsx` | **新建** — `/search` 路由 | 2 |
| 15 | `components/layout/app-shell.tsx` | **新建** — AppShell | 3 |
| 16 | `components/layout/topbar.tsx` | **新建** — Topbar 组件 | 3 |
| 17 | `components/layout/topbar-mode.ts` | **新建** — 路由模式映射 | 3 |
| 18 | `components/layout/sidebar.tsx` | **重写** — 添加折叠动画 | 3 |
| 19 | `components/layout/sidebar-wrapper.tsx` | **修改** — 适配 AppShell props | 3 |
| 20 | `app/(dashboard)/layout.tsx` | **重写** — 使用 AppShell | 3 |
| 21 | `app/(admin)/layout.tsx` | **重写** — 使用 AppShell + 保留鉴权 | 3 |
| 22 | `components/layout/header.tsx` | **删除** — 被 AppShell + Topbar 替代 | 3 |
| 23 | `components/layout/header-breadcrumb.tsx` | **删除** — 被 breadcrumb.tsx 替代 | 3 |

## 9. 页面迁移影响

| 页面路由 | 当前状态 | 迁移动作 | 注意事项 |
|---------|---------|---------|---------|
| `(dashboard)/*` | sidebar+header 布局 | 重写 layout，侧边栏变为可折叠 | 页面内容区宽度自适应 |
| `(admin)/*` | sidebar+header + admin 鉴权 | 重写 layout，**保留鉴权**，侧边栏添加 Admin 条目 | `getSession()` + `isAdminRole()` 前置检查不动 |
| `(auth)/*` | 独立居中布局 | **不动** | 登录/注册无 Topbar 无侧边栏 |
| `/` (home) | 无共享框架，自带 `<main>` + `<header>` | 包裹 AppShell，**需移除自带的壳元素** | 独立页面迁移：剥离外层结构 |
| `/landing` | 独立页面，自带全屏布局 | Topbar + 侧边栏自动隐藏 | 最小改动 |
| `/leaderboard` | 独立页面，自带 `<header>` | 包裹 AppShell，**需移除自带 header** | 页面标题移入内容区 |
| `/moment` | 独立页面，自带 `<header>` | 包裹 AppShell，**需移除自带 header** | 页面标题移入内容区 |
| `/read/[...]` | 独立页面，自带完整布局 | 包裹 AppShell + Drawer 集成，**需移除自带框架** | 最大的迁移工作量 |
| `/search` | **不存在** | **新建** | |

**独立页面迁移原则**：页面只需提供内容区（`{children}`），不需要自行渲染 `<main>`、`<header>`、`<nav>` 等框架元素。如当前页面自带这些元素，需将其移除，仅保留业务内容。

## 10. 验证标准

### 10.1 编译检查
- `apps/web` TypeScript 编译通过（`cd apps/web && pnpm typecheck`）
- 无引入新的 ESLint 错误
- `header.tsx` 和 `header-breadcrumb.tsx` 删除后无残留导入

### 10.2 视觉验证
- Topbar 在 default 模式下正确显示：侧边栏切换 + 品牌 + 面包屑 + 搜索框 + 通知/历史 + 用户 Chip
- Topbar 在 read 模式下正确显示：紧凑面包屑 + 居中 Tabs + 抽屉切换 + 沉浸式切换 + 更多菜单
- Topbar 在 landing 模式下完全隐藏
- 侧边栏折叠/展开动画流畅
- 侧边栏导航项根据登录状态和角色正确显示/隐藏
- 面包屑下拉菜单 hover 即时展开，内容与路由匹配
- 导航弹出面板 hover 260ms 后展开，内容懒加载
- 搜索 Popover focus 展开，显示 mock 数据
- Drawer 打开/关闭动画流畅，遮罩层正确，状态通过 URL search param 持久化
- 暗色模式切换正常

### 10.3 页面完整性
- 所有现有页面在新框架下可正常渲染（页面不崩溃，功能可用）
- 新 `/search` 路由可访问，显示 mock 搜索结果
- Admin 鉴权逻辑正常工作（非管理员访问 `/admin/*` 被重定向）

## 11. 已知限制与后续迭代

1. **不包含移动端响应式** — 本次仅实现桌面端布局
2. **数据层未对接** — 搜索建议、通知面板、面包屑动态数据等使用 mock
3. **页面内容未迁移** — 页面内部布局保持现状，仅包裹新框架；独立页面需移除自带的壳元素
4. **Author 面包屑变体推迟** — 首次迭代仅实现 global 和 read 两种变体；影响：`my-packages` 和 `analytics` 在面包屑中使用 global 变体（缺少创作者工具入口），可通过侧边栏 Creator 区域补足
5. **暗色模式色彩推导** — index.html 仅有浅色模式，暗色模式需自行推导 oklch 值
6. **Nav Links 组件不实现** — index.html 中 `.nav-links` 仅有 CSS/JS 无对应 HTML（SKILL.md 6.3 已确认），故意排除
