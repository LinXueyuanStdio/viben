# Desktop Navigation 重构实施计划

**日期**: 2026-05-02
**目标**: 基于 [desktop-navigation.md](../specs/modules/desktop/desktop-navigation.md) 落地 Desktop 全局面包屑、Tab-first 导航、虚拟页面索引与 markdown 子页面 push 能力。

## 1. 实施目标

- 建立 `DesktopLocation` / `TabNavigationState` / `BreadcrumbStack` / `VirtualPageIndex` 核心模型
- 把 desktop 页面切换统一收口到 tab 导航层
- 引入 `TabRouterBridge`，让 router 退化为 tab 的投影层
- 引入全局共享 `DesktopBreadcrumbBar`
- 支持 markdown 页面中的可导航 block 导出虚拟子节点
- 支持 `workspace-web` wrapper route，用于承载外部网页

## 2. 范围

### In Scope

- `apps/desktop/src/App.tsx`
- `apps/desktop/src/stores/tab-store.ts`
- `apps/desktop/src/hooks/use-page-tabs.ts`
- `apps/desktop/src/components/global-tab-bar/index.tsx`
- `apps/desktop/src/components/layout/app-layout.tsx`
- `apps/desktop/src/components/layout/sidebar.tsx`
- `apps/desktop/src/components/workspace/workspace-breadcrumb.tsx`
- `apps/desktop/src/components/workspace/workspace-header.tsx`
- `apps/desktop/src/pages/apps/workspace-page.tsx`
- `apps/desktop/src/pages/apps/components/page-preview.tsx`
- `apps/desktop/src/pages/apps/components/yoopta-markdown-renderer.tsx`
- `apps/desktop/src/pages/apps/components/yoopta-plugins.ts`
- `apps/desktop/src/pages/apps/utils/page-href.ts`
- `apps/desktop/src/pages/workspace-files.tsx`
- `apps/desktop/src/pages/agents/workspace-agents.tsx`
- `apps/desktop/src/pages/agents/agent-detail.tsx`
- 新增 navigation 相关模块

### Out of Scope

- 大规模视觉重做
- 所有页面内部状态 URL 化
- 一次性删除全部 legacy route

## 3. 总体执行策略

采用“主控 + 多子 agent 并行切片”的执行方式：

- **主控 agent**
  负责整体顺序、接口收口、最终集成、冲突协调、验证与收尾。

- **子 agent A: Navigation Core**
  负责导航状态模型、tab store、router bridge、canonical route。

- **子 agent B: Shell Navigation UI**
  负责全局 breadcrumb shell、sidebar 接入、workspace breadcrumb/header 收口。

- **子 agent C: Workspace Page Navigation**
  负责 markdown/page/external-web 导航、page navigation extract、workspace-web wrapper。

约束：

- 三个子 agent 写入范围尽量互斥
- 主控 agent 不把关键共享接口同时交给多个子 agent 实现
- 主控 agent 负责最后的 API 对齐和类型整合

## 4. 阶段拆分

### Phase 0: 预备与冻结边界

**Owner**: 主控 agent

任务：

1. 新建 navigation 模块目录骨架
2. 确认命名：
   - `DesktopLocation`
   - `ViewTarget`
   - `BreadcrumbStackItem`
   - `VirtualPageIndexNode`
   - `TabNavigationState`
   - `TabNavigationApi`
3. 确认 `workspace-web` route 采用 wrapper query 形式
4. 确认 legacy route 只做 parse，不做业务跳转

产出：

- 新模块骨架文件
- 核心类型占位

依赖：

- 无

---

### Phase 1: Navigation Core

**Owner**: 子 agent A

目标：

- 建立 tab-first 导航状态与 router bridge
- 把 URL history 改成结构化 history

任务：

1. 新增 `apps/desktop/src/navigation/location.ts`
   - `DesktopLocation`
   - `locationToUrl`
   - `urlToLocation`

2. 新增 `apps/desktop/src/navigation/view-target.ts`
   - `ViewTarget`
   - `buildViewTarget`

3. 新增 `apps/desktop/src/navigation/breadcrumb-stack.ts`
   - `BreadcrumbStackItem`
   - `popTo`
   - stack helper

4. 新增 `apps/desktop/src/navigation/tab-navigation.ts`
   - `TabNavigationState`
   - `TabNavigationApi`
   - `openLocation`
   - `replaceLocation`
   - `pushPage`
   - `resetStack`

5. 重构 `apps/desktop/src/stores/tab-store.ts`
   - `history: string[]` -> `history: TabNavigationState[]`
   - 增加兼容迁移逻辑
   - `getCurrentUrl` 改为从当前 state 派生

6. 重构 `apps/desktop/src/hooks/use-page-tabs.ts`
   - 不再直接 `navigate()`
   - 全部 API 改为产出 `TabNavigationState` / `DesktopLocation`
   - `openWorkspaceView` / `openPageTab` / `openGlobalView` 改成 tab-first

7. 新增 `apps/desktop/src/components/navigation/tab-router-bridge.tsx`
   - active tab -> router
   - route/deep link -> active tab
   - legacy route parse

8. 重构 `apps/desktop/src/App.tsx`
   - 增加 canonical route
   - 增加 `workspace-web`
   - 增加 legacy parse 落点

9. 重构 `apps/desktop/src/components/global-tab-bar/index.tsx`
   - new tab / back / forward 基于结构化 tab state 工作

10. 重构 `apps/desktop/src/components/layout/app-layout.tsx`
   - 挂载 `TabRouterBridge`

写入范围：

- `navigation/location.ts`
- `navigation/view-target.ts`
- `navigation/breadcrumb-stack.ts`
- `navigation/tab-navigation.ts`
- `stores/tab-store.ts`
- `hooks/use-page-tabs.ts`
- `components/navigation/tab-router-bridge.tsx`
- `components/global-tab-bar/index.tsx`
- `components/layout/app-layout.tsx`
- `App.tsx`

交付标准：

- 可以在不依赖 breadcrumb UI 的前提下，用 tab state 驱动页面切换
- route 可由 `DesktopLocation` 单向投影出来
- legacy URL 可以被解析成 canonical location

---

### Phase 2: Shell Navigation UI

**Owner**: 子 agent B

目标：

- 建立全局共享 breadcrumb bar
- sidebar 和页面 header 改为消费 tab navigation

任务：

1. 新增 `apps/desktop/src/navigation/page-index.ts`
   - `VirtualPageIndexNode`
   - 静态 root/section 节点
   - sibling branch resolver 接口

2. 新增 `apps/desktop/src/components/navigation/desktop-breadcrumb-bar.tsx`
   - 从 active tab 读取 `breadcrumbStack`
   - 点击段落执行 `popTo`
   - 渲染右侧 header actions slot

3. 新增 `apps/desktop/src/components/navigation/breadcrumb-dropdown.tsx`
   - hover 段落时读取 index branch
   - 支持 workspace root / section / detail / page / web 几类菜单

4. 重构 `apps/desktop/src/components/layout/app-layout.tsx`
   - 在 `GlobalTabBar` 和 `Outlet` 之间挂 `DesktopBreadcrumbBar`

5. 重构 `apps/desktop/src/components/layout/sidebar.tsx`
   - 所有入口统一调用 tab navigation API
   - 不再直接把 router 当业务导航入口
   - workspace nav / creator nav / documents / settings 统一改造

6. 收口 `apps/desktop/src/components/workspace/workspace-breadcrumb.tsx`
   - 降级为内部兼容层或删除

7. 收口 `apps/desktop/src/components/workspace/workspace-header.tsx`
   - 从“包含 breadcrumb 的 header”改成“只负责 actions slot/页面级 header”

8. 重构页面接入点：
   - `apps/desktop/src/pages/workspace-files.tsx`
   - `apps/desktop/src/pages/agents/workspace-agents.tsx`
   - 去掉手工 `segments`

写入范围：

- `navigation/page-index.ts`
- `components/navigation/desktop-breadcrumb-bar.tsx`
- `components/navigation/breadcrumb-dropdown.tsx`
- `components/layout/sidebar.tsx`
- `components/workspace/workspace-breadcrumb.tsx`
- `components/workspace/workspace-header.tsx`
- `pages/workspace-files.tsx`
- `pages/agents/workspace-agents.tsx`

交付标准：

- breadcrumb 全局只渲染一份
- 每个 segment 可点
- hover dropdown 可以从统一索引拿 sibling items
- sidebar 点击统一走 tab navigation

---

### Phase 3: Workspace Page Navigation

**Owner**: 子 agent C

目标：

- 让 markdown 页面成为导航宿主
- 支持 `workspace-web` 外部网页叶子节点

任务：

1. 新增 `apps/desktop/src/navigation/page-navigation-extractor.ts`
   - `PageNavigationExtract`
   - `ExtractedNavigationItem`
   - 从 markdown/Yoopta 内容抽取可导航节点

2. 新增 `apps/desktop/src/pages/workspace-web.tsx`
   - 解析 `workspace-web` wrapper route
   - 渲染 webview/iframe/降级逻辑

3. 重构 `apps/desktop/src/pages/apps/utils/page-href.ts`
   - query route -> canonical route `/workspace/:workspaceId/page/<slug>`

4. 重构 `apps/desktop/src/pages/apps/workspace-page.tsx`
   - 使用 canonical page route
   - 接入 tab navigation
   - 取消手工 breadcrumb `segments`

5. 重构 `apps/desktop/src/pages/apps/components/page-preview.tsx`
   - page view / skill view 与 navigation context 对齐

6. 重构 `apps/desktop/src/pages/apps/components/yoopta-plugins.ts`
   - 为 `Embed` / `Link` / `Mention` 预留 navigation meta

7. 重构 `apps/desktop/src/pages/apps/components/yoopta-markdown-renderer.tsx`
   - 在合适时机导出 page navigation extract
   - 页面内点击导航节点时走 `pushPage()`
   - 支持 `includeInPageIndex`

8. 如有需要，扩展 `apps/desktop/src/lib/gateway/modules/pages.ts`
   - 页面内容读取与导航抽取需要的辅助 API

写入范围：

- `navigation/page-navigation-extractor.ts`
- `pages/workspace-web.tsx`
- `pages/apps/workspace-page.tsx`
- `pages/apps/components/page-preview.tsx`
- `pages/apps/components/yoopta-markdown-renderer.tsx`
- `pages/apps/components/yoopta-plugins.ts`
- `pages/apps/utils/page-href.ts`
- `lib/gateway/modules/pages.ts`

交付标准：

- markdown 页面可把子节点 push 到 breadcrumb stack
- 外部网页可作为 `workspace-web` 叶子节点打开
- `pages/**/SKILL.md` 的 canonical route 生效

---

### Phase 4: 集成与清理

**Owner**: 主控 agent

任务：

1. 合并三条切片的接口定义
2. 解决 `TabNavigationState` / `VirtualPageIndexNode` 类型漂移
3. 统一 shell 中 breadcrumb actions 与页面级 action portal
4. 扫描并替换散落的业务型 `navigate()`
5. 补足 smoke test / 手工验证清单
6. 清理过渡兼容代码和明显废弃的 breadcrumb 组装逻辑

交付标准：

- 三个切片在同一导航模型下工作
- 无明显重复的 breadcrumb 来源
- route / tab / index / stack 四层关系闭合

## 5. 子 agent 分工

### 子 agent A: Navigation Core

职责：

- 状态模型
- tab store
- router bridge
- canonical route

禁止修改：

- `yoopta-*`
- `workspace-page.tsx`
- `sidebar.tsx`
- `workspace-breadcrumb.tsx`

### 子 agent B: Shell Navigation UI

职责：

- breadcrumb shell
- dropdown
- sidebar
- workspace header/breadcrumb 收口

禁止修改：

- `tab-store.ts`
- `use-page-tabs.ts`
- `yoopta-*`
- `workspace-web.tsx`

### 子 agent C: Workspace Page Navigation

职责：

- markdown page navigation
- page navigation extract
- external web wrapper

禁止修改：

- `tab-store.ts`
- `sidebar.tsx`
- `global-tab-bar/index.tsx`

## 6. 依赖关系

### 强依赖

- B 依赖 A 暴露稳定的 `TabNavigationApi`
- C 依赖 A 暴露稳定的 `DesktopLocation` / `ViewTarget`

### 弱依赖

- B 与 C 都会消费 `VirtualPageIndexNode`，但其动态 resolver 可以分阶段接入

### 建议顺序

1. 主控 agent 先建立 type skeleton
2. A 先完成 navigation core
3. B / C 并行
4. 主控 agent 最后集成

## 7. 验证清单

### 核心验证

- 点击 sidebar 工作区入口，当前 tab 正确切换
- breadcrumb 每个段可点击并回退 stack
- hover breadcrumb 段出现 sibling dropdown
- `/workspace/:workspaceId/agent/:agentId` 深链可打开正确页面
- `/workspace/:workspaceId/page/<slug>` 深链可打开正确页面
- markdown 页面点击 embed/link 导航节点后，breadcrumb stack 正确追加
- 外部网页在 `workspace-web` route 内打开

### 回归验证

- global tab bar 的 back/forward 仍可工作
- new tab 行为未破坏
- settings/documents/devices 这类 global view 仍可打开
- workspace files / workspace agents 页面未丢失功能

## 8. 风险

- `tab-store` 历史结构迁移可能影响已有持久化数据
- `workspace-header` / `workspace-breadcrumb` 当前被多页复用，收口时容易出现双重 header
- 外部网站 iframe/webview 嵌入受 CSP 限制，`workspace-web` 需要降级策略
- markdown 内容抽取如果过度激进，会污染 page index

## 9. 交付物

- 核心规格：
  [desktop-navigation.md](../specs/modules/desktop/desktop-navigation.md)

- 设计方案：
  [2026-05-02-desktop-global-breadcrumb-tab-routing-refactor.md](./2026-05-02-desktop-global-breadcrumb-tab-routing-refactor.md)

- 本实施计划：
  `docs/plans/2026-05-02-desktop-navigation-implementation-plan.md`
