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
    descriptorId: "virtual-folder",
    label: i18n.t("page.pages", "Pages"),
    href: `/workspace/${encodeURIComponent(workspaceId)}/page`,
    icon: { type: "lucide", value: "layout-grid" },
    meta: { workspaceId },
  };
}

function createWorkspaceRootDescriptor(
  workspaceId: string
): BreadcrumbNodeDescriptor {
  return {
    id: `workspace:${workspaceId}`,
    descriptorId: "workspace",
    label: workspaceId,
    href: `/workspace/${encodeURIComponent(workspaceId)}`,
    meta: { workspaceId },
  };
}

function resolveWorkspacePage(
  pages: PageConfig[] | undefined,
  pageOrUid: PageConfig | string
): PageConfig {
  if (typeof pageOrUid !== "string") {
    return pageOrUid;
  }

  return pages?.find((item) => item.uid === pageOrUid) ?? {
    uid: pageOrUid,
    name: pageOrUid,
    permission: ["read"],
    path: pageOrUid,
    type: "markdown",
  };
}

/**
 * Build a single breadcrumb descriptor for a page.
 * With flat uids, we no longer have nested paths - just "Root > Page"
 */
function buildWorkspacePageDescriptor(
  workspaceId: string,
  page: PageConfig
): BreadcrumbNodeDescriptor {
  return {
    id: `${workspaceId}:page:${page.uid}`,
    descriptorId: "workspace-page",
    label: page.name,
    href: `/workspace/${encodeURIComponent(workspaceId)}/page/${page.uid}`,
    icon: page.icon,
    meta: {
      workspaceId,
      pageUid: page.uid,
    },
  };
}

function buildWorkspacePageTreeDescriptors(
  workspaceId: string,
  path: PageTreeNode[]
): BreadcrumbNodeDescriptor[] {
  return path.map((item) => ({
    id: `${workspaceId}:page:${item.page.uid}`,
    descriptorId: "workspace-page",
    label: item.page.name,
    href: `/workspace/${encodeURIComponent(workspaceId)}/page/${item.page.uid}`,
    icon: item.page.icon,
    meta: {
      workspaceId,
      pageUid: item.page.uid,
    },
  }));
}

export function resolveWorkspacePageNavigationState(
  workspaceId: string,
  pages: PageConfig[] | undefined,
  pageOrUid: PageConfig | string
){
  const page = resolveWorkspacePage(pages, pageOrUid);

  return resolveNavigationState(page, [
    createWorkspaceRootDescriptor(workspaceId),
    createWorkspacePagesIndexDescriptor(workspaceId),
    buildWorkspacePageDescriptor(workspaceId, page),
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
