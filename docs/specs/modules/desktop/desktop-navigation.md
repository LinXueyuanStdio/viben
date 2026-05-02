# Desktop Navigation System

> **Status**: Specification
> **Priority**: P0
> **Platform**: Desktop only (`apps/desktop`)

---

## Overview

This spec defines a unified desktop navigation model for:

- workspace shell pages
- settings pages
- agent and executor detail pages
- custom markdown pages
- notion-like embedded child pages
- external web leaves

The core design principle is:

**store route references, navigation mounts, and navigation stacks, not rendered labels.**

Rendered titles, icons, hrefs, and parent-child relationships are resolved from a single navigation index at render time.

This guarantees:

1. translation consistency
2. breadcrumb / sidebar / tab consistency
3. route and tree decoupling
4. free-form page trees with multiple logical mounts

---

## Naming Rules

This spec uses the following naming conventions consistently:

- `DesktopLocation`
  Canonical view identity.

- `NavigationNode`
  What something is.

- `NavigationMount`
  Where a node is mounted in the logical tree.

- `NavigationStack`
  The active logical stack from root mount to current mount inside one tab.

- `NavigationIndex`
  The merged in-memory graph of nodes, mounts, and lookup tables.

- `NavigationResolver`
  The layer that turns index references into render-ready items.

- `NavigationDescriptor`
  A render-ready navigation object for a specific UI surface.

The term `mount` is preferred over `placement` because it more clearly expresses:

- one node may be mounted in multiple places
- parent-child relationships belong to tree structure
- routes do not own the logical hierarchy

The term `stack` is preferred over `path` for active tab state because:

- child pages push onto it
- breadcrumb segment click truncates it
- runtime navigation behaves like a stack, not a URL parser

---

## Goals

1. Make every breadcrumb segment clickable.
2. Make all desktop navigation tab-first.
3. Ensure settings, workspace sections, tabs, and breadcrumbs always use the same translated title/icon source.
4. Separate logical page tree mounting from view routing.
5. Allow a single page or web leaf to appear under multiple parents.
6. Allow child pages to push deeper breadcrumb paths without mutating global route semantics.
7. Keep the model efficient enough for dropdowns, page trees, and breadcrumb resolution.

---

## Non-Goals

1. Redesign the visual style of the desktop shell.
2. Force all page-local state into routes.
3. Remove all legacy routes immediately.
4. Require every custom page to be statically declared in code.

---

## Core Principle

The app must not treat rendered navigation labels as source-of-truth state.

The app must store:

- **what node is being viewed**
- **where that node is mounted in the logical tree**
- **what navigation stack led to the current view**

The app must derive:

- breadcrumb labels
- tab titles
- sidebar tree labels
- dropdown sibling lists
- translated system titles

from a shared resolver.

---

## Architecture

The navigation system is split into three layers:

1. **Navigation Index**
   Stores all navigation nodes and all navigation mounts.

2. **Navigation Resolver**
   Resolves node/mount references into translated UI-ready navigation items.

3. **Navigation Projection**
   Adapts resolved items for different surfaces:
   - breadcrumb
   - sidebar
   - tab title
   - dropdown
   - page tree

### Rule

Routes identify the active view.

Mounts identify the logical tree path.

Tabs store navigation stacks, not final display strings.

---

## Canonical Routes

Canonical routes remain the desktop view identity layer.

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
| Workspace Web | `/workspace/:workspaceId/web?...` |
| Settings Root | `/settings/general` |
| Settings Section | `/settings/:section` |

### Compatibility

Legacy routes must still parse into canonical `DesktopLocation` values, but they must not define tree relationships.

Examples:

| Legacy | Canonical |
|------|------|
| `/workspace/:workspaceId/agents` | `/workspace/:workspaceId/agent` |
| `/agent/:agentId?workspace_path=...` | workspace-scoped agent detail location |
| `/executor/:executorType?workspace_path=...` | workspace-scoped executor detail location |
| `/workspace/page?workspace_id=...&page_path=pages/<slug>/SKILL.md` | `/workspace/:workspaceId/page/<slug>` |

---

## Deep Link Model

Deep links must reuse the same navigation model as in-app tab opening.

`viben://` is an entry protocol, not a second routing system.

The deep link pipeline is:

1. parse `viben://...` into `DesktopLocation`
2. derive `DesktopRouteRef`
3. resolve default `NavigationMount`
4. build initial `NavigationStack`
5. open or focus a tab using tab-first rules

### Rule

Deep links must never directly construct breadcrumb labels.

Deep links must only provide:

- canonical route identity
- optional logical mount hint
- optional tab-open behavior hint

### URL Grammar

```text
viben://oauth?session=<base64url-json>

viben://workspace/<workspaceId>
viben://workspace/<workspaceId>/<section>
viben://workspace/<workspaceId>/agent/<agentId>
viben://workspace/<workspaceId>/executor/<executorType>
viben://workspace/<workspaceId>/page/<pageSlug>
viben://workspace/<workspaceId>/web?url=<encoded-url>&title=<optional-title>&mount=<optional-mount-id>

viben://settings
viben://settings/<section>
```

### Supported Workspace Sections

`<section>` must map to canonical workspace sections such as:

- `chat`
- `kanban`
- `cron`
- `ideas`
- `agent`
- `files`
- `github`
- `chat-monitor`

### Deep Link Payload Rules

`viben://workspace/<workspaceId>/page/<pageSlug>`:

- `pageSlug` uses the same slug as `/workspace/:workspaceId/page/*pageSlug`
- it does not encode logical parent hierarchy

`viben://workspace/<workspaceId>/web?...`:

- `url` is required
- `title` is optional
- `mount` is optional and points to a preferred parent mount
- when `mount` is omitted, resolver chooses a default mount from context

### Optional Query Parameters

Deep links may include optional query parameters:

- `mount=<mountId>`
  Preferred logical parent or leaf mount.

- `stack=<mountId,mountId,...>`
  Preferred full `NavigationStack` when the sender already knows the logical stack.

- `mode=focus|reuse|new-tab`
  Tab-open hint.

### `viben://` to `DesktopLocation`

Examples:

```ts
viben://workspace/123
=> { kind: "workspace-home", workspaceId: "123" }

viben://workspace/123/agent
=> { kind: "workspace-section", workspaceId: "123", section: "agent" }

viben://workspace/123/agent/personal-assistant
=> { kind: "workspace-agent-detail", workspaceId: "123", agentId: "personal-assistant" }

viben://workspace/123/page/docs/spec
=> { kind: "workspace-page", workspaceId: "123", pageSlug: "docs/spec" }

viben://workspace/123/web?url=https%3A%2F%2Fbaidu.com&title=%E7%99%BE%E5%BA%A6
=> {
  kind: "workspace-web",
  workspaceId: "123",
  title: "百度",
  url: "https://baidu.com",
}

viben://settings/general
=> { kind: "settings", section: "general" }
```

### Default Mount Resolution

Deep links may know the route but not the desired logical parent.

The resolver must therefore select a default mount deterministically.

Resolution order:

1. use `stack` when present and valid
2. else use `mount` when present and valid
3. else use route-to-primary-mount lookup from `NavigationIndex`
4. else synthesize a temporary runtime mount under the nearest valid root

Examples:

- `viben://workspace/123/agent/personal-assistant`
  default stack:
  `workspace-root -> agent-section -> agent-detail`

- `viben://workspace/123/page/docs/spec`
  default stack:
  `workspace-root -> pages-root -> page`

- `viben://workspace/123/web?url=https%3A%2F%2Fbaidu.com`
  default stack without hint:
  `workspace-root -> pages-root -> runtime-web`

- `viben://workspace/123/web?url=...&mount=mount:workspace:123:page:my-markdown-page`
  default stack:
  `workspace-root -> pages-root -> my-markdown-page -> runtime-web`

### Tab Opening Rules

Deep links must remain tab-first.

Default behavior is `mode=focus`.

Rules:

1. `focus`
   If a tab with the same `DesktopRouteRef.key` and compatible logical stack already exists, focus it.

2. `reuse`
   If the active tab is replaceable and belongs to the same workspace scope, replace its route and stack.

3. `new-tab`
   Always open a new tab with a fresh stack.

Compatibility rule for existing tabs:

- exact `stack` match wins
- else exact `primaryMountId` match wins
- else exact `DesktopRouteRef.key` match wins

### Deep Link and Multiple Mounts

Because one node may have multiple mounts, a route deep link does not uniquely identify breadcrumb context.

Therefore:

- route selects the leaf content
- `mount` or `stack` selects the logical breadcrumb context
- absence of `mount` or `stack` falls back to the primary mount

This keeps deep links short by default while still allowing precise context-preserving links.

### Deep Link Examples

Open workspace agent list:

```text
viben://workspace/123/agent
```

Open a page with default tree placement:

```text
viben://workspace/123/page/docs/architecture
```

Open the same page under a specific logical parent:

```text
viben://workspace/123/page/docs/architecture?mount=mount:workspace:123:agent:alice:resources
```

Open an external web leaf under a markdown page:

```text
viben://workspace/123/web?url=https%3A%2F%2Fbaidu.com&title=%E7%99%BE%E5%BA%A6&mount=mount:workspace:123:page:my-markdown-page
```

Open settings general:

```text
viben://settings/general
```

OAuth callback remains a reserved protocol branch:

```text
viben://oauth?session=<base64url-json>
```

### Current Tauri Integration

Desktop currently registers the `viben` scheme at the Tauri layer and already forwards `viben://oauth?...`.

The next implementation step is to replace the OAuth-only branch with a general deep link dispatcher:

```ts
parseVibenDeepLink(url) -> DesktopLocation | OAuthCallback

if OAuthCallback:
  emit oauth event
else:
  emit desktop navigation deep link event with route + mount hints
```

The frontend must then route that payload through the same `NavigationController` used by in-app sidebar, breadcrumb, markdown, and page-tree actions.

---

## Core Types

### `DesktopLocation`

`DesktopLocation` remains the canonical view-state and router-facing identity.

```ts
type DesktopLocation =
  | { kind: "workspace-home"; workspaceId: string }
  | { kind: "workspace-section"; workspaceId: string; section: WorkspaceSection }
  | { kind: "workspace-agent-detail"; workspaceId: string; agentId: string }
  | { kind: "workspace-executor-detail"; workspaceId: string; executorType: string }
  | { kind: "workspace-page"; workspaceId: string; pageSlug: string }
  | { kind: "workspace-web"; workspaceId: string; title: string; url: string; sourcePageSlug?: string; webId?: string }
  | { kind: "agent-detail"; agentId: string; workspacePath?: string }
  | { kind: "executor-detail"; executorType: string; workspacePath?: string }
  | { kind: "skill-detail"; skillId: string; agentId: string; workspacePath?: string }
  | { kind: "mcp-server-detail"; serverName: string; executorType: string; workspacePath?: string }
  | { kind: "subagent-detail"; configId: string; executorType: string; workspacePath?: string }
  | { kind: "prompt-detail"; promptId: string; executorType: string; workspacePath?: string }
  | { kind: "command-detail"; commandId: string; executorType: string; workspacePath?: string }
  | { kind: "settings"; section?: SettingsSection | string }
  | { kind: "documents" }
  | { kind: "device-pair" }
  | { kind: "global-route"; path: string };
```

### `DesktopRouteRef`

`DesktopRouteRef` is the serialized, stable route identity used by:

- tab persistence
- deep link dispatch
- route deduplication
- open-or-focus tab matching

`DesktopRouteRef` is derived from `DesktopLocation`.

```ts
interface DesktopRouteRef {
  kind: DesktopLocation["kind"];
  key: string;
  route: DesktopLocation;
}
```

Examples:

```ts
{ kind: "settings", key: "settings:general", route: { kind: "settings", section: "general" } }

{
  kind: "workspace-agent-detail",
  key: "workspace:123:agent:personal-assistant",
  route: { kind: "workspace-agent-detail", workspaceId: "123", agentId: "personal-assistant" },
}
```

### `NavigationTitleSource`

`NavigationTitleSource` stores where display text comes from.

```ts
type NavigationTitleSource =
  | { kind: "i18n"; key: string; fallback: string }
  | { kind: "literal"; value: string }
  | { kind: "workspace-name"; workspaceId: string }
  | { kind: "page-title"; pageId: string }
  | { kind: "web-title"; webId?: string; fallbackUrl?: string };
```

### `NavigationIconSource`

```ts
type NavigationIconSource =
  | { kind: "icon"; value: IconData }
  | { kind: "page-icon"; pageId: string }
  | { kind: "default-by-node-kind" };
```

### `NavigationNode`

`NavigationNode` describes what something is, independent of where it appears in the tree.

```ts
type NavigationNodeId = string;

type NavigationNodeKind =
  | "workspace-root"
  | "workspace-section"
  | "settings-root"
  | "settings-section"
  | "agent-detail"
  | "executor-detail"
  | "page"
  | "web"
  | "virtual-folder";

interface NavigationNode {
  id: NavigationNodeId;
  kind: NavigationNodeKind;
  route?: DesktopLocation;
  externalUrl?: string;
  titleSource: NavigationTitleSource;
  iconSource?: NavigationIconSource;
  metadata?: Record<string, unknown>;
}
```

### `NavigationMount`

`NavigationMount` describes where a node is mounted in the logical navigation tree.

```ts
type NavigationMountId = string;

type NavigationSurface =
  | "sidebar"
  | "breadcrumb"
  | "tab"
  | "dropdown"
  | "tree";

interface NavigationMount {
  id: NavigationMountId;
  nodeId: NavigationNodeId;
  parentMountId?: NavigationMountId;
  scope: "global" | `workspace:${string}`;
  order: number;
  source: "system" | "page-index" | "markdown" | "runtime";
  visibleIn?: NavigationSurface[];
}
```

### `NavigationStack`

The current logical path is stored as a list of navigation mount ids.

```ts
type NavigationStack = NavigationMountId[];
```

### `TabNavigationState`

Tabs store navigation stack and active view location.

```ts
interface TabNavigationState {
  id: string;
  routeRef: DesktopRouteRef;
  route: DesktopLocation;
  primaryMountId: NavigationMountId;
  navigationStack: NavigationStack;
}
```

Tabs must not store rendered `name` / `label` as source-of-truth.

### Stored Values by Layer

The system must store different values at different layers:

| Layer | Stores | Does not store |
|------|------|------|
| Router | `DesktopLocation` | breadcrumb strings |
| Tab persistence | `DesktopRouteRef`, `primaryMountId`, `navigationStack` | translated title |
| Navigation index | `NavigationNode`, `NavigationMount`, lookups | tab-local state |
| Resolver output | `NavigationDescriptor[]` | persistent identity |

This separation keeps persistence stable while still allowing:

- i18n updates
- page title updates
- icon updates
- multi-mount breadcrumb context

---

## Navigation Index

The navigation index contains:

1. `nodesById`
2. `mountsById`
3. `childrenByMountId`
4. lookup tables from route or content identity to node/mount ids

### Required Catalog Invariants

1. A node can have multiple mounts.
2. A mount points to exactly one node.
3. A mount belongs to exactly one scope.
4. Parent-child tree structure is defined by mounts, not routes.
5. System nodes and custom page nodes live in the same index.

---

## System Nodes

System nodes are registry-defined and translation-backed.

Examples:

### Settings Root

```ts
const settingsRootNode: NavigationNode = {
  id: "node:settings:root",
  kind: "settings-root",
  route: { kind: "settings" },
  titleSource: { kind: "i18n", key: "settings.title", fallback: "Settings" },
  iconSource: { kind: "icon", value: { type: "lucide", value: "settings" } },
};

const settingsRootMount: NavigationMount = {
  id: "mount:settings:root",
  nodeId: "node:settings:root",
  scope: "global",
  order: 0,
  source: "system",
  visibleIn: ["breadcrumb", "sidebar", "dropdown"],
};
```

### Settings General

```ts
const settingsGeneralNode: NavigationNode = {
  id: "node:settings:general",
  kind: "settings-section",
  route: { kind: "settings", section: "general" },
  titleSource: { kind: "i18n", key: "settings.sections.general", fallback: "General" },
  iconSource: { kind: "icon", value: { type: "lucide", value: "settings" } },
};

const settingsGeneralMount: NavigationMount = {
  id: "mount:settings:general",
  nodeId: "node:settings:general",
  parentMountId: "mount:settings:root",
  scope: "global",
  order: 1,
  source: "system",
  visibleIn: ["breadcrumb", "sidebar", "dropdown"],
};
```

### Workspace Chat

```ts
const chatNode: NavigationNode = {
  id: "node:workspace:123:section:chat",
  kind: "workspace-section",
  route: { kind: "workspace-section", workspaceId: "123", section: "chat" },
  titleSource: { kind: "i18n", key: "workspace.chat", fallback: "Chat" },
  iconSource: { kind: "icon", value: { type: "lucide", value: "message-square" } },
};

const chatMount: NavigationMount = {
  id: "mount:workspace:123:section:chat",
  nodeId: "node:workspace:123:section:chat",
  parentMountId: "mount:workspace:123:root",
  scope: "workspace:123",
  order: 1,
  source: "system",
  visibleIn: ["breadcrumb", "sidebar", "dropdown"],
};
```

---

## Page Nodes

Page nodes are content-backed and mount-flexible.

### Page Node Example

```ts
const pageNode: NavigationNode = {
  id: "node:page:project-spec",
  kind: "page",
  route: { kind: "workspace-page", workspaceId: "123", pageSlug: "docs/project-spec" },
  titleSource: { kind: "page-title", pageId: "project-spec" },
  iconSource: { kind: "page-icon", pageId: "project-spec" },
  metadata: { pageId: "project-spec", pageSlug: "docs/project-spec" },
};
```

### Page Mount Under Pages Root

```ts
const pageMount: NavigationMount = {
  id: "mount:workspace:123:page:project-spec",
  nodeId: "node:page:project-spec",
  parentMountId: "mount:workspace:123:pages-root",
  scope: "workspace:123",
  order: 20,
  source: "page-index",
  visibleIn: ["breadcrumb", "tree", "dropdown"],
};
```

---

## Web Nodes

External web pages are first-class navigation nodes.

### Web Node Example

```ts
const webNode: NavigationNode = {
  id: "node:web:baidu",
  kind: "web",
  route: {
    kind: "workspace-web",
    workspaceId: "123",
    webId: "baidu",
    title: "百度",
    url: "https://baidu.com",
    sourcePageSlug: "docs/project-spec",
  },
  externalUrl: "https://baidu.com",
  titleSource: { kind: "literal", value: "百度" },
  iconSource: { kind: "icon", value: { type: "lucide", value: "globe" } },
};
```

### Web Mount Under a Markdown Page

```ts
const webMount: NavigationMount = {
  id: "mount:workspace:123:web:baidu:under:project-spec",
  nodeId: "node:web:baidu",
  parentMountId: "mount:workspace:123:page:project-spec",
  scope: "workspace:123",
  order: 30,
  source: "markdown",
  visibleIn: ["breadcrumb", "tree", "dropdown"],
};
```

This yields a path like:

`工作区 / 页面 / 我的自定义markdown页面 / 百度`

without requiring route prefixes to encode parent-child semantics.

---

## Multiple Mounts for the Same Node

A single page or web node may appear under multiple parents.

Example:

```ts
const pageNode = {
  id: "node:page:spec",
  kind: "page",
  route: { kind: "workspace-page", workspaceId: "123", pageSlug: "docs/spec" },
  titleSource: { kind: "page-title", pageId: "spec" },
};

const pageMountUnderPages = {
  id: "mount:workspace:123:page:spec:under:pages",
  nodeId: "node:page:spec",
  parentMountId: "mount:workspace:123:pages-root",
  scope: "workspace:123",
  order: 21,
  source: "page-index",
};

const pageMountUnderAgent = {
  id: "mount:workspace:123:page:spec:under:agent:alice",
  nodeId: "node:page:spec",
  parentMountId: "mount:workspace:123:agent:alice:resources",
  scope: "workspace:123",
  order: 8,
  source: "markdown",
};
```

The same view route may therefore produce different breadcrumb paths depending on the tab's navigation stack.

---

## Navigation Resolver

All navigation UI must render through a single resolver layer.

### Interface

```ts
interface NavigationResolveContext {
  locale: string;
  surface: NavigationSurface;
  workspacesById: Record<string, { id: string; name: string }>;
  pagesById: Record<string, { id: string; title: string; icon?: IconData }>;
  webById?: Record<string, { title?: string; url?: string }>;
}

interface NavigationDescriptor {
  nodeId: NavigationNodeId;
  mountId: NavigationMountId;
  title: string;
  icon?: IconData;
  href?: string;
  route?: DesktopLocation;
  externalUrl?: string;
  isClickable: boolean;
}

function resolveNavigationMount(
  mountId: NavigationMountId,
  context: NavigationResolveContext
): NavigationDescriptor;

function resolveNavigationPath(
  stack: NavigationStack,
  context: NavigationResolveContext
): NavigationDescriptor[];

function resolveNavigationChildren(
  parentMountId: NavigationMountId,
  context: NavigationResolveContext
): NavigationDescriptor[];
```

### Title Resolution Order

1. `NavigationTitleSource.kind === "i18n"` -> `i18n.t(key, fallback)`
2. `workspace-name` -> current workspace name
3. `page-title` -> page metadata title
4. `web-title` -> stored title, then hostname, then fallback url
5. `literal` -> raw string

### Icon Resolution Order

1. explicit `icon`
2. page metadata icon
3. default icon by `NavigationNode.kind`

### Surface Rules

`surface` allows lightweight presentation differences:

- `breadcrumb`: compact titles, clickable path
- `sidebar`: tree-oriented visibility and ordering
- `tab`: leaf-oriented title
- `dropdown`: sibling listing
- `tree`: page hierarchy

The source of title/icon must still remain the same.

---

## State Model

The active tab state must be stack-based.

### Example: Settings / General

```ts
const tabState: TabNavigationState = {
  route: { kind: "settings", section: "general" },
  primaryMountId: "mount:settings:general",
  navigationStack: [
    "mount:settings:root",
    "mount:settings:general",
  ],
};
```

### Example: Workspace / Agents / Personal Assistant

```ts
const tabState: TabNavigationState = {
  route: {
    kind: "workspace-agent-detail",
    workspaceId: "123",
    agentId: "personal-assistant",
  },
  primaryMountId: "mount:workspace:123:agent-detail:personal-assistant",
  navigationStack: [
    "mount:workspace:123:root",
    "mount:workspace:123:section:agent",
    "mount:workspace:123:agent-detail:personal-assistant",
  ],
};
```

### Example: Workspace / Pages / My Markdown Page / Baidu

```ts
const tabState: TabNavigationState = {
  route: {
    kind: "workspace-web",
    workspaceId: "123",
    webId: "baidu",
    title: "百度",
    url: "https://baidu.com",
    sourcePageSlug: "docs/my-markdown-page",
  },
  primaryMountId: "mount:workspace:123:web:baidu:under:my-markdown-page",
  navigationStack: [
    "mount:workspace:123:root",
    "mount:workspace:123:pages-root",
    "mount:workspace:123:page:my-markdown-page",
    "mount:workspace:123:web:baidu:under:my-markdown-page",
  ],
};
```

---

## Navigation Controller API

Navigation APIs must operate on mounts and navigation stacks, not free-form label arrays.

Business components must not consume the controller, tab store, router, and resolver separately.

Business components must use a single routing hook that wraps those lower-level pieces.

### Required APIs

```ts
interface NavigationController {
  openMount(mountId: NavigationMountId): void;
  openStack(stack: NavigationStack): void;
  replaceStack(stack: NavigationStack): void;
  pushMount(mountId: NavigationMountId): void;
  pushRuntimeChildMount(parentMountId: NavigationMountId, node: RuntimeNavigationNodeInput): void;
  openExternalUnderCurrentMount(url: string, options?: { title?: string; icon?: IconData; webId?: string }): void;
  goBack(): void;
  goForward(): void;
  handleDeepLink(intent: DesktopDeepLinkIntent): void;
}
```

### Unified Routing Hook

Desktop business code must use a single hook:

```ts
function useDesktopRouting(): DesktopRoutingApi;
```

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
  openWorkspaceWeb(
    workspaceId: string,
    input: { url: string; title?: string; webId?: string; preferredMountId?: NavigationMountId },
    options?: DesktopOpenOptions
  ): void;
  openSettings(section?: SettingsSection | string, options?: DesktopOpenOptions): void;

  pushChildPage(mountId: NavigationMountId, options?: DesktopOpenOptions): void;
  pushCurrentPageChild(pageSlug: string, options?: DesktopOpenOptions): void;
  openCurrentPageWeb(
    url: string,
    input?: { title?: string; icon?: IconData; webId?: string },
    options?: DesktopOpenOptions
  ): void;

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

### Hook Responsibilities

`useDesktopRouting()` wraps:

- `NavigationController`
- active tab selection
- route projection
- resolver output for current breadcrumb / leaf
- header slot registration

The hook should expose semantic methods first and low-level methods second.

Preferred component usage:

- `openSettings("general")`
- `openWorkspaceAgentDetail(workspaceId, agentId)`
- `openWorkspacePage(workspaceId, pageSlug)`
- `openCurrentPageWeb(url, { title })`

Avoid making business components assemble low-level route objects unless necessary.

This keeps component code out of:

- tab store internals
- resolver wiring
- direct router manipulation
- ad hoc breadcrumb state

### Runtime Child Example

When a markdown page opens an embedded external url:

1. create or reuse `node:web:...`
2. create runtime mount under current leaf mount
3. append runtime mount id to current tab path

The app must not push raw breadcrumb strings like:

```ts
{ label: "百度", href: "..." }
```

---

## Surface Contracts

### Sidebar

Inputs:

- root mount id
- scope

Usage:

```ts
resolveNavigationChildren(rootMountId, {
  surface: "sidebar",
  ...context,
})
```

The sidebar must not define its own label/icon source.

Click behavior:

- sidebar item click calls `NavigationController.openMount(mountId)`
- it must not call raw `navigate(...)`
- tab creation / focus behavior is delegated to the controller

### Breadcrumb

Inputs:

- current tab `navigationStack`

Usage:

```ts
resolveNavigationPath(tabState.navigationStack, {
  surface: "breadcrumb",
  ...context,
})
```

Breadcrumb segment click:

- clicking index `i` truncates stack to `stack.slice(0, i + 1)`

Hover dropdown behavior:

- hovering a segment resolves `resolveNavigationChildren(parentMountId, { surface: "dropdown" })`
- selecting a sibling replaces the current stack suffix from that level downward
- the breadcrumb bar must not keep a parallel menu model

### Tabs

Inputs:

- `primaryMountId`

Usage:

```ts
resolveNavigationMount(tabState.primaryMountId, {
  surface: "tab",
  ...context,
})
```

Tab titles must not come from stored `name` strings.

Tab dedupe:

- compare `routeRef.key`
- optionally refine with `primaryMountId` or full `navigationStack`
- render title/icon only through resolver

### Header Dropdown

Inputs:

- current clicked mount id
- its parent mount id

Usage:

```ts
resolveNavigationChildren(parentMountId, {
  surface: "dropdown",
  ...context,
})
```

This lists logical siblings, not route siblings.

### Page Preview / Markdown Runtime

`apps/desktop/src/pages/apps/components/page-preview.tsx` and notion-like markdown blocks must integrate through the controller, not through route-local breadcrumb props.

Required runtime actions:

- open page leaf under current mount
- open web leaf under current mount
- push child mount onto current tab stack

Usage:

```ts
navigationController.pushMount(childMountId)

navigationController.openExternalUnderCurrentMount("https://baidu.com", {
  title: "百度",
  webId: "baidu",
})
```

Markdown blocks must pass content identity and optional preferred mount metadata, not final breadcrumb strings.

### Deep Link Entry

The desktop shell listens for parsed deep link payloads and forwards them to the same controller APIs:

```ts
navigationController.openStack(stack)
navigationController.openMount(primaryMountId)
```

The deep link entry must not bypass tab state and directly mutate router state.

### Page Tree

Inputs:

- pages root mount id

Usage:

```ts
resolveNavigationChildren("mount:workspace:123:pages-root", {
  surface: "tree",
  ...context,
})
```

---

## Translation Rules

### Rule

System navigation labels must always resolve through i18n at render time.

Examples:

- `settings.title`
- `settings.sections.general`
- `workspace.chat`
- `workspace.kanban`

### Consequence

When language changes:

- settings breadcrumb updates automatically
- workspace section breadcrumb updates automatically
- sidebar updates automatically
- tab titles update automatically

No manual breadcrumb-string rebuild is required.

### Exception

Content-backed page nodes may use literal or metadata-driven titles.

Those are not translated unless the page system itself supports translations.

---

## Example Scenarios

### Scenario 1: Settings Page

Route:

`/settings/general`

Stored state:

```ts
navigationStack = [
  "mount:settings:root",
  "mount:settings:general",
]
```

Resolved breadcrumb:

- `设置`
- `通用`

### Scenario 2: Workspace Agent Detail

Route:

`/workspace/123/agent/personal-assistant`

Stored state:

```ts
navigationStack = [
  "mount:workspace:123:root",
  "mount:workspace:123:section:agent",
  "mount:workspace:123:agent-detail:personal-assistant",
]
```

Resolved breadcrumb:

- `工作区名`
- `智能体`
- `个人助手`

### Scenario 3: Markdown Page Opens Child Page

Route:

`/workspace/123/page/docs/architecture`

Current path:

```ts
[
  "mount:workspace:123:root",
  "mount:workspace:123:pages-root",
  "mount:workspace:123:page:docs-architecture",
]
```

User opens embedded child page:

```ts
pushMount("mount:workspace:123:page:api-design:under:docs-architecture")
```

New breadcrumb:

- `工作区名`
- `页面`
- `架构设计`
- `API 设计`

Route may remain page route-based, but logical path becomes deeper.

### Scenario 4: Markdown Page Opens Web Leaf

Current path:

```ts
[
  "mount:workspace:123:root",
  "mount:workspace:123:pages-root",
  "mount:workspace:123:page:my-markdown-page",
]
```

Open:

```ts
openExternalUnderCurrentMount("https://baidu.com", {
  title: "百度",
  webId: "baidu",
})
```

Resulting breadcrumb:

- `工作区名`
- `页面`
- `我的自定义markdown页面`
- `百度`

### Scenario 5: Same Page Under Multiple Parents

Node:

`node:page:spec`

Mounts:

- under pages root
- under agent resources

Two tabs may therefore show:

Tab A:
- `工作区 / 页面 / Spec`

Tab B:
- `工作区 / 智能体 / 个人助手 / Spec`

Same route, different logical path.

---

## Consumer Usage Guide

This section defines exactly what each caller should provide.

### Workspace Sidebar

Caller provides:

- clicked `mountId`

Caller does:

```ts
navigationController.openMount("mount:workspace:123:section:agent")
```

Preferred form in React code:

```ts
const { openWorkspaceAgentList } = useDesktopRouting();
openWorkspaceAgentList("123");
```

Caller must not provide:

- title
- icon
- route string
- breadcrumb segments

### Settings Sidebar

Caller provides:

- clicked settings `mountId`

Caller does:

```ts
navigationController.openMount("mount:settings:general")
```

Preferred form in React code:

```ts
const { openSettings } = useDesktopRouting();
openSettings("general");
```

Result:

- route becomes `{ kind: "settings", section: "general" }`
- breadcrumb resolves to `设置 / 通用`
- tab title resolves from the same source

### Agent Detail Inner Tabs

Caller provides:

- current page-local tab key such as `workflow`, `prompts`, `skills`

Caller does:

- update page-local UI state only
- does not create new breadcrumb nodes unless the inner tab is promoted into a navigation node
- if the page needs global header tabs, register them through the routing hook

Rule:

- UI tabs inside a page are not automatically `NavigationNode`s
- only promote them when they need shareable breadcrumb / dropdown / deep link semantics

### Markdown Page Opening a Child Page

Caller provides:

- child content identity
- current leaf `mountId`

Caller does:

```ts
navigationController.pushMount("mount:workspace:123:page:api-design:under:docs-architecture")
```

Preferred form in React code:

```ts
const { pushCurrentPageChild } = useDesktopRouting();
pushCurrentPageChild("docs/api-design");
```

Caller must not provide:

- `["页面", "架构设计", "API 设计"]`

### Markdown Page Opening an External Web Leaf

Caller provides:

- external URL
- optional display title
- current leaf `mountId`

Caller does:

```ts
navigationController.openExternalUnderCurrentMount("https://baidu.com", {
  title: "百度",
  webId: "baidu",
})
```

Preferred form in React code:

```ts
const { openCurrentPageWeb } = useDesktopRouting();
openCurrentPageWeb("https://baidu.com", {
  title: "百度",
  webId: "baidu",
});
```

Controller responsibility:

- create or reuse `NavigationNode`
- create runtime `NavigationMount`
- append runtime mount onto current `NavigationStack`
- open or focus the tab

### Browser / OS Deep Link Entry

Caller provides:

- `viben://...`

Deep link parser produces:

```ts
interface DesktopDeepLinkIntent {
  route: DesktopLocation;
  routeRef: DesktopRouteRef;
  preferredMountId?: NavigationMountId;
  preferredStack?: NavigationStack;
  openMode?: "focus" | "reuse" | "new-tab";
}
```

Frontend does:

```ts
const { handleDeepLink } = useDesktopRouting();
handleDeepLink(intent);
```

The browser or OS caller must not know:

- translated labels
- resolved icons
- actual breadcrumb stack rendering

---

## Migration Plan

### Phase 1

Introduce navigation index and resolver beside current navigation system.

Deliverables:

- `NavigationNode`
- `NavigationMount`
- `NavigationStack`
- resolver
- system source

### Phase 2

Migrate system pages:

- settings
- workspace sections
- agent/executor detail pages

Replace free-form breadcrumb labels with stack-based resolution.

### Phase 3

Migrate page tree:

- workspace pages
- markdown page links
- web leaves

Build page source and markdown source.

### Phase 4

Replace tab state model:

- remove tab-stored display strings as primary source
- store `primaryMountId` and `navigationStack`

### Phase 5

Remove legacy free-form `segments` API from `WorkspaceHeader`.

Replace it with mount-aware header spec.

---

## Required Constraints

1. Navigation state must not store rendered breadcrumb strings as source-of-truth.
2. System navigation labels must be translation-backed.
3. Routes must not define logical parent-child relationships.
4. One node may have multiple mounts.
5. All surfaces must consume the shared resolver.
6. Runtime push must append mounts, not raw breadcrumb items.
7. Page tree freedom must be represented through mounts, not route hacks.

---

## Recommended API Names

To reduce naming drift during implementation, prefer the following public names:

### Types

- `DesktopLocation`
- `DesktopRouteRef`
- `NavigationNode`
- `NavigationMount`
- `NavigationStack`
- `NavigationIndex`
- `NavigationDescriptor`
- `DesktopDeepLinkIntent`
- `TabNavigationState`

### Services

- `createNavigationIndex()`
- `resolveNavigationMount()`
- `resolveNavigationPath()`
- `resolveNavigationChildren()`
- `parseDesktopRoute()`
- `serializeDesktopRouteRef()`
- `parseVibenDeepLink()`
- `resolveDefaultNavigationStack()`

### Controller Methods

- `openMount()`
- `openStack()`
- `replaceStack()`
- `pushMount()`
- `openExternalUnderCurrentMount()`
- `handleDeepLink()`

### React Hooks

- `useNavigationIndex()`
- `useNavigationResolver()`
- `useNavigationController()`
- `useDesktopRouting()`
- `useBreadcrumbStack()`
- `useDesktopDeepLink()`

Avoid weaker names such as:

- `meta`
- `item`
- `placement`
- `segments`
- `routePath`
- `breadcrumbData`

Those names tend to blur the distinction between:

- route identity
- logical tree mount
- render-time descriptor

---

## Acceptance Criteria

1. Settings breadcrumb matches settings sidebar translation exactly.
2. Workspace section breadcrumb matches section title and sidebar exactly.
3. Language switching updates system breadcrumbs and tabs without manual rebuild hacks.
4. A markdown page can open a child page and push a deeper logical breadcrumb path.
5. A markdown page can open an external web leaf and preserve workspace/page context.
6. The same page can appear under multiple logical parents with different breadcrumb paths.
7. Sidebar, breadcrumb, tab title, and dropdown all resolve from the same navigation index.
