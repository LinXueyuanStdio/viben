import type { IconData } from "@/components/ui/icon-picker";
import i18n from "@/i18n";
import type { PageConfig } from "@/hooks/use-pages";
import type { Workspace } from "@/types";
import {
  createBreadcrumbItem,
  createLocationBreadcrumbItem,
} from "./breadcrumb-stack";
import {
  type DesktopLocation,
  type BreadcrumbStackItem,
  GLOBAL_ROUTE_META,
  getSettingsSectionIcon,
  getSettingsSectionLabel,
  getWorkspaceSectionDescriptor,
  getWorkspaceSectionLabel,
} from "./navigation-meta";

// ─── Internal Helpers ────────────────────────────────────────────────────────

function humanizeSlugSegment(value: string): string {
  const raw = value.split("/").filter(Boolean).pop() ?? value;
  return raw
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getSystemLocationLabel(location: DesktopLocation): string | undefined {
  switch (location.kind) {
    case "workspace-apps":
      return i18n.t("page.pages", "Apps");
    case "workspace-section":
      return getWorkspaceSectionLabel(location.section) || location.section;
    case "settings":
      return location.section
        ? getSettingsSectionLabel(location.section)
        : getSettingsSectionLabel();
    case "documents":
      return "Documents";
    case "device-pair":
      return "Devices";
    case "global-route": {
      const normalizedPath =
        location.path.split("?")[0]?.split("#")[0] ?? location.path;
      return GLOBAL_ROUTE_META[normalizedPath]?.label;
    }
    default:
      return undefined;
  }
}

function getSystemLocationIcon(location: DesktopLocation): IconData | undefined {
  switch (location.kind) {
    case "workspace-apps":
      return { type: "lucide", value: "layout-grid" };
    case "workspace-section":
      return getWorkspaceSectionDescriptor(location.section)?.icon;
    case "settings":
      return location.section
        ? getSettingsSectionIcon(location.section)
        : { type: "lucide", value: "settings" };
    case "documents":
      return { type: "lucide", value: "file-text" };
    case "device-pair":
      return { type: "lucide", value: "smartphone" };
    case "global-route": {
      const normalizedPath =
        location.path.split("?")[0]?.split("#")[0] ?? location.path;
      return GLOBAL_ROUTE_META[normalizedPath]?.icon;
    }
    default:
      return undefined;
  }
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
        descriptorId: "workspace-page",
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
    descriptorId: "virtual-folder",
    label: i18n.t("page.pages", "Apps"),
    icon: { type: "lucide", value: "layout-grid" },
    meta: {
      workspaceId,
    },
    location: {
      kind: "workspace-apps",
      workspaceId,
    },
  });
}

// ─── createStackForLocation ──────────────────────────────────────────────────

export function createStackForLocation(
  location: DesktopLocation,
  title?: string,
  icon?: IconData
): BreadcrumbStackItem[] {
  const resolvedTitle = getSystemLocationLabel(location) ?? title;
  const resolvedIcon = getSystemLocationIcon(location) ?? icon;
  const agentSection = getWorkspaceSectionDescriptor("agent");
  const root = createBreadcrumbItem({
    id: `workspace:${"workspaceId" in location ? location.workspaceId : "global"}`,
    descriptorId: "workspace",
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
    case "workspace-apps":
      return [root, createWorkspacePagesRootItem(location.workspaceId)];
    case "workspace-section":
      return [
        root,
        createBreadcrumbItem({
          id: `${location.workspaceId}:${location.section}`,
          descriptorId: `workspace-section:${location.section}`,
          label:
            resolvedTitle ??
            getWorkspaceSectionLabel(location.section) ??
            location.section,
          icon:
            resolvedIcon ??
            getWorkspaceSectionDescriptor(location.section)?.icon,
          meta: {
            workspaceId: location.workspaceId,
            section: location.section,
            routePath: getWorkspaceSectionDescriptor(location.section)?.routePath,
          },
          location,
        }),
      ];
    case "workspace-agent-detail":
      return [
        root,
        createBreadcrumbItem({
          id: `${location.workspaceId}:agent`,
          descriptorId: "workspace-section:agent",
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
          descriptorId: "workspace-agent",
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
          descriptorId: "workspace-section:agent",
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
          descriptorId: "workspace-executor",
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
          descriptorId: "workspace-web",
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
          descriptorId: "virtual-folder",
          label: getSettingsSectionLabel("agents"),
          icon: getSettingsSectionIcon("agents"),
          location: { kind: "settings", section: "agents" },
        }),
        createBreadcrumbItem({
          id: `agent:${location.agentId}`,
          descriptorId: "workspace-agent",
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
          descriptorId: "virtual-folder",
          label: getSettingsSectionLabel("executors"),
          icon: getSettingsSectionIcon("executors"),
          location: { kind: "settings", section: "executors" },
        }),
        createBreadcrumbItem({
          id: `executor:${location.executorType}`,
          descriptorId: "workspace-executor",
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
          descriptorId: "workspace-executor",
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
          descriptorId: "workspace-page",
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
          descriptorId: "workspace-executor",
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
          descriptorId: "workspace-page",
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
          descriptorId: "workspace-executor",
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
          descriptorId: "workspace-agent",
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
          descriptorId: "workspace-executor",
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
          descriptorId: "workspace-page",
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
          descriptorId: "workspace-executor",
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
          descriptorId: "workspace-page",
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
          descriptorId: "settings",
          label: getSettingsSectionLabel(),
          icon: { type: "lucide", value: "settings" },
          location: { kind: "settings" },
        }),
        ...(location.section
          ? [
              createBreadcrumbItem({
                id: `settings:${location.section}`,
                descriptorId: `settings:${location.section}`,
                label: resolvedTitle ?? getSettingsSectionLabel(location.section),
                icon: resolvedIcon ?? getSettingsSectionIcon(location.section),
                location,
              }),
            ]
          : []),
      ];
    case "documents":
      return [
        createBreadcrumbItem({
          id: "documents",
          descriptorId: "virtual-folder",
          label: resolvedTitle ?? "Documents",
          icon: resolvedIcon,
          location,
        }),
      ];
    case "device-pair":
      return [
        createBreadcrumbItem({
          id: "device-pair",
          descriptorId: "virtual-folder",
          label: resolvedTitle ?? "Devices",
          icon: resolvedIcon,
          location,
        }),
      ];
    case "global-route":
      const normalizedPath = location.path.split("?")[0]?.split("#")[0] ?? location.path;
      const routeMeta = GLOBAL_ROUTE_META[normalizedPath];
      return [
        createBreadcrumbItem({
          id: `global:${location.path}`,
          descriptorId: `settings:${normalizedPath.replace(/^\//, "")}`,
          label:
            resolvedTitle ??
            routeMeta?.label ??
            normalizedPath.replace(/^\//, ""),
          icon: resolvedIcon ?? routeMeta?.icon,
          location,
        }),
      ];
    default: {
      const exhaustive: never = location;
      return exhaustive;
    }
  }
}

// ─── resolveLocationNavigation ───────────────────────────────────────────────

interface ResolveLocationNavigationInput {
  location: DesktopLocation;
  workspace?: Workspace;
  pages?: PageConfig[];
  breadcrumbStack?: BreadcrumbStackItem[];
  title?: string;
  icon?: IconData;
}

interface ResolvedLocationNavigation {
  breadcrumbStack: BreadcrumbStackItem[];
  leaf?: BreadcrumbStackItem;
}

function createWorkspaceRootItem(
  workspaceId: string,
  workspace?: Workspace
): BreadcrumbStackItem {
  return createBreadcrumbItem({
    id: `workspace:${workspaceId}`,
    descriptorId: "workspace",
    label: workspace?.name ?? workspaceId,
    meta: { workspaceId },
    location: {
      kind: "workspace-home",
      workspaceId,
    },
  });
}

function createWorkspacePagesItem(workspaceId: string): BreadcrumbStackItem {
  return createBreadcrumbItem({
    id: `${workspaceId}:pages`,
    descriptorId: "virtual-folder",
    label: i18n.t("page.pages", "Apps"),
    icon: { type: "lucide", value: "layout-grid" },
    meta: { workspaceId },
    location: {
      kind: "workspace-apps",
      workspaceId,
    },
  });
}

function patchStackLeaf(
  stack: BreadcrumbStackItem[],
  patch?: { title?: string; icon?: IconData }
): BreadcrumbStackItem[] {
  if (stack.length === 0 || (!patch?.title && !patch?.icon)) {
    return stack;
  }

  return stack.map((item, index) =>
    index === stack.length - 1
      ? {
          ...item,
          label: patch.title ?? item.label,
          icon: patch.icon ?? item.icon,
        }
      : item
  );
}

function buildWorkspacePageBreadcrumbStack(
  workspaceId: string,
  pageSlug: string,
  pages: PageConfig[] | undefined,
  workspace?: Workspace
): BreadcrumbStackItem[] {
  const pathSlugs = pageSlug
    .split("/")
    .filter(Boolean)
    .map((_, index, segments) => segments.slice(0, index + 1).join("/"));

  const pageItems = pathSlugs.map((slug) => {
    const matchedPage = pages?.find((page) => page.slug === slug);
    const fallbackLabel = slug.split("/").filter(Boolean).pop() ?? slug;

    return createLocationBreadcrumbItem(
      {
        kind: "workspace-page",
        workspaceId,
        pageSlug: slug,
      },
      {
        id: `${workspaceId}:page:${slug}`,
        descriptorId: "workspace-page",
        label: matchedPage?.name ?? fallbackLabel,
        icon: matchedPage?.icon,
        meta: {
          workspaceId,
          pageSlug: slug,
        },
      }
    );
  });

  return [
    createWorkspaceRootItem(workspaceId, workspace),
    createWorkspacePagesItem(workspaceId),
    ...pageItems,
  ];
}

function buildWorkspaceWebBreadcrumbStack(
  location: Extract<DesktopLocation, { kind: "workspace-web" }>,
  pages: PageConfig[] | undefined,
  workspace?: Workspace,
  patch?: { title?: string; icon?: IconData }
): BreadcrumbStackItem[] {
  if (!location.sourcePageSlug) {
    return createStackForLocation(location, patch?.title, patch?.icon);
  }

  const pageStack = buildWorkspacePageBreadcrumbStack(
    location.workspaceId,
    location.sourcePageSlug,
    pages,
    workspace
  );

  return [
    ...pageStack,
    createLocationBreadcrumbItem(location, {
      id: `${location.workspaceId}:web:${location.webId ?? location.url}`,
      descriptorId: "workspace-web",
      label: patch?.title ?? location.title,
      icon: patch?.icon ?? { type: "lucide", value: "globe" },
      meta: {
        workspaceId: location.workspaceId,
        pageSlug: location.sourcePageSlug,
        webId: location.webId,
        url: location.url,
      },
    }),
  ];
}

function buildWorkspaceAgentDetailBreadcrumbStack(
  location: Extract<DesktopLocation, { kind: "workspace-agent-detail" }>,
  workspace?: Workspace,
  patch?: { title?: string; icon?: IconData }
): BreadcrumbStackItem[] {
  return [
    createWorkspaceRootItem(location.workspaceId, workspace),
    createLocationBreadcrumbItem(
      {
        kind: "workspace-section",
        workspaceId: location.workspaceId,
        section: "agent",
      },
      {
        id: `${location.workspaceId}:agent`,
        descriptorId: "workspace-section:agent",
        label: getWorkspaceSectionLabel("agent") || "Agents",
        icon: getWorkspaceSectionDescriptor("agent")?.icon,
        meta: { workspaceId: location.workspaceId, section: "agent" },
      }
    ),
    createLocationBreadcrumbItem(location, {
      id: `${location.workspaceId}:agent:${location.agentId}`,
      descriptorId: "workspace-agent",
      label: patch?.title ?? location.agentId,
      icon: patch?.icon,
      meta: {
        workspaceId: location.workspaceId,
        agentId: location.agentId,
      },
    }),
  ];
}

function buildWorkspaceExecutorDetailBreadcrumbStack(
  location: Extract<DesktopLocation, { kind: "workspace-executor-detail" }>,
  workspace?: Workspace,
  patch?: { title?: string; icon?: IconData }
): BreadcrumbStackItem[] {
  return [
    createWorkspaceRootItem(location.workspaceId, workspace),
    createLocationBreadcrumbItem(
      {
        kind: "workspace-section",
        workspaceId: location.workspaceId,
        section: "agent",
      },
      {
        id: `${location.workspaceId}:agent`,
        descriptorId: "workspace-section:agent",
        label: getWorkspaceSectionLabel("agent") || "Agents",
        icon: getWorkspaceSectionDescriptor("agent")?.icon,
        meta: { workspaceId: location.workspaceId, section: "agent" },
      }
    ),
    createLocationBreadcrumbItem(location, {
      id: `${location.workspaceId}:executor:${location.executorType}`,
      descriptorId: "workspace-executor",
      label: patch?.title ?? location.executorType,
      icon: patch?.icon,
      meta: {
        workspaceId: location.workspaceId,
        executorType: location.executorType,
      },
    }),
  ];
}

function buildExecutorChildBreadcrumbStack(
  location:
    | Extract<DesktopLocation, { kind: "skill-detail" }>
    | Extract<DesktopLocation, { kind: "mcp-server-detail" }>
    | Extract<DesktopLocation, { kind: "subagent-detail" }>
    | Extract<DesktopLocation, { kind: "prompt-detail" }>
    | Extract<DesktopLocation, { kind: "command-detail" }>,
  workspace?: Workspace,
  patch?: { title?: string; icon?: IconData }
): BreadcrumbStackItem[] {
  if (!workspace) {
    return createStackForLocation(location, patch?.title, patch?.icon);
  }

  const base = buildWorkspaceExecutorDetailBreadcrumbStack(
    {
      kind: "workspace-executor-detail",
      workspaceId: workspace.id,
      executorType:
        location.kind === "skill-detail" ? location.agentId : location.executorType,
    },
    workspace
  );

  let id = "";
  let label = patch?.title;
  let descriptorId = "workspace-page";
  let meta: BreadcrumbStackItem["meta"] = {
    workspaceId: workspace.id,
    executorType:
      location.kind === "skill-detail" ? location.agentId : location.executorType,
  };

  switch (location.kind) {
    case "skill-detail":
      id = `workspace:${workspace.id}:skill:${location.skillId}`;
      label = label ?? location.skillId;
      meta = { ...meta, agentId: location.agentId };
      break;
    case "mcp-server-detail":
      id = `workspace:${workspace.id}:mcp:${location.serverName}`;
      label = label ?? location.serverName;
      break;
    case "subagent-detail":
      id = `workspace:${workspace.id}:subagent:${location.configId}`;
      label = label ?? location.configId;
      break;
    case "prompt-detail":
      id = `workspace:${workspace.id}:prompt:${location.promptId}`;
      label = label ?? location.promptId;
      break;
    case "command-detail":
      id = `workspace:${workspace.id}:command:${location.commandId}`;
      label = label ?? location.commandId;
      break;
  }

  return [
    ...base,
    createLocationBreadcrumbItem(location, {
      id,
      descriptorId,
      label,
      icon: patch?.icon,
      meta,
    }),
  ];
}

export function resolveLocationNavigation(
  input: ResolveLocationNavigationInput
): ResolvedLocationNavigation {
  if (input.breadcrumbStack?.length) {
    return {
      breadcrumbStack: input.breadcrumbStack,
      leaf: input.breadcrumbStack[input.breadcrumbStack.length - 1],
    };
  }

  let breadcrumbStack: BreadcrumbStackItem[];

  switch (input.location.kind) {
    case "workspace-apps":
      breadcrumbStack = createStackForLocation(
        input.location,
        input.title,
        input.icon
      );
      break;
    case "workspace-page":
      breadcrumbStack = buildWorkspacePageBreadcrumbStack(
        input.location.workspaceId,
        input.location.pageSlug,
        input.pages,
        input.workspace
      );
      break;
    case "workspace-agent-detail":
      breadcrumbStack = buildWorkspaceAgentDetailBreadcrumbStack(
        input.location,
        input.workspace,
        {
          title: input.title,
          icon: input.icon,
        }
      );
      break;
    case "workspace-executor-detail":
      breadcrumbStack = buildWorkspaceExecutorDetailBreadcrumbStack(
        input.location,
        input.workspace,
        {
          title: input.title,
          icon: input.icon,
        }
      );
      break;
    case "workspace-web":
      breadcrumbStack = buildWorkspaceWebBreadcrumbStack(
        input.location,
        input.pages,
        input.workspace,
        {
          title: input.title,
          icon: input.icon,
        }
      );
      break;
    case "skill-detail":
    case "mcp-server-detail":
    case "subagent-detail":
    case "prompt-detail":
    case "command-detail":
      breadcrumbStack = buildExecutorChildBreadcrumbStack(
        input.location,
        input.workspace,
        {
          title: input.title,
          icon: input.icon,
        }
      );
      break;
    default:
      breadcrumbStack = createStackForLocation(
        input.location,
        input.title,
        input.icon
      );
      break;
  }

  // Patch root item with workspace name if available
  if (input.workspace && breadcrumbStack.length > 0 && breadcrumbStack[0].descriptorId === "workspace") {
    breadcrumbStack = [
      { ...breadcrumbStack[0], label: input.workspace.name ?? breadcrumbStack[0].label },
      ...breadcrumbStack.slice(1),
    ];
  }

  const patchedStack = patchStackLeaf(breadcrumbStack, {
    title: input.title,
    icon: input.icon,
  });

  return {
    breadcrumbStack: patchedStack,
    leaf: patchedStack[patchedStack.length - 1],
  };
}
