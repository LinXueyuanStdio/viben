import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCloudSkillPackagesInfinite,
  useCloudSkillSearch,
} from "@/hooks/use-cloud-skills";
import { cn } from "@/lib/utils";
import type {
  CloudSkillPackage,
  CloudSkillSortOption,
} from "@/hooks/use-cloud-skills";
import {
  CommunitySkillCard,
  CommunitySkillCardSkeleton,
} from "./community-skill-card";
import {
  SkillGridEmpty,
  SkillGridError,
  SkillGridShell,
} from "./skill-grid-states";
import type { SkillDetailItem } from "./types";

interface CommunitySkillGridProps {
  searchQuery: string;
  onViewDetails: (skill: SkillDetailItem) => void;
  onInstall?: (skill: SkillDetailItem) => void;
  isInstalled: (id: string) => boolean;
  isInstalling: (id: string) => boolean;
  getProgress: (id: string) => number;
  className?: string;
}

const COMMUNITY_SORT_OPTIONS: CloudSkillSortOption[] = [
  "latest",
  "popular",
  "downloads",
];

export function CommunitySkillGrid({
  searchQuery,
  onViewDetails,
  onInstall,
  isInstalled,
  isInstalling,
  getProgress,
  className,
}: CommunitySkillGridProps) {
  const { t } = useTranslation();
  const [currentSort, setCurrentSort] =
    useState<CloudSkillSortOption>("popular");
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const {
    packages,
    loading: packagesLoading,
    error: packagesError,
    hasMore,
    loadMore,
    refresh,
  } = useCloudSkillPackagesInfinite({ limit: 24, sort: currentSort });
  const {
    results: searchResults,
    loading: searchLoading,
    error: searchError,
    search,
  } = useCloudSkillSearch(searchQuery, 300);

  const trimmedSearchQuery = searchQuery.trim();
  const isSearchMode = trimmedSearchQuery.length > 0;
  const visibleSkills = useMemo(
    () => (isSearchMode ? searchResults : packages),
    [isSearchMode, packages, searchResults]
  );
  const loading = isSearchMode ? searchLoading : packagesLoading;
  const error = isSearchMode ? searchError : packagesError;
  const canLoadMore = !isSearchMode && hasMore && visibleSkills.length > 0;

  const handleRetry = useCallback(() => {
    if (isSearchMode) {
      void search(searchQuery);
      return;
    }

    void refresh();
  }, [isSearchMode, refresh, search, searchQuery]);

  const handleLoadMore = useCallback(() => {
    void loadMore();
  }, [loadMore]);

  useEffect(() => {
    if (!canLoadMore || loading || typeof IntersectionObserver === "undefined") {
      return;
    }

    const target = loadMoreRef.current;
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMore();
      }
    });

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [canLoadMore, loadMore, loading]);

  return (
    <div className={cn("space-y-4", className)}>
      {!isSearchMode && (
        <div className="flex justify-end">
          <Select
            value={currentSort}
            onValueChange={(value) =>
              setCurrentSort(value as CloudSkillSortOption)
            }
          >
            <SelectTrigger
              aria-label={t("skillsMarket.sortBy", "Sort by")}
              className="w-40"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMUNITY_SORT_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`skillsMarket.sort.${option}`, option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {error && visibleSkills.length === 0 ? (
        <SkillGridError message={error} onRetry={handleRetry} />
      ) : loading && visibleSkills.length === 0 ? (
        <SkillGridShell>
          {Array.from({ length: 8 }, (_, index) => (
            <CommunitySkillCardSkeleton key={index} />
          ))}
        </SkillGridShell>
      ) : visibleSkills.length === 0 ? (
        <SkillGridEmpty onRetry={handleRetry} />
      ) : (
        <>
          <SkillGridShell>
            {visibleSkills.map((skill: CloudSkillPackage) => (
              <CommunitySkillCard
                key={`${skill.id}-${skill.version}`}
                skill={skill}
                onViewDetails={onViewDetails}
                onInstall={onInstall}
                isInstalled={isInstalled(skill.id)}
                isInstalling={isInstalling(skill.id)}
                installProgress={getProgress(skill.id)}
              />
            ))}
            {loading &&
              Array.from({ length: 4 }, (_, index) => (
                <CommunitySkillCardSkeleton key={`loading-${index}`} />
              ))}
          </SkillGridShell>

          {canLoadMore && (
            <div className="flex flex-col items-center gap-3">
              <div ref={loadMoreRef} className="h-px w-full" aria-hidden="true" />
              <Button type="button" variant="outline" onClick={handleLoadMore} disabled={loading}>
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                {t("common.loadMore", "Load more")}
              </Button>
            </div>
          )}

          {error && (
            <SkillGridError
              message={error}
              onRetry={handleRetry}
              className="min-h-0 py-4"
            />
          )}
        </>
      )}
    </div>
  );
}
