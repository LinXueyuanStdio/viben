/**
 * Artifacts tab content for the right sidebar
 */
import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Package, FileEdit, Globe, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArtifactsTabContentProps } from "./types";
import { getArtifactIcon } from "./utils";

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes?: number): string {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Default number of items to show before "show more"
const DEFAULT_VISIBLE_COUNT = 10;

/**
 * Empty state component
 */
function EmptyState({
  icon: Icon,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="bg-muted/30 rounded-full p-3 mb-3">
        <Icon className="h-5 w-5 text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground/60">{description}</p>
    </div>
  );
}

/**
 * Get icon for the tool that created the artifact
 */
function getToolBadgeIcon(toolName?: string) {
  switch (toolName) {
    case "Write":
      return PenLine;
    case "Edit":
      return FileEdit;
    case "WebSearch":
      return Globe;
    default:
      return null;
  }
}

/**
 * Artifacts tab content
 */
export function ArtifactsTabContent({
  artifacts,
  selectedArtifact,
  highlightedArtifactId,
  onArtifactSelect,
  onArtifactMessageClick,
}: ArtifactsTabContentProps) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);

  // Ref for scrolling to highlighted artifact
  const artifactRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Auto-scroll to highlighted artifact
  useEffect(() => {
    if (highlightedArtifactId) {
      const element = artifactRefs.current.get(highlightedArtifactId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [highlightedArtifactId]);

  const visibleArtifacts = showAll
    ? artifacts
    : artifacts.slice(0, DEFAULT_VISIBLE_COUNT);
  const hasMore = artifacts.length > DEFAULT_VISIBLE_COUNT;

  if (artifacts.length === 0) {
    return <EmptyState icon={Package} description={t("chat.noArtifacts")} />;
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "space-y-1 rounded-md border border-border/30 bg-muted/20 p-2",
          showAll && "max-h-[400px] overflow-y-auto"
        )}
      >
        {visibleArtifacts.map((artifact) => {
          const IconComponent = getArtifactIcon(artifact.type);
          const isSelected = selectedArtifact?.id === artifact.id;
          const isHighlighted = highlightedArtifactId === artifact.id;
          const ToolBadgeIcon = getToolBadgeIcon(artifact.toolName);

          return (
            <button
              key={artifact.id}
              ref={(el) => {
                if (el) {
                  artifactRefs.current.set(artifact.id, el);
                } else {
                  artifactRefs.current.delete(artifact.id);
                }
              }}
              type="button"
              onClick={() => onArtifactSelect?.(artifact)}
              onDoubleClick={() => {
                // Double-click to navigate to source message
                if (artifact.sourceMessageId && onArtifactMessageClick) {
                  onArtifactMessageClick(artifact.sourceMessageId);
                }
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-all",
                isSelected
                  ? "bg-primary/10 border border-primary/20"
                  : isHighlighted
                    ? "bg-accent/60 border border-accent ring-1 ring-primary/30"
                    : "hover:bg-accent/50"
              )}
            >
              <IconComponent
                className={cn(
                  "h-4 w-4 shrink-0",
                  isSelected || isHighlighted
                    ? "text-primary"
                    : "text-muted-foreground/60"
                )}
              />
              <div className="flex flex-col flex-1 min-w-0">
                <span
                  className={cn(
                    "truncate text-sm",
                    isSelected || isHighlighted
                      ? "text-foreground font-medium"
                      : "text-foreground/80"
                  )}
                >
                  {artifact.name}
                </span>
                {/* Show source tool badge and file size */}
                {(artifact.toolName && ToolBadgeIcon) || artifact.fileSize !== undefined ? (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 mt-0.5">
                    {artifact.toolName && ToolBadgeIcon && (
                      <>
                        <ToolBadgeIcon className="h-2.5 w-2.5" />
                        <span>
                          {artifact.toolName === "Write"
                            ? t("chat.artifacts.createdBy", "Created")
                            : artifact.toolName === "Edit"
                              ? t("chat.artifacts.editedBy", "Edited")
                              : artifact.toolName === "WebSearch"
                                ? t("chat.artifacts.searchResult", "Search")
                                : artifact.toolName}
                        </span>
                      </>
                    )}
                    {artifact.fileSize !== undefined && (
                      <>
                        {artifact.toolName && ToolBadgeIcon && (
                          <span className="mx-0.5">·</span>
                        )}
                        <span>{formatFileSize(artifact.fileSize)}</span>
                        {artifact.fileTooLarge && (
                          <span className="text-amber-500/70">
                            ({t("chat.artifacts.truncated", "truncated")})
                          </span>
                        )}
                      </>
                    )}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="w-full py-1.5 text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAll
            ? t("chat.sidebar.showLess", "Show less")
            : t("chat.sidebar.showMore", { defaultValue: "Show {{count}} more", count: artifacts.length - DEFAULT_VISIBLE_COUNT })}
        </button>
      )}
    </div>
  );
}
