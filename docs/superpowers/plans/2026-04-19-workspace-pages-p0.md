# Workspace Pages P0 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Workspace Pages 核心功能，包括 SKILL.md 解析、Static/Markdown 类型页面服务、CLI 基础命令、Gateway 路由，以及全局 Tab 管理系统。

**Architecture:** 采用 Gateway 集中管理架构，在 `packages/core/src/page/ops/` 下实现核心操作，通过 Gateway 路由暴露 API，CLI 命令调用 ops 层函数。Desktop 端使用 Zustand 管理 Tab 状态，自定义窗口标题栏实现 Tab 系统。

**Tech Stack:** TypeScript, Fastify (Gateway), gray-matter (YAML frontmatter 解析), Commander (CLI), Zustand (Tab 状态管理), Tauri (窗口控制)

---

## 文件结构

### 新建文件

| 文件路径 | 职责 |
|---------|------|
| `packages/core/src/page/index.ts` | 入口，re-export 所有 ops |
| `packages/core/src/page/ops/index.ts` | ops 统一导出 |
| `packages/core/src/page/ops/types.ts` | 类型定义 |
| `packages/core/src/page/ops/discovery.ts` | 扫描 pages/ 目录，解析 SKILL.md |
| `packages/core/src/page/ops/crud.ts` | list, create, view, delete 操作 |
| `packages/core/src/page/ops/serve.ts` | Static 类型文件服务 |
| `packages/core/src/page/ops/templates.ts` | 模板加载逻辑 |
| `packages/core/src/gateway/routes/page.ts` | Gateway API 路由 |
| `packages/core/src/cli/commands/page.ts` | CLI 命令 |
| `packages/core/templates/pages/static-html/template.json` | 内置静态 HTML 模板元数据 |
| `packages/core/templates/pages/static-html/SKILL.md.hbs` | 内置静态 HTML 模板 |
| `packages/core/templates/pages/static-html/index.html.hbs` | 内置静态 HTML 模板 |
| `packages/core/templates/pages/markdown-docs/template.json` | 内置 Markdown 模板元数据 |
| `packages/core/templates/pages/markdown-docs/SKILL.md.hbs` | 内置 Markdown 模板 |
| `apps/desktop/src/lib/gateway/modules/pages.ts` | Gateway API 客户端 |
| `apps/desktop/src/hooks/use-pages.ts` | 页面数据 hooks |
| `apps/desktop/src/hooks/use-page-tabs.ts` | Tab 管理 hooks |
| `apps/desktop/src/stores/tab-store.ts` | Tab 状态管理 (Zustand) |
| `apps/desktop/src/components/page/page-section.tsx` | 侧边栏 Pages Section |
| `apps/desktop/src/components/global-tab-bar/index.tsx` | 全局 Tab 栏组件 |
| `apps/desktop/src/components/global-tab-bar/tab-item.tsx` | 单个 Tab 项组件 |
| `apps/desktop/src/components/global-tab-bar/window-controls.tsx` | 窗口控制按钮 |
| `apps/desktop/src/pages/workspace-page.tsx` | 页面详情路由页面 |

### 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `packages/core/src/gateway/index.ts` | 注册 page 路由 |
| `packages/core/src/cli/index.ts` | 注册 page 命令 |
| `apps/desktop/src/components/layout/sidebar.tsx` | 添加 Pages Section |
| `apps/desktop/src/components/layout/main-layout.tsx` | 集成全局 Tab 栏 |
| `apps/desktop/src/App.tsx` | 添加页面路由 |
| `src-tauri/src/main.rs` | 设置无边框窗口 |
| `src-tauri/tauri.conf.json` | 窗口装饰器配置 |

---

## Task 1: 类型定义

**Files:**
- Create: `packages/core/src/page/ops/types.ts`

- [ ] **Step 1: 创建类型定义文件**

```typescript
// packages/core/src/page/ops/types.ts

/**
 * Page module type definitions
 *
 * 复用关系：
 * - ServerStatus 与 apps/desktop/src/components/artifacts/types.ts 中的 LivePreviewStatus 语义一致
 * - markdown 类型页面复用 MarkdownPreview 组件
 * - server 类型页面复用 VitePreview 组件
 */

// =============================================================================
// Core Types (使用 const 枚举确保类型安全)
// =============================================================================

/** 页面类型枚举 */
export const PAGE_TYPES = ["static", "markdown", "server", "proxy"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

/** 页面权限枚举 */
export const PAGE_PERMISSIONS = ["read", "write"] as const;
export type PagePermission = (typeof PAGE_PERMISSIONS)[number];

/** 页面视图模式 */
export const PAGE_VIEW_MODES = ["skill", "page"] as const;
export type PageViewMode = (typeof PAGE_VIEW_MODES)[number];

/** 服务器运行状态（与 LivePreviewStatus 语义一致） */
export const SERVER_STATUSES = ["idle", "starting", "running", "error", "stopped"] as const;
export type ServerStatus = (typeof SERVER_STATUSES)[number];

// =============================================================================
// Type Guards (用于运行时类型检查)
// =============================================================================

export function isPageType(value: unknown): value is PageType {
  return typeof value === "string" && PAGE_TYPES.includes(value as PageType);
}

export function isPagePermission(value: unknown): value is PagePermission {
  return typeof value === "string" && PAGE_PERMISSIONS.includes(value as PagePermission);
}

export function isServerStatus(value: unknown): value is ServerStatus {
  return typeof value === "string" && SERVER_STATUSES.includes(value as ServerStatus);
}

export function isPageViewMode(value: unknown): value is PageViewMode {
  return typeof value === "string" && PAGE_VIEW_MODES.includes(value as PageViewMode);
}

// =============================================================================
// Page Config Types (Union)
// =============================================================================

// Note: PageConfigBase is internal, used only for type inheritance
interface PageConfigBase {
  slug: string;
  name: string;
  description?: string;
  icon?: string;                   // 页面图标（用于 Tab 显示）
  permission: PagePermission[];
  path: string;
  skill_content?: string;
}

export interface StaticPageConfig extends PageConfigBase {
  type: "static";
  file: string;
}

// Markdown 类型 - 直接渲染 SKILL.md 内容
export interface MarkdownPageConfig extends PageConfigBase {
  type: "markdown";
  // 无需额外字段，直接使用 skill_content
}

export interface ServerPageConfig extends PageConfigBase {
  type: "server";
  command: string;
  port?: number;
  ready_pattern?: string;
  timeout?: number;
}

export interface ProxyPageConfig extends PageConfigBase {
  type: "proxy";
  url: string;
  headers?: Record<string, string>;
}

export type PageConfig = StaticPageConfig | MarkdownPageConfig | ServerPageConfig | ProxyPageConfig;

// =============================================================================
// Page Config Type Guards
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
// Running Server (用于 server 类型页面)
// =============================================================================

export interface RunningServer {
  slug: string;
  pid: number;
  port: number;
  status: ServerStatus;            // 使用 ServerStatus 类型
  started_at: string;
  last_access: string;
  last_health_check?: string;
  restart_count: number;
}

// =============================================================================
// Result Types
// =============================================================================

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
  slug?: string;
  deleted_path?: string;           // 被删除的完整路径
}

export interface ServePageResult extends PageResult {
  content?: Buffer;
  content_type?: string;
}

export interface ServerStatusResult extends PageResult {
  servers: RunningServer[];
}

// =============================================================================
// Template Types
// =============================================================================

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  type: PageType;
  default_config: Partial<PageConfig>;
  install_command?: string;
  source: "builtin" | "custom";  // 模板来源：内置或用户自定义
}

export interface TemplateVars {
  name: string;
  slug: string;
  description: string;
}

/** 模板文件定义 */
export interface TemplateFile {
  path: string;                    // 相对路径
  content: string;                 // 文件内容
}

export interface ListTemplatesResult extends PageResult {
  templates: PageTemplate[];
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd packages/core && pnpm tsc --noEmit src/page/ops/types.ts`
Expected: 无错误输出

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/page/ops/types.ts
git commit -m "feat(page): add page type definitions"
```

---

## Task 2: ops 入口文件

**Files:**
- Create: `packages/core/src/page/ops/index.ts`
- Create: `packages/core/src/page/index.ts`

- [ ] **Step 1: 创建 ops/index.ts**

```typescript
// packages/core/src/page/ops/index.ts

/**
 * Page operations module
 *
 * Re-exports all page-related operations.
 */

// Const enums (用于运行时遍历)
export {
  PAGE_TYPES,
  PAGE_PERMISSIONS,
  PAGE_VIEW_MODES,
  SERVER_STATUSES,
} from "./types";

// Types (Note: PageConfigBase is internal, not exported)
export type {
  PageType,
  PagePermission,
  PageViewMode,
  ServerStatus,
  StaticPageConfig,
  MarkdownPageConfig,
  ServerPageConfig,
  ProxyPageConfig,
  PageConfig,
  RunningServer,
  PageResult,
  ListPagesResult,
  ViewPageResult,
  CreatePageResult,
  DeletePageResult,
  ServePageResult,
  ServerStatusResult,
  PageTemplate,
  TemplateFile,
  TemplateVars,
  ListTemplatesResult,
} from "./types";

// Type guards for enum values
export {
  isPageType,
  isPagePermission,
  isPageViewMode,
  isServerStatus,
} from "./types";

// Type guards for config types
export { isStaticPage, isMarkdownPage, isServerPage, isProxyPage } from "./types";
```

- [ ] **Step 2: 创建 page/index.ts**

```typescript
// packages/core/src/page/index.ts

/**
 * Page module entry point
 */

export * from "./ops";
```

- [ ] **Step 3: 验证编译**

Run: `cd packages/core && pnpm tsc --noEmit src/page/index.ts`
Expected: 无错误输出

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/page/
git commit -m "feat(page): add page module entry points"
```

---

## Task 3: SKILL.md 解析 (discovery)

**Files:**
- Create: `packages/core/src/page/ops/discovery.ts`

- [ ] **Step 1: 创建 discovery.ts**

```typescript
// packages/core/src/page/ops/discovery.ts

/**
 * Page discovery - scan pages/ directory and parse SKILL.md files
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import matter from "gray-matter";
import type { PageConfig, StaticPageConfig, MarkdownPageConfig, ServerPageConfig, ProxyPageConfig } from "./types";

const SKILL_FILE = "SKILL.md";
const PAGES_DIR = "pages";

/**
 * Parse a SKILL.md file and extract page config
 */
export function parseSkillMd(
  skillPath: string,
  workspacePath: string
): PageConfig | null {
  if (!existsSync(skillPath)) {
    return null;
  }

  const content = readFileSync(skillPath, "utf-8");
  const { data, content: markdownContent } = matter(content);

  // Validate required fields
  if (!data.page?.type || !data.name) {
    return null;
  }

  const pageDir = join(skillPath, "..");
  const relativePath = relative(join(workspacePath, PAGES_DIR), pageDir);
  const slug = relativePath.replace(/\\/g, "/"); // Normalize for Windows

  const base = {
    slug,
    name: data.name,
    description: data.description,
    icon: data.icon,                 // 页面图标（用于 Tab 显示）
    permission: data.page.permission ?? ["read", "write"],
    path: pageDir,
    skill_content: markdownContent.trim() || undefined,
  };

  switch (data.page.type) {
    case "static":
      return {
        ...base,
        type: "static",
        file: data.page.file ?? "index.html",
      } as StaticPageConfig;

    case "markdown":
      return {
        ...base,
        type: "markdown",
      } as MarkdownPageConfig;

    case "server":
      // command 是必填字段
      if (!data.page.command) {
        console.warn(`[parseSkillMd] server page "${slug}" missing required field: command`);
        return null;
      }
      return {
        ...base,
        type: "server",
        command: data.page.command,
        port: data.page.port,
        ready_pattern: data.page.ready_pattern,
        timeout: data.page.timeout ?? 300,
      } as ServerPageConfig;

    case "proxy":
      // url 是必填字段
      if (!data.page.url) {
        console.warn(`[parseSkillMd] proxy page "${slug}" missing required field: url`);
        return null;
      }
      return {
        ...base,
        type: "proxy",
        url: data.page.url,
        headers: data.page.headers,
      } as ProxyPageConfig;

    default:
      return null;
  }
}

/**
 * Recursively discover all pages in a directory
 */
export function discoverPages(
  dir: string,
  workspacePath: string
): PageConfig[] {
  const pages: PageConfig[] = [];

  if (!existsSync(dir)) {
    return pages;
  }

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const subDir = join(dir, entry.name);
    const skillPath = join(subDir, SKILL_FILE);

    // Check if this directory has a SKILL.md
    if (existsSync(skillPath)) {
      const page = parseSkillMd(skillPath, workspacePath);
      if (page) {
        pages.push(page);
      }
    }

    // Recursively scan subdirectories
    const subPages = discoverPages(subDir, workspacePath);
    pages.push(...subPages);
  }

  return pages;
}

/**
 * List all pages in a workspace
 */
export function listPagesInWorkspace(workspacePath: string): PageConfig[] {
  const pagesDir = join(workspacePath, PAGES_DIR);
  return discoverPages(pagesDir, workspacePath);
}

/**
 * Get a specific page by slug
 */
export function getPageBySlug(
  workspacePath: string,
  slug: string
): PageConfig | null {
  const pagesDir = join(workspacePath, PAGES_DIR);
  const pageDir = join(pagesDir, slug);
  const skillPath = join(pageDir, SKILL_FILE);

  return parseSkillMd(skillPath, workspacePath);
}
```

- [ ] **Step 2: 更新 ops/index.ts 导出**

```typescript
// 在 ops/index.ts 末尾添加

// Discovery
export {
  parseSkillMd,
  discoverPages,
  listPagesInWorkspace,
  getPageBySlug,
} from "./discovery";
```

- [ ] **Step 3: 验证编译**

Run: `cd packages/core && pnpm tsc --noEmit src/page/ops/discovery.ts`
Expected: 无错误输出

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/page/ops/
git commit -m "feat(page): add SKILL.md discovery and parsing"
```

---

## Task 4: CRUD 操作

**Files:**
- Create: `packages/core/src/page/ops/crud.ts`

- [ ] **Step 1: 创建 crud.ts**

```typescript
// packages/core/src/page/ops/crud.ts

/**
 * Page CRUD operations
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type {
  ListPagesResult,
  ViewPageResult,
  CreatePageResult,
  DeletePageResult,
  PageConfig,
} from "./types";
import { listPagesInWorkspace, getPageBySlug } from "./discovery";

const PAGES_DIR = "pages";
const SKILL_FILE = "SKILL.md";

// =============================================================================
// List Pages
// =============================================================================

export interface ListPagesOptions {
  workspace_path: string;
}

export async function listPages(
  options: ListPagesOptions
): Promise<ListPagesResult> {
  const { workspace_path } = options;

  if (!existsSync(workspace_path)) {
    return {
      success: false,
      error: `Workspace not found: ${workspace_path}`,
      pages: [],
      count: 0,
    };
  }

  const pages = listPagesInWorkspace(workspace_path);

  return {
    success: true,
    pages,
    count: pages.length,
  };
}

// =============================================================================
// View Page
// =============================================================================

export interface ViewPageOptions {
  workspace_path: string;
  slug: string;
}

export async function viewPage(
  options: ViewPageOptions
): Promise<ViewPageResult> {
  const { workspace_path, slug } = options;

  const page = getPageBySlug(workspace_path, slug);

  if (!page) {
    return {
      success: false,
      error: `Page not found: ${slug}`,
    };
  }

  return {
    success: true,
    page,
  };
}

// =============================================================================
// Create Page
// =============================================================================

export interface CreatePageOptions {
  workspace_path: string;
  slug: string;
  name: string;
  description?: string;
  type: "static" | "markdown" | "server" | "proxy";
  // Static-specific
  file?: string;
  // Server-specific
  command?: string;
  port?: number;
  ready_pattern?: string;
  timeout?: number;
  // Proxy-specific
  url?: string;
  headers?: Record<string, string>;
}

export async function createPage(
  options: CreatePageOptions
): Promise<CreatePageResult> {
  const { workspace_path, slug, name, description, type } = options;

  const pagesDir = join(workspace_path, PAGES_DIR);
  const pageDir = join(pagesDir, slug);
  const skillPath = join(pageDir, SKILL_FILE);

  // Check if page already exists
  if (existsSync(skillPath)) {
    return {
      success: false,
      error: `Page already exists: ${slug}`,
    };
  }

  // Create directory
  mkdirSync(pageDir, { recursive: true });

  // Build SKILL.md content
  let skillContent = "---\n";
  skillContent += "page:\n";
  skillContent += `  type: ${type}\n`;

  if (type === "static") {
    const file = options.file ?? "index.html";
    skillContent += `  file: ${file}\n`;
    skillContent += "  permission: [read, write]\n";
  } else if (type === "markdown") {
    // Markdown type: no file field needed
    skillContent += "  permission: [read, write]\n";
  } else if (type === "server") {
    skillContent += `  command: "${options.command ?? "pnpm dev"}"\n`;
    if (options.port) {
      skillContent += `  port: ${options.port}\n`;
    }
    skillContent += "  permission: [read, write]\n";
  } else if (type === "proxy") {
    skillContent += `  url: "${options.url ?? "https://example.com"}"\n`;
    skillContent += "  permission: [read]\n";
  }

  skillContent += `name: "${name}"\n`;
  if (description) {
    skillContent += `description: "${description}"\n`;
  }
  skillContent += "---\n\n";
  skillContent += `# ${name}\n\n`;
  skillContent += description ?? "Page description here.";

  // Write SKILL.md
  writeFileSync(skillPath, skillContent, "utf-8");

  // For static type, create default index.html
  if (type === "static") {
    const file = options.file ?? "index.html";
    const htmlPath = join(pageDir, file);
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
</head>
<body>
  <h1>${name}</h1>
  <p>${description ?? "Welcome to the page."}</p>
</body>
</html>
`;
    writeFileSync(htmlPath, htmlContent, "utf-8");
  }

  // Return created page
  const page = getPageBySlug(workspace_path, slug);

  return {
    success: true,
    page: page ?? undefined,
  };
}

// =============================================================================
// Delete Page
// =============================================================================

export interface DeletePageOptions {
  workspace_path: string;
  slug: string;
}

export async function deletePage(
  options: DeletePageOptions
): Promise<DeletePageResult> {
  const { workspace_path, slug } = options;

  const pagesDir = join(workspace_path, PAGES_DIR);
  const pageDir = join(pagesDir, slug);

  if (!existsSync(pageDir)) {
    return {
      success: false,
      error: `Page not found: ${slug}`,
    };
  }

  // Remove directory recursively
  rmSync(pageDir, { recursive: true, force: true });

  return {
    success: true,
    slug,
  };
}
```

- [ ] **Step 2: 更新 ops/index.ts 导出**

```typescript
// 在 ops/index.ts 末尾添加

// CRUD operations
export type {
  ListPagesOptions,
  ViewPageOptions,
  CreatePageOptions,
  DeletePageOptions,
} from "./crud";

export {
  listPages,
  viewPage,
  createPage,
  deletePage,
} from "./crud";
```

- [ ] **Step 3: 验证编译**

Run: `cd packages/core && pnpm tsc --noEmit src/page/ops/crud.ts`
Expected: 无错误输出

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/page/ops/
git commit -m "feat(page): add CRUD operations"
```

---

## Task 5: 模板系统

**设计说明**: 采用与 viben idea types 相同的双层查找机制：
- **内置模板**: `packages/core/templates/pages/` (只读)
- **用户自定义**: `<workspace>/docs/page-templates/` (优先级更高)

用户可以：
1. 在 `docs/page-templates/` 创建同名目录覆盖内置模板
2. 创建全新的自定义模板

**Files:**
- Create: `packages/core/src/page/ops/templates.ts`
- Create: `packages/core/templates/pages/static-html/template.json`
- Create: `packages/core/templates/pages/static-html/SKILL.md.hbs`
- Create: `packages/core/templates/pages/static-html/index.html.hbs`
- Create: `packages/core/templates/pages/markdown-docs/template.json`
- Create: `packages/core/templates/pages/markdown-docs/SKILL.md.hbs`
- Modify: `packages/core/src/page/ops/index.ts`
- Modify: `packages/core/src/page/ops/crud.ts`

- [ ] **Step 1: 创建 templates.ts (支持双层查找)**

```typescript
// packages/core/src/page/ops/templates.ts

/**
 * Page templates - load and render page templates
 *
 * 双层查找机制 (类似 viben idea types):
 * 1. 优先查找用户自定义模板: <workspace>/docs/page-templates/
 * 2. 回退到内置模板: packages/core/templates/pages/
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { PageTemplate, PageType, TemplateVars } from "./types";
import { getTemplatesDir } from "../../utils/templates";

// =============================================================================
// Constants
// =============================================================================

/** 用户自定义模板目录 (相对于 workspace root) */
export const CUSTOM_PAGE_TEMPLATES_DIR = "docs/page-templates";

/** 内置模板 ID 列表（包含 markdown 类型） */
export const BUILTIN_TEMPLATE_IDS = ["static-html", "markdown-docs"] as const;

// =============================================================================
// Directory Helpers
// =============================================================================

/** 获取内置模板目录路径（复用现有工具函数） */
function getBuiltinTemplatesDir(): string {
  const templatesDir = getTemplatesDir(import.meta.url);
  return join(templatesDir, "pages");
}

/** 获取用户自定义模板目录路径 */
function getCustomTemplatesDir(workspacePath: string): string {
  return join(workspacePath, CUSTOM_PAGE_TEMPLATES_DIR);
}

/** 获取内置模板路径 */
function getBuiltinTemplatePath(templateId: string): string {
  return join(getBuiltinTemplatesDir(), templateId);
}

/** 获取用户自定义模板路径 */
function getCustomTemplatePath(workspacePath: string, templateId: string): string {
  return join(getCustomTemplatesDir(workspacePath), templateId);
}

/** 检查是否为内置模板 ID */
function isBuiltinTemplateId(templateId: string): boolean {
  return (BUILTIN_TEMPLATE_IDS as readonly string[]).includes(templateId);
}

// =============================================================================
// Template Loading
// =============================================================================

/** 从目录加载模板元数据 */
function loadTemplateFromDir(
  templateDir: string,
  templateId: string,
  source: "builtin" | "custom"
): PageTemplate | null {
  const metadataPath = join(templateDir, "template.json");

  if (!existsSync(metadataPath)) {
    return null;
  }

  try {
    const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
    return {
      id: templateId,
      name: metadata.name,
      description: metadata.description,
      type: metadata.type as PageType,
      default_config: metadata.default_config ?? {},
      install_command: metadata.install_command,
      source, // 标记来源
    };
  } catch {
    return null;
  }
}

/**
 * 获取指定模板 (双层查找)
 * 优先级: 用户自定义 > 内置
 */
export function getTemplate(
  templateId: string,
  workspacePath?: string
): PageTemplate | null {
  // 1. 优先查找用户自定义模板
  if (workspacePath) {
    const customPath = getCustomTemplatePath(workspacePath, templateId);
    if (existsSync(customPath)) {
      const source = isBuiltinTemplateId(templateId) ? "builtin" : "custom";
      return loadTemplateFromDir(customPath, templateId, source);
    }
  }

  // 2. 回退到内置模板
  if (isBuiltinTemplateId(templateId)) {
    const builtinPath = getBuiltinTemplatePath(templateId);
    if (existsSync(builtinPath)) {
      return loadTemplateFromDir(builtinPath, templateId, "builtin");
    }
  }

  return null;
}

/**
 * 列出所有可用模板 (合并内置 + 用户自定义)
 */
export function listTemplates(workspacePath?: string): PageTemplate[] {
  const templates: PageTemplate[] = [];
  const seenIds = new Set<string>();

  // 1. 先读取用户自定义模板 (优先级更高)
  if (workspacePath) {
    const customDir = getCustomTemplatesDir(workspacePath);
    if (existsSync(customDir)) {
      const entries = readdirSync(customDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const templateId = entry.name;
        const templateDir = join(customDir, templateId);
        const source = isBuiltinTemplateId(templateId) ? "builtin" : "custom";
        const template = loadTemplateFromDir(templateDir, templateId, source);

        if (template) {
          templates.push(template);
          seenIds.add(templateId);
        }
      }
    }
  }

  // 2. 添加未被覆盖的内置模板
  const builtinDir = getBuiltinTemplatesDir();
  if (existsSync(builtinDir)) {
    for (const templateId of BUILTIN_TEMPLATE_IDS) {
      if (seenIds.has(templateId)) continue; // 已被用户自定义覆盖

      const builtinPath = getBuiltinTemplatePath(templateId);
      const template = loadTemplateFromDir(builtinPath, templateId, "builtin");

      if (template) {
        templates.push(template);
      }
    }
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

// =============================================================================
// Template Rendering
// =============================================================================

/** 渲染模板变量 */
function renderTemplate(content: string, vars: TemplateVars): string {
  return content
    .replace(/\{\{name\}\}/g, vars.name)
    .replace(/\{\{slug\}\}/g, vars.slug)
    .replace(/\{\{description\}\}/g, vars.description);
}

/**
 * 加载并渲染模板文件 (双层查找)
 */
export function loadTemplateFiles(
  templateId: string,
  vars: TemplateVars,
  workspacePath?: string
): Map<string, string> {
  const files = new Map<string, string>();

  // 确定模板目录 (优先用户自定义)
  let templateDir: string | null = null;

  if (workspacePath) {
    const customPath = getCustomTemplatePath(workspacePath, templateId);
    if (existsSync(customPath)) {
      templateDir = customPath;
    }
  }

  if (!templateDir && isBuiltinTemplateId(templateId)) {
    const builtinPath = getBuiltinTemplatePath(templateId);
    if (existsSync(builtinPath)) {
      templateDir = builtinPath;
    }
  }

  if (!templateDir) {
    return files;
  }

  // 递归读取并渲染模板文件（支持嵌套目录如 src/）
  loadFilesRecursively(templateDir, templateDir, vars, files);

  return files;
}

/**
 * 递归加载模板文件（支持嵌套目录结构）
 */
function loadFilesRecursively(
  dir: string,
  baseDir: string,
  vars: TemplateVars,
  files: Map<string, string>
): void {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "template.json") continue;

    const fullPath = join(dir, entry.name);
    const relativePath = relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      // 递归处理子目录
      loadFilesRecursively(fullPath, baseDir, vars, files);
    } else {
      const content = readFileSync(fullPath, "utf-8");
      // 移除 .hbs 扩展名
      const outputName = relativePath.endsWith(".hbs")
        ? relativePath.slice(0, -4)
        : relativePath;
      files.set(outputName, renderTemplate(content, vars));
    }
  }
}

// =============================================================================
// API Result Types
// =============================================================================

export interface ListTemplatesResult {
  success: boolean;
  templates: PageTemplate[];
  error?: string;
}

export async function listTemplatesResult(
  workspacePath?: string
): Promise<ListTemplatesResult> {
  return {
    success: true,
    templates: listTemplates(workspacePath),
  };
}
```

- [ ] **Step 2: 创建 static-html 模板目录和文件**

创建目录：
```bash
mkdir -p packages/core/templates/pages/static-html
```

创建 `packages/core/templates/pages/static-html/template.json`：
```json
{
  "name": "Static HTML",
  "description": "Simple static HTML page",
  "type": "static",
  "default_config": {
    "file": "index.html",
    "permission": ["read", "write"]
  }
}
```

创建 `packages/core/templates/pages/static-html/SKILL.md.hbs`：
```markdown
---
page:
  type: static
  file: index.html
  permission: [read, write]
name: "{{name}}"
description: "{{description}}"
---

# {{name}}

{{description}}
```

创建 `packages/core/templates/pages/static-html/index.html.hbs`：
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{name}}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
    }
    h1 { color: #333; }
    p { color: #666; }
  </style>
</head>
<body>
  <h1>{{name}}</h1>
  <p>{{description}}</p>
</body>
</html>
```

- [ ] **Step 2.5: 创建 markdown-docs 模板目录和文件**

创建目录：
```bash
mkdir -p packages/core/templates/pages/markdown-docs
```

创建 `packages/core/templates/pages/markdown-docs/template.json`：
```json
{
  "name": "Markdown Documentation",
  "description": "Documentation page rendered from SKILL.md content",
  "type": "markdown",
  "default_config": {
    "permission": ["read", "write"]
  }
}
```

创建 `packages/core/templates/pages/markdown-docs/SKILL.md.hbs`：
```markdown
---
page:
  type: markdown
  permission: [read, write]
name: "{{name}}"
description: "{{description}}"
---

# {{name}}

{{description}}

## Getting Started

This is a markdown documentation page. Edit the content below to add your documentation.

## Features

- Full markdown support
- SKILL.md content is rendered directly
- No additional files needed
```

- [ ] **Step 3: 修改 crud.ts 使用模板**

在 `packages/core/src/page/ops/crud.ts` 中修改 `createPage` 函数，将硬编码内容替换为模板加载：

```typescript
// 在文件顶部添加导入
import { loadTemplateFiles, getTemplate } from "./templates";

// 修改 CreatePageOptions 添加 template_id 和 markdown 类型
export interface CreatePageOptions {
  workspace_path: string;
  slug: string;
  name: string;
  description?: string;
  type: "static" | "markdown" | "server" | "proxy";  // 添加 markdown 类型
  template_id?: string;  // 添加此字段
  // Static-specific
  file?: string;
  // Server-specific
  command?: string;
  port?: number;
  ready_pattern?: string;
  timeout?: number;
  // Proxy-specific
  url?: string;
  headers?: Record<string, string>;
}

// 修改 createPage 函数的实现部分
export async function createPage(
  options: CreatePageOptions
): Promise<CreatePageResult> {
  const { workspace_path, slug, name, description, type, template_id } = options;

  const pagesDir = join(workspace_path, PAGES_DIR);
  const pageDir = join(pagesDir, slug);
  const skillPath = join(pageDir, SKILL_FILE);

  // Check if page already exists
  if (existsSync(skillPath)) {
    return {
      success: false,
      error: `Page already exists: ${slug}`,
    };
  }

  // Create directory
  mkdirSync(pageDir, { recursive: true });

  // Use template if specified, otherwise use default template
  const defaultTemplates: Record<string, string> = {
    static: "static-html",
    markdown: "markdown-docs",
    server: "server-basic",
    proxy: "proxy-basic",
  };
  const effectiveTemplateId = template_id ?? defaultTemplates[type] ?? `${type}-basic`;
  const template = getTemplate(effectiveTemplateId);

  // Types that support template loading (static and markdown)
  if (template && (type === "static" || type === "markdown")) {
    // Load template files
    const vars = {
      name,
      slug,
      description: description ?? "Page description here.",
    };
    const files = loadTemplateFiles(effectiveTemplateId, vars, workspace_path);

    // Write all template files
    for (const [filename, content] of files) {
      writeFileSync(join(pageDir, filename), content, "utf-8");
    }
  } else {
    // Fallback: generate files manually (for server/proxy or missing templates)
    let skillContent = "---\n";
    skillContent += "page:\n";
    skillContent += `  type: ${type}\n`;

    if (type === "static") {
      const file = options.file ?? "index.html";
      skillContent += `  file: ${file}\n`;
      skillContent += "  permission: [read, write]\n";
    } else if (type === "markdown") {
      // Markdown type: no file field needed
      skillContent += "  permission: [read, write]\n";
    } else if (type === "server") {
      skillContent += `  command: "${options.command ?? "pnpm dev"}"\n`;
      if (options.port) {
        skillContent += `  port: ${options.port}\n`;
      }
      skillContent += "  permission: [read, write]\n";
    } else if (type === "proxy") {
      skillContent += `  url: "${options.url ?? "https://example.com"}"\n`;
      skillContent += "  permission: [read]\n";
    }

    skillContent += `name: "${name}"\n`;
    if (description) {
      skillContent += `description: "${description}"\n`;
    }
    skillContent += "---\n\n";
    skillContent += `# ${name}\n\n`;
    skillContent += description ?? "Page description here.";

    writeFileSync(skillPath, skillContent, "utf-8");

    // For static type without template, create default index.html
    if (type === "static") {
      const file = options.file ?? "index.html";
      const htmlPath = join(pageDir, file);
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
</head>
<body>
  <h1>${name}</h1>
  <p>${description ?? "Welcome to the page."}</p>
</body>
</html>
`;
      writeFileSync(htmlPath, htmlContent, "utf-8");
    }
  }

  // Return created page
  const page = getPageBySlug(workspace_path, slug);

  return {
    success: true,
    page: page ?? undefined,
  };
}
```

- [ ] **Step 4: 更新 ops/index.ts 导出**

```typescript
// 在 ops/index.ts 末尾添加

// Templates
export {
  listTemplates,
  getTemplate,
  loadTemplateFiles,
  listTemplatesResult,
} from "./templates";

export type { ListTemplatesResult } from "./templates";
```

- [ ] **Step 5: 验证编译**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/page/ops/templates.ts
git add packages/core/templates/pages/
git add packages/core/src/page/ops/crud.ts
git add packages/core/src/page/ops/index.ts
git commit -m "feat(page): add template system"
```

---

## Task 6: 页面文件服务

**设计说明**: 支持 static 和 markdown 类型页面的内容服务。
- **static**: 提供静态文件服务（HTML、CSS、JS 等）
- **markdown**: 返回 SKILL.md 中的 skill_content

**安全修复**: 使用 `path.resolve()` + `path.sep` 修复路径遍历漏洞。

**Files:**
- Create: `packages/core/src/page/ops/serve.ts`

- [ ] **Step 1: 创建 serve.ts**

```typescript
// packages/core/src/page/ops/serve.ts

/**
 * Page serving - serve page content
 *
 * Supports:
 * - static: serve files from page directory
 * - markdown: return SKILL.md content as markdown
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, extname, resolve, sep } from "node:path";
import { getPageBySlug } from "./discovery";
import { isStaticPage, isMarkdownPage } from "./types";
import type { ServePageResult, PageConfig } from "./types";

// MIME types mapping
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".pdf": "application/pdf",
  ".md": "text/markdown",
};

export interface ServeOptions {
  workspace_path: string;
  slug: string;
  path?: string; // relative path within page directory
}

// =============================================================================
// Main Entry: servePage (handles all page types)
// =============================================================================

/**
 * Serve page content based on page type
 */
export async function servePage(options: ServeOptions): Promise<ServePageResult> {
  const { workspace_path, slug } = options;

  // Get page config
  const page = getPageBySlug(workspace_path, slug);

  if (!page) {
    return {
      success: false,
      error: `Page not found: ${slug}`,
    };
  }

  // Dispatch based on page type
  if (isStaticPage(page)) {
    return serveStaticFile(page, options.path);
  }

  if (isMarkdownPage(page)) {
    return serveMarkdownContent(page);
  }

  // Server and proxy types not handled here (require running servers)
  return {
    success: false,
    error: `Page type "${page.type}" requires server management, use server API instead`,
  };
}

// =============================================================================
// Static File Serving
// =============================================================================

/**
 * Serve a static file from a page
 * Security: Uses resolve() + sep to prevent path traversal
 */
function serveStaticFile(
  page: PageConfig & { type: "static"; file: string },
  requestedPath?: string
): ServePageResult {
  // Determine file to serve
  const relativePath = requestedPath || page.file;

  // SECURITY FIX: Resolve the path and check it's within page directory
  // Using resolve() normalizes ".." segments before checking
  const resolvedPath = resolve(page.path, relativePath);
  const pagePathWithSep = page.path.endsWith(sep) ? page.path : page.path + sep;

  // Path must start with page directory (with separator to prevent sibling bypass)
  if (!resolvedPath.startsWith(pagePathWithSep) && resolvedPath !== page.path) {
    return {
      success: false,
      error: "Invalid path: path traversal detected",
    };
  }

  // Check if file exists
  if (!existsSync(resolvedPath)) {
    return {
      success: false,
      error: `File not found: ${relativePath}`,
    };
  }

  // Check if it's a file (not directory)
  const stat = statSync(resolvedPath);
  if (!stat.isFile()) {
    return {
      success: false,
      error: `Not a file: ${relativePath}`,
    };
  }

  // Read file
  const content = readFileSync(resolvedPath);
  const ext = extname(resolvedPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  return {
    success: true,
    content,
    content_type: contentType,
  };
}

// =============================================================================
// Markdown Content Serving
// =============================================================================

/**
 * Serve markdown content from SKILL.md
 */
function serveMarkdownContent(
  page: PageConfig & { type: "markdown" }
): ServePageResult {
  if (!page.skill_content) {
    return {
      success: false,
      error: "Markdown page has no content",
    };
  }

  return {
    success: true,
    content: Buffer.from(page.skill_content, "utf-8"),
    content_type: "text/markdown",
  };
}

// =============================================================================
// Legacy Export (for backward compatibility)
// =============================================================================

/**
 * @deprecated Use servePage instead
 */
export async function serveStaticFileCompat(
  options: ServeOptions
): Promise<ServePageResult> {
  return servePage(options);
}
```

- [ ] **Step 2: 更新 ops/index.ts 导出**

```typescript
// 在 ops/index.ts 末尾添加

// Serve
export type { ServeOptions } from "./serve";
export { servePage, serveStaticFileCompat } from "./serve";
```

- [ ] **Step 3: 验证编译**

Run: `cd packages/core && pnpm tsc --noEmit src/page/ops/serve.ts`
Expected: 无错误输出

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/page/ops/
git commit -m "feat(page): add page content serving with security fix"
```

---

## Task 7: Gateway 路由

**设计说明**: 添加 Fastify schema 定义用于 API 文档和运行时验证。

**Files:**
- Create: `packages/core/src/gateway/routes/page.ts`
- Modify: `packages/core/src/gateway/index.ts`

- [ ] **Step 1: 创建 page.ts 路由文件**

```typescript
// packages/core/src/gateway/routes/page.ts

/**
 * Page API routes
 *
 * POST /api/page/list       - List pages
 * POST /api/page/view       - View page details
 * POST /api/page/create     - Create page
 * POST /api/page/delete     - Delete page
 * POST /api/page/serve      - Serve page content (POST for API)
 * GET  /api/page/serve      - Serve page content (GET for iframe)
 * POST /api/page/templates  - List available templates
 */

import type { FastifyInstance } from "fastify";
import {
  listPages,
  viewPage,
  createPage,
  deletePage,
  servePage,
  listTemplatesResult,
} from "../../page/ops";

// =============================================================================
// Fastify Schema Definitions (for API documentation and validation)
// =============================================================================

const pageTypeSchema = {
  type: "string",
  enum: ["static", "markdown", "server", "proxy"],
} as const;

const pageConfigSchema = {
  type: "object",
  properties: {
    slug: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    icon: { type: "string" },
    type: pageTypeSchema,
    permission: { type: "array", items: { type: "string", enum: ["read", "write"] } },
    path: { type: "string" },
    skill_content: { type: "string" },
    // Static-specific
    file: { type: "string" },
    // Server-specific
    command: { type: "string" },
    port: { type: "number" },
    ready_pattern: { type: "string" },
    timeout: { type: "number" },
    // Proxy-specific
    url: { type: "string" },
    headers: { type: "object", additionalProperties: { type: "string" } },
  },
  required: ["slug", "name", "type", "permission", "path"],
} as const;

const listPagesSchema = {
  body: {
    type: "object",
    properties: {
      workspace_path: { type: "string" },
    },
    required: ["workspace_path"],
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        pages: { type: "array", items: pageConfigSchema },
        count: { type: "number" },
        error: { type: "string" },
      },
    },
  },
} as const;

const viewPageSchema = {
  body: {
    type: "object",
    properties: {
      workspace_path: { type: "string" },
      slug: { type: "string" },
    },
    required: ["workspace_path", "slug"],
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        page: pageConfigSchema,
        error: { type: "string" },
      },
    },
  },
} as const;

const createPageSchema = {
  body: {
    type: "object",
    properties: {
      workspace_path: { type: "string" },
      slug: { type: "string" },
      name: { type: "string" },
      description: { type: "string" },
      type: pageTypeSchema,
      template_id: { type: "string" },
      file: { type: "string" },
      command: { type: "string" },
      port: { type: "number" },
      url: { type: "string" },
    },
    required: ["workspace_path", "slug", "name", "type"],
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        page: pageConfigSchema,
        error: { type: "string" },
      },
    },
  },
} as const;

const deletePageSchema = {
  body: {
    type: "object",
    properties: {
      workspace_path: { type: "string" },
      slug: { type: "string" },
    },
    required: ["workspace_path", "slug"],
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        slug: { type: "string" },
        deleted_path: { type: "string" },
        error: { type: "string" },
      },
    },
  },
} as const;

const servePagePostSchema = {
  body: {
    type: "object",
    properties: {
      workspace_path: { type: "string" },
      slug: { type: "string" },
      path: { type: "string" },
    },
    required: ["workspace_path", "slug"],
  },
} as const;

const servePageGetSchema = {
  querystring: {
    type: "object",
    properties: {
      workspace_path: { type: "string" },
      slug: { type: "string" },
      path: { type: "string" },
    },
    required: ["workspace_path", "slug"],
  },
} as const;

const listTemplatesSchema = {
  body: {
    type: "object",
    properties: {
      workspace_path: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        templates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
              type: pageTypeSchema,
              source: { type: "string", enum: ["builtin", "custom"] },
            },
          },
        },
        error: { type: "string" },
      },
    },
  },
} as const;

// =============================================================================
// Route Registration
// =============================================================================

export function registerPageRoutes(fastify: FastifyInstance): void {
  // ==========================================================================
  // POST /api/page/list
  // ==========================================================================
  fastify.post<{
    Body: { workspace_path: string };
  }>("/api/page/list", { schema: listPagesSchema }, async (request, reply) => {
    const { workspace_path } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    const result = await listPages({ workspace_path });
    return result;
  });

  // ==========================================================================
  // POST /api/page/view
  // ==========================================================================
  fastify.post<{
    Body: { workspace_path: string; slug: string };
  }>("/api/page/view", { schema: viewPageSchema }, async (request, reply) => {
    const { workspace_path, slug } = request.body;

    if (!workspace_path || !slug) {
      reply.code(400);
      return { success: false, error: "workspace_path and slug are required" };
    }

    const result = await viewPage({ workspace_path, slug });
    return result;
  });

  // ==========================================================================
  // POST /api/page/create
  // ==========================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      slug: string;
      name: string;
      description?: string;
      type: "static" | "markdown" | "server" | "proxy";
      template_id?: string;
      file?: string;
      command?: string;
      port?: number;
      url?: string;
    };
  }>("/api/page/create", { schema: createPageSchema }, async (request, reply) => {
    const { workspace_path, slug, name, type } = request.body;

    if (!workspace_path || !slug || !name || !type) {
      reply.code(400);
      return { success: false, error: "workspace_path, slug, name, and type are required" };
    }

    const result = await createPage(request.body);
    return result;
  });

  // ==========================================================================
  // POST /api/page/delete
  // ==========================================================================
  fastify.post<{
    Body: { workspace_path: string; slug: string };
  }>("/api/page/delete", { schema: deletePageSchema }, async (request, reply) => {
    const { workspace_path, slug } = request.body;

    if (!workspace_path || !slug) {
      reply.code(400);
      return { success: false, error: "workspace_path and slug are required" };
    }

    const result = await deletePage({ workspace_path, slug });
    return result;
  });

  // ==========================================================================
  // POST /api/page/serve (for API calls - supports static + markdown)
  // ==========================================================================
  fastify.post<{
    Body: { workspace_path: string; slug: string; path?: string };
  }>("/api/page/serve", { schema: servePagePostSchema }, async (request, reply) => {
    const { workspace_path, slug, path } = request.body;

    if (!workspace_path || !slug) {
      reply.code(400);
      return { success: false, error: "workspace_path and slug are required" };
    }

    // Use servePage which handles both static and markdown types
    const result = await servePage({ workspace_path, slug, path });

    if (!result.success) {
      reply.code(404);
      return { success: false, error: result.error };
    }

    // Set content type and return binary content
    reply.type(result.content_type!);
    return result.content;
  });

  // ==========================================================================
  // GET /api/page/serve (for iframe embedding - supports static + markdown)
  // ==========================================================================
  fastify.get<{
    Querystring: { workspace_path: string; slug: string; path?: string };
  }>("/api/page/serve", { schema: servePageGetSchema }, async (request, reply) => {
    const { workspace_path, slug, path } = request.query;

    if (!workspace_path || !slug) {
      reply.code(400);
      return { success: false, error: "workspace_path and slug are required" };
    }

    // Use servePage which handles both static and markdown types
    const result = await servePage({ workspace_path, slug, path });

    if (!result.success) {
      reply.code(404);
      return { success: false, error: result.error };
    }

    // Set content type and return binary content
    reply.type(result.content_type!);
    return result.content;
  });

  // ==========================================================================
  // POST /api/page/templates
  // ==========================================================================
  fastify.post<{
    Body: { workspace_path?: string };
  }>("/api/page/templates", { schema: listTemplatesSchema }, async (request) => {
    const { workspace_path } = request.body ?? {};
    const result = await listTemplatesResult(workspace_path);
    return result;
  });
}
```

- [ ] **Step 2: 在 gateway/index.ts 注册路由**

在 `packages/core/src/gateway/index.ts` 中找到 `registerTaskRoutes(fastify);` 这一行，在其后添加：

```typescript
import { registerPageRoutes } from "./routes/page";

// 在 registerTaskRoutes(fastify); 后添加
registerPageRoutes(fastify);
```

- [ ] **Step 3: 验证编译**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/gateway/
git add packages/core/src/page/
git commit -m "feat(page): add Gateway API routes"
```

---

## Task 8: CLI 命令

**Files:**
- Create: `packages/core/src/cli/commands/page.ts`
- Modify: `packages/core/src/cli/index.ts`

- [ ] **Step 1: 创建 page.ts CLI 命令文件**

```typescript
// packages/core/src/cli/commands/page.ts

/**
 * viben page - Workspace page management commands
 *
 * Manages custom pages in workspace pages/ directory.
 * Supports static, server, and proxy page types.
 *
 * Subcommands:
 * - list: List all pages in workspace
 * - view: View page details
 * - templates: List available page templates (builtin + custom)
 * - create: Create a new page
 * - delete: Delete a page
 */

import type { Command } from "commander";
import chalk from "chalk";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  outputTable,
  outputKeyValue,
  outputSuccess,
  outputWarning,
  handleCommandError,
} from "../lib";
import { CliError } from "../types";
import { findVibenRoot } from "../lib/viben-workspace";
import {
  listPages,
  viewPage,
  createPage,
  deletePage,
  listTemplates,
  getTemplate,
} from "../../page/ops";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get output context from program options
 */
function getOutputContext(program: Command): OutputContext {
  const opts = program.opts();
  return {
    json: opts.json ?? false,
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
  };
}

/**
 * Ensure workspace root exists
 */
function ensureWorkspaceRoot(cwd: string): string {
  const workspacePath = findVibenRoot(cwd);
  if (!workspacePath) {
    throw CliError.operationFailed(
      "Page command",
      `Not a Viben workspace (.viben not found). Run "viben init" first.`
    );
  }
  return workspacePath;
}

/**
 * Format page type for display
 */
function formatType(type: string): string {
  switch (type) {
    case "static":
      return chalk.blue(type);
    case "markdown":
      return chalk.cyan(type);
    case "server":
      return chalk.green(type);
    case "proxy":
      return chalk.magenta(type);
    default:
      return chalk.gray(type);
  }
}

/**
 * Format template source for display
 */
function formatSource(source: string): string {
  return source === "custom" ? chalk.yellow("[custom]") : chalk.gray("[builtin]");
}

// =============================================================================
// Command Registration
// =============================================================================

export function registerPageCommand(program: Command): void {
  const pageCmd = program
    .command("page")
    .description("Manage workspace pages");

  // ==========================================================================
  // viben page list
  // ==========================================================================
  pageCmd
    .command("list")
    .description("List all pages in workspace")
    .option("-t, --type <type>", "Filter by type (static|markdown|server|proxy)")
    .option("--json", "JSON format output")
    .action(async (options: { type?: string; json?: boolean }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const workspacePath = ensureWorkspaceRoot(cwd);
        const result = await listPages({ workspace_path: workspacePath });

        if (!result.success) {
          throw CliError.operationFailed("List pages", result.error || "Unknown error");
        }

        // Filter by type if specified
        let pages = result.pages;
        if (options.type) {
          pages = pages.filter((p) => p.type === options.type);
        }

        output(ctx, successResponse({ pages, count: pages.length }), () => {
          if (pages.length === 0) {
            console.log(chalk.gray("No pages found."));
            console.log();
            console.log("Create a page with:");
            console.log(chalk.cyan("  viben page create my-page --name \"My Page\""));
            return;
          }

          console.log(chalk.bold(`Pages (${pages.length}):`));
          console.log();
          outputTable(
            ctx,
            ["SLUG", "NAME", "TYPE", "DESCRIPTION"],
            pages.map((p) => [
              p.slug,
              p.name,
              p.type,
              p.description || "-",
            ])
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ==========================================================================
  // viben page view <slug>
  // ==========================================================================
  pageCmd
    .command("view <slug>")
    .description("View page details")
    .option("--json", "JSON format output")
    .action(async (slug: string, options: { json?: boolean }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const workspacePath = ensureWorkspaceRoot(cwd);
        const result = await viewPage({ workspace_path: workspacePath, slug });

        if (!result.success || !result.page) {
          throw CliError.notFound("Page", slug);
        }

        const page = result.page;

        output(ctx, successResponse({ page }), () => {
          console.log(chalk.bold(`Page: ${page.name}`));
          console.log();
          outputKeyValue(ctx, {
            "Slug": page.slug,
            "Type": page.type,
            "Path": page.path,
            "Permission": page.permission.join(", "),
            ...(page.type === "static" && { "File": page.file }),
            ...(page.type === "server" && { "Command": page.command }),
            ...(page.type === "server" && page.port && { "Port": String(page.port) }),
            ...(page.type === "proxy" && { "URL": page.url }),
          });

          if (page.description) {
            console.log();
            console.log(chalk.bold("Description"));
            console.log(page.description);
          }

          if (page.skill_content) {
            console.log();
            console.log(chalk.bold("SKILL.md Content"));
            console.log(chalk.gray(page.skill_content));
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ==========================================================================
  // viben page templates
  // ==========================================================================
  pageCmd
    .command("templates")
    .description("List available page templates (builtin + custom)")
    .option("--json", "JSON format output")
    .action(async (options: { json?: boolean }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        // workspacePath 可选，用于发现用户自定义模板
        const workspacePath = findVibenRoot(cwd);
        const templates = listTemplates(workspacePath ?? undefined);

        output(ctx, successResponse({ templates, count: templates.length }), () => {
          if (templates.length === 0) {
            console.log(chalk.gray("No templates found."));
            return;
          }

          console.log(chalk.bold("Available Page Templates:"));
          console.log();
          outputTable(
            ctx,
            ["ID", "NAME", "TYPE", "SOURCE", "DESCRIPTION"],
            templates.map((t) => [
              t.id,
              t.name,
              t.type,
              t.source,
              t.description,
            ])
          );

          console.log();
          console.log(chalk.gray("Custom templates: <workspace>/docs/page-templates/<template-id>/"));
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ==========================================================================
  // viben page create <slug>
  // ==========================================================================
  pageCmd
    .command("create <slug>")
    .description("Create a new page")
    .option("-n, --name <name>", "Page name (defaults to slug)")
    .option("-d, --description <desc>", "Page description")
    .option("-t, --type <type>", "Page type (static|markdown|server|proxy)", "static")
    .option("--template <id>", "Template ID (use 'viben page templates' to list)")
    .option("--parent <slug>", "Parent page slug for nested pages")
    .option("--json", "JSON format output")
    .action(async (slug: string, options: {
      name?: string;
      description?: string;
      type?: string;
      template?: string;
      parent?: string;
      json?: boolean;
    }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const workspacePath = ensureWorkspaceRoot(cwd);

        // Validate type
        const validTypes = ["static", "markdown", "server", "proxy"];
        const type = options.type ?? "static";
        if (!validTypes.includes(type)) {
          throw CliError.invalidArgument(
            "type",
            `Type must be one of: ${validTypes.join(", ")}`
          );
        }

        // Validate template if provided
        if (options.template) {
          const template = getTemplate(options.template, workspacePath);
          if (!template) {
            throw CliError.invalidArgument(
              "template",
              `Unknown template: ${options.template}. Use "viben page templates" to see available templates.`
            );
          }
        }

        // Build full slug with parent
        const fullSlug = options.parent ? `${options.parent}/${slug}` : slug;
        const name = options.name ?? slug;

        const result = await createPage({
          workspace_path: workspacePath,
          slug: fullSlug,
          name,
          description: options.description,
          type: type as "static" | "markdown" | "server" | "proxy",
          template_id: options.template,
        });

        if (!result.success) {
          throw CliError.operationFailed("Create page", result.error || "Unknown error");
        }

        output(ctx, successResponse(result), () => {
          outputSuccess(ctx, `Page created: ${fullSlug}`);
          console.log();
          outputKeyValue(ctx, {
            "Slug": result.page?.slug || fullSlug,
            "Name": result.page?.name || name,
            "Type": type,
            "Path": result.page?.path || "",
            ...(options.template && { "Template": options.template }),
          });
          console.log();
          console.log(chalk.blue("Next steps:"));
          console.log(`  1. Edit SKILL.md: ${result.page?.path}/SKILL.md`);
          if (type === "static") {
            console.log(`  2. Edit page: ${result.page?.path}/index.html`);
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ==========================================================================
  // viben page delete <slug>
  // ==========================================================================
  pageCmd
    .command("delete <slug>")
    .description("Delete a page")
    .option("-f, --force", "Skip confirmation")
    .option("--json", "JSON format output")
    .action(async (slug: string, options: { force?: boolean; json?: boolean }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const workspacePath = ensureWorkspaceRoot(cwd);

        // Check if page exists first
        const viewResult = await viewPage({ workspace_path: workspacePath, slug });
        if (!viewResult.success || !viewResult.page) {
          throw CliError.notFound("Page", slug);
        }

        // Warn about destructive operation
        if (!options.force && !ctx.quiet) {
          outputWarning(ctx, `This will delete page "${slug}" and all its files.`);
        }

        const result = await deletePage({ workspace_path: workspacePath, slug });

        if (!result.success) {
          throw CliError.operationFailed("Delete page", result.error || "Unknown error");
        }

        output(ctx, successResponse(result), () => {
          outputSuccess(ctx, `Page deleted: ${slug}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
```

- [ ] **Step 2: 在 cli/index.ts 注册命令**

在 `packages/core/src/cli/index.ts` 中找到 `registerTaskCommand(program);` 这一行，在其后添加：

```typescript
import { registerPageCommand } from "./commands/page";

// 在 registerTaskCommand(program); 后添加
registerPageCommand(program);
```

- [ ] **Step 3: 验证编译**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 4: 测试 CLI**

Run: `cd packages/core && pnpm build && viben page --help`
Expected:
```
Usage: viben page [options] [command]

Manage workspace pages

Options:
  -h, --help       display help for command

Commands:
  list             List all pages in workspace
  view <slug>      View page details
  templates        List available page templates (builtin + custom)
  create <slug>    Create a new page
  delete <slug>    Delete a page
  help [command]   display help for command
```

Run: `viben page templates`
Expected:
```
Available Page Templates:

ID            NAME          TYPE     SOURCE    DESCRIPTION
static-html   Static HTML   static   builtin   Simple static HTML page

Custom templates: <workspace>/docs/page-templates/<template-id>/
```

Run: `viben page templates --json`
Expected:
```json
{"success":true,"templates":[{"id":"static-html","name":"Static HTML","type":"static","source":"builtin",...}],"count":1}
```

Run: `viben page list --json`
Expected:
```json
{"success":true,"pages":[],"count":0}
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/cli/
git commit -m "feat(page): add CLI commands"
```

---

## Task 9: Desktop Gateway 客户端

**Files:**
- Create: `apps/desktop/src/lib/gateway/modules/pages.ts`
- Modify: `apps/desktop/src/lib/gateway/index.ts`

- [ ] **Step 1: 创建 pages.ts 客户端模块**

```typescript
// apps/desktop/src/lib/gateway/modules/pages.ts

/**
 * Gateway API client for pages
 */

import { gatewayFetch } from "../client";
import type { PageConfig } from "../types/page";

// =============================================================================
// Types
// =============================================================================

export interface ListPagesResult {
  success: boolean;
  pages: PageConfig[];
  count: number;
  error?: string;
}

export interface ViewPageResult {
  success: boolean;
  page?: PageConfig;
  error?: string;
}

export interface CreatePageResult {
  success: boolean;
  page?: PageConfig;
  error?: string;
}

export interface DeletePageResult {
  success: boolean;
  slug?: string;
  error?: string;
}

// Re-export PageConfig type for convenience
export type { PageConfig } from "../types/page";

// =============================================================================
// API Functions
// =============================================================================

export async function listPages(workspacePath: string): Promise<ListPagesResult> {
  return gatewayFetch("/api/page/list", {
    method: "POST",
    body: JSON.stringify({ workspace_path: workspacePath }),
  });
}

export async function viewPage(
  workspacePath: string,
  slug: string
): Promise<ViewPageResult> {
  return gatewayFetch("/api/page/view", {
    method: "POST",
    body: JSON.stringify({ workspace_path: workspacePath, slug }),
  });
}

export interface CreatePageParams {
  workspace_path: string;
  slug: string;
  name: string;
  description?: string;
  type: "static" | "markdown" | "server" | "proxy";
  file?: string;
  command?: string;
  port?: number;
  ready_pattern?: string;
  timeout?: number;
  url?: string;
  headers?: Record<string, string>;
}

export async function createPage(params: CreatePageParams): Promise<CreatePageResult> {
  return gatewayFetch("/api/page/create", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function deletePage(
  workspacePath: string,
  slug: string
): Promise<DeletePageResult> {
  return gatewayFetch("/api/page/delete", {
    method: "POST",
    body: JSON.stringify({ workspace_path: workspacePath, slug }),
  });
}

export function getPageServeUrl(
  workspacePath: string,
  slug: string,
  path?: string
): string {
  // For iframe embedding, we need a direct URL
  // This will be handled differently - using gateway proxy
  const params = new URLSearchParams({
    workspace_path: workspacePath,
    slug,
  });
  if (path) {
    params.set("path", path);
  }
  return `/api/page/serve?${params.toString()}`;
}

// =============================================================================
// Templates API
// =============================================================================

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  type: "static" | "server" | "proxy";
  default_config: Partial<PageConfig>;
  install_command?: string;
  source: "builtin" | "custom";
}

export interface ListTemplatesResult {
  success: boolean;
  templates: PageTemplate[];
  error?: string;
}

export async function listTemplates(workspacePath?: string): Promise<ListTemplatesResult> {
  return gatewayFetch("/api/page/templates", {
    method: "POST",
    body: JSON.stringify({ workspace_path: workspacePath }),
  });
}
```

- [ ] **Step 2: 添加 PageConfig 类型到 types**

在 `apps/desktop/src/lib/gateway/modules/types.ts` 或创建 `apps/desktop/src/lib/gateway/types/page.ts`：

```typescript
// apps/desktop/src/lib/gateway/types/page.ts

export type PageType = "static" | "markdown" | "server" | "proxy";
export type PagePermission = "read" | "write";

interface PageConfigBase {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  permission: PagePermission[];
  path: string;
  skill_content?: string;
}

export interface StaticPageConfig extends PageConfigBase {
  type: "static";
  file: string;
}

export interface MarkdownPageConfig extends PageConfigBase {
  type: "markdown";
}

export interface ServerPageConfig extends PageConfigBase {
  type: "server";
  command: string;
  port?: number;
  ready_pattern?: string;
  timeout?: number;
}

export interface ProxyPageConfig extends PageConfigBase {
  type: "proxy";
  url: string;
  headers?: Record<string, string>;
}

export type PageConfig = StaticPageConfig | MarkdownPageConfig | ServerPageConfig | ProxyPageConfig;
```

- [ ] **Step 3: 更新 gateway/index.ts 导出**

```typescript
// 在 apps/desktop/src/lib/gateway/index.ts 添加导出

export * from "./modules/pages";
export type { PageConfig, PageType, PagePermission } from "./types/page";
export type { PageTemplate, ListTemplatesResult } from "./modules/pages";
```

- [ ] **Step 4: 验证编译**

Run: `cd apps/desktop && pnpm tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/lib/gateway/
git commit -m "feat(desktop): add page gateway client"
```

---

## Task 10: Desktop Hook

**Files:**
- Create: `apps/desktop/src/hooks/use-pages.ts`

- [ ] **Step 1: 创建 use-pages.ts hook**

```typescript
// apps/desktop/src/hooks/use-pages.ts

/**
 * Hook for managing workspace pages
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listPages,
  viewPage,
  createPage,
  deletePage,
  listTemplates,
  type CreatePageParams,
  type PageConfig,
  type PageTemplate,
} from "@/lib/gateway";

// =============================================================================
// Query Keys
// =============================================================================

export const pageKeys = {
  all: ["pages"] as const,
  list: (workspacePath: string) => [...pageKeys.all, "list", workspacePath] as const,
  detail: (workspacePath: string, slug: string) =>
    [...pageKeys.all, "detail", workspacePath, slug] as const,
};

// =============================================================================
// Hooks
// =============================================================================

export function usePages(workspacePath: string | undefined) {
  return useQuery({
    queryKey: pageKeys.list(workspacePath ?? ""),
    queryFn: () => listPages(workspacePath!),
    enabled: !!workspacePath,
    select: (data) => data.pages,
  });
}

export function usePage(workspacePath: string | undefined, slug: string | undefined) {
  return useQuery({
    queryKey: pageKeys.detail(workspacePath ?? "", slug ?? ""),
    queryFn: () => viewPage(workspacePath!, slug!),
    enabled: !!workspacePath && !!slug,
    select: (data) => data.page,
  });
}

export function useCreatePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreatePageParams) => createPage(params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: pageKeys.list(variables.workspace_path),
      });
    },
  });
}

export function useDeletePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspacePath, slug }: { workspacePath: string; slug: string }) =>
      deletePage(workspacePath, slug),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: pageKeys.list(variables.workspacePath),
      });
    },
  });
}

// =============================================================================
// Templates Hooks
// =============================================================================

export const templateKeys = {
  all: ["page-templates"] as const,
  list: (workspacePath?: string) => [...templateKeys.all, "list", workspacePath ?? ""] as const,
};

export function usePageTemplates(workspacePath: string | undefined) {
  return useQuery({
    queryKey: templateKeys.list(workspacePath),
    queryFn: () => listTemplates(workspacePath),
    select: (data) => data.templates,
  });
}
```

- [ ] **Step 2: 验证编译**

Run: `cd apps/desktop && pnpm tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/hooks/use-pages.ts
git commit -m "feat(desktop): add use-pages hook"
```

---

## Task 11: Desktop 侧边栏 Pages Section

**Files:**
- Create: `apps/desktop/src/components/page/page-section.tsx`
- Modify: `apps/desktop/src/components/layout/sidebar.tsx`

- [ ] **Step 1: 创建 page-section.tsx**

```typescript
// apps/desktop/src/components/page/page-section.tsx

import * as React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { FileText, Plus, ChevronRight, ChevronDown, MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarSection } from "../layout/sidebar-section";
import { usePages, useDeletePage } from "@/hooks/use-pages";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import type { PageConfig } from "@/lib/gateway";

interface PageSectionProps {
  workspaceId: string;
  workspacePath: string;
  collapsed?: boolean;
}

export function PageSection({ workspaceId, workspacePath, collapsed = false }: PageSectionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: pages = [], isLoading } = usePages(workspacePath);
  const deletePageMutation = useDeletePage();

  // Build tree structure from flat list
  const pageTree = React.useMemo(() => {
    return buildPageTree(pages);
  }, [pages]);

  const handleCreatePage = () => {
    navigate(`/workspace/page?workspace_id=${workspaceId}&action=create`);
  };

  const handleCreateSubpage = (parentSlug: string) => {
    navigate(`/workspace/page?workspace_id=${workspaceId}&action=create&parent=${encodeURIComponent(parentSlug)}`);
  };

  const handleDeletePage = async (slug: string) => {
    try {
      await deletePageMutation.mutateAsync({ workspacePath, slug });
      toast({ title: t("page.deleteSuccess") });
    } catch (error) {
      toast({ title: t("page.deleteFailed"), variant: "destructive" });
    }
  };

  if (collapsed) {
    return null; // Don't show in collapsed mode for now
  }

  const addButton = (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={(e) => {
              e.stopPropagation();
              handleCreatePage();
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {t("page.createPage")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <SidebarSection
      title={t("page.pages")}
      collapsible
      defaultOpen
      headerAction={addButton}
    >
      {isLoading ? (
        <div className="px-3 py-2 text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : pageTree.length === 0 ? (
        <div className="px-3 py-2 text-sm text-muted-foreground">
          {t("page.noPages")}
        </div>
      ) : (
        <nav className="flex flex-col gap-0.5">
          {pageTree.map((page) => (
            <PageItem
              key={page.slug}
              page={page}
              workspaceId={workspaceId}
              workspacePath={workspacePath}
              onDelete={handleDeletePage}
              onCreateSubpage={handleCreateSubpage}
              level={0}
            />
          ))}
        </nav>
      )}
    </SidebarSection>
  );
}

// =============================================================================
// PageItem Component
// =============================================================================

interface PageTreeNode extends PageConfig {
  children: PageTreeNode[];
}

interface PageItemProps {
  page: PageTreeNode;
  workspaceId: string;
  workspacePath: string;
  onDelete: (slug: string) => void;
  onCreateSubpage: (parentSlug: string) => void;
  level: number;
}

function PageItem({ page, workspaceId, workspacePath, onDelete, onCreateSubpage, level }: PageItemProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(false);
  const hasChildren = page.children.length > 0;

  const pageUrl = `/workspace/page?workspace_id=${workspaceId}&page_path=pages/${page.slug}/SKILL.md`;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
        style={{ paddingLeft: `${8 + level * 12}px` }}
      >
        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 hover:bg-accent rounded"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Page Link */}
        <NavLink
          to={pageUrl}
          className="flex-1 truncate"
          title={page.description}
        >
          <span className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{page.name}</span>
          </span>
        </NavLink>

        {/* Create Subpage Button */}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateSubpage(page.slug);
                }}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {t("page.createSubpage")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* More Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => onCreateSubpage(page.slug)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("page.createSubpage")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(page.slug)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {page.children.map((child) => (
            <PageItem
              key={child.slug}
              page={child}
              workspaceId={workspaceId}
              workspacePath={workspacePath}
              onDelete={onDelete}
              onCreateSubpage={onCreateSubpage}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

function buildPageTree(pages: PageConfig[]): PageTreeNode[] {
  const nodeMap = new Map<string, PageTreeNode>();
  const roots: PageTreeNode[] = [];

  // Create nodes
  for (const page of pages) {
    nodeMap.set(page.slug, { ...page, children: [] });
  }

  // Build tree
  for (const page of pages) {
    const node = nodeMap.get(page.slug)!;
    const parentSlug = getParentSlug(page.slug);

    if (parentSlug && nodeMap.has(parentSlug)) {
      nodeMap.get(parentSlug)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function getParentSlug(slug: string): string | null {
  const lastSlash = slug.lastIndexOf("/");
  return lastSlash > 0 ? slug.substring(0, lastSlash) : null;
}
```

- [ ] **Step 2: 在 sidebar.tsx 中添加 PageSection**

在 `apps/desktop/src/components/layout/sidebar.tsx` 中：

1. 在文件顶部添加导入：
```typescript
import { PageSection } from "../page/page-section";
```

2. 找到 `<GatewayStatusIndicator` 组件，在其上方添加 PageSection：
```typescript
{/* 在 GatewayStatusIndicator 上方添加 */}
{activeWorkspaceId && activeWorkspace && (
  <PageSection
    workspaceId={activeWorkspaceId}
    workspacePath={activeWorkspace.path}
    collapsed={collapsed}
  />
)}

<GatewayStatusIndicator collapsed={collapsed} />
```

- [ ] **Step 3: 添加 i18n 翻译**

在 `apps/desktop/src/i18n/locales/en.json` 的根对象中添加 `page` 字段（与其他顶级字段如 `common`, `workspace` 同级）：

```json
{
  "page": {
    "pages": "Pages",
    "createPage": "Create Page",
    "createSubpage": "Create Subpage",
    "noPages": "No pages yet",
    "deleteSuccess": "Page deleted",
    "deleteFailed": "Failed to delete page",
    "selectPage": "Select a page",
    "notFound": "Page not found",
    "page": "Page",
    "serverNotImplemented": "Server type pages coming soon",
    "proxyNotImplemented": "Proxy type pages coming soon"
  }
}
```

在 `apps/desktop/src/i18n/locales/zh-CN.json` 的根对象中添加 `page` 字段：

```json
{
  "page": {
    "pages": "页面",
    "createPage": "创建页面",
    "createSubpage": "创建子页面",
    "noPages": "暂无页面",
    "deleteSuccess": "页面已删除",
    "deleteFailed": "删除页面失败",
    "selectPage": "请选择页面",
    "notFound": "页面不存在",
    "page": "页面",
    "serverNotImplemented": "Server 类型页面即将推出",
    "proxyNotImplemented": "Proxy 类型页面即将推出"
  }
}
```

- [ ] **Step 4: 验证编译**

Run: `cd apps/desktop && pnpm tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/page/
git add apps/desktop/src/components/layout/sidebar.tsx
git add apps/desktop/src/i18n/
git commit -m "feat(desktop): add Pages section to sidebar"
```

---

## Task 12: Desktop 页面详情路由

**设计说明**: 复用对话页面右侧滑栏的渲染模式：
- 三视图切换（类似 ArtifactPreview）：Preview | Code | Live
- 复用 `VitePreview` 组件用于 server 类型页面
- 复用 `CodeEditor` 组件渲染 SKILL.md
- 状态管理复用 `PreviewStatus` 类型

**渲染链路：**
```
WorkspacePage 组件
    │
    ├─ usePage hook 获取 PageConfig
    │
    └─ PagePreview 组件（三视图模式）
         │
         ├─ "skill" 视图：CodeEditor (read-only markdown)
         │
         ├─ "preview" 视图：根据 page.type 渲染
         │     ├─ static: <iframe src={gateway GET /api/page/serve} />
         │     ├─ server: VitePreview 组件 (复用)
         │     └─ proxy: <iframe src={proxyUrl} /> (P2)
         │
         └─ Header: 状态指示器 + 刷新/外部打开/全屏按钮
```

**Files:**
- Create: `apps/desktop/src/components/page/page-preview.tsx`
- Create: `apps/desktop/src/pages/workspace-page.tsx`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: 创建 page-preview.tsx (复用 VitePreview 设计模式)**

```typescript
// apps/desktop/src/components/page/page-preview.tsx

/**
 * PagePreview Component
 *
 * 页面预览组件，复用对话页面的 ArtifactPreview 设计模式。
 * 支持三种视图：SKILL.md | Preview | Live (server type only)
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  Code,
  Eye,
  ExternalLink,
  Maximize2,
  Minimize2,
  Play,
  RefreshCw,
  Square,
} from "lucide-react";
import { CodeEditor } from "@/components/skill-files/code-editor";
import { VitePreview } from "@/components/chat/vite-preview";
import type { PreviewStatus } from "@/hooks/use-vite-preview";
import type { PageConfig } from "@/lib/gateway";
import { getGatewayUrl } from "@/lib/gateway/config";

// =============================================================================
// Types
// =============================================================================

type PageViewMode = "skill" | "preview" | "live";

interface PagePreviewProps {
  page: PageConfig;
  workspacePath: string;
  // Live preview props (for server type)
  livePreviewUrl?: string | null;
  livePreviewStatus?: PreviewStatus;
  livePreviewError?: string | null;
  onStartLivePreview?: () => void;
  onStopLivePreview?: () => void;
  /** Whether Node.js is available for live preview */
  isNodeAvailable?: boolean | null;
}

// =============================================================================
// PagePreview Component
// =============================================================================

export function PagePreview({
  page,
  workspacePath,
  livePreviewUrl,
  livePreviewStatus = "idle",
  livePreviewError,
  onStartLivePreview,
  onStopLivePreview,
  isNodeAvailable,
}: PagePreviewProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = React.useState<PageViewMode>("preview");
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [iframeKey, setIframeKey] = React.useState(0);

  // Determine if live preview is available (server type + Node.js)
  const canUseLivePreview =
    page.type === "server" && isNodeAvailable && onStartLivePreview;
  const isLivePreviewRunning =
    livePreviewStatus === "running" || livePreviewStatus === "starting";

  // Build static preview URL
  const staticPreviewUrl = React.useMemo(() => {
    if (page.type !== "static") return null;
    const baseUrl = getGatewayUrl();
    const params = new URLSearchParams({
      workspace_path: workspacePath,
      slug: page.slug,
    });
    return `${baseUrl}/api/page/serve?${params.toString()}`;
  }, [page, workspacePath]);

  // Handle iframe refresh
  const handleRefresh = React.useCallback(() => {
    setIframeKey((k) => k + 1);
  }, []);

  // Handle open in external browser
  const handleOpenExternal = React.useCallback(async () => {
    const url = staticPreviewUrl || livePreviewUrl;
    if (url) {
      try {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(url);
      } catch {
        window.open(url, "_blank");
      }
    }
  }, [staticPreviewUrl, livePreviewUrl]);

  // Get status indicator color
  const statusColor = React.useMemo(() => {
    if (page.type === "static") return "bg-blue-500";
    if (page.type === "proxy") return "bg-purple-500";
    // server type
    switch (livePreviewStatus) {
      case "running":
        return "bg-green-500";
      case "starting":
        return "animate-pulse bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  }, [page.type, livePreviewStatus]);

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-background",
        isFullscreen && "fixed inset-0 z-50"
      )}
    >
      {/* Header with view mode toggle */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/50 bg-muted/30 px-4 py-2">
        {/* Left: Status and page info */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className={cn("h-2 w-2 shrink-0 rounded-full", statusColor)} />
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {page.name}
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span className="truncate text-xs text-muted-foreground">
            {page.type}
          </span>
        </div>

        {/* Center: View mode toggle buttons (复用 ArtifactPreview 样式) */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          {/* SKILL.md button */}
          <button
            type="button"
            onClick={() => setViewMode("skill")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
              viewMode === "skill"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="View SKILL.md"
          >
            <Code className="h-3.5 w-3.5" />
            <span>SKILL</span>
          </button>

          {/* Preview button */}
          <button
            type="button"
            onClick={() => setViewMode("preview")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
              viewMode === "preview"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={t("preview.preview")}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>{t("preview.preview")}</span>
          </button>

          {/* Live button (server type only) */}
          {canUseLivePreview && (
            <button
              type="button"
              onClick={() => {
                setViewMode("live");
                if (!isLivePreviewRunning && onStartLivePreview) {
                  onStartLivePreview();
                }
              }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                viewMode === "live"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={t("preview.livePreview")}
            >
              {isLivePreviewRunning ? (
                <Square className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              <span>{t("preview.live")}</span>
            </button>
          )}
        </div>

        {/* Right: Action buttons */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Refresh */}
          {viewMode === "preview" && (
            <button
              onClick={handleRefresh}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={t("preview.refreshHint")}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}

          {/* Open external */}
          {(staticPreviewUrl || livePreviewUrl) && (
            <button
              onClick={handleOpenExternal}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={t("preview.openInNewTab")}
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          )}

          {/* Fullscreen */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={isFullscreen ? t("preview.exitFullscreen") : t("preview.fullscreen")}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Content based on view mode */}
      <div className="flex-1 min-h-0">
        {viewMode === "skill" && (
          <CodeEditor
            value={page.skill_content ?? ""}
            filename="SKILL.md"
            readOnly
            height="100%"
          />
        )}

        {viewMode === "preview" && (
          <>
            {page.type === "static" && staticPreviewUrl && (
              <iframe
                key={iframeKey}
                src={staticPreviewUrl}
                className="h-full w-full border-0 bg-white"
                title={page.name}
              />
            )}
            {page.type === "server" && (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Play className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
                  <p className="mb-2 text-sm font-medium">
                    {t("page.serverType")}
                  </p>
                  <p className="mb-4 text-xs text-muted-foreground">
                    {t("page.clickLiveToStart")}
                  </p>
                  {canUseLivePreview && (
                    <button
                      onClick={() => {
                        setViewMode("live");
                        if (onStartLivePreview) {
                          onStartLivePreview();
                        }
                      }}
                      className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <Play className="h-4 w-4" />
                      {t("preview.startPreview")}
                    </button>
                  )}
                </div>
              </div>
            )}
            {page.type === "proxy" && (
              <div className="flex h-full items-center justify-center">
                <p className="text-muted-foreground">
                  {t("page.proxyNotImplemented")}
                </p>
              </div>
            )}
          </>
        )}

        {viewMode === "live" && (
          <VitePreview
            previewUrl={livePreviewUrl ?? null}
            status={livePreviewStatus}
            error={livePreviewError ?? null}
            onStart={onStartLivePreview}
            onStop={onStopLivePreview}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 workspace-page.tsx**

```typescript
// apps/desktop/src/pages/workspace-page.tsx

/**
 * WorkspacePage - 页面详情路由页面
 *
 * 路由: /workspace/page?workspace_id=<id>&page_path=pages/<slug>/SKILL.md
 */

import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePage } from "@/hooks/use-pages";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import { useVitePreview } from "@/hooks/use-vite-preview";
import { WorkspaceBreadcrumb } from "@/components/workspace/workspace-breadcrumb";
import { PagePreview } from "@/components/page/page-preview";
import { Loader2 } from "lucide-react";

export default function WorkspacePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get("workspace_id");
  const pagePath = searchParams.get("page_path");

  const { workspaces } = useLocalWorkspaces();
  const workspace = workspaces.find((w) => w.id === workspaceId);

  // Extract slug from page_path: pages/my-app/SKILL.md -> my-app
  const slug = React.useMemo(() => {
    if (!pagePath) return null;
    const match = pagePath.match(/^pages\/(.+)\/SKILL\.md$/);
    return match ? match[1] : null;
  }, [pagePath]);

  const { data: page, isLoading } = usePage(workspace?.path, slug ?? undefined);

  // Use Vite preview for server type pages
  const pageId = page ? `page-${page.slug}` : null;
  const {
    previewUrl,
    status: previewStatus,
    error: previewError,
    startPreview,
    stopPreview,
    isNodeAvailable,
  } = useVitePreview(pageId);

  // Handle start live preview
  const handleStartPreview = React.useCallback(() => {
    if (page?.type === "server" && page.path) {
      startPreview(page.path);
    }
  }, [page, startPreview]);

  // Empty state - no page selected
  if (!workspaceId || !pagePath || !workspace) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{t("page.selectPage")}</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  // Not found state
  if (!page) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{t("page.notFound")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb header */}
      <div className="shrink-0 border-b px-4 py-2">
        <WorkspaceBreadcrumb
          workspace={workspace}
          segments={[
            {
              label: t("page.pages"),
              href: `/workspace/page?workspace_id=${workspaceId}`,
            },
            { label: page.name },
          ]}
        />
      </div>

      {/* Page preview */}
      <div className="flex-1 min-h-0">
        <PagePreview
          page={page}
          workspacePath={workspace.path}
          livePreviewUrl={previewUrl}
          livePreviewStatus={previewStatus}
          livePreviewError={previewError}
          onStartLivePreview={handleStartPreview}
          onStopLivePreview={stopPreview}
          isNodeAvailable={isNodeAvailable}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 在 App.tsx 添加路由**

在 `apps/desktop/src/App.tsx` 中：

1. 在文件顶部添加导入：
```typescript
import WorkspacePage from "./pages/workspace-page";
```

2. 找到 `<Route path="/workspace/chat"` 路由，在其附近添加：
```typescript
<Route path="/workspace/page" element={<WorkspacePage />} />
```

- [ ] **Step 4: 添加 i18n 翻译（补充 preview 相关）**

在 `apps/desktop/src/i18n/locales/en.json` 的 `page` 字段中补充：

```json
{
  "page": {
    "pages": "Pages",
    "createPage": "Create Page",
    "createSubpage": "Create Subpage",
    "noPages": "No pages yet",
    "deleteSuccess": "Page deleted",
    "deleteFailed": "Failed to delete page",
    "selectPage": "Select a page",
    "notFound": "Page not found",
    "page": "Page",
    "serverType": "Server Type Page",
    "clickLiveToStart": "Click 'Live' to start the dev server",
    "serverNotImplemented": "Server type pages coming soon",
    "proxyNotImplemented": "Proxy type pages coming soon"
  }
}
```

在 `apps/desktop/src/i18n/locales/zh-CN.json` 的 `page` 字段中补充：

```json
{
  "page": {
    "pages": "页面",
    "createPage": "创建页面",
    "createSubpage": "创建子页面",
    "noPages": "暂无页面",
    "deleteSuccess": "页面已删除",
    "deleteFailed": "删除页面失败",
    "selectPage": "请选择页面",
    "notFound": "页面不存在",
    "page": "页面",
    "serverType": "Server 类型页面",
    "clickLiveToStart": "点击 "Live" 启动开发服务器",
    "serverNotImplemented": "Server 类型页面即将推出",
    "proxyNotImplemented": "Proxy 类型页面即将推出"
  }
}
```

- [ ] **Step 5: 验证编译**

Run: `cd apps/desktop && pnpm tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/components/page/page-preview.tsx
git add apps/desktop/src/pages/workspace-page.tsx
git add apps/desktop/src/App.tsx
git add apps/desktop/src/i18n/
git commit -m "feat(desktop): add page detail view with preview modes"
```

---

## Task 13: 全局 Tab 状态管理 (Zustand)

**Files:**
- Create: `apps/desktop/src/stores/tab-store.ts`
- Create: `apps/desktop/src/hooks/use-page-tabs.ts`

- [ ] **Step 1: 创建 tab-store.ts**

```typescript
// apps/desktop/src/stores/tab-store.ts

/**
 * Tab Store - Global tab state management using Zustand
 *
 * 类似 Notion 的标签页系统，支持：
 * - 普通 Tab 和固定 Tab (pinned)
 * - 页面历史导航 (back/forward)
 * - Tab 拖动排序
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// =============================================================================
// Types
// =============================================================================

export interface PageTab {
  id: string;                       // 唯一标识
  type: "page" | "chat" | "settings" | "new-tab";  // Tab 类型
  slug?: string;                    // 页面 slug (type=page 时)
  workspaceId?: string;            // 所属工作区
  name: string;                    // 显示名称
  icon?: string;                   // 图标名 (Lucide icon name)
  pinned: boolean;                 // 是否固定
  history: string[];               // 导航历史 (URL 列表)
  historyIndex: number;            // 当前历史位置
}

export interface TabState {
  tabs: PageTab[];
  activeTabId: string | null;
}

export interface TabActions {
  // Tab CRUD
  openTab: (tab: Omit<PageTab, "id" | "history" | "historyIndex">) => string;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<PageTab>) => void;

  // Pin management
  pinTab: (id: string) => void;
  unpinTab: (id: string) => void;

  // Reorder
  reorderTabs: (fromIndex: number, toIndex: number) => void;

  // Navigation
  navigateBack: () => void;
  navigateForward: () => void;
  pushHistory: (url: string) => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;

  // Bulk operations
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
}

type TabStore = TabState & TabActions;

// =============================================================================
// Helpers
// =============================================================================

function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildInitialUrl(tab: Omit<PageTab, "id" | "history" | "historyIndex">): string {
  if (tab.type === "page" && tab.slug && tab.workspaceId) {
    return `/workspace/page?workspace_id=${tab.workspaceId}&page_path=pages/${tab.slug}/SKILL.md`;
  }
  if (tab.type === "chat" && tab.workspaceId) {
    return `/workspace/chat?workspace_id=${tab.workspaceId}`;
  }
  if (tab.type === "settings") {
    return "/settings";
  }
  return "/";
}

// =============================================================================
// Store
// =============================================================================

export const useTabStore = create<TabStore>()(
  persist(
    (set, get) => ({
      // Initial state
      tabs: [],
      activeTabId: null,

      // Open new tab
      openTab: (tabData) => {
        const id = generateTabId();
        const initialUrl = buildInitialUrl(tabData);
        const newTab: PageTab = {
          ...tabData,
          id,
          pinned: tabData.pinned ?? false,
          history: [initialUrl],
          historyIndex: 0,
        };

        set((state) => {
          // Insert after last pinned tab if not pinned
          const lastPinnedIndex = state.tabs.findLastIndex((t) => t.pinned);
          const insertIndex = newTab.pinned ? lastPinnedIndex + 1 : state.tabs.length;

          const newTabs = [...state.tabs];
          newTabs.splice(insertIndex, 0, newTab);

          return {
            tabs: newTabs,
            activeTabId: id,
          };
        });

        return id;
      },

      // Close tab
      closeTab: (id) => {
        set((state) => {
          const tabIndex = state.tabs.findIndex((t) => t.id === id);
          if (tabIndex === -1) return state;

          const newTabs = state.tabs.filter((t) => t.id !== id);
          let newActiveId = state.activeTabId;

          // If closing active tab, switch to adjacent tab
          if (state.activeTabId === id) {
            if (newTabs.length === 0) {
              newActiveId = null;
            } else if (tabIndex >= newTabs.length) {
              newActiveId = newTabs[newTabs.length - 1].id;
            } else {
              newActiveId = newTabs[tabIndex].id;
            }
          }

          return { tabs: newTabs, activeTabId: newActiveId };
        });
      },

      // Switch to tab
      switchTab: (id) => {
        set({ activeTabId: id });
      },

      // Update tab
      updateTab: (id, updates) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        }));
      },

      // Pin tab (move to left side)
      pinTab: (id) => {
        set((state) => {
          const tabIndex = state.tabs.findIndex((t) => t.id === id);
          if (tabIndex === -1 || state.tabs[tabIndex].pinned) return state;

          const tab = { ...state.tabs[tabIndex], pinned: true };
          const newTabs = state.tabs.filter((t) => t.id !== id);
          const lastPinnedIndex = newTabs.findLastIndex((t) => t.pinned);
          newTabs.splice(lastPinnedIndex + 1, 0, tab);

          return { tabs: newTabs };
        });
      },

      // Unpin tab
      unpinTab: (id) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === id ? { ...t, pinned: false } : t
          ),
        }));
      },

      // Reorder tabs
      reorderTabs: (fromIndex, toIndex) => {
        set((state) => {
          const newTabs = [...state.tabs];
          const [removed] = newTabs.splice(fromIndex, 1);
          newTabs.splice(toIndex, 0, removed);
          return { tabs: newTabs };
        });
      },

      // Navigate back
      navigateBack: () => {
        set((state) => {
          const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
          if (!activeTab || activeTab.historyIndex <= 0) return state;

          return {
            tabs: state.tabs.map((t) =>
              t.id === state.activeTabId
                ? { ...t, historyIndex: t.historyIndex - 1 }
                : t
            ),
          };
        });
      },

      // Navigate forward
      navigateForward: () => {
        set((state) => {
          const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
          if (!activeTab || activeTab.historyIndex >= activeTab.history.length - 1) return state;

          return {
            tabs: state.tabs.map((t) =>
              t.id === state.activeTabId
                ? { ...t, historyIndex: t.historyIndex + 1 }
                : t
            ),
          };
        });
      },

      // Push new URL to history
      pushHistory: (url) => {
        set((state) => {
          const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
          if (!activeTab) return state;

          // Truncate forward history and add new URL
          const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
          newHistory.push(url);

          return {
            tabs: state.tabs.map((t) =>
              t.id === state.activeTabId
                ? { ...t, history: newHistory, historyIndex: newHistory.length - 1 }
                : t
            ),
          };
        });
      },

      // Can go back?
      canGoBack: () => {
        const { tabs, activeTabId } = get();
        const activeTab = tabs.find((t) => t.id === activeTabId);
        return activeTab ? activeTab.historyIndex > 0 : false;
      },

      // Can go forward?
      canGoForward: () => {
        const { tabs, activeTabId } = get();
        const activeTab = tabs.find((t) => t.id === activeTabId);
        return activeTab ? activeTab.historyIndex < activeTab.history.length - 1 : false;
      },

      // Close other tabs
      closeOtherTabs: (id) => {
        set((state) => ({
          tabs: state.tabs.filter((t) => t.id === id || t.pinned),
          activeTabId: id,
        }));
      },

      // Close all tabs
      closeAllTabs: () => {
        set((state) => ({
          tabs: state.tabs.filter((t) => t.pinned),
          activeTabId: state.tabs.find((t) => t.pinned)?.id ?? null,
        }));
      },
    }),
    {
      name: "viben-tabs",
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
      }),
    }
  )
);
```

- [ ] **Step 2: 创建 use-page-tabs.ts hook**

```typescript
// apps/desktop/src/hooks/use-page-tabs.ts

/**
 * Hook for page tab management
 * Provides convenient methods for opening pages in tabs
 */

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTabStore, type PageTab } from "@/stores/tab-store";

export function usePageTabs() {
  const navigate = useNavigate();
  const {
    tabs,
    activeTabId,
    openTab,
    closeTab,
    switchTab,
    pinTab,
    unpinTab,
    navigateBack,
    navigateForward,
    canGoBack,
    canGoForward,
    closeOtherTabs,
  } = useTabStore();

  // Get current active tab
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const currentUrl = activeTab?.history[activeTab.historyIndex];

  // Open a page in new tab
  const openPageTab = useCallback(
    (workspaceId: string, slug: string, name: string, icon?: string) => {
      const tabId = openTab({
        type: "page",
        workspaceId,
        slug,
        name,
        icon,
        pinned: false,
      });

      // Navigate to the page
      navigate(`/workspace/page?workspace_id=${workspaceId}&page_path=pages/${slug}/SKILL.md`);

      return tabId;
    },
    [openTab, navigate]
  );

  // Open chat tab
  const openChatTab = useCallback(
    (workspaceId: string, name: string) => {
      const tabId = openTab({
        type: "chat",
        workspaceId,
        name,
        icon: "message-square",
        pinned: false,
      });

      navigate(`/workspace/chat?workspace_id=${workspaceId}`);

      return tabId;
    },
    [openTab, navigate]
  );

  // Handle tab click
  const handleTabClick = useCallback(
    (tab: PageTab) => {
      switchTab(tab.id);
      const url = tab.history[tab.historyIndex];
      if (url) {
        navigate(url);
      }
    },
    [switchTab, navigate]
  );

  // Handle back navigation - update index then navigate to new URL
  const handleBack = useCallback(() => {
    if (!canGoBack()) return;

    // Get current tab state before update
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || tab.historyIndex <= 0) return;

    // Update store
    navigateBack();

    // Navigate to the previous URL
    const prevUrl = tab.history[tab.historyIndex - 1];
    if (prevUrl) {
      navigate(prevUrl);
    }
  }, [canGoBack, navigateBack, tabs, activeTabId, navigate]);

  // Handle forward navigation - update index then navigate to new URL
  const handleForward = useCallback(() => {
    if (!canGoForward()) return;

    // Get current tab state before update
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || tab.historyIndex >= tab.history.length - 1) return;

    // Update store
    navigateForward();

    // Navigate to the next URL
    const nextUrl = tab.history[tab.historyIndex + 1];
    if (nextUrl) {
      navigate(nextUrl);
    }
  }, [canGoForward, navigateForward, tabs, activeTabId, navigate]);

  return {
    tabs,
    activeTabId,
    activeTab,
    currentUrl,
    openPageTab,
    openChatTab,
    closeTab,
    switchTab,
    handleTabClick,
    pinTab,
    unpinTab,
    handleBack,
    handleForward,
    canGoBack: canGoBack(),
    canGoForward: canGoForward(),
    closeOtherTabs,
  };
}
```

- [ ] **Step 3: 验证编译**

Run: `cd apps/desktop && pnpm tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/stores/tab-store.ts
git add apps/desktop/src/hooks/use-page-tabs.ts
git commit -m "feat(desktop): add global tab state management"
```

---

## Task 14: 全局 Tab 栏组件

**Files:**
- Create: `apps/desktop/src/components/global-tab-bar/index.tsx`
- Create: `apps/desktop/src/components/global-tab-bar/tab-item.tsx`
- Create: `apps/desktop/src/components/global-tab-bar/window-controls.tsx`

- [ ] **Step 1: 创建 window-controls.tsx (仅 Windows)**

```typescript
// apps/desktop/src/components/global-tab-bar/window-controls.tsx

/**
 * Window Controls - Windows-style minimize/maximize/close buttons
 * Only rendered on Windows platform
 */

import * as React from "react";
import { Minus, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface WindowControlsProps {
  className?: string;
}

export function WindowControls({ className }: WindowControlsProps) {
  const [isMaximized, setIsMaximized] = React.useState(false);

  // Check platform - only show on Windows
  const [isWindows, setIsWindows] = React.useState(false);

  React.useEffect(() => {
    // Detect Windows platform
    const checkPlatform = async () => {
      try {
        const { platform } = await import("@tauri-apps/plugin-os");
        const os = await platform();
        setIsWindows(os === "windows");
      } catch {
        // Fallback to navigator
        setIsWindows(navigator.platform.toLowerCase().includes("win"));
      }
    };
    checkPlatform();

    // Listen for maximize state changes
    const checkMaximized = async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const appWindow = getCurrentWindow();
        setIsMaximized(await appWindow.isMaximized());

        // Listen for state changes
        const unlisten = await appWindow.onResized(async () => {
          setIsMaximized(await appWindow.isMaximized());
        });

        return () => {
          unlisten();
        };
      } catch {
        // Not in Tauri environment
      }
    };
    checkMaximized();
  }, []);

  const handleMinimize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch (e) {
      console.error("Failed to minimize:", e);
    }
  };

  const handleMaximize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().toggleMaximize();
    } catch (e) {
      console.error("Failed to toggle maximize:", e);
    }
  };

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch (e) {
      console.error("Failed to close:", e);
    }
  };

  // Don't render on non-Windows platforms
  if (!isWindows) return null;

  return (
    <div className={cn("flex items-center", className)}>
      {/* Minimize */}
      <button
        onClick={handleMinimize}
        className="flex h-8 w-12 items-center justify-center text-muted-foreground transition-colors hover:bg-muted"
        title="Minimize"
      >
        <Minus className="h-4 w-4" />
      </button>

      {/* Maximize/Restore */}
      <button
        onClick={handleMaximize}
        className="flex h-8 w-12 items-center justify-center text-muted-foreground transition-colors hover:bg-muted"
        title={isMaximized ? "Restore" : "Maximize"}
      >
        {isMaximized ? (
          <svg className="h-3 w-3" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="2" y="0" width="8" height="8" rx="1" />
            <rect x="0" y="2" width="8" height="8" rx="1" fill="currentColor" fillOpacity="0" />
          </svg>
        ) : (
          <Square className="h-3 w-3" />
        )}
      </button>

      {/* Close */}
      <button
        onClick={handleClose}
        className="flex h-8 w-12 items-center justify-center text-muted-foreground transition-colors hover:bg-red-500 hover:text-white"
        title="Close"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 创建 tab-item.tsx**

```typescript
// apps/desktop/src/components/global-tab-bar/tab-item.tsx

/**
 * TabItem - Single tab component in the global tab bar
 */

import * as React from "react";
import { X, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PageTab } from "@/stores/tab-store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useTranslation } from "react-i18next";

// Dynamic icon lookup
import * as LucideIcons from "lucide-react";

interface TabItemProps {
  tab: PageTab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onCloseOthers: () => void;
}

export function TabItem({
  tab,
  isActive,
  onSelect,
  onClose,
  onPin,
  onUnpin,
  onCloseOthers,
}: TabItemProps) {
  const { t } = useTranslation();

  // Get icon component dynamically
  const IconComponent = React.useMemo(() => {
    if (!tab.icon) return LucideIcons.FileText;
    const iconName = tab.icon
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
    return (LucideIcons as Record<string, React.ElementType>)[iconName] || LucideIcons.FileText;
  }, [tab.icon]);

  // Pinned tabs show only icon
  if (tab.pinned) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            onClick={onSelect}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors",
              isActive
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            title={tab.name}
          >
            <IconComponent className="h-4 w-4" />
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onUnpin}>
            <Pin className="mr-2 h-4 w-4" />
            {t("tabs.unpin")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onClose} className="text-destructive">
            <X className="mr-2 h-4 w-4" />
            {t("common.close")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  // Regular tabs
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          onClick={onSelect}
          className={cn(
            "group flex h-8 max-w-[200px] shrink-0 items-center gap-2 rounded-md px-3 transition-colors",
            isActive
              ? "bg-background text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <IconComponent className="h-4 w-4 shrink-0" />
          <span className="truncate text-sm">{tab.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="ml-auto shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onPin}>
          <Pin className="mr-2 h-4 w-4" />
          {t("tabs.pin")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onCloseOthers}>
          {t("tabs.closeOthers")}
        </ContextMenuItem>
        <ContextMenuItem onClick={onClose} className="text-destructive">
          <X className="mr-2 h-4 w-4" />
          {t("common.close")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
```

- [ ] **Step 3: 创建 global-tab-bar/index.tsx**

```typescript
// apps/desktop/src/components/global-tab-bar/index.tsx

/**
 * GlobalTabBar - Main tab bar component at the top of the window
 *
 * 布局: [<] [>] | [固定Tab] | [普通Tab...] [+] | [窗口控制]
 */

import * as React from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePageTabs } from "@/hooks/use-page-tabs";
import { TabItem } from "./tab-item";
import { WindowControls } from "./window-controls";
import { useTranslation } from "react-i18next";

interface GlobalTabBarProps {
  className?: string;
}

export function GlobalTabBar({ className }: GlobalTabBarProps) {
  const { t } = useTranslation();
  const {
    tabs,
    activeTabId,
    handleTabClick,
    closeTab,
    pinTab,
    unpinTab,
    handleBack,
    handleForward,
    canGoBack,
    canGoForward,
    closeOtherTabs,
  } = usePageTabs();

  const pinnedTabs = tabs.filter((t) => t.pinned);
  const regularTabs = tabs.filter((t) => !t.pinned);

  // Handle new tab
  const handleNewTab = () => {
    // TODO: Open new tab page or dialog
    console.log("New tab requested");
  };

  return (
    <div
      className={cn(
        "flex h-10 shrink-0 items-center gap-1 border-b bg-muted/50 px-2",
        className
      )}
    >
      {/* Drag region for window movement */}
      <div data-tauri-drag-region className="absolute inset-0 -z-10" />

      {/* Navigation buttons */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={handleBack}
          disabled={!canGoBack}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            canGoBack
              ? "text-muted-foreground hover:bg-accent hover:text-foreground"
              : "cursor-not-allowed text-muted-foreground/30"
          )}
          title={t("tabs.back")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={handleForward}
          disabled={!canGoForward}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            canGoForward
              ? "text-muted-foreground hover:bg-accent hover:text-foreground"
              : "cursor-not-allowed text-muted-foreground/30"
          )}
          title={t("tabs.forward")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Separator */}
      <div className="mx-1 h-4 w-px bg-border" />

      {/* Pinned tabs */}
      {pinnedTabs.length > 0 && (
        <>
          <div className="flex items-center gap-0.5">
            {pinnedTabs.map((tab) => (
              <TabItem
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onSelect={() => handleTabClick(tab)}
                onClose={() => closeTab(tab.id)}
                onPin={() => pinTab(tab.id)}
                onUnpin={() => unpinTab(tab.id)}
                onCloseOthers={() => closeOtherTabs(tab.id)}
              />
            ))}
          </div>
          <div className="mx-1 h-4 w-px bg-border" />
        </>
      )}

      {/* Regular tabs (scrollable) */}
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
        {regularTabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onSelect={() => handleTabClick(tab)}
            onClose={() => closeTab(tab.id)}
            onPin={() => pinTab(tab.id)}
            onUnpin={() => unpinTab(tab.id)}
            onCloseOthers={() => closeOtherTabs(tab.id)}
          />
        ))}
      </div>

      {/* New tab button */}
      <button
        onClick={handleNewTab}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title={t("tabs.newTab")}
      >
        <Plus className="h-4 w-4" />
      </button>

      {/* Window controls (Windows only) */}
      <WindowControls className="ml-auto" />
    </div>
  );
}

export { TabItem } from "./tab-item";
export { WindowControls } from "./window-controls";
```

- [ ] **Step 4: 添加 tabs i18n 翻译**

在 `apps/desktop/src/i18n/locales/en.json` 添加：

```json
{
  "tabs": {
    "back": "Go back",
    "forward": "Go forward",
    "newTab": "New tab",
    "pin": "Pin tab",
    "unpin": "Unpin tab",
    "closeOthers": "Close other tabs"
  }
}
```

在 `apps/desktop/src/i18n/locales/zh-CN.json` 添加：

```json
{
  "tabs": {
    "back": "后退",
    "forward": "前进",
    "newTab": "新建标签页",
    "pin": "固定标签页",
    "unpin": "取消固定",
    "closeOthers": "关闭其他标签页"
  }
}
```

- [ ] **Step 5: 验证编译**

Run: `cd apps/desktop && pnpm tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/components/global-tab-bar/
git add apps/desktop/src/i18n/
git commit -m "feat(desktop): add global tab bar component"
```

---

## Task 15: 集成全局 Tab 栏到布局

**Files:**
- Modify: `apps/desktop/src/components/layout/main-layout.tsx`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: 修改 main-layout.tsx 集成 Tab 栏**

在 `apps/desktop/src/components/layout/main-layout.tsx` 中：

1. 在文件顶部添加导入：
```typescript
import { GlobalTabBar } from "@/components/global-tab-bar";
```

2. 在布局最顶部添加 GlobalTabBar：
```typescript
return (
  <div className="flex h-screen flex-col">
    {/* Global Tab Bar at top */}
    <GlobalTabBar />

    {/* Rest of the layout */}
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      ...
      {/* Main content */}
      ...
    </div>
  </div>
);
```

- [ ] **Step 2: 修改 tauri.conf.json 设置无边框窗口 (Windows)**

在 `apps/desktop/src-tauri/tauri.conf.json` 中找到 `windows` 配置，修改为：

```json
{
  "windows": [
    {
      "title": "Viben Desktop",
      "width": 1200,
      "height": 800,
      "decorations": false,
      "transparent": false
    }
  ]
}
```

注意：`decorations: false` 移除系统标题栏，由 GlobalTabBar 提供窗口控制。

- [ ] **Step 3: 验证编译**

Run: `cd apps/desktop && pnpm tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 4: 测试 Desktop 窗口**

Run: `pnpm desktop:restart`

验证：
1. 窗口顶部显示自定义 Tab 栏
2. Windows 下显示最小化/最大化/关闭按钮
3. macOS 下窗口控制在左上角（系统原生）
4. Tab 栏可拖动窗口

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/layout/main-layout.tsx
git add apps/desktop/src-tauri/tauri.conf.json
git commit -m "feat(desktop): integrate global tab bar into layout"
```

---

## Task 16: 集成测试

**Files:** 无新建文件

- [ ] **Step 1: 启动 Gateway**

Run: `pnpm gateway:restart`

- [ ] **Step 2: 测试 CLI 命令**

```bash
# 创建测试工作区
mkdir -p /tmp/test-workspace/pages

cd /tmp/test-workspace

# 列出可用模板
viben page templates
# Expected: 显示 static-html [builtin] 模板

# 创建页面（使用默认模板）
viben page create test-page --name "Test Page" --type static

# 创建页面（指定模板）
viben page create test-page-2 --name "Test Page 2" --template static-html

# 列出页面
viben page list
# Expected: 显示 test-page 和 test-page-2

# 查看页面
viben page view test-page

# 删除页面
viben page delete test-page
viben page delete test-page-2

# 测试用户自定义模板
mkdir -p docs/page-templates/my-custom-template
cat > docs/page-templates/my-custom-template/template.json << 'EOF'
{
  "name": "My Custom Template",
  "description": "A custom page template",
  "type": "static",
  "default_config": {
    "file": "index.html",
    "permission": ["read", "write"]
  }
}
EOF

# 再次列出模板，应显示自定义模板
viben page templates
# Expected: 显示 my-custom-template [custom] 和 static-html [builtin]

# 清理自定义模板
rm -rf docs/page-templates
```

- [ ] **Step 3: 测试 Gateway API**

```bash
# 列出页面
curl -X POST http://localhost:18790/api/page/list \
  -H "Content-Type: application/json" \
  -d '{"workspace_path":"/tmp/test-workspace"}'
# Expected: {"success":true,"pages":[],"count":0}

# 创建页面
curl -X POST http://localhost:18790/api/page/create \
  -H "Content-Type: application/json" \
  -d '{"workspace_path":"/tmp/test-workspace","slug":"api-test","name":"API Test","type":"static"}'
# Expected: {"success":true,"page":{"slug":"api-test","name":"API Test","type":"static",...}}

# 服务页面 (POST)
curl -X POST http://localhost:18790/api/page/serve \
  -H "Content-Type: application/json" \
  -d '{"workspace_path":"/tmp/test-workspace","slug":"api-test"}'
# Expected: HTML content of the page

# 服务页面 (GET - for iframe)
curl "http://localhost:18790/api/page/serve?workspace_path=/tmp/test-workspace&slug=api-test"
# Expected: HTML content of the page

# 获取模板列表（仅内置）
curl -X POST http://localhost:18790/api/page/templates \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: {"success":true,"templates":[{"id":"static-html","name":"Static HTML","type":"static","source":"builtin",...}]}

# 获取模板列表（包含用户自定义）
curl -X POST http://localhost:18790/api/page/templates \
  -H "Content-Type: application/json" \
  -d '{"workspace_path":"/tmp/test-workspace"}'
# Expected: 如果有自定义模板，会包含 source:"custom" 的模板
```

- [ ] **Step 4: 测试 Desktop UI**

Run: `pnpm desktop:restart`

1. 打开 Desktop 应用
2. 选择一个工作区
3. 在侧边栏查看 Pages Section
4. 点击顶部 [+] 创建页面
5. 点击页面名称查看详情
6. 切换 SKILL.md / Page 视图
7. hover 页面项，点击 [+] 创建子页面
8. 测试子页面层级展示

- [ ] **Step 5: 清理测试数据**

```bash
rm -rf /tmp/test-workspace
```

- [ ] **Step 6: Final Commit**

```bash
git add -A
git commit -m "feat(page): complete P0 workspace pages implementation"
```
