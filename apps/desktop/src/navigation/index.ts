// ─── Route Registry (single source of truth) ─────────────────────────────────
export { registry, ROUTE_ENTRIES, humanize } from "./route-registry";
export type { RouteEntry, RouteMatch } from "./route-compiler";

// ─── Navigate API ─────────────────────────────────────────────────────────────
export { navigate, buildNavigateLeaf, buildColdStartBreadcrumb, popToBreadcrumb, isStackPrefixOf } from "./navigate";
export type { NavigateMethod } from "./navigate";
export type { NavigateHeaders, BreadcrumbMeta } from "./breadcrumb-builder";
export { deriveAncestorsFromPrefix, pickMatchingParams, buildBreadcrumbItem } from "./breadcrumb-builder";
export type { BreadcrumbStackItem as NewBreadcrumbStackItem } from "./breadcrumb-builder";

// ─── Tab Navigation ──────────────────────────────────────────────────────────
export { createTabNavigationState } from "./tab-navigation";
export type { TabNavigationState } from "@/stores/tab-store";

// ─── Legacy (migration only, do not use in new code) ─────────────────────────
export { locationToUrl as legacyLocationToUrl } from "./navigation-meta";

// ─── Core Types & Meta (still widely used) ───────────────────────────────────
export type {
  WorkspaceSection,
  SettingsSection,
  DesktopLocation,
  ViewTarget,
  BreadcrumbStackItem,
  VirtualPageIndexNode,
  TabNavigationState as LegacyTabNavigationState,
  PushPageOptions,
  WorkspaceSectionDescriptor,
  SettingsSectionDescriptor,
} from "./navigation-meta";
export {
  buildViewTarget,
  WORKSPACE_SECTION_DESCRIPTORS,
  SETTINGS_SECTION_DESCRIPTORS,
  GLOBAL_ROUTE_DESCRIPTORS,
  VALID_SETTINGS_SECTIONS,
  GLOBAL_ROUTE_META,
  getDescriptorIcon,
  getWorkspaceSectionDescriptor,
  getWorkspaceSectionRoutePath,
  normalizeWorkspaceSection,
  getSettingsSectionDescriptor,
  normalizeSettingsSection,
  getSettingsSectionLabel,
  getSettingsSectionIcon,
  getWorkspaceSectionLabel,
  locationToUrl,
  urlToLocation,
} from "./navigation-meta";

// ─── Breadcrumb Stack (atomic operations) ────────────────────────────────────
export {
  getStackTop,
  pushStackItem,
  replaceStackTop,
  popTo,
  createBreadcrumbItem,
  createLocationBreadcrumbItem,
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
