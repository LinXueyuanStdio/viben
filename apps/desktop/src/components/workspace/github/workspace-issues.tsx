/**
 * Workspace Issues Component
 *
 * Main container for GitHub Issues management in workspace.
 * Displays issue list with filtering, selection, and detail panel.
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  Loader2,
  Github,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useGitHubAuth, useGitHubRepository, useGitHubIssues } from "@/hooks/use-github";
import { useGitHubStore } from "@/stores/github-store";
import { getGitHubClient } from "@/lib/github-client";
import { IssueListHeader } from "./issue-list-header";
import { IssueList } from "./issue-list";
import { IssueDetail } from "./issue-detail";
import { AutoFixQueue } from "./auto-fix-queue";
import type { GitHubIssue } from "@/lib/github-client";

interface WorkspaceIssuesProps {
  workspacePath: string;
}

export function WorkspaceIssues({ workspacePath }: WorkspaceIssuesProps) {
  const { t } = useTranslation();
  const [showQueue, setShowQueue] = useState(false);

  // Auth and repo hooks
  const auth = useGitHubAuth(workspacePath);
  const repo = useGitHubRepository(workspacePath);

  // Store state
  const {
    currentIssue,
    selectIssue,
    selectedIssueNumbers,
    toggleIssueSelection,
    selectAllIssues,
    clearSelection,
    filters,
    setFilters,
    setIssues,
    setIssuesLoading,
    setIssuesError,
    setHasMore,
    setAuthStatus,
    setRepoInfo,
    setInitialized,
    autoFixTasks,
    addAutoFixTask,
    updateAutoFixTask,
    getRunningTasksCount,
    getAwaitingApprovalCount,
    reset,
  } = useGitHubStore();

  // Issues hook - use store's filter state as single source of truth
  const {
    issues,
    loading,
    error,
    hasMore,
    refresh,
    loadMore,
    investigateIssue,
    importIssues,
  } = useGitHubIssues(workspacePath, { stateFilter: filters.state });

  const isAuthenticated = auth.status?.authenticated ?? false;
  const hasRepository = repo.repository !== null;

  // Sync issues hook state to store
  useEffect(() => {
    setIssues(issues);
    setIssuesLoading(loading);
    setIssuesError(error);
    setHasMore(hasMore);
  }, [issues, loading, error, hasMore, setIssues, setIssuesLoading, setIssuesError, setHasMore]);

  // Sync auth and repo state to store
  useEffect(() => {
    if (auth.loading) {
      setAuthStatus("checking");
    } else if (auth.status?.authenticated) {
      setAuthStatus("authenticated");
    } else {
      setAuthStatus("not_authenticated");
    }
  }, [auth.status, auth.loading, setAuthStatus]);

  useEffect(() => {
    setRepoInfo(repo.repository);
  }, [repo.repository, setRepoInfo]);

  // Mark as initialized when data is loaded
  useEffect(() => {
    if (!auth.loading && !repo.loading) {
      setInitialized(true);
    }
  }, [auth.loading, repo.loading, setInitialized]);

  // Reset store on workspace change
  useEffect(() => {
    return () => {
      reset();
    };
  }, [workspacePath, reset]);

  // Single source of truth: store manages filter state
  const handleStateFilterChange = useCallback(
    (state: "open" | "closed" | "all") => {
      setFilters({ state });
    },
    [setFilters]
  );

  const handleSelectIssue = useCallback(
    (issue: GitHubIssue) => {
      selectIssue(issue);
    },
    [selectIssue]
  );

  const handleCloseDetail = useCallback(() => {
    selectIssue(null);
  }, [selectIssue]);

  const handleSelectAll = useCallback(() => {
    if (selectedIssueNumbers.size === issues.length) {
      clearSelection();
    } else {
      selectAllIssues();
    }
  }, [selectedIssueNumbers.size, issues.length, clearSelection, selectAllIssues]);

  // Auto-fix handlers
  const handleStartAutoFix = useCallback(async (issueNumber: number) => {
    try {
      const client = getGitHubClient();
      const { task_id } = await client.createAutoFixTask(workspacePath, [issueNumber]);

      // Add task to store
      addAutoFixTask({
        id: task_id,
        workspace_path: workspacePath,
        issue_numbers: [issueNumber],
        status: "queued",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to start auto-fix:", error);
    }
  }, [workspacePath, addAutoFixTask]);

  const handleCancelAutoFix = useCallback(async (taskId: string) => {
    try {
      const client = getGitHubClient();
      await client.cancelAutoFixTask(workspacePath, taskId);
      updateAutoFixTask(taskId, { status: "cancelled" });
    } catch (error) {
      console.error("Failed to cancel auto-fix:", error);
    }
  }, [workspacePath, updateAutoFixTask]);

  const handleApproveAutoFix = useCallback(async (taskId: string) => {
    try {
      const client = getGitHubClient();
      await client.approveAutoFixTask(workspacePath, taskId);
      updateAutoFixTask(taskId, { status: "creating_pr" });
    } catch (error) {
      console.error("Failed to approve auto-fix:", error);
    }
  }, [workspacePath, updateAutoFixTask]);

  const runningCount = getRunningTasksCount();
  const awaitingCount = getAwaitingApprovalCount();

  // Auth guard
  if (auth.loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <Github className="h-16 w-16 text-muted-foreground" />
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">
            {t("workspaceSettings.github.authRequired")}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {t("workspaceSettings.github.description")}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            // Navigate to workspace settings GitHub section
            window.location.hash = "#/workspace-settings/github";
          }}
        >
          {t("workspaceSettings.github.auth.authenticate")}
        </Button>
      </div>
    );
  }

  // Repo guard
  if (repo.loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasRepository) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <AlertCircle className="h-16 w-16 text-muted-foreground" />
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">
            {t("workspaceSettings.github.repoRequired")}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {t("workspaceSettings.github.description")}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            window.location.hash = "#/workspace-settings/github";
          }}
        >
          {t("workspaceSettings.github.repo.connect")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Issue list panel */}
        <div
          className={cn(
            "flex flex-col border-r border-border transition-all duration-300",
            currentIssue ? "w-2/5" : "w-full"
          )}
        >
          {/* Header with filters */}
          <IssueListHeader
            stateFilter={filters.state}
            onStateFilterChange={handleStateFilterChange}
            searchQuery={filters.search}
            onSearchChange={(search) => setFilters({ search })}
            selectedCount={selectedIssueNumbers.size}
            totalCount={issues.length}
            onSelectAll={handleSelectAll}
            onRefresh={refresh}
            isLoading={loading}
            onImportSelected={async () => {
              const selected = Array.from(selectedIssueNumbers);
              if (selected.length > 0) {
                await importIssues(selected);
                clearSelection();
              }
            }}
          />

          {/* Issue list */}
          <ScrollArea className="flex-1">
            <IssueList
              issues={issues}
              loading={loading}
              error={error}
              hasMore={hasMore}
              selectedIssue={currentIssue}
              selectedNumbers={selectedIssueNumbers}
              onSelectIssue={handleSelectIssue}
              onToggleSelection={toggleIssueSelection}
              onLoadMore={loadMore}
            />
          </ScrollArea>
        </div>

        {/* Detail panel */}
        {currentIssue && (
          <div className="flex-1 min-w-0 border-l border-border">
            <IssueDetail
              issue={currentIssue}
              workspacePath={workspacePath}
              onClose={handleCloseDetail}
              onAnalyze={investigateIssue}
              onStartAutoFix={handleStartAutoFix}
            />
          </div>
        )}
      </div>

      {/* Auto-fix queue status bar */}
      {autoFixTasks.length > 0 && (
        <div
          className={cn(
            "border-t border-border bg-muted/30 transition-all duration-300",
            showQueue ? "h-64" : "h-10"
          )}
        >
          {/* Status bar header */}
          <button
            onClick={() => setShowQueue(!showQueue)}
            className="w-full h-10 px-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium">
                {t("workspaceSettings.github.autoFix.queue")}
              </span>
              {runningCount > 0 && (
                <span className="flex items-center gap-1 text-blue-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {runningCount} {t("workspaceSettings.github.autoFix.running")}
                </span>
              )}
              {awaitingCount > 0 && (
                <span className="text-amber-600">
                  {awaitingCount} {t("workspaceSettings.github.autoFix.awaitingApproval")}
                </span>
              )}
            </div>
            <RefreshCw
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                showQueue && "rotate-180"
              )}
            />
          </button>

          {/* Queue content */}
          {showQueue && (
            <ScrollArea className="h-[calc(100%-2.5rem)]">
              <AutoFixQueue
                tasks={autoFixTasks}
                onCancel={handleCancelAutoFix}
                onApprove={handleApproveAutoFix}
              />
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
