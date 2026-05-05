import type { IconData } from "@/components/ui/icon-picker";
import type {
  BreadcrumbStackItem,
  BreadcrumbItemKind,
  VirtualPageIndexNode,
  WorkspaceSection,
} from "./view-target";
import { createBreadcrumbItem } from "./breadcrumb-stack";
import type { DesktopLocation } from "./location";
import type { PageConfig } from "@/hooks/use-pages";
import {
  SETTINGS_SECTION_DESCRIPTORS,
  getWorkspaceSectionDescriptor,
  getWorkspaceSectionRoutePath,
  WORKSPACE_SECTION_DESCRIPTORS,
  getSettingsSectionIcon,
  getSettingsSectionLabel,
} from "./navigation-meta";
export { getWorkspaceSectionDescriptor } from "./navigation-meta";

export interface DesktopBreadcrumbSegment {
  id?: string;
  label: string;
  href: string;
  path?: string;
  onClick?: () => void;
  icon?: IconData;
  kind?: BreadcrumbItemKind;
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
  kind?: BreadcrumbItemKind | "external-web";
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
  pages?: PageConfig[];
  activeWorkspaceId?: string;
  currentSection?: WorkspaceSection;
  currentArea?: "home" | "apps" | "section";
  currentPageSlug?: string;
  currentSettingsSection?: string;
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

interface BreadcrumbDropdownRule {
  matches: (input: ResolvePageIndexBranchInput, segmentKind: BreadcrumbItemKind | undefined) => boolean;
  build: (input: ResolvePageIndexBranchInput) => BreadcrumbDropdownItem[];
}

interface WorkspaceSectionDropdownInput {
  workspaceId: string;
  activeSection?: WorkspaceSection;
  buildLabel?: (titleKey: string, fallbackLabel: string) => string;
  onSelectSection?: (
    section: WorkspaceSection,
    routePath: string,
    href: string
  ) => void;
  allowGithub?: boolean;
}

type WorkspaceSectionDropdownBuilder = (
  input: WorkspaceSectionDropdownInput
) => BreadcrumbDropdownItem[];

function buildDropdownItems<T>(
  items: T[],
  mapItem: (item: T, index: number) => BreadcrumbDropdownItem | null | undefined
): BreadcrumbDropdownItem[] {
  return items
    .map((item, index) => mapItem(item, index))
    .filter((item): item is BreadcrumbDropdownItem => Boolean(item));
}

export function stackToDesktopSegments(
  stack: BreadcrumbStackItem[] | undefined
): DesktopBreadcrumbSegment[] {
  if (!stack || stack.length <= 1) {
    return [];
  }

  return stack.slice(1).map((item) => ({
    id: item.id,
    label: item.label,
    href: item.target?.canonicalUrl ?? "#",
    icon: item.icon,
    kind: item.kind,
    meta: item.meta,
  }));
}

export function buildFallbackDesktopSegment(input: {
  id: string;
  label: string;
  location: DesktopLocation;
  kind: BreadcrumbItemKind;
  icon?: IconData;
  meta?: DesktopBreadcrumbSegment["meta"];
}): DesktopBreadcrumbSegment {
  const item = createBreadcrumbItem({
    id: input.id,
    label: input.label,
    location: input.location,
    kind: input.kind,
    icon: input.icon,
    meta: input.meta,
  });

  return {
    id: item.id,
    label: item.label,
    href: item.target?.canonicalUrl ?? "#",
    icon: item.icon,
    kind: item.kind,
    meta: item.meta,
  };
}

export function buildWorkspaceSectionHeaderSegment(
  workspaceId: string,
  section: WorkspaceSection,
  buildLabel?: (titleKey: string, fallbackLabel: string) => string
): DesktopBreadcrumbSegment {
  const descriptor = getWorkspaceSectionDescriptor(section);
  const routePath = descriptor?.routePath ?? section;

  return {
    id: `workspace:${workspaceId}:${section}`,
    label: descriptor
      ? buildLabel?.(descriptor.titleKey, descriptor.fallbackLabel) ??
        descriptor.fallbackLabel
      : section,
    href: `/workspace/${encodeURIComponent(workspaceId)}/${routePath}`,
    icon: descriptor?.icon,
    kind: "workspace-section",
    meta: {
      workspaceId,
      section,
      routePath,
    },
  };
}

export function resolveHeaderSegments(input: {
  stack?: BreadcrumbStackItem[];
  fallback?: DesktopBreadcrumbSegment[];
  patchLast?: Partial<DesktopBreadcrumbSegment> & {
    meta?: DesktopBreadcrumbSegment["meta"];
  };
}): DesktopBreadcrumbSegment[] {
  const stackSegments = stackToDesktopSegments(input.stack);
  const patchLast = input.patchLast;

  if (stackSegments.length === 0) {
    return input.fallback ?? [];
  }

  if (!patchLast) {
    return stackSegments;
  }

  return stackSegments.map((segment, index, segments) =>
    index === segments.length - 1
      ? {
          ...segment,
          ...patchLast,
          meta: {
            ...segment.meta,
            ...patchLast.meta,
          },
        }
      : segment
  );
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
): BreadcrumbItemKind | undefined {
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

export function buildRootDropdownItems({
  workspaces = [],
  currentArea = "home",
  activeWorkspaceId,
  currentSection,
  activeHref,
  buildLabel,
  onSelectWorkspace,
  labelGlobalWorkspace,
}: {
  workspaces?: WorkspaceListItemLike[];
  currentArea?: "home" | "apps" | "section";
  activeWorkspaceId?: string;
  currentSection?: WorkspaceSection;
  activeHref?: string;
  buildLabel?: (titleKey: string, fallbackLabel: string) => string;
  onSelectWorkspace?: (workspaceId: string) => void;
  labelGlobalWorkspace?: string;
}): BreadcrumbDropdownItem[] {
  const sectionRoutePath = currentSection
    ? getWorkspaceSectionRoutePath(currentSection)
    : "";

  const workspaceItems = buildDropdownItems(workspaces, (workspace) => {
    const workspaceLabel =
      workspace.type === "global"
        ? labelGlobalWorkspace ??
          buildLabel?.("workspace.global", "Global Workspace") ??
          "Global Workspace"
        : workspace.name;
    const href =
      currentArea === "apps"
        ? `/workspace/${encodeURIComponent(workspace.id)}/apps`
        : sectionRoutePath
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
      } as IconData,
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

  const systemItems = buildDropdownItems(
    [
      {
        id: "root:settings",
        label: getSettingsSectionLabel(),
        href: "/settings/general",
        icon: getSettingsSectionIcon(),
        isActive: activeHref?.startsWith("/settings") ?? false,
      },
      {
        id: "root:documents",
        label: buildLabel?.("nav.documents", "Documents") ?? "Documents",
        href: "/documents",
        icon: { type: "lucide", value: "file-text" } as IconData,
        isActive: activeHref === "/documents",
      },
      {
        id: "root:devices",
        label: buildLabel?.("nav.devices", "Devices") ?? "Devices",
        href: "/devices/pair",
        icon: { type: "lucide", value: "smartphone" } as IconData,
        isActive: activeHref === "/devices/pair",
      },
    ],
    (item) => ({
      ...item,
      kind: "global-route",
    })
  );

  return [...workspaceItems, ...systemItems];
}

function buildWorkspaceSectionMenuDropdownItems({
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
  return buildDropdownItems(
    WORKSPACE_SECTION_DESCRIPTORS.filter((item) =>
      allowGithub ? true : item.section !== "github"
    ),
    (item) => {
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
    }
  );
}

export function buildWorkspaceChatDropdownItems({
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
  return buildWorkspaceSectionMenuDropdownItems({
    workspaceId,
    activeSection,
    buildLabel,
    onSelectSection,
    allowGithub,
  });
}

export function buildWorkspaceKanbanDropdownItems(
  input: WorkspaceSectionDropdownInput
): BreadcrumbDropdownItem[] {
  return buildWorkspaceSectionMenuDropdownItems(input);
}

export function buildWorkspaceCronDropdownItems(
  input: WorkspaceSectionDropdownInput
): BreadcrumbDropdownItem[] {
  return buildWorkspaceSectionMenuDropdownItems(input);
}

export function buildWorkspaceIdeasDropdownItems(
  input: WorkspaceSectionDropdownInput
): BreadcrumbDropdownItem[] {
  return buildWorkspaceSectionMenuDropdownItems(input);
}

export function buildWorkspaceAppsDropdownItems({
  workspaceId,
  pages = [],
  currentPageSlug,
}: {
  workspaceId: string;
  pages?: PageConfig[];
  currentPageSlug?: string;
}): BreadcrumbDropdownItem[] {
  return buildDropdownItems(
    pages.filter((page) => !page.slug.includes("/")),
    (page) => ({
      id: `workspace:${workspaceId}:page:${page.slug}`,
      label: page.name,
      href: `/workspace/${encodeURIComponent(workspaceId)}/page/${page.slug
        .split("/")
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join("/")}`,
      icon: page.icon,
      isActive:
        currentPageSlug === page.slug ||
        Boolean(currentPageSlug?.startsWith(`${page.slug}/`)),
      kind: "workspace-page",
      meta: {
        workspaceId,
        pageSlug: page.slug,
      },
    })
  );
}

export function buildWorkspaceAgentsDropdownItems({
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
  return buildWorkspaceSectionMenuDropdownItems({
    workspaceId,
    activeSection,
    buildLabel,
    onSelectSection,
    allowGithub,
  });
}

export function buildWorkspaceFilesDropdownItems(
  input: WorkspaceSectionDropdownInput
): BreadcrumbDropdownItem[] {
  return buildWorkspaceSectionMenuDropdownItems(input);
}

export function buildWorkspaceGithubDropdownItems(
  input: WorkspaceSectionDropdownInput
): BreadcrumbDropdownItem[] {
  return buildWorkspaceSectionMenuDropdownItems(input);
}

export function buildWorkspaceChatMonitorDropdownItems(
  input: WorkspaceSectionDropdownInput
): BreadcrumbDropdownItem[] {
  return buildWorkspaceSectionMenuDropdownItems(input);
}

export const WORKSPACE_SECTION_DROPDOWN_BUILDERS: Record<
  WorkspaceSection,
  WorkspaceSectionDropdownBuilder
> = {
  chat: buildWorkspaceChatDropdownItems,
  kanban: buildWorkspaceKanbanDropdownItems,
  cron: buildWorkspaceCronDropdownItems,
  ideas: buildWorkspaceIdeasDropdownItems,
  agent: buildWorkspaceAgentsDropdownItems,
  files: buildWorkspaceFilesDropdownItems,
  github: buildWorkspaceGithubDropdownItems,
  "chat-monitor": buildWorkspaceChatMonitorDropdownItems,
};

export function buildWorkspaceSectionDropdownItems(
  section: WorkspaceSection,
  input: WorkspaceSectionDropdownInput
): BreadcrumbDropdownItem[] {
  return (WORKSPACE_SECTION_DROPDOWN_BUILDERS[section] ??
    buildWorkspaceChatDropdownItems)(input);
}

export function buildSettingsDropdownItems({
  activeSection,
  buildLabel,
}: {
  activeSection?: string;
  buildLabel?: (titleKey: string, fallbackLabel: string) => string;
}): BreadcrumbDropdownItem[] {
  return buildDropdownItems(SETTINGS_SECTION_DESCRIPTORS, (item) => ({
    id: `settings:${item.section}`,
    label:
      buildLabel?.(item.titleKey, item.fallbackLabel) ?? item.fallbackLabel,
    href: `/settings/${item.routePath}`,
    icon: item.icon,
    isActive: item.section === activeSection,
    kind: "global-route",
  }));
}

export function resolvePageIndexBranch({
  segment,
  workspaceId,
  workspaces,
  pages,
  activeWorkspaceId,
  currentSection,
  currentArea,
  currentPageSlug,
  currentSettingsSection,
  allowGithub,
  buildLabel,
  onSelectWorkspace,
  onSelectSection,
  labelGlobalWorkspace,
}: ResolvePageIndexBranchInput): BreadcrumbDropdownItem[] {
  const segmentKind = inferBreadcrumbSegmentKind(segment);
  const input: ResolvePageIndexBranchInput = {
    segment,
    workspaceId,
    workspaces,
    pages,
    activeWorkspaceId,
    currentSection,
    currentArea,
    currentPageSlug,
    currentSettingsSection,
    allowGithub,
    buildLabel,
    onSelectWorkspace,
    onSelectSection,
    labelGlobalWorkspace,
  };

  const rules: BreadcrumbDropdownRule[] = [
    {
      matches: (_input, kind) => kind === "workspace-root",
      build: (input) =>
        buildRootDropdownItems({
          workspaces: input.workspaces,
          currentArea: input.currentArea,
          activeWorkspaceId: input.activeWorkspaceId,
          currentSection: input.currentSection,
          activeHref: input.segment.href,
          buildLabel: input.buildLabel,
          onSelectWorkspace: input.onSelectWorkspace,
          labelGlobalWorkspace: input.labelGlobalWorkspace,
        }),
    },
    {
      matches: (input, kind) =>
        (kind === "virtual-folder" || kind === "global-route") &&
        input.segment.href.startsWith("/settings/") &&
        input.segment.label === getSettingsSectionLabel(),
      build: (input) =>
        buildRootDropdownItems({
          workspaces: input.workspaces,
          currentArea: input.currentArea,
          activeWorkspaceId: input.activeWorkspaceId,
          currentSection: input.currentSection,
          activeHref: input.segment.href,
          buildLabel: input.buildLabel,
          onSelectWorkspace: input.onSelectWorkspace,
          labelGlobalWorkspace: input.labelGlobalWorkspace,
        }),
    },
    {
      matches: (input, kind) =>
        kind === "virtual-folder" &&
        Boolean(input.segment.meta?.workspaceId) &&
        input.segment.href ===
          `/workspace/${encodeURIComponent(input.segment.meta?.workspaceId ?? "")}/apps`,
      build: (input) =>
        buildWorkspaceAppsDropdownItems({
          workspaceId: input.segment.meta?.workspaceId ?? "",
          pages: input.pages,
          currentPageSlug: input.currentPageSlug,
        }),
    },
    {
      matches: (input, kind) =>
        kind === "global-route" &&
        input.segment.href.startsWith("/settings/"),
      build: (input) =>
        buildSettingsDropdownItems({
          activeSection: input.currentSettingsSection,
          buildLabel: input.buildLabel,
        }),
    },
    {
      matches: (input, kind) =>
        kind === "workspace-section" &&
        Boolean(input.workspaceId ?? input.segment.meta?.workspaceId),
      build: (input) => {
        const section = input.segment.meta?.section ?? input.currentSection ?? "chat";
        return buildWorkspaceSectionDropdownItems(section, {
          workspaceId: input.workspaceId ?? input.segment.meta?.workspaceId ?? "",
          activeSection: section,
          buildLabel: input.buildLabel,
          onSelectSection: input.onSelectSection,
          allowGithub: input.allowGithub,
        });
      },
    },
  ];

  const matchedRule = rules.find((rule) => rule.matches(input, segmentKind));

  if (matchedRule) {
    return matchedRule.build(input);
  }

  return [];
}
