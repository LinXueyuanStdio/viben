# Desktop 全局面包屑与 Tab 路由重构方案

> 创建日期: 2026-05-02

## 背景

当前 desktop 导航有三个根问题：

1. 面包屑是页面内局部拼接的，不是全局共享模型。
2. 路由是混合的，`/workspace/:workspaceId/*`、顶层 detail route、query route 并存。
3. tab 不是唯一导航入口，很多地方仍然直接 `navigate()`。

直接结果是：

- 面包屑不能保证每一段都可跳转。
- route 前缀关系不稳定，无法自然形成 notion-like breadcrumb。
- sidebar、tab、breadcrumb 不共享同一套页面索引。
- `pages/**/SKILL.md` 和 markdown 页面里的富 URL block 不能自然进入导航体系。

## 目标

建立一套统一导航模型：

`Virtual Page Index -> Breadcrumb Stack -> Tab Navigation State -> Canonical Route`

结果要求：

- desktop 内所有页面切换都先走 tab。
- router 只负责投影当前 tab 的 view。
- 面包屑全局共享，只渲染一份。
- 面包屑每一段都可点击，hover 时可展开下拉菜单。
- 子页面可以向面包屑栈 `push` 新页面。
- markdown 页面里的可导航 block 可以进入虚拟页面索引。

## 核心原则

### 1. route、index、breadcrumb stack 分层

- `route`
  负责渲染、深链、地址栏同步。

- `Virtual Page Index`
  负责信息架构、dropdown、页面发现、跨入口嵌入。

- `Breadcrumb Stack`
  负责当前 tab 内的实际进入路径。

三者相关，但不要求同构。

### 2. breadcrumb 以 stack 为准

面包屑不是从 route 现算，也不是从 index 临时重建，而是当前 tab 持有的一条 stack。

子页面进入时可以：

- `replaceLocation`
  替换当前 view，不增加层级

- `pushPage`
  追加一个子页面段，形成 notion-like 页面进入链

例如：

- 先打开 `[icon] viben / [icon] 页面 / [icon] 我的自定义markdown页面`
- 再点击 markdown 页面里的可导航 embed block `百度`
- stack 变成：
  `[icon] viben / [icon] 页面 / [icon] 我的自定义markdown页面 / [icon] 百度`

### 3. Virtual Page Index 是唯一菜单来源

sidebar、breadcrumb dropdown、搜索、最近访问、收藏等都消费同一份虚拟页面索引。

这允许：

- route 和信息架构解耦
- 外部网页被挂到 markdown 页面下面
- 同一个 view 以多个虚拟入口出现

## Canonical Route

workspace 相关 route 收口到 `/workspace/:workspaceId/...`：

- `/workspace/:workspaceId`
- `/workspace/:workspaceId/chat`
- `/workspace/:workspaceId/kanban`
- `/workspace/:workspaceId/cron`
- `/workspace/:workspaceId/ideas`
- `/workspace/:workspaceId/agent`
- `/workspace/:workspaceId/agent/:agentId`
- `/workspace/:workspaceId/executor/:executorType`
- `/workspace/:workspaceId/files`
- `/workspace/:workspaceId/github`
- `/workspace/:workspaceId/chat-monitor`
- `/workspace/:workspaceId/page/*pageSlug`
- `/workspace/:workspaceId/web`

关键收口：

- `WorkspaceAgentsPage` -> `/workspace/:workspaceId/agent`
- `AgentDetailPage` -> `/workspace/:workspaceId/agent/:agentId`
- `WorkspacePage` -> `/workspace/:workspaceId/page/<slug>`

外部网页不直接把 app route 切到外部 URL，而是走内部 wrapper route：

- `/workspace/:workspaceId/web?url=<encoded>&title=<encoded>&source_page=<slug?>&web_id=<id?>`

旧路由只做兼容解析：

- `/workspace/:workspaceId/agents` -> `/workspace/:workspaceId/agent`
- `/agent/:agentId?workspace_path=...` -> `/workspace/:workspaceId/agent/:agentId`
- `/executor/:executorType?workspace_path=...` -> `/workspace/:workspaceId/executor/:executorType`
- `/workspace/page?workspace_id=...&page_path=pages/<slug>/SKILL.md` -> `/workspace/:workspaceId/page/<slug>`

## 核心数据结构

### `DesktopLocation`

```ts
type DesktopLocation =
  | { kind: "workspace-home"; workspaceId: string }
  | { kind: "workspace-section"; workspaceId: string; section: "chat" | "kanban" | "cron" | "ideas" | "agent" | "files" | "github" | "chat-monitor" }
  | { kind: "workspace-agent-detail"; workspaceId: string; agentId: string }
  | { kind: "workspace-executor-detail"; workspaceId: string; executorType: string }
  | { kind: "workspace-page"; workspaceId: string; pageSlug: string }
  | { kind: "workspace-web"; workspaceId: string; sourcePageSlug?: string; webId?: string; title: string; url: string }
  | { kind: "settings"; section?: string }
  | { kind: "documents" }
  | { kind: "device-pair" };
```

### `ViewTarget`

```ts
interface ViewTarget {
  key: string;
  location: DesktopLocation;
  canonicalUrl: string;
}
```

### `BreadcrumbStackItem`

```ts
type BreadcrumbItemKind =
  | "workspace-root"
  | "workspace-section"
  | "workspace-page"
  | "workspace-agent"
  | "workspace-executor"
  | "workspace-web"
  | "virtual-folder";

interface BreadcrumbStackItem {
  id: string;
  kind: BreadcrumbItemKind;
  label: string;
  icon?: IconData;
  sourceNodeId?: string;
  parentNodeId?: string;
  target?: ViewTarget;
  meta?: {
    workspaceId?: string;
    pageSlug?: string;
    agentId?: string;
    executorType?: string;
    webId?: string;
    url?: string;
    blockId?: string;
  };
}
```

### `VirtualPageIndexNode`

```ts
type VirtualNodeKind =
  | "workspace-root"
  | "workspace-section"
  | "workspace-page"
  | "workspace-agent"
  | "workspace-executor"
  | "external-web"
  | "virtual-folder"
  | "related-link";

interface VirtualPageIndexNode {
  id: string;
  kind: VirtualNodeKind;
  label: string;
  icon?: IconData;
  parentId?: string;
  order: number;
  isContainer?: boolean;
  target?: ViewTarget;
  childSource?: {
    type: "static" | "workspace-pages" | "workspace-agents" | "workspace-executors" | "page-navigation";
    workspaceId?: string;
    pageSlug?: string;
  };
  contentRef?: {
    pageSlug: string;
    blockId?: string;
  };
}
```

### `TabNavigationState`

```ts
interface TabNavigationState {
  location: DesktopLocation;
  breadcrumbStack: BreadcrumbStackItem[];
  activeNodeId?: string;
  activeIndexPath?: string[];
}
```

### `TabNavigationApi`

```ts
interface PushPageOptions {
  mode?: "push" | "replace";
  preserveTail?: boolean;
}

interface TabNavigationApi {
  openLocation(next: TabNavigationState): void;
  replaceLocation(location: DesktopLocation, patch?: Partial<TabNavigationState>): void;
  pushPage(item: BreadcrumbStackItem, nextLocation: DesktopLocation, options?: PushPageOptions): void;
  popTo(index: number): void;
  resetStack(next: TabNavigationState): void;
}
```

默认语义：

- sidebar 主入口：`resetStack`
- 页面内子导航：`pushPage`
- 同级切换：`replaceLocation`

## Markdown 页面与虚拟页面索引

`apps/desktop/src/pages/apps/components/page-preview.tsx` 对 markdown 类型页面直接渲染 `YooptaMarkdownRenderer`。当前 Yoopta 已经具备：

- `Link`
- `Embed`
- `Mention`
- `#page` 搜索 workspace pages

所以 markdown 页面不是普通叶子页，而是一个 notion-like 的导航宿主。

### 导航抽取

不要从渲染后的 DOM 反推，而是从 markdown/Yoopta 内容抽取：

```ts
type ExtractedNavItemKind = "page-mention" | "external-link" | "embed";

interface ExtractedNavigationItem {
  id: string;
  kind: ExtractedNavItemKind;
  label?: string;
  blockId?: string;
  order: number;
  pageSlug?: string;
  url?: string;
  nav?: {
    includeInPageIndex?: boolean;
    titleOverride?: string;
    iconOverride?: IconData;
    orderOverride?: number;
  };
}

interface PageNavigationExtract {
  pageSlug: string;
  items: ExtractedNavigationItem[];
}
```

### Yoopta block 元数据

```ts
interface YooptaNavigationMeta {
  includeInPageIndex?: boolean;
  titleOverride?: string;
  iconOverride?: IconData;
  webViewMode?: "embedded" | "external";
}
```

推荐默认值：

- `Embed.includeInPageIndex = true`
- `Link.includeInPageIndex = false`
- `#page mention.includeInPageIndex = false`

### 映射规则

- `Embed`
  默认进入索引；如果是内部 page URL，可映射为 `workspace-page`，否则映射为 `external-web`

- `Link`
  默认不进入索引；只有显式标记后才映射为 `external-web`

- `#page mention`
  默认不进入主 breadcrumb 链；可以作为 related 菜单来源；显式标记后可映射为 `workspace-page`

### 目标体验

用户在 markdown 页面里插入一个 embed block 指向 `https://baidu.com`：

- 内容层：它是富 URL block
- 导航层：它被抽取为 `VirtualPageIndexNode`
- 交互层：点击它触发 `pushPage()`

最后得到：

- `[icon] viben / [icon] 页面 / [icon] 我的自定义markdown页面 / [icon] 百度`

实际渲染由 `workspace-web` wrapper route 承载。

## 全局共享面包屑

把现在页面内各自渲染的 `WorkspaceHeader + WorkspaceBreadcrumb` 收口到 Shell：

```text
GlobalTabBar
DesktopBreadcrumbBar
Outlet
```

`DesktopBreadcrumbBar` 放在 `AppLayout`，只渲染一份。

显示逻辑：

- 面包屑内容以当前 tab 的 `breadcrumbStack` 为准
- hover 菜单从 `VirtualPageIndexNode` branch 获取
- 点击某个段执行 `popTo(index)`

页面自身不再传手工 `segments`。

## Dropdown 规则

每个 breadcrumb 段 hover 后，都按索引语义展开 sibling branch：

- workspace 根段：workspace 列表
- workspace section 段：同级 workspace 入口
- agent/executor/detail 段：同类资源列表
- workspace page 段：同级页面和子页面
- external web 段：同级 web 节点或同页导航节点

这样 sidebar、breadcrumb dropdown、搜索结果共享同一来源。

## 性能策略

只缓存 index branch，不缓存整棵展开树。

重点策略：

- branch-level cache
- static + dynamic merge
- workspace-scoped invalidation
- 常用 branch 预取

因为 breadcrumb 直接读取当前 stack，所以 hover 时只需要：

- 读取当前 stack item
- 查询其 sibling branch

不需要重新推导整棵树。

## 实现落点

### 新增

- `apps/desktop/src/navigation/location.ts`
- `apps/desktop/src/navigation/view-target.ts`
- `apps/desktop/src/navigation/page-index.ts`
- `apps/desktop/src/navigation/breadcrumb-stack.ts`
- `apps/desktop/src/navigation/page-navigation-extractor.ts`
- `apps/desktop/src/navigation/tab-navigation.ts`
- `apps/desktop/src/components/navigation/desktop-breadcrumb-bar.tsx`
- `apps/desktop/src/components/navigation/breadcrumb-dropdown.tsx`
- `apps/desktop/src/components/navigation/tab-router-bridge.tsx`
- `apps/desktop/src/pages/workspace-web.tsx`

### 重构

- `apps/desktop/src/stores/tab-store.ts`
- `apps/desktop/src/hooks/use-page-tabs.ts`
- `apps/desktop/src/components/layout/app-layout.tsx`
- `apps/desktop/src/components/layout/sidebar.tsx`
- `apps/desktop/src/components/workspace/workspace-breadcrumb.tsx`
- `apps/desktop/src/components/workspace/workspace-header.tsx`
- `apps/desktop/src/pages/apps/workspace-page.tsx`
- `apps/desktop/src/pages/apps/components/yoopta-markdown-renderer.tsx`
- `apps/desktop/src/pages/apps/components/yoopta-plugins.ts`

## 迁移阶段

### Phase 1: 核心模型

- 定义 `DesktopLocation`
- 定义 `ViewTarget`
- 定义 `BreadcrumbStackItem`
- 定义 `VirtualPageIndexNode`
- 定义 `TabNavigationState`
- 定义 `PageNavigationExtract`

### Phase 2: Tab-first Navigation

- 改造 tab store：history 从 URL 字符串改为 `TabNavigationState[]`
- 实现 `TabNavigationApi`
- sidebar / tab bar / 页面入口统一走 tab navigation

### Phase 3: Canonical Route 收口

- App.tsx 增加 canonical route
- legacy route 只做解析和桥接
- `workspace-web` wrapper route 接入

### Phase 4: 全局面包屑

- 在 `AppLayout` 挂 `DesktopBreadcrumbBar`
- 页面停止手工传 `segments`
- 所有 breadcrumb 点击统一走 `popTo`

### Phase 5: 虚拟页面索引

- 静态 index 接入
- workspace pages / agents / executors 动态 branch 接入
- markdown 内容抽取接入
- dropdown 完成 hover sibling 菜单

### Phase 6: 清理 legacy

- 删除页面内散落的 `navigate()` 页面跳转
- 删除 query 风格 page/agent 依赖
- 保留最薄兼容层

## 验收标准

- 面包屑每一段都可点击。
- 面包屑本质是 stack，支持子页面 `pushPage()`。
- hover 任一段都有下拉菜单。
- sidebar、breadcrumb、tab bar 使用同一份虚拟页面索引。
- `WorkspaceAgentsPage` 的 canonical route 为 `/workspace/:workspaceId/agent`。
- `AgentDetailPage` 的 canonical route 为 `/workspace/:workspaceId/agent/:agentId`。
- 自定义页面 canonical route 为 `/workspace/:workspaceId/page/<slug>`。
- 外部网页走 `/workspace/:workspaceId/web?...` wrapper route。
- 页面切换都先更新 tab，再由 tab 同步 router。
- markdown 页面里的可导航 `Embed` / 提升后的 `Link` 能进入虚拟页面索引。
- 用户可以得到：
  `[icon] viben / [icon] 页面 / [icon] 我的自定义markdown页面 / [icon] 百度`
  且最终访问 `https://baidu.com`

## 风险

- 全局 workspace 最好也视为合法 workspace，否则 route 前缀仍会破裂。
- 外部网页可能受 `X-Frame-Options` / `CSP frame-ancestors` 限制，需要 webview/代理/系统浏览器降级策略。
- markdown 中不是所有链接都应该进入索引，必须靠 `includeInPageIndex` 规则控边界。
- tab 持久化需要做旧数据迁移。

## 结论

这次重构的核心不是“补一个可点击 breadcrumb”，而是统一四件事：

- view route
- virtual page index
- breadcrumb stack
- tab-first navigation

统一之后，notion-like 的全局面包屑、子页面 push、markdown 富 URL block 导航化，才会自然成立。
