'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  ClawhubSkillDisplay,
  ClawhubRegistryApiResponse,
  ClawhubSkillSortOption,
} from '@/lib/types/clawhub-registry';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for useClawhubRegistrySkills hook
 */
export interface UseClawhubRegistrySkillsOptions {
  /** Initial search query */
  search?: string;
  /** Sort option */
  sort?: ClawhubSkillSortOption;
  /** Number of results per page */
  limit?: number;
  /** Whether to fetch on mount */
  enabled?: boolean;
}

/**
 * Return type for useClawhubRegistrySkills hook
 */
export interface UseClawhubRegistrySkillsReturn {
  skills: ClawhubSkillDisplay[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  /** Load the next page of results */
  loadMore: () => Promise<void>;
  /** Refresh the list */
  refresh: () => Promise<void>;
  /** Search for skills */
  search: (query: string) => void;
  /** Current search query */
  searchQuery: string;
  /** Clear search and results */
  clearSearch: () => void;
  /** Change sort option */
  setSort: (sort: ClawhubSkillSortOption) => void;
  /** Current sort option */
  currentSort: ClawhubSkillSortOption;
}

/**
 * Options for useClawhubRegistrySearch hook
 */
export interface UseClawhubRegistrySearchOptions {
  /** Debounce time in ms */
  debounceMs?: number;
  /** Results per page */
  limit?: number;
}

/**
 * Return type for useClawhubRegistrySearch hook
 */
export interface UseClawhubRegistrySearchReturn {
  results: ClawhubSkillDisplay[];
  loading: boolean;
  error: string | null;
  search: (query: string) => void;
  searchQuery: string;
  clearResults: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch from our API proxy
 */
async function fetchFromApi(
  params: Record<string, string | number | undefined>
): Promise<ClawhubRegistryApiResponse> {
  const url = new URL('/api/clawhub-registry', window.location.origin);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  const res = await fetch(url.toString());

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error ?? `API error: ${res.status}`);
  }

  return res.json();
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for fetching ClaWHub registry skills with pagination
 */
export function useClawhubRegistrySkills(
  options: UseClawhubRegistrySkillsOptions = {}
): UseClawhubRegistrySkillsReturn {
  const {
    search: initialSearch = '',
    sort: initialSort = 'updated',
    limit = 50,
    enabled = true,
  } = options;

  const [skills, setSkills] = useState<ClawhubSkillDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [currentSort, setCurrentSort] = useState<ClawhubSkillSortOption>(initialSort);

  const isInitialFetch = useRef(true);

  const fetchSkills = useCallback(
    async (currentCursor: string | null, isRefresh = false) => {
      if (!enabled) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetchFromApi({
          cursor: currentCursor ?? undefined,
          search: searchQuery || undefined,
          sort: currentSort,
          limit,
        });

        if (isRefresh || currentCursor === null) {
          setSkills(response.skills);
        } else {
          setSkills((prev) => [...prev, ...response.skills]);
        }

        setCursor(response.nextCursor);
        setHasMore(response.nextCursor !== null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [enabled, searchQuery, currentSort, limit]
  );

  // Initial fetch
  useEffect(() => {
    if (isInitialFetch.current && enabled) {
      isInitialFetch.current = false;
      fetchSkills(null, true);
    }
  }, [enabled, fetchSkills]);

  // Refetch when search or sort changes
  useEffect(() => {
    if (!isInitialFetch.current) {
      fetchSkills(null, true);
    }
  }, [searchQuery, currentSort, fetchSkills]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !cursor) return;
    await fetchSkills(cursor, false);
  }, [loading, hasMore, cursor, fetchSkills]);

  const refresh = useCallback(async () => {
    setCursor(null);
    setHasMore(true);
    await fetchSkills(null, true);
  }, [fetchSkills]);

  const search = useCallback((query: string) => {
    setSearchQuery(query);
    setCursor(null);
    setHasMore(true);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setCursor(null);
    setHasMore(true);
  }, []);

  const setSort = useCallback((sort: ClawhubSkillSortOption) => {
    setCurrentSort(sort);
    setCursor(null);
    setHasMore(true);
  }, []);

  return {
    skills,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    search,
    searchQuery,
    clearSearch,
    setSort,
    currentSort,
  };
}

/**
 * Hook for searching ClaWHub registry skills with debounce
 */
export function useClawhubRegistrySearch(
  options: UseClawhubRegistrySearchOptions = {}
): UseClawhubRegistrySearchReturn {
  const { debounceMs = 300, limit = 20 } = options;

  const [results, setResults] = useState<ClawhubSkillDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executeSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetchFromApi({
          search: query,
          limit,
        });

        setResults(response.skills);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [limit]
  );

  const search = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        executeSearch(query);
      }, debounceMs);
    },
    [debounceMs, executeSearch]
  );

  const clearResults = useCallback(() => {
    setSearchQuery('');
    setResults([]);
    setError(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    results,
    loading,
    error,
    search,
    searchQuery,
    clearResults,
  };
}

/**
 * Combined hook for all ClaWHub registry operations
 */
export function useClawhubRegistry(options: UseClawhubRegistrySkillsOptions = {}) {
  const { limit = 50, enabled = true, sort = 'updated' } = options;

  // Skill list hook
  const skillsHook = useClawhubRegistrySkills({
    limit,
    enabled,
    sort,
  });

  // Search hook
  const searchHook = useClawhubRegistrySearch({
    limit,
  });

  // Computed: determine which skills to display
  const displaySkills = useMemo(() => {
    if (searchHook.searchQuery.trim()) {
      return searchHook.results;
    }
    return skillsHook.skills;
  }, [searchHook.searchQuery, searchHook.results, skillsHook.skills]);

  // Combined loading state
  const isLoading = useMemo(() => {
    return skillsHook.loading || searchHook.loading;
  }, [skillsHook.loading, searchHook.loading]);

  // Combined has more (search doesn't support pagination)
  const hasMore = useMemo(() => {
    if (searchHook.searchQuery.trim()) {
      return false;
    }
    return skillsHook.hasMore;
  }, [searchHook.searchQuery, skillsHook.hasMore]);

  // Combined load more
  const loadMore = useCallback(async () => {
    if (!searchHook.searchQuery.trim()) {
      await skillsHook.loadMore();
    }
  }, [searchHook.searchQuery, skillsHook]);

  return {
    // Skill list
    skills: skillsHook.skills,
    skillsLoading: skillsHook.loading,
    skillsError: skillsHook.error,
    skillsHasMore: skillsHook.hasMore,
    refreshSkills: skillsHook.refresh,
    setSort: skillsHook.setSort,
    currentSort: skillsHook.currentSort,

    // Search
    searchResults: searchHook.results,
    searchLoading: searchHook.loading,
    searchError: searchHook.error,
    search: searchHook.search,
    searchQuery: searchHook.searchQuery,
    clearSearch: searchHook.clearResults,

    // Combined/computed
    displaySkills,
    isLoading,
    isSearching: searchHook.searchQuery.trim().length > 0,
    hasMore,
    loadMore,
  };
}

// Re-export types
export type { ClawhubSkillDisplay, ClawhubSkillSortOption } from '@/lib/types/clawhub-registry';
