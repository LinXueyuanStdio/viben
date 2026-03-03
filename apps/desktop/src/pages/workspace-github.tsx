/**
 * Workspace GitHub Page
 *
 * GitHub management page for workspace (shown only when integrated):
 * - Issues list and management
 * - Pull requests list
 * - Releases list
 *
 * Design inspired by GitHub's official interface.
 */
import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Github,
  Loader2,
  ArrowLeft,
  CircleDot,
  GitPullRequest,
  GitMerge,
  Tag,
  Settings,
  ExternalLink,
  Search,
  MessageSquare,
  Milestone,
  CheckCircle2,
  Plus,
  Minus,
  FileCode,
  Download,
  Star,
  GitFork,
  RefreshCw,
  CircleX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocalWorkspaces } from "@/hooks";
import { useGitHubAuth, useGitHubRepository, useGitHubIssues, useGitHubPRs, useGitHubReleases } from "@/hooks/use-github";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/types";
import type { GitHubIssue, GitHubPullRequest, GitHubRelease } from "@/lib/github-client";

// ============================================================================
// Props
// ============================================================================

interface WorkspaceGitHubPageProps {
  embeddedMode?: boolean;
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

  const workspaceId = workspaceOverride?.id ?? routeWorkspaceId;
  const workspace = workspaceOverride ?? (workspaceId ? getWorkspace(workspaceId) : undefined);

  const auth = useGitHubAuth(workspace?.path ?? null);
  const repo = useGitHubRepository(workspace?.path ?? null);

  const [activeTab, setActiveTab] = useState<string>("issues");

  const isAuthenticated = auth.status?.authenticated ?? false;
  const hasRepository = repo.repository !== null;
  const isIntegrated = isAuthenticated && hasRepository;

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

  if (isLoadingWorkspaces && !embeddedMode) {
    return wrapContent(
      <>
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </>
    );
  }

  if (!workspace && workspaces.length > 0) {
    return wrapContent(
      <>
        <Github className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t("workspace.notFound")}</h2>
        <p className="text-muted-foreground mb-4">{t("workspace.notFoundDesc")}</p>
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

  if (!workspace) {
    return wrapContent(
      <>
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </>
    );
  }

  if (auth.loading || repo.loading) {
    return wrapContent(
      <>
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </>
    );
  }

  if (!isIntegrated) {
    return wrapContent(
      <>
        <Github className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t("workspaceSettings.github.notIntegrated")}</h2>
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
      {!embeddedMode && (
        <WorkspaceHeader
          workspace={workspace}
          segments={[{ label: "GitHub", href: `/workspace/${workspaceId}/github` }]}
          showRemove={false}
        />
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Repository Header - GitHub style */}
        <div className="border-b bg-muted/30 px-6 py-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Github className="h-6 w-6" />
                <div>
                  <h1 className="text-xl font-semibold flex items-center gap-2">
                    <span className="text-muted-foreground">{repo.repository?.owner}/</span>
                    <span>{repo.repository?.name}</span>
                  </h1>
                  {repo.repository?.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{repo.repository.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {repo.repository?.stargazers_count !== undefined && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-4 w-4" />
                    {repo.repository.stargazers_count.toLocaleString()}
                  </div>
                )}
                {repo.repository?.forks_count !== undefined && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <GitFork className="h-4 w-4" />
                    {repo.repository.forks_count.toLocaleString()}
                  </div>
                )}
                <Button variant="outline" size="sm" asChild>
                  <a href={repo.repository?.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t("workspaceSettings.github.viewOnGitHub")}
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="border-b w-full justify-start rounded-none bg-transparent p-0 h-auto">
                <TabsTrigger
                  value="issues"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                >
                  <CircleDot className="h-4 w-4 mr-2" />
                  {t("workspaceSettings.github.tabs.issues")}
                </TabsTrigger>
                <TabsTrigger
                  value="prs"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                >
                  <GitPullRequest className="h-4 w-4 mr-2" />
                  {t("workspaceSettings.github.tabs.pullRequests")}
                </TabsTrigger>
                <TabsTrigger
                  value="releases"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                >
                  <Tag className="h-4 w-4 mr-2" />
                  {t("workspaceSettings.github.tabs.releases")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="issues" className="mt-4">
                <IssuesTab workspacePath={workspace.path} />
              </TabsContent>

              <TabsContent value="prs" className="mt-4">
                <PRsTab workspacePath={workspace.path} />
              </TabsContent>

              <TabsContent value="releases" className="mt-4">
                <ReleasesTab workspacePath={workspace.path} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </>
  );

  if (embeddedMode) {
    return <div className="flex flex-col h-full">{content}</div>;
  }

  return <PageWrapper className="flex flex-col h-full">{content}</PageWrapper>;
}

// ============================================================================
// Issues Tab - GitHub Style
// ============================================================================

function IssuesTab({ workspacePath }: { workspacePath: string }) {
  const { t } = useTranslation();
  const {
    issues,
    loading,
    error,
    hasMore,
    stateFilter,
    setStateFilter,
    refresh,
    loadMore,
  } = useGitHubIssues(workspacePath);

  const [searchQuery, setSearchQuery] = useState("");

  const filteredIssues = useMemo(() => {
    if (!searchQuery.trim()) return issues;
    const query = searchQuery.toLowerCase();
    return issues.filter(
      (issue) =>
        issue.title.toLowerCase().includes(query) ||
        issue.number.toString().includes(query)
    );
  }, [issues, searchQuery]);

  const openCount = issues.filter((i) => i.state === "open").length;
  const closedCount = issues.filter((i) => i.state === "closed").length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("workspaceSettings.github.searchIssues")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center rounded-lg border divide-x">
          <button
            onClick={() => setStateFilter("open")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm transition-colors",
              stateFilter === "open" ? "bg-muted font-medium" : "hover:bg-muted/50"
            )}
          >
            <CircleDot className="h-4 w-4 text-green-600" />
            {openCount} {t("workspaceSettings.github.issues.open")}
          </button>
          <button
            onClick={() => setStateFilter("closed")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm transition-colors",
              stateFilter === "closed" ? "bg-muted font-medium" : "hover:bg-muted/50"
            )}
          >
            <CheckCircle2 className="h-4 w-4 text-purple-600" />
            {closedCount} {t("workspaceSettings.github.issues.closed")}
          </button>
        </div>

        <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
          {error}
        </div>
      )}

      {/* Issues List */}
      <div className="border rounded-lg overflow-hidden">
        {filteredIssues.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CircleDot className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>{t("workspaceSettings.github.issues.noIssues")}</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredIssues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-4 border-t">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {hasMore && !loading && (
          <button
            onClick={loadMore}
            className="w-full py-3 text-sm text-primary hover:bg-muted/50 transition-colors border-t"
          >
            {t("common.loadMore")}
          </button>
        )}
      </div>
    </div>
  );
}

function IssueRow({ issue }: { issue: GitHubIssue }) {
  const { t } = useTranslation();

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t("common.today");
    if (diffDays === 1) return t("common.yesterday");
    if (diffDays < 7) return t("common.daysAgo", { count: diffDays });
    if (diffDays < 30) return t("common.weeksAgo", { count: Math.floor(diffDays / 7) });
    return date.toLocaleDateString();
  };

  return (
    <div className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors">
      {issue.state === "open" ? (
        <CircleDot className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
      ) : (
        <CheckCircle2 className="h-5 w-5 text-purple-600 mt-0.5 shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <a
            href={issue.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-sm hover:text-primary transition-colors"
          >
            {issue.title}
          </a>
          {issue.labels.map((label) => (
            <Badge
              key={label.id}
              className="text-xs px-1.5 py-0 font-medium shrink-0"
              style={{
                backgroundColor: `#${label.color}20`,
                color: `#${label.color}`,
                border: `1px solid #${label.color}40`,
              }}
            >
              {label.name}
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>#{issue.number}</span>
          <span>
            {t("workspaceSettings.github.issues.openedBy", {
              user: issue.user.login,
              date: formatRelativeTime(issue.created_at),
            })}
          </span>
          {issue.milestone && (
            <span className="flex items-center gap-1">
              <Milestone className="h-3 w-3" />
              {issue.milestone.title}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {issue.assignees && issue.assignees.length > 0 && (
          <div className="flex -space-x-1">
            {issue.assignees.slice(0, 3).map((assignee) => (
              <Tooltip key={assignee.id}>
                <TooltipTrigger>
                  <Avatar className="h-5 w-5 border-2 border-background">
                    <AvatarImage src={assignee.avatar_url} />
                    <AvatarFallback className="text-xs">{assignee.login[0]}</AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>{assignee.login}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}

        {issue.comments > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            {issue.comments}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PRs Tab - GitHub Style
// ============================================================================

function PRsTab({ workspacePath }: { workspacePath: string }) {
  const { t } = useTranslation();
  const {
    prs,
    loading,
    error,
    hasMore,
    stateFilter,
    setStateFilter,
    refresh,
    loadMore,
  } = useGitHubPRs(workspacePath);

  const [searchQuery, setSearchQuery] = useState("");

  const filteredPRs = useMemo(() => {
    if (!searchQuery.trim()) return prs;
    const query = searchQuery.toLowerCase();
    return prs.filter(
      (pr) =>
        pr.title.toLowerCase().includes(query) ||
        pr.number.toString().includes(query)
    );
  }, [prs, searchQuery]);

  const openCount = prs.filter((p) => p.state === "open").length;
  const closedCount = prs.filter((p) => p.state === "closed").length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("workspaceSettings.github.searchPRs")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center rounded-lg border divide-x">
          <button
            onClick={() => setStateFilter("open")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm transition-colors",
              stateFilter === "open" ? "bg-muted font-medium" : "hover:bg-muted/50"
            )}
          >
            <GitPullRequest className="h-4 w-4 text-green-600" />
            {openCount} {t("workspaceSettings.github.prs.open")}
          </button>
          <button
            onClick={() => setStateFilter("closed")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm transition-colors",
              stateFilter === "closed" ? "bg-muted font-medium" : "hover:bg-muted/50"
            )}
          >
            <GitMerge className="h-4 w-4 text-purple-600" />
            {closedCount} {t("workspaceSettings.github.prs.closed")}
          </button>
        </div>

        <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
          {error}
        </div>
      )}

      {/* PRs List */}
      <div className="border rounded-lg overflow-hidden">
        {filteredPRs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <GitPullRequest className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>{t("workspaceSettings.github.prs.noPRs")}</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredPRs.map((pr) => (
              <PRRow key={pr.id} pr={pr} />
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-4 border-t">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {hasMore && !loading && (
          <button
            onClick={loadMore}
            className="w-full py-3 text-sm text-primary hover:bg-muted/50 transition-colors border-t"
          >
            {t("common.loadMore")}
          </button>
        )}
      </div>
    </div>
  );
}

function PRRow({ pr }: { pr: GitHubPullRequest }) {
  const { t } = useTranslation();

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t("common.today");
    if (diffDays === 1) return t("common.yesterday");
    if (diffDays < 7) return t("common.daysAgo", { count: diffDays });
    if (diffDays < 30) return t("common.weeksAgo", { count: Math.floor(diffDays / 7) });
    return date.toLocaleDateString();
  };

  const getStatusIcon = () => {
    if (pr.merged) {
      return <GitMerge className="h-5 w-5 text-purple-600 mt-0.5 shrink-0" />;
    }
    if (pr.state === "closed") {
      return <CircleX className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />;
    }
    if (pr.draft) {
      return <GitPullRequest className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />;
    }
    return <GitPullRequest className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />;
  };

  return (
    <div className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors">
      {getStatusIcon()}

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <a
            href={pr.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-sm hover:text-primary transition-colors"
          >
            {pr.title}
          </a>
          {pr.draft && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {t("workspaceSettings.github.prs.draft")}
            </Badge>
          )}
          {pr.labels?.map((label) => (
            <Badge
              key={label.id}
              className="text-xs px-1.5 py-0 font-medium shrink-0"
              style={{
                backgroundColor: `#${label.color}20`,
                color: `#${label.color}`,
                border: `1px solid #${label.color}40`,
              }}
            >
              {label.name}
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>#{pr.number}</span>
          <span>
            {t("workspaceSettings.github.prs.openedBy", {
              user: pr.user.login,
              date: formatRelativeTime(pr.created_at),
            })}
          </span>
          <span className="font-mono text-xs">
            {pr.head.ref} → {pr.base.ref}
          </span>
        </div>

        {/* Changes stats */}
        <div className="flex items-center gap-3 mt-2 text-xs">
          <span className="flex items-center gap-1 text-green-600">
            <Plus className="h-3 w-3" />
            {pr.additions?.toLocaleString() ?? 0}
          </span>
          <span className="flex items-center gap-1 text-red-600">
            <Minus className="h-3 w-3" />
            {pr.deletions?.toLocaleString() ?? 0}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <FileCode className="h-3 w-3" />
            {pr.changed_files ?? 0} {t("workspaceSettings.github.prs.files")}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {pr.assignees && pr.assignees.length > 0 && (
          <div className="flex -space-x-1">
            {pr.assignees.slice(0, 3).map((assignee) => (
              <Tooltip key={assignee.id}>
                <TooltipTrigger>
                  <Avatar className="h-5 w-5 border-2 border-background">
                    <AvatarImage src={assignee.avatar_url} />
                    <AvatarFallback className="text-xs">{assignee.login[0]}</AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>{assignee.login}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}

        {pr.comments > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            {pr.comments}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Releases Tab - GitHub Style
// ============================================================================

function ReleasesTab({ workspacePath }: { workspacePath: string }) {
  const { t } = useTranslation();
  const {
    releases,
    loading,
    error,
    hasMore,
    refresh,
    loadMore,
  } = useGitHubReleases(workspacePath);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {releases.length} {t("workspaceSettings.github.releases.title")}
        </h3>
        <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
          {error}
        </div>
      )}

      {/* Releases List */}
      {releases.length === 0 && !loading ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <Tag className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{t("workspaceSettings.github.releases.noReleases")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {releases.map((release, index) => (
            <ReleaseCard key={release.id} release={release} isLatest={index === 0} />
          ))}

          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {hasMore && !loading && (
            <Button variant="outline" className="w-full" onClick={loadMore}>
              {t("common.loadMore")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ReleaseCard({ release, isLatest }: { release: GitHubRelease; isLatest: boolean }) {
  const { t } = useTranslation();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-4 bg-muted/30">
        <div className="flex items-start gap-3">
          <Tag className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <div className="flex items-center gap-2">
              <a
                href={release.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-semibold hover:text-primary transition-colors"
              >
                {release.tag_name}
              </a>
              {isLatest && (
                <Badge className="bg-green-600 text-white">
                  {t("workspaceSettings.github.releases.latest")}
                </Badge>
              )}
              {release.prerelease && (
                <Badge variant="secondary">
                  {t("workspaceSettings.github.releases.prerelease")}
                </Badge>
              )}
              {release.draft && (
                <Badge variant="outline">
                  {t("workspaceSettings.github.releases.draft")}
                </Badge>
              )}
            </div>
            {release.name && release.name !== release.tag_name && (
              <p className="text-sm mt-0.5">{release.name}</p>
            )}
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Avatar className="h-4 w-4">
                <AvatarImage src={release.author.avatar_url} />
                <AvatarFallback>{release.author.login[0]}</AvatarFallback>
              </Avatar>
              <span>{release.author.login}</span>
              <span>·</span>
              <span>
                {formatDate(release.published_at || release.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      {release.body && (
        <div className="p-4 border-t text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
          {release.body}
        </div>
      )}

      {/* Assets */}
      {release.assets.length > 0 && (
        <div className="p-4 border-t bg-muted/20">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            {t("workspaceSettings.github.releases.assets")} ({release.assets.length})
          </div>
          <div className="grid gap-2">
            {release.assets.slice(0, 5).map((asset) => (
              <a
                key={asset.id}
                href={asset.browser_download_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 rounded-lg bg-background border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium truncate">{asset.name}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {formatSize(asset.size)}
                </span>
              </a>
            ))}
            {release.assets.length > 5 && (
              <span className="text-xs text-muted-foreground text-center py-1">
                +{release.assets.length - 5} {t("workspaceSettings.github.releases.moreAssets")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
