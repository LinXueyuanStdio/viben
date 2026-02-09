import { useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, FolderOpen, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { FileBrowser } from "@/components/file-browser";
import { useLocalWorkspaces } from "@/hooks";
import { useTranslation } from "react-i18next";
import type { BreadcrumbSegment } from "@/components/workspace/workspace-breadcrumb";

/** Interface for FileBrowser imperative handle */
interface FileBrowserRef {
  navigateToColumnIndex: (index: number) => void;
}

export function WorkspaceFilesPage() {
  const { t } = useTranslation();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { getWorkspace, isLoading, workspaces } = useLocalWorkspaces();

  // Reference to FileBrowser for imperative navigation
  const fileBrowserRef = useRef<FileBrowserRef | null>(null);

  // Track current path segments for breadcrumb
  const [currentSegments, setCurrentSegments] = useState<{ name: string; path: string }[]>([]);

  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;

  // Handle path changes from FileBrowser
  const handlePathChange = useCallback(
    (_path: string, segments: { name: string; path: string }[]) => {
      setCurrentSegments(segments);
    },
    []
  );

  // Build breadcrumb segments with proper onClick handlers for column navigation
  const buildBreadcrumbs = useCallback((): BreadcrumbSegment[] => {
    const breadcrumbs: BreadcrumbSegment[] = [
      {
        label: t("workspace.files", "Files"),
        href: `/workspace/${workspaceId}/files`,
        path: workspace?.path,
        onClick: () => {
          // Navigate to root (column index 0)
          fileBrowserRef.current?.navigateToColumnIndex(0);
        },
      },
    ];

    // Add path segments with onClick handlers for column navigation
    currentSegments.forEach((segment, index) => {
      breadcrumbs.push({
        label: segment.name,
        href: `/workspace/${workspaceId}/files`,
        path: segment.path,
        onClick: () => {
          // Navigate to column index (index + 1 because root is 0)
          fileBrowserRef.current?.navigateToColumnIndex(index + 1);
        },
      });
    });

    return breadcrumbs;
  }, [currentSegments, workspaceId, workspace?.path, t]);

  const pathSegments = buildBreadcrumbs();

  // Show loading state while workspaces are being fetched
  if (isLoading && !workspace) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </PageWrapper>
    );
  }

  // Only show "not found" after workspaces have loaded
  if (!workspace && workspaces.length > 0) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {t("workspace.notFound")}
          </h2>
          <p className="text-muted-foreground mb-4">
            {t("workspace.notFoundDesc")}
          </p>
          <Button asChild>
            <Link to="/mcp-services/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("workspace.backToDashboard")}
            </Link>
          </Button>
        </div>
      </PageWrapper>
    );
  }

  // Fallback - still loading or no workspaces
  if (!workspace) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="flex flex-col h-full">
      <WorkspaceHeader
        workspace={workspace}
        segments={pathSegments}
        showRefresh={false}
        showRemove={false}
      />

      <div className="flex-1 overflow-hidden">
        <FileBrowser
          workspacePath={workspace.path}
          className="h-full"
          onPathChange={handlePathChange}
        />
      </div>
    </PageWrapper>
  );
}
