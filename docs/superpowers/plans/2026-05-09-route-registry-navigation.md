# Route Registry Navigation Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-layer navigation system (DesktopLocation + BreadcrumbItemDescriptor + BrowserRouter) with a single Route Registry that guarantees URL round-trip consistency and simplifies new route addition to 1 entry + 1 component mapping.

**Architecture:** A compiled Route Registry (`route-registry.ts`) provides pattern matching, URL building, and cold-start breadcrumb construction. `TabNavigationState` stores a canonical URL string instead of a `DesktopLocation` object. A unified `navigate(method, url, headers)` API replaces the 15+ specialized navigation functions.

**Tech Stack:** TypeScript, Vitest (unit tests), Zustand (tab store), React Router v7 (v6 compat mode: BrowserRouter/Routes/Route JSX still works), i18next

**Spec:** `docs/superpowers/specs/2026-05-08-route-registry-navigation-redesign.md`

---

## File Structure

```
apps/desktop/src/navigation/
├── route-registry.ts          [CREATE]  RouteEntry[] definitions (single source of truth)
├── route-compiler.ts          [CREATE]  Pattern→regex compiler, match/build, conflict detection
├── route-compiler.test.ts     [CREATE]  Unit tests for compiler
├── breadcrumb-builder.ts      [CREATE]  buildColdStartBreadcrumb + helpers
├── breadcrumb-builder.test.ts [CREATE]  Unit tests for cold-start builder
├── navigate.ts                [CREATE]  navigate(method, url, headers) API
├── navigate.test.ts           [CREATE]  Unit tests for navigate
├── breadcrumb-stack.ts        [KEEP]    push/pop/replace atoms (minimal changes)
├── tab-navigation.ts          [REWRITE] Simplified: url-based instead of location-based
├── navigation-meta.ts         [MODIFY]  Keep legacy locationToUrl for migration only
├── location-navigation.ts     [DELETE]  Replaced by breadcrumb-builder.ts
├── navigation-state.ts        [KEEP]    No change
├── page-index.ts              [MODIFY]  Switch to dropdownCategory dispatch
├── page-navigation-extractor.ts [KEEP]  No change
├── deep-link.ts               [MODIFY]  Return URL string instead of DesktopLocation
├── index.ts                   [REWRITE] New barrel exports

apps/desktop/src/stores/
├── tab-store.ts               [MODIFY]  URL-based TabNavigationState + persist migration
├── tab-store.test.ts          [MODIFY]  Update tests for new format

apps/desktop/src/components/navigation/
├── tab-router-bridge.tsx      [REWRITE] Sync-lock + smart push

apps/desktop/src/hooks/
├── use-desktop-routing.ts     [REWRITE] Navigate API consumers
├── use-page-tabs.ts           [MODIFY]  Adapt to new TabNavigationState
├── use-global-shortcuts.ts    [MODIFY]  Replace createStackForLocation usage

apps/desktop/src/components/global-tab-bar/
├── index.tsx                  [MODIFY]  Replace createStackForLocation usage

apps/desktop/src/pages/        [MODIFY]  Batch: replace resolveLocationNavigation usage
├── agents/agent-detail.tsx
├── agents/executor-detail.tsx
├── skill-detail.tsx
├── mcp-server-detail.tsx
├── prompt-detail.tsx
├── command-detail.tsx
├── workspace-web.tsx
├── apps/workspace-page.tsx
├── apps/workspace-apps-page.tsx

apps/desktop/src/App.tsx       [MODIFY]  Route generation from registry
```

---

## Task 1: Route Compiler — Core Engine

**Files:**
- Create: `apps/desktop/src/navigation/route-compiler.ts`
- Create: `apps/desktop/src/navigation/route-compiler.test.ts`

This is the foundation. Pure functions, no dependencies on the rest of the app.

- [ ] **Step 1: Write failing test — pattern compilation**

```typescript
// apps/desktop/src/navigation/route-compiler.test.ts
import { describe, it, expect } from "vitest";
import { compilePattern } from "./route-compiler";

describe("compilePattern", () => {
  it("compiles constant-only pattern", () => {
    const compiled = compilePattern("/documents");
    expect(compiled.regex.test("/documents")).toBe(true);
    expect(compiled.regex.test("/documents/extra")).toBe(false);
    expect(compiled.paramNames).toEqual([]);
    expect(compiled.restParam).toBeNull();
  });

  it("compiles single param pattern", () => {
    const compiled = compilePattern("/workspace/:workspaceId");
    expect(compiled.regex.test("/workspace/my-proj")).toBe(true);
    expect(compiled.regex.test("/workspace/my-proj/extra")).toBe(false);
    expect(compiled.paramNames).toEqual(["workspaceId"]);
    expect(compiled.restParam).toBeNull();
  });

  it("compiles rest param pattern", () => {
    const compiled = compilePattern("/workspace/:workspaceId/pages/:pageSlug+");
    expect(compiled.regex.test("/workspace/x/pages/a/b/c")).toBe(true);
    expect(compiled.regex.test("/workspace/x/pages/")).toBe(false);
    expect(compiled.regex.test("/workspace/x/pages")).toBe(false);
    expect(compiled.paramNames).toEqual(["workspaceId", "pageSlug"]);
    expect(compiled.restParam).toBe("pageSlug");
  });

  it("uses ^ and $ anchoring", () => {
    const compiled = compilePattern("/settings/:section");
    expect(compiled.regex.test("/settings/general")).toBe(true);
    expect(compiled.regex.test("/settings/general/extra")).toBe(false);
    expect(compiled.regex.test("prefix/settings/general")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/desktop && pnpm test -- route-compiler`
Expected: FAIL with "Cannot find module './route-compiler'"

- [ ] **Step 3: Implement compilePattern**

```typescript
// apps/desktop/src/navigation/route-compiler.ts

export interface CompiledPattern {
  pattern: string;
  regex: RegExp;
  paramNames: string[];
  restParam: string | null;
  build: (params: Record<string, string>) => string;
  constantSegmentCount: number;
}

/**
 * Compile a URL pattern into a regex matcher and URL builder.
 * Patterns use :param for single segments and :param+ for rest (multi-segment).
 * All compiled regexes are anchored with ^ and $.
 */
export function compilePattern(pattern: string): CompiledPattern {
  const paramNames: string[] = [];
  let restParam: string | null = null;
  let constantSegmentCount = 0;

  const segments = pattern.split("/").filter(Boolean);
  const regexParts: string[] = [];
  const buildParts: Array<{ type: "const"; value: string } | { type: "param"; name: string; rest: boolean }> = [];

  for (const segment of segments) {
    if (segment.startsWith(":")) {
      const isRest = segment.endsWith("+");
      const name = isRest ? segment.slice(1, -1) : segment.slice(1);
      paramNames.push(name);
      if (isRest) {
        restParam = name;
        regexParts.push("(.+)");
      } else {
        regexParts.push("([^/]+)");
      }
      buildParts.push({ type: "param", name, rest: isRest });
    } else {
      constantSegmentCount++;
      regexParts.push(escapeRegex(segment));
      buildParts.push({ type: "const", value: segment });
    }
  }

  const regex = new RegExp("^\\/" + regexParts.join("\\/") + "$");

  const build = (params: Record<string, string>): string => {
    const parts = buildParts.map((part) => {
      if (part.type === "const") return part.value;
      const value = params[part.name];
      if (!value && part.rest) {
        throw new Error(`Rest param "${part.name}" must be non-empty for pattern: ${pattern}`);
      }
      // Rest params: keep / unencoded. Single params: encode.
      return part.rest ? value : encodeURIComponent(value);
    });
    return "/" + parts.join("/");
  };

  return { pattern, regex, paramNames, restParam, build, constantSegmentCount };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/desktop && pnpm test -- route-compiler`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Write failing test — match and build functions**

Add to `route-compiler.test.ts`:

```typescript
import { compilePattern, matchUrl, buildUrl, type RouteEntry } from "./route-compiler";

const TEST_ENTRIES: RouteEntry[] = [
  { pattern: "/documents", icon: { type: "lucide", value: "file-text" }, title: "Documents" },
  { pattern: "/workspace", icon: { type: "lucide", value: "home" }, title: "Workspaces" },
  { pattern: "/workspace/:workspaceId", icon: { type: "lucide", value: "home" }, title: (p) => p.workspaceId },
  { pattern: "/workspace/:workspaceId/pages", icon: { type: "lucide", value: "layout-grid" }, title: "Pages" },
  { pattern: "/workspace/:workspaceId/pages/:pageSlug+", icon: { type: "lucide", value: "file-text" }, title: (p) => p.pageSlug.split("/").pop()! },
  { pattern: "/workspace/:workspaceId/web", icon: { type: "lucide", value: "globe" }, title: (p) => p.title ?? "Web", queryParams: ["url", "title"] },
  { pattern: "/settings", icon: { type: "lucide", value: "settings" }, title: "Settings", isContainer: true },
  { pattern: "/settings/:section", icon: { type: "lucide", value: "settings" }, title: (p) => p.section },
];

describe("matchUrl", () => {
  it("matches exact path", () => {
    const match = matchUrl("/documents", TEST_ENTRIES);
    expect(match).not.toBeNull();
    expect(match!.pattern).toBe("/documents");
    expect(match!.params).toEqual({});
  });

  it("matches parameterized path", () => {
    const match = matchUrl("/workspace/my-proj", TEST_ENTRIES);
    expect(match!.pattern).toBe("/workspace/:workspaceId");
    expect(match!.params).toEqual({ workspaceId: "my-proj" });
  });

  it("matches rest param path", () => {
    const match = matchUrl("/workspace/x/pages/a/b/c", TEST_ENTRIES);
    expect(match!.pattern).toBe("/workspace/:workspaceId/pages/:pageSlug+");
    expect(match!.params).toEqual({ workspaceId: "x", pageSlug: "a/b/c" });
  });

  it("extracts declared query params", () => {
    const match = matchUrl("/workspace/x/web?url=https%3A%2F%2Fexample.com&title=Test&extra=ignored", TEST_ENTRIES);
    expect(match!.params).toEqual({ workspaceId: "x", url: "https://example.com", title: "Test" });
  });

  it("prefers more specific route (no splat over splat)", () => {
    const match = matchUrl("/workspace/x/pages", TEST_ENTRIES);
    expect(match!.pattern).toBe("/workspace/:workspaceId/pages");
  });

  it("returns null for unknown URL", () => {
    expect(matchUrl("/unknown/path", TEST_ENTRIES)).toBeNull();
  });
});

describe("buildUrl", () => {
  it("builds constant-only URL", () => {
    expect(buildUrl("/documents", {}, TEST_ENTRIES)).toBe("/documents");
  });

  it("builds parameterized URL", () => {
    expect(buildUrl("/workspace/:workspaceId", { workspaceId: "my-proj" }, TEST_ENTRIES)).toBe("/workspace/my-proj");
  });

  it("builds rest param URL", () => {
    expect(buildUrl("/workspace/:workspaceId/pages/:pageSlug+", { workspaceId: "x", pageSlug: "a/b" }, TEST_ENTRIES)).toBe("/workspace/x/pages/a/b");
  });

  it("appends declared query params in order", () => {
    expect(buildUrl("/workspace/:workspaceId/web", { workspaceId: "x", url: "https://a.com", title: "T" }, TEST_ENTRIES)).toBe("/workspace/x/web?url=https%3A%2F%2Fa.com&title=T");
  });

  it("throws on empty rest param", () => {
    expect(() => buildUrl("/workspace/:workspaceId/pages/:pageSlug+", { workspaceId: "x", pageSlug: "" }, TEST_ENTRIES)).toThrow();
  });

  it("round-trips with matchUrl", () => {
    const url1 = buildUrl("/workspace/:workspaceId/pages/:pageSlug+", { workspaceId: "x", pageSlug: "a/b" }, TEST_ENTRIES);
    const match = matchUrl(url1, TEST_ENTRIES)!;
    const url2 = buildUrl(match.pattern, match.params, TEST_ENTRIES);
    expect(url1).toBe(url2);
  });
});
```

- [ ] **Step 6: Implement matchUrl and buildUrl + RouteEntry type**

Add to `route-compiler.ts`:

```typescript
import type { IconData } from "@/components/ui/icon-picker";

export interface RouteEntry<TParams extends Record<string, string> = Record<string, string>> {
  pattern: string;
  icon: IconData | ((params: TParams) => IconData);
  title: string | ((params: TParams) => string);
  titleKey?: string;
  isContainer?: boolean;
  queryParams?: string[];
  dropdownCategory?: string;
}

export interface RouteMatch {
  pattern: string;
  params: Record<string, string>;
  icon: IconData;
  title: string;
  entry: RouteEntry;
}

export interface CompiledRoute extends CompiledPattern {
  entry: RouteEntry;
  queryParams: string[];
}

/** Compile all entries, sorted by specificity (more constant segments first, no-rest before rest) */
export function compileRegistry(entries: RouteEntry[]): CompiledRoute[] {
  const compiled = entries.map((entry) => ({
    ...compilePattern(entry.pattern),
    entry,
    queryParams: entry.queryParams ?? [],
  }));

  // Sort: more constant segments first; tie-break: no rest before rest
  compiled.sort((a, b) => {
    if (b.constantSegmentCount !== a.constantSegmentCount) {
      return b.constantSegmentCount - a.constantSegmentCount;
    }
    return (a.restParam ? 1 : 0) - (b.restParam ? 1 : 0);
  });

  return compiled;
}

export function matchUrl(url: string, entries: RouteEntry[]): RouteMatch | null {
  const compiled = compileRegistry(entries);
  return matchUrlCompiled(url, compiled);
}

export function matchUrlCompiled(url: string, compiled: CompiledRoute[]): RouteMatch | null {
  const parsed = new URL(url, "http://localhost");
  const pathname = parsed.pathname;

  for (const route of compiled) {
    const pathMatch = route.regex.exec(pathname);
    if (!pathMatch) continue;

    const params: Record<string, string> = {};
    route.paramNames.forEach((name, i) => {
      const raw = pathMatch[i + 1];
      // Rest params: decode each segment individually to preserve "/" as path separator
      // Single params: decode the whole value
      params[name] = name === route.restParam
        ? raw.split("/").map(decodeURIComponent).join("/")
        : decodeURIComponent(raw);
    });

    for (const qp of route.queryParams) {
      const value = parsed.searchParams.get(qp);
      if (value) params[qp] = value;
    }

    return {
      pattern: route.pattern,
      params,
      icon: resolveIcon(route.entry, params),
      title: resolveTitle(route.entry, params),
      entry: route.entry,
    };
  }
  return null;
}

export function buildUrl(pattern: string, params: Record<string, string>, entries: RouteEntry[]): string {
  const compiled = compileRegistry(entries);
  return buildUrlCompiled(pattern, params, compiled);
}

export function buildUrlCompiled(pattern: string, params: Record<string, string>, compiled: CompiledRoute[]): string {
  const route = compiled.find((r) => r.pattern === pattern);
  if (!route) throw new Error(`Unknown pattern: ${pattern}`);

  let path = route.build(params);

  const queryEntries = route.queryParams
    .filter((qp) => params[qp])
    .map((qp) => [qp, params[qp]] as [string, string]);

  if (queryEntries.length > 0) {
    path += "?" + new URLSearchParams(queryEntries).toString();
  }

  return path;
}

function resolveIcon(entry: RouteEntry, params: Record<string, string>): IconData {
  return typeof entry.icon === "function" ? entry.icon(params) : entry.icon;
}

function resolveTitle(entry: RouteEntry, params: Record<string, string>): string {
  return typeof entry.title === "function" ? entry.title(params) : entry.title;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd apps/desktop && pnpm test -- route-compiler`
Expected: PASS (all tests)

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/navigation/route-compiler.ts apps/desktop/src/navigation/route-compiler.test.ts
git commit -m "feat(navigation): add route compiler with match/build/compile"
```

---

## Task 2: Route Registry — Route Definitions

**Files:**
- Create: `apps/desktop/src/navigation/route-registry.ts`

- [ ] **Step 1: Create the route registry with all entries**

```typescript
// apps/desktop/src/navigation/route-registry.ts
import type { RouteEntry } from "./route-compiler";
import { compileRegistry, matchUrlCompiled, buildUrlCompiled, type CompiledRoute, type RouteMatch } from "./route-compiler";
import type { IconData } from "@/components/ui/icon-picker";

// ─── Route Definitions ──────────────────────────────────────────────────────

export const ROUTE_ENTRIES: RouteEntry[] = [
  // ─── Top-level ───
  { pattern: "/documents", icon: { type: "lucide", value: "file-text" }, title: "Documents", titleKey: "sidebar.documents", dropdownCategory: "root" },
  { pattern: "/devices/pair", icon: { type: "lucide", value: "smartphone" }, title: "Devices", titleKey: "sidebar.devices", dropdownCategory: "root" },
  { pattern: "/workspace", icon: { type: "lucide", value: "home" }, title: "Workspaces", titleKey: "sidebar.workspaces", isContainer: true, dropdownCategory: "root" },
  { pattern: "/mcp-services", icon: { type: "lucide", value: "server" }, title: "MCP Services", titleKey: "sidebar.mcpServices", isContainer: true, dropdownCategory: "root" },
  { pattern: "/mcp-services/dashboard", icon: { type: "lucide", value: "layout-dashboard" }, title: "Dashboard", titleKey: "sidebar.dashboard", dropdownCategory: "mcp-section" },
  { pattern: "/mcp-services/data-sources", icon: { type: "lucide", value: "database" }, title: "Data Sources", titleKey: "sidebar.dataSources", dropdownCategory: "mcp-section" },
  { pattern: "/mcp-services/search-service", icon: { type: "lucide", value: "search" }, title: "Search Service", titleKey: "sidebar.searchService", dropdownCategory: "mcp-section" },
  { pattern: "/mcp-services/page-debug", icon: { type: "lucide", value: "bug" }, title: "Page Debug", titleKey: "sidebar.pageDebug", dropdownCategory: "mcp-section" },
  { pattern: "/mcp-services/logs", icon: { type: "lucide", value: "scroll-text" }, title: "Logs", titleKey: "sidebar.logs", dropdownCategory: "mcp-section" },
  { pattern: "/publish", icon: { type: "lucide", value: "upload" }, title: "Publish", titleKey: "sidebar.publish", dropdownCategory: "root" },
  { pattern: "/my-packages", icon: { type: "lucide", value: "package" }, title: "My Packages", titleKey: "sidebar.myPackages", dropdownCategory: "root" },
  { pattern: "/analytics", icon: { type: "lucide", value: "chart-column" }, title: "Analytics", titleKey: "sidebar.analytics", dropdownCategory: "root" },

  // ─── Settings ───
  { pattern: "/settings", icon: { type: "lucide", value: "settings" }, title: "Settings", titleKey: "sidebar.settings", isContainer: true, dropdownCategory: "root" },
  { pattern: "/settings/:section", icon: (p) => getSettingsIcon(p.section), title: (p) => getSettingsTitle(p.section), dropdownCategory: "settings" },

  // ─── Workspace ───
  { pattern: "/workspace/:workspaceId", icon: { type: "lucide", value: "home" }, title: (p) => p.workspaceId, dropdownCategory: "workspace" },

  // ─── Workspace Sections ───
  { pattern: "/workspace/:workspaceId/pages", icon: { type: "lucide", value: "layout-grid" }, title: "Pages", titleKey: "workspace.sections.pages", dropdownCategory: "workspace-section" },
  { pattern: "/workspace/:workspaceId/chat", icon: { type: "lucide", value: "message-square" }, title: "Chat", titleKey: "workspace.sections.chat", dropdownCategory: "workspace-section" },
  { pattern: "/workspace/:workspaceId/kanban", icon: { type: "lucide", value: "layout-dashboard" }, title: "Kanban", titleKey: "workspace.sections.kanban", dropdownCategory: "workspace-section" },
  { pattern: "/workspace/:workspaceId/cron", icon: { type: "lucide", value: "clock" }, title: "Scheduled Tasks", titleKey: "workspace.sections.cron", dropdownCategory: "workspace-section" },
  { pattern: "/workspace/:workspaceId/ideas", icon: { type: "lucide", value: "lightbulb" }, title: "Ideas", titleKey: "workspace.sections.ideas", dropdownCategory: "workspace-section" },
  { pattern: "/workspace/:workspaceId/agent", icon: { type: "lucide", value: "bot" }, title: "Agents", titleKey: "workspace.sections.agents", dropdownCategory: "workspace-section" },
  { pattern: "/workspace/:workspaceId/files", icon: { type: "lucide", value: "folder-open" }, title: "Files", titleKey: "workspace.sections.files", dropdownCategory: "workspace-section" },
  { pattern: "/workspace/:workspaceId/github", icon: { type: "lucide", value: "github" }, title: "GitHub", titleKey: "workspace.sections.github", dropdownCategory: "workspace-section" },
  { pattern: "/workspace/:workspaceId/chat-monitor", icon: { type: "lucide", value: "activity" }, title: "Chat Monitor", titleKey: "workspace.sections.chatMonitor", dropdownCategory: "workspace-section" },

  // ─── Workspace Detail ───
  { pattern: "/workspace/:workspaceId/pages/:pageSlug+", icon: { type: "lucide", value: "file-text" }, title: (p) => humanize(p.pageSlug.split("/").pop()!), dropdownCategory: "page" },
  { pattern: "/workspace/:workspaceId/agent/:agentId", icon: { type: "lucide", value: "bot" }, title: (p) => p.agentId, dropdownCategory: "detail" },
  { pattern: "/workspace/:workspaceId/executor/:executorType", icon: { type: "lucide", value: "terminal" }, title: (p) => p.executorType, dropdownCategory: "detail" },
  { pattern: "/workspace/:workspaceId/web", icon: { type: "lucide", value: "globe" }, title: (p) => p.title ?? "Web", queryParams: ["url", "title", "source_page", "web_id"], dropdownCategory: "detail" },

  // ─── Global Detail ───
  { pattern: "/agent/:agentId", icon: { type: "lucide", value: "bot" }, title: (p) => p.agentId, queryParams: ["workspace_path"], dropdownCategory: "detail" },
  { pattern: "/executor/:executorType", icon: { type: "lucide", value: "terminal" }, title: (p) => p.executorType, queryParams: ["workspace_path"], dropdownCategory: "detail" },
  { pattern: "/skill/:skillId", icon: { type: "lucide", value: "sparkles" }, title: (p) => p.skillId, queryParams: ["workspace_path", "agent_id"], dropdownCategory: "detail" },
  { pattern: "/mcp-server/:serverName", icon: { type: "lucide", value: "server" }, title: (p) => p.serverName, queryParams: ["workspace_path", "executor_type"], dropdownCategory: "detail" },
  { pattern: "/subagent/:configId", icon: { type: "lucide", value: "bot" }, title: (p) => p.configId, queryParams: ["workspace_path", "executor_type"], dropdownCategory: "detail" },
  { pattern: "/prompt/:promptId", icon: { type: "lucide", value: "quote" }, title: (p) => p.promptId, queryParams: ["workspace_path", "executor_type"], dropdownCategory: "detail" },
  { pattern: "/command/:commandId", icon: { type: "lucide", value: "square-terminal" }, title: (p) => p.commandId, queryParams: ["workspace_path", "executor_type"], dropdownCategory: "detail" },

  // ─── Standalone pages (not part of breadcrumb hierarchy, but need registry for normalizeUrl) ───
  { pattern: "/os", icon: { type: "lucide", value: "monitor" }, title: "OS", dropdownCategory: "root" },
  { pattern: "/inspector", icon: { type: "lucide", value: "search" }, title: "Inspector", dropdownCategory: "root" },
  { pattern: "/mcp-marketplace", icon: { type: "lucide", value: "store" }, title: "MCP Marketplace", titleKey: "sidebar.mcpMarketplace", dropdownCategory: "root" },
  { pattern: "/skills-market", icon: { type: "lucide", value: "sparkles" }, title: "Skills Market", titleKey: "sidebar.skillsMarket", dropdownCategory: "root" },
  { pattern: "/chat-monitor", icon: { type: "lucide", value: "activity" }, title: "Chat Monitor", titleKey: "sidebar.chatMonitor", dropdownCategory: "root" },
  { pattern: "/about", icon: { type: "lucide", value: "info" }, title: "About", titleKey: "sidebar.about", dropdownCategory: "root" },

];

// NOTE: Legacy paths (/workspace/:workspaceId/apps, /workspace/:workspaceId/page,
// /workspace/:workspaceId/agents) are NOT registered and NOT redirected.
// Stored data with these paths is dropped during persist migration.
// App.tsx simply removes these old route definitions.

// ─── Compiled Registry (singleton) ──────────────────────────────────────────

const compiled: CompiledRoute[] = compileRegistry(ROUTE_ENTRIES);
const compiledByPattern = new Map(compiled.map((r) => [r.pattern, r]));

export const registry = {
  match(url: string): RouteMatch | null {
    return matchUrlCompiled(url, compiled);
  },

  build(pattern: string, params: Record<string, string> = {}): string {
    return buildUrlCompiled(pattern, params, compiled);
  },

  getEntry(pattern: string): RouteEntry | undefined {
    return compiledByPattern.get(pattern)?.entry;
  },

  hasEntry(pattern: string): boolean {
    return compiledByPattern.has(pattern);
  },

  getRestParam(pattern: string): string | null {
    return compiledByPattern.get(pattern)?.restParam ?? null;
  },

  getParamNames(pattern: string): string[] {
    return compiledByPattern.get(pattern)?.paramNames ?? [];
  },

  getByCategory(category: string): RouteEntry[] {
    return compiled.filter((r) => r.entry.dropdownCategory === category).map((r) => r.entry);
  },

  getIcon(pattern: string, params: Record<string, string> = {}): IconData | undefined {
    const entry = compiledByPattern.get(pattern)?.entry;
    if (!entry) return undefined;
    return typeof entry.icon === "function" ? entry.icon(params) : entry.icon;
  },

  normalizeUrl(url: string): string {
    const match = this.match(url);
    if (!match) {
      const { pathname } = new URL(url, "http://localhost");
      return pathname;
    }
    return this.build(match.pattern, match.params);
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export function humanize(slug: string): string {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getSettingsIcon(section: string): IconData {
  // Simplified — can be expanded with per-section icons
  return { type: "lucide", value: "settings" };
}

function getSettingsTitle(section: string): string {
  return humanize(section);
}

export type { RouteEntry, RouteMatch, CompiledRoute };
```

- [ ] **Step 2: Run type check**

Run: `cd apps/desktop && pnpm exec tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to route-registry.ts (other existing errors are OK)

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/navigation/route-registry.ts
git commit -m "feat(navigation): add route registry with all route definitions"
```

---

## Task 3: Breadcrumb Builder — Cold Start

**Files:**
- Create: `apps/desktop/src/navigation/breadcrumb-builder.ts`
- Create: `apps/desktop/src/navigation/breadcrumb-builder.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/desktop/src/navigation/breadcrumb-builder.test.ts
import { describe, it, expect } from "vitest";
import { buildColdStartBreadcrumb, deriveAncestorsFromPrefix } from "./breadcrumb-builder";

describe("deriveAncestorsFromPrefix", () => {
  it("derives ancestors for workspace agent detail", () => {
    const ancestors = deriveAncestorsFromPrefix("/workspace/:workspaceId/agent/:agentId");
    expect(ancestors).toEqual([
      "/workspace",
      "/workspace/:workspaceId",
      "/workspace/:workspaceId/agent",
    ]);
  });

  it("returns empty for top-level route with no parent", () => {
    const ancestors = deriveAncestorsFromPrefix("/documents");
    expect(ancestors).toEqual([]);
  });

  it("finds /settings as ancestor of /settings/:section", () => {
    const ancestors = deriveAncestorsFromPrefix("/settings/:section");
    expect(ancestors).toEqual(["/settings"]);
  });

  it("finds /mcp-services as ancestor of /mcp-services/dashboard", () => {
    const ancestors = deriveAncestorsFromPrefix("/mcp-services/dashboard");
    expect(ancestors).toEqual(["/mcp-services"]);
  });
});

describe("buildColdStartBreadcrumb", () => {
  it("builds breadcrumb for workspace section", () => {
    const stack = buildColdStartBreadcrumb("/workspace/my-proj/chat");
    expect(stack).toHaveLength(3);
    expect(stack[0].label).toBe("Workspaces");
    expect(stack[0].href).toBe("/workspace");
    expect(stack[1].label).toBe("my-proj");
    expect(stack[1].href).toBe("/workspace/my-proj");
    expect(stack[2].label).toBe("Chat");
    expect(stack[2].href).toBe("/workspace/my-proj/chat");
  });

  it("expands rest param segments", () => {
    const stack = buildColdStartBreadcrumb("/workspace/x/pages/first/second/third");
    expect(stack).toHaveLength(6);
    // Ancestors
    expect(stack[0].href).toBe("/workspace");
    expect(stack[1].href).toBe("/workspace/x");
    expect(stack[2].href).toBe("/workspace/x/pages");
    // Rest intermediates (label = last segment only)
    expect(stack[3].label).toBe("First");
    expect(stack[3].href).toBe("/workspace/x/pages/first");
    expect(stack[4].label).toBe("Second");
    expect(stack[4].href).toBe("/workspace/x/pages/first/second");
    // Current
    expect(stack[5].label).toBe("Third");
    expect(stack[5].href).toBe("/workspace/x/pages/first/second/third");
  });

  it("handles single-segment rest param (no expansion)", () => {
    const stack = buildColdStartBreadcrumb("/workspace/x/pages/single");
    expect(stack).toHaveLength(4); // workspace, x, pages, single
    expect(stack[3].label).toBe("Single");
  });

  it("applies headers override to current node", () => {
    const stack = buildColdStartBreadcrumb("/workspace/x/agent/gpt", { label: "GPT-4o" });
    const last = stack[stack.length - 1];
    expect(last.label).toBe("GPT-4o");
  });

  it("returns empty for unknown URL", () => {
    expect(buildColdStartBreadcrumb("/totally/unknown")).toEqual([]);
  });

  it("builds settings breadcrumb with parent", () => {
    const stack = buildColdStartBreadcrumb("/settings/general");
    expect(stack).toHaveLength(2);
    expect(stack[0].label).toBe("Settings");
    expect(stack[1].label).toBe("General");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/desktop && pnpm test -- breadcrumb-builder`
Expected: FAIL

- [ ] **Step 3: Implement breadcrumb-builder**

```typescript
// apps/desktop/src/navigation/breadcrumb-builder.ts
import { registry, humanize } from "./route-registry";
import type { RouteEntry, RouteMatch } from "./route-compiler";
import type { IconData } from "@/components/ui/icon-picker";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NavigateHeaders {
  label?: string;
  icon?: IconData;
  id?: string;
  sourceNodeId?: string;
  parentNodeId?: string;
  meta?: BreadcrumbMeta;
}

export interface BreadcrumbMeta {
  workspaceId?: string;
  section?: string;
  pageSlug?: string;
  agentId?: string;
  executorType?: string;
  webId?: string;
  url?: string;
  blockId?: string;
}

export interface BreadcrumbStackItem {
  id: string;
  label: string;
  icon?: IconData;
  pattern?: string;
  href?: string;
  sourceNodeId?: string;
  parentNodeId?: string;
  meta?: BreadcrumbMeta;
}

// ─── Cold Start Builder ─────────────────────────────────────────────────────

export function buildColdStartBreadcrumb(url: string, headers?: NavigateHeaders): BreadcrumbStackItem[] {
  const match = registry.match(url);
  if (!match) return [];

  const chain: BreadcrumbStackItem[] = [];

  // 1. Path prefix ancestors
  for (const ancestorPattern of deriveAncestorsFromPrefix(match.pattern)) {
    const ancestorEntry = registry.getEntry(ancestorPattern)!;
    const ancestorParams = pickMatchingParams(ancestorPattern, match.params);
    chain.push(buildBreadcrumbItem(ancestorEntry, ancestorParams));
  }

  // 2. Rest param intermediate levels
  const restParam = registry.getRestParam(match.pattern);
  if (restParam && match.params[restParam]?.includes("/")) {
    const segments = match.params[restParam].split("/");
    for (let i = 1; i < segments.length; i++) {
      const prefix = segments.slice(0, i).join("/");
      const lastSegment = segments[i - 1];
      chain.push(buildBreadcrumbItem(
        match.entry,
        { ...match.params, [restParam]: prefix },
        { label: humanize(lastSegment) },
      ));
    }
  }

  // 3. Current node (headers can override label/icon)
  chain.push(buildBreadcrumbItem(match.entry, match.params, headers));

  return chain;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function deriveAncestorsFromPrefix(pattern: string): string[] {
  const segments = pattern.split("/").filter(Boolean);
  const ancestors: string[] = [];

  for (let i = segments.length - 1; i > 0; i--) {
    const candidate = "/" + segments.slice(0, i).join("/");
    if (registry.hasEntry(candidate)) {
      ancestors.unshift(candidate);
    }
  }
  return ancestors;
}

export function pickMatchingParams(
  targetPattern: string,
  allParams: Record<string, string>,
): Record<string, string> {
  const paramNames = registry.getParamNames(targetPattern);
  const result: Record<string, string> = {};
  for (const name of paramNames) {
    if (allParams[name] !== undefined) {
      result[name] = allParams[name];
    }
  }
  return result;
}

export function buildBreadcrumbItem(
  entry: RouteEntry,
  params: Record<string, string>,
  headers?: NavigateHeaders,
): BreadcrumbStackItem {
  const href = registry.build(entry.pattern, params);
  const icon = headers?.icon ?? (typeof entry.icon === "function" ? entry.icon(params) : entry.icon);
  const title = typeof entry.title === "function" ? entry.title(params) : entry.title;

  return {
    id: headers?.id ?? href,
    label: headers?.label ?? title,
    icon,
    pattern: entry.pattern,
    href,
    sourceNodeId: headers?.sourceNodeId,
    parentNodeId: headers?.parentNodeId,
    meta: headers?.meta,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/desktop && pnpm test -- breadcrumb-builder`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/navigation/breadcrumb-builder.ts apps/desktop/src/navigation/breadcrumb-builder.test.ts
git commit -m "feat(navigation): add cold-start breadcrumb builder"
```

---

## Task 4: Navigate API — `navigate()` + `buildNavigateLeaf` + `popToBreadcrumb` + `isStackPrefixOf`

**Files:**
- Create: `apps/desktop/src/navigation/navigate.ts`
- Create: `apps/desktop/src/navigation/navigate.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/desktop/src/navigation/navigate.test.ts
import { describe, it, expect } from "vitest";
import { buildNavigateLeaf, isStackPrefixOf } from "./navigate";
import type { BreadcrumbStackItem } from "./breadcrumb-builder";

describe("buildNavigateLeaf", () => {
  it("builds leaf from URL with registry defaults", () => {
    const leaf = buildNavigateLeaf("/workspace/x/agent/gpt");
    expect(leaf.id).toBe("/workspace/x/agent/gpt");
    expect(leaf.label).toBe("gpt");
    expect(leaf.pattern).toBe("/workspace/:workspaceId/agent/:agentId");
    expect(leaf.href).toBe("/workspace/x/agent/gpt");
  });

  it("applies headers overrides", () => {
    const leaf = buildNavigateLeaf("/workspace/x/agent/gpt", {
      label: "GPT-4o",
      id: "custom-id",
      icon: { type: "lucide", value: "sparkles" },
    });
    expect(leaf.id).toBe("custom-id");
    expect(leaf.label).toBe("GPT-4o");
    expect(leaf.icon).toEqual({ type: "lucide", value: "sparkles" });
  });

  it("handles unknown URL gracefully", () => {
    const leaf = buildNavigateLeaf("/unknown/path");
    expect(leaf.label).toBe("path"); // last segment
    expect(leaf.pattern).toBeUndefined();
  });
});

describe("isStackPrefixOf", () => {
  it("returns true when stack top is ancestor of target", () => {
    const stack: BreadcrumbStackItem[] = [
      { id: "1", label: "Workspaces", pattern: "/workspace", href: "/workspace" },
      { id: "2", label: "my-proj", pattern: "/workspace/:workspaceId", href: "/workspace/my-proj" },
      { id: "3", label: "Agents", pattern: "/workspace/:workspaceId/agent", href: "/workspace/my-proj/agent" },
    ];
    const match = { pattern: "/workspace/:workspaceId/agent/:agentId", params: {}, icon: {} as any, title: "", entry: {} as any };
    expect(isStackPrefixOf(stack, match)).toBe(true);
  });

  it("returns false when stack top is unrelated", () => {
    const stack: BreadcrumbStackItem[] = [
      { id: "1", label: "Settings", pattern: "/settings", href: "/settings" },
    ];
    const match = { pattern: "/workspace/:workspaceId/agent/:agentId", params: {}, icon: {} as any, title: "", entry: {} as any };
    expect(isStackPrefixOf(stack, match)).toBe(false);
  });

  it("returns false for empty stack", () => {
    expect(isStackPrefixOf([], { pattern: "/documents", params: {}, icon: {} as any, title: "", entry: {} as any })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/desktop && pnpm test -- navigate.test`
Expected: FAIL

- [ ] **Step 3: Implement navigate module**

```typescript
// apps/desktop/src/navigation/navigate.ts
import { registry } from "./route-registry";
import { buildColdStartBreadcrumb, deriveAncestorsFromPrefix, buildBreadcrumbItem, type NavigateHeaders, type BreadcrumbStackItem } from "./breadcrumb-builder";
import type { RouteMatch } from "./route-compiler";

export type NavigateMethod = "push" | "replace" | "reset";

/**
 * Build the leaf BreadcrumbStackItem for a given URL.
 * Used by the navigate function and can be used standalone.
 */
export function buildNavigateLeaf(url: string, headers?: NavigateHeaders): BreadcrumbStackItem {
  const match = registry.match(url);
  const fallbackLabel = url.split("/").filter(Boolean).pop() ?? url;

  return {
    id: headers?.id ?? url,
    label: headers?.label ?? match?.title ?? fallbackLabel,
    icon: headers?.icon ?? match?.icon,
    pattern: match?.pattern,
    href: url,
    sourceNodeId: headers?.sourceNodeId,
    parentNodeId: headers?.parentNodeId,
    meta: headers?.meta,
  };
}

/**
 * Unified navigate function — the primary API for all navigation.
 *
 * Called from use-desktop-routing hooks. Dispatches to the appropriate
 * tab store action based on method.
 *
 * @param method - "push" appends leaf to stack, "replace" replaces top, "reset" rebuilds from cold-start
 * @param url - The target URL (built via registry.build)
 * @param headers - Optional overrides for the breadcrumb leaf (label, icon, meta, etc.)
 * @param tabStore - Tab store actions (injected by hook to avoid module-level coupling)
 */
export function navigate(
  method: NavigateMethod,
  url: string,
  headers: NavigateHeaders | undefined,
  tabStore: {
    activeTabId: string;
    pushNavigation: (tabId: string, url: string, leaf: BreadcrumbStackItem) => void;
    replaceNavigation: (tabId: string, url: string, leaf: BreadcrumbStackItem) => void;
    resetNavigation: (tabId: string, url: string, stack: BreadcrumbStackItem[]) => void;
  },
): void {
  const { activeTabId } = tabStore;
  const leaf = buildNavigateLeaf(url, headers);

  switch (method) {
    case "push":
      tabStore.pushNavigation(activeTabId, url, leaf);
      break;
    case "replace":
      tabStore.replaceNavigation(activeTabId, url, leaf);
      break;
    case "reset": {
      const stack = buildColdStartBreadcrumb(url, headers);
      tabStore.resetNavigation(activeTabId, url, stack);
      break;
    }
  }
}

/**
 * Breadcrumb click handler — pops to the Nth breadcrumb item.
 * Deduplicates: if a matching entry already exists in backward history, jumps there.
 * Otherwise inserts before current position.
 */
export function popToBreadcrumb(
  index: number,
  tabStore: {
    activeTabId: string;
    getCurrentState: (tabId: string) => { breadcrumbStack: BreadcrumbStackItem[]; url: string } | null;
    findHistoryEntryByUrl: (tabId: string, url: string) => number;
    jumpToHistory: (tabId: string, historyIndex: number) => void;
    insertHistoryBeforeCurrent: (tabId: string, state: { url: string; breadcrumbStack: BreadcrumbStackItem[] }) => void;
  },
): void {
  const { activeTabId } = tabStore;
  const current = tabStore.getCurrentState(activeTabId);
  if (!current) return;

  const targetItem = current.breadcrumbStack[index];
  if (!targetItem?.href) return;

  // Dedup: check if backward history already has this URL
  const existingIndex = tabStore.findHistoryEntryByUrl(activeTabId, targetItem.href);
  if (existingIndex >= 0) {
    tabStore.jumpToHistory(activeTabId, existingIndex);
    return;
  }

  // No match → insert new state before current (preserves forward history)
  tabStore.insertHistoryBeforeCurrent(activeTabId, {
    url: targetItem.href,
    breadcrumbStack: current.breadcrumbStack.slice(0, index + 1),
  });
}

/**
 * Check whether the current breadcrumb stack is a valid prefix of the target match.
 * Used by Tab-Router Bridge for smart push vs cold-start reset decision.
 */
export function isStackPrefixOf(stack: BreadcrumbStackItem[], match: RouteMatch): boolean {
  if (stack.length === 0) return false;
  const topPattern = stack[stack.length - 1]?.pattern;
  if (!topPattern) return false;
  const ancestors = deriveAncestorsFromPrefix(match.pattern);
  return ancestors.includes(topPattern);
}

// Re-exports for convenience
export { buildColdStartBreadcrumb, buildBreadcrumbItem, deriveAncestorsFromPrefix, type NavigateHeaders, type BreadcrumbStackItem } from "./breadcrumb-builder";
export { registry } from "./route-registry";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/desktop && pnpm test -- navigate.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/navigation/navigate.ts apps/desktop/src/navigation/navigate.test.ts
git commit -m "feat(navigation): add navigate API with popToBreadcrumb and isStackPrefixOf"
```

---

## Task 5: Tab Store + Tab Navigation — New TabNavigationState Format + Migration

**Files:**
- Modify: `apps/desktop/src/stores/tab-store.ts`
- Modify: `apps/desktop/src/stores/tab-store.test.ts`
- Rewrite: `apps/desktop/src/navigation/tab-navigation.ts`

This is the most critical integration point. The tab store must support the new URL-based `TabNavigationState` while migrating persisted data from the old format. `tab-navigation.ts` is rewritten simultaneously to avoid a broken intermediate state.

- [ ] **Step 1: Define new TabNavigationState and BreadcrumbStackItem types**

Create types in `tab-store.ts` (or re-export from `breadcrumb-builder.ts`). The new `TabNavigationState`:

```typescript
import type { BreadcrumbStackItem } from "@/navigation/breadcrumb-builder";

export interface TabNavigationState {
  url: string;
  breadcrumbStack: BreadcrumbStackItem[];
  activeNodeId?: string;
  activeIndexPath?: string[];
}
```

Replace the old import of `TabNavigationState` from `navigation-meta.ts` with this new definition. **Also remove `DesktopLocation` and `BreadcrumbStackItem` imports from `navigation-meta.ts`** — use the new `BreadcrumbStackItem` from `breadcrumb-builder.ts` directly.

- [ ] **Step 2: Rewrite `tab-navigation.ts`**

Replace the entire file with URL-based helpers:

```typescript
// apps/desktop/src/navigation/tab-navigation.ts
import type { BreadcrumbStackItem } from "./breadcrumb-builder";
import type { TabNavigationState } from "@/stores/tab-store";

/**
 * Create a new TabNavigationState from a URL and breadcrumb stack.
 */
export function createTabNavigationState(
  url: string,
  breadcrumbStack: BreadcrumbStackItem[],
  patch?: Partial<TabNavigationState>,
): TabNavigationState {
  return { url, breadcrumbStack, ...patch };
}
```

- [ ] **Step 3: Add persist migration**

Add the full migration suite from the spec (§10.4): `migratePersistedState`, `migrateTab`, `migrateNavigationState`, `migrateBreadcrumbItem`, and the updated `isNavigationState` guard.

**Full migration, no backward compatibility**: Use `legacyLocationToUrl` (thin wrapper around old `locationToUrl` from `navigation-meta.ts`) to convert old `DesktopLocation` objects to URLs. If a location kind is unrecognized or produces an invalid URL (not matchable by registry), map to `/workspace` and discard that history entry. Old `BreadcrumbStackItem` entries with `target`/`descriptorId` are migrated to the new format (extract `href` from `target.canonicalUrl`, discard `descriptorId`/`target`). Any entries that can't be migrated are dropped.

**No route alias compatibility**: `/workspace/:workspaceId/apps`, `/workspace/:workspaceId/agents`, `/workspace/:workspaceId/page/*` in stored data will fail `registry.match()` → treated as invalid → dropped or mapped to `/workspace`.

- [ ] **Step 4: Update tab store actions to use URL-based state**

Key changes:
- `pushNavigation(tabId, url, leaf)` — creates new `TabNavigationState { url, breadcrumbStack: [...current.breadcrumbStack, leaf] }`, truncates forward history, appends entry
- `replaceNavigation(tabId, url, leaf)` — creates `TabNavigationState { url, breadcrumbStack: [...current.breadcrumbStack.slice(0,-1), leaf] }`, truncates forward, appends entry
- `resetNavigation(tabId, url, stack)` — creates `TabNavigationState { url, breadcrumbStack: stack }`, truncates forward, appends entry
- `getCurrentUrl(tabId)` — returns `currentState.url`
- `findHistoryEntryByUrl(tabId, url)` — scans backward history for matching URL, returns index or -1
- `insertHistoryBeforeCurrent(tabId, state)` — inserts a state before current position (for `popToBreadcrumb`)

Also update `TabViewModel` to replace `currentLocation: DesktopLocation | null` with `currentUrl: string | null`:

```typescript
interface TabViewModel {
  // ...existing fields...
  currentUrl: string | null;  // was: currentLocation: DesktopLocation | null
}
```

- [ ] **Step 5: Update tab-store.test.ts**

Update all test helpers to use the new format (`url` instead of `location`). Update the `state()` factory:

```typescript
function state(url: string, stack: BreadcrumbStackItem[] = []): TabNavigationState {
  return { url, breadcrumbStack: stack };
}
```

- [ ] **Step 6: Run tests**

Run: `cd apps/desktop && pnpm test -- tab-store`
Expected: PASS (after updating test fixtures)

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/stores/tab-store.ts apps/desktop/src/stores/tab-store.test.ts apps/desktop/src/navigation/tab-navigation.ts
git commit -m "feat(navigation): migrate tab store and tab-navigation to URL-based state"
```

---

## Task 6: Tab-Router Bridge — Rewrite with Sync Lock + Smart Push

**Files:**
- Modify: `apps/desktop/src/components/navigation/tab-router-bridge.tsx`

- [ ] **Step 1: Rewrite bridge**

Replace the current bridge with the new implementation from spec §10.2:
- Sync lock via `useRef<boolean>`
- Store→Router: `useEffect` that syncs `activeState.url` to `routerNavigate`
- Router→Store: detect URL change, use `isStackPrefixOf` (from `@/navigation/navigate`) for smart push, fallback to cold-start reset
- Use `registry.normalizeUrl(currentUrl)` for canonical URL comparison
- **When `registry.match` returns null**: do NOT update tab store (preserve current state). This prevents unregistered URLs from corrupting tab state.

Key implementation:

```typescript
import { registry, buildColdStartBreadcrumb, buildBreadcrumbItem, isStackPrefixOf } from "@/navigation/navigate";
import { useTabStore } from "@/stores/tab-store";
import { useLocation, useNavigate as useRouterNavigate } from "react-router-dom";

// syncRouterToStore logic:
const match = registry.match(normalizedUrl);
if (!match) {
  // Unknown URL — don't update tab store, let React Router handle it
  syncLockRef.current = false;
  return;
}
if (isStackPrefixOf(currentState.breadcrumbStack, match)) {
  // Smart push: existing stack is valid ancestor chain
  const leaf = buildBreadcrumbItem(match.entry, match.params);
  tabStore.pushNavigation(tabId, normalizedUrl, leaf);
} else {
  // Cold-start reset: deep link or direct URL entry
  const stack = buildColdStartBreadcrumb(normalizedUrl);
  tabStore.resetNavigation(tabId, normalizedUrl, stack);
}
```

- [ ] **Step 2: Verify app compiles**

Run: `cd apps/desktop && pnpm exec tsc --noEmit --pretty 2>&1 | head -50`
Expected: No new type errors

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/navigation/tab-router-bridge.tsx
git commit -m "feat(navigation): rewrite tab-router bridge with sync-lock and smart push"
```

---

## Task 7: use-desktop-routing — Migrate to Navigate API

**Files:**
- Modify: `apps/desktop/src/hooks/use-desktop-routing.ts`

- [ ] **Step 1: Replace internal navigation primitives**

Two navigation patterns exist (per spec §5 and §11):

**Pattern A — Simple navigate (sidebar clicks, section switches):**
```typescript
navigate("reset", registry.build("/workspace/:workspaceId/chat", { workspaceId }), undefined, tabStoreActions);
```

**Pattern B — Caller-built stack (drill-down navigation with runtime names):**
```typescript
// e.g., openWorkspaceAgentDetail builds full breadcrumb stack explicitly
const url = registry.build("/workspace/:workspaceId/agent/:agentId", { workspaceId, agentId });
const breadcrumbStack: BreadcrumbStackItem[] = [
  buildBreadcrumbItem(registry.getEntry("/workspace/:workspaceId")!, { workspaceId }),
  buildBreadcrumbItem(registry.getEntry("/workspace/:workspaceId/agent")!, { workspaceId }),
  { id: url, label: agentDisplayName, icon: agentIcon, pattern: "/workspace/:workspaceId/agent/:agentId", href: url },
];
tabStore.resetNavigation(activeTabId, url, breadcrumbStack);
```

Use Pattern A for sidebar/section switches. Use Pattern B when caller has runtime display names (agent name, page title, etc.) that are better than registry defaults.

- [ ] **Step 2: Preserve public API surface (function names)**

Keep all existing function names (`openWorkspaceAgentDetail`, `openSettings`, etc.) as they are called throughout the app. Only change their internal implementation.

**Change `DesktopRoutingApi` interface**: Replace `DesktopLocation`-based params with URL/string-based params. For example:
- `openRoute(route: DesktopLocation)` → `openRoute(url: string, headers?: NavigateHeaders)`
- `currentRoute: DesktopLocation | null` → `currentUrl: string | null`

Since all callers currently call specific named functions (e.g., `openWorkspaceAgentDetail(wsId, agentId)`) rather than the generic `openRoute`, this interface change has minimal external impact.

- [ ] **Step 3: Remove DesktopLocation imports**

Replace all `{ kind: "..." }` object construction with `registry.build(pattern, params)`.

- [ ] **Step 4: Verify app compiles**

Run: `cd apps/desktop && pnpm exec tsc --noEmit --pretty 2>&1 | grep -c "error TS"`
Expected: 0 (or same count as before this task)

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/hooks/use-desktop-routing.ts
git commit -m "refactor(navigation): migrate use-desktop-routing to navigate API"
```

---

## Task 8: App.tsx — Route Generation from Registry

**Files:**
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/pages/apps/workspace-page.tsx` (empty-splat guard)

**Important: React Router v7 compatibility**

The project uses `react-router-dom@^7.13.0`. React Router v7 supports the `BrowserRouter`/`Routes`/`Route` JSX API in backward-compat mode. Splat routes use `*` and the matched value is accessed via `useParams()["*"]` (NOT `params.pageSlug`). The registry's `:pageSlug+` param name is only meaningful within the route-compiler — page components must read `params["*"]` from React Router.

- [ ] **Step 1: Add route generation helper**

```typescript
function toReactRouterPath(pattern: string): string {
  return pattern
    .replace(/:(\w+)\+/g, "*")  // :param+ → * (React Router splat)
    .replace(/^\//, "");         // strip leading / for relative routes
}
```

- [ ] **Step 2: Replace hardcoded routes with generated ones**

Keep the component mapping as a `Record<string, ComponentType>` and generate `<Route>` elements from `ROUTE_ENTRIES`. Keep existing routes for:
- `/tray-popup` and `/onboarding` (outside AppLayout, not in registry)
- Mobile routes `/m/*` (conditional, not in registry)
- Nested settings routes (rendered as `<Route path="settings" element={...}><Route path=":section" element={null} />`)

- [ ] **Step 3: Remove legacy route paths and update fallback**

Remove old routes from App.tsx:
- Delete `workspace/:workspaceId/apps` route (migrated to `pages` — no redirect needed, persist migration handles stored URLs)
- Delete `workspace/page` route (migrated to `workspace/:workspaceId/pages/:pageSlug+`)
- Update the catch-all `<Route path="*">` fallback to redirect to `/workspace` (was `/documents`)
- Update `home-redirect.tsx` fallback to `/workspace` (currently `/workspace/global`)

The persist migration in Task 5 converts any stored `/workspace/:workspaceId/apps` URLs to `/workspace/:workspaceId/pages` and `/workspace/:workspaceId/page/*` to `/workspace/:workspaceId/pages/*`. New tabs also default to `/workspace`.

- [ ] **Step 4: Add empty-splat guard to WorkspacePage**

```typescript
// apps/desktop/src/pages/apps/workspace-page.tsx
const { "*": pageSlug } = useParams();
if (!pageSlug) {
  // React Router matched empty splat → redirect to pages list
  return <Navigate to=".." replace />;
}
// Use pageSlug from here (this is the equivalent of registry's :pageSlug+)
```

- [ ] **Step 5: Verify app compiles and routes work**

Run: `cd apps/desktop && pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/App.tsx apps/desktop/src/pages/apps/workspace-page.tsx
git commit -m "refactor(navigation): generate routes from registry, add path redirects and splat guard"
```

---

## Task 9: Page Component Migration — Replace `resolveLocationNavigation` Usage

**Files:**
- Modify: `apps/desktop/src/pages/agents/agent-detail.tsx`
- Modify: `apps/desktop/src/pages/agents/executor-detail.tsx`
- Modify: `apps/desktop/src/pages/skill-detail.tsx`
- Modify: `apps/desktop/src/pages/mcp-server-detail.tsx`
- Modify: `apps/desktop/src/pages/prompt-detail.tsx`
- Modify: `apps/desktop/src/pages/command-detail.tsx`
- Modify: `apps/desktop/src/pages/workspace-web.tsx`
- Modify: `apps/desktop/src/pages/apps/workspace-page.tsx`
- Modify: `apps/desktop/src/pages/apps/workspace-apps-page.tsx`
- Modify: `apps/desktop/src/hooks/use-global-shortcuts.ts`
- Modify: `apps/desktop/src/components/global-tab-bar/index.tsx`

These files all import from `location-navigation.ts` (which will be deleted in the next task). They must be migrated first.

- [ ] **Step 1: Migrate page detail components**

All 9 page components use `resolveLocationNavigation` to build breadcrumb stacks when navigating to sub-pages. Replace with the new navigate API:

```typescript
// Before (in each detail page):
import { resolveLocationNavigation } from "@/navigation/location-navigation";
const resolved = resolveLocationNavigation(location, workspaceId);
tabStore.navigateToLocation(tabId, location, { breadcrumbStack: resolved.breadcrumbStack });

// After:
import { navigate, registry, buildBreadcrumbItem } from "@/navigation/navigate";
// Use navigate("push", url, headers, tabStoreActions) or
// build explicit breadcrumb stack and call tabStore.resetNavigation
```

For each page, the pattern is:
- The page receives a click event (e.g., user clicks a skill inside an executor detail page)
- Previously it built a `DesktopLocation` object and called `resolveLocationNavigation`
- Now it builds a URL via `registry.build(pattern, params)` and calls `navigate("push", url, headers, tabStoreActions)`

- [ ] **Step 2: Migrate `use-global-shortcuts.ts`**

Replace `createStackForLocation` usage with `buildColdStartBreadcrumb`:

```typescript
// Before:
import { createStackForLocation } from "@/navigation/location-navigation";
import { createTabNavigationState } from "@/navigation/tab-navigation";
const location = { kind: "documents" } as const;
openTab({ navigationState: createTabNavigationState(location, createStackForLocation(location)) });

// After:
import { buildColdStartBreadcrumb } from "@/navigation/navigate";
import { createTabNavigationState } from "@/navigation/tab-navigation";
const url = "/workspace";
openTab({ navigationState: createTabNavigationState(url, buildColdStartBreadcrumb(url)) });
```

- [ ] **Step 3: Migrate `global-tab-bar/index.tsx`**

Same pattern as Step 2 — replace `createStackForLocation` with `buildColdStartBreadcrumb`. **New tab defaults to `/workspace`:**

```typescript
// Before:
import { createStackForLocation } from "@/navigation/location-navigation";
const location = { kind: "documents" } as const;
openTab({ navigationState: createTabNavigationState(location, createStackForLocation(location)) });

// After:
import { buildColdStartBreadcrumb } from "@/navigation/navigate";
const url = "/workspace";
openTab({ navigationState: createTabNavigationState(url, buildColdStartBreadcrumb(url)) });
```

- [ ] **Step 4: Verify no imports of `location-navigation` remain**

Run: `grep -r "location-navigation" apps/desktop/src/ --include="*.ts" --include="*.tsx"`
Expected: Only `navigation/index.ts` (barrel, to be updated next task)

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/pages/ apps/desktop/src/hooks/use-global-shortcuts.ts apps/desktop/src/components/global-tab-bar/index.tsx
git commit -m "refactor(navigation): migrate all pages from resolveLocationNavigation to navigate API"
```

---

## Task 10: Barrel Exports + Cleanup

**Files:**
- Modify: `apps/desktop/src/navigation/index.ts`
- Delete: `apps/desktop/src/navigation/location-navigation.ts`
- Modify: `apps/desktop/src/navigation/navigation-meta.ts` (mark exports as `@deprecated`, keep `locationToUrl` for migration)

- [ ] **Step 1: Rewrite barrel exports**

```typescript
// apps/desktop/src/navigation/index.ts

// ─── Route Registry (single source of truth) ─────────────────────────────────
export { registry, ROUTE_ENTRIES, humanize } from "./route-registry";
export type { RouteEntry, RouteMatch } from "./route-compiler";

// ─── Navigate API ─────────────────────────────────────────────────────────────
export { navigate, buildNavigateLeaf, buildColdStartBreadcrumb, popToBreadcrumb, isStackPrefixOf } from "./navigate";
export type { NavigateMethod } from "./navigate";
export type { NavigateHeaders, BreadcrumbStackItem, BreadcrumbMeta } from "./breadcrumb-builder";
export { deriveAncestorsFromPrefix, pickMatchingParams, buildBreadcrumbItem } from "./breadcrumb-builder";

// ─── Tab Navigation ──────────────────────────────────────────────────────────
export { createTabNavigationState } from "./tab-navigation";
export type { TabNavigationState } from "@/stores/tab-store";

// ─── Legacy (migration only, do not use in new code) ─────────────────────────
export { locationToUrl as legacyLocationToUrl } from "./navigation-meta";

// ─── Unchanged modules ────────────────────────────────────────────────────────
export type { DesktopDeepLinkIntent } from "./deep-link";
export { parseVibenDeepLink } from "./deep-link";
export type { ExtractedNavItemKind, ExtractedNavigationItem, PageNavigationExtract } from "./page-navigation-extractor";
export { extractPageNavigation, collectPageNavigationFromDom } from "./page-navigation-extractor";
```

- [ ] **Step 2: Delete location-navigation.ts**

Verify no imports remain:
```bash
grep -r "location-navigation" apps/desktop/src/ --include="*.ts" --include="*.tsx"
```

If clean, delete the file.

- [ ] **Step 3: Mark deprecated exports in navigation-meta.ts**

Add `/** @deprecated Use registry.match() instead */` comments to exported functions that are kept only for migration.

- [ ] **Step 4: Verify full app compiles**

Run: `cd apps/desktop && pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A apps/desktop/src/navigation/
git commit -m "refactor(navigation): clean up barrel exports, delete location-navigation.ts"
```

---

## Task 11: Integration Verification + Dropdown Dispatch Update

**Files:**
- Modify: `apps/desktop/src/navigation/page-index.ts` (dropdown dispatch)
- Modify: `apps/desktop/src/hooks/use-page-tabs.ts` (adapt `useActiveTabState`)
- Modify: `apps/desktop/src/navigation/route-compiler.ts` (add compile-time conflict detection)

- [ ] **Step 1: Add compile-time conflict detection to `compileRegistry`**

Per spec §7.1, add cross-testing after compiling all entries:

```typescript
// In route-compiler.ts, after sorting in compileRegistry():
// Cross-test: for each pair, verify no ambiguous matches
if (process.env.NODE_ENV !== "production") {
  for (let i = 0; i < compiled.length; i++) {
    for (let j = i + 1; j < compiled.length; j++) {
      const a = compiled[i];
      const b = compiled[j];
      // Generate a sample URL from pattern A, verify only A matches
      const sampleA = a.build(generateSampleParams(a));
      if (b.regex.test(sampleA)) {
        console.warn(
          `[route-registry] Potential conflict: "${a.pattern}" sample URL "${sampleA}" also matches "${b.pattern}"`
        );
      }
    }
  }
}
```

This is a dev-time warning (not a hard error) to avoid breaking production if patterns legitimately overlap (like `/workspace/:workspaceId/agents` alias).

- [ ] **Step 2: Update page-index dropdown dispatch**

Replace `descriptorId` prefix matching with `dropdownCategory` matching via `registry.match(segment.href)`.

- [ ] **Step 3: Update use-page-tabs to derive tab metadata from URL**

Replace `currentLocation` duck typing with:
```typescript
const match = registry.match(tab.url);
const workspaceId = match?.params.workspaceId;
```

Update all `TabViewModel` consumers to use `currentUrl` instead of `currentLocation`.

- [ ] **Step 4: Run full test suite**

Run: `cd apps/desktop && pnpm test`
Expected: PASS

- [ ] **Step 5: Run type check**

Run: `cd apps/desktop && pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/navigation/page-index.ts apps/desktop/src/hooks/use-page-tabs.ts apps/desktop/src/navigation/route-compiler.ts
git commit -m "refactor(navigation): update dropdown dispatch, tab metadata, add conflict detection"
```

---

## Summary

| Task | Component | Est. Complexity |
|------|-----------|----------------|
| 1 | Route Compiler (core engine) | Medium |
| 2 | Route Registry (definitions) | Low |
| 3 | Breadcrumb Builder (cold start) | Medium |
| 4 | Navigate API + popToBreadcrumb + isStackPrefixOf | Medium |
| 5 | Tab Store + Tab Navigation Migration | High |
| 6 | Tab-Router Bridge | Medium |
| 7 | use-desktop-routing | High |
| 8 | App.tsx Route Generation | Medium |
| 9 | Page Component Migration (batch) | Medium |
| 10 | Barrel Exports + Cleanup | Low |
| 11 | Integration + Dropdown + Conflict Detection | Medium |

**Total: 11 tasks**, ordered by dependency chain. Tasks 1–4 can be developed independently (pure functions with tests). Task 5 is the critical type-breaking change (includes `tab-navigation.ts` rewrite). Tasks 6–9 form the integration chain. Tasks 10–11 are cleanup and verification.
