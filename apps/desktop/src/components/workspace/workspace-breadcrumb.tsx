import { DesktopBreadcrumbBar } from "@/components/navigation/desktop-breadcrumb-bar";
import type { DesktopBreadcrumbSegment } from "@/navigation/page-index";
import type { Workspace } from "@/types";

export type BreadcrumbSegment = DesktopBreadcrumbSegment;

interface WorkspaceBreadcrumbProps {
  workspace: Workspace;
  segments?: BreadcrumbSegment[];
  className?: string;
}

export function WorkspaceBreadcrumb({
  workspace,
  segments = [],
  className,
}: WorkspaceBreadcrumbProps) {
  return (
    <DesktopBreadcrumbBar
      workspace={workspace}
      segments={segments}
      className={className}
    />
  );
}
