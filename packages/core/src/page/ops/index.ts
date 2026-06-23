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
  ICON_TYPES,
  PAGE_WIDTHS,
} from "./types";

// Types (Note: PageConfigBase is internal, not exported)
export type {
  PageType,
  PagePermission,
  PageViewMode,
  ServerStatus,
  IconType,
  IconData,
  PageWidth,
  PageIndex,
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
  UpdatePageContentResult,
  UpdatePageConfigOptions,
  UpdatePageConfigResult,
  ServePageResult,
  UploadPageAssetResult,
  ServerStatusResult,
  PageTemplate,
  TemplateFile,
  TemplateVars,
  ListTemplatesResult,
  ApplyPageTemplateOptions,
  ApplyPageTemplateResult,
  ReorderPagesOptions,
  ReorderPagesResult,
  DuplicatePageOptions,
  DuplicatePageResult,
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

// Discovery
export {
  parseSkillMd,
  listPagesInWorkspace,
  getPageByUid,
} from "./discovery";

// CRUD operations
export type {
  ListPagesOptions,
  ViewPageOptions,
  CreatePageOptions,
  DeletePageOptions,
  UpdatePageContentOptions,
  UploadPageAssetOptions,
} from "./crud";

export {
  listPages,
  viewPage,
  createPage,
  deletePage,
  duplicatePage,
  updatePageContent,
  updatePageConfig,
  uploadPageAsset,
  reorderPages,
} from "./crud";

// Serve
export type { ServeOptions } from "./serve";
export { servePage, serveStaticFileCompat } from "./serve";

// Templates
export {
  listTemplates,
  getTemplate,
  loadTemplateFiles,
  listTemplatesResult,
  applyPageTemplate,
} from "./templates";
