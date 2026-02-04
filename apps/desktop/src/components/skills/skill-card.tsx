import * as React from "react";
import {
  Download,
  Star,
  User,
  Tag,
  Zap,
  ExternalLink,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { CloudSkillPackage } from "@/hooks/use-cloud-skills";

/* -----------------------------------------------------------------------------
 * Utility Functions (defined outside component to avoid recreation)
 * -------------------------------------------------------------------------- */

/**
 * Get badge variant based on skill type
 */
const getSkillTypeBadgeVariant = (skillType: string) => {
  switch (skillType) {
    case "automation":
      return "default";
    case "analysis":
      return "secondary";
    case "generation":
      return "success";
    default:
      return "outline";
  }
};

/**
 * Format download count with K/M suffix
 */
const formatDownloads = (count: number) => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

/* -----------------------------------------------------------------------------
 * Skill Card Component
 * -------------------------------------------------------------------------- */

interface SkillCardProps {
  skill: CloudSkillPackage;
  onViewDetails: (skill: CloudSkillPackage) => void;
  isInstalled?: boolean;
  isInstalling?: boolean;
  onInstall?: (skill: CloudSkillPackage) => void;
}

/**
 * SkillCard component displays a cloud skill package in the marketplace
 * Memoized to prevent unnecessary re-renders in list views
 */
export const SkillCard = React.memo(function SkillCard({
  skill,
  onViewDetails,
  isInstalled = false,
  isInstalling = false,
  onInstall,
}: SkillCardProps) {
  const { t } = useTranslation();

  // Memoize callbacks to prevent child re-renders
  const handleViewDetails = React.useCallback(() => {
    onViewDetails(skill);
  }, [onViewDetails, skill]);

  const handleInstall = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isInstalled && !isInstalling && onInstall) {
        onInstall(skill);
      }
    },
    [isInstalled, isInstalling, onInstall, skill]
  );

  const handleOpenRepo = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (skill.repositoryUrl) {
        window.open(skill.repositoryUrl, "_blank");
      }
    },
    [skill.repositoryUrl]
  );

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4",
        "transition-all duration-300",
        "hover:border-primary/30 hover:shadow-lg hover:-translate-y-1",
        "theme-transition cursor-pointer"
      )}
      onClick={handleViewDetails}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0",
              isInstalled
                ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                : "bg-primary/10 text-primary"
            )}
          >
            <Zap className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm truncate">{skill.name}</h3>
              <Badge variant={getSkillTypeBadgeVariant(skill.skillType)}>
                {skill.skillType}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {skill.description || t("skillsMarket.noDescription")}
            </p>
          </div>
        </div>
      </div>

      {/* Trigger Patterns Preview */}
      {skill.triggerPatterns && skill.triggerPatterns.length > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-1">
            {skill.triggerPatterns.slice(0, 2).map((pattern, idx) => (
              <code
                key={idx}
                className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[150px]"
              >
                {pattern}
              </code>
            ))}
            {skill.triggerPatterns.length > 2 && (
              <span className="text-xs text-muted-foreground">
                +{skill.triggerPatterns.length - 2} {t("common.more")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
        {/* Rating */}
        {skill.ratingAvg > 0 && (
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span>{skill.ratingAvg.toFixed(1)}</span>
          </div>
        )}

        {/* Downloads */}
        <div className="flex items-center gap-1">
          <Download className="h-3 w-3" />
          <span>{formatDownloads(skill.downloadsCount)}</span>
        </div>

        {/* Version */}
        <span className="font-mono">v{skill.version}</span>
      </div>

      {/* Author */}
      {skill.author && (
        <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <span>{skill.author.displayName || skill.author.username}</span>
        </div>
      )}

      {/* Tags */}
      {skill.tags && skill.tags.length > 0 && (
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          <Tag className="h-3 w-3 text-muted-foreground" />
          {skill.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-xs bg-muted/50 px-1.5 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
          {skill.tags.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{skill.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t">
        {skill.repositoryUrl && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenRepo}
            className="h-8 px-2"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            <span className="text-xs">{t("skillsMarket.repository")}</span>
          </Button>
        )}
        <div className="flex-1" />
        {onInstall && (
          <Button
            variant={isInstalled ? "outline" : "default"}
            size="sm"
            onClick={handleInstall}
            disabled={isInstalling}
            className="h-8 text-xs"
          >
            {isInstalling ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                {t("common.loading")}
              </>
            ) : isInstalled ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1" />
                {t("common.installed")}
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5 mr-1" />
                {t("skillsMarket.install")}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
});

/* -----------------------------------------------------------------------------
 * Skill Card Skeleton
 * -------------------------------------------------------------------------- */

export function SkillCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-lg bg-muted flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-5 w-16 bg-muted rounded" />
          </div>
          <div className="h-3 w-full bg-muted rounded" />
        </div>
      </div>
      <div className="flex gap-1 mb-3">
        <div className="h-5 w-20 bg-muted rounded" />
        <div className="h-5 w-24 bg-muted rounded" />
      </div>
      <div className="flex items-center gap-4 mb-3">
        <div className="h-3 w-10 bg-muted rounded" />
        <div className="h-3 w-12 bg-muted rounded" />
        <div className="h-3 w-14 bg-muted rounded" />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div className="h-3 w-3 bg-muted rounded" />
        <div className="h-3 w-20 bg-muted rounded" />
      </div>
      <div className="flex gap-2 pt-3 border-t">
        <div className="h-8 w-20 bg-muted rounded" />
        <div className="flex-1" />
        <div className="h-8 w-16 bg-muted rounded" />
      </div>
    </div>
  );
}

export default SkillCard;
