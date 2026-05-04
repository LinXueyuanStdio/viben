import type { IconData } from "@/components/ui/icon-picker";
import i18n from "@/i18n";
import type { PageConfig } from "@/hooks/use-pages";
import type { Workspace } from "@/types";
import {
  createBreadcrumbItem,
  createLocationBreadcrumbItem,
  createStackForLocation,
} from "./breadcrumb-stack";
import type { DesktopLocation } from "./location";
import type { BreadcrumbStackItem } from "./view-target";

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
    kind: "workspace-root",
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
    kind: "virtual-folder",
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
        kind: "workspace-page",
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
      kind: "workspace-web",
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
        kind: "workspace-section",
        meta: { workspaceId: location.workspaceId },
      }
    ),
    createLocationBreadcrumbItem(location, {
      id: `${location.workspaceId}:agent:${location.agentId}`,
      kind: "workspace-agent",
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
        kind: "workspace-section",
        meta: { workspaceId: location.workspaceId },
      }
    ),
    createLocationBreadcrumbItem(location, {
      id: `${location.workspaceId}:executor:${location.executorType}`,
      kind: "workspace-executor",
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
  let kind: BreadcrumbStackItem["kind"] = "workspace-page";
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
      kind,
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

  const patchedStack = patchStackLeaf(breadcrumbStack, {
    title: input.title,
    icon: input.icon,
  });

  return {
    breadcrumbStack: patchedStack,
    leaf: patchedStack[patchedStack.length - 1],
  };
}
