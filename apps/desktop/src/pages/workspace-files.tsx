import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, FolderOpen, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { FileBrowser } from "@/components/file-browser";
import { useLocalWorkspaces } from "@/hooks";
import { useTranslation } from "react-i18next";
import type { BreadcrumbSegment } from "@/components/workspace/workspace-breadcrumb";

export function WorkspaceFilesPage() {
  const { t } = useTranslation();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { getWorkspace, isLoading, workspaces } = useLocalWorkspaces();

  // Track current path for breadcrumb
  const [pathSegments, setPathSegments] = useState<BreadcrumbSegment[]>([
    { label: t("workspace.files", "Files"), href: `/workspace/${workspaceId}/files` },
  ]);

  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;

  // Handle path changes from FileBrowser
  const handlePathChange = useCallback(
    (_path: string, segments: { name: string; path: string }[]) => {
      // Build breadcrumb segments: "Files" + relative path parts
      const breadcrumbs: BreadcrumbSegment[] = [
        { label: t("workspace.files", "Files"), href: `/workspace/${workspaceId}/files` },
      ];

      // Add path segments (skip the first one which is workspace root)
      segments.forEach((segment) => {
        breadcrumbs.push({
          label: segment.name,
          href: `/workspace/${workspaceId}/files`, // All segments link to files page (navigation handled internally)
        });
      });

      setPathSegments(breadcrumbs);
    },
    [workspaceId, t]
  );

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
