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
// Icon Types
// =============================================================================

/** 图标类型 */
export const ICON_TYPES = ["lucide", "emoji", "image"] as const;
export type IconType = (typeof ICON_TYPES)[number];

/** 图标数据结构 */
export interface IconData {
  type: IconType;
  value: string;
}

// =============================================================================
// Page Config Types (Union)
// =============================================================================

// Note: PageConfigBase is internal, used only for type inheritance
interface PageConfigBase {
  slug: string;
  name: string;
  description?: string;
  icon?: IconData;
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

export interface UpdatePageContentResult extends PageResult {
  slug?: string;
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