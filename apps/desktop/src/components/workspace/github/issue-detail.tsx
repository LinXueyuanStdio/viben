/**
 * Issue Detail Component
 *
 * Displays detailed information about a GitHub issue with tabs
 * for details, comments, AI analysis, and agent chat.
 */

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useGitHubStore } from "@/stores/github-store";
import { useGitHubComments } from "@/hooks/use-github";
import { IssueAnalysisCard } from "./issue-analysis-card";
import { InvestigationDialog } from "./investigation-dialog";
import type { GitHubIssue, GitHubComment, GitHubIssueInvestigation } from "@/lib/github-client";

/**
 * Markdown components for rendering GitHub content
 */
const markdownComponents = {
  // Code blocks
  pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className="bg-muted max-w-full overflow-x-auto rounded-lg p-4 my-2"
      {...props}
    >
      {children}
    </pre>
  ),
  // Inline code
  code: ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLElement> & { className?: string }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="bg-muted rounded px-1.5 py-0.5 text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  // Links - open in external browser
  a: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      onClick={async (e) => {
        e.preventDefault();
        if (href) {
          try {
            const { open } = await import("@tauri-apps/plugin-shell");
            await open(href);
          } catch {
            window.open(href, "_blank");
          }
        }
      }}
      className="text-primary cursor-pointer hover:underline"
      {...props}
    >
      {children}
    </a>
  ),
  // Tables
  table: ({ children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto my-2">
      <table className="border-border border-collapse border w-full" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th
      className="border-border bg-muted border px-3 py-2 text-left text-sm font-semibold"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="border-border border px-3 py-2 text-sm" {...props}>
      {children}
    </td>
  ),
  // Paragraphs
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="my-2 leading-relaxed" {...props}>
      {children}
    </p>
  ),
  // Headers
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="text-xl font-bold mt-4 mb-2" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="text-lg font-semibold mt-3 mb-2" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-base font-semibold mt-2 mb-1" {...props}>
      {children}
    </h3>
  ),
  // Lists
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc ml-4 my-2 space-y-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal ml-4 my-2 space-y-1" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) => (
    <li className="text-sm" {...props}>
      {children}
    </li>
  ),
  // Blockquote
  blockquote: ({
    children,
    ...props
  }: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="border-l-4 border-primary/30 pl-4 my-2 italic text-muted-foreground"
      {...props}
    >
      {children}
    </blockquote>
  ),
  // Horizontal rule
  hr: ({ ...props }: React.HTMLAttributes<HTMLHRElement>) => (
    <hr className="my-4 border-border" {...props} />
  ),
  // Images
  img: ({ alt, src, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img
      alt={alt}
      src={src}
      className="max-w-full h-auto rounded-lg my-2"
      {...props}
    />
  ),
};

/**
 * Comment item component
 */
function CommentItem({ comment, formatDateTime }: { comment: GitHubComment; formatDateTime: (date: string) => string }) {
  return (
    <div className="border border-border rounded-lg p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Avatar className="h-6 w-6">
          <AvatarImage src={comment.user.avatar_url} alt={comment.user.login} />
          <AvatarFallback>{comment.user.login[0].toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="font-medium text-sm">{comment.user.login}</span>
        <span className="text-xs text-muted-foreground">
          {formatDateTime(comment.created_at)}
        </span>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {comment.body}
        </ReactMarkdown>
      </div>
    </div>
  );
}

interface IssueDetailProps {
  issue: GitHubIssue;
  workspacePath: string;
  onClose: () => void;
  onAnalyze: (issueNumber: number, saveSpec?: boolean) => Promise<GitHubIssueInvestigation | null>;
  onStartAutoFix?: (issueNumber: number) => Promise<void>;
}

export function IssueDetail({
  issue,
  workspacePath,
  onClose,
  onAnalyze,
  onStartAutoFix,
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

  // Fetch comments when viewing the comments tab
  const {
    comments,
    loading: commentsLoading,
    error: commentsError,
    hasMore: commentsHasMore,
    refresh: refreshComments,
    loadMore: loadMoreComments,
  } = useGitHubComments(workspacePath, issue.number);

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
        // Map investigation complexity to analysis complexity
        const complexityMap: Record<typeof result.complexity, "trivial" | "low" | "medium" | "high" | "critical"> = {
          simple: "low",
          medium: "medium",
          complex: "high",
        };
        setCurrentAnalysis({
          issueNumber: issue.number,
          type: "bug", // TODO: Infer from result
          complexity: complexityMap[result.complexity] ?? "medium",
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

  const handleStartAutoFix = useCallback(async () => {
    if (onStartAutoFix) {
      await onStartAutoFix(issue.number);
    }
  }, [issue.number, onStartAutoFix]);

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
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {issue.body}
                    </ReactMarkdown>
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
              {/* Loading state */}
              {commentsLoading && comments.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                  <p className="text-sm text-muted-foreground">
                    {t("workspaceSettings.github.issues.loadingComments", "Loading comments...")}
                  </p>
                </div>
              )}

              {/* Error state */}
              {commentsError && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-sm text-destructive mb-4">
                    {commentsError}
                  </p>
                  <Button variant="outline" size="sm" onClick={refreshComments}>
                    {t("common.retry", "Retry")}
                  </Button>
                </div>
              )}

              {/* Empty state */}
              {!commentsLoading && !commentsError && comments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t("workspaceSettings.github.issues.noComments", "No comments yet.")}
                </p>
              )}

              {/* Comments list */}
              {comments.length > 0 && (
                <div>
                  {comments.map((comment) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      formatDateTime={formatDateTime}
                    />
                  ))}

                  {/* Load more button */}
                  {commentsHasMore && (
                    <div className="flex justify-center mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadMoreComments}
                        disabled={commentsLoading}
                      >
                        {commentsLoading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <ChevronDown className="h-4 w-4 mr-2" />
                        )}
                        {t("common.loadMore", "Load More")}
                      </Button>
                    </div>
                  )}
                </div>
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
