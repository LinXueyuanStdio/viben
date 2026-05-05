import type { IconData } from "@/components/ui/icon-picker";
import i18n from "@/i18n";

// ─── Navigation DAG ──────────────────────────────────────────────────────────
//
// The navigation structure is a DAG (Directed Acyclic Graph):
//
//   Nodes = BreadcrumbItemDescriptor (entities with id + routePath)
//   Edges = BreadcrumbEdge (transitions between nodes, carrying injected context)
//
// GLOBAL_ROUTE_DESCRIPTORS are the DAG root nodes.
// Items do NOT carry a "kind" field. To resolve an item's descriptor,
// use the edge index: given a parent descriptor and an item id,
// the edge tells you which descriptor the child resolves to.
//
// The breadcrumb stack is a path through this graph.

// ── Node (Descriptor) ──

export interface BreadcrumbItemDescriptor {
  id: string;
  routePath: string;
  icon: IconData;
  titleKey: string;
  fallbackLabel: string;
  isContainer?: boolean;
}

// ── Edges ──

/** Context keys that an edge injects into the child node's meta */

export type WorkspaceSection =
  | "apps"
  | "chat"
  | "kanban"
  | "cron"
  | "ideas"
  | "agent"
  | "files"
  | "github"
  | "chat-monitor";

export type SettingsSection =
  | "general"
  | "account"
  | "shortcuts"
  | "notifications"
  | "gateway"
  | "channels"
  | "executors"
  | "model"
  | "agents"
  | "mcp"
  | "skills"
  | "sandbox"
  | "environment"
  | "terminalFonts"
  | "overlay"
  | "voice"
  | "storage"
  | "developer"
  | "about";

// ─── DesktopLocation (formerly location.ts) ──────────────────────────────────

type LocationUrlSuffix = {
  search?: string;
  hash?: string;
};

export type DesktopLocation = (
  | { kind: "workspace-home"; workspaceId: string }
  | { kind: "workspace-apps"; workspaceId: string }
  | {
      kind: "workspace-section";
      workspaceId: string;
      section: WorkspaceSection;
    }
  | { kind: "workspace-agent-detail"; workspaceId: string; agentId: string }
  | {
      kind: "workspace-executor-detail";
      workspaceId: string;
      executorType: string;
    }
  | { kind: "workspace-page"; workspaceId: string; pageSlug: string }
  | {
      kind: "workspace-web";
      workspaceId: string;
      sourcePageSlug?: string;
      webId?: string;
      title: string;
      url: string;
    }
  | {
      kind: "agent-detail";
      agentId: string;
      workspacePath?: string;
    }
  | {
      kind: "executor-detail";
      executorType: string;
      workspacePath?: string;
    }
  | {
      kind: "skill-detail";
      skillId: string;
      agentId: string;
      workspacePath?: string;
    }
  | {
      kind: "mcp-server-detail";
      serverName: string;
      executorType: string;
      workspacePath?: string;
    }
  | {
      kind: "subagent-detail";
      configId: string;
      executorType: string;
      workspacePath?: string;
    }
  | {
      kind: "prompt-detail";
      promptId: string;
      executorType: string;
      workspacePath?: string;
    }
  | {
      kind: "command-detail";
      commandId: string;
      executorType: string;
      workspacePath?: string;
    }
  | { kind: "settings"; section?: SettingsSection }
  | { kind: "documents" }
  | { kind: "device-pair" }
  | { kind: "global-route"; path: string }
) &
  LocationUrlSuffix;

// ─── View Target & Breadcrumb Types ─────────────────────────────────────────

export interface ViewTarget {
  key: string;
  location: DesktopLocation;
  canonicalUrl: string;
}

// ── Runtime Instances ──

export interface BreadcrumbStackItem {
  id: string;
  label: string;
  icon?: IconData;
  descriptorId?: string;
  sourceNodeId?: string;
  parentNodeId?: string;
  target?: ViewTarget;
  meta?: {
    workspaceId?: string;
    section?: WorkspaceSection;
    routePath?: string;
    pageSlug?: string;
    agentId?: string;
    executorType?: string;
    webId?: string;
    url?: string;
    blockId?: string;
  };
}

export interface VirtualPageIndexNode {
  id: string;
  /** References a BreadcrumbItemDescriptor.id */
  descriptorId: string;
  label: string;
  icon?: IconData;
  parentId?: string;
  order: number;
  isContainer?: boolean;
  target?: ViewTarget;
  childSource?: {
    type:
      | "static"
      | "workspace-pages"
      | "workspace-agents"
      | "workspace-executors"
      | "page-navigation";
    workspaceId?: string;
    pageSlug?: string;
  };
  contentRef?: {
    pageSlug: string;
    blockId?: string;
  };
}

// ── Edge Index ──
// Pre-built lookup: given a parent descriptor id, returns valid child descriptor ids.
// Use `getChildDescriptors(parentId)` to query valid transitions.
// Use `resolveItemDescriptor(item, parentDescriptorId)` to find an item's descriptor.

export interface TabNavigationState {
  location: DesktopLocation;
  breadcrumbStack: BreadcrumbStackItem[];
  activeNodeId?: string;
  activeIndexPath?: string[];
}

export interface PushPageOptions {
  mode?: "push" | "replace";
  preserveTail?: boolean;
}

export interface TabNavigationApi {
  openLocation(next: TabNavigationState): void;
  replaceLocation(
    location: DesktopLocation,
    patch?: Partial<TabNavigationState>
  ): void;
  pushPage(
    item: BreadcrumbStackItem,
    nextLocation: DesktopLocation,
    options?: PushPageOptions
  ): void;
  popTo(index: number): void;
  resetStack(next: TabNavigationState): void;
}

export function buildViewTarget(
  location: DesktopLocation,
  canonicalUrl: string
): ViewTarget {
  return {
    key: canonicalUrl,
    location,
    canonicalUrl,
  };
}

// ─── Concrete Descriptors ────────────────────────────────────────────────────
// All descriptors extend BreadcrumbItemDescriptor with domain-specific fields.

export interface WorkspaceSectionDescriptor extends BreadcrumbItemDescriptor {
  section: WorkspaceSection;
}

export interface SettingsSectionDescriptor extends BreadcrumbItemDescriptor {
  section: SettingsSection;
}

// ─── DAG: Root Nodes (GLOBAL_ROUTE_DESCRIPTORS) ──────────────────────────────
// These are the top-level entry points of the navigation graph.

export const GLOBAL_ROUTE_DESCRIPTORS: BreadcrumbItemDescriptor[] = [
  { id: "workspace", routePath: "/workspace/:workspaceId", titleKey: "breadcrumb.workspace", fallbackLabel: "Workspace", icon: { type: "lucide", value: "home" }, isContainer: true },
  { id: "settings", routePath: "/settings", titleKey: "settings.title", fallbackLabel: "Settings", icon: { type: "lucide", value: "settings" }, isContainer: true },
  { id: "documents", routePath: "/documents", titleKey: "nav.documents", fallbackLabel: "Documents", icon: { type: "lucide", value: "file-text" } },
  { id: "devices", routePath: "/devices/pair", titleKey: "nav.devices", fallbackLabel: "Devices", icon: { type: "lucide", value: "smartphone" } },
  { id: "mcp-dashboard", routePath: "/mcp-services/dashboard", titleKey: "globalRoute.mcpDashboard", fallbackLabel: "Dashboard", icon: { type: "lucide", value: "layout-dashboard" } },
  { id: "mcp-data-sources", routePath: "/mcp-services/data-sources", titleKey: "globalRoute.mcpDataSources", fallbackLabel: "Data Sources", icon: { type: "lucide", value: "database" } },
  { id: "mcp-search-service", routePath: "/mcp-services/search-service", titleKey: "globalRoute.mcpSearchService", fallbackLabel: "Search Service", icon: { type: "lucide", value: "search" } },
  { id: "mcp-page-debug", routePath: "/mcp-services/page-debug", titleKey: "globalRoute.mcpPageDebug", fallbackLabel: "Page Debug", icon: { type: "lucide", value: "bug" } },
  { id: "mcp-logs", routePath: "/mcp-services/logs", titleKey: "globalRoute.mcpLogs", fallbackLabel: "Logs", icon: { type: "lucide", value: "scroll-text" } },
  { id: "publish", routePath: "/publish", titleKey: "globalRoute.publish", fallbackLabel: "Publish", icon: { type: "lucide", value: "upload" } },
  { id: "my-packages", routePath: "/my-packages", titleKey: "globalRoute.myPackages", fallbackLabel: "My Packages", icon: { type: "lucide", value: "package" } },
  { id: "analytics", routePath: "/analytics", titleKey: "globalRoute.analytics", fallbackLabel: "Analytics", icon: { type: "lucide", value: "chart-column" } },
];

// ─── DAG: Workspace Children ─────────────────────────────────────────────────

export const WORKSPACE_SECTION_DESCRIPTORS: WorkspaceSectionDescriptor[] = [
  { id: "workspace-section:apps", section: "apps", routePath: "apps", titleKey: "page.pages", fallbackLabel: "Apps", icon: { type: "lucide", value: "layers" }, isContainer: true },
  { id: "workspace-section:chat", section: "chat", routePath: "chat", titleKey: "workspace.chat", fallbackLabel: "Chat", icon: { type: "lucide", value: "message-square" } },
  { id: "workspace-section:kanban", section: "kanban", routePath: "kanban", titleKey: "workspace.kanban", fallbackLabel: "Kanban", icon: { type: "lucide", value: "layout-dashboard" } },
  { id: "workspace-section:cron", section: "cron", routePath: "cron", titleKey: "workspace.scheduledTasks", fallbackLabel: "Scheduled Tasks", icon: { type: "lucide", value: "clock" } },
  { id: "workspace-section:ideas", section: "ideas", routePath: "ideas", titleKey: "workspace.ideas", fallbackLabel: "Ideas", icon: { type: "lucide", value: "lightbulb" } },
  { id: "workspace-section:agent", section: "agent", routePath: "agent", titleKey: "workspace.sections.agents", fallbackLabel: "Agents", icon: { type: "lucide", value: "bot" } },
  { id: "workspace-section:files", section: "files", routePath: "files", titleKey: "workspace.files", fallbackLabel: "Files", icon: { type: "lucide", value: "folder-open" } },
  { id: "workspace-section:github", section: "github", routePath: "github", titleKey: "workspace.github.label", fallbackLabel: "GitHub", icon: { type: "lucide", value: "github" } },
  { id: "workspace-section:chat-monitor", section: "chat-monitor", routePath: "chat-monitor", titleKey: "workspace.chatMonitor", fallbackLabel: "Chat Monitor", icon: { type: "lucide", value: "activity" } },
];

// ─── DAG: Settings Children ──────────────────────────────────────────────────

export const SETTINGS_SECTION_DESCRIPTORS: SettingsSectionDescriptor[] = [
  { id: "settings:general", section: "general", routePath: "general", titleKey: "settings.sections.general", fallbackLabel: "General", icon: { type: "lucide", value: "settings" } },
  { id: "settings:account", section: "account", routePath: "account", titleKey: "settings.sections.account", fallbackLabel: "Account", icon: { type: "lucide", value: "user" } },
  { id: "settings:shortcuts", section: "shortcuts", routePath: "shortcuts", titleKey: "settings.sections.shortcuts", fallbackLabel: "Shortcuts", icon: { type: "lucide", value: "keyboard" } },
  { id: "settings:notifications", section: "notifications", routePath: "notifications", titleKey: "settings.sections.notifications", fallbackLabel: "Notifications", icon: { type: "lucide", value: "bell" } },
  { id: "settings:gateway", section: "gateway", routePath: "gateway", titleKey: "settings.sections.gateway", fallbackLabel: "Gateway", icon: { type: "lucide", value: "network" } },
  { id: "settings:channels", section: "channels", routePath: "channels", titleKey: "settings.sections.channels", fallbackLabel: "Channels", icon: { type: "lucide", value: "message-square" } },
  { id: "settings:executors", section: "executors", routePath: "executors", titleKey: "settings.sections.executors", fallbackLabel: "Executors", icon: { type: "lucide", value: "play" } },
  { id: "settings:model", section: "model", routePath: "model", titleKey: "settings.sections.model", fallbackLabel: "Model", icon: { type: "lucide", value: "cpu" } },
  { id: "settings:agents", section: "agents", routePath: "agents", titleKey: "settings.sections.agents", fallbackLabel: "Agents", icon: { type: "lucide", value: "bot" } },
  { id: "settings:mcp", section: "mcp", routePath: "mcp", titleKey: "settings.sections.mcp", fallbackLabel: "MCP", icon: { type: "lucide", value: "boxes" } },
  { id: "settings:skills", section: "skills", routePath: "skills", titleKey: "settings.sections.skills", fallbackLabel: "Skills", icon: { type: "lucide", value: "sparkles" } },
  { id: "settings:sandbox", section: "sandbox", routePath: "sandbox", titleKey: "settings.sections.sandbox", fallbackLabel: "Sandbox", icon: { type: "lucide", value: "box" } },
  { id: "settings:environment", section: "environment", routePath: "environment", titleKey: "settings.sections.environment", fallbackLabel: "Environment", icon: { type: "lucide", value: "terminal" } },
  { id: "settings:terminalFonts", section: "terminalFonts", routePath: "terminalFonts", titleKey: "settings.sections.terminalFonts", fallbackLabel: "Terminal Fonts", icon: { type: "lucide", value: "type" } },
  { id: "settings:overlay", section: "overlay", routePath: "overlay", titleKey: "settings.sections.overlay", fallbackLabel: "Overlay", icon: { type: "lucide", value: "layers" } },
  { id: "settings:voice", section: "voice", routePath: "voice", titleKey: "settings.sections.voice", fallbackLabel: "Voice", icon: { type: "lucide", value: "mic" } },
  { id: "settings:storage", section: "storage", routePath: "storage", titleKey: "settings.sections.storage", fallbackLabel: "Storage", icon: { type: "lucide", value: "hard-drive" } },
  { id: "settings:developer", section: "developer", routePath: "developer", titleKey: "settings.sections.developer", fallbackLabel: "Developer", icon: { type: "lucide", value: "bug" } },
  { id: "settings:about", section: "about", routePath: "about", titleKey: "settings.sections.about", fallbackLabel: "About", icon: { type: "lucide", value: "info" } },
];

export const VALID_SETTINGS_SECTIONS = SETTINGS_SECTION_DESCRIPTORS.map(
  (item) => item.section
);

// ─── Edge Index Map ──────────────────────────────────────────────────────────
// Maps a DesktopLocation.kind to its descriptor id.
// To find what descriptor an item belongs to, look up its location kind here.

export const LOCATION_DESCRIPTOR_MAP: Record<DesktopLocation["kind"], string> = {
  "workspace-home": "workspace",
  "workspace-apps": "workspace-section:apps",
  "workspace-section": "workspace-section:*",
  "workspace-agent-detail": "workspace-agent",
  "workspace-executor-detail": "workspace-executor",
  "workspace-page": "workspace-page",
  "workspace-web": "workspace-web",
  "agent-detail": "workspace-agent",
  "executor-detail": "workspace-executor",
  "skill-detail": "workspace-agent",
  "mcp-server-detail": "workspace-executor",
  "subagent-detail": "workspace-agent",
  "prompt-detail": "workspace-executor",
  "command-detail": "workspace-executor",
  "settings": "settings",
  "documents": "documents",
  "device-pair": "devices",
  "global-route": "workspace",
};

// ─── Deprecated Compat ───────────────────────────────────────────────────────

/** @deprecated Use `GLOBAL_ROUTE_DESCRIPTORS` instead */
export const GLOBAL_ROUTE_META: Record<string, { label: string; icon: IconData }> = Object.fromEntries(
  GLOBAL_ROUTE_DESCRIPTORS.map((d) => [d.routePath, { label: d.fallbackLabel, icon: d.icon }])
);

/** Resolve icon for an item by looking up its descriptor */
export function getDescriptorIcon(descriptorId: string | undefined): IconData | undefined {
  if (!descriptorId) return undefined;
  return DESCRIPTOR_BY_ID.get(descriptorId)?.icon;
}

// ─── Lookup Helpers ──────────────────────────────────────────────────────────

/** All descriptors in the DAG (roots + children) */
export const ALL_DESCRIPTORS: BreadcrumbItemDescriptor[] = [
  ...GLOBAL_ROUTE_DESCRIPTORS,
  ...WORKSPACE_SECTION_DESCRIPTORS,
  ...SETTINGS_SECTION_DESCRIPTORS,
];

const DESCRIPTOR_BY_ID = new Map<string, BreadcrumbItemDescriptor>(
  ALL_DESCRIPTORS.map((d) => [d.id, d])
);

/** Look up a descriptor by id */
export function getDescriptor(id: string): BreadcrumbItemDescriptor | undefined {
  return DESCRIPTOR_BY_ID.get(id);
}

/** Resolve descriptor for a DesktopLocation */
export function getDescriptorForLocation(location: DesktopLocation): BreadcrumbItemDescriptor | undefined {
  const descriptorId = LOCATION_DESCRIPTOR_MAP[location.kind];
  if (!descriptorId) return undefined;
  // Handle wildcard patterns like "workspace-section:*"
  if (descriptorId.endsWith(":*") && "section" in location) {
    const prefix = descriptorId.slice(0, -1);
    return DESCRIPTOR_BY_ID.get(prefix + (location as { section: string }).section);
  }
  return DESCRIPTOR_BY_ID.get(descriptorId);
}

export function getGlobalRouteDescriptor(path: string): BreadcrumbItemDescriptor | undefined {
  return GLOBAL_ROUTE_DESCRIPTORS.find((d) => d.routePath === path);
}

export function getWorkspaceSectionDescriptor(section?: string): WorkspaceSectionDescriptor | undefined {
  return WORKSPACE_SECTION_DESCRIPTORS.find((item) => item.section === section);
}

export function getWorkspaceSectionRoutePath(section: WorkspaceSection): string {
  return getWorkspaceSectionDescriptor(section)?.routePath ?? section;
}

export function isWorkspaceSection(value: string): value is WorkspaceSection {
  return Boolean(getWorkspaceSectionDescriptor(value));
}

export function normalizeWorkspaceSection(value: string): WorkspaceSection {
  if (value === "agents") return "agent";
  if (isWorkspaceSection(value)) return value;
  return "chat";
}

export function getSettingsSectionDescriptor(section?: string): SettingsSectionDescriptor | undefined {
  return SETTINGS_SECTION_DESCRIPTORS.find((item) => item.section === section);
}

export function isSettingsSection(value: string): value is SettingsSection {
  return Boolean(getSettingsSectionDescriptor(value));
}

export function normalizeSettingsSection(value?: string | null): SettingsSection {
  if (!value) return "general";
  return isSettingsSection(value) ? value : "general";
}

export function getSettingsSectionLabel(section?: string): string {
  const descriptor = getSettingsSectionDescriptor(section);
  if (!descriptor) return i18n.t("settings.title", "Settings");
  return i18n.t(descriptor.titleKey, descriptor.fallbackLabel);
}

export function getSettingsSectionIcon(section?: string): IconData {
  return getSettingsSectionDescriptor(section)?.icon ?? { type: "lucide", value: "settings" };
}

export function getWorkspaceSectionLabel(section?: WorkspaceSection): string {
  const descriptor = getWorkspaceSectionDescriptor(section);
  if (!descriptor) return "";
  return i18n.t(descriptor.titleKey, descriptor.fallbackLabel);
}

// ─── Location URL Conversion (formerly location.ts) ──────────────────────────

function decodePathPart(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

function extractWorkspacePageSlug(path: string): string | null {
  const pageMatch = path.match(/^\/workspace\/([^/]+)\/page\/(.+)$/);
  if (!pageMatch) return null;
  return pageMatch[2].split("/").map(decodePathPart).join("/");
}

function extractLegacyPageSlug(rawPagePath: string | null): string | null {
  if (!rawPagePath) return null;
  const pagePath = decodePathPart(rawPagePath);
  const match = pagePath.match(/^pages\/(.+)\/SKILL\.md$/);
  if (match) return match[1];
  if (pagePath.startsWith("pages/")) {
    return pagePath.slice("pages/".length).replace(/\/SKILL\.md$/, "");
  }
  return null;
}

function normalizeSearch(search?: string): string {
  if (!search) return "";
  return search.startsWith("?") ? search : `?${search}`;
}

function normalizeHash(hash?: string): string {
  if (!hash) return "";
  return hash.startsWith("#") ? hash : `#${hash}`;
}

function appendUrlSuffix(path: string, location: LocationUrlSuffix): string {
  const search = normalizeSearch(location.search);
  const hash = normalizeHash(location.hash);
  if (!search) return `${path}${hash}`;
  if (path.includes("?")) return `${path}&${search.slice(1)}${hash}`;
  return `${path}${search}${hash}`;
}

function buildDetailQuery(
  workspacePath: string | undefined,
  extraParams?: Record<string, string | undefined>
): string {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);
  if (extraParams) {
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function locationToUrl(location: DesktopLocation): string {
  switch (location.kind) {
    case "workspace-home":
      return appendUrlSuffix(`/workspace/${encodeURIComponent(location.workspaceId)}`, location);
    case "workspace-apps":
      return appendUrlSuffix(`/workspace/${encodeURIComponent(location.workspaceId)}/apps`, location);
    case "workspace-section":
      return appendUrlSuffix(`/workspace/${encodeURIComponent(location.workspaceId)}/${location.section}`, location);
    case "workspace-agent-detail":
      return appendUrlSuffix(`/workspace/${encodeURIComponent(location.workspaceId)}/agent/${encodeURIComponent(location.agentId)}`, location);
    case "workspace-executor-detail":
      return appendUrlSuffix(`/workspace/${encodeURIComponent(location.workspaceId)}/executor/${encodeURIComponent(location.executorType)}`, location);
    case "workspace-page": {
      const encodedSlug = location.pageSlug.split("/").filter(Boolean).map((segment) => encodeURIComponent(segment)).join("/");
      return appendUrlSuffix(`/workspace/${encodeURIComponent(location.workspaceId)}/page/${encodedSlug}`, location);
    }
    case "workspace-web": {
      const params = new URLSearchParams({ url: location.url, title: location.title });
      if (location.sourcePageSlug) params.set("source_page", location.sourcePageSlug);
      if (location.webId) params.set("web_id", location.webId);
      return appendUrlSuffix(`/workspace/${encodeURIComponent(location.workspaceId)}/web?${params.toString()}`, location);
    }
    case "agent-detail":
      return appendUrlSuffix(`/agent/${encodeURIComponent(location.agentId)}${buildDetailQuery(location.workspacePath)}`, location);
    case "executor-detail":
      return appendUrlSuffix(`/executor/${encodeURIComponent(location.executorType)}${buildDetailQuery(location.workspacePath)}`, location);
    case "skill-detail":
      return appendUrlSuffix(`/skill/${encodeURIComponent(location.skillId)}${buildDetailQuery(location.workspacePath, { agent_id: location.agentId })}`, location);
    case "mcp-server-detail":
      return appendUrlSuffix(`/mcp-server/${encodeURIComponent(location.serverName)}${buildDetailQuery(location.workspacePath, { executor_type: location.executorType })}`, location);
    case "subagent-detail":
      return appendUrlSuffix(`/subagent/${encodeURIComponent(location.configId)}${buildDetailQuery(location.workspacePath, { executor_type: location.executorType })}`, location);
    case "prompt-detail":
      return appendUrlSuffix(`/prompt/${encodeURIComponent(location.promptId)}${buildDetailQuery(location.workspacePath, { executor_type: location.executorType })}`, location);
    case "command-detail":
      return appendUrlSuffix(`/command/${encodeURIComponent(location.commandId)}${buildDetailQuery(location.workspacePath, { executor_type: location.executorType })}`, location);
    case "settings":
      return appendUrlSuffix(location.section ? `/settings/${encodeURIComponent(location.section)}` : "/settings/general", location);
    case "documents":
      return appendUrlSuffix("/documents", location);
    case "device-pair":
      return appendUrlSuffix("/devices/pair", location);
    case "global-route":
      return location.path;
    default: {
      const exhaustive: never = location;
      return exhaustive;
    }
  }
}

export function urlToLocation(url: string): DesktopLocation | null {
  const parsed = new URL(url, "http://desktop.local");
  const pathname = parsed.pathname;
  const segments = pathname.split("/").filter(Boolean);
  const suffix = { search: parsed.search || undefined, hash: parsed.hash || undefined };

  if (pathname === "/documents") return { kind: "documents", ...suffix };
  if (pathname === "/devices/pair") return { kind: "device-pair", ...suffix };
  if (pathname === "/publish" || pathname === "/my-packages" || pathname === "/analytics") {
    return { kind: "global-route", path: `${pathname}${parsed.search}${parsed.hash}` };
  }

  if (segments[0] === "settings") {
    const section = normalizeSettingsSection(segments[1] ? decodePathPart(segments[1]) : "general");
    return { kind: "settings", section, ...suffix };
  }

  if (segments[0] === "agent" && segments[1]) {
    return { kind: "agent-detail", agentId: decodePathPart(segments[1]), workspacePath: parsed.searchParams.get("workspace_path") ?? undefined, hash: parsed.hash || undefined };
  }
  if (segments[0] === "executor" && segments[1]) {
    return { kind: "executor-detail", executorType: decodePathPart(segments[1]), workspacePath: parsed.searchParams.get("workspace_path") ?? undefined, hash: parsed.hash || undefined };
  }
  if (segments[0] === "skill" && segments[1]) {
    return { kind: "skill-detail", skillId: decodePathPart(segments[1]), agentId: parsed.searchParams.get("agent_id") ?? "", workspacePath: parsed.searchParams.get("workspace_path") ?? undefined, hash: parsed.hash || undefined };
  }
  if (segments[0] === "mcp-server" && segments[1]) {
    return { kind: "mcp-server-detail", serverName: decodePathPart(segments[1]), executorType: parsed.searchParams.get("executor_type") ?? "CLAUDE_CODE", workspacePath: parsed.searchParams.get("workspace_path") ?? undefined, hash: parsed.hash || undefined };
  }
  if (segments[0] === "subagent" && segments[1]) {
    return { kind: "subagent-detail", configId: decodePathPart(segments[1]), executorType: parsed.searchParams.get("executor_type") ?? "CLAUDE_CODE", workspacePath: parsed.searchParams.get("workspace_path") ?? undefined, hash: parsed.hash || undefined };
  }
  if (segments[0] === "prompt" && segments[1]) {
    return { kind: "prompt-detail", promptId: decodePathPart(segments[1]), executorType: parsed.searchParams.get("executor_type") ?? "CLAUDE_CODE", workspacePath: parsed.searchParams.get("workspace_path") ?? undefined, hash: parsed.hash || undefined };
  }
  if (segments[0] === "command" && segments[1]) {
    return { kind: "command-detail", commandId: decodePathPart(segments[1]), executorType: parsed.searchParams.get("executor_type") ?? "CLAUDE_CODE", workspacePath: parsed.searchParams.get("workspace_path") ?? undefined, hash: parsed.hash || undefined };
  }

  if (segments[0] === "workspace" && segments[1] === "page") {
    const workspaceId = parsed.searchParams.get("workspace_id");
    const pageSlug = extractLegacyPageSlug(parsed.searchParams.get("page_path"));
    if (workspaceId && pageSlug) {
      return { kind: "workspace-page", workspaceId, pageSlug, hash: parsed.hash || undefined };
    }
  }

  if (segments[0] === "workspace" && segments[1]) {
    const workspaceId = decodePathPart(segments[1]);
    if (segments.length === 2) return { kind: "workspace-home", workspaceId, ...suffix };
    if (segments[2] === "apps" && !segments[3]) return { kind: "workspace-apps", workspaceId, ...suffix };
    if (segments[2] === "agents" && !segments[3]) return { kind: "workspace-section", workspaceId, section: "agent", ...suffix };
    if (segments[2] === "agent" && segments[3]) return { kind: "workspace-agent-detail", workspaceId, agentId: decodePathPart(segments[3]), ...suffix };
    if (segments[2] === "executor" && segments[3]) return { kind: "workspace-executor-detail", workspaceId, executorType: decodePathPart(segments[3]), ...suffix };
    if (segments[2] === "web") {
      const targetUrl = parsed.searchParams.get("url");
      const title = parsed.searchParams.get("title");
      if (targetUrl && title) {
        return { kind: "workspace-web", workspaceId, url: targetUrl, title, sourcePageSlug: parsed.searchParams.get("source_page") ?? undefined, webId: parsed.searchParams.get("web_id") ?? undefined, hash: parsed.hash || undefined };
      }
    }
    if (segments[2] === "page") {
      const pageSlug = extractWorkspacePageSlug(pathname);
      if (pageSlug) return { kind: "workspace-page", workspaceId, pageSlug, hash: parsed.hash || undefined };
    }
    const section = decodePathPart(segments[2]);
    if (isWorkspaceSection(section)) return { kind: "workspace-section", workspaceId, section, ...suffix };
  }

  if (pathname === "/") return null;
  return { kind: "global-route", path: `${pathname}${parsed.search}${parsed.hash}` };
}
