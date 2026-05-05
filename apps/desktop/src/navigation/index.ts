// ─── Core Types & Meta ───────────────────────────────────────────────────────
export type {
  WorkspaceSection,
  ViewTarget,
  BreadcrumbItemDescriptor,
  BreadcrumbStackItem,
  VirtualPageIndexNode,
  TabNavigationState,
  PushPageOptions,
  TabNavigationApi,
  SettingsSection,
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
  getDescriptor,
  getDescriptorForLocation,
  LOCATION_DESCRIPTOR_MAP,
  ALL_DESCRIPTORS,
  getGlobalRouteDescriptor,
  getWorkspaceSectionDescriptor,
  getWorkspaceSectionRoutePath,
  isWorkspaceSection,
  normalizeWorkspaceSection,
  getSettingsSectionDescriptor,
  isSettingsSection,
  getSettingsSectionLabel,
  getSettingsSectionIcon,
  getWorkspaceSectionLabel,
} from "./navigation-meta";

// ─── Location ────────────────────────────────────────────────────────────────
export type { DesktopLocation } from "./navigation-meta";
export { locationToUrl, urlToLocation } from "./navigation-meta";

// ─── Breadcrumb Stack (atomic operations) ────────────────────────────────────
export {
  getStackTop,
  pushStackItem,
  replaceStackTop,
  popTo,
  createBreadcrumbItem,
  createLocationBreadcrumbItem,
} from "./breadcrumb-stack";

// ─── Location Navigation (Location → BreadcrumbStack) ────────────────────────
export {
  createStackForLocation,
  resolveLocationNavigation,
} from "./location-navigation";

// ─── Tab Navigation (state machine operations) ───────────────────────────────
export {
  createTabNavigationState,
  replaceLocation,
  pushPage,
  popTo as popTabTo,
  resetStack,
} from "./tab-navigation";

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
