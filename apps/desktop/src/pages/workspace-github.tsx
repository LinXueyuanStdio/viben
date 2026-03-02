/**
 * Workspace GitHub Page
 *
 * GitHub management page for workspace (shown only when integrated):
 * - Issues list and management
 * - Pull requests list
 * - Releases list
 *
 * Note: Authentication and repository connection are configured in
 * Workspace Settings > GitHub section.
 */
import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Github,
  Loader2,
  ArrowLeft,
  CircleDot,
  GitPullRequest,
  Tag,
  Settings,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { useLocalWorkspaces } from "@/hooks";
import { useGitHubAuth, useGitHubRepository } from "@/hooks/use-github";
import {
  GitHubIssues,
  GitHubPRs,
  GitHubReleases,
} from "@/components/workspace/github";
import type { Workspace } from "@/types";

// ============================================================================
// Props
// ============================================================================

interface WorkspaceGitHubPageProps {
  /**
   * When true, the page is rendered inside another component (e.g., settings)
   */
  embeddedMode?: boolean;
  /**
   * Override workspace object (used in embedded mode)
   */
  workspaceOverride?: Workspace;
}

// ============================================================================
// Main Component
// ============================================================================

export function WorkspaceGitHubPage({
  embeddedMode = false,
  workspaceOverride,
}: WorkspaceGitHubPageProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceId: routeWorkspaceId } = useParams<{ workspaceId: string }>();
  const { getWorkspace, isLoading: isLoadingWorkspaces, workspaces } = useLocalWorkspaces();

  // Use override if provided, otherwise use route param
  const workspaceId = workspaceOverride?.id ?? routeWorkspaceId;
  const workspace = workspaceOverride ?? (workspaceId ? getWorkspace(workspaceId) : undefined);

  // GitHub hooks
  const auth = useGitHubAuth(workspace?.path ?? null);
  const repo = useGitHubRepository(workspace?.path ?? null);

  // UI state
  const [activeTab, setActiveTab] = useState<string>("issues");

  const isAuthenticated = auth.status?.authenticated ?? false;
  const hasRepository = repo.repository !== null;
  const isIntegrated = isAuthenticated && hasRepository;

  // Helper to wrap content based on mode
  const wrapContent = (children: React.ReactNode) => {
    if (embeddedMode) {
      return <div className="flex flex-col items-center justify-center h-full">{children}</div>;
    }
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">{children}</div>
      </PageWrapper>
    );
  };

  // Show loading while workspaces are loading
  if (isLoadingWorkspaces && !embeddedMode) {
    return wrapContent(
      <>
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </>
    );
  }

  // Workspace not found
  if (!workspace && workspaces.length > 0) {
    return wrapContent(
      <>
        <Github className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {t("workspace.notFound")}
        </h2>
        <p className="text-muted-foreground mb-4">
          {t("workspace.notFoundDesc")}
        </p>
        {!embeddedMode && (
          <Button asChild>
            <Link to="/mcp-services/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("workspace.backToDashboard")}
            </Link>
          </Button>
        )}
      </>
    );
  }

  // Fallback loading
  if (!workspace) {
    return wrapContent(
      <>
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </>
    );
  }

  // Loading GitHub status
  if (auth.loading || repo.loading) {
    return wrapContent(
      <>
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </>
    );
  }

  // Not integrated - show message to configure in settings
  if (!isIntegrated) {
    return wrapContent(
      <>
        <Github className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {t("workspaceSettings.github.notIntegrated")}
        </h2>
        <p className="text-muted-foreground mb-4 text-center max-w-md">
          {t("workspaceSettings.github.notIntegratedDesc")}
        </p>
        {!embeddedMode && (
          <Button onClick={() => navigate(`/workspace/${workspaceId}/chat`)}>
            <Settings className="h-4 w-4 mr-2" />
            {t("workspaceSettings.github.goToSettings")}
          </Button>
        )}
      </>
    );
  }

  const content = (
    <>
      {/* Header with breadcrumb - only in normal mode */}
      {!embeddedMode && (
        <WorkspaceHeader
          workspace={workspace}
          segments={[
            { label: "GitHub", href: `/workspace/${workspaceId}/github` },
          ]}
          showRemove={false}
        />
      )}

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Repository Info Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Github className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">{repo.repository?.full_name}</h1>
                <p className="text-sm text-muted-foreground">
                  {repo.repository?.default_branch && `${t("workspaceSettings.github.defaultBranch")}: ${repo.repository.default_branch}`}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={repo.repository?.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                {t("workspaceSettings.github.viewOnGitHub")}
              </a>
            </Button>
          </div>

          {/* Tabs for Issues/PRs/Releases */}
          <div className="rounded-xl border bg-card p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="issues" className="flex items-center gap-2">
                  <CircleDot className="h-4 w-4" />
                  {t("workspaceSettings.github.tabs.issues")}
                </TabsTrigger>
                <TabsTrigger value="prs" className="flex items-center gap-2">
                  <GitPullRequest className="h-4 w-4" />
                  {t("workspaceSettings.github.tabs.pullRequests")}
                </TabsTrigger>
                <TabsTrigger value="releases" className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  {t("workspaceSettings.github.tabs.releases")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="issues" className="mt-0">
                <GitHubIssues workspacePath={workspace.path} />
              </TabsContent>

              <TabsContent value="prs" className="mt-0">
                <GitHubPRs workspacePath={workspace.path} />
              </TabsContent>

              <TabsContent value="releases" className="mt-0">
                <GitHubReleases workspacePath={workspace.path} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </>
  );

  // In embedded mode, don't wrap with PageWrapper
  if (embeddedMode) {
    return <div className="flex flex-col h-full">{content}</div>;
  }

  return <PageWrapper className="flex flex-col h-full">{content}</PageWrapper>;
}
