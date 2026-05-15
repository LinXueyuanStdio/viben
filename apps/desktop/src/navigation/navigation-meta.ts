import type { IconData } from "@/components/ui/icon-picker";
import i18n from "@/i18n";
import { registry } from "./route-registry";

// ─── Section Types ───────────────────────────────────────────────────────────

export type WorkspaceSection =
  | "pages"
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

// ─── Section Info Types ──────────────────────────────────────────────────────

export interface WorkspaceSectionInfo {
  section: WorkspaceSection;
  icon: IconData;
  titleKey: string;
  fallbackLabel: string;
}

export interface SettingsSectionInfo {
  section: SettingsSection;
  icon: IconData;
  titleKey: string;
  fallbackLabel: string;
}

// ─── VirtualPageIndexNode ────────────────────────────────────────────────────

export interface VirtualPageIndexNode {
  id: string;
  /** References a descriptor id in the route registry */
  descriptorId: string;
  label: string;
  icon?: IconData;
  parentId?: string;
  order: number;
  isContainer?: boolean;
  href?: string;
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

// ─── PushPageOptions ─────────────────────────────────────────────────────────

export interface PushPageOptions {
  mode?: "push" | "replace";
  preserveTail?: boolean;
}

// ─── Workspace Sections Data ─────────────────────────────────────────────────

export const WORKSPACE_SECTIONS: WorkspaceSectionInfo[] = [
  { section: "pages", icon: { type: "lucide", value: "layout-grid" }, titleKey: "page.pages", fallbackLabel: "Pages" },
  { section: "chat", icon: { type: "lucide", value: "message-square" }, titleKey: "workspace.chat", fallbackLabel: "Chat" },
  { section: "kanban", icon: { type: "lucide", value: "layout-dashboard" }, titleKey: "workspace.kanban", fallbackLabel: "Kanban" },
  { section: "cron", icon: { type: "lucide", value: "clock" }, titleKey: "workspace.scheduledTasks", fallbackLabel: "Scheduled Tasks" },
  { section: "ideas", icon: { type: "lucide", value: "lightbulb" }, titleKey: "workspace.ideas", fallbackLabel: "Ideas" },
  { section: "agent", icon: { type: "lucide", value: "bot" }, titleKey: "workspace.sections.agents", fallbackLabel: "Agents" },
  { section: "files", icon: { type: "lucide", value: "folder-open" }, titleKey: "workspace.files", fallbackLabel: "Files" },
  { section: "github", icon: { type: "lucide", value: "github" }, titleKey: "workspace.github.label", fallbackLabel: "GitHub" },
  { section: "chat-monitor", icon: { type: "lucide", value: "activity" }, titleKey: "workspace.chatMonitor", fallbackLabel: "Chat Monitor" },
];

const WORKSPACE_SECTION_MAP = new Map<string, WorkspaceSectionInfo>(
  WORKSPACE_SECTIONS.map((info) => [info.section, info])
);

// ─── Settings Sections Data ──────────────────────────────────────────────────

export const SETTINGS_SECTIONS: SettingsSectionInfo[] = [
  { section: "general", icon: { type: "lucide", value: "settings" }, titleKey: "settings.sections.general", fallbackLabel: "General" },
  { section: "account", icon: { type: "lucide", value: "user" }, titleKey: "settings.sections.account", fallbackLabel: "Account" },
  { section: "shortcuts", icon: { type: "lucide", value: "keyboard" }, titleKey: "settings.sections.shortcuts", fallbackLabel: "Shortcuts" },
  { section: "notifications", icon: { type: "lucide", value: "bell" }, titleKey: "settings.sections.notifications", fallbackLabel: "Notifications" },
  { section: "gateway", icon: { type: "lucide", value: "network" }, titleKey: "settings.sections.gateway", fallbackLabel: "Gateway" },
  { section: "channels", icon: { type: "lucide", value: "message-square" }, titleKey: "settings.sections.channels", fallbackLabel: "Channels" },
  { section: "executors", icon: { type: "lucide", value: "play" }, titleKey: "settings.sections.executors", fallbackLabel: "Executors" },
  { section: "model", icon: { type: "lucide", value: "cpu" }, titleKey: "settings.sections.model", fallbackLabel: "Model" },
  { section: "agents", icon: { type: "lucide", value: "bot" }, titleKey: "settings.sections.agents", fallbackLabel: "Agents" },
  { section: "mcp", icon: { type: "lucide", value: "boxes" }, titleKey: "settings.sections.mcp", fallbackLabel: "MCP" },
  { section: "skills", icon: { type: "lucide", value: "sparkles" }, titleKey: "settings.sections.skills", fallbackLabel: "Skills" },
  { section: "sandbox", icon: { type: "lucide", value: "box" }, titleKey: "settings.sections.sandbox", fallbackLabel: "Sandbox" },
  { section: "environment", icon: { type: "lucide", value: "terminal" }, titleKey: "settings.sections.environment", fallbackLabel: "Environment" },
  { section: "terminalFonts", icon: { type: "lucide", value: "type" }, titleKey: "settings.sections.terminalFonts", fallbackLabel: "Terminal Fonts" },
  { section: "overlay", icon: { type: "lucide", value: "layers" }, titleKey: "settings.sections.overlay", fallbackLabel: "Overlay" },
  { section: "voice", icon: { type: "lucide", value: "mic" }, titleKey: "settings.sections.voice", fallbackLabel: "Voice" },
  { section: "storage", icon: { type: "lucide", value: "hard-drive" }, titleKey: "settings.sections.storage", fallbackLabel: "Storage" },
  { section: "developer", icon: { type: "lucide", value: "bug" }, titleKey: "settings.sections.developer", fallbackLabel: "Developer" },
  { section: "about", icon: { type: "lucide", value: "info" }, titleKey: "settings.sections.about", fallbackLabel: "About" },
];

const SETTINGS_SECTION_MAP = new Map<string, SettingsSectionInfo>(
  SETTINGS_SECTIONS.map((info) => [info.section, info])
);

export const VALID_SETTINGS_SECTIONS: SettingsSection[] = SETTINGS_SECTIONS.map(
  (info) => info.section
);

// ─── Descriptor Lookup Functions ─────────────────────────────────────────────

export function getWorkspaceSectionDescriptor(section?: string): WorkspaceSectionInfo | undefined {
  if (!section) return undefined;
  return WORKSPACE_SECTION_MAP.get(section);
}

export function getSettingsSectionDescriptor(section?: string): SettingsSectionInfo | undefined {
  if (!section) return undefined;
  return SETTINGS_SECTION_MAP.get(section);
}

// ─── Normalization Functions ─────────────────────────────────────────────────

function isWorkspaceSection(value: string): value is WorkspaceSection {
  return WORKSPACE_SECTION_MAP.has(value);
}

function isSettingsSection(value: string): value is SettingsSection {
  return SETTINGS_SECTION_MAP.has(value);
}

export function normalizeWorkspaceSection(value: string): WorkspaceSection {
  if (value === "agents") return "agent";
  if (value === "apps") return "pages";
  if (isWorkspaceSection(value)) return value;
  return "chat";
}

export function normalizeSettingsSection(value?: string | null): SettingsSection {
  if (!value) return "general";
  return isSettingsSection(value) ? value : "general";
}

// ─── Label / Icon Helpers ────────────────────────────────────────────────────

export function getSettingsSectionLabel(section?: string): string {
  const info = getSettingsSectionDescriptor(section);
  if (!info) return i18n.t("settings.title", "Settings");
  return i18n.t(info.titleKey, info.fallbackLabel);
}

export function getSettingsSectionIcon(section?: string): IconData {
  return getSettingsSectionDescriptor(section)?.icon ?? { type: "lucide", value: "settings" };
}

export function getWorkspaceSectionLabel(section?: WorkspaceSection): string {
  const info = getWorkspaceSectionDescriptor(section);
  if (!info) return "";
  return i18n.t(info.titleKey, info.fallbackLabel);
}

export function getWorkspaceSectionRoutePath(section: WorkspaceSection): string {
  return section;
}

/** Resolve icon for an item by looking up via route-registry */
export function getDescriptorIcon(descriptorId: string | undefined): IconData | undefined {
  if (!descriptorId) return undefined;
  // Try route-registry pattern lookup
  const icon = registry.getIcon(descriptorId);
  if (icon) return icon;
  // Fallback: check workspace/settings section maps by legacy descriptor id format
  if (descriptorId.startsWith("workspace-section:")) {
    const section = descriptorId.slice("workspace-section:".length);
    return WORKSPACE_SECTION_MAP.get(section)?.icon;
  }
  if (descriptorId.startsWith("settings:")) {
    const section = descriptorId.slice("settings:".length);
    return SETTINGS_SECTION_MAP.get(section)?.icon;
  }
  return undefined;
}
