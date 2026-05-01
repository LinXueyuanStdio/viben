import { useCallback, useMemo, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { IconDisplay } from "@/components/ui/icon-picker";
import { cn } from "@/lib/utils";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import { usePageTabs } from "@/hooks/use-page-tabs";
import { BreadcrumbDropdown } from "./breadcrumb-dropdown";
import {
  getWorkspaceSectionDescriptor,
  inferBreadcrumbSegmentKind,
  resolvePageIndexBranch,
  type BreadcrumbDropdownItem,
  type DesktopBreadcrumbSegment,
} from "@/navigation/page-index";
import type { Workspace } from "@/types";

interface DesktopBreadcrumbBarProps {
  workspace?: Workspace;
  segments?: DesktopBreadcrumbSegment[];
  className?: string;
  centerSlot?: ReactNode;
  rightSlot?: ReactNode;
}

function inferTabType(href: string, kind?: DesktopBreadcrumbSegment["kind"]) {
  if (kind === "workspace-web") {
    return "web" as const;
  }
  if (kind === "workspace-page") {
    return "page" as const;
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
  const { navigateTo, openWorkspaceView } = usePageTabs();

  const currentSection = useMemo(() => {
    const sectionSegment = segments.find((segment) => {
      const kind = inferBreadcrumbSegmentKind(segment);
      return kind === "workspace-section";
    });
    return sectionSegment?.meta?.section;
  }, [segments]);

  const navigateWithTab = useCallback(
    (segment: Pick<DesktopBreadcrumbSegment, "href" | "label" | "icon" | "kind" | "meta">) => {
      navigateTo(segment.href, {
        type: inferTabType(segment.href, segment.kind),
        name: segment.label,
        icon: segment.icon,
        slug:
          segment.meta?.section ??
          segment.meta?.pageSlug ??
          segment.meta?.agentId ??
          segment.meta?.executorType,
        workspaceId: segment.meta?.workspaceId ?? workspace?.id,
      });
    },
    [navigateTo, workspace?.id]
  );

  const handleWorkspaceSelect = useCallback(
    (workspaceId: string) => {
      selectWorkspace(workspaceId);

      if (currentSection) {
        const descriptor = getWorkspaceSectionDescriptor(currentSection);
        if (descriptor) {
          openWorkspaceView(
            workspaceId,
            descriptor.routePath,
            t(descriptor.titleKey, descriptor.fallbackLabel),
            descriptor.icon
          );
          return;
        }
      }

      const nextWorkspace = workspaces.find((item) => item.id === workspaceId);
      navigateTo(`/workspace/${encodeURIComponent(workspaceId)}`, {
        type: "workspace",
        name:
          nextWorkspace?.type === "global"
            ? t("workspace.global", "Global Workspace")
            : nextWorkspace?.name ?? t("sidebar.workspaceHome", "Workspace"),
        icon: {
          type: "lucide",
          value: nextWorkspace?.type === "global" ? "globe" : "folder-open",
        },
        workspaceId,
      });
    },
    [currentSection, navigateTo, openWorkspaceView, selectWorkspace, t, workspaces]
  );

  const handleSectionSelect = useCallback(
    (section: NonNullable<DesktopBreadcrumbSegment["meta"]>["section"], routePath: string, href: string) => {
      if (!workspace?.id || !section) {
        navigateTo(href, {
          type: "workspace",
          name: href,
          workspaceId: workspace?.id,
        });
        return;
      }

      const descriptor = getWorkspaceSectionDescriptor(section);
      openWorkspaceView(
        workspace.id,
        routePath,
        descriptor
          ? t(descriptor.titleKey, descriptor.fallbackLabel)
          : section,
        descriptor?.icon ?? { type: "lucide", value: "file-text" }
      );
    },
    [navigateTo, openWorkspaceView, t, workspace?.id]
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
      kind: "workspace-root",
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
    isCurrent: boolean
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
    isCurrent: boolean
  ) => {
    const items = resolvePageIndexBranch({
      segment,
      workspaceId: workspace?.id,
      workspaces,
      activeWorkspaceId: workspace?.id,
      currentSection,
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
        navigateWithTab({
          href: item.href,
          label: item.label,
          icon: item.icon,
          kind: item.kind as DesktopBreadcrumbSegment["kind"] | undefined,
          meta: item.meta,
        });
      }
    };

    return (
      <BreadcrumbDropdown items={items} onSelect={onDropdownSelect}>
        {renderSegmentButton(segment, isCurrent)}
      </BreadcrumbDropdown>
    );
  };

  const allSegments = rootSegment ? [rootSegment, ...segments] : segments;

  return (
    <header
      className={cn(
        "grid h-14 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 border-b bg-background px-4",
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
                {renderDropdown(segment, isCurrent)}
              </div>
            );
          })}
        </nav>
      </div>
      {centerSlot ? (
        <div className="flex min-w-0 items-center justify-center">
          {centerSlot}
        </div>
      ) : (
        <div />
      )}
      {rightSlot ? (
        <div className="flex shrink-0 items-center gap-2">{rightSlot}</div>
      ) : (
        <div />
      )}
    </header>
  );
}
