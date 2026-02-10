/**
 * Artifacts tab content for the right sidebar
 */
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArtifactsTabContentProps } from "./types";
import { getArtifactIcon } from "./utils";

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
 * Artifacts tab content
 */
export function ArtifactsTabContent({
  artifacts,
  selectedArtifact,
  onArtifactSelect,
}: ArtifactsTabContentProps) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = React.useState(false);

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

          return (
            <button
              key={artifact.id}
              type="button"
              onClick={() => onArtifactSelect?.(artifact)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                isSelected
                  ? "bg-primary/10 border border-primary/20"
                  : "hover:bg-accent/50"
              )}
            >
              <IconComponent
                className={cn(
                  "h-4 w-4 shrink-0",
                  isSelected
                    ? "text-primary"
                    : "text-muted-foreground/60"
                )}
              />
              <span
                className={cn(
                  "truncate text-sm flex-1",
                  isSelected ? "text-foreground font-medium" : "text-foreground/80"
                )}
              >
                {artifact.name}
              </span>
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
            : t("chat.sidebar.showMore", `Show ${artifacts.length - DEFAULT_VISIBLE_COUNT} more`)}
        </button>
      )}
    </div>
  );
}
