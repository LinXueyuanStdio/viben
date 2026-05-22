import type { IconData } from "@/components/ui/icon-picker";
import type { BreadcrumbStackItem } from "./breadcrumb-builder";
import type {
  VirtualPageIndexNode,
  WorkspaceSection,
} from "./navigation-meta";
import {
  SETTINGS_SECTIONS,
  getWorkspaceSectionDescriptor,
  getWorkspaceSectionRoutePath,
  WORKSPACE_SECTIONS,
  getSettingsSectionIcon,
  getSettingsSectionLabel,
} from "./navigation-meta";
import { createBreadcrumbItem } from "./breadcrumb-stack";
import { registry } from "./route-registry";
import type { PageConfig } from "@/hooks/use-pages";
export { getWorkspaceSectionDescriptor } from "./navigation-meta";

export interface DesktopBreadcrumbSegment {
  id?: string;
  label: string;
  titleKey?: string;
  href: string;
  path?: string;
  onClick?: () => void;
  icon?: IconData;
  descriptorId?: string;
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
  separator?: boolean;
  onSelect?: () => void;
  isActive?: boolean;
  descriptorId?: string;
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
  currentArea?: "home" | "pages" | "section";
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
  matches: (input: ResolvePageIndexBranchInput, descriptorId: string | undefined) => boolean;
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
    href: item.href,
    icon: item.icon,
    descriptorId: item.descriptorId,
    meta: item.meta,
  }));
}

export function buildFallbackDesktopSegment(input: {
  id: string;
  label: string;
  href: string;
  descriptorId: string;
  icon?: IconData;
  meta?: DesktopBreadcrumbSegment["meta"];
}): DesktopBreadcrumbSegment {
  const item = createBreadcrumbItem({
    id: input.id,
    label: input.label,
    href: input.href,
    descriptorId: input.descriptorId,
    icon: input.icon,
    meta: input.meta,
  });

  return {
    id: item.id,
    label: item.label,
    href: item.href,
    icon: item.icon,
    descriptorId: item.descriptorId,
    meta: item.meta,
  };
}

export function buildWorkspaceSectionHeaderSegment(
  workspaceId: string,
  section: WorkspaceSection,
  buildLabel?: (titleKey: string, fallbackLabel: string) => string
): DesktopBreadcrumbSegment {
  const info = getWorkspaceSectionDescriptor(section);
  const routePath = section;

  return {
    id: `workspace:${workspaceId}:${section}`,
    label: info
      ? buildLabel?.(info.titleKey, info.fallbackLabel) ??
        info.fallbackLabel
      : section,
    href: `/workspace/${encodeURIComponent(workspaceId)}/${routePath}`,
    icon: info?.icon,
    descriptorId: `workspace-section:${section}`,
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
    descriptorId: "workspace",
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
  const sectionNodes = WORKSPACE_SECTIONS.map((info, index) => ({
    id: `${root.id}:${info.section}`,
    descriptorId: `workspace-section:${info.section}`,
    label: info.fallbackLabel,
    icon: info.icon,
    parentId: root.id,
    order: index + 1,
    href: `/workspace/${encodeURIComponent(workspaceId)}/${info.section}`,
  }));

  return [root, ...sectionNodes];
}

export function resolveSegmentDescriptorId(
  segment: DesktopBreadcrumbSegment
): string | undefined {
  if (segment.descriptorId) {
    return segment.descriptorId;
  }

  if (/^\/workspace\/[^/]+$/.test(segment.href)) {
    return "workspace";
  }

  const sectionMatch = segment.href.match(
    /^\/workspace\/[^/]+\/(chat|kanban|cron|ideas|pages|files|github|chat-monitor)$/
  );
  if (sectionMatch) {
    return `workspace-section:${sectionMatch[1]}`;
  }

  if (/^\/workspace\/[^/]+\/(agent|agents)$/.test(segment.href)) {
    return "workspace-section:agent";
  }

  if (/^\/agent\/[^/]+/.test(segment.href)) {
    return "workspace-agent";
  }

  if (/^\/executor\/[^/]+/.test(segment.href)) {
    return "workspace-executor";
  }

  const pageMatch = segment.href.match(/^\/workspace\/[^/]+\/pages\/(.+)$/);
  if (pageMatch) {
    return "workspace-page";
  }

  if (segment.href === "/settings") {
    return "settings";
  }

  if (/^\/settings\/[^/]+/.test(segment.href)) {
    return `settings:${segment.href.split("/settings/")[1]}`;
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
  currentArea?: "home" | "pages" | "section";
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
    const isGlobal = workspace.id === "global";
    const workspaceLabel = isGlobal
      ? labelGlobalWorkspace ??
        buildLabel?.("workspace.global", "Global Workspace") ??
        "Global Workspace"
      : workspace.name;
    const href =
      currentArea === "pages"
        ? `/workspace/${encodeURIComponent(workspace.id)}/pages`
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
        value: isGlobal ? "globe" : "folder-open",
      } as IconData,
      isActive: workspace.id === activeWorkspaceId,
      descriptorId: "workspace",
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
      descriptorId: item.id.replace("root:", ""),
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
    WORKSPACE_SECTIONS.filter((item) =>
      allowGithub ? true : item.section !== "github"
    ),
    (item) => {
      const routePath = item.section;
      const href = `/workspace/${encodeURIComponent(workspaceId)}/${routePath}`;
      return {
        id: `workspace:${workspaceId}:${item.section}`,
        label:
          buildLabel?.(item.titleKey, item.fallbackLabel) ?? item.fallbackLabel,
        href,
        icon: item.icon,
        isActive: item.section === activeSection,
        descriptorId: `workspace-section:${item.section}`,
        meta: {
          workspaceId,
          section: item.section,
          routePath,
        },
        onSelect: onSelectSection
          ? () => onSelectSection(item.section, routePath, href)
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

export function buildWorkspacePagesDropdownItems({
  workspaceId,
  activeSection,
  buildLabel,
  onSelectSection,
  allowGithub = true,
  pages = [],
  currentPageSlug,
}: WorkspaceSectionDropdownInput & {
  pages?: PageConfig[];
  currentPageSlug?: string;
}): BreadcrumbDropdownItem[] {
  const sectionItems = buildWorkspaceSectionMenuDropdownItems({
    workspaceId,
    activeSection,
    buildLabel,
    onSelectSection,
    allowGithub,
  });
  const pageItems = buildDropdownItems(
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
      descriptorId: "workspace-page",
      meta: {
        workspaceId,
        pageSlug: page.slug,
      },
    })
  );

  return pageItems.length > 0
    ? [...sectionItems, { id: `workspace:${workspaceId}:pages-separator`, label: "", separator: true }, ...pageItems]
    : sectionItems;
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
  pages: buildWorkspacePagesDropdownItems,
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
  return buildDropdownItems(SETTINGS_SECTIONS, (item) => ({
    id: `settings:${item.section}`,
    label:
      buildLabel?.(item.titleKey, item.fallbackLabel) ?? item.fallbackLabel,
    href: `/settings/${item.section}`,
    icon: item.icon,
    isActive: item.section === activeSection,
    descriptorId: `settings:${item.section}`,
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
  const descriptorId = resolveSegmentDescriptorId(segment);

  // Resolve dropdownCategory from route registry when possible.
  // This enables registry-driven dropdown dispatch alongside legacy descriptorId matching.
  // Future: use dropdownCategory to replace descriptorId-based rule matching entirely.
  const routeMatch = segment.href && segment.href !== "#"
    ? registry.match(segment.href)
    : null;
  void routeMatch?.entry.dropdownCategory;

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
      matches: (_input, descriptorId) => descriptorId === "workspace",
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
      matches: (input, descriptorId) =>
        (descriptorId === "virtual-folder" || descriptorId === "settings") &&
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
      matches: (input, descriptorId) =>
        descriptorId === "settings" &&
        input.segment.href === "/settings",
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
      matches: (input, descriptorId) =>
        (descriptorId === "virtual-folder" || descriptorId === "workspace-section:pages") &&
        Boolean(input.segment.meta?.workspaceId) &&
        input.segment.href ===
          `/workspace/${encodeURIComponent(input.segment.meta?.workspaceId ?? "")}/pages`,
      build: (input) =>
        buildWorkspacePagesDropdownItems({
          workspaceId: input.segment.meta?.workspaceId ?? "",
          activeSection: "pages",
          buildLabel: input.buildLabel,
          onSelectSection: input.onSelectSection,
          allowGithub: input.allowGithub,
          pages: input.pages,
          currentPageSlug: input.currentPageSlug,
        }),
    },
    {
      matches: (input, descriptorId) =>
        Boolean(descriptorId?.startsWith("settings")) &&
        input.segment.href.startsWith("/settings/"),
      build: (input) =>
        buildSettingsDropdownItems({
          activeSection:
            input.segment.href.split("/settings/")[1] ||
            input.currentSettingsSection ||
            "general",
          buildLabel: input.buildLabel,
        }),
    },
    {
      matches: (input, descriptorId) =>
        Boolean(descriptorId?.startsWith("workspace-section:")) &&
        Boolean(input.workspaceId ?? input.segment.meta?.workspaceId),
      build: (input) => {
        const descriptorId = resolveSegmentDescriptorId(input.segment);
        const sectionFromDescriptor = descriptorId?.startsWith("workspace-section:")
          ? descriptorId.slice("workspace-section:".length) as WorkspaceSection
          : undefined;
        const section = sectionFromDescriptor ?? input.segment.meta?.section ?? input.currentSection ?? "chat";
        const wId = input.workspaceId ?? input.segment.meta?.workspaceId ?? "";

        // For pages section, pass pages list for the dropdown
        if (section === "pages") {
          return buildWorkspacePagesDropdownItems({
            workspaceId: wId,
            activeSection: section,
            buildLabel: input.buildLabel,
            onSelectSection: input.onSelectSection,
            allowGithub: input.allowGithub,
            pages: input.pages,
            currentPageSlug: input.currentPageSlug,
          });
        }

        return buildWorkspaceSectionDropdownItems(section, {
          workspaceId: wId,
          activeSection: section,
          buildLabel: input.buildLabel,
          onSelectSection: input.onSelectSection,
          allowGithub: input.allowGithub,
        });
      },
    },
    {
      matches: (input, descriptorId) =>
        descriptorId === "workspace-page" &&
        Boolean(input.pages?.length),
      build: (input) => {
        const wId = input.workspaceId ?? input.segment.meta?.workspaceId ?? "";
        // Derive slug from meta or href
        const currentSlug = input.segment.meta?.pageSlug ??
          input.segment.href.match(/^\/workspace\/[^/]+\/pages\/(.+)$/)?.[1] ?? "";
        // Find parent prefix to get siblings
        const parentPrefix = currentSlug.includes("/")
          ? currentSlug.slice(0, currentSlug.lastIndexOf("/") + 1)
          : "";
        const depth = parentPrefix ? parentPrefix.split("/").filter(Boolean).length + 1 : 1;

        const siblings = (input.pages ?? []).filter((page) => {
          // Same depth and same parent prefix
          const pageDepth = page.slug.split("/").filter(Boolean).length;
          if (pageDepth !== depth) return false;
          if (parentPrefix) {
            return page.slug.startsWith(parentPrefix);
          }
          return !page.slug.includes("/");
        });

        return buildDropdownItems(siblings, (page) => ({
          id: `workspace:${wId}:page:${page.slug}`,
          label: page.name,
          href: `/workspace/${encodeURIComponent(wId)}/pages/${page.slug
            .split("/")
            .filter(Boolean)
            .map((s) => encodeURIComponent(s))
            .join("/")}`,
          icon: page.icon,
          isActive: page.slug === currentSlug,
          descriptorId: "workspace-page",
          meta: {
            workspaceId: wId,
            pageSlug: page.slug,
          },
        }));
      },
    },
  ];

  const matchedRule = rules.find((rule) => rule.matches(input, descriptorId));

  if (matchedRule) {
    return matchedRule.build(input);
  }

  return [];
}
