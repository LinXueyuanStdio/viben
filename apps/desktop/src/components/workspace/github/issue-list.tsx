/**
 * Issue List Component
 *
 * Displays a list of GitHub issues with selection support.
 */

import { useTranslation } from "react-i18next";
import {
  CircleDot,
  CircleCheck,
  ExternalLink,
  Loader2,
  ChevronDown,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { GitHubIssue } from "@/lib/github-client";

interface IssueListProps {
  issues: GitHubIssue[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  selectedIssue: GitHubIssue | null;
  selectedNumbers: Set<number>;
  onSelectIssue: (issue: GitHubIssue) => void;
  onToggleSelection: (issueNumber: number) => void;
  onLoadMore: () => void;
}

export function IssueList({
  issues,
  loading,
  error,
  hasMore,
  selectedIssue,
  selectedNumbers,
  onSelectIssue,
  onToggleSelection,
  onLoadMore,
}: IssueListProps) {
  const { t } = useTranslation();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  if (error) {
    return (
      <div className="p-4">
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  if (!loading && issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CircleDot className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">
          {t("workspaceSettings.github.issues.noIssues")}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {issues.map((issue) => (
        <IssueListItem
          key={issue.id}
          issue={issue}
          isSelected={selectedIssue?.number === issue.number}
          isChecked={selectedNumbers.has(issue.number)}
          onSelect={() => onSelectIssue(issue)}
          onToggleCheck={() => onToggleSelection(issue.number)}
          formatDate={formatDate}
        />
      ))}

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Load more button */}
      {hasMore && !loading && (
        <div className="p-2">
          <Button
            variant="ghost"
            className="w-full h-9"
            onClick={onLoadMore}
          >
            <ChevronDown className="h-4 w-4 mr-2" />
            {t("common.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}

// Individual issue item component
interface IssueListItemProps {
  issue: GitHubIssue;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onToggleCheck: () => void;
  formatDate: (date: string) => string;
}

function IssueListItem({
  issue,
  isSelected,
  isChecked,
  onSelect,
  onToggleCheck,
  formatDate,
}: IssueListItemProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 cursor-pointer transition-colors",
        "hover:bg-muted/50",
        isSelected && "bg-primary/5 border-l-2 border-l-primary"
      )}
      onClick={onSelect}
    >
      {/* Checkbox */}
      <div
        className="pt-1"
        onClick={(e) => {
          e.stopPropagation();
          onToggleCheck();
        }}
      >
        <Checkbox checked={isChecked} />
      </div>

      {/* Issue content */}
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* State icon */}
            {issue.state === "open" ? (
              <CircleDot className="h-4 w-4 text-green-500 shrink-0" />
            ) : (
              <CircleCheck className="h-4 w-4 text-purple-500 shrink-0" />
            )}
            {/* Title */}
            <span className="font-medium text-sm truncate">
              #{issue.number} {issue.title}
            </span>
          </div>

          {/* External link */}
          <a
            href={issue.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground shrink-0 p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Labels */}
        {issue.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {issue.labels.slice(0, 4).map((label) => (
              <Badge
                key={label.id}
                variant="secondary"
                className="text-xs px-1.5 py-0 h-5"
                style={{
                  backgroundColor: `#${label.color}20`,
                  color: `#${label.color}`,
                  borderColor: `#${label.color}40`,
                }}
              >
                {label.name}
              </Badge>
            ))}
            {issue.labels.length > 4 && (
              <span className="text-xs text-muted-foreground">
                +{issue.labels.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
          <span>
            {t("workspaceSettings.github.issues.openedBy", {
              user: issue.user.login,
              date: formatDate(issue.created_at),
            })}
          </span>
          {issue.comments > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {issue.comments}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
