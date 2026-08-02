import { useCallback, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
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
    openWorkspacePages,
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
      ? `/workspace/${encodeURIComponent(workspace.id)}/page`
      : null;
    if (pagesHref && segments.some((segment) => segment.href === pagesHref)) {
      return "pages";
    }
    if (currentSection) {
      return "section";
    }
    return "home";
  }, [currentSection, segments, workspace?.id]);

  const currentPageUid = useMemo(() => {
    const pageSegments = segments.filter((segment) => segment.meta?.pageUid);
    return pageSegments[pageSegments.length - 1]?.meta?.pageUid;
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
          segment.meta?.pageUid ??
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
        openWorkspacePages(workspaceId);
        return;
      }

      openWorkspaceHome(workspaceId);
    },
    [
      currentArea,
      currentSection,
      openWorkspacePages,
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

    const isGlobal = workspace.id === "global";
    return {
      id: `workspace:${workspace.id}`,
      label: isGlobal
        ? t("workspace.global", "Global Workspace")
        : workspace.name,
      href: `/workspace/${encodeURIComponent(workspace.id)}`,
      path: workspace.path,
      descriptorId: "workspace",
      icon: {
        type: "lucide",
        value: isGlobal ? "globe" : "folder-open",
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
        // Current segment is a no-op for navigation — the PopoverTrigger
        // (BreadcrumbDropdown) already handles opening/closing the dropdown
        // on click via Radix UI's built-in trigger behavior.
        if (isCurrent) {
          return;
        }
        if (stackIndex >= 0) {
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
      <span className="max-w-[220px] truncate">{segment.titleKey ? t(segment.titleKey, segment.label) : segment.label}</span>
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
      currentPageUid,
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
        if (item.meta?.workspaceId && item.href === `/workspace/${encodeURIComponent(item.meta.workspaceId)}/page`) {
          openWorkspacePages(item.meta.workspaceId);
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
        "grid h-10 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-b bg-background px-1",
        className
      )}
    >
      <div className="min-w-0 h-8 overflow-x-auto scrollbar-breadcrumb">
        <nav
          aria-label={t("common.breadcrumb")}
          className="flex min-w-max items-center gap-0"
        >
          <AnimatePresence mode="popLayout">
            {allSegments.map((segment, index) => {
              const isCurrent = index === allSegments.length - 1;
              const key = segment.id ?? `${segment.href}-${segment.label}-${index}`;

              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="flex items-center gap-0"
                >
                  {index > 0 ? (
                    <span className="text-muted-foreground/40 text-sm font-light select-none">/</span>
                  ) : null}
                  {renderDropdown(
                    segment,
                    isCurrent,
                    rootSegment ? index : index + 1
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
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
