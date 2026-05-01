import type { IconData } from "@/components/ui/icon-picker";
import type {
  BreadcrumbItemKind,
  VirtualPageIndexNode,
  WorkspaceSection,
} from "./view-target";
import {
  getWorkspaceSectionRoutePath,
  WORKSPACE_SECTION_DESCRIPTORS,
} from "./navigation-meta";
export { getWorkspaceSectionDescriptor } from "./navigation-meta";

export type DesktopBreadcrumbSegmentKind =
  | "workspace-root"
  | BreadcrumbItemKind;

export interface DesktopBreadcrumbSegment {
  id?: string;
  label: string;
  href: string;
  path?: string;
  onClick?: () => void;
  icon?: IconData;
  kind?: DesktopBreadcrumbSegmentKind;
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

export interface BreadcrumbDropdownItem {
  id: string;
  label: string;
  href?: string;
  icon?: IconData;
  description?: string;
  onSelect?: () => void;
  isActive?: boolean;
  kind?: DesktopBreadcrumbSegmentKind | "external-web";
  meta?: DesktopBreadcrumbSegment["meta"];
}

export interface WorkspaceListItemLike {
  id: string;
  name: string;
  path?: string;
  type?: string;
}

export interface ResolvePageIndexBranchInput {
  segment: DesktopBreadcrumbSegment;
  workspaceId?: string;
  workspaces?: WorkspaceListItemLike[];
  activeWorkspaceId?: string;
  currentSection?: WorkspaceSection;
  allowGithub?: boolean;
  buildLabel?: (titleKey: string, fallbackLabel: string) => string;
  onSelectWorkspace?: (workspaceId: string) => void;
  onSelectSection?: (
    section: WorkspaceSection,
    routePath: string,
    href: string
  ) => void;
  labelGlobalWorkspace?: string;
}

export function createWorkspaceRootNode(
  workspaceId: string,
  label = "Workspace"
): VirtualPageIndexNode {
  return {
    id: `workspace:${workspaceId}`,
    kind: "workspace-root",
    label,
    icon: { type: "lucide", value: "folder-open" },
    order: 0,
    isContainer: true,
  };
}

export function createStaticWorkspaceIndexNodes(
  workspaceId: string
): VirtualPageIndexNode[] {
  const root = createWorkspaceRootNode(workspaceId);
  const sectionNodes = WORKSPACE_SECTION_DESCRIPTORS.map((section, index) => ({
    id: `${root.id}:${section.section}`,
    kind: section.nodeKind,
    label: section.fallbackLabel,
    icon: section.icon,
    parentId: root.id,
    order: index + 1,
    target: {
      key: `workspace:${workspaceId}:${section.section}`,
      canonicalUrl: `/workspace/${encodeURIComponent(workspaceId)}/${section.routePath}`,
      location: {
        kind: "workspace-section" as const,
        workspaceId,
        section: section.section,
      },
    },
  }));

  return [root, ...sectionNodes];
}

export function inferBreadcrumbSegmentKind(
  segment: DesktopBreadcrumbSegment
): DesktopBreadcrumbSegmentKind | undefined {
  if (segment.kind) {
    return segment.kind;
  }

  if (/^\/workspace\/[^/]+$/.test(segment.href)) {
    return "workspace-root";
  }

  if (/^\/workspace\/[^/]+\/(chat|kanban|cron|ideas|files|github|chat-monitor)$/.test(segment.href)) {
    return "workspace-section";
  }

  if (/^\/workspace\/[^/]+\/(agent|agents)$/.test(segment.href)) {
    return "workspace-section";
  }

  if (/^\/agent\/[^/]+/.test(segment.href)) {
    return "workspace-agent";
  }

  if (/^\/executor\/[^/]+/.test(segment.href)) {
    return "workspace-executor";
  }

  return undefined;
}

export function buildWorkspaceRootDropdownItems({
  workspaces = [],
  activeWorkspaceId,
  currentSection,
  buildLabel,
  onSelectWorkspace,
  labelGlobalWorkspace,
}: {
  workspaces?: WorkspaceListItemLike[];
  activeWorkspaceId?: string;
  currentSection?: WorkspaceSection;
  buildLabel?: (titleKey: string, fallbackLabel: string) => string;
  onSelectWorkspace?: (workspaceId: string) => void;
  labelGlobalWorkspace?: string;
}): BreadcrumbDropdownItem[] {
  const sectionRoutePath = currentSection
    ? getWorkspaceSectionRoutePath(currentSection)
    : "";

  return workspaces.map((workspace) => {
    const workspaceLabel =
      workspace.type === "global"
        ? labelGlobalWorkspace ??
          buildLabel?.("workspace.global", "Global Workspace") ??
          "Global Workspace"
        : workspace.name;
    const href = sectionRoutePath
      ? `/workspace/${encodeURIComponent(workspace.id)}/${sectionRoutePath}`
      : `/workspace/${encodeURIComponent(workspace.id)}`;

    return {
      id: `workspace:${workspace.id}`,
      label: workspaceLabel,
      href,
      description: workspace.path,
      icon: {
        type: "lucide",
        value: workspace.type === "global" ? "globe" : "folder-open",
      },
      isActive: workspace.id === activeWorkspaceId,
      kind: "workspace-root",
      meta: {
        workspaceId: workspace.id,
        section: currentSection,
        routePath: sectionRoutePath || undefined,
      },
      onSelect: onSelectWorkspace
        ? () => onSelectWorkspace(workspace.id)
        : undefined,
    };
  });
}

export function buildWorkspaceSectionDropdownItems({
  workspaceId,
  activeSection,
  buildLabel,
  onSelectSection,
  allowGithub = true,
}: {
  workspaceId: string;
  activeSection?: WorkspaceSection;
  buildLabel?: (titleKey: string, fallbackLabel: string) => string;
  onSelectSection?: (
    section: WorkspaceSection,
    routePath: string,
    href: string
  ) => void;
  allowGithub?: boolean;
}): BreadcrumbDropdownItem[] {
  return WORKSPACE_SECTION_DESCRIPTORS.filter((item) =>
    allowGithub ? true : item.section !== "github"
  ).map((item) => {
    const href = `/workspace/${encodeURIComponent(workspaceId)}/${item.routePath}`;
    return {
      id: `workspace:${workspaceId}:${item.section}`,
      label:
        buildLabel?.(item.titleKey, item.fallbackLabel) ?? item.fallbackLabel,
      href,
      icon: item.icon,
      isActive: item.section === activeSection,
      kind: "workspace-section",
      meta: {
        workspaceId,
        section: item.section,
        routePath: item.routePath,
      },
      onSelect: onSelectSection
        ? () => onSelectSection(item.section, item.routePath, href)
        : undefined,
    };
  });
}

export function resolvePageIndexBranch({
  segment,
  workspaceId,
  workspaces,
  activeWorkspaceId,
  currentSection,
  allowGithub,
  buildLabel,
  onSelectWorkspace,
  onSelectSection,
  labelGlobalWorkspace,
}: ResolvePageIndexBranchInput): BreadcrumbDropdownItem[] {
  const segmentKind = inferBreadcrumbSegmentKind(segment);

  if (segmentKind === "workspace-root") {
    return buildWorkspaceRootDropdownItems({
      workspaces,
      activeWorkspaceId,
      currentSection,
      buildLabel,
      onSelectWorkspace,
      labelGlobalWorkspace,
    });
  }

  if (
    segmentKind === "workspace-section" &&
    (workspaceId ?? segment.meta?.workspaceId)
  ) {
    return buildWorkspaceSectionDropdownItems({
      workspaceId: workspaceId ?? segment.meta?.workspaceId ?? "",
      activeSection: segment.meta?.section ?? currentSection,
      buildLabel,
      onSelectSection,
      allowGithub,
    });
  }

  return [];
}
