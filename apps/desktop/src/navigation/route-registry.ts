// apps/desktop/src/navigation/route-registry.ts
import type { RouteEntry } from "./route-compiler";
import { compileRegistry, matchUrlCompiled, buildUrlCompiled, type CompiledRoute, type RouteMatch } from "./route-compiler";
import type { IconData } from "@/components/ui/icon-picker";
import i18n from "@/i18n";

// ─── Route Definitions ──────────────────────────────────────────────────────

export const ROUTE_ENTRIES: RouteEntry[] = [
  // ─── Top-level ───
  { pattern: "/documents", icon: { type: "lucide", value: "file-text" }, title: "Documents", titleKey: "nav.documents", dropdownCategory: "root" },
  { pattern: "/devices/pair", icon: { type: "lucide", value: "smartphone" }, title: "Devices", titleKey: "nav.devices", dropdownCategory: "root" },
  { pattern: "/workspace", icon: { type: "lucide", value: "home" }, title: "Workspaces", titleKey: "workspace.workspaces", isContainer: true, dropdownCategory: "root" },
  { pattern: "/mcp-services", icon: { type: "lucide", value: "server" }, title: "MCP Services", titleKey: "nav.mcpServices", dropdownCategory: "root" },
  { pattern: "/mcp-services/dashboard", icon: { type: "lucide", value: "layout-dashboard" }, title: "Dashboard", titleKey: "nav.dashboard", dropdownCategory: "mcp-section" },
  { pattern: "/mcp-services/data-sources", icon: { type: "lucide", value: "database" }, title: "Data Sources", titleKey: "nav.dataSources", dropdownCategory: "mcp-section" },
  { pattern: "/mcp-services/search-service", icon: { type: "lucide", value: "search" }, title: "Search Service", titleKey: "nav.searchService", dropdownCategory: "mcp-section" },
  { pattern: "/mcp-services/page-debug", icon: { type: "lucide", value: "bug" }, title: "Page Debug", titleKey: "nav.pageDebug", dropdownCategory: "mcp-section" },
  { pattern: "/mcp-services/logs", icon: { type: "lucide", value: "scroll-text" }, title: "Logs", titleKey: "nav.logs", dropdownCategory: "mcp-section" },
  { pattern: "/publish", icon: { type: "lucide", value: "upload" }, title: "Publish", titleKey: "creator.publish", dropdownCategory: "root" },
  { pattern: "/my-packages", icon: { type: "lucide", value: "package" }, title: "My Packages", titleKey: "creator.myPackages", dropdownCategory: "root" },
  { pattern: "/analytics", icon: { type: "lucide", value: "chart-column" }, title: "Analytics", titleKey: "creator.analytics", dropdownCategory: "root" },

  // ─── Settings ───
  { pattern: "/settings", icon: { type: "lucide", value: "settings" }, title: "Settings", titleKey: "nav.settings", dropdownCategory: "root" },
  { pattern: "/settings/:section", icon: (p) => getSettingsIcon(p.section), title: (p) => getSettingsTitle(p.section), dropdownCategory: "settings" },

  // ─── Workspace ───
  { pattern: "/workspace/:workspaceId", icon: { type: "lucide", value: "home" }, title: (p) => p.workspaceId, dropdownCategory: "workspace" },

  // ─── Workspace Sections ───
  { pattern: "/workspace/:workspaceId/pages", icon: { type: "lucide", value: "layout-grid" }, title: "Pages", titleKey: "workspace.sections.pages", dropdownCategory: "workspace-section" },
  { pattern: "/workspace/:workspaceId/chat", icon: { type: "lucide", value: "message-square" }, title: "Chat", titleKey: "workspace.chat", dropdownCategory: "workspace-section" },
  { pattern: "/workspace/:workspaceId/kanban", icon: { type: "lucide", value: "layout-dashboard" }, title: "Kanban", titleKey: "workspace.kanban", dropdownCategory: "workspace-section" },
  { pattern: "/workspace/:workspaceId/cron", icon: { type: "lucide", value: "clock" }, title: "Scheduled Tasks", titleKey: "workspace.scheduledTasks", dropdownCategory: "workspace-section" },
  { pattern: "/workspace/:workspaceId/ideas", icon: { type: "lucide", value: "lightbulb" }, title: "Ideas", titleKey: "workspace.ideas", dropdownCategory: "workspace-section" },
  { pattern: "/workspace/:workspaceId/agent", icon: { type: "lucide", value: "bot" }, title: "Agents", titleKey: "workspace.sections.agents", dropdownCategory: "workspace-section" },
  { pattern: "/workspace/:workspaceId/files", icon: { type: "lucide", value: "folder-open" }, title: "Files", titleKey: "workspace.files", dropdownCategory: "workspace-section" },
  { pattern: "/workspace/:workspaceId/github", icon: { type: "lucide", value: "github" }, title: "GitHub", titleKey: "workspace.github.label", dropdownCategory: "workspace-section" },
  { pattern: "/workspace/:workspaceId/chat-monitor", icon: { type: "lucide", value: "activity" }, title: "Chat Monitor", titleKey: "workspace.chatMonitor", dropdownCategory: "workspace-section" },

  // ─── Workspace Detail ───
  { pattern: "/workspace/:workspaceId/pages/:pageSlug+", icon: { type: "lucide", value: "file-text" }, title: (p) => humanize(p.pageSlug.split("/").pop()!), dropdownCategory: "page" },
  { pattern: "/workspace/:workspaceId/agent/:agentId", icon: { type: "lucide", value: "bot" }, title: (p) => p.agentId, dropdownCategory: "detail" },
  { pattern: "/workspace/:workspaceId/executor/:executorType", icon: { type: "lucide", value: "terminal" }, title: (p) => p.executorType, dropdownCategory: "detail" },
  { pattern: "/workspace/:workspaceId/web", icon: { type: "lucide", value: "globe" }, title: (p) => p.title ?? "Web", queryParams: ["url", "title", "source_page", "web_id"], dropdownCategory: "detail" },

  // ─── Global Detail ───
  { pattern: "/agent/:agentId", icon: { type: "lucide", value: "bot" }, title: (p) => p.agentId, queryParams: ["workspace_path"], dropdownCategory: "detail" },
  { pattern: "/executor/:executorType", icon: { type: "lucide", value: "terminal" }, title: (p) => p.executorType, queryParams: ["workspace_path"], dropdownCategory: "detail" },
  { pattern: "/skill/:skillId", icon: { type: "lucide", value: "sparkles" }, title: (p) => p.skillId, queryParams: ["workspace_path", "agent_id"], dropdownCategory: "detail" },
  { pattern: "/mcp-server/:serverName", icon: { type: "lucide", value: "server" }, title: (p) => p.serverName, queryParams: ["workspace_path", "executor_type"], dropdownCategory: "detail" },
  { pattern: "/subagent/:configId", icon: { type: "lucide", value: "bot" }, title: (p) => p.configId, queryParams: ["workspace_path", "executor_type"], dropdownCategory: "detail" },
  { pattern: "/prompt/:promptId", icon: { type: "lucide", value: "quote" }, title: (p) => p.promptId, queryParams: ["workspace_path", "executor_type"], dropdownCategory: "detail" },
  { pattern: "/command/:commandId", icon: { type: "lucide", value: "square-terminal" }, title: (p) => p.commandId, queryParams: ["workspace_path", "executor_type"], dropdownCategory: "detail" },

  // ─── Standalone pages (not part of breadcrumb hierarchy, but need registry for normalizeUrl) ───
  { pattern: "/os", icon: { type: "lucide", value: "monitor" }, title: "OS", dropdownCategory: "root" },
  { pattern: "/inspector", icon: { type: "lucide", value: "search" }, title: "Inspector", titleKey: "nav.inspector", dropdownCategory: "root" },
  { pattern: "/mcp-marketplace", icon: { type: "lucide", value: "store" }, title: "MCP Marketplace", titleKey: "nav.mcpMarketplace", dropdownCategory: "root" },
  { pattern: "/skills-market", icon: { type: "lucide", value: "sparkles" }, title: "Skills Market", titleKey: "nav.skillsMarket", dropdownCategory: "root" },
  { pattern: "/chat-monitor", icon: { type: "lucide", value: "activity" }, title: "Chat Monitor", titleKey: "workspace.chatMonitor", dropdownCategory: "root" },
  { pattern: "/about", icon: { type: "lucide", value: "info" }, title: "About", titleKey: "nav.about", dropdownCategory: "root" },
];

// NOTE: Legacy paths (/workspace/:workspaceId/apps, /workspace/:workspaceId/page,
// /workspace/:workspaceId/agents) are NOT registered and NOT redirected.
// Stored data with these paths is dropped during persist migration.
// App.tsx simply removes these old route definitions.

// ─── Compiled Registry (singleton) ──────────────────────────────────────────

const compiled: CompiledRoute[] = compileRegistry(ROUTE_ENTRIES);
const compiledByPattern = new Map(compiled.map((r) => [r.pattern, r]));

export const registry = {
  match(url: string): RouteMatch | null {
    return matchUrlCompiled(url, compiled);
  },

  build(pattern: string, params: Record<string, string> = {}): string {
    return buildUrlCompiled(pattern, params, compiled);
  },

  getEntry(pattern: string): RouteEntry | undefined {
    return compiledByPattern.get(pattern)?.entry;
  },

  hasEntry(pattern: string): boolean {
    return compiledByPattern.has(pattern);
  },

  getRestParam(pattern: string): string | null {
    return compiledByPattern.get(pattern)?.restParam ?? null;
  },

  getParamNames(pattern: string): string[] {
    return compiledByPattern.get(pattern)?.paramNames ?? [];
  },

  getByCategory(category: string): RouteEntry[] {
    return compiled.filter((r) => r.entry.dropdownCategory === category).map((r) => r.entry);
  },

  getIcon(pattern: string, params: Record<string, string> = {}): IconData | undefined {
    const entry = compiledByPattern.get(pattern)?.entry;
    if (!entry) return undefined;
    return typeof entry.icon === "function" ? entry.icon(params) : entry.icon;
  },

  normalizeUrl(url: string): string {
    const match = this.match(url);
    if (!match) {
      const { pathname } = new URL(url, "http://localhost");
      return pathname;
    }
    return this.build(match.pattern, match.params);
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export function humanize(slug: string): string {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getSettingsIcon(section: string): IconData {
  return SETTINGS_ICON_MAP[section] ?? { type: "lucide", value: "settings" };
}

function getSettingsTitle(section: string): string {
  const key = SETTINGS_TITLE_KEY_MAP[section];
  if (key) return i18n.t(key, { defaultValue: humanize(section) });
  return humanize(section);
}

const SETTINGS_TITLE_KEY_MAP: Record<string, string> = {
  general: "settings.sections.general",
  account: "settings.sections.account",
  shortcuts: "settings.sections.shortcuts",
  notifications: "settings.sections.notifications",
  gateway: "settings.sections.gateway",
  channels: "settings.sections.channels",
  executors: "settings.sections.executors",
  model: "settings.sections.model",
  agents: "settings.sections.agents",
  mcp: "settings.sections.mcp",
  skills: "settings.sections.skills",
  sandbox: "settings.sections.sandbox",
  environment: "settings.sections.environment",
  terminalFonts: "settings.sections.terminalFonts",
  overlay: "settings.sections.overlay",
  voice: "settings.sections.voice",
  storage: "settings.sections.storage",
  developer: "settings.sections.developer",
  about: "settings.sections.about",
};

const SETTINGS_ICON_MAP: Record<string, IconData> = {
  general: { type: "lucide", value: "settings" },
  account: { type: "lucide", value: "user" },
  shortcuts: { type: "lucide", value: "keyboard" },
  notifications: { type: "lucide", value: "bell" },
  gateway: { type: "lucide", value: "network" },
  channels: { type: "lucide", value: "message-square" },
  executors: { type: "lucide", value: "play" },
  model: { type: "lucide", value: "cpu" },
  agents: { type: "lucide", value: "bot" },
  mcp: { type: "lucide", value: "boxes" },
  skills: { type: "lucide", value: "sparkles" },
  sandbox: { type: "lucide", value: "box" },
  environment: { type: "lucide", value: "terminal" },
  terminalFonts: { type: "lucide", value: "type" },
  overlay: { type: "lucide", value: "layers" },
  voice: { type: "lucide", value: "mic" },
  storage: { type: "lucide", value: "hard-drive" },
  developer: { type: "lucide", value: "bug" },
  about: { type: "lucide", value: "info" },
};

export type { RouteEntry, RouteMatch, CompiledRoute };
