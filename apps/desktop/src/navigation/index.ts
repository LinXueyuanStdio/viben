// ─── Route Registry (single source of truth) ─────────────────────────────────
export { registry, ROUTE_ENTRIES, humanize } from "./route-registry";
export type { RouteEntry, RouteMatch } from "./route-compiler";

// ─── Navigate API ─────────────────────────────────────────────────────────────
export { navigate, buildNavigateLeaf, buildColdStartBreadcrumb, popToBreadcrumb, isStackPrefixOf } from "./navigate";
export type { NavigateMethod } from "./navigate";
export type { NavigateHeaders, BreadcrumbMeta, BreadcrumbStackItem } from "./breadcrumb-builder";
export { deriveAncestorsFromPrefix, pickMatchingParams, buildBreadcrumbItem } from "./breadcrumb-builder";

// ─── Tab Navigation ──────────────────────────────────────────────────────────
export { createTabNavigationState } from "./tab-navigation";
export type { TabNavigationState } from "@/stores/tab-store";

// ─── Core Types & Meta ────────────────────────────────────────────────────────
export type {
  WorkspaceSection,
  SettingsSection,
  VirtualPageIndexNode,
  PushPageOptions,
  WorkspaceSectionInfo,
  SettingsSectionInfo,
} from "./navigation-meta";
export {
  WORKSPACE_SECTIONS,
  SETTINGS_SECTIONS,
  VALID_SETTINGS_SECTIONS,
  getDescriptorIcon,
  getWorkspaceSectionDescriptor,
  getWorkspaceSectionRoutePath,
  normalizeWorkspaceSection,
  getSettingsSectionDescriptor,
  normalizeSettingsSection,
  getSettingsSectionLabel,
  getSettingsSectionIcon,
  getWorkspaceSectionLabel,
} from "./navigation-meta";

// ─── Breadcrumb Stack (atomic operations) ────────────────────────────────────
export {
  getStackTop,
  pushStackItem,
  replaceStackTop,
  popTo,
  createBreadcrumbItem,
} from "./breadcrumb-stack";

// ─── Navigation State ────────────────────────────────────────────────────────
export type {
  BreadcrumbNodeDescriptor,
  ResolvedNavigationState,
} from "./navigation-state";
export {
  createBreadcrumbNode,
  buildBreadcrumbStack,
  resolveNavigationState,
} from "./navigation-state";

// ─── Deep Link ───────────────────────────────────────────────────────────────
export type { DesktopDeepLinkIntent } from "./deep-link";
export { parseVibenDeepLink } from "./deep-link";

// ─── Page Navigation Extractor ───────────────────────────────────────────────
export type {
  ExtractedNavItemKind,
  ExtractedNavigationItem,
  PageNavigationExtract,
  YooptaNavigationMeta,
} from "./page-navigation-extractor";
export {
  extractPageNavigation,
  collectPageNavigationFromDom,
} from "./page-navigation-extractor";

// ─── Page Index ──────────────────────────────────────────────────────────────
export type {
  DesktopBreadcrumbSegment,
  BreadcrumbDropdownItem,
  ResolvePageIndexBranchInput,
} from "./page-index";
export {
  stackToDesktopSegments,
  resolvePageIndexBranch,
} from "./page-index";
