import { memo, useCallback, useMemo } from "react";
import type { ComponentProps, KeyboardEvent, MouseEvent } from "react";
import {
  Check,
  Download,
  ExternalLink,
  Loader2,
  Star,
  Tag,
  User,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { CloudSkillPackage } from "@/hooks/use-cloud-skills";
import {
  formatSkillCount,
  getSkillInitials,
} from "./skill-display-utils";
import { SkillSourceBadge } from "./skill-source-tabs";
import type { SkillDetailItem, SkillInstallVisualState } from "./types";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

interface CommunitySkillCardProps extends SkillInstallVisualState {
  skill: CloudSkillPackage;
  onViewDetails: (skill: SkillDetailItem) => void;
  onInstall?: (skill: SkillDetailItem) => void;
}

function getSkillTypeBadgeVariant(skillType: string): BadgeVariant {
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
}

export const CommunitySkillCard = memo(function CommunitySkillCard({
  skill,
  onViewDetails,
  onInstall,
  isInstalled = false,
  isInstalling = false,
  installProgress = 0,
}: CommunitySkillCardProps) {
  const { t } = useTranslation();
  const detailItem = useMemo<SkillDetailItem>(
    () => ({ source: "community", data: skill }),
    [skill]
  );
  const authorName =
    skill.author?.displayName ??
    skill.author?.username ??
    t("skillsMarket.unknownAuthor", "Unknown author");
  const description =
    skill.description ?? t("skillsMarket.noDescription", "No description available");
  const triggerPatterns = skill.triggerPatterns ?? [];
  const tags = skill.tags ?? [];

  const handleViewDetails = useCallback(() => {
    onViewDetails(detailItem);
  }, [detailItem, onViewDetails]);

  const handleInstall = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();

      if (isInstalled || isInstalling || !onInstall) return;

      onInstall(detailItem);
    },
    [detailItem, isInstalled, isInstalling, onInstall]
  );

  const handleInstallAreaClick = useCallback(
    (event: MouseEvent<HTMLSpanElement>) => {
      event.stopPropagation();
    },
    []
  );

  const handleOpenRepository = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();

      if (!skill.repositoryUrl) return;

      window.open(skill.repositoryUrl, "_blank", "noopener,noreferrer");
    },
    [skill.repositoryUrl]
  );

  const handleDetailsKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.currentTarget !== event.target) return;

      if (event.key === "Enter") {
        handleViewDetails();
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        handleViewDetails();
      }
    },
    [handleViewDetails]
  );

  return (
    <article
      className={cn(
        "flex min-h-[272px] flex-col rounded-lg border bg-card p-4",
        "transition-colors hover:border-primary/50 focus-within:border-primary/50"
      )}
    >
      <div
        className={cn(
          "cursor-pointer rounded-sm focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
        onClick={handleViewDetails}
        onKeyDown={handleDetailsKeyDown}
        aria-label={`${skill.name} details`}
        role="button"
        tabIndex={0}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Zap className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold leading-5 text-card-foreground">
                {skill.name}
              </h3>
              <SkillSourceBadge source="community" />
              <Badge
                variant={getSkillTypeBadgeVariant(skill.skillType)}
                className="shrink-0 text-[10px]"
              >
                {skill.skillType}
              </Badge>
            </div>
            <p className="mt-1 line-clamp-2 min-h-[40px] text-sm leading-5 text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        {triggerPatterns.length > 0 && (
          <div className="mt-3 flex min-h-6 flex-wrap items-center gap-1">
            {triggerPatterns.slice(0, 2).map((pattern) => (
              <code
                key={pattern}
                className="max-w-[150px] truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
              >
                {pattern}
              </code>
            ))}
            {triggerPatterns.length > 2 && (
              <span className="text-xs text-muted-foreground">
                +{triggerPatterns.length - 2}
              </span>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {skill.ratingAvg > 0 && (
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span>{skill.ratingAvg.toFixed(1)}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Download className="h-3.5 w-3.5" />
            <span>{formatSkillCount(skill.downloadsCount)}</span>
          </div>
          <span className="font-mono">v{skill.version}</span>
        </div>

        <div className="mt-3 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <Avatar size="sm">
            <AvatarImage src={skill.author?.avatarUrl ?? undefined} alt={authorName} />
            <AvatarFallback>{getSkillInitials(authorName)}</AvatarFallback>
          </Avatar>
          <User className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{authorName}</span>
        </div>

        {tags.length > 0 && (
          <div className="mt-3 flex min-h-6 flex-wrap items-center gap-1">
            <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="max-w-[96px] truncate rounded bg-muted/70 px-1.5 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {isInstalling && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("skillsMarket.installing", "Installing")}</span>
            <span className="font-mono">{installProgress}%</span>
          </div>
          <Progress value={installProgress} className="h-1.5" />
        </div>
      )}

      <div className="mt-auto flex items-center gap-2 border-t pt-3">
        {skill.repositoryUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleOpenRepository}
            className="h-8 px-2 text-xs"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>{t("skillsMarket.repository", "Repository")}</span>
          </Button>
        )}
        <div className="flex-1" />
        {onInstall && (
          <span
            className="inline-flex"
            onClick={handleInstallAreaClick}
          >
            <Button
              type="button"
              variant={isInstalled ? "outline" : "default"}
              size="sm"
              onClick={handleInstall}
              disabled={isInstalled || isInstalling}
              className="h-8 min-w-24 text-xs"
            >
              {isInstalling ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("common.loading", "Loading")}
                </>
              ) : isInstalled ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  {t("common.installed", "Installed")}
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  {t("skillsMarket.install", "Install")}
                </>
              )}
            </Button>
          </span>
        )}
      </div>
    </article>
  );
});

export function CommunitySkillCardSkeleton() {
  return (
    <div className="flex min-h-[272px] flex-col rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      <div className="mt-3 flex gap-1">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="mt-3 flex gap-4">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-14" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Skeleton variant="circular" className="h-6 w-6" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="mt-3 flex gap-1">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-16" />
      </div>
      <div className="mt-auto flex gap-2 border-t pt-3">
        <Skeleton className="h-8 w-24" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
}
