/**
 * Issue Detail Component
 *
 * Displays detailed information about a GitHub issue with tabs
 * for details, comments, AI analysis, and agent chat.
 */

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  ExternalLink,
  CircleDot,
  CircleCheck,
  User,
  Calendar,
  Tag,
  MessageSquare,
  Sparkles,
  Bot,
  Loader2,
  Play,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useGitHubStore } from "@/stores/github-store";
import { IssueAnalysisCard } from "./issue-analysis-card";
import { InvestigationDialog } from "./investigation-dialog";
import type { GitHubIssue, GitHubIssueInvestigation } from "@/lib/github-client";

interface IssueDetailProps {
  issue: GitHubIssue;
  workspacePath: string;
  onClose: () => void;
  onAnalyze: (issueNumber: number, saveSpec?: boolean) => Promise<GitHubIssueInvestigation | null>;
}

export function IssueDetail({
  issue,
  workspacePath: _workspacePath,
  onClose,
  onAnalyze,
}: IssueDetailProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>("details");
  const [investigating, setInvestigating] = useState(false);
  const [investigationDialogOpen, setInvestigationDialogOpen] = useState(false);
  const [investigationResult, setInvestigationResult] = useState<GitHubIssueInvestigation | null>(null);

  const {
    currentAnalysis,
    setCurrentAnalysis,
    analysisLoading,
    setAnalysisLoading,
  } = useGitHubStore();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleAnalyze = useCallback(async () => {
    setInvestigating(true);
    setInvestigationDialogOpen(true);
    setInvestigationResult(null);
    setAnalysisLoading(true);

    try {
      const result = await onAnalyze(issue.number, true);
      setInvestigationResult(result);

      if (result) {
        // Convert to IssueAnalysis format
        setCurrentAnalysis({
          issueNumber: issue.number,
          type: "bug", // TODO: Infer from result
          complexity: result.complexity as "trivial" | "low" | "medium" | "high" | "critical",
          summary: issue.title,
          requirements: [],
          acceptanceCriteria: [],
          affectedAreas: result.affected_areas,
          suggestedLabels: [],
          estimatedFiles: Array(result.estimated_files).fill("").map((_, i) => `file-${i + 1}`),
          risks: [],
          investigation: result,
        });
      }
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setInvestigating(false);
      setAnalysisLoading(false);
    }
  }, [issue.number, onAnalyze, setAnalysisLoading, setCurrentAnalysis]);

  const handleStartAutoFix = useCallback(() => {
    // TODO: Implement auto-fix start
    console.log("Start auto-fix for issue:", issue.number);
  }, [issue.number]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-border shrink-0">
        <div className="flex-1 min-w-0 pr-4">
          {/* Issue number and state */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm text-muted-foreground">
              #{issue.number}
            </span>
            <Badge
              variant={issue.state === "open" ? "default" : "secondary"}
              className={cn(
                "text-xs",
                issue.state === "open"
                  ? "bg-green-500/10 text-green-600 border-green-500/30"
                  : "bg-purple-500/10 text-purple-600 border-purple-500/30"
              )}
            >
              {issue.state === "open" ? (
                <CircleDot className="h-3 w-3 mr-1" />
              ) : (
                <CircleCheck className="h-3 w-3 mr-1" />
              )}
              {t(`workspaceSettings.github.issues.${issue.state}`)}
            </Badge>
          </div>

          {/* Title */}
          <h2 className="text-lg font-semibold font-serif line-clamp-2">
            {issue.title}
          </h2>

          {/* Author and date */}
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <Avatar className="h-5 w-5">
              <AvatarImage src={issue.user.avatar_url} alt={issue.user.login} />
              <AvatarFallback>{issue.user.login[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <span>{issue.user.login}</span>
            <span className="text-muted-foreground/50">|</span>
            <Calendar className="h-3 w-3" />
            <span>{formatDate(issue.created_at)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <a
            href={issue.html_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="mx-4 mt-2 shrink-0">
          <TabsTrigger value="details" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t("workspaceSettings.github.issues.details", "Details")}
          </TabsTrigger>
          <TabsTrigger value="comments" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {t("workspaceSettings.github.issues.comments", "Comments")}
            {issue.comments > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {issue.comments}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t("workspaceSettings.github.issues.aiAnalysis", "AI Analysis")}
          </TabsTrigger>
          <TabsTrigger value="agent" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            {t("workspaceSettings.github.issues.agentChat", "Agent")}
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              {/* Labels */}
              {issue.labels.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    {t("workspace.tags", "Labels")}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {issue.labels.map((label) => (
                      <Badge
                        key={label.id}
                        variant="secondary"
                        className="px-2 py-1"
                        style={{
                          backgroundColor: `#${label.color}20`,
                          color: `#${label.color}`,
                          borderColor: `#${label.color}40`,
                        }}
                      >
                        {label.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Assignees */}
              {issue.assignees.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {t("workspace.assignee", "Assignees")}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {issue.assignees.map((assignee) => (
                      <div
                        key={assignee.id}
                        className="flex items-center gap-2 bg-muted rounded-full pl-1 pr-3 py-1"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={assignee.avatar_url} alt={assignee.login} />
                          <AvatarFallback>{assignee.login[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{assignee.login}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Body */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  {t("workspace.description", "Description")}
                </h4>
                {issue.body ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {/* TODO: Render Markdown properly */}
                    <pre className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-lg">
                      {issue.body}
                    </pre>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No description provided.
                  </p>
                )}
              </div>

              {/* Timestamps */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  {t("workspace.timestamps", "Timestamps")}
                </h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>
                    {t("workspace.created", "Created")}: {formatDateTime(issue.created_at)}
                  </div>
                  <div>
                    {t("workspace.updated", "Updated")}: {formatDateTime(issue.updated_at)}
                  </div>
                  {issue.closed_at && (
                    <div>
                      Closed: {formatDateTime(issue.closed_at)}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleAnalyze}
                    disabled={investigating}
                    className="transition-all duration-200 hover:-translate-y-0.5"
                  >
                    {investigating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    {t("workspaceSettings.github.issues.runAnalysis", "Analyze")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleStartAutoFix}
                    disabled={investigating}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {t("workspaceSettings.github.issues.startAutoFix", "Auto Fix")}
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {issue.comments > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {/* TODO: Load and display comments */}
                  {issue.comments} {t("workspaceSettings.github.issues.comments")} - Loading comments coming soon...
                </p>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No comments yet.
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* AI Analysis Tab */}
        <TabsContent value="analysis" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {currentAnalysis && currentAnalysis.issueNumber === issue.number ? (
                <IssueAnalysisCard analysis={currentAnalysis} />
              ) : analysisLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                  <p className="text-sm text-muted-foreground">
                    {t("workspaceSettings.github.issues.analyzing")}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Sparkles className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground mb-4">
                    No analysis yet. Click the button below to analyze this issue.
                  </p>
                  <Button onClick={handleAnalyze}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {t("workspaceSettings.github.issues.runAnalysis", "Analyze")}
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Agent Chat Tab */}
        <TabsContent value="agent" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bot className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">
                  Agent chat integration coming soon...
                </p>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Investigation Dialog */}
      <InvestigationDialog
        open={investigationDialogOpen}
        onOpenChange={setInvestigationDialogOpen}
        investigating={investigating}
        result={investigationResult}
      />
    </div>
  );
}
