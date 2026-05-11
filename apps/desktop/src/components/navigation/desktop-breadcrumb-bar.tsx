import { useCallback, useMemo, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { IconDisplay } from "@/components/ui/icon-picker";
import { cn } from "@/lib/utils";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import { BreadcrumbDropdown } from "./breadcrumb-dropdown";
import {
  getWorkspaceSectionDescriptor,
  resolveSegmentDescriptorId,
  resolvePageIndexBranch,
  type BreadcrumbDropdownItem,
  type DesktopBreadcrumbSegment,
} from "@/navigation/page-index";
import { getGatewayUrl, listPages } from "@/lib/gateway";
import { pageKeys } from "@/hooks/use-pages";
import type { Workspace } from "@/types";

interface DesktopBreadcrumbBarProps {
  workspace?: Workspace;
  segments?: DesktopBreadcrumbSegment[];
  className?: string;
  centerSlot?: ReactNode;
  rightSlot?: ReactNode;
}

function inferDescriptorId(href: string, descriptorId?: DesktopBreadcrumbSegment["descriptorId"]) {
  if (descriptorId === "workspace-web") {
    return "workspace-web" as const;
  }
  if (descriptorId === "workspace-page") {
    return "workspace-page" as const;
  }
  if (href.startsWith("/workspace/")) {
    return "workspace" as const;
  }
  return "settings" as const;
}

export function DesktopBreadcrumbBar({
  workspace,
  segments = [],
  className,
  centerSlot,
  rightSlot,
}: DesktopBreadcrumbBarProps) {
  const { t } = useTranslation();
  const { workspaces, selectWorkspace } = useLocalWorkspaces();
  const {
    openPath,
    openWorkspaceApps,
    openWorkspaceHome,
    openWorkspaceSection,
    popToBreadcrumb,
  } = useDesktopRouting();
  const workspacePath = workspace?.path;
  const { data: pagesResult } = useQuery({
    queryKey: workspacePath ? pageKeys.list(workspacePath) : ["pages", "disabled"],
    queryFn: () => listPages(getGatewayUrl(), workspacePath ?? ""),
    enabled: Boolean(workspacePath),
    staleTime: 30_000,
  });
  const pages = pagesResult?.pages ?? [];

  const currentSection = useMemo(() => {
    const sectionSegment = segments.find((segment) => {
      const id = resolveSegmentDescriptorId(segment);
      return id?.startsWith("workspace-section:");
    });
    return sectionSegment?.meta?.section;
  }, [segments]);

  const currentArea = useMemo<"home" | "pages" | "section">(() => {
    const pagesHref = workspace?.id
      ? `/workspace/${encodeURIComponent(workspace.id)}/pages`
      : null;
    if (pagesHref && segments.some((segment) => segment.href === pagesHref)) {
      return "pages";
    }
    if (currentSection) {
      return "section";
    }
    return "home";
  }, [currentSection, segments, workspace?.id]);

  const currentPageSlug = useMemo(() => {
    const pageSegments = segments.filter((segment) => segment.meta?.pageSlug);
    return pageSegments[pageSegments.length - 1]?.meta?.pageSlug;
  }, [segments]);

  const currentSettingsSection = useMemo(() => {
    const settingsSegment = segments.find((segment) => segment.href.startsWith("/settings/"));
    if (!settingsSegment) {
      return undefined;
    }
    return settingsSegment.href.split("/settings/")[1] || "general";
  }, [segments]);

  const navigateWithTab = useCallback(
    (segment: Pick<DesktopBreadcrumbSegment, "href" | "label" | "icon" | "descriptorId" | "meta">) => {
      openPath(segment.href, {
        descriptorId: inferDescriptorId(segment.href, segment.descriptorId),
        title: segment.label,
        icon: segment.icon,
        slug:
          segment.meta?.section ??
          segment.meta?.pageSlug ??
          segment.meta?.agentId ??
          segment.meta?.executorType,
        workspaceId: segment.meta?.workspaceId ?? workspace?.id,
      });
    },
    [openPath, workspace?.id]
  );

  const handleWorkspaceSelect = useCallback(
    (workspaceId: string) => {
      selectWorkspace(workspaceId);

      if (currentSection) {
        const descriptor = getWorkspaceSectionDescriptor(currentSection);
        if (descriptor) {
          openWorkspaceSection(workspaceId, descriptor.section);
          return;
        }
      }

      if (currentArea === "pages") {
        openWorkspaceApps(workspaceId);
        return;
      }

      openWorkspaceHome(workspaceId);
    },
    [
      currentArea,
      currentSection,
      openWorkspaceApps,
      openWorkspaceHome,
      openWorkspaceSection,
      selectWorkspace,
    ]
  );

  const handleSectionSelect = useCallback(
    (section: NonNullable<DesktopBreadcrumbSegment["meta"]>["section"], _routePath: string, href: string) => {
      if (!workspace?.id || !section) {
        openPath(href, {
          descriptorId: "workspace",
          title: href,
          workspaceId: workspace?.id,
        });
        return;
      }

      openWorkspaceSection(workspace.id, section);
    },
    [openPath, openWorkspaceSection, workspace?.id]
  );

  const rootSegment = useMemo<DesktopBreadcrumbSegment | null>(() => {
    if (!workspace) {
      return null;
    }

    return {
      id: `workspace:${workspace.id}`,
      label:
        workspace.type === "global"
          ? t("workspace.global", "Global Workspace")
          : workspace.name,
      href: `/workspace/${encodeURIComponent(workspace.id)}`,
      path: workspace.path,
      descriptorId: "workspace",
      icon: {
        type: "lucide",
        value: workspace.type === "global" ? "globe" : "folder-open",
      },
      meta: {
        workspaceId: workspace.id,
      },
    };
  }, [t, workspace]);

  const renderSegmentButton = (
    segment: DesktopBreadcrumbSegment,
    isCurrent: boolean,
    stackIndex: number
  ) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "h-8 gap-2 rounded-lg px-2.5 font-medium",
        isCurrent && "bg-accent/70"
      )}
      onClick={() => {
        if (segment.onClick) {
          segment.onClick();
          return;
        }
        if (!isCurrent && stackIndex >= 0) {
          popToBreadcrumb(stackIndex);
          return;
        }
        navigateWithTab(segment);
      }}
      title={segment.path}
    >
      <IconDisplay
        icon={segment.icon}
        size="sm"
        className="text-muted-foreground"
      />
      <span className="max-w-[220px] truncate">{segment.label}</span>
    </Button>
  );

  const renderDropdown = (
    segment: DesktopBreadcrumbSegment,
    isCurrent: boolean,
    stackIndex: number
  ) => {
    const items = resolvePageIndexBranch({
      segment,
      workspaceId: workspace?.id,
      pages,
      workspaces,
      activeWorkspaceId: workspace?.id,
      currentSection,
      currentArea,
      currentPageSlug,
      currentSettingsSection,
      buildLabel: (key, fallback) => t(key, fallback),
      onSelectWorkspace: handleWorkspaceSelect,
      onSelectSection: handleSectionSelect,
      labelGlobalWorkspace: t("workspace.global", "Global Workspace"),
    });

    const onDropdownSelect = (item: BreadcrumbDropdownItem) => {
      if (item.onSelect) {
        return;
      }
      if (item.href) {
        if (item.meta?.workspaceId && item.href === `/workspace/${encodeURIComponent(item.meta.workspaceId)}/pages`) {
          openWorkspaceApps(item.meta.workspaceId);
          return;
        }
        navigateWithTab({
          href: item.href,
          label: item.label,
          icon: item.icon,
          descriptorId: item.descriptorId,
          meta: item.meta,
        });
      }
    };

    return (
      <BreadcrumbDropdown items={items} onSelect={onDropdownSelect}>
        {renderSegmentButton(segment, isCurrent, stackIndex)}
      </BreadcrumbDropdown>
    );
  };

  const allSegments = rootSegment ? [rootSegment, ...segments] : segments;

  return (
    <header
      className={cn(
        "grid h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-b bg-background px-4",
        className
      )}
    >
      <div className="min-w-0 overflow-x-auto scrollbar-none">
        <nav
          aria-label={t("common.breadcrumb")}
          className="flex min-w-max items-center gap-1"
        >
          {allSegments.map((segment, index) => {
            const isCurrent = index === allSegments.length - 1;
            const key = segment.id ?? `${segment.href}-${segment.label}-${index}`;

            return (
              <div key={key} className="flex items-center gap-1">
                {index > 0 ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/70" />
                ) : null}
                {renderDropdown(
                  segment,
                  isCurrent,
                  rootSegment ? index : index + 1
                )}
              </div>
            );
          })}
        </nav>
      </div>
      {centerSlot ? (
        <div className="flex min-w-0 items-center justify-center justify-self-center">
          {centerSlot}
        </div>
      ) : (
        <div />
      )}
      {rightSlot ? (
        <div className="flex shrink-0 items-center justify-self-end gap-2">{rightSlot}</div>
      ) : (
        <div />
      )}
    </header>
  );
}
