/**
 * Issue Detail Modal Component
 *
 * GitHub-style modal for displaying issue details with metadata, comments,
 * and task association. Designed to replicate GitHub's issue page experience.
 */

import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ExternalLink,
  CircleDot,
  CircleCheck,
  Calendar,
  Loader2,
  ChevronDown,
  Milestone,
  ListTodo,
  ArrowRight,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useGitHubComments } from "@/hooks/use-github";
import { createTask, getTasks } from "@/lib/vibe-kanban";
import type { Task } from "@/lib/vibe-kanban";
import type { GitHubIssue, GitHubComment } from "@/lib/github-client";

/**
 * Markdown components for rendering GitHub content
 */
const markdownComponents = {
  pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className="bg-muted/50 max-w-full overflow-x-auto rounded-md p-3 my-3 text-sm"
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLElement> & { className?: string }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="bg-muted/70 rounded px-1.5 py-0.5 text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={cn("text-sm", className)} {...props}>
        {children}
      </code>
    );
  },
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
      className="text-primary hover:underline"
      {...props}
    >
      {children}
    </a>
  ),
  table: ({ children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto my-3">
      <table className="border-collapse border border-border w-full text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th className="border border-border bg-muted/50 px-3 py-2 text-left font-semibold" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="border border-border px-3 py-2" {...props}>
      {children}
    </td>
  ),
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="my-3 leading-relaxed" {...props}>
      {children}
    </p>
  ),
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="text-xl font-bold mt-6 mb-3 pb-2 border-b border-border" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="text-lg font-semibold mt-5 mb-2 pb-1 border-b border-border" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-base font-semibold mt-4 mb-2" {...props}>
      {children}
    </h3>
  ),
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc pl-6 my-3 space-y-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal pl-6 my-3 space-y-1" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) => (
    <li {...props}>{children}</li>
  ),
  blockquote: ({
    children,
    ...props
  }: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="border-l-4 border-muted-foreground/30 pl-4 my-3 text-muted-foreground italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: ({ ...props }: React.HTMLAttributes<HTMLHRElement>) => (
    <hr className="my-6 border-border" {...props} />
  ),
  img: ({ alt, src, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img
      alt={alt}
      src={src}
      className="max-w-full h-auto rounded-md my-3"
      {...props}
    />
  ),
};

/**
 * Comment item component - GitHub style
 */
function CommentItem({
  comment,
  isFirst,
}: {
  comment: GitHubComment;
  isFirst?: boolean;
}) {
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <div className={cn("relative", !isFirst && "mt-4")}>
      {/* Timeline connector */}
      {!isFirst && (
        <div className="absolute left-5 -top-4 w-0.5 h-4 bg-border" />
      )}

      <div className="flex gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10 border-2 border-background">
            <AvatarImage src={comment.user.avatar_url} alt={comment.user.login} />
            <AvatarFallback className="text-sm font-medium">
              {comment.user.login[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Comment box */}
        <div className="flex-1 min-w-0">
          <div className="border border-border rounded-md overflow-hidden">
            {/* Header */}
            <div className="bg-muted/30 px-4 py-2 border-b border-border flex items-center gap-2">
              <span className="font-semibold text-sm">{comment.user.login}</span>
              <span className="text-muted-foreground text-sm">
                commented {formatRelativeTime(comment.created_at)}
              </span>
            </div>

            {/* Body */}
            <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {comment.body}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Issue body component - GitHub style
 */
function IssueBody({ issue }: { issue: GitHubIssue }) {
  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="shrink-0">
        <Avatar className="h-10 w-10 border-2 border-background">
          <AvatarImage src={issue.user.avatar_url} alt={issue.user.login} />
          <AvatarFallback className="text-sm font-medium">
            {issue.user.login[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Issue body box */}
      <div className="flex-1 min-w-0">
        <div className="border border-border rounded-md overflow-hidden">
          {/* Header */}
          <div className="bg-muted/30 px-4 py-2 border-b border-border flex items-center gap-2">
            <span className="font-semibold text-sm">{issue.user.login}</span>
            <span className="text-muted-foreground text-sm">
              opened this issue
            </span>
          </div>

          {/* Body */}
          <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
            {issue.body ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {issue.body}
              </ReactMarkdown>
            ) : (
              <p className="text-muted-foreground italic">No description provided.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface IssueDetailModalProps {
  issue: GitHubIssue | null;
  workspacePath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IssueDetailModal({
  issue,
  workspacePath,
  open,
  onOpenChange,
}: IssueDetailModalProps) {
  const navigate = useNavigate();
  const [linkedTask, setLinkedTask] = useState<Task | null>(null);
  const [loadingTask, setLoadingTask] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);

  // Fetch comments
  const {
    comments,
    loading: commentsLoading,
    error: commentsError,
    hasMore: commentsHasMore,
    refresh: refreshComments,
    loadMore: loadMoreComments,
  } = useGitHubComments(workspacePath, issue?.number ?? null);

  // Check for linked task when issue changes
  useEffect(() => {
    if (!issue || !workspacePath) {
      setLinkedTask(null);
      return;
    }

    const checkLinkedTask = async () => {
      setLoadingTask(true);
      try {
        const tasks = await getTasks(workspacePath);
        const linked = tasks.find(
          (task) => task.github_issue_number === issue.number
        );
        setLinkedTask(linked || null);
      } catch (error) {
        console.error("Failed to check linked task:", error);
        setLinkedTask(null);
      } finally {
        setLoadingTask(false);
      }
    };

    checkLinkedTask();
  }, [issue?.number, workspacePath]);

  const handleCreateTask = useCallback(async () => {
    if (!issue) return;

    setCreatingTask(true);
    try {
      const newTask = await createTask({
        title: issue.title,
        description: issue.body || undefined,
        status: "backlog",
        workspace_path: workspacePath,
        github_issue_number: issue.number,
        github_issue_url: issue.html_url,
      });
      setLinkedTask(newTask);
    } catch (error) {
      console.error("Failed to create task:", error);
    } finally {
      setCreatingTask(false);
    }
  }, [issue, workspacePath]);

  const handleGoToTask = useCallback(() => {
    if (linkedTask) {
      onOpenChange(false);
      // Navigate to kanban with task selected
      navigate(`/workspace/${encodeURIComponent(workspacePath)}/kanban?task=${linkedTask.id}`);
    }
  }, [linkedTask, workspacePath, navigate, onOpenChange]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(dateString);
  };

  if (!issue) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        {/* Header - GitHub style */}
        <div className="shrink-0 p-6 pb-4 border-b border-border">
          {/* Title row */}
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold leading-tight">
                {issue.title}
                <span className="text-muted-foreground font-normal ml-2">
                  #{issue.number}
                </span>
              </h1>
            </div>
          </div>

          {/* Status and meta row */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {/* Status badge */}
            <Badge
              className={cn(
                "px-3 py-1 text-sm font-medium",
                issue.state === "open"
                  ? "bg-green-600 text-white hover:bg-green-600"
                  : "bg-purple-600 text-white hover:bg-purple-600"
              )}
            >
              {issue.state === "open" ? (
                <CircleDot className="h-4 w-4 mr-1.5" />
              ) : (
                <CircleCheck className="h-4 w-4 mr-1.5" />
              )}
              {issue.state === "open" ? "Open" : "Closed"}
            </Badge>

            {/* Author info */}
            <span className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{issue.user.login}</span>
              {" opened this issue "}
              {formatRelativeTime(issue.created_at)}
              {" · "}
              {issue.comments} comment{issue.comments !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Task association - prominent action */}
          <div className="mt-4 flex items-center gap-3">
            {loadingTask ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Checking task...</span>
              </div>
            ) : linkedTask ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleGoToTask}
              >
                <ListTodo className="h-4 w-4" />
                <span>Go to Task</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-2 bg-primary"
                onClick={handleCreateTask}
                disabled={creatingTask}
              >
                {creatingTask ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span>Create Task</span>
              </Button>
            )}

            {/* External link */}
            <a
              href={issue.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View on GitHub
            </a>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex min-h-0">
          {/* Left: Issue body and comments */}
          <ScrollArea className="flex-1">
            <div className="p-6">
              {/* Issue body */}
              <IssueBody issue={issue} />

              {/* Comments section */}
              {comments.length > 0 && (
                <div className="mt-6 pt-4 border-t border-border">
                  {comments.map((comment, index) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      isFirst={index === 0}
                    />
                  ))}

                  {/* Load more */}
                  {commentsHasMore && (
                    <div className="mt-4 flex justify-center">
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
                        Load more comments
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Loading comments */}
              {commentsLoading && comments.length === 0 && (
                <div className="mt-6 pt-4 border-t border-border">
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      Loading comments...
                    </span>
                  </div>
                </div>
              )}

              {/* Error loading comments */}
              {commentsError && (
                <div className="mt-6 pt-4 border-t border-border">
                  <div className="flex flex-col items-center py-8">
                    <p className="text-sm text-destructive mb-3">{commentsError}</p>
                    <Button variant="outline" size="sm" onClick={refreshComments}>
                      Retry
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Right sidebar - Metadata */}
          <div className="w-72 shrink-0 border-l border-border bg-muted/20">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                {/* Assignees */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Assignees
                  </h4>
                  {issue.assignees && issue.assignees.length > 0 ? (
                    <div className="space-y-2">
                      {issue.assignees.map((assignee) => (
                        <div key={assignee.id} className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={assignee.avatar_url} alt={assignee.login} />
                            <AvatarFallback className="text-xs">
                              {assignee.login[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{assignee.login}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No one assigned</p>
                  )}
                </div>

                <Separator />

                {/* Labels */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Labels
                  </h4>
                  {issue.labels && issue.labels.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {issue.labels.map((label) => (
                        <Badge
                          key={label.id}
                          className="text-xs px-2 py-0.5"
                          style={{
                            backgroundColor: `#${label.color}`,
                            color: getContrastColor(`#${label.color}`),
                          }}
                        >
                          {label.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">None yet</p>
                  )}
                </div>

                <Separator />

                {/* Milestone */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Milestone
                  </h4>
                  {issue.milestone ? (
                    <div className="flex items-center gap-2">
                      <Milestone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{issue.milestone.title}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No milestone</p>
                  )}
                </div>

                <Separator />

                {/* Linked Task */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Linked Task
                  </h4>
                  {loadingTask ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : linkedTask ? (
                    <button
                      onClick={handleGoToTask}
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <ListTodo className="h-4 w-4" />
                      <span className="truncate">{linkedTask.title}</span>
                    </button>
                  ) : (
                    <p className="text-sm text-muted-foreground">No linked task</p>
                  )}
                </div>

                <Separator />

                {/* Timestamps */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Timeline
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Created {formatDate(issue.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Updated {formatDate(issue.updated_at)}</span>
                    </div>
                    {issue.closed_at && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CircleCheck className="h-4 w-4" />
                        <span>Closed {formatDate(issue.closed_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Helper function to get contrast color (black or white) for a background color
 */
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}
