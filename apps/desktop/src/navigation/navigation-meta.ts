import type { IconData } from "@/components/ui/icon-picker";
import i18n from "@/i18n";

// ─── Core Types ──────────────────────────────────────────────────────────────

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

export type BreadcrumbItemKind =
  | "workspace-root"
  | "workspace-section"
  | "workspace-page"
  | "workspace-agent"
  | "workspace-executor"
  | "workspace-web"
  | "virtual-folder"
  | "global-route";

export interface BreadcrumbStackItem {
  id: string;
  kind: BreadcrumbItemKind;
  label: string;
  icon?: IconData;
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

export type VirtualNodeKind =
  | "workspace-root"
  | "workspace-section"
  | "workspace-page"
  | "workspace-agent"
  | "workspace-executor"
  | "external-web"
  | "virtual-folder"
  | "related-link";

export interface VirtualPageIndexNode {
  id: string;
  kind: VirtualNodeKind;
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

// ─── Descriptors ─────────────────────────────────────────────────────────────

export interface WorkspaceSectionDescriptor {
  section: WorkspaceSection;
  routePath: string;
  titleKey: string;
  fallbackLabel: string;
  icon: IconData;
  nodeKind: VirtualPageIndexNode["kind"];
}

export interface SettingsSectionDescriptor {
  section: SettingsSection;
  routePath: string;
  titleKey: string;
  fallbackLabel: string;
  icon: IconData;
}

export const WORKSPACE_SECTION_DESCRIPTORS: WorkspaceSectionDescriptor[] = [
  { section: "chat", routePath: "chat", titleKey: "workspace.chat", fallbackLabel: "Chat", icon: { type: "lucide", value: "message-square" }, nodeKind: "workspace-section" },
  { section: "kanban", routePath: "kanban", titleKey: "workspace.kanban", fallbackLabel: "Kanban", icon: { type: "lucide", value: "layout-dashboard" }, nodeKind: "workspace-section" },
  { section: "cron", routePath: "cron", titleKey: "workspace.scheduledTasks", fallbackLabel: "Scheduled Tasks", icon: { type: "lucide", value: "clock" }, nodeKind: "workspace-section" },
  { section: "ideas", routePath: "ideas", titleKey: "workspace.ideas", fallbackLabel: "Ideas", icon: { type: "lucide", value: "lightbulb" }, nodeKind: "workspace-section" },
  { section: "agent", routePath: "agent", titleKey: "workspace.sections.agents", fallbackLabel: "Agents", icon: { type: "lucide", value: "bot" }, nodeKind: "workspace-section" },
  { section: "files", routePath: "files", titleKey: "workspace.files", fallbackLabel: "Files", icon: { type: "lucide", value: "folder-open" }, nodeKind: "workspace-section" },
  { section: "github", routePath: "github", titleKey: "workspace.github.label", fallbackLabel: "GitHub", icon: { type: "lucide", value: "github" }, nodeKind: "workspace-section" },
  { section: "chat-monitor", routePath: "chat-monitor", titleKey: "workspace.chatMonitor", fallbackLabel: "Chat Monitor", icon: { type: "lucide", value: "activity" }, nodeKind: "workspace-section" },
];

export const SETTINGS_SECTION_DESCRIPTORS: SettingsSectionDescriptor[] = [
  { section: "general", routePath: "general", titleKey: "settings.sections.general", fallbackLabel: "General", icon: { type: "lucide", value: "settings" } },
  { section: "account", routePath: "account", titleKey: "settings.sections.account", fallbackLabel: "Account", icon: { type: "lucide", value: "user" } },
  { section: "shortcuts", routePath: "shortcuts", titleKey: "settings.sections.shortcuts", fallbackLabel: "Shortcuts", icon: { type: "lucide", value: "keyboard" } },
  { section: "notifications", routePath: "notifications", titleKey: "settings.sections.notifications", fallbackLabel: "Notifications", icon: { type: "lucide", value: "bell" } },
  { section: "gateway", routePath: "gateway", titleKey: "settings.sections.gateway", fallbackLabel: "Gateway", icon: { type: "lucide", value: "network" } },
  { section: "channels", routePath: "channels", titleKey: "settings.sections.channels", fallbackLabel: "Channels", icon: { type: "lucide", value: "message-square" } },
  { section: "executors", routePath: "executors", titleKey: "settings.sections.executors", fallbackLabel: "Executors", icon: { type: "lucide", value: "play" } },
  { section: "model", routePath: "model", titleKey: "settings.sections.model", fallbackLabel: "Model", icon: { type: "lucide", value: "cpu" } },
  { section: "agents", routePath: "agents", titleKey: "settings.sections.agents", fallbackLabel: "Agents", icon: { type: "lucide", value: "bot" } },
  { section: "mcp", routePath: "mcp", titleKey: "settings.sections.mcp", fallbackLabel: "MCP", icon: { type: "lucide", value: "boxes" } },
  { section: "skills", routePath: "skills", titleKey: "settings.sections.skills", fallbackLabel: "Skills", icon: { type: "lucide", value: "sparkles" } },
  { section: "sandbox", routePath: "sandbox", titleKey: "settings.sections.sandbox", fallbackLabel: "Sandbox", icon: { type: "lucide", value: "box" } },
  { section: "environment", routePath: "environment", titleKey: "settings.sections.environment", fallbackLabel: "Environment", icon: { type: "lucide", value: "terminal" } },
  { section: "terminalFonts", routePath: "terminalFonts", titleKey: "settings.sections.terminalFonts", fallbackLabel: "Terminal Fonts", icon: { type: "lucide", value: "type" } },
  { section: "overlay", routePath: "overlay", titleKey: "settings.sections.overlay", fallbackLabel: "Overlay", icon: { type: "lucide", value: "layers" } },
  { section: "voice", routePath: "voice", titleKey: "settings.sections.voice", fallbackLabel: "Voice", icon: { type: "lucide", value: "mic" } },
  { section: "storage", routePath: "storage", titleKey: "settings.sections.storage", fallbackLabel: "Storage", icon: { type: "lucide", value: "hard-drive" } },
  { section: "developer", routePath: "developer", titleKey: "settings.sections.developer", fallbackLabel: "Developer", icon: { type: "lucide", value: "bug" } },
  { section: "about", routePath: "about", titleKey: "settings.sections.about", fallbackLabel: "About", icon: { type: "lucide", value: "info" } },
];

export const VALID_SETTINGS_SECTIONS = SETTINGS_SECTION_DESCRIPTORS.map(
  (item) => item.section
);

// ─── Global Route Meta ───────────────────────────────────────────────────────

export const GLOBAL_ROUTE_META: Record<string, { label: string; icon: IconData }> = {
  "/mcp-services/dashboard": { label: "Dashboard", icon: { type: "lucide", value: "layout-dashboard" } },
  "/mcp-services/data-sources": { label: "Data Sources", icon: { type: "lucide", value: "database" } },
  "/mcp-services/search-service": { label: "Search Service", icon: { type: "lucide", value: "search" } },
  "/mcp-services/page-debug": { label: "Page Debug", icon: { type: "lucide", value: "bug" } },
  "/mcp-services/logs": { label: "Logs", icon: { type: "lucide", value: "scroll-text" } },
  "/publish": { label: "Publish", icon: { type: "lucide", value: "upload" } },
  "/my-packages": { label: "My Packages", icon: { type: "lucide", value: "package" } },
  "/analytics": { label: "Analytics", icon: { type: "lucide", value: "chart-column" } },
};

// ─── Default Icons ───────────────────────────────────────────────────────────

export const DEFAULT_BREADCRUMB_ICONS: Record<string, BreadcrumbStackItem["icon"]> = {
  "workspace-root": { type: "lucide", value: "home" },
  "workspace-section": { type: "lucide", value: "panel-left" },
  "workspace-page": { type: "lucide", value: "file-text" },
  "workspace-agent": { type: "lucide", value: "bot" },
  "workspace-executor": { type: "lucide", value: "terminal" },
  "workspace-web": { type: "lucide", value: "globe" },
  "virtual-folder": { type: "lucide", value: "folder" },
  "global-route": { type: "lucide", value: "panel-top" },
};

// ─── Lookup Helpers ──────────────────────────────────────────────────────────

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
    const raw = segments[1] ? decodePathPart(segments[1]) : "general";
    const section = isSettingsSection(raw) ? raw : "general";
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
