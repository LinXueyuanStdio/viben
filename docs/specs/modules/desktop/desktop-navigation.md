# Desktop Navigation System

> **Status**: Specification
> **Priority**: P0
> **Platform**: Desktop only (`apps/desktop`)

---

## Overview

This spec defines the desktop navigation system for workspace pages, agents, custom pages, and embedded external web pages.

The system is built on four layers:

1. `DesktopLocation`
   The canonical view state for rendering and deep links.

2. `VirtualPageIndex`
   The information architecture tree used by sidebar, breadcrumb dropdowns, search, and related navigation.

3. `BreadcrumbStack`
   The current tab's navigation path. Child pages can push new breadcrumb items.

4. `Tab-first Navigation`
   All navigation updates the current tab state first. Router only reflects the active tab.

---

## Goals

1. Make every breadcrumb segment clickable.
2. Make breadcrumb dropdowns use a shared page index.
3. Ensure all desktop page transitions go through tabs, not direct `navigate()`.
4. Unify workspace routes under `/workspace/:workspaceId/...`.
5. Allow markdown pages to push child pages into the breadcrumb stack.
6. Support external web pages as virtual child pages, e.g.
   `[icon] viben / [icon] 页面 / [icon] 我的自定义markdown页面 / [icon] 百度`

---

## Non-Goals

1. Redesign the visual style of the desktop shell.
2. Force all page-local state into routes.
3. Remove every legacy route immediately. A compatibility bridge is allowed.

---

## Architecture

### Layer Responsibilities

| Layer | Responsibility | Source of Truth |
|------|------|------|
| `DesktopLocation` | Render target, canonical route, deep link parsing | Active tab |
| `VirtualPageIndex` | Navigation structure, dropdown contents, discoverability | Index resolvers |
| `BreadcrumbStack` | User-visible page path within the current tab | Active tab |
| Router | URL projection for the active tab | `TabRouterBridge` |

### Core Rule

The breadcrumb UI is driven by `BreadcrumbStack`, not reconstructed from route segments.

The page index is used for:

- sibling menus
- root/section dropdowns
- search results
- virtual embedding of pages under other pages

---

## Canonical Routes

All workspace routes must be normalized under `/workspace/:workspaceId/...`.

### Workspace Views

| View | Route |
|------|------|
| Workspace Home | `/workspace/:workspaceId` |
| Workspace Chat | `/workspace/:workspaceId/chat` |
| Workspace Kanban | `/workspace/:workspaceId/kanban` |
| Workspace Cron | `/workspace/:workspaceId/cron` |
| Workspace Ideas | `/workspace/:workspaceId/ideas` |
| Workspace Agents | `/workspace/:workspaceId/agent` |
| Agent Detail | `/workspace/:workspaceId/agent/:agentId` |
| Executor Detail | `/workspace/:workspaceId/executor/:executorType` |
| Files | `/workspace/:workspaceId/files` |
| GitHub | `/workspace/:workspaceId/github` |
| Chat Monitor | `/workspace/:workspaceId/chat-monitor` |
| Workspace Page | `/workspace/:workspaceId/page/*pageSlug` |
| Workspace Web | `/workspace/:workspaceId/web` |

### Workspace Web Wrapper

External sites are rendered through an internal wrapper route:

`/workspace/:workspaceId/web?url=<encoded>&title=<encoded>&source_page=<slug?>&web_id=<id?>`

This preserves:

- workspace context
- breadcrumb stack continuity
- tab-first navigation

---

## Compatibility Rules

Legacy routes must parse into canonical `DesktopLocation` values.

| Legacy | Canonical |
|------|------|
| `/workspace/:workspaceId/agents` | `/workspace/:workspaceId/agent` |
| `/agent/:agentId?workspace_path=...` | `/workspace/:workspaceId/agent/:agentId` |
| `/executor/:executorType?workspace_path=...` | `/workspace/:workspaceId/executor/:executorType` |
| `/workspace/page?workspace_id=...&page_path=pages/<slug>/SKILL.md` | `/workspace/:workspaceId/page/<slug>` |

The compatibility layer only:

1. parses old URLs
2. produces canonical `DesktopLocation`

It must not reintroduce legacy navigation behavior.

---

## Core Types

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

### Required Semantics

| Action | Expected Behavior |
|------|------|
| Sidebar root/section click | `resetStack(...)` |
| Search result open | `openLocation(...)` |
| Same-level page switch | `replaceLocation(...)` |
| Child page open from current page | `pushPage(...)` |
| Breadcrumb segment click | `popTo(index)` |

---

## Virtual Page Index

### Purpose

The virtual page index is the single shared source for:

- sidebar navigation
- breadcrumb dropdown menus
- search results
- sibling and related-item resolution

It must support:

1. static system entries
2. dynamic workspace branches
3. page-local extracted branches
4. multiple virtual parents for the same view target

### Sources

#### Static Sources

- workspace root
- workspace sections
- settings
- documents
- device pairing

#### Dynamic Sources

- workspace list
- workspace agents
- workspace executors
- workspace pages
- page navigation extracts from markdown content

### Required Behavior

The same `ViewTarget` may appear under multiple virtual index nodes.

Examples:

- `[workspace] / 智能体 / 个人助手`
- `[workspace] / 最近访问 / 个人助手`
- `[workspace] / 收藏 / 个人助手`

This is allowed because index structure is not constrained by route hierarchy.

---

## Breadcrumb System

### Shared Shell Placement

The shell layout must render one global breadcrumb bar:

```text
GlobalTabBar
DesktopBreadcrumbBar
Outlet
```

`DesktopBreadcrumbBar` belongs in `AppLayout`.

Page components must stop rendering page-local breadcrumb widgets for top-level navigation.

### Rendering Rules

1. Segments are rendered from `activeTab.breadcrumbStack`.
2. Every segment is clickable if it has a `target`.
3. Clicking a segment calls `popTo(index)`.
4. Hovering a segment opens a dropdown resolved from the virtual page index.

### Dropdown Rules

| Segment Kind | Dropdown Content |
|------|------|
| Workspace Root | Workspace list |
| Workspace Section | Same-level workspace views |
| Agent / Executor Detail | Same-type resources |
| Workspace Page | Sibling pages and child pages |
| Workspace Web | Sibling navigation nodes under the same parent |

---

## Markdown Pages as Navigation Hosts

Markdown pages rendered by `YooptaMarkdownRenderer` are allowed to host child navigation nodes.

This is required because markdown pages are notion-like and already support rich blocks such as links, embeds, and page mentions.

### `PageNavigationExtract`

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

### `YooptaNavigationMeta`

```ts
interface YooptaNavigationMeta {
  includeInPageIndex?: boolean;
  titleOverride?: string;
  iconOverride?: IconData;
  webViewMode?: "embedded" | "external";
}
```

### Default Mapping Rules

| Source | Default | Mapping |
|------|------|------|
| `Embed` | included | internal page or `external-web` |
| `Link` | excluded | `external-web` only when explicitly elevated |
| `#page mention` | excluded from main chain | related item or child page when explicitly elevated |

### Child Push Flow

When a user opens a navigable child node from a markdown page:

1. read block navigation metadata
2. build `ExtractedNavigationItem`
3. map to `VirtualPageIndexNode`
4. build `BreadcrumbStackItem`
5. call `pushPage(...)`

This flow must be centralized. The page must not hand-build breadcrumb segments.

---

## Workspace Web

External web targets must be handled as first-class navigation leaves.

Example:

- `[icon] viben / [icon] 页面 / [icon] 我的自定义markdown页面 / [icon] 百度`

Expected behavior:

- the breadcrumb keeps the markdown page as parent
- the tab location becomes `workspace-web`
- the renderer uses the internal web wrapper route

### Security and Fallback

`workspace-web` must support fallback when sites reject embedding.

Fallback order:

1. internal webview
2. internal proxy/wrapper
3. system browser

The tab and breadcrumb state must remain intact even if rendering falls back to the system browser.

---

## Router Bridge

Only one layer may talk directly to `react-router`: `TabRouterBridge`.

### Responsibilities

1. `location -> url`
   Project the active tab's `DesktopLocation` to a canonical URL.

2. `url -> location`
   Parse deep links, cold starts, and legacy URLs into canonical `DesktopLocation`.

### Restrictions

- page components must not perform normal page transitions with direct `navigate()`
- sidebar must not perform direct route navigation
- breadcrumb must not perform direct route navigation
- `usePageTabs` must stop calling `navigate()` for business navigation

---

## Performance

### Branch Caching

Cache index branches, not the full expanded tree.

Typical branches:

- workspace root
- workspace sections
- agent list
- page tree
- page navigation extract branch

### Static + Dynamic Merge

Dropdowns may render static siblings immediately and patch dynamic items asynchronously.

### Workspace-scoped Invalidation

Invalidate only affected branches when:

- workspace changes
- agent changes
- page changes
- GitHub integration changes

### Breadcrumb Efficiency

The breadcrumb UI reads the current stack directly.

On hover it only resolves the hovered item's sibling branch.

It does not rebuild the whole tree.

---

## Implementation Scope

### New Modules

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

### Existing Files to Refactor

- `apps/desktop/src/stores/tab-store.ts`
- `apps/desktop/src/hooks/use-page-tabs.ts`
- `apps/desktop/src/components/layout/app-layout.tsx`
- `apps/desktop/src/components/layout/sidebar.tsx`
- `apps/desktop/src/components/workspace/workspace-breadcrumb.tsx`
- `apps/desktop/src/components/workspace/workspace-header.tsx`
- `apps/desktop/src/pages/apps/workspace-page.tsx`
- `apps/desktop/src/pages/apps/components/yoopta-markdown-renderer.tsx`
- `apps/desktop/src/pages/apps/components/yoopta-plugins.ts`
- `apps/desktop/src/App.tsx`

---

## Migration Plan

### Phase 1: Core Types

1. Define `DesktopLocation`
2. Define `ViewTarget`
3. Define `BreadcrumbStackItem`
4. Define `VirtualPageIndexNode`
5. Define `TabNavigationState`
6. Define `PageNavigationExtract`

### Phase 2: Tab-first State

1. Move tab history from URL strings to `TabNavigationState[]`
2. Add `TabNavigationApi`
3. Stop business navigation from calling direct router APIs

### Phase 3: Canonical Routes

1. Add canonical workspace routes
2. Add `workspace-web`
3. Convert legacy routes into compatibility parsing only

### Phase 4: Shared Breadcrumb

1. Mount `DesktopBreadcrumbBar` in shell
2. Remove page-local top-level breadcrumb assembly
3. Connect breadcrumb clicks to `popTo`

### Phase 5: Virtual Index

1. Add static branches
2. Add workspace dynamic branches
3. Add markdown page navigation extraction
4. Add hover dropdowns

### Phase 6: Cleanup

1. Remove scattered page transitions using direct `navigate()`
2. Remove legacy query-style business dependencies
3. Keep a thin compatibility layer only

---

## Acceptance Criteria

1. Every breadcrumb segment is clickable.
2. Breadcrumb state is stack-based and supports `pushPage()`.
3. Hovering any breadcrumb segment shows a dropdown.
4. Sidebar, breadcrumb, and tab bar use the same virtual page index.
5. `WorkspaceAgentsPage` uses `/workspace/:workspaceId/agent`.
6. `AgentDetailPage` uses `/workspace/:workspaceId/agent/:agentId`.
7. Custom workspace pages use `/workspace/:workspaceId/page/<slug>`.
8. External web pages use the workspace web wrapper route.
9. All page transitions update tab state first, then router state.
10. Markdown page embeds and elevated links can become virtual navigation nodes.
11. A markdown page can push a child web page into the breadcrumb stack.

---

## Risks

1. Global workspace should also be modeled as a real workspace, otherwise route prefix consistency breaks.
2. External sites may reject embedding through CSP or frame restrictions.
3. Auto-promoting every markdown link into navigation would pollute the page tree; explicit elevation rules are required.
4. Persisted tab state requires a migration from URL-string history to structured navigation history.

---

## Related

- [Desktop Page Debug MCP](./desktop-page-debug-mcp.md)
- [Workspace Management](../workspace/workspace-management.md)
- [Workspace UI](../workspace/workspace-ui.md)
- [Desktop Global Breadcrumb & Tab Routing Plan](../../../plans/2026-05-02-desktop-global-breadcrumb-tab-routing-refactor.md)
