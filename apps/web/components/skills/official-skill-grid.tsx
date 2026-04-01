'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AnimatedGrid } from '@/components/shared/animated-grid';
import {
  OfficialSkillCard,
  OfficialSkillCardSkeleton,
} from './official-skill-card';
import { useClawhubRegistry } from '@/hooks/use-clawhub-registry';
import type { ClawhubSkillSortOption } from '@/lib/types/clawhub-registry';
import { cn } from '@/lib/utils/index';

interface OfficialSkillGridProps {
  searchQuery?: string;
  className?: string;
}

const SORT_OPTIONS: { value: ClawhubSkillSortOption; label: string }[] = [
  { value: 'updated', label: 'Recently Updated' },
  { value: 'downloads', label: 'Most Downloads' },
  { value: 'stars', label: 'Most Stars' },
  { value: 'trending', label: 'Trending' },
];

/**
 * OfficialSkillGrid displays a grid of ClaWHub official registry skills
 * with infinite scroll pagination and search support
 */
export function OfficialSkillGrid({
  searchQuery = '',
  className,
}: OfficialSkillGridProps) {
  const { t } = useTranslation();
  const {
    displaySkills,
    isLoading,
    skillsError,
    searchError,
    hasMore,
    loadMore,
    refreshSkills,
    isSearching,
    search,
    searchQuery: currentSearchQuery,
    setSort,
    currentSort,
  } = useClawhubRegistry({
    limit: 24,
    enabled: true,
  });

  // Infinite scroll observer
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const loadMoreRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading) return;

      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && hasMore && !isLoading) {
            loadMore();
          }
        },
        { threshold: 0.1 }
      );

      if (node) {
        observerRef.current.observe(node);
      }
    },
    [isLoading, hasMore, loadMore]
  );

  // Update search when prop changes
  React.useEffect(() => {
    if (searchQuery !== currentSearchQuery) {
      search(searchQuery);
    }
  }, [searchQuery, currentSearchQuery, search]);

  const error = skillsError || searchError;

  // Error state
  if (error && displaySkills.length === 0) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{t('marketplace.failedToLoad', 'Failed to load')}: {error}</span>
          <Button variant="outline" size="sm" onClick={refreshSkills}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('marketplace.retry', 'Retry')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Empty state (after loading)
  if (!isLoading && displaySkills.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-16 text-muted-foreground',
          className
        )}
      >
        <Sparkles className="h-12 w-12 mb-4 opacity-50" />
        <h3 className="text-lg font-medium">{t('marketplace.noSkills', 'No skills found')}</h3>
        {isSearching && (
          <p className="text-sm mt-1">{t('marketplace.tryAdjustingQuery', 'Try adjusting your search query')}</p>
        )}
      </div>
    );
  }

  // Loading skeleton (initial load)
  if (isLoading && displaySkills.length === 0) {
    return (
      <div
        className={cn(
          'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
          className
        )}
      >
        {[...Array(6)].map((_, i) => (
          <OfficialSkillCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Results info & Sort */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {isSearching
            ? t('marketplace.foundResults', { count: displaySkills.length, defaultValue: `Found ${displaySkills.length} results` })
            : t('marketplace.showingSkills', { count: displaySkills.length, defaultValue: `Showing ${displaySkills.length} skills` })}
        </span>
        <div className="flex items-center gap-2">
          {!isSearching && (
            <Select
              value={currentSort}
              onValueChange={(value) => setSort(value as ClawhubSkillSortOption)}
            >
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshSkills}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            {t('common.refresh', 'Refresh')}
          </Button>
        </div>
      </div>

      {/* Grid */}
      <AnimatedGrid>
        {displaySkills.map((skill, index) => (
          <OfficialSkillCard key={`${skill.id}-${skill.version}-${index}`} skill={skill} />
        ))}
      </AnimatedGrid>

      {/* Load more trigger / loading indicator */}
      {hasMore && (
        <div
          ref={loadMoreRef}
          className="flex items-center justify-center py-8"
        >
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <Button variant="outline" onClick={loadMore}>
              {t('marketplace.loadMore', 'Load More')}
            </Button>
          )}
        </div>
      )}

      {/* Error during pagination */}
      {error && displaySkills.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{t('marketplace.errorLoadingMore', 'Error loading more')}: {error}</span>
            <Button variant="outline" size="sm" onClick={loadMore}>
              {t('marketplace.retry', 'Retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
