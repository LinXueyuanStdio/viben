/**
 * Page Module Type Definitions
 * 页面模块类型定义
 *
 * These types mirror the core page types from packages/core/src/page/ops/types.ts
 */

// =============================================================================
// Core Types
// =============================================================================

/** Page type enumeration */
export type PageType = "static" | "markdown" | "server" | "proxy";

/** Page permission enumeration */
export type PagePermission = "read" | "write";

/** Icon type enumeration */
export type IconType = "lucide" | "emoji" | "image";

/** Icon data structure */
export interface IconData {
  type: IconType;
  value: string;
}

// =============================================================================
// Page Config Types (Union)
// =============================================================================

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
  deleted_path?: string;
}

export interface UpdatePageContentResult extends PageResult {
  slug?: string;
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
  source: "builtin" | "custom";
}

export interface ListTemplatesResult extends PageResult {
  templates: PageTemplate[];
}

// =============================================================================
// Create Page Params
// =============================================================================

export interface CreatePageParams {
  workspace_path: string;
  slug: string;
  name: string;
  description?: string;
  icon?: IconData;
  type: PageType;
  file?: string;
  command?: string;
  port?: number;
  ready_pattern?: string;
  timeout?: number;
  url?: string;
  headers?: Record<string, string>;
}
