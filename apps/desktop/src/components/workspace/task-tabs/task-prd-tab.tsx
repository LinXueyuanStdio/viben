"use client";
import {
  cn,
  ScrollArea,
  Button,
  Skeleton,
} from "@viben/ui";
import {
  FileText,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";

export interface TaskPRDTabProps {
  taskId: string;
  prdContent?: string | null;
  prdPath?: string;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
  onRefresh?: () => void;
  onOpenInEditor?: (path: string) => void;
}

/**
 * TaskPRDTab - Displays the PRD (Product Requirements Document) for a task
 *
 * Features:
 * - Markdown rendering of PRD content
 * - Loading state with skeleton
 * - Empty state when PRD is not created
 * - Refresh button to reload content
 * - Open in editor button
 */
export function TaskPRDTab({
  taskId: _taskId,
  prdContent,
  prdPath,
  isLoading = false,
  error,
  className,
  onRefresh,
  onOpenInEditor,
}: TaskPRDTabProps) {
  void _taskId; // Reserved for future use
  const { t } = useTranslation();

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("p-4 space-y-4", className)}>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full py-12", className)}>
        <FileText className="h-12 w-12 text-destructive/30 mb-4" />
        <h3 className="text-lg font-medium text-destructive mb-2">
          {t("workspace.prdTab.loadError", "Failed to load PRD")}
        </h3>
        <p className="text-sm text-muted-foreground/60 text-center max-w-xs mb-4">
          {error}
        </p>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("common.retry", "Retry")}
          </Button>
        )}
      </div>
    );
  }

  // Empty state - PRD not created yet
  if (!prdContent) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full py-12", className)}>
        <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">
          {t("workspace.prdTab.noPRD", "No PRD available")}
        </h3>
        <p className="text-sm text-muted-foreground/60 text-center max-w-xs">
          {t(
            "workspace.prdTab.prdWillAppear",
            "Product requirements document will appear here after task planning"
          )}
        </p>
        {onRefresh && (
          <Button variant="ghost" size="sm" onClick={onRefresh} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("common.refresh", "Refresh")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header with actions */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {t("workspace.prdTab.title", "PRD")}
          </span>
          {prdPath && (
            <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
              {prdPath.split("/").slice(-2).join("/")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <Button variant="ghost" size="icon" onClick={onRefresh} className="h-7 w-7">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
          {prdPath && onOpenInEditor && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenInEditor(prdPath)}
              className="h-7 w-7"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* PRD Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <article className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                // Custom heading styles
                h1: ({ children }) => (
                  <h1 className="text-xl font-bold border-b pb-2 mb-4">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-lg font-semibold mt-6 mb-3">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-base font-medium mt-4 mb-2">{children}</h3>
                ),
                // Code blocks
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code
                      className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
                      {...props}
                    >
                      {children}
                    </code>
                  ) : (
                    <code
                      className={cn("block bg-muted p-3 rounded-lg overflow-x-auto", className)}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                // Lists
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
                ),
                // Links
                a: ({ href, children }) => (
                  <a
                    href={href}
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                ),
                // Blockquotes
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground my-4">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {prdContent}
            </ReactMarkdown>
          </article>
        </div>
      </ScrollArea>
    </div>
  );
}
