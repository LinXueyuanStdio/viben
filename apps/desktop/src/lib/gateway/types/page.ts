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

/** Page width options */
export type PageWidth = "default" | "wide" | "full";

// =============================================================================
// Page Index (嵌套关系)
// =============================================================================

/** 页面索引结构，邻接表格式 */
export interface PageIndex {
  [parentKey: string]: string[];  // "root" | uid -> uid[]
}

// =============================================================================
// Page Config Types (Union)
// =============================================================================

interface PageConfigBase {
  uid: string;
  name: string;
  description?: string;
  icon?: IconData;
  cover?: string;
  page_width?: PageWidth;
  show_toc?: boolean;
  permission: PagePermission[];
  path: string;
  skill_content?: string;
  /** ISO timestamp of the last modification */
  updated_at?: string;
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
  index: PageIndex;
}

export interface ViewPageResult extends PageResult {
  page?: PageConfig;
}

export interface CreatePageResult extends PageResult {
  page?: PageConfig;
}

export interface DeletePageResult extends PageResult {
  uid?: string;
  deleted_path?: string;
}

export interface UpdatePageContentResult extends PageResult {
  uid?: string;
}

export interface UpdatePageConfigParams {
  workspace_path: string;
  uid: string;
  name?: string;
  description?: string | null;
  icon?: IconData | null;
  cover?: string | null;
  page_width?: PageWidth | null;
  show_toc?: boolean | null;
}

export interface UpdatePageConfigResult extends PageResult {
  uid?: string;
  page?: PageConfig;
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
  slug?: string;
  name: string;
  description?: string;
  icon?: IconData;
  type: PageType;
  parent_uid?: string;
  file?: string;
  command?: string;
  port?: number;
  ready_pattern?: string;
  timeout?: number;
  url?: string;
  headers?: Record<string, string>;
}

// =============================================================================
// Reorder Types
// =============================================================================

export interface ReorderPagesParams {
  workspace_path: string;
  parent_uid: string | null;
  ordered_uids: string[];
}

export interface ReorderPagesResult extends PageResult {
  // empty on success
}

// =============================================================================
// Duplicate Types
// =============================================================================

export interface DuplicatePageParams {
  workspace_path: string;
  uid: string;
}

export interface DuplicatePageResult extends PageResult {
  page?: PageConfig;
}
