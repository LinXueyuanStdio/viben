import type { IconData } from "@/components/ui/icon-picker";
import type { DesktopLocation } from "./location";
import { buildViewTarget, type BreadcrumbStackItem } from "./view-target";
import { locationToUrl } from "./location";
import {
  getSettingsSectionIcon,
  getSettingsSectionLabel,
  getWorkspaceSectionDescriptor,
  getWorkspaceSectionLabel,
} from "./navigation-meta";

const DEFAULT_ICONS: Record<string, BreadcrumbStackItem["icon"]> = {
  "workspace-root": { type: "lucide", value: "home" },
  "workspace-section": { type: "lucide", value: "panel-left" },
  "workspace-page": { type: "lucide", value: "file-text" },
  "workspace-agent": { type: "lucide", value: "bot" },
  "workspace-executor": { type: "lucide", value: "terminal" },
  "workspace-web": { type: "lucide", value: "globe" },
  "virtual-folder": { type: "lucide", value: "folder" },
  "global-route": { type: "lucide", value: "panel-top" },
};

const GLOBAL_ROUTE_META: Record<
  string,
  { label: string; icon: IconData }
> = {
  "/mcp-services/dashboard": {
    label: "Dashboard",
    icon: { type: "lucide", value: "layout-dashboard" },
  },
  "/mcp-services/data-sources": {
    label: "Data Sources",
    icon: { type: "lucide", value: "database" },
  },
  "/mcp-services/search-service": {
    label: "Search Service",
    icon: { type: "lucide", value: "search" },
  },
  "/mcp-services/page-debug": {
    label: "Page Debug",
    icon: { type: "lucide", value: "bug" },
  },
  "/mcp-services/logs": {
    label: "Logs",
    icon: { type: "lucide", value: "scroll-text" },
  },
  "/publish": {
    label: "Publish",
    icon: { type: "lucide", value: "upload" },
  },
  "/my-packages": {
    label: "My Packages",
    icon: { type: "lucide", value: "package" },
  },
  "/analytics": {
    label: "Analytics",
    icon: { type: "lucide", value: "chart-column" },
  },
};

function humanizeSlugSegment(value: string): string {
  const raw = value.split("/").filter(Boolean).pop() ?? value;
  return raw
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function createWorkspacePagePathItems(
  workspaceId: string,
  pageSlug: string,
  leaf?: {
    title?: string;
    icon?: IconData;
  }
): BreadcrumbStackItem[] {
  const segments = pageSlug.split("/").filter(Boolean);
  const items: BreadcrumbStackItem[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    const slugAtDepth = segments.slice(0, index + 1).join("/");
    items.push(
      createBreadcrumbItem({
        id: `${workspaceId}:page:${slugAtDepth}`,
        kind: "workspace-page",
        label:
          index === segments.length - 1 && leaf?.title
            ? leaf.title
            : humanizeSlugSegment(segments[index]),
        icon:
          index === segments.length - 1
            ? leaf?.icon
            : undefined,
        meta: {
          workspaceId,
          pageSlug: slugAtDepth,
        },
        location: {
          kind: "workspace-page",
          workspaceId,
          pageSlug: slugAtDepth,
        },
      })
    );
  }

  return items;
}

function createWorkspacePagesRootItem(
  workspaceId: string
): BreadcrumbStackItem {
  return createBreadcrumbItem({
    id: `${workspaceId}:pages`,
    kind: "virtual-folder",
    label: "Pages",
    icon: { type: "lucide", value: "files" },
    meta: {
      workspaceId,
    },
    location: {
      kind: "workspace-home",
      workspaceId,
    },
  });
}

export function getStackTop(
  stack: BreadcrumbStackItem[]
): BreadcrumbStackItem | undefined {
  return stack[stack.length - 1];
}

export function pushStackItem(
  stack: BreadcrumbStackItem[],
  item: BreadcrumbStackItem
): BreadcrumbStackItem[] {
  return [...stack, item];
}

export function replaceStackTop(
  stack: BreadcrumbStackItem[],
  item: BreadcrumbStackItem
): BreadcrumbStackItem[] {
  if (stack.length === 0) {
    return [item];
  }

  return [...stack.slice(0, -1), item];
}

export function popTo(
  stack: BreadcrumbStackItem[],
  index: number
): BreadcrumbStackItem[] {
  if (stack.length === 0) {
    return stack;
  }

  const normalizedIndex = Math.max(0, Math.min(index, stack.length - 1));
  return stack.slice(0, normalizedIndex + 1);
}

export function createBreadcrumbItem(
  item: Omit<BreadcrumbStackItem, "target"> & {
    location?: DesktopLocation;
  }
): BreadcrumbStackItem {
  return {
    ...item,
    icon: item.icon ?? DEFAULT_ICONS[item.kind],
    target: item.location
      ? buildViewTarget(item.location, locationToUrl(item.location))
      : undefined,
  };
}

export function createStackForLocation(
  location: DesktopLocation,
  title?: string,
  icon?: IconData
): BreadcrumbStackItem[] {
  const agentSection = getWorkspaceSectionDescriptor("agent");
  const root = createBreadcrumbItem({
    id: `workspace:${"workspaceId" in location ? location.workspaceId : "global"}`,
    kind: "workspace-root",
    label: "workspaceId" in location ? location.workspaceId : "Viben",
    meta: "workspaceId" in location
      ? { workspaceId: location.workspaceId }
      : undefined,
    location:
      "workspaceId" in location
        ? { kind: "workspace-home", workspaceId: location.workspaceId }
        : undefined,
  });

  switch (location.kind) {
    case "workspace-home":
      return [root];
    case "workspace-section":
      return [
        root,
        createBreadcrumbItem({
          id: `${location.workspaceId}:${location.section}`,
          kind: "workspace-section",
          label:
            title ??
            getWorkspaceSectionLabel(location.section) ??
            location.section,
          icon:
            icon ??
            getWorkspaceSectionDescriptor(location.section)?.icon,
          meta: {
            workspaceId: location.workspaceId,
          },
          location,
        }),
      ];
    case "workspace-agent-detail":
      return [
        root,
        createBreadcrumbItem({
          id: `${location.workspaceId}:agent`,
          kind: "workspace-section",
          label: getWorkspaceSectionLabel("agent") || agentSection?.fallbackLabel || "Agents",
          icon: agentSection?.icon,
          meta: { workspaceId: location.workspaceId },
          location: {
            kind: "workspace-section",
            workspaceId: location.workspaceId,
            section: "agent",
          },
        }),
        createBreadcrumbItem({
          id: `${location.workspaceId}:agent:${location.agentId}`,
          kind: "workspace-agent",
          label: title ?? location.agentId,
          icon: icon ?? { type: "lucide", value: "bot" },
          meta: {
            workspaceId: location.workspaceId,
            agentId: location.agentId,
          },
          location,
        }),
      ];
    case "workspace-executor-detail":
      return [
        root,
        createBreadcrumbItem({
          id: `${location.workspaceId}:agent`,
          kind: "workspace-section",
          label: getWorkspaceSectionLabel("agent") || agentSection?.fallbackLabel || "Agents",
          icon: agentSection?.icon,
          meta: { workspaceId: location.workspaceId },
          location: {
            kind: "workspace-section",
            workspaceId: location.workspaceId,
            section: "agent",
          },
        }),
        createBreadcrumbItem({
          id: `${location.workspaceId}:executor:${location.executorType}`,
          kind: "workspace-executor",
          label: title ?? location.executorType,
          icon: icon ?? { type: "lucide", value: "terminal" },
          meta: {
            workspaceId: location.workspaceId,
            executorType: location.executorType,
          },
          location,
        }),
      ];
    case "workspace-page":
      return [
        root,
        createWorkspacePagesRootItem(location.workspaceId),
        ...createWorkspacePagePathItems(location.workspaceId, location.pageSlug, {
          title,
          icon,
        }),
      ];
    case "workspace-web":
      return [
        root,
        ...(location.sourcePageSlug
          ? [createWorkspacePagesRootItem(location.workspaceId)]
          : []),
        ...(location.sourcePageSlug
          ? createWorkspacePagePathItems(
              location.workspaceId,
              location.sourcePageSlug
            )
          : []),
        createBreadcrumbItem({
          id: `${location.workspaceId}:web:${location.webId ?? location.url}`,
          kind: "workspace-web",
          label: title ?? location.title,
          icon: icon ?? { type: "lucide", value: "globe" },
          meta: {
            workspaceId: location.workspaceId,
            webId: location.webId,
            pageSlug: location.sourcePageSlug,
            url: location.url,
          },
          location,
        }),
      ];
    case "agent-detail":
      return [
        createBreadcrumbItem({
          id: "settings:agents",
          kind: "virtual-folder",
          label: getSettingsSectionLabel("agents"),
          icon: getSettingsSectionIcon("agents"),
          location: { kind: "settings", section: "agents" },
        }),
        createBreadcrumbItem({
          id: `agent:${location.agentId}`,
          kind: "workspace-agent",
          label: title ?? location.agentId,
          icon: icon ?? { type: "lucide", value: "bot" },
          meta: {
            agentId: location.agentId,
          },
          location,
        }),
      ];
    case "executor-detail":
      return [
        createBreadcrumbItem({
          id: "settings:executors",
          kind: "virtual-folder",
          label: getSettingsSectionLabel("executors"),
          icon: getSettingsSectionIcon("executors"),
          location: { kind: "settings", section: "executors" },
        }),
        createBreadcrumbItem({
          id: `executor:${location.executorType}`,
          kind: "workspace-executor",
          label: title ?? location.executorType,
          icon: icon ?? { type: "lucide", value: "terminal" },
          meta: {
            executorType: location.executorType,
          },
          location,
        }),
      ];
    case "skill-detail":
      return [
        createBreadcrumbItem({
          id: `executor:${location.agentId}`,
          kind: "workspace-executor",
          label: location.agentId,
          icon: { type: "lucide", value: "terminal" },
          location: {
            kind: "executor-detail",
            executorType: location.agentId,
            workspacePath: location.workspacePath,
          },
        }),
        createBreadcrumbItem({
          id: `skill:${location.skillId}`,
          kind: "workspace-page",
          label: title ?? location.skillId,
          icon: icon ?? { type: "lucide", value: "sparkles" },
          meta: {
            agentId: location.agentId,
          },
          location,
        }),
      ];
    case "mcp-server-detail":
      return [
        createBreadcrumbItem({
          id: `executor:${location.executorType}`,
          kind: "workspace-executor",
          label: location.executorType,
          icon: { type: "lucide", value: "terminal" },
          location: {
            kind: "executor-detail",
            executorType: location.executorType,
            workspacePath: location.workspacePath,
          },
        }),
        createBreadcrumbItem({
          id: `mcp:${location.serverName}`,
          kind: "workspace-page",
          label: title ?? location.serverName,
          icon: icon ?? { type: "lucide", value: "server" },
          meta: {
            executorType: location.executorType,
          },
          location,
        }),
      ];
    case "subagent-detail":
      return [
        createBreadcrumbItem({
          id: `executor:${location.executorType}`,
          kind: "workspace-executor",
          label: location.executorType,
          icon: { type: "lucide", value: "terminal" },
          location: {
            kind: "executor-detail",
            executorType: location.executorType,
            workspacePath: location.workspacePath,
          },
        }),
        createBreadcrumbItem({
          id: `subagent:${location.configId}`,
          kind: "workspace-agent",
          label: title ?? location.configId,
          icon: icon ?? { type: "lucide", value: "bot" },
          meta: {
            executorType: location.executorType,
          },
          location,
        }),
      ];
    case "prompt-detail":
      return [
        createBreadcrumbItem({
          id: `executor:${location.executorType}`,
          kind: "workspace-executor",
          label: location.executorType,
          icon: { type: "lucide", value: "terminal" },
          location: {
            kind: "executor-detail",
            executorType: location.executorType,
            workspacePath: location.workspacePath,
          },
        }),
        createBreadcrumbItem({
          id: `prompt:${location.promptId}`,
          kind: "workspace-page",
          label: title ?? location.promptId,
          icon: icon ?? { type: "lucide", value: "quote" },
          meta: {
            executorType: location.executorType,
          },
          location,
        }),
      ];
    case "command-detail":
      return [
        createBreadcrumbItem({
          id: `executor:${location.executorType}`,
          kind: "workspace-executor",
          label: location.executorType,
          icon: { type: "lucide", value: "terminal" },
          location: {
            kind: "executor-detail",
            executorType: location.executorType,
            workspacePath: location.workspacePath,
          },
        }),
        createBreadcrumbItem({
          id: `command:${location.commandId}`,
          kind: "workspace-page",
          label: title ?? location.commandId,
          icon: icon ?? { type: "lucide", value: "square-terminal" },
          meta: {
            executorType: location.executorType,
          },
          location,
        }),
      ];
    case "settings":
      return [
        createBreadcrumbItem({
          id: "settings",
          kind: "virtual-folder",
          label: getSettingsSectionLabel(),
          icon: { type: "lucide", value: "settings" },
          location: { kind: "settings" },
        }),
        ...(location.section
          ? [
              createBreadcrumbItem({
                id: `settings:${location.section}`,
                kind: "global-route",
                label: title ?? getSettingsSectionLabel(location.section),
                icon: icon ?? getSettingsSectionIcon(location.section),
                location,
              }),
            ]
          : []),
      ];
    case "documents":
      return [
        createBreadcrumbItem({
          id: "documents",
          kind: "virtual-folder",
          label: title ?? "Documents",
          location,
        }),
      ];
    case "device-pair":
      return [
        createBreadcrumbItem({
          id: "device-pair",
          kind: "virtual-folder",
          label: title ?? "Devices",
          location,
        }),
      ];
    case "global-route":
      const normalizedPath = location.path.split("?")[0]?.split("#")[0] ?? location.path;
      const routeMeta = GLOBAL_ROUTE_META[normalizedPath];
      return [
        createBreadcrumbItem({
          id: `global:${location.path}`,
          kind: "global-route",
          label: title ?? routeMeta?.label ?? normalizedPath.replace(/^\//, ""),
          icon: icon ?? routeMeta?.icon,
          location,
        }),
      ];
    default: {
      const exhaustive: never = location;
      return exhaustive;
    }
  }
}
