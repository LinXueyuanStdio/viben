import { useCallback, useEffect, useMemo, useRef } from "react";
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
import { useClawhubRegistry } from "@/hooks/use-clawhub-registry";
import { cn } from "@/lib/utils";
import type {
  ClawhubSkillDisplay,
  ClawhubSkillSortOption,
} from "@/types/clawhub-registry";
import {
  OfficialSkillCard,
  OfficialSkillCardSkeleton,
} from "./official-skill-card";
import {
  SkillGridEmpty,
  SkillGridError,
  SkillGridShell,
} from "./skill-grid-states";
import type { SkillDetailItem } from "./types";

interface OfficialSkillGridProps {
  searchQuery: string;
  onViewDetails: (skill: SkillDetailItem) => void;
  onInstall?: (skill: SkillDetailItem) => void;
  isInstalled: (id: string) => boolean;
  isInstalling: (id: string) => boolean;
  getProgress: (id: string) => number;
  className?: string;
}

const OFFICIAL_SORT_OPTIONS: ClawhubSkillSortOption[] = [
  "updated",
  "downloads",
  "stars",
  "trending",
];

export function OfficialSkillGrid({
  searchQuery,
  onViewDetails,
  onInstall,
  isInstalled,
  isInstalling,
  getProgress,
  className,
}: OfficialSkillGridProps) {
  const { t } = useTranslation();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const {
    skillsError,
    refreshSkills,
    setSort,
    currentSort,
    searchResults,
    searchLoading,
    searchError,
    search,
    searchQuery: hookSearchQuery,
    displaySkills,
    isLoading,
    isSearching,
    hasMore,
    loadMore,
  } = useClawhubRegistry({ limit: 24, fetchOnMount: true });

  const externalSearchQuery = searchQuery.trim();
  const isSearchMode = externalSearchQuery.length > 0 || isSearching;
  const visibleSkills = useMemo(
    () => (isSearchMode ? searchResults : displaySkills),
    [displaySkills, isSearchMode, searchResults]
  );
  const error = isSearchMode ? searchError : skillsError;
  const loading = isSearchMode ? searchLoading : isLoading;
  const canLoadMore = !isSearchMode && hasMore && visibleSkills.length > 0;

  useEffect(() => {
    if (searchQuery !== hookSearchQuery) {
      search(searchQuery);
    }
  }, [hookSearchQuery, search, searchQuery]);

  const handleRetry = useCallback(() => {
    if (isSearchMode || searchError) {
      search(searchQuery);
      return;
    }

    void refreshSkills();
  }, [isSearchMode, refreshSkills, search, searchError, searchQuery]);

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
            onValueChange={(value) => setSort(value as ClawhubSkillSortOption)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OFFICIAL_SORT_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`skillsMarket.sort.${option}`, option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {error ? (
        <SkillGridError message={error} onRetry={handleRetry} />
      ) : loading && visibleSkills.length === 0 ? (
        <SkillGridShell>
          {Array.from({ length: 8 }, (_, index) => (
            <OfficialSkillCardSkeleton key={index} />
          ))}
        </SkillGridShell>
      ) : visibleSkills.length === 0 ? (
        <SkillGridEmpty onRetry={handleRetry} />
      ) : (
        <>
          <SkillGridShell>
            {visibleSkills.map((skill: ClawhubSkillDisplay) => (
              <OfficialSkillCard
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
                <OfficialSkillCardSkeleton key={`loading-${index}`} />
              ))}
          </SkillGridShell>

          {canLoadMore && (
            <div className="flex flex-col items-center gap-3">
              <div ref={loadMoreRef} className="h-px w-full" aria-hidden="true" />
              <Button
                type="button"
                variant="outline"
                onClick={handleLoadMore}
                disabled={loading}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                {t("common.loadMore", "Load more")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
