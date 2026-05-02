/**
 * GitHub Section Component
 *
 * Main container for GitHub integration in workspace settings.
 * Manages authentication state and tab navigation.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, CircleDot, GitPullRequest, Tag } from "lucide-react";
import { GithubIcon as Github } from "@/components/ui/icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGitHubAuth, useGitHubRepository } from "@/hooks/use-github";
import type { Workspace } from "@/types";
import { GitHubAuth } from "./github-auth";
import { GitHubRepository } from "./github-repository";
import { GitHubIssues } from "./github-issues";
import { GitHubPRs } from "./github-prs";
import { GitHubReleases } from "./github-releases";

interface GitHubSectionProps {
  workspace: Workspace;
}

export function GitHubSection({ workspace }: GitHubSectionProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>("issues");

  const auth = useGitHubAuth(workspace.path);
  const repo = useGitHubRepository(workspace.path);

  const isAuthenticated = auth.status?.authenticated ?? false;
  const hasRepository = repo.repository !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1 flex items-center gap-2">
          <Github className="h-5 w-5" />
          {t("workspaceSettings.github.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("workspaceSettings.github.description")}
        </p>
      </div>

      {/* Authentication Card */}
      <div className="rounded-xl border bg-card p-4">
        <GitHubAuth
          status={auth.status}
          loading={auth.loading}
          error={auth.error}
          onAuthenticateGhCli={auth.authenticateWithGhCli}
          onAuthenticatePAT={auth.authenticateWithPAT}
          onSignOut={auth.signOut}
        />
      </div>

      {/* Repository Card (only shown when authenticated) */}
      {isAuthenticated && (
        <div className="rounded-xl border bg-card p-4">
          <GitHubRepository
            repository={repo.repository}
            detectedRepository={repo.detectedRepository}
            loading={repo.loading}
            error={repo.error}
            onConnect={repo.connectRepository}
            onDisconnect={repo.disconnectRepository}
          />
        </div>
      )}

      {/* Main Content (only shown when authenticated and connected) */}
      {isAuthenticated && hasRepository && (
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
      )}

      {/* Placeholder when not authenticated */}
      {!isAuthenticated && !auth.loading && (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground bg-muted rounded-lg">
          <AlertCircle className="h-4 w-4" />
          {t("workspaceSettings.github.authRequired")}
        </div>
      )}

      {/* Placeholder when authenticated but no repository */}
      {isAuthenticated && !hasRepository && !repo.loading && (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground bg-muted rounded-lg">
          <AlertCircle className="h-4 w-4" />
          {t("workspaceSettings.github.repoRequired")}
        </div>
      )}
    </div>
  );
}
