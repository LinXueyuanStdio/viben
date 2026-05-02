import type { IconData } from "@/components/ui/icon-picker";
import i18n from "@/i18n";
import type { VirtualPageIndexNode, WorkspaceSection } from "./view-target";

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
  {
    section: "chat",
    routePath: "chat",
    titleKey: "workspace.chat",
    fallbackLabel: "Chat",
    icon: { type: "lucide", value: "message-square" },
    nodeKind: "workspace-section",
  },
  {
    section: "kanban",
    routePath: "kanban",
    titleKey: "workspace.kanban",
    fallbackLabel: "Kanban",
    icon: { type: "lucide", value: "layout-dashboard" },
    nodeKind: "workspace-section",
  },
  {
    section: "cron",
    routePath: "cron",
    titleKey: "workspace.scheduledTasks",
    fallbackLabel: "Scheduled Tasks",
    icon: { type: "lucide", value: "clock" },
    nodeKind: "workspace-section",
  },
  {
    section: "ideas",
    routePath: "ideas",
    titleKey: "workspace.ideas",
    fallbackLabel: "Ideas",
    icon: { type: "lucide", value: "lightbulb" },
    nodeKind: "workspace-section",
  },
  {
    section: "agent",
    routePath: "agent",
    titleKey: "workspace.sections.agents",
    fallbackLabel: "Agents",
    icon: { type: "lucide", value: "bot" },
    nodeKind: "workspace-section",
  },
  {
    section: "files",
    routePath: "files",
    titleKey: "workspace.files",
    fallbackLabel: "Files",
    icon: { type: "lucide", value: "folder-open" },
    nodeKind: "workspace-section",
  },
  {
    section: "github",
    routePath: "github",
    titleKey: "workspace.github.label",
    fallbackLabel: "GitHub",
    icon: { type: "lucide", value: "github" },
    nodeKind: "workspace-section",
  },
  {
    section: "chat-monitor",
    routePath: "chat-monitor",
    titleKey: "workspace.chatMonitor",
    fallbackLabel: "Chat Monitor",
    icon: { type: "lucide", value: "activity" },
    nodeKind: "workspace-section",
  },
];

export const SETTINGS_SECTION_DESCRIPTORS: SettingsSectionDescriptor[] = [
  {
    section: "general",
    routePath: "general",
    titleKey: "settings.sections.general",
    fallbackLabel: "General",
    icon: { type: "lucide", value: "settings" },
  },
  {
    section: "account",
    routePath: "account",
    titleKey: "settings.sections.account",
    fallbackLabel: "Account",
    icon: { type: "lucide", value: "user" },
  },
  {
    section: "shortcuts",
    routePath: "shortcuts",
    titleKey: "settings.sections.shortcuts",
    fallbackLabel: "Shortcuts",
    icon: { type: "lucide", value: "keyboard" },
  },
  {
    section: "notifications",
    routePath: "notifications",
    titleKey: "settings.sections.notifications",
    fallbackLabel: "Notifications",
    icon: { type: "lucide", value: "bell" },
  },
  {
    section: "gateway",
    routePath: "gateway",
    titleKey: "settings.sections.gateway",
    fallbackLabel: "Gateway",
    icon: { type: "lucide", value: "network" },
  },
  {
    section: "channels",
    routePath: "channels",
    titleKey: "settings.sections.channels",
    fallbackLabel: "Channels",
    icon: { type: "lucide", value: "message-square" },
  },
  {
    section: "executors",
    routePath: "executors",
    titleKey: "settings.sections.executors",
    fallbackLabel: "Executors",
    icon: { type: "lucide", value: "play" },
  },
  {
    section: "model",
    routePath: "model",
    titleKey: "settings.sections.model",
    fallbackLabel: "Model",
    icon: { type: "lucide", value: "cpu" },
  },
  {
    section: "agents",
    routePath: "agents",
    titleKey: "settings.sections.agents",
    fallbackLabel: "Agents",
    icon: { type: "lucide", value: "bot" },
  },
  {
    section: "mcp",
    routePath: "mcp",
    titleKey: "settings.sections.mcp",
    fallbackLabel: "MCP",
    icon: { type: "lucide", value: "boxes" },
  },
  {
    section: "skills",
    routePath: "skills",
    titleKey: "settings.sections.skills",
    fallbackLabel: "Skills",
    icon: { type: "lucide", value: "sparkles" },
  },
  {
    section: "sandbox",
    routePath: "sandbox",
    titleKey: "settings.sections.sandbox",
    fallbackLabel: "Sandbox",
    icon: { type: "lucide", value: "box" },
  },
  {
    section: "environment",
    routePath: "environment",
    titleKey: "settings.sections.environment",
    fallbackLabel: "Environment",
    icon: { type: "lucide", value: "terminal" },
  },
  {
    section: "terminalFonts",
    routePath: "terminalFonts",
    titleKey: "settings.sections.terminalFonts",
    fallbackLabel: "Terminal Fonts",
    icon: { type: "lucide", value: "type" },
  },
  {
    section: "overlay",
    routePath: "overlay",
    titleKey: "settings.sections.overlay",
    fallbackLabel: "Overlay",
    icon: { type: "lucide", value: "layers" },
  },
  {
    section: "voice",
    routePath: "voice",
    titleKey: "settings.sections.voice",
    fallbackLabel: "Voice",
    icon: { type: "lucide", value: "mic" },
  },
  {
    section: "storage",
    routePath: "storage",
    titleKey: "settings.sections.storage",
    fallbackLabel: "Storage",
    icon: { type: "lucide", value: "hard-drive" },
  },
  {
    section: "developer",
    routePath: "developer",
    titleKey: "settings.sections.developer",
    fallbackLabel: "Developer",
    icon: { type: "lucide", value: "bug" },
  },
  {
    section: "about",
    routePath: "about",
    titleKey: "settings.sections.about",
    fallbackLabel: "About",
    icon: { type: "lucide", value: "info" },
  },
];

export const VALID_SETTINGS_SECTIONS = SETTINGS_SECTION_DESCRIPTORS.map(
  (item) => item.section
) as SettingsSection[];

export function getWorkspaceSectionDescriptor(
  section?: string
): WorkspaceSectionDescriptor | undefined {
  return WORKSPACE_SECTION_DESCRIPTORS.find((item) => item.section === section);
}

export function getWorkspaceSectionRoutePath(
  section: WorkspaceSection
): string {
  return getWorkspaceSectionDescriptor(section)?.routePath ?? section;
}

export function isWorkspaceSection(value: string): value is WorkspaceSection {
  return Boolean(getWorkspaceSectionDescriptor(value));
}

export function normalizeWorkspaceSection(value: string): WorkspaceSection {
  if (value === "agents") {
    return "agent";
  }

  if (isWorkspaceSection(value)) {
    return value;
  }

  return "chat";
}

export function getSettingsSectionDescriptor(
  section?: string
): SettingsSectionDescriptor | undefined {
  return SETTINGS_SECTION_DESCRIPTORS.find((item) => item.section === section);
}

export function isSettingsSection(value: string): value is SettingsSection {
  return Boolean(getSettingsSectionDescriptor(value));
}

export function getSettingsSectionLabel(section?: string): string {
  const descriptor = getSettingsSectionDescriptor(section);
  if (!descriptor) {
    return i18n.t("settings.title", "Settings");
  }

  return i18n.t(descriptor.titleKey, descriptor.fallbackLabel);
}

export function getSettingsSectionIcon(
  section?: string
): IconData {
  return (
    getSettingsSectionDescriptor(section)?.icon ?? {
      type: "lucide",
      value: "settings",
    }
  );
}

export function getWorkspaceSectionLabel(section?: WorkspaceSection): string {
  const descriptor = getWorkspaceSectionDescriptor(section);
  if (!descriptor) {
    return "";
  }

  return i18n.t(descriptor.titleKey, descriptor.fallbackLabel);
}
