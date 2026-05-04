import i18n from "@/i18n";
import type { PageConfig } from "@/hooks/use-pages";
import type { PageTreeNode } from "./page-tree";
import {
  resolveNavigationState,
  type BreadcrumbNodeDescriptor,
} from "@/navigation/navigation-state";

function createWorkspacePagesIndexDescriptor(
  workspaceId: string
): BreadcrumbNodeDescriptor {
  return {
    id: `${workspaceId}:pages`,
    kind: "virtual-folder",
    label: i18n.t("page.pages", "Apps"),
    icon: { type: "lucide", value: "layout-grid" },
    meta: { workspaceId },
    location: {
      kind: "workspace-home",
      workspaceId,
    },
  };
}

function createWorkspaceRootDescriptor(
  workspaceId: string
): BreadcrumbNodeDescriptor {
  return {
    id: `workspace:${workspaceId}`,
    kind: "workspace-root",
    label: workspaceId,
    meta: { workspaceId },
    location: {
      kind: "workspace-home",
      workspaceId,
    },
  };
}

function resolveWorkspacePage(
  pages: PageConfig[] | undefined,
  pageOrSlug: PageConfig | string
): PageConfig {
  if (typeof pageOrSlug !== "string") {
    return pageOrSlug;
  }

  return pages?.find((item) => item.slug === pageOrSlug) ?? {
    slug: pageOrSlug,
    name: pageOrSlug.split("/").filter(Boolean).pop() ?? pageOrSlug,
    permission: ["read"],
    path: pageOrSlug,
    type: "markdown",
  };
}

function buildWorkspacePagePathDescriptors(
  workspaceId: string,
  pages: PageConfig[] | undefined,
  page: PageConfig
): BreadcrumbNodeDescriptor[] {
  const segments = page.slug.split("/").filter(Boolean);

  return segments.map((segment, index) => {
    const slugAtDepth = segments.slice(0, index + 1).join("/");
    const isLeaf = index === segments.length - 1;
    const matchedPage = isLeaf
      ? page
      : pages?.find((item) => item.slug === slugAtDepth);

    return {
      id: `${workspaceId}:page:${slugAtDepth}`,
      kind: "workspace-page",
      label: matchedPage?.name ?? segment,
      icon: matchedPage?.icon,
      meta: {
        workspaceId,
        pageSlug: slugAtDepth,
      },
      location: {
        kind: "workspace-page",
        workspaceId,
        pageSlug: slugAtDepth,
      },
    };
  });
}

function buildWorkspacePageTreeDescriptors(
  workspaceId: string,
  path: PageTreeNode[]
): BreadcrumbNodeDescriptor[] {
  return path.map((item) => ({
    id: `${workspaceId}:page:${item.page.slug}`,
    kind: "workspace-page",
    label: item.page.name,
    icon: item.page.icon,
    meta: {
      workspaceId,
      pageSlug: item.page.slug,
    },
    location: {
      kind: "workspace-page",
      workspaceId,
      pageSlug: item.page.slug,
    },
  }));
}

export function resolveWorkspacePageNavigationState(
  workspaceId: string,
  pages: PageConfig[] | undefined,
  pageOrSlug: PageConfig | string
){
  const page = resolveWorkspacePage(pages, pageOrSlug);

  return resolveNavigationState(page, [
    createWorkspaceRootDescriptor(workspaceId),
    createWorkspacePagesIndexDescriptor(workspaceId),
    ...buildWorkspacePagePathDescriptors(workspaceId, pages, page),
  ]);
}

export function resolveWorkspacePageTreeNavigationState(
  workspaceId: string,
  ancestors: PageTreeNode[],
  node: PageTreeNode
){
  const path = [...ancestors, node];

  return resolveNavigationState(node.page, [
    createWorkspaceRootDescriptor(workspaceId),
    createWorkspacePagesIndexDescriptor(workspaceId),
    ...buildWorkspacePageTreeDescriptors(workspaceId, path),
  ]);
}
