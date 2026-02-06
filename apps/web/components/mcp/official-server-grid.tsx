'use client';

import * as React from 'react';
import { Package, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AnimatedGrid } from '@/components/shared/animated-grid';
import {
  OfficialServerCard,
  OfficialServerCardSkeleton,
} from './official-server-card';
import { useOfficialRegistry } from '@/hooks/use-official-registry';
import { cn } from '@/lib/utils/index';

interface OfficialServerGridProps {
  searchQuery?: string;
  className?: string;
}

/**
 * OfficialServerGrid displays a grid of official registry servers
 * with infinite scroll pagination and search support
 */
export function OfficialServerGrid({
  searchQuery = '',
  className,
}: OfficialServerGridProps) {
  const {
    displayServers,
    isLoading,
    serversError,
    searchError,
    hasMore,
    loadMore,
    refreshServers,
    isSearching,
    totalCount,
    search,
    searchQuery: currentSearchQuery,
  } = useOfficialRegistry({
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

  const error = serversError || searchError;

  // Error state
  if (error && displayServers.length === 0) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Failed to load official registry: {error}</span>
          <Button variant="outline" size="sm" onClick={refreshServers}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Empty state (after loading)
  if (!isLoading && displayServers.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-16 text-muted-foreground',
          className
        )}
      >
        <Package className="h-12 w-12 mb-4 opacity-50" />
        <h3 className="text-lg font-medium">No servers found</h3>
        {isSearching && (
          <p className="text-sm mt-1">Try adjusting your search query</p>
        )}
      </div>
    );
  }

  // Loading skeleton (initial load)
  if (isLoading && displayServers.length === 0) {
    return (
      <div
        className={cn(
          'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
          className
        )}
      >
        {[...Array(6)].map((_, i) => (
          <OfficialServerCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Results info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {isSearching
            ? `Found ${displayServers.length} results`
            : `Showing ${displayServers.length} of ${totalCount} servers`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshServers}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Grid */}
      <AnimatedGrid>
        {displayServers.map((server) => (
          <OfficialServerCard key={server.id} server={server} />
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
              Load more
            </Button>
          )}
        </div>
      )}

      {/* Error during pagination */}
      {error && displayServers.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Error loading more: {error}</span>
            <Button variant="outline" size="sm" onClick={loadMore}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
