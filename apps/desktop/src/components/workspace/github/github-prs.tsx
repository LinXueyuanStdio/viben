/**
 * GitHub Pull Requests Component
 *
 * Displays PR list with filtering.
 */

import { useTranslation } from "react-i18next";
import {
  GitPullRequest,
  GitMerge,
  CircleX,
  RefreshCw,
  ExternalLink,
  Loader2,
  ChevronDown,
  Plus,
  Minus,
  FileCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useGitHubPRs } from "@/hooks/use-github";
import type { GitHubPullRequest } from "@/lib/github-client";

interface GitHubPRsProps {
  workspacePath: string;
}

export function GitHubPRs({ workspacePath }: GitHubPRsProps) {
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={stateFilter} onValueChange={(v: "open" | "closed" | "all") => setStateFilter(v)}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">
                <span className="flex items-center gap-2">
                  <GitPullRequest className="h-3 w-3 text-green-500" />
                  {t("workspaceSettings.github.prs.open")}
                </span>
              </SelectItem>
              <SelectItem value="closed">
                <span className="flex items-center gap-2">
                  <CircleX className="h-3 w-3 text-red-500" />
                  {t("workspaceSettings.github.prs.closed")}
                </span>
              </SelectItem>
              <SelectItem value="all">{t("workspaceSettings.github.prs.all")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
          {error}
        </div>
      )}

      {/* PRs List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {prs.map((pr) => (
            <PRItem key={pr.id} pr={pr} formatDate={formatDate} />
          ))}

          {prs.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              {t("workspaceSettings.github.prs.noPRs")}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {hasMore && !loading && (
            <Button variant="ghost" className="w-full" onClick={loadMore}>
              <ChevronDown className="h-4 w-4 mr-2" />
              {t("common.loadMore")}
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// PR item component
interface PRItemProps {
  pr: GitHubPullRequest;
  formatDate: (date: string) => string;
}

function PRItem({ pr, formatDate }: PRItemProps) {
  const { t } = useTranslation();

  const getStatusIcon = () => {
    if (pr.merged) {
      return <GitMerge className="h-4 w-4 text-purple-500" />;
    }
    if (pr.state === "closed") {
      return <CircleX className="h-4 w-4 text-red-500" />;
    }
    return <GitPullRequest className="h-4 w-4 text-green-500" />;
  };

  return (
    <div className="p-3 border rounded-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium text-sm truncate">
            #{pr.number} {pr.title}
          </span>
          {pr.draft && (
            <Badge variant="secondary" className="text-xs">
              {t("workspaceSettings.github.prs.draft")}
            </Badge>
          )}
        </div>
        <a
          href={pr.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          {pr.head.ref}
          <span className="text-muted-foreground/50">-&gt;</span>
          {pr.base.ref}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-2 text-xs">
        <span className="flex items-center gap-1 text-green-600">
          <Plus className="h-3 w-3" />
          {pr.additions}
        </span>
        <span className="flex items-center gap-1 text-red-600">
          <Minus className="h-3 w-3" />
          {pr.deletions}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <FileCode className="h-3 w-3" />
          {pr.changed_files} {t("workspaceSettings.github.prs.files")}
        </span>
      </div>

      <div className="text-xs text-muted-foreground mt-2">
        {t("workspaceSettings.github.prs.openedBy", {
          user: pr.user.login,
          date: formatDate(pr.created_at),
        })}
      </div>
    </div>
  );
}
