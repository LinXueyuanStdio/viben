import { memo, useCallback, useMemo } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import {
  Check,
  Code2,
  Download,
  ExternalLink,
  Loader2,
  Star,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ClawhubSkillDisplay } from "@/types/clawhub-registry";
import {
  formatSkillCount,
  getSkillInitials,
} from "./skill-display-utils";
import { SkillSourceBadge } from "./skill-source-tabs";
import type { SkillDetailItem, SkillInstallVisualState } from "./types";

interface OfficialSkillCardProps extends SkillInstallVisualState {
  skill: ClawhubSkillDisplay;
  onViewDetails: (skill: SkillDetailItem) => void;
  onInstall?: (skill: SkillDetailItem) => void;
}

export const OfficialSkillCard = memo(function OfficialSkillCard({
  skill,
  onViewDetails,
  onInstall,
  isInstalled = false,
  isInstalling = false,
  installProgress = 0,
}: OfficialSkillCardProps) {
  const { t } = useTranslation();
  const detailItem = useMemo<SkillDetailItem>(
    () => ({ source: "official", data: skill }),
    [skill]
  );
  const ownerName =
    skill.ownerName ?? skill.ownerHandle ?? t("skillsMarket.unknownOwner", "Unknown owner");
  const description =
    skill.description ?? t("skillsMarket.noDescription", "No description available");

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

  const handleOpenClawhub = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      window.open(
        `https://clawhub.ai/skills/${encodeURIComponent(skill.slug)}`,
        "_blank",
        "noopener,noreferrer"
      );
    },
    [skill.slug]
  );

  const handleCardKeyDown = useCallback(
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
        "flex min-h-[236px] cursor-pointer flex-col rounded-lg border bg-card p-4",
        "transition-colors hover:border-primary/50 focus-within:border-primary/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
      onClick={handleViewDetails}
      onKeyDown={handleCardKeyDown}
      aria-label={`${skill.name} details`}
      role="button"
      tabIndex={0}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Avatar size="lg" className="mt-0.5">
            <AvatarImage src={skill.ownerAvatar ?? undefined} alt={ownerName} />
            <AvatarFallback>{getSkillInitials(ownerName)}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold leading-5 text-card-foreground">
                {skill.name}
              </h3>
              <SkillSourceBadge source="official" />
              <Badge variant="outline" className="shrink-0 text-[10px]">
                v{skill.version}
              </Badge>
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <Code2 className="h-3.5 w-3.5 shrink-0" />
              <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono">
                {skill.slug}
              </code>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 min-h-[40px] text-sm leading-5 text-muted-foreground">
        {description}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Download className="h-3.5 w-3.5" />
          <span>{formatSkillCount(skill.downloads)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          <span>{formatSkillCount(skill.stars)}</span>
        </div>
        <span className="truncate">{ownerName}</span>
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleOpenClawhub}
          className="h-8 px-2 text-xs"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>{t("skillsMarket.openClawhub", "ClaWHub")}</span>
        </Button>
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

export function OfficialSkillCardSkeleton() {
  return (
    <div className="flex min-h-[236px] flex-col rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <Skeleton variant="circular" className="h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-14" />
          </div>
          <Skeleton className="h-5 w-44" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="mt-3 flex gap-4">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="mt-auto flex gap-2 border-t pt-3">
        <Skeleton className="h-8 w-24" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
}
