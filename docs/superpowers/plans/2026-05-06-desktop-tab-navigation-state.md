# Desktop Tab Navigation State 完整迁移计划

> Spec: `docs/superpowers/specs/2026-05-06-desktop-tab-navigation-state-design.md`

## Goal

把 desktop tab 标题/图标、breadcrumb、router URL、copy link、detach window 全部收敛到当前 `navigationHistory[historyIndex]`。

必须落地的行为：

- sidebar / top-level path：`replace`
- 页面内进入子页面：`push`
- breadcrumb 祖先段：`popTo`，并保留 forward
- tab back / forward / history menu：只移动 `historyIndex`

## 探索结论

当前问题不是单个 bug，而是 tab state 混入了 breadcrumb leaf：

- `PageTab extends BreadcrumbStackItem`，所以 tab 顶层含有 `label/icon/descriptorId/meta/target/sourceNodeId/parentNodeId`
- `PageTab.history: string[]` 与 `PageTab.navigationHistory: TabNavigationState[]` 并存
- `usePageTabs` 在 `openLocation/replaceLocation/pushPage/resetStack/navigateTo` 中把 current leaf 双写到 tab 顶层
- `goBack/goForward/jumpToHistory` 只移动 `historyIndex`，不会同步 tab 顶层展示字段
- `GlobalBreadcrumbShell` 当前允许 registered header `segments/workspace` 覆盖 current navigation state
- `TabRouterBridge` 和 `home-redirect` 仍有旧 `history` fallback

因此迁移必须一次性移除旧字段和旧写入路径，不做旧结构兼容。

## Target Architecture

只保留一个主状态源：`tab-store`。

不新增：

- `breadcrumb-store`
- `router-store`
- `navigation-store`
- `presentation-store`
- `tab-title-store`

### `tab-store`

**Path**
- `apps/desktop/src/stores/tab-store.ts`

职责：

- 持有 `tabs`
- 持有 `activeTabId`
- 持有 `recentlyClosedTabs`
- 持有每个 tab 的 `historyIndex`
- 持有每个 tab 的 `navigationHistory`
- 提供 tab 原子动作

不负责：

- React Query cache
- workspace/page/agent 名称解析
- React Router navigate
- 页面局部选中态
- header slots
- tab 标题/图标持久化快照

### `usePageTabs`

**Path**
- `apps/desktop/src/hooks/use-page-tabs.ts`

职责：

- 收集 resolver context：workspace、pages，后续接入 agents/executors cache
- 调用 `resolveLocationNavigation(location, hints)`
- 把 `DesktopLocation` 解析成完整 `TabNavigationState`
- 调用 `tab-store` 原子动作
- 暴露 current entry 派生 helper

不负责：

- `updateTab + navigation` 双写
- 写 `PageTab.label/icon/descriptorId/meta/history`
- 页面局部选中态

### `useDesktopRouting`

**Path**
- `apps/desktop/src/hooks/use-desktop-routing.ts`

职责：

- 提供领域语义入口
- 判断导航意图
- 将页面行为映射为 `replace/push/popTo/jump`

页面组件优先使用 `useDesktopRouting`，不直接拼装 `TabNavigationState`。

### Rendering Projection

所有展示和 URL 都从 current entry 投影：

```text
current = tab.navigationHistory[tab.historyIndex]
leaf = current.breadcrumbStack.at(-1)

GlobalTabBar        <- leaf
GlobalBreadcrumb    <- current.breadcrumbStack
TabRouterBridge     <- locationToUrl(current.location)
copy link / detach  <- current.location
history menu        <- navigationHistory[].breadcrumbStack.at(-1)
```

## 字段迁移

### 当前字段

当前 `PageTab` 实际字段：

```ts
interface PageTab extends BreadcrumbStackItem {
  // inherited from BreadcrumbStackItem
  id: string;
  label: string;
  icon?: IconData;
  descriptorId?: string;
  sourceNodeId?: string;
  parentNodeId?: string;
  target?: ViewTarget;
  meta?: BreadcrumbStackItem["meta"];

  // own fields
  pinned: boolean;
  history: string[];
  historyIndex: number;
  navigationHistory: TabNavigationState[];
  viewMode?: PageViewMode;
}
```

### 完全移除的 `PageTab` 顶层字段

这些字段必须从目标 `PageTab` 类型、运行时写入、persisted state 中完全移除：

```ts
label
icon
descriptorId
meta
target
sourceNodeId
parentNodeId
history
```

说明：

- `label/icon/descriptorId/meta` 属于 current breadcrumb leaf，不属于 tab 容器。
- `target/sourceNodeId/parentNodeId` 属于 breadcrumb stack item，不属于 tab 容器。
- `history: string[]` 是旧 URL history，由 `navigationHistory[].location` 取代。

### 迁移后 `PageTab`

目标结构：

```ts
export interface PageTab {
  id: string;
  pinned: boolean;
  historyIndex: number;
  navigationHistory: TabNavigationState[];
  viewMode?: PageViewMode;
}
```

### 迁移后 `OpenTabInput`

目标结构：

```ts
interface OpenTabInput {
  pinned?: boolean;
  viewMode?: PageViewMode;
  navigationState: TabNavigationState;
}
```

规则：

- `navigationState` 必填。
- 新 tab 标题、图标、meta 从 `navigationState.breadcrumbStack.at(-1)` 派生。
- 不允许传 `label/icon/descriptorId/meta/history/target/sourceNodeId/parentNodeId`。

### 迁移后 `ClosedTabSnapshot`

目标结构不变，但内部 tab 使用新 `PageTab`：

```ts
export interface ClosedTabSnapshot {
  tab: PageTab;
  closedAt: number;
  originIndex: number;
}
```

### 迁移后 `TabState`

目标结构：

```ts
interface TabState {
  tabs: PageTab[];
  activeTabId: string | null;
  recentlyClosedTabs: ClosedTabSnapshot[];
}
```

### 派生展示结构

可以新增非持久化 helper 类型。它不是 store 实体，不写入 persisted state：

```ts
export interface TabViewModel {
  id: string;
  pinned: boolean;
  viewMode?: PageViewMode;
  historyIndex: number;
  navigationHistory: TabNavigationState[];
  currentState: TabNavigationState | null;
  currentLocation: DesktopLocation | null;
  label: string;
  icon?: IconData;
  descriptorId?: string;
  meta?: BreadcrumbStackItem["meta"];
  url: string | null;
}
```

`TabViewModel` 只在 selector/hook/UI 层临时计算。

## Task 1: Persisted Store 换 Key，不做 Migrate

**Files**
- `apps/desktop/src/stores/tab-store.ts`
- `apps/desktop/src/stores/tab-store.test.ts`

### 1.1 切换持久化存储

- [ ] 将 persist `name` 从旧 `viben-tab-store` 改为新 key，例如 `viben-tab-store-v2`。
- [ ] 不实现 Zustand `migrate`。
- [ ] 不定义旧 persisted tab 输入类型。
- [ ] 不读取旧 `viben-tab-store`。
- [ ] 不读取旧 `label/icon/descriptorId/meta/history/target/sourceNodeId/parentNodeId`。
- [ ] 删除现有 `merge` 中对旧字段的兼容职责；如仍需 `merge`，只能处理新结构。
- [ ] 新 persisted state 只允许：

```ts
{
  tabs: PageTab[];
  activeTabId: string | null;
  recentlyClosedTabs: ClosedTabSnapshot[];
}
```

### 1.2 初始状态规则

- [ ] 新 key 首次启动使用 `{ tabs: [], activeTabId: null, recentlyClosedTabs: [] }`。
- [ ] 如果必须有首屏 tab，由启动路由逻辑创建 documents tab；不要从旧 key 构造。
- [ ] 新 key 中的数据必须已经是新结构。
- [ ] 新 key 中若发现非法 tab，视为数据错误，可丢弃该 tab，但不得读取旧字段修复。

### 1.3 删除兼容函数

- [ ] 删除或重命名 `syncLegacyHistory`，不再生成 `history: string[]`。
- [ ] 删除 `coerceNavigationHistory` 从旧 `history` 反推 `navigationHistory` 的职责。
- [ ] 如果需要 runtime validate，只能校验新结构；发现非法 current entry 视为数据错误。

### 1.4 测试

- [ ] 旧 `viben-tab-store` 不参与恢复。
- [ ] 新 key 首次启动得到新初始状态。
- [ ] 新 key persisted state 正常恢复。
- [ ] 二次启动 persisted state 不含旧字段。
- [ ] 非法新结构 tab 被丢弃或触发明确错误路径。

## Task 2: Store 类型和动作收敛

**Files**
- `apps/desktop/src/stores/tab-store.ts`
- `apps/desktop/src/stores/tab-store.test.ts`

### 2.1 类型修改

- [ ] `PageTab` 不再 `extends BreadcrumbStackItem`。
- [ ] `PageTab` 删除 `label/icon/descriptorId/meta/target/sourceNodeId/parentNodeId/history`。
- [ ] `OpenTabInput` 改为 `{ pinned?: boolean; viewMode?: PageViewMode; navigationState: TabNavigationState }`。
- [ ] `updateTab` 不能再接受任意 `Partial<Omit<PageTab, "id">>`。
- [ ] 拆成明确动作：
  - `setViewMode(tabId, mode)`
  - `pinTab(tabId)`
  - `unpinTab(tabId)`
  - 如确有需要，`updateTabContainer(tabId, { pinned?, viewMode? })`

### 2.2 Store action 目标 API

建议目标：

```ts
interface TabActions {
  openTab(input: OpenTabInput): string;
  closeTab(tabId: string): void;
  closeOtherTabs(tabId: string): void;
  closeTabsToRight(tabId: string): void;
  closeAllTabs(): void;
  duplicateTab(tabId: string): string | null;
  reopenClosedTab(): string | null;
  restoreTab(tab: PageTab): void;

  setActiveTab(tabId: string): void;
  moveTab(fromIndex: number, toIndex: number): void;
  pinTab(tabId: string): void;
  unpinTab(tabId: string): void;
  setViewMode(tabId: string, mode: PageViewMode): void;

  replaceLocation(tabId: string, next: TabNavigationState): void;
  pushLocation(tabId: string, next: TabNavigationState): void;
  insertHistoryBeforeCurrent(tabId: string, next: TabNavigationState): void;
  jumpToHistory(tabId: string, index: number): void;
  goBack(tabId: string): void;
  goForward(tabId: string): void;
  canGoBack(tabId: string): boolean;
  canGoForward(tabId: string): boolean;
  getCurrentNavigationState(tabId: string): TabNavigationState | null;
}
```

### 2.3 历史行为

- [ ] `replaceLocation(tabId, next)` 替换 current entry，并截断 forward。
- [ ] `pushLocation(tabId, next)` 截断 forward 后追加。
- [ ] `insertHistoryBeforeCurrent(tabId, next)` 用于 breadcrumb 祖先不存在时插入父级 entry，保留原 current 作为 forward。
- [ ] `jumpToHistory/goBack/goForward` 只移动 `historyIndex`。
- [ ] `duplicateTab` 复制 `navigationHistory/historyIndex/viewMode`，新 tab `pinned=false`。
- [ ] `close/reopen/restore` 只保存和恢复新 `PageTab`。

## Task 3: Current Entry Selector / View Model

**Files**
- `apps/desktop/src/stores/tab-store.ts`
- `apps/desktop/src/hooks/use-page-tabs.ts`
- `apps/desktop/src/stores/tab-store.test.ts`

### 3.1 Helper

- [ ] 新增 `getTabCurrentState(tab: PageTab): TabNavigationState | null`。
- [ ] 新增 `getTabCurrentLeaf(tab: PageTab): BreadcrumbStackItem | null`。
- [ ] 新增 `getTabUrl(tab: PageTab): string | null`，内部使用 `locationToUrl(current.location)`。
- [ ] 新增 `getTabViewModel(tab: PageTab): TabViewModel` 或同等 selector。

### 3.2 派生规则

```text
label        <- leaf.label ?? current.location.kind
icon         <- leaf.icon
descriptorId <- leaf.descriptorId
meta         <- leaf.meta
url          <- locationToUrl(current.location)
```

- [ ] selector 不读取旧 `PageTab.label/icon/descriptorId/meta/history`。
- [ ] current entry 缺失时返回明确 fallback view model，并在测试中覆盖。
- [ ] `getCurrentUrl` 改为从 current location 派生，或重命名为 `getTabUrl`。

## Task 4: usePageTabs 收敛为 Resolver Facade

**Files**
- `apps/desktop/src/hooks/use-page-tabs.ts`
- `apps/desktop/src/navigation/location-navigation.ts`

### 4.1 删除旧字段写入

- [ ] 移除 `updateTab` 依赖。
- [ ] `openLocation` 不再构造 `nextTab = { label, icon, descriptorId, meta }`。
- [ ] `replaceLocation` 不再写 tab 顶层展示字段。
- [ ] `pushPage` 不再写 tab 顶层展示字段。
- [ ] `resetStack` 不再写 tab 顶层展示字段。
- [ ] `navigateTo` 不再走 `updateTab(input) + navigate(url)`。

### 4.2 新 API 行为

- [ ] `openLocation(location, options)` resolve 完整 `TabNavigationState`。
- [ ] 无 active tab 或 `openInNewTab` 时 `openTab({ navigationState, pinned, viewMode })`。
- [ ] 普通 top-level 打开时调用 `replaceLocation(activeTabId, navigationState)`。
- [ ] `pushPage(item, location, options)` 生成完整 next state 后调用 `pushLocation`。
- [ ] `replaceLocation(location, patch)` 必须传入完整 resolved state，不允许 store 默认继承旧 stack。
- [ ] `resetStack(next)` 明确是 replace 还是 push；默认 replace current entry，除非调用方显式要求 push。

### 4.3 URL / detach

- [ ] `getTabLink` 使用 `getCurrentNavigationState(tabId).location`。
- [ ] `detachTabToNewWindow` title 使用 current leaf label。
- [ ] `detachTabToNewWindow` route 使用 current location。
- [ ] `openWebUrl` 不再读 `activeTab.meta.workspaceId`，改从 current location 的 `workspaceId` 或 current leaf `meta.workspaceId` 派生。

## Task 5: useDesktopRouting 收敛为领域语义 Facade

**Files**
- `apps/desktop/src/hooks/use-desktop-routing.ts`
- `apps/desktop/src/components/layout/sidebar.tsx`
- `apps/desktop/src/components/navigation/desktop-breadcrumb-bar.tsx`

### 5.1 Top-level replace

- [ ] `openWorkspaceSection(workspaceId, section)` 默认 replace。
- [ ] `openWorkspaceHome(workspaceId)` 默认 replace。
- [ ] `openWorkspaceApps(workspaceId)` 默认 replace。
- [ ] sidebar/top-level path 调用面不得传 `stackMode: "push"`。
- [ ] 如果保留 `stackMode`, 只允许 `openChildLocation` 使用。

### 5.2 Child push

- [ ] `openChildLocation` 在 same workspace 且 current stack 存在时默认 push。
- [ ] 页面内详情、编排、设置、web wrapper 等子页面使用 push。
- [ ] push 前截断 forward。
- [ ] 显式完整 `breadcrumbStack` 优先。

### 5.3 Breadcrumb popTo

- [ ] breadcrumb 祖先段点击不再普通 push。
- [ ] 根据被点击段的 `target.location` 生成目标 state。
- [ ] 在当前 index 之前查找 location 匹配的 history entry。
- [ ] 找到：`jumpToHistory(matchedIndex)`，不截断 forward。
- [ ] 找不到：`insertHistoryBeforeCurrent(targetState)`，不截断原 current。
- [ ] 从 popTo 后进入新子页面时按 push 截断旧 forward。

### 5.4 History jump

- [ ] `goBack/goForward/jumpToHistory` 只移动 `historyIndex`。
- [ ] 不触发任何 tab 顶层展示字段同步。

## Task 6: UI / Router 读取源替换

**Files**
- `apps/desktop/src/components/global-tab-bar/index.tsx`
- `apps/desktop/src/components/global-tab-bar/sortable-tab-item.tsx`
- `apps/desktop/src/components/navigation/tab-router-bridge.tsx`
- `apps/desktop/src/pages/home-redirect.tsx`
- `apps/desktop/src/hooks/use-global-shortcuts.ts`

### 6.1 GlobalTabBar

- [ ] `SortableTabItem` 不再读 `tab.label/tab.icon/tab.descriptorId`。
- [ ] 传入 `TabViewModel` 或 `presentation`。
- [ ] 常规 tab 标题使用 current leaf label。
- [ ] pinned tooltip 使用 current leaf label。
- [ ] 图标使用 current leaf icon / descriptor fallback。
- [ ] 新建 tab 时不再传 `label/descriptorId/icon`，而是传 documents 的 `navigationState`。

### 6.2 History menu

- [ ] 保持从 `navigationHistory[].breadcrumbStack.at(-1)` 派生 label。
- [ ] 确认不再读旧 `history`。

### 6.3 TabRouterBridge

- [ ] `targetUrl` 只读 `activeTab.navigationHistory[historyIndex].location`。
- [ ] 删除 `activeTab.history[historyIndex]` fallback。
- [ ] 无 active tab 时 `openTab` 只传 `navigationState`。
- [ ] URL 变化时写完整 `TabNavigationState`，不写 tab 顶层展示字段。

### 6.4 HomeRedirect

- [ ] 删除 `activeTab.history[activeTab.historyIndex]`。
- [ ] 改读 current location/url。

### 6.5 Global shortcuts

- [ ] 新建 tab shortcut 不再传 `label/descriptorId/icon`。
- [ ] 使用 documents location resolve 后的 `navigationState`。

## Task 7: Header 主 Breadcrumb 收敛

**Files**
- `apps/desktop/src/components/navigation/navigation-shell.tsx`
- `apps/desktop/src/components/workspace/workspace-header.tsx`
- `apps/desktop/src/components/navigation/desktop-breadcrumb-bar.tsx`

### 7.1 NavigationShell

- [ ] current entry 合法时，主 breadcrumb 的 workspace/root/segments/leaf 全部来自 current `breadcrumbStack`。
- [ ] registered `workspace` 不覆盖 current navigation state 的 workspace。
- [ ] registered `segments` 不覆盖 current navigation state 的 segments。
- [ ] registered segments 只作为异常空状态 fallback。
- [ ] center/right slot、刷新按钮、工具栏、className 保持可注册。

### 7.2 WorkspaceHeader

- [ ] `WorkspaceHeader segments` 标记为非主链路 API。
- [ ] 梳理所有传 `segments` 的页面。
- [ ] 需要改变主 breadcrumb 的页面，改为通过 navigation action 写 `breadcrumbStack`。
- [ ] 页面切换后旧 registered segments 不残留。

### 7.3 DesktopBreadcrumbBar

- [ ] 当前 section、area、page slug、settings section 从 current navigation segments 推导。
- [ ] breadcrumb dropdown 点击祖先段走 `popTo` 语义。
- [ ] dropdown 选择同级 section/top-level path 走 replace。

## Task 8: 智能体「编排」链路

**Files**
- `apps/desktop/src/pages/agents/workspace-agents.tsx`
- `apps/desktop/src/navigation/location-navigation.ts`
- optional: agents/executors query key 文件

- [ ] 选中「个人助手」只更新页面局部 state。
- [ ] 点击「编排」调用：

```ts
openWorkspaceAgentDetail(workspace.id, agent.id, {
  title: agent.name,
  icon: { type: "lucide", value: "bot" },
});
```

- [ ] `resolveLocationNavigation` 生成 leaf label 优先使用实体名称。
- [ ] 无名称时 fallback 到 id。
- [ ] 后续接入 agents/executors cache，减少 id fallback。
- [ ] 验证：

```text
sidebar 智能体 -> tab/breadcrumb = 智能体
选中个人助手 -> tab/breadcrumb 不变
编排 -> tab/breadcrumb = 个人助手
breadcrumb 智能体 -> 回列表，forward 可回个人助手
```

## Task 9: 全局搜索和删除清单

迁移完成后，以下搜索应无运行时命中。

### 9.1 禁止出现在 `PageTab`

```text
extends BreadcrumbStackItem
label:
icon:
descriptorId:
meta:
target:
sourceNodeId:
parentNodeId:
history:
```

说明：这些字段仍可出现在 `BreadcrumbStackItem` 和普通 UI 局部类型中，但不能出现在 `PageTab`、`OpenTabInput`、store runtime action 里。

### 9.2 禁止运行时调用

```text
syncLegacyHistory
coerceNavigationHistory
activeTab.history
tab.history
activeTab.meta
tab.label
tab.icon
tab.descriptorId
updateTab(activeTabId, { label
updateTab(activeTabId, { icon
```

### 9.3 允许位置

- `BreadcrumbStackItem`
- breadcrumb stack item 构造
- 普通非 tab UI 的 `label/icon/meta` 字段

## Task 10: Verification

### 10.1 Store tests

- [ ] 旧 `viben-tab-store` 不参与恢复
- [ ] 新 key persisted state 正常恢复
- [ ] recently closed restore 只使用新结构
- [ ] duplicate tab
- [ ] close other/right/all
- [ ] replace 不继承旧 stack
- [ ] push 截断 forward
- [ ] breadcrumb popTo 保留 forward
- [ ] breadcrumb popTo 无祖先 entry 时插入父级 entry
- [ ] back/forward/history jump 不读写旧字段
- [ ] 二次启动 persisted state 不再含旧字段

### 10.2 Interaction tests

- [ ] sidebar 点击「智能体」
- [ ] 选中「个人助手」
- [ ] 点击「编排」
- [ ] 点击 breadcrumb「智能体」
- [ ] tab forward 回「个人助手」
- [ ] 从「智能体」进入另一个子页面并确认旧 forward 被截断
- [ ] copy link 对应 current entry
- [ ] detach window title/URL 对应 current entry
- [ ] header segments 不覆盖主 breadcrumb
- [ ] new tab / duplicate / restore 后 tab title 和 breadcrumb 一致

### 10.3 Build

- [ ] `pnpm typecheck`
- [ ] `pnpm build`
