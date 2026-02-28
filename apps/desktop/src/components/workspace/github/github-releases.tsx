/**
 * GitHub Releases Component
 *
 * Displays release list.
 */

import { useTranslation } from "react-i18next";
import {
  Tag,
  RefreshCw,
  ExternalLink,
  Loader2,
  ChevronDown,
  Download,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useGitHubReleases } from "@/hooks/use-github";
import type { GitHubRelease } from "@/lib/github-client";

interface GitHubReleasesProps {
  workspacePath: string;
}

export function GitHubReleases({ workspacePath }: GitHubReleasesProps) {
  const { t } = useTranslation();
  const {
    releases,
    loading,
    error,
    hasMore,
    refresh,
    loadMore,
  } = useGitHubReleases(workspacePath);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          {t("workspaceSettings.github.releases.title")}
        </h3>
        <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
          {error}
        </div>
      )}

      {/* Releases List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {releases.map((release, index) => (
            <ReleaseItem
              key={release.id}
              release={release}
              isLatest={index === 0}
              formatDate={formatDate}
              formatSize={formatSize}
            />
          ))}

          {releases.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              {t("workspaceSettings.github.releases.noReleases")}
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

// Release item component
interface ReleaseItemProps {
  release: GitHubRelease;
  isLatest: boolean;
  formatDate: (date: string) => string;
  formatSize: (bytes: number) => string;
}

function ReleaseItem({ release, isLatest, formatDate, formatSize }: ReleaseItemProps) {
  const { t } = useTranslation();

  return (
    <div className="p-3 border rounded-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">
            {release.tag_name}
          </span>
          {isLatest && (
            <Badge className="text-xs">
              {t("workspaceSettings.github.releases.latest")}
            </Badge>
          )}
          {release.prerelease && (
            <Badge variant="secondary" className="text-xs">
              {t("workspaceSettings.github.releases.prerelease")}
            </Badge>
          )}
          {release.draft && (
            <Badge variant="outline" className="text-xs">
              {t("workspaceSettings.github.releases.draft")}
            </Badge>
          )}
        </div>
        <a
          href={release.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {release.name && release.name !== release.tag_name && (
        <div className="text-sm mt-1">{release.name}</div>
      )}

      {release.body && (
        <div className="text-xs text-muted-foreground mt-2 line-clamp-2">
          {release.body}
        </div>
      )}

      {/* Assets */}
      {release.assets.length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {t("workspaceSettings.github.releases.assets")}
          </div>
          <div className="grid gap-1">
            {release.assets.slice(0, 3).map((asset) => (
              <a
                key={asset.id}
                href={asset.browser_download_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/50 hover:bg-muted transition-colors"
              >
                <span className="truncate">{asset.name}</span>
                <span className="flex items-center gap-2 text-muted-foreground shrink-0">
                  <span>{formatSize(asset.size)}</span>
                  <Download className="h-3 w-3" />
                </span>
              </a>
            ))}
            {release.assets.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{release.assets.length - 3} {t("workspaceSettings.github.releases.moreAssets")}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground mt-2">
        {t("workspaceSettings.github.releases.publishedBy", {
          user: release.author.login,
          date: release.published_at ? formatDate(release.published_at) : formatDate(release.created_at),
        })}
      </div>
    </div>
  );
}
