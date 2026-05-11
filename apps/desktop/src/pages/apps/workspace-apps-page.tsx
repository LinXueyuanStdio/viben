import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import { resolveHeaderSegments } from "@/navigation/page-index";
import { buildColdStartBreadcrumb, registry } from "@/navigation/navigate";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import { PageAppGrid } from "./components/page-app-grid";

export function WorkspaceAppsPage() {
  const { t } = useTranslation();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { getWorkspace, isLoading } = useLocalWorkspaces();
  const { currentStack } = useDesktopRouting();

  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;

  const segments = useMemo(() => {
    if (!workspaceId) {
      return [];
    }

    const url = registry.build("/workspace/:workspaceId/pages", { workspaceId });
    const stack = buildColdStartBreadcrumb(url);

    return resolveHeaderSegments({
      stack: currentStack,
      fallback: stack.slice(1).map((item) => ({
        id: item.id,
        label: item.label,
        href: item.href ?? "#",
        icon: item.icon,
        meta: item.meta,
      })),
    });
  }, [currentStack, workspaceId]);

  if (isLoading || !workspace) {
    return (
      <PageWrapper className="flex flex-col h-full">
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="flex flex-col h-full">
      <WorkspaceHeader
        workspace={workspace}
        segments={segments}
        showRefresh={false}
        showRemove={false}
      />
      <div className="min-h-0 flex-1 bg-background">
        <div className="border-b px-6 py-4">
          <h1 className="text-lg font-semibold">{t("page.pages", "Pages")}</h1>
        </div>
        <div className="min-h-0 h-[calc(100%-65px)]">
          <PageAppGrid
            workspaceId={workspace.id}
            workspacePath={workspace.path}
          />
        </div>
      </div>
    </PageWrapper>
  );
}

export default WorkspaceAppsPage;
