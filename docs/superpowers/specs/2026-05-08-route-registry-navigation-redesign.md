# Route Registry 导航系统重设计

> 日期：2026-05-08
> 状态：设计稿
> 范围：`apps/desktop/src/navigation/`

## 1. 动机

当前导航系统存在以下问题：

1. **三层间接**：`BreadcrumbItemDescriptor`（静态元数据）→ `DesktopLocation`（带 kind 判别式的运行时状态）→ `BreadcrumbStackItem`（渲染实例），通过 `descriptorId` 字符串反向关联
2. **手工双向映射**：`locationToUrl` / `urlToLocation` 各 18 个 case 的 switch，往返一致性靠人肉维护
3. **BrowserRouter 路由定义重复**：`App.tsx` 中的 Route path 与 `navigation-meta.ts` 中的 pattern 分别维护
4. **新增路由成本高**：需要修改 DesktopLocation union + locationToUrl switch + urlToLocation switch + breadcrumb switch + descriptor 数组

## 2. 设计目标

- **单一真相源**：一张 Route Registry 同时承担 Descriptor、Codec、Breadcrumb Meta 三重职责
- **往返一致性由构造保证**：`match` 和 `build` 共享同一 pattern 定义
- **移除 `kind` 判别式**：`DesktopLocation` 类型完全移除，URL 即 identity
- **保留 breadcrumb stack**：作为 runtime titles/icons 的缓存，支持 per-tab 历史
- **冷启动自动推导**：从路径前缀自动构建祖先链，rest param 自动逐段展开
- **零歧义路由**：每个 workspace section 是独立 pattern（常量 segment），无需 guard

## 3. 核心数据结构

### 3.1 RouteEntry

```typescript
export interface RouteEntry<
  TParams extends Record<string, string> = Record<string, string>
> {
  /**
   * URL pattern，同时兼任唯一标识（替代原 BreadcrumbItemDescriptor.id + routePath）
   *
   * 语法：
   * - :param     单路径段（匹配 [^/]+）
   * - :param+    rest 参数（匹配 .+，跨多段）
   *
   * 示例："/workspace/:workspaceId/pages/:pageSlug+"
   */
  pattern: string;

  /**
   * 图标：静态值或从 params 动态派生
   */
  icon: IconData | ((params: TParams) => IconData);

  /**
   * 标题：静态值或从 params 动态派生
   * 运行时可被 breadcrumb override 覆盖（如 API 返回的 agent 显示名）
   */
  title: string | ((params: TParams) => string);

  /** i18n key，用于静态标题的多语言（可选） */
  titleKey?: string;

  /** 是否是容器节点（可展开子项） */
  isContainer?: boolean;

  /**
   * Query params 声明
   * 声明后 match/build 会自动处理 search params 的提取和拼接
   */
  queryParams?: string[];

  /**
   * Dropdown 分类标签
   * 用于 breadcrumb dropdown 的 rule dispatch（替代原 descriptorId 前缀匹配）
   */
  dropdownCategory?: string;
}
```

**注意**：无 `parent` / `ancestors` 字段。祖先关系有两种来源：
- **正常导航**：caller 显式构建 breadcrumb stack，存入 TabNavigationState
- **冷启动（deep link / URL 直接访问）**：从路径前缀自动推导 + rest param 逐段展开

### 3.2 RouteMatch

```typescript
export interface RouteMatch {
  /** 匹配到的 pattern（即 RouteEntry 的唯一标识） */
  pattern: string;
  /** 从 URL 中解析出的参数 */
  params: Record<string, string>;
  /** 解析后的 icon */
  icon: IconData;
  /** 解析后的 title */
  title: string;
  /** 原始 RouteEntry 引用 */
  entry: RouteEntry;
}
```

### 3.3 TabNavigationState（简化后）

```typescript
export interface TabNavigationState {
  /**
   * URL 即 identity，替代原 DesktopLocation。
   *
   * 规范化规则：
   * - 包含 pathname + 声明的 query params（按 RouteEntry.queryParams 声明顺序排列）
   * - 不含 hash
   * - 不含未声明的 query params
   * - 由 registry.build() 生成，保证 canonical 格式
   *
   * 示例："/workspace/x/web?url=https%3A%2F%2Fa.com&title=Test"
   */
  url: string;
  /** Breadcrumb stack（caller 构建 + 缓存 runtime titles） */
  breadcrumbStack: BreadcrumbStackItem[];
  /** 活跃节点 ID */
  activeNodeId?: string;
  /** 活跃索引路径 */
  activeIndexPath?: string[];
}
```

### 3.4 BreadcrumbStackItem（简化后）

```typescript
export interface BreadcrumbStackItem {
  id: string;
  label: string;
  icon?: IconData;
  /** 匹配到的 route pattern（替代原 descriptorId） */
  pattern?: string;
  /** 导航目标 URL（替代原 ViewTarget.canonicalUrl） */
  href?: string;
  sourceNodeId?: string;
  parentNodeId?: string;
  meta?: {
    workspaceId?: string;
    section?: string;
    pageSlug?: string;
    agentId?: string;
    executorType?: string;
    webId?: string;
    url?: string;
    blockId?: string;
  };
}
```

**移除的类型**：
- `DesktopLocation`（整个 discriminated union）
- `ViewTarget`（被 `href: string` 替代）
- `BreadcrumbItemDescriptor`（合并入 RouteEntry）
- `WorkspaceSectionDescriptor`（合并入 RouteEntry，section 成为 pattern 的常量段）
- `SettingsSectionDescriptor`（合并入 RouteEntry）

## 4. Route Registry（完整路由表）

### 4.1 顶级路由

| Pattern | Icon | Title | Category |
|---------|------|-------|----------|
| `/documents` | file-text | Documents | root |
| `/devices/pair` | smartphone | Devices | root |
| `/workspace` | home | Workspaces | root |
| `/mcp-services` | server | MCP Services | root (container) |
| `/mcp-services/dashboard` | layout-dashboard | Dashboard | mcp-section |
| `/mcp-services/data-sources` | database | Data Sources | mcp-section |
| `/mcp-services/search-service` | search | Search Service | mcp-section |
| `/mcp-services/page-debug` | bug | Page Debug | mcp-section |
| `/mcp-services/logs` | scroll-text | Logs | mcp-section |
| `/publish` | upload | Publish | root |
| `/my-packages` | package | My Packages | root |
| `/analytics` | chart-column | Analytics | root |

`/mcp-services` 作为容器路由，运行时重定向到 `/mcp-services/dashboard`。冷启动时为所有 MCP 子页面提供 "MCP Services" 祖先 breadcrumb。

### 4.2 Settings

| Pattern | Icon | Title | Category | isContainer |
|---------|------|-------|----------|-------------|
| `/settings` | settings | Settings | root | true |
| `/settings/:section` | 动态(section) | 动态(section) | settings | — |

合法 section 值：`general`, `account`, `shortcuts`, `notifications`, `gateway`, `channels`, `executors`, `model`, `agents`, `mcp`, `skills`, `sandbox`, `environment`, `terminalFonts`, `overlay`, `voice`, `storage`, `developer`, `about`

`/settings` 作为容器路由，冷启动时为 `/settings/:section` 提供 "Settings" 祖先 breadcrumb。运行时重定向到 `/settings/general`。

### 4.3 Workspace

| Pattern | Icon | Title | Category |
|---------|------|-------|----------|
| `/workspace` | home | Workspaces | root |
| `/workspace/:workspaceId` | home | 动态(workspaceId) | workspace |

### 4.4 Workspace Sections（每个 section 独立 pattern）

| Pattern | Icon | Title | Category |
|---------|------|-------|----------|
| `/workspace/:workspaceId/pages` | layout-grid | Pages | workspace-section |
| `/workspace/:workspaceId/chat` | message-square | Chat | workspace-section |
| `/workspace/:workspaceId/kanban` | layout-dashboard | Kanban | workspace-section |
| `/workspace/:workspaceId/cron` | clock | Scheduled Tasks | workspace-section |
| `/workspace/:workspaceId/ideas` | lightbulb | Ideas | workspace-section |
| `/workspace/:workspaceId/agent` | bot | Agents | workspace-section |
| `/workspace/:workspaceId/files` | folder-open | Files | workspace-section |
| `/workspace/:workspaceId/github` | github | GitHub | workspace-section |
| `/workspace/:workspaceId/chat-monitor` | activity | Chat Monitor | workspace-section |

### 4.5 Workspace Detail 路由

| Pattern | Icon | Title | Category | queryParams |
|---------|------|-------|----------|-------------|
| `/workspace/:workspaceId/pages/:pageSlug+` | file-text | 动态(humanize pageSlug) | page | — |
| `/workspace/:workspaceId/agent/:agentId` | bot | 动态(agentId) | detail | — |
| `/workspace/:workspaceId/executor/:executorType` | terminal | 动态(executorType) | detail | — |
| `/workspace/:workspaceId/web` | globe | 动态(query.title) | detail | url, title, source_page, web_id |

### 4.6 Global Detail 路由

| Pattern | Icon | Title | Category | queryParams |
|---------|------|-------|----------|-------------|
| `/agent/:agentId` | bot | 动态(agentId) | detail | workspace_path |
| `/executor/:executorType` | terminal | 动态(executorType) | detail | workspace_path |
| `/skill/:skillId` | sparkles | 动态(skillId) | detail | workspace_path, agent_id |
| `/mcp-server/:serverName` | server | 动态(serverName) | detail | workspace_path, executor_type |
| `/subagent/:configId` | bot | 动态(configId) | detail | workspace_path, executor_type |
| `/prompt/:promptId` | quote | 动态(promptId) | detail | workspace_path, executor_type |
| `/command/:commandId` | square-terminal | 动态(commandId) | detail | workspace_path, executor_type |

## 5. 导航 API（push / replace / reset）

### 5.1 统一导航函数

API 设计类似 HTTP request：**method + url + headers**。

```typescript
type NavigateMethod = "push" | "replace" | "reset";

interface NavigateHeaders {
  /** 覆盖 breadcrumb leaf 的显示标题（默认从 registry match 获取） */
  label?: string;
  /** 覆盖 breadcrumb leaf 的图标（默认从 registry match 获取） */
  icon?: IconData;
  /** 覆盖 breadcrumb item 的 id */
  id?: string;
  /** 来源节点 ID（用于 page-index 树导航） */
  sourceNodeId?: string;
  /** 父节点 ID（用于 page-index 树导航） */
  parentNodeId?: string;
  /** 附加 meta 数据 */
  meta?: BreadcrumbStackItem["meta"];
}

function navigate(method: NavigateMethod, url: string, headers?: NavigateHeaders): void;
```

实现：

```typescript
function navigate(method: NavigateMethod, url: string, headers?: NavigateHeaders): void {
  const match = registry.match(url);

  // 自动构建 leaf item（registry 提供默认值，headers 可覆盖）
  const leaf: BreadcrumbStackItem = {
    id: headers?.id ?? url,
    label: headers?.label ?? match?.title ?? url,
    icon: headers?.icon ?? match?.icon,
    pattern: match?.pattern,
    href: url,
    sourceNodeId: headers?.sourceNodeId,
    parentNodeId: headers?.parentNodeId,
    meta: headers?.meta,
  };

  switch (method) {
    case "push":
      tabStore.pushNavigation(activeTabId, url, leaf);
      break;
    case "replace":
      tabStore.replaceNavigation(activeTabId, url, leaf);
      break;
    case "reset":
      const stack = registry.buildColdStartBreadcrumb(url, headers);
      tabStore.resetNavigation(activeTabId, url, stack);
      break;
  }
}
```

### 5.2 三种模式的语义

| 模式 | Stack 变化 | History 行为 | 使用场景 |
|------|-----------|-------------|----------|
| **push** | `[...currentStack, leaf]` | 截断 forward，追加 entry | 向下钻入（列表 → 详情） |
| **replace** | `[...currentStack[:-1], leaf]` | 截断 forward，追加 entry | 同级切换（Agent A → Agent B） |
| **reset** | `buildColdStartBreadcrumb(url)` | 截断 forward，追加 entry | 切换到不同 section、sidebar 直接跳转 |

**三种模式都产生历史记录**（追加到 navigationHistory），用户都可以 back 回去。区别仅在 **breadcrumbStack 如何变化**。

### 5.3 Tab Store 底层操作

```typescript
// tab-store 中的三个原子操作

pushNavigation(tabId: string, url: string, leaf: BreadcrumbStackItem): void {
  const current = getCurrentState(tabId);
  const newState: TabNavigationState = {
    url,
    breadcrumbStack: [...current.breadcrumbStack, leaf],
  };
  pushToHistory(tabId, newState);  // 截断 forward，追加
}

replaceNavigation(tabId: string, url: string, leaf: BreadcrumbStackItem): void {
  const current = getCurrentState(tabId);
  const newState: TabNavigationState = {
    url,
    breadcrumbStack: [...current.breadcrumbStack.slice(0, -1), leaf],
  };
  // 截断 forward history，追加新 entry（与 push 相同的 history 行为）
  // 区别仅在 breadcrumbStack：replace 替换栈顶，push 追加到栈顶
  // 用户可以 back 回到 replace 之前的状态
  pushToHistory(tabId, newState);
}

resetNavigation(tabId: string, url: string, stack: BreadcrumbStackItem[]): void {
  const newState: TabNavigationState = {
    url,
    breadcrumbStack: stack,
  };
  pushToHistory(tabId, newState);  // 截断 forward，追加（可 back）
}
```

### 5.4 调用示例

```typescript
// 切换 workspace section（reset：完全重建 stack）
navigate("reset", registry.build("/workspace/:workspaceId/chat", { workspaceId }));
// → stack 由冷启动构建：[Workspaces > my-proj > Chat]

// 从 agents 列表点入 agent detail（push：追加一层）
navigate("push", registry.build("/workspace/:workspaceId/agent/:agentId", { workspaceId, agentId }), {
  label: agentName,
});
// → stack: [...currentStack, "GPT-4o"]

// 在 agent detail 之间切换（replace：替换 top）
navigate("replace", registry.build("/workspace/:workspaceId/agent/:agentId", { workspaceId, agentId }), {
  label: newAgentName,
});
// → stack: [...currentStack[:-1], "Claude"]

// 从 sidebar 直接打开深层 page（reset：冷启动自动展开 rest segments）
navigate("reset", registry.build("/workspace/:workspaceId/pages/:pageSlug+", { workspaceId, pageSlug }), {
  label: pageTitle,
  icon: pageIcon,
  meta: { workspaceId, pageSlug },
});
// → rest 自动展开：[Workspaces > my-proj > Pages > first > second > third]

// 从当前 page 打开子 page（push：追加一层）
navigate("push", registry.build("/workspace/:workspaceId/pages/:pageSlug+", { workspaceId, pageSlug }), {
  label: childPageTitle,
});
// → stack: [...currentStack, "child-page"]

// 从 executor detail 打开 skill detail（push）
navigate("push", registry.build("/skill/:skillId", { skillId, agent_id: agentId }), {
  label: skillName,
  icon: { type: "lucide", value: "sparkles" },
});
// → stack: [...currentStack, "my-skill"]
```

### 5.5 Breadcrumb 点击回退（popTo）

用户点击 breadcrumb 中第 N 层时：

```typescript
function popToBreadcrumb(index: number): void {
  const current = getCurrentState(activeTabId);
  const targetItem = current.breadcrumbStack[index];
  if (!targetItem?.href) return;

  // 去重：先检查 backward history 中是否已有匹配的 entry
  const existingIndex = findHistoryEntryByUrl(
    tab.navigationHistory,
    tab.historyIndex,
    targetItem.href
  );

  if (existingIndex >= 0) {
    // 复用已有 entry（跳转到该历史位置），避免重复 push
    jumpToHistory(activeTabId, existingIndex);
    return;
  }

  // 无匹配 → 在当前位置之前插入（保留 forward history）
  const newState: TabNavigationState = {
    url: targetItem.href,
    breadcrumbStack: current.breadcrumbStack.slice(0, index + 1),
  };
  insertHistoryBeforeCurrent(activeTabId, newState);
}
```

## 6. 冷启动 Breadcrumb 构建（reset 模式 & Tab-Router Bridge 使用）

### 6.1 触发场景

| 场景 | 说明 |
|------|------|
| `navigate("reset", url)` | sidebar 跳转、section 切换 |
| Tab-Router Bridge（外部 URL 变化） | Deep link、直接输入 URL、持久化恢复 |

### 6.2 路径前缀推导

算法：从 path prefix 自动查找 registry 中存在的祖先 entry。

```
输入：URL = /workspace/my-proj/agent/gpt-4o
匹配：pattern = /workspace/:workspaceId/agent/:agentId

路径前缀推导：
  strip :agentId → /workspace/:workspaceId/agent → ✅ registry 存在 → 祖先
  strip agent    → /workspace/:workspaceId       → ✅ registry 存在 → 祖先
  strip :wid     → /workspace                    → ✅ registry 存在 → 祖先
  strip workspace → /                            → ❌ → stop

冷启动 breadcrumb = [Workspaces, my-proj, Agents, gpt-4o]
```

对于路径前缀不在 registry 中的路由（如 `/skill/:skillId`）：
```
输入：URL = /skill/my-tool?workspace_path=/foo&agent_id=claude
匹配：pattern = /skill/:skillId

路径前缀推导：
  strip :skillId → /skill → ❌ → stop

冷启动 breadcrumb = [my-tool]  ← 只显示当前页，足够了
```

这完全可以接受：`/skill/:skillId` 在正常导航时总是从 executor detail 页面点进去，caller 已构建了完整 stack `[Executor: claude > Skill: my-tool]`。只有直接输入 URL 才走冷启动路径。

### 6.3 Rest Param 自动展开

当匹配到的 pattern 含 rest param（`:param+`），冷启动 builder 自动为每个路径前缀生成中间 breadcrumb item。

```
Pattern: /workspace/:workspaceId/pages/:pageSlug+
URL:     /workspace/my-proj/pages/first/second/third
params:  { workspaceId: "my-proj", pageSlug: "first/second/third" }

展开为：
  [1] /workspace                              ← prefix ancestor
  [2] /workspace/my-proj                      ← prefix ancestor
  [3] /workspace/my-proj/pages                ← prefix ancestor
  [4] /workspace/my-proj/pages/first          ← rest prefix: pageSlug="first"
  [5] /workspace/my-proj/pages/first/second   ← rest prefix: pageSlug="first/second"
  [6] /workspace/my-proj/pages/first/second/third ← current
```

[4][5][6] 使用同一 RouteEntry，仅 `pageSlug` 值不同。中间层 [4][5] 的 label 取各自 segment 的最后一段（`humanize("first")`、`humanize("second")`），而非完整前缀。当前节点 [6] 的 label 可由 headers 覆盖。

### 6.4 冷启动构建算法

```typescript
function buildColdStartBreadcrumb(url: string, headers?: NavigateHeaders): BreadcrumbStackItem[] {
  const match = registry.match(url);
  if (!match) return [];

  const chain: BreadcrumbStackItem[] = [];

  // 1. 路径前缀祖先（registry 中存在的 entries）
  for (const ancestor of deriveAncestorsFromPrefix(match.pattern)) {
    const ancestorEntry = registry.getEntry(ancestor)!;
    const ancestorParams = pickMatchingParams(ancestor, match.params);
    chain.push(buildBreadcrumbItem(ancestorEntry, ancestorParams));
  }

  // 2. Rest param 中间层级展开
  const restParam = registry.getRestParam(match.pattern);
  if (restParam && match.params[restParam]?.includes("/")) {
    const segments = match.params[restParam].split("/");
    for (let i = 1; i < segments.length; i++) {
      const prefix = segments.slice(0, i).join("/");
      // 中间层只显示最后一个 segment 作为 label（而非完整前缀）
      const lastSegment = segments[i - 1];
      chain.push(buildBreadcrumbItem(
        match.entry,
        { ...match.params, [restParam]: prefix },
        { label: humanize(lastSegment) }
      ));
    }
  }

  // 3. 当前节点（headers 可覆盖 label/icon）
  chain.push(buildBreadcrumbItem(match.entry, match.params, headers));

  return chain;
}

function deriveAncestorsFromPrefix(pattern: string): string[] {
  const segments = pattern.split("/").filter(Boolean);
  const ancestors: string[] = [];

  for (let i = segments.length - 1; i > 0; i--) {
    const candidate = "/" + segments.slice(0, i).join("/");
    if (registry.hasEntry(candidate)) {
      ancestors.unshift(candidate);  // 从根到叶排序
    }
  }
  return ancestors;
}
```

### 6.5 辅助函数定义

```typescript
/**
 * 从当前 match params 中提取属于目标 pattern 的参数子集。
 * 只保留目标 pattern 声明的 path params（不含 query params）。
 */
function pickMatchingParams(
  targetPattern: string,
  allParams: Record<string, string>
): Record<string, string> {
  const paramNames = registry.getParamNames(targetPattern);  // e.g., ["workspaceId"]
  const result: Record<string, string> = {};
  for (const name of paramNames) {
    if (allParams[name] !== undefined) {
      result[name] = allParams[name];
    }
  }
  return result;
}

/**
 * 从 RouteEntry + params 构建一个 BreadcrumbStackItem。
 * id 使用构建后的 href（保证唯一性）。
 * headers 可选覆盖 label/icon。
 */
function buildBreadcrumbItem(
  entry: RouteEntry,
  params: Record<string, string>,
  headers?: NavigateHeaders
): BreadcrumbStackItem {
  const href = registry.build(entry.pattern, params);
  return {
    id: headers?.id ?? href,
    label: headers?.label ?? resolveTitle(entry, params),
    icon: headers?.icon ?? resolveIcon(entry, params),
    pattern: entry.pattern,
    href,
    sourceNodeId: headers?.sourceNodeId,
    parentNodeId: headers?.parentNodeId,
    meta: headers?.meta,
  };
}

/**
 * 将 slug segment 转为人类可读标题。
 * "my-page-name" → "My Page Name"
 */
function humanize(slug: string): string {
  return slug
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
```

## 7. 核心 API

### 7.1 Pattern 编译

每个 pattern 编译为：
- **regex**：用于 URL 匹配（**必须使用 `^...$` 锚定**，保证精确匹配）
  - `:param` → `([^/]+)` 单段
  - `:param+` → `(.+)` 多段（rest，至少匹配 1 个字符）
  - 常量段原样转义
- **builder**：`(params) → url` 用于 URL 构建（path params 使用 `encodeURIComponent` 编码，rest params 保持 `/` 不编码）
- **paramNames**：有序参数名列表
- **restParam**：rest 参数名（如有）

```typescript
// "/workspace/:workspaceId/pages/:pageSlug+"
// → regex: /^\/workspace\/([^/]+)\/pages\/(.+)$/
// → paramNames: ["workspaceId", "pageSlug"]
// → restParam: "pageSlug"
// → build({ workspaceId: "x", pageSlug: "a/b" }) → "/workspace/x/pages/a/b"
```

**编译时冲突检测**：`compileRegistry()` 在注册所有路由后，对每对 pattern 执行交叉测试——用 pattern A 的 builder 生成示例 URL，验证只有 pattern A 的 regex 能匹配。如检测到冲突则抛出编译期错误。

**路由匹配顺序**：`compiledRoutes` 按 pattern 的常量段数量降序排列（更具体的路由优先匹配）。相同常量段数的 pattern 中，无 rest param 的优先于有 rest param 的。

### 7.2 CompiledRegistry API

```typescript
interface CompiledRegistry {
  /** URL → RouteMatch（精确匹配） */
  match(url: string): RouteMatch | null;

  /** (pattern, params) → URL string */
  build(pattern: string, params: Record<string, string>): string;

  /** URL → BreadcrumbStackItem[]（冷启动用） */
  buildColdStartBreadcrumb(url: string, headers?: NavigateHeaders): BreadcrumbStackItem[];

  /** pattern → RouteEntry */
  getEntry(pattern: string): RouteEntry | undefined;

  /** pattern 是否存在 */
  hasEntry(pattern: string): boolean;

  /** 获取 icon（替代 getDescriptorIcon） */
  getIcon(pattern: string, params?: Record<string, string>): IconData | undefined;

  /** 获取指定 dropdownCategory 的所有 entries */
  getByCategory(category: string): RouteEntry[];

  /** 获取 rest param 名 */
  getRestParam(pattern: string): string | null;

  /** 获取 pattern 声明的 path param 名列表（不含 query params） */
  getParamNames(pattern: string): string[];

  /**
   * 规范化 URL：match → 提取声明的 params → rebuild。
   * 确保 query params 按声明顺序排列，丢弃未声明的 params 和 hash。
   * 若 URL 无法匹配任何 pattern，返回 pathname 部分（不含 search/hash）。
   */
  normalizeUrl(url: string): string;
}
```

### 7.3 URL 匹配

```typescript
function matchRoute(url: string): RouteMatch | null {
  const { pathname, searchParams } = new URL(url, "http://localhost");

  for (const compiled of compiledRoutes) {
    const pathMatch = compiled.regex.exec(pathname);
    if (!pathMatch) continue;

    // 提取 path params
    const params: Record<string, string> = {};
    compiled.paramNames.forEach((name, i) => {
      params[name] = decodeURIComponent(pathMatch[i + 1]);
    });

    // 提取声明的 query params（searchParams.get 自动 decode）
    for (const qp of compiled.queryParams) {
      const value = searchParams.get(qp);
      if (value) params[qp] = value;
    }

    return {
      pattern: compiled.pattern,
      params,
      icon: resolveIcon(compiled.entry, params),
      title: resolveTitle(compiled.entry, params),
      entry: compiled.entry,
    };
  }
  return null;
}
```

**`matchRoute` 返回 null 时的 fallback 策略**：

调用方（如 `buildColdStartBreadcrumb`、`navigate`）在 match 为 null 时应：
1. `buildColdStartBreadcrumb` → 返回空数组 `[]`
2. `navigate` → 仍然执行导航（url 有效但未注册的路由，leaf label 使用 url pathname 的最后一段）
3. Tab-Router Bridge → 不更新 tab store（保持当前状态，避免覆盖有效数据）

对于容器路由的重定向（如 `/settings` → `/settings/general`），由 React Router 的 `<Navigate>` 组件处理，`matchRoute` 仍能匹配 `/settings`。

### 7.4 URL 构建

```typescript
function buildUrl(pattern: string, params: Record<string, string>): string {
  const compiled = compiledByPattern.get(pattern);
  if (!compiled) throw new Error(`Unknown pattern: ${pattern}`);

  // 校验：rest param 不允许为空字符串（会产生无法 match 的 URL）
  if (compiled.restParam) {
    const restValue = params[compiled.restParam];
    if (!restValue) {
      throw new Error(`Rest param "${compiled.restParam}" must be non-empty for pattern: ${pattern}`);
    }
  }

  // 构建 path（单段 params 使用 encodeURIComponent，rest params 保持 / 不编码）
  let path = compiled.build(params);

  // 构建 query string（仅声明的 queryParams，按声明顺序排列 → 保证 canonical）
  const queryEntries = compiled.queryParams
    .filter(qp => params[qp])
    .map(qp => [qp, params[qp]]);

  if (queryEntries.length > 0) {
    path += "?" + new URLSearchParams(queryEntries).toString();
  }

  return path;
}
```

### 7.5 往返一致性证明

```typescript
const url1 = buildUrl("/workspace/:workspaceId/agent/:agentId", {
  workspaceId: "my-proj",
  agentId: "gpt-4o"
});
// → "/workspace/my-proj/agent/gpt-4o"

const match = matchRoute(url1);
// → { pattern: "/workspace/:workspaceId/agent/:agentId", params: { workspaceId: "my-proj", agentId: "gpt-4o" } }

const url2 = buildUrl(match.pattern, match.params);
// → "/workspace/my-proj/agent/gpt-4o"

assert(url1 === url2); // ✅ 始终成立（共享同一 pattern 定义）
```

**URL 编码约定**：
- 单段 path params（`:param`）由 `build` 使用 `encodeURIComponent` 编码，`match` 使用 `decodeURIComponent` 解码 → 往返一致
- Rest params（`:param+`）中的 `/` 保持原样不编码（作为路径分隔符），其他特殊字符仍编码
- Query params 由 `URLSearchParams` 自动处理编解码 → 往返一致
- **约束**：单段 param 值不应包含 `/`（会破坏路径结构）。如需包含 `/`，必须使用 rest param

## 8. Dropdown Dispatch

替代原来基于 `descriptorId` 前缀匹配的方式：

```typescript
function resolveDropdownItems(segment: BreadcrumbSegment, context: DropdownContext): DropdownItem[] {
  const match = registry.match(segment.href);
  if (!match) return [];

  switch (match.entry.dropdownCategory) {
    case "workspace":
      return buildWorkspaceSwitcherDropdown(context.workspaces);
    case "workspace-section":
      return buildWorkspaceSectionDropdown(context.workspaceId);
    case "mcp-section":
      return buildMcpSectionDropdown();
    case "settings":
      return buildSettingsSectionDropdown();
    case "page":
      return buildPageSiblingDropdown(match.params, context.pages);
    case "detail":
      return []; // detail 页面无 dropdown
    case "root":
      return buildRootDropdown();
    default:
      return [];
  }
}
```

## 9. BrowserRouter 集成

Route Registry 直接作为 React Router 路由定义的数据源：

```typescript
import { ROUTE_REGISTRY } from "@/navigation/route-registry";

const PAGE_COMPONENTS: Record<string, React.ComponentType> = {
  "/documents": DocumentsPage,
  "/workspace": WorkspaceListPage,
  "/workspace/:workspaceId": WorkspaceDetailPage,
  "/workspace/:workspaceId/pages": WorkspacePagesPage,
  "/workspace/:workspaceId/pages/:pageSlug+": WorkspacePage,
  "/workspace/:workspaceId/chat": WorkspaceChatPage,
  "/workspace/:workspaceId/agent/:agentId": AgentDetailPage,
  // ...
};

function generateRoutes(): RouteObject[] {
  return ROUTE_REGISTRY
    .filter(entry => PAGE_COMPONENTS[entry.pattern])
    .map(entry => ({
      path: toReactRouterPath(entry.pattern),
      element: <PAGE_COMPONENTS[entry.pattern] />,
    }));
}
```

`toReactRouterPath` 转换规则：
- `:param` → `:param`（React Router 原生支持）
- `:param+` → `*`（React Router splat 语法）

**React Router splat vs 自定义 regex 的语义差异**：

React Router 的 `*` 可匹配空字符串（即 `/workspace/x/pages` 也能匹配 `/workspace/:workspaceId/pages/*`），而自定义 registry 的 `(.+)` 要求至少 1 个字符。React Router v6 使用 specificity scoring（非 first-match-wins），更具体的路由（无 splat）优先。因此 `/workspace/x/pages` 会优先匹配 section 路由而非 splat 路由。

为确保行为一致，带 rest param 的路由组件应在 mount 时检查 splat 值：

```typescript
// WorkspacePage.tsx
const { "*": pageSlug } = useParams();
if (!pageSlug) {
  // React Router 匹配了空 splat → 重定向到 pages 列表
  return <Navigate to=".." replace />;
}
```

## 10. Tab Store 适配

### 10.1 序列化变更

```typescript
// Before: TabNavigationState 存 DesktopLocation 对象
{ location: { kind: "workspace-agent-detail", workspaceId: "x", agentId: "y" }, breadcrumbStack: [...] }

// After: 存 URL 字符串
{ url: "/workspace/x/agent/y", breadcrumbStack: [...] }
```

### 10.2 Tab-Router Bridge 简化

```typescript
// Before:
const targetUrl = locationToUrl(activeState.location);
// Router → Store:
const parsed = urlToLocation(currentUrl);
navigateToLocation(tabId, parsed, { breadcrumbStack: resolved.breadcrumbStack });

// After:
const targetUrl = activeState.url;
// Router → Store:
syncRouterToStore(tabId, currentUrl);
```

**Bridge 同步算法**（带 sync-lock 和智能 push）：

```typescript
const syncLockRef = useRef(false);

// Store → Router: tab state 变化时同步 URL 到 BrowserRouter
useEffect(() => {
  if (syncLockRef.current) return;
  const targetUrl = activeState.url;
  if (targetUrl !== currentRouterUrl) {
    syncLockRef.current = true;
    routerNavigate(targetUrl, { replace: true });
    // 下一帧释放锁
    requestAnimationFrame(() => { syncLockRef.current = false; });
  }
}, [activeState.url]);

// Router → Store: BrowserRouter URL 变化时同步到 tab state
function syncRouterToStore(tabId: string, currentUrl: string): void {
  if (syncLockRef.current) return;
  syncLockRef.current = true;

  const currentState = getCurrentState(tabId);

  // 规范化 URL（只保留声明的 query params）
  const normalizedUrl = registry.normalizeUrl(currentUrl);

  // URL 未变化 → 忽略
  if (normalizedUrl === currentState.url) {
    syncLockRef.current = false;
    return;
  }

  // 智能 push：检查当前 breadcrumb stack 是否为新 URL 的有效前缀
  const match = registry.match(normalizedUrl);
  if (match && isStackPrefixOf(currentState.breadcrumbStack, match)) {
    // 当前 stack 是有效前缀 → push（保留高质量的 caller-built 祖先）
    const leaf = buildBreadcrumbItem(match.entry, match.params);
    tabStore.pushNavigation(tabId, normalizedUrl, leaf);
  } else {
    // 无法衔接 → 冷启动（deep link / 直接输入 URL）
    const breadcrumbStack = registry.buildColdStartBreadcrumb(normalizedUrl);
    tabStore.resetNavigation(tabId, normalizedUrl, breadcrumbStack);
  }

  requestAnimationFrame(() => { syncLockRef.current = false; });
}

/**
 * 判断现有 stack 是否是新 URL 的合法 prefix。
 * 条件：stack top 的 pattern 是新 match pattern 的祖先（路径前缀关系）。
 */
function isStackPrefixOf(stack: BreadcrumbStackItem[], match: RouteMatch): boolean {
  if (stack.length === 0) return false;
  const topPattern = stack[stack.length - 1]?.pattern;
  if (!topPattern) return false;
  const ancestors = deriveAncestorsFromPrefix(match.pattern);
  return ancestors.includes(topPattern);
}
```

### 10.3 Workspace 推断

```typescript
// Before: "workspaceId" in location (duck typing on DesktopLocation)
// After:
const match = registry.match(tab.url);
const workspaceId = match?.params.workspaceId;
```

### 10.4 Persist Migration

Zustand persist 的 `merge` 函数中加入完整兼容层。迁移需覆盖 **全部持久化数据**：

```typescript
// ─── 入口：迁移整个 tab store ───────────────────────────────────────────

function migratePersistedState(persisted: any): TabStoreState {
  return {
    ...persisted,
    tabs: persisted.tabs?.map(migrateTab) ?? [],
    recentlyClosedTabs: persisted.recentlyClosedTabs?.map(migrateTab) ?? [],
  };
}

// ─── 迁移单个 Tab ───────────────────────────────────────────────────────

function migrateTab(tab: any): PageTab {
  return {
    ...tab,
    navigationHistory: tab.navigationHistory
      ?.map(migrateNavigationState)
      .filter(isNavigationState) ?? [],
  };
}

// ─── 迁移单个 NavigationState ───────────────────────────────────────────

function migrateNavigationState(old: any): TabNavigationState {
  // 旧格式：含 location 对象
  if (old.location && typeof old.location === "object" && old.location.kind) {
    return {
      url: legacyLocationToUrl(old.location),
      breadcrumbStack: (old.breadcrumbStack ?? []).map(migrateBreadcrumbItem),
      activeNodeId: old.activeNodeId,
      activeIndexPath: old.activeIndexPath,
    };
  }
  // 新格式：已有 url string，但仍需迁移 breadcrumbStack 中的旧 item
  if (typeof old.url === "string") {
    return {
      ...old,
      breadcrumbStack: (old.breadcrumbStack ?? []).map(migrateBreadcrumbItem),
    };
  }
  return old;
}

// ─── 迁移单个 BreadcrumbStackItem ───────────────────────────────────────

function migrateBreadcrumbItem(item: any): BreadcrumbStackItem {
  // 旧格式：含 target: ViewTarget（有 canonicalUrl 和 location）
  if (item.target && typeof item.target === "object") {
    return {
      id: item.id ?? item.target.canonicalUrl ?? "",
      label: item.label ?? "",
      icon: item.icon,
      pattern: item.descriptorId,  // 旧的 descriptorId 作为临时 pattern（不精确但可用）
      href: item.target.canonicalUrl,
      sourceNodeId: item.sourceNodeId,
      parentNodeId: item.parentNodeId,
      meta: item.meta,
    };
  }
  // 新格式或已部分迁移
  return item;
}

// ─── 更新后的 type guard ────────────────────────────────────────────────

function isNavigationState(value: unknown): value is TabNavigationState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  // 新格式：有 url 字符串
  if (typeof candidate.url === "string" && Array.isArray(candidate.breadcrumbStack)) {
    return true;
  }
  return false;
}
```

**注意**：`legacyLocationToUrl` 是旧 `locationToUrl` 函数的保留副本，仅在迁移层使用，迁移完成后可删除。

## 11. 正常导航时 Caller 构建 Breadcrumb

正常导航时 caller（`use-desktop-routing.ts`）显式构建 stack，不依赖 registry 推导。

示例 — 打开 workspace agent detail：

```typescript
function openWorkspaceAgentDetail(workspaceId: string, agentId: string, opts?: { title?: string; icon?: IconData }) {
  const url = registry.build("/workspace/:workspaceId/agent/:agentId", { workspaceId, agentId });

  const breadcrumbStack: BreadcrumbStackItem[] = [
    {
      id: `workspace:${workspaceId}`,
      label: workspaceName ?? workspaceId,
      icon: { type: "lucide", value: "home" },
      pattern: "/workspace/:workspaceId",
      href: registry.build("/workspace/:workspaceId", { workspaceId }),
    },
    {
      id: `${workspaceId}:agent`,
      label: t("workspace.sections.agents"),
      icon: { type: "lucide", value: "bot" },
      pattern: "/workspace/:workspaceId/agent",
      href: registry.build("/workspace/:workspaceId/agent", { workspaceId }),
    },
    {
      id: `${workspaceId}:agent:${agentId}`,
      label: opts?.title ?? agentId,
      icon: opts?.icon ?? { type: "lucide", value: "bot" },
      pattern: "/workspace/:workspaceId/agent/:agentId",
      href: url,
    },
  ];

  pushNavigation(url, { breadcrumbStack });
}
```

**关键点**：caller 拥有 runtime 数据（workspace name、agent display name），可以构建高质量的 breadcrumb。Registry 只在冷启动时作为 fallback。

## 12. 路由变更明细

### 12.1 路径重命名

| 旧路径 | 新路径 | 说明 |
|--------|--------|------|
| `/workspace/:workspaceId/apps` | `/workspace/:workspaceId/pages` | Apps 改名为 Pages |
| `/workspace/:workspaceId/page/:pageSlug` | `/workspace/:workspaceId/pages/:pageSlug+` | 嵌套在 pages 下，支持多段 |
| — | `/workspace` | 新增 workspace 列表页 |

### 12.2 旧路径兼容

在 BrowserRouter 中加入重定向规则：

```typescript
{ path: "/workspace/:workspaceId/apps", redirect: "/workspace/:workspaceId/pages" }
{ path: "/workspace/:workspaceId/page/*", redirect: "/workspace/:workspaceId/pages/*" }
```

## 13. 文件结构

```
apps/desktop/src/navigation/
├── route-registry.ts       # RouteEntry[] 定义（单一真相源）
├── route-compiler.ts       # 编译器：pattern→regex、match、build、deriveAncestors、expandRest
├── breadcrumb-builder.ts   # buildColdStartBreadcrumb（冷启动 fallback）
├── breadcrumb-stack.ts     # 不变：push/pop/replace 原子操作
├── tab-navigation.ts       # 简化：基于 url 而非 location
├── page-index.ts           # 简化：dropdown dispatch 改用 dropdownCategory
├── deep-link.ts            # 不变
└── index.ts                # barrel exports
```

**删除的文件/代码**：
- `navigation-meta.ts` 中的 `DesktopLocation` 类型、`locationToUrl`、`urlToLocation`、`BreadcrumbItemDescriptor`、`GLOBAL_ROUTE_DESCRIPTORS`、`WORKSPACE_SECTION_DESCRIPTORS`、`SETTINGS_SECTION_DESCRIPTORS`、`ViewTarget`、`buildViewTarget`
- `location-navigation.ts` 整个文件（正常导航由 caller 构建，冷启动由 `breadcrumb-builder.ts` 处理）

## 14. 对比总结

| 维度 | 现有设计 | 新方案 |
|------|----------|--------|
| 真相源数量 | 3（Descriptor + DesktopLocation + Router） | 1（Route Registry） |
| 新增路由步骤 | 5 处改动 | 1 条 RouteEntry + 1 个 Component 映射 |
| 往返一致性 | 手工维护 | 构造保证 |
| Breadcrumb 构建 | switch(kind) 18 case | caller 显式构建（正常）/ 路径前缀推导（冷启动） |
| Section 路由 | `:section` 变量 + guard | 每个 section 独立常量 pattern |
| Dropdown dispatch | descriptorId 前缀匹配 | dropdownCategory 枚举 |
| Tab 序列化 | `{ location: { kind, ... } }` | `{ url: string }` |
| BrowserRouter | 独立维护 | 从 Registry 生成 |
| Pages 嵌套 | 手工展开 pageSlug | rest param 自动逐段展开 |
| parent/ancestors 配置 | 无（靠 switch case 硬编码） | 无需配置（路径前缀自动推导） |
