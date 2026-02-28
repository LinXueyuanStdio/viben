/**
 * GitHub Issues Component
 *
 * Displays issue list with filtering, selection, and AI analysis.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CircleDot,
  CircleCheck,
  RefreshCw,
  ExternalLink,
  Loader2,
  ChevronDown,
  Sparkles,
  FileDown,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useGitHubIssues } from "@/hooks/use-github";
import type { GitHubIssue, GitHubIssueInvestigation } from "@/lib/github-client";

interface GitHubIssuesProps {
  workspacePath: string;
}

export function GitHubIssues({ workspacePath }: GitHubIssuesProps) {
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
    investigateIssue,
    importIssues,
  } = useGitHubIssues(workspacePath);

  const [selectedIssues, setSelectedIssues] = useState<Set<number>>(new Set());
  const [investigationResult, setInvestigationResult] = useState<GitHubIssueInvestigation | null>(null);
  const [investigationDialogOpen, setInvestigationDialogOpen] = useState(false);
  const [investigating, setInvestigating] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleSelectAll = () => {
    if (selectedIssues.size === issues.length) {
      setSelectedIssues(new Set());
    } else {
      setSelectedIssues(new Set(issues.map((i) => i.number)));
    }
  };

  const handleSelectIssue = (issueNumber: number) => {
    const newSelected = new Set(selectedIssues);
    if (newSelected.has(issueNumber)) {
      newSelected.delete(issueNumber);
    } else {
      newSelected.add(issueNumber);
    }
    setSelectedIssues(newSelected);
  };

  const handleInvestigate = async (issueNumber: number) => {
    setInvestigating(true);
    setInvestigationDialogOpen(true);
    setInvestigationResult(null);

    const result = await investigateIssue(issueNumber, true);
    setInvestigationResult(result);
    setInvestigating(false);
  };

  const handleImportSelected = async () => {
    if (selectedIssues.size === 0) return;

    setImporting(true);
    await importIssues(Array.from(selectedIssues));
    setImporting(false);
    setSelectedIssues(new Set());
  };

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
                  <CircleDot className="h-3 w-3 text-green-500" />
                  {t("workspaceSettings.github.issues.open")}
                </span>
              </SelectItem>
              <SelectItem value="closed">
                <span className="flex items-center gap-2">
                  <CircleCheck className="h-3 w-3 text-purple-500" />
                  {t("workspaceSettings.github.issues.closed")}
                </span>
              </SelectItem>
              <SelectItem value="all">{t("workspaceSettings.github.issues.all")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {selectedIssues.size > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleImportSelected}
              disabled={importing}
            >
              {importing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              {t("workspaceSettings.github.issues.import")} ({selectedIssues.size})
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
          {error}
        </div>
      )}

      {/* Issues List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {/* Select All */}
          {issues.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
              <Checkbox
                checked={selectedIssues.size === issues.length && issues.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span>{t("common.selectAll")}</span>
            </div>
          )}

          {issues.map((issue) => (
            <IssueItem
              key={issue.id}
              issue={issue}
              selected={selectedIssues.has(issue.number)}
              onSelect={() => handleSelectIssue(issue.number)}
              onInvestigate={() => handleInvestigate(issue.number)}
              formatDate={formatDate}
            />
          ))}

          {issues.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              {t("workspaceSettings.github.issues.noIssues")}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {hasMore && !loading && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={loadMore}
            >
              <ChevronDown className="h-4 w-4 mr-2" />
              {t("common.loadMore")}
            </Button>
          )}
        </div>
      </ScrollArea>

      {/* Investigation Dialog */}
      <Dialog open={investigationDialogOpen} onOpenChange={setInvestigationDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("workspaceSettings.github.issues.investigationTitle")}</DialogTitle>
            <DialogDescription>
              {t("workspaceSettings.github.issues.investigationDescription")}
            </DialogDescription>
          </DialogHeader>

          {investigating ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">
                  {t("workspaceSettings.github.issues.analyzing")}
                </p>
              </div>
            </div>
          ) : investigationResult ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">
                    {t("workspaceSettings.github.issues.complexity")}
                  </div>
                  <Badge
                    variant={
                      investigationResult.complexity === "simple"
                        ? "default"
                        : investigationResult.complexity === "medium"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {investigationResult.complexity}
                  </Badge>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">
                    {t("workspaceSettings.github.issues.estimatedFiles")}
                  </div>
                  <div className="font-medium">{investigationResult.estimated_files}</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">
                  {t("workspaceSettings.github.issues.affectedAreas")}
                </div>
                <div className="flex flex-wrap gap-1">
                  {investigationResult.affected_areas.map((area) => (
                    <Badge key={area} variant="outline" className="text-xs">
                      {area}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">
                  {t("workspaceSettings.github.issues.implementationHints")}
                </div>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {investigationResult.implementation_hints.map((hint, i) => (
                    <li key={i}>{hint}</li>
                  ))}
                </ul>
              </div>

              {investigationResult.spec_path && (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-500/10 p-2 rounded">
                  <Check className="h-4 w-4" />
                  {t("workspaceSettings.github.issues.specSaved")}
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button onClick={() => setInvestigationDialogOpen(false)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Issue item component
interface IssueItemProps {
  issue: GitHubIssue;
  selected: boolean;
  onSelect: () => void;
  onInvestigate: () => void;
  formatDate: (date: string) => string;
}

function IssueItem({ issue, selected, onSelect, onInvestigate, formatDate }: IssueItemProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 border rounded-lg transition-colors",
        selected && "bg-primary/5 border-primary/30"
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={onSelect}
        className="mt-1"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {issue.state === "open" ? (
              <CircleDot className="h-4 w-4 text-green-500 shrink-0" />
            ) : (
              <CircleCheck className="h-4 w-4 text-purple-500 shrink-0" />
            )}
            <span className="font-medium text-sm truncate">
              #{issue.number} {issue.title}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={onInvestigate}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              {t("workspaceSettings.github.issues.analyze")}
            </Button>
            <a
              href={issue.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1">
          {issue.labels.slice(0, 3).map((label) => (
            <Badge
              key={label.id}
              variant="secondary"
              className="text-xs px-1.5 py-0"
              style={{
                backgroundColor: `#${label.color}20`,
                color: `#${label.color}`,
                borderColor: `#${label.color}40`,
              }}
            >
              {label.name}
            </Badge>
          ))}
          {issue.labels.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{issue.labels.length - 3}
            </span>
          )}
        </div>

        <div className="text-xs text-muted-foreground mt-1">
          {t("workspaceSettings.github.issues.openedBy", {
            user: issue.user.login,
            date: formatDate(issue.created_at),
          })}
          {issue.comments > 0 && (
            <span className="ml-2">
              {issue.comments} {t("workspaceSettings.github.issues.comments")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
