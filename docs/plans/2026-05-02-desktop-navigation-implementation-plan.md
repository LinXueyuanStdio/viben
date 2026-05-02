# Desktop Navigation 实施计划

**日期**: 2026-05-02
**对应规格**: [desktop-navigation.md](../specs/modules/desktop/desktop-navigation.md)
**目标**: 落地 Desktop 全局导航体系，统一 tab-first 导航、共享 breadcrumb、虚拟页面索引、markdown 子页面 push、`viben://` deep link。

## 1. 实施目标

- 建立统一的 `DesktopLocation` / `DesktopRouteRef` / `NavigationIndex` / `NavigationStack` 模型
- 所有 desktop 页面切换统一走 `NavigationController`，而不是业务侧直接 `navigate()`
- 对业务组件提供统一的 `useDesktopRouting()` hook 作为唯一路由入口
- 全局只渲染一份 breadcrumb / header shell
- sidebar、breadcrumb、tab、dropdown、page tree 使用同一份 title/icon 数据源
- markdown 页面支持 push 子页面和外部 web leaf
- `viben://` deep link 与应用内点击共享同一套打开逻辑

## 2. 范围

### In Scope

- `apps/desktop/src/App.tsx`
- `apps/desktop/src/stores/tab-store.ts`
- `apps/desktop/src/hooks/use-page-tabs.ts`
- `apps/desktop/src/components/global-tab-bar/index.tsx`
- `apps/desktop/src/components/layout/app-layout.tsx`
- `apps/desktop/src/components/layout/sidebar.tsx`
- `apps/desktop/src/components/workspace/workspace-header.tsx`
- `apps/desktop/src/components/navigation/*`
- `apps/desktop/src/navigation/*`
- `apps/desktop/src/pages/apps/workspace-page.tsx`
- `apps/desktop/src/pages/apps/components/page-preview.tsx`
- `apps/desktop/src/pages/apps/components/yoopta-markdown-renderer.tsx`
- `apps/desktop/src/pages/apps/components/yoopta-plugins.ts`
- `apps/desktop/src/pages/apps/utils/page-href.ts`
- `apps/desktop/src/pages/workspace-web.tsx`
- `apps/desktop/src/pages/workspace-files.tsx`
- `apps/desktop/src/pages/agents/workspace-agents.tsx`
- `apps/desktop/src/pages/agents/agent-detail.tsx`
- `apps/desktop/src/pages/settings/*`
- `apps/desktop/src-tauri/src/lib.rs`

### Out of Scope

- 大规模视觉改版
- 一次性删除全部 legacy route
- 让所有页面内部局部状态都 URL 化
- markdown 内容模型重做

## 3. 实施原则

### 单一导航入口

业务侧禁止直接把 router 当作业务导航入口。

统一入口为：

- `NavigationController.openMount()`
- `NavigationController.openStack()`
- `NavigationController.replaceStack()`
- `NavigationController.pushMount()`
- `NavigationController.openExternalUnderCurrentMount()`
- `NavigationController.handleDeepLink()`

组件侧统一入口为：

- `useDesktopRouting()`

业务层优先调用语义化 API，例如：

- `openSettings("general")`
- `openWorkspaceAgentDetail(workspaceId, agentId)`
- `openWorkspacePage(workspaceId, pageSlug)`
- `openCurrentPageWeb(url, { title })`

只有基础设施层或复杂上下文恢复场景才直接调用：

- `openMount()`
- `openStack()`
- `replaceStack()`
- `pushMount()`

### 单一展示来源

禁止在以下地方持久化 title/icon/breadcrumb string 作为真值：

- tab store
- sidebar item state
- breadcrumb segment state
- settings section breadcrumb helper

title/icon/href 统一由 `NavigationResolver` 从 `NavigationIndex` 实时解析。

### Route 与树解耦

- `DesktopLocation` 只负责视图身份
- `NavigationMount` 只负责逻辑树位置
- `NavigationStack` 只负责当前 tab 的逻辑上下文

### Tab-first

默认动作是“打开或聚焦 tab”，而不是“直接切 route”。

router 退化为 active tab 的投影层。

## 4. 模块边界

### Navigation Core

负责：

- `DesktopLocation`
- `DesktopRouteRef`
- canonical route parse / serialize
- `TabNavigationState`
- `NavigationController`
- `useDesktopRouting()`
- tab dedupe / open / replace / push

统一 hook 目标接口：

```ts
interface DesktopRoutingApi {
  currentTab: TabNavigationState | null;
  currentRoute: DesktopLocation | null;
  currentStack: NavigationStack;
  breadcrumb: NavigationDescriptor[];
  currentDescriptor: NavigationDescriptor | null;

  openWorkspaceHome(workspaceId: string, options?: DesktopOpenOptions): void;
  openWorkspaceSection(workspaceId: string, section: WorkspaceSection, options?: DesktopOpenOptions): void;
  openWorkspaceAgentList(workspaceId: string, options?: DesktopOpenOptions): void;
  openWorkspaceAgentDetail(workspaceId: string, agentId: string, options?: DesktopOpenOptions): void;
  openWorkspaceExecutorDetail(workspaceId: string, executorType: string, options?: DesktopOpenOptions): void;
  openWorkspacePage(workspaceId: string, pageSlug: string, options?: DesktopOpenOptions): void;
  openWorkspaceWeb(workspaceId: string, input: { url: string; title?: string; webId?: string; preferredMountId?: NavigationMountId }, options?: DesktopOpenOptions): void;
  openSettings(section?: SettingsSection | string, options?: DesktopOpenOptions): void;

  pushChildPage(mountId: NavigationMountId, options?: DesktopOpenOptions): void;
  pushCurrentPageChild(pageSlug: string, options?: DesktopOpenOptions): void;
  openCurrentPageWeb(url: string, input?: { title?: string; icon?: IconData; webId?: string }, options?: DesktopOpenOptions): void;

  openRoute(route: DesktopLocation, options?: DesktopOpenOptions): void;
  focusOrOpenRoute(route: DesktopLocation, options?: DesktopOpenOptions): void;
  openMount(mountId: NavigationMountId, options?: DesktopOpenOptions): void;
  openStack(stack: NavigationStack, options?: DesktopOpenOptions): void;
  replaceStack(stack: NavigationStack): void;
  pushMount(mountId: NavigationMountId): void;
  handleDeepLink(intent: DesktopDeepLinkIntent): void;
  canGoBack: boolean;
  canGoForward: boolean;
  goBack(): void;
  goForward(): void;
  closeCurrentTab(): void;
  setHeaderCenter(content: ReactNode | null): void;
  setHeaderRight(content: ReactNode | null): void;
  clearHeaderSlots(): void;
}
```

```ts
interface DesktopOpenOptions {
  preferredMountId?: NavigationMountId;
  preferredStack?: NavigationStack;
  openMode?: "focus" | "reuse" | "new-tab";
}
```

建议文件：

- `apps/desktop/src/navigation/desktop-location.ts`
- `apps/desktop/src/navigation/desktop-route-ref.ts`
- `apps/desktop/src/navigation/navigation-controller.ts`
- `apps/desktop/src/navigation/navigation-stack.ts`
- `apps/desktop/src/hooks/use-desktop-routing.ts`
- `apps/desktop/src/navigation/tab-router-bridge.tsx`

### Navigation Index

负责：

- `NavigationNode`
- `NavigationMount`
- `NavigationIndex`
- route -> mount lookup
- page/web/runtime mount registration
- settings / workspace / page / markdown / web 节点合并

建议文件：

- `apps/desktop/src/navigation/navigation-index.ts`
- `apps/desktop/src/navigation/navigation-registry.ts`
- `apps/desktop/src/navigation/navigation-runtime.ts`

### Navigation Resolver

负责：

- title/icon/i18n 解析
- breadcrumb/tab/sidebar/dropdown/tree descriptor 解析

建议文件：

- `apps/desktop/src/navigation/navigation-resolver.ts`
- `apps/desktop/src/navigation/navigation-meta.ts`

### Shell UI

负责：

- global breadcrumb bar
- breadcrumb dropdown
- workspace header center/right slots
- sidebar 接入 controller

建议文件：

- `apps/desktop/src/components/navigation/desktop-breadcrumb-bar.tsx`
- `apps/desktop/src/components/navigation/breadcrumb-dropdown.tsx`
- `apps/desktop/src/components/workspace/workspace-header.tsx`

### Page / Markdown Integration

负责：

- `workspace-page`
- `page-preview`
- markdown 子页面 push
- web leaf 打开
- `pages/**/SKILL.md` 导航挂载

建议文件：

- `apps/desktop/src/navigation/page-navigation-extractor.ts`
- `apps/desktop/src/pages/apps/workspace-page.tsx`
- `apps/desktop/src/pages/apps/components/page-preview.tsx`
- `apps/desktop/src/pages/apps/components/yoopta-markdown-renderer.tsx`

### Deep Link Integration

负责：

- `viben://` parse
- `DesktopDeepLinkIntent`
- Tauri emit
- frontend open/focus tab

建议文件：

- `apps/desktop/src/navigation/deep-link.ts`
- `apps/desktop/src/hooks/use-desktop-deep-link.ts`
- `apps/desktop/src-tauri/src/lib.rs`

## 5. 执行阶段

### Phase 0: 类型冻结与命名收口

**Owner**: 主控

任务：

1. 以 spec 为准冻结以下公开名称：
   - `DesktopLocation`
   - `DesktopRouteRef`
   - `NavigationNode`
   - `NavigationMount`
   - `NavigationStack`
   - `NavigationIndex`
   - `NavigationDescriptor`
   - `DesktopDeepLinkIntent`
   - `NavigationController`
   - `DesktopRoutingApi`
2. 清理旧术语：
   - `segments`
   - `BreadcrumbStackItem`
   - `VirtualPageIndex`
   - `ViewTarget`
   - `NavigationCatalog`
3. 补齐导航模块骨架与导出边界

完成标准：

- 导航层命名不再漂移
- 新旧模块边界清晰

### Phase 1: Navigation Core 与 Tab Store

**Owner**: 子 agent A

任务：

1. 实现 `DesktopLocation` parse / serialize
2. 实现 `DesktopRouteRef` 序列化规则
3. 定义 `TabNavigationState`
4. 改造 `tab-store`：
   - 不再存最终 title
   - 存 `routeRef`
   - 存 `primaryMountId`
   - 存 `navigationStack`
5. 实现 `NavigationController` 基础能力：
   - `openMount`
   - `openStack`
   - `replaceStack`
   - `pushMount`
6. 实现 active tab -> router 的 bridge
7. 实现 router / legacy url -> canonical `DesktopLocation` 的 parse
8. 迁移 `use-page-tabs.ts` 到 controller 模式
9. 提供统一业务 hook `useDesktopRouting()`

写入范围：

- `apps/desktop/src/navigation/desktop-location.ts`
- `apps/desktop/src/navigation/desktop-route-ref.ts`
- `apps/desktop/src/navigation/navigation-controller.ts`
- `apps/desktop/src/navigation/navigation-stack.ts`
- `apps/desktop/src/hooks/use-desktop-routing.ts`
- `apps/desktop/src/navigation/tab-router-bridge.tsx`
- `apps/desktop/src/stores/tab-store.ts`
- `apps/desktop/src/hooks/use-page-tabs.ts`
- `apps/desktop/src/components/global-tab-bar/index.tsx`
- `apps/desktop/src/components/layout/app-layout.tsx`
- `apps/desktop/src/App.tsx`

完成标准：

- router 只反映 active tab
- 业务 API 不再直接依赖 `navigate()`
- 业务页面不需要直接碰 tab store / resolver / router
- legacy route 可解析为 canonical `DesktopLocation`

### Phase 2: Navigation Index 与 Resolver

**Owner**: 主控 + 子 agent A 协作

任务：

1. 建立系统节点与 mount：
   - workspace root
   - workspace sections
   - settings root / sections
   - agent / executor detail
2. 建立 route -> primary mount lookup
3. 建立 page / web / runtime mount 注册接口
4. 实现 resolver：
   - `resolveNavigationMount`
   - `resolveNavigationPath`
   - `resolveNavigationChildren`
5. 收口 title/icon 解析到统一入口
6. 清理 breadcrumb/title 里散落的硬编码英文

写入范围：

- `apps/desktop/src/navigation/navigation-index.ts`
- `apps/desktop/src/navigation/navigation-registry.ts`
- `apps/desktop/src/navigation/navigation-runtime.ts`
- `apps/desktop/src/navigation/navigation-resolver.ts`
- `apps/desktop/src/navigation/navigation-meta.ts`
- `apps/desktop/src/navigation/breadcrumb-stack.ts`

完成标准：

- settings / workspace / page 的 title 与 icon 来源统一
- breadcrumb / sidebar / tab / dropdown 可共用 resolver

### Phase 3: Shell Header / Breadcrumb / Sidebar

**Owner**: 子 agent B

任务：

1. 全局只保留一份 `desktop-breadcrumb-bar`
2. 接入 breadcrumb 点击截断 `NavigationStack`
3. 实现 breadcrumb hover dropdown
4. sidebar 所有入口统一走 `NavigationController`
4. sidebar / settings / breadcrumb / page actions 在组件层统一调用 `useDesktopRouting()`
5. `WorkspaceHeader` 改为纯 header slot 容器：
   - `centerContent`
   - `rightContent`
6. 页面级 header 接口迁移：
   - agent detail tabs 放到 `centerContent`
   - chat 右上角按钮放到 `rightContent`
7. 去掉页面自己拼 breadcrumb / header title 的逻辑

写入范围：

- `apps/desktop/src/components/navigation/desktop-breadcrumb-bar.tsx`
- `apps/desktop/src/components/navigation/breadcrumb-dropdown.tsx`
- `apps/desktop/src/components/layout/sidebar.tsx`
- `apps/desktop/src/components/workspace/workspace-header.tsx`
- `apps/desktop/src/components/workspace/workspace-breadcrumb.tsx`
- `apps/desktop/src/pages/conversation/workspace-chat.tsx`
- `apps/desktop/src/pages/agents/agent-detail.tsx`
- `apps/desktop/src/pages/workspace-files.tsx`
- `apps/desktop/src/pages/agents/workspace-agents.tsx`
- `apps/desktop/src/pages/settings/*`

完成标准：

- sidebar 点击稳定跳转
- breadcrumb 每段可点
- dropdown 按 mount sibling 展示
- header 布局固定为：
  `[tabs]`
  `[sidebar][WorkspaceHeader]`
  `[sidebar][page]`

### Phase 4: Page Tree / Markdown / Web Leaf

**Owner**: 子 agent C

任务：

1. 建立 `page-navigation-extractor`
2. 从 markdown / page 内容抽取可挂载导航节点
3. 支持 markdown 子页面 push：
   - page -> child page
   - page -> external web
   - 页面代码统一通过 `useDesktopRouting()` 调用
4. 接入 `page-preview.tsx`
5. 建立 `workspace-web` page
6. `page-href` 改为 canonical workspace page route
7. 允许 `pages/**/SKILL.md` 注入导航节点元数据

写入范围：

- `apps/desktop/src/navigation/page-navigation-extractor.ts`
- `apps/desktop/src/pages/workspace-web.tsx`
- `apps/desktop/src/pages/apps/workspace-page.tsx`
- `apps/desktop/src/pages/apps/components/page-preview.tsx`
- `apps/desktop/src/pages/apps/components/yoopta-markdown-renderer.tsx`
- `apps/desktop/src/pages/apps/components/yoopta-plugins.ts`
- `apps/desktop/src/pages/apps/utils/page-href.ts`
- `apps/desktop/src/lib/gateway/modules/pages.ts`

完成标准：

- markdown 可 push 子页面到 `NavigationStack`
- web page 可作为 leaf 挂到任意父 mount 下
- page tree 可比 route 更自由

### Phase 5: Deep Link

**Owner**: 子 agent D

任务：

1. 实现 `parseVibenDeepLink()`
2. 定义 `DesktopDeepLinkIntent`
3. Tauri 侧把 OAuth-only deep link handler 升级为通用 dispatcher
4. 前端监听 deep link event
5. deep link 统一走 `useDesktopRouting().handleDeepLink()`
6. 实现打开模式：
   - `focus`
   - `reuse`
   - `new-tab`
7. 支持 mount / stack hint

写入范围：

- `apps/desktop/src/navigation/deep-link.ts`
- `apps/desktop/src/hooks/use-desktop-deep-link.ts`
- `apps/desktop/src/components/layout/app-layout.tsx`
- `apps/desktop/src-tauri/src/lib.rs`

完成标准：

- `viben://settings/general` 可打开设置页
- `viben://workspace/123/agent/personal-assistant` 可打开 agent detail
- `viben://workspace/123/page/docs/spec` 可打开 page
- `viben://workspace/123/web?...` 可按 hint 恢复逻辑 breadcrumb 上下文

### Phase 6: 集成、清理、回归

**Owner**: 主控

任务：

1. 合并所有 controller / index / resolver 接口
2. 清理直接业务 `navigate()` 调用
3. 清理旧 breadcrumb string 模型
4. 清理 header 重复渲染
5. 补手工回归清单
6. 运行 typecheck / smoke check

完成标准：

- route / tab / stack / mount / descriptor 关系闭合
- 无明显重复的 breadcrumb 来源
- 语言切换下 settings / workspace breadcrumb 不再漂移

## 6. 子 agent 切片

### 子 agent A: Core

负责：

- location
- route ref
- controller
- unified routing hook
- tab store
- router bridge

禁止修改：

- `yoopta-*`
- `workspace-web.tsx`
- `sidebar.tsx`
- `workspace-header.tsx`

### 子 agent B: Shell

负责：

- breadcrumb bar
- dropdown
- sidebar
- workspace header slots
- settings / workspace shell 页面接入

禁止修改：

- `tab-store.ts`
- `desktop-location.ts`
- `deep-link.ts`
- `yoopta-*`

### 子 agent C: Page Tree

负责：

- page extractor
- workspace page
- page preview
- markdown renderer
- workspace web leaf

禁止修改：

- `tab-store.ts`
- `sidebar.tsx`
- `workspace-header.tsx`

### 子 agent D: Deep Link

负责：

- `parseVibenDeepLink`
- Tauri deep link dispatcher
- frontend deep link listener

禁止修改：

- `yoopta-*`
- `workspace-page.tsx`
- `sidebar.tsx`

## 7. 并行执行顺序

1. 主控先完成 Phase 0
2. 子 agent A 先跑 Phase 1
3. 主控补 Phase 2 的 index/resolver skeleton
4. 子 agent B / C / D 并行
5. 主控做 Phase 6 集成

并行前置条件：

- `DesktopLocation`
- `DesktopRouteRef`
- `NavigationStack`
- `NavigationController` 接口签名
- `DesktopRoutingApi` 接口签名
- `WorkspaceHeader` slots 接口签名

## 8. 迁移约束

### 业务侧禁止事项

- 不得把最终 breadcrumb string 写入 tab store
- 不得在页面里手工维护一份 settings/page title
- 不得点击 sidebar 后直接 `navigate(...)`
- 不得把 deep link 直接翻译成 router push 而跳过 tab 层
- 不得在业务组件里同时直接依赖 router、tab store、resolver 三者

### 兼容策略

- legacy route 只做 parse，不再作为新入口生成
- 对旧 tab 持久化结构做一次迁移
- `workspace-web` 提供 CSP 失败时的降级打开策略

## 9. 手工验证清单

### Shell

- 点击 sidebar 的工作区项可以稳定打开对应 tab
- 点击 sidebar 的设置项时，breadcrumb 与页面标题翻译一致
- breadcrumb 每个 segment 都可点击
- hover breadcrumb segment 出现 sibling dropdown

### Tabs

- 通过 sidebar 打开的页面走 tab-first
- 重复打开同一路由会按 dedupe 规则 focus 或复用
- back / forward 不破坏当前 tab 的 `NavigationStack`

### Markdown / Page

- markdown 页面打开子页面时 breadcrumb 深度正确
- markdown 页面打开外部网页时 breadcrumb 保留父页面上下文
- 同一 page 在不同父节点下可有不同 breadcrumb

### Deep Link

- `viben://settings/general`
- `viben://workspace/123/agent`
- `viben://workspace/123/agent/personal-assistant`
- `viben://workspace/123/page/docs/spec`
- `viben://workspace/123/web?url=https%3A%2F%2Fbaidu.com&title=%E7%99%BE%E5%BA%A6`

以上 deep link 都必须进入 tab 层，而不是直接裸切 route。

### Header Slots

- chat 页右上角按钮出现在 `WorkspaceHeader.rightContent`
- agent detail 编排页 tabs 出现在 `WorkspaceHeader.centerContent`
- 中栏自己的 title bar 不得被错误挪到全局 breadcrumb 同一行
- 页面注册 header slots 时统一经过 `useDesktopRouting()`

## 10. 风险

- tab 持久化迁移可能导致旧数据兼容问题
- settings / workspace / page 三套标题源合并时容易出现旧英文残留
- markdown 抽取如果太激进，会污染全局导航索引
- web leaf 受外部站点 CSP 约束，需要降级方案
- deep link 若不通过 controller 容易再次出现双状态源

## 11. 交付物

- 规格：
  [desktop-navigation.md](../specs/modules/desktop/desktop-navigation.md)

- 旧设计讨论：
  [2026-05-02-desktop-global-breadcrumb-tab-routing-refactor.md](./2026-05-02-desktop-global-breadcrumb-tab-routing-refactor.md)

- 当前实施计划：
  [2026-05-02-desktop-navigation-implementation-plan.md](/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/docs/plans/2026-05-02-desktop-navigation-implementation-plan.md)
