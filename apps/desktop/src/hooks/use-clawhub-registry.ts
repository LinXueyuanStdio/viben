import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getGatewayClient } from "@/lib/gateway";
import type {
  ClawhubPackageItem,
  ClawhubPackageListResponse,
  ClawhubSearchResponse,
  ClawhubSkillDisplay,
  ClawhubSkillSortOption,
} from "@/types/clawhub-registry";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for useClawhubRegistrySkills hook
 */
export interface UseClawhubRegistrySkillsOptions {
  /** Number of results per page */
  limit?: number;
  /** Whether to fetch on mount */
  enabled?: boolean;
  /** Sort order for package listing */
  sort?: ClawhubSkillSortOption;
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
  /** Set the active skill sort order */
  setSort: (sort: ClawhubSkillSortOption) => void;
  /** Active skill sort order */
  currentSort: ClawhubSkillSortOption;
}

/**
 * Options for useClawhubRegistrySearch hook
 */
export interface UseClawhubRegistrySearchOptions {
  /** Debounce time in ms */
  debounceMs?: number;
  /** Results limit */
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

/**
 * Options for useClawhubRegistry hook
 */
export interface UseClawhubRegistryOptions {
  /** Results per page */
  limit?: number;
  /** Debounce time for search in ms */
  searchDebounceMs?: number;
  /** Whether to fetch on mount */
  fetchOnMount?: boolean;
  /** Sort order for package listing */
  sort?: ClawhubSkillSortOption;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Transform a ClawhubPackageItem to ClawhubSkillDisplay
 */
function transformPackageToDisplay(item: ClawhubPackageItem): ClawhubSkillDisplay {
  return {
    id: item.name,
    name: item.displayName,
    slug: item.name,
    version: item.latestVersion ?? "0.0.0",
    description: item.summary ?? null,
    ownerHandle: item.ownerHandle ?? null,
    ownerName: null,
    ownerAvatar: null,
    isOfficial: item.isOfficial,
    executesCode: item.executesCode,
    channel: item.channel,
    downloads: item.stats?.downloads ?? 0,
    stars: item.stats?.stars ?? 0,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for fetching ClaWHub registry skills with cursor-based pagination
 */
export function useClawhubRegistrySkills(
  options: UseClawhubRegistrySkillsOptions = {}
): UseClawhubRegistrySkillsReturn {
  const { limit = 50, enabled = true, sort = "updated" } = options;

  const [skills, setSkills] = useState<ClawhubSkillDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentSort, setCurrentSort] = useState<ClawhubSkillSortOption>(sort);

  const isInitialFetch = useRef(true);
  const didSortEffectMountRef = useRef(false);
  const previousSortRef = useRef(currentSort);
  const requestSeqRef = useRef(0);

  const fetchSkills = useCallback(
    async (currentCursor: string | null, isRefresh = false) => {
      if (!enabled) return;

      const requestSeq = ++requestSeqRef.current;
      const isLatestRequest = () => requestSeq === requestSeqRef.current;

      setLoading(true);
      setError(null);

      try {
        const query = buildQuery({
          limit: Math.min(limit, 100),
          sort: currentSort,
          cursor: currentCursor,
        });
        const response = await getGatewayClient().get<ClawhubPackageListResponse>(
          `/api/skill/clawhub/packages${query}`
        );

        if (!isLatestRequest()) {
          return;
        }

        const transformed = response.items.map(transformPackageToDisplay);

        if (isRefresh || currentCursor === null) {
          setSkills(transformed);
        } else {
          setSkills((prev) => [...prev, ...transformed]);
        }

        const nextCursor = response.nextCursor ?? null;
        setCursor(nextCursor);
        setHasMore(nextCursor !== null);
      } catch (err) {
        if (!isLatestRequest()) {
          return;
        }

        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        if (isLatestRequest()) {
          setLoading(false);
        }
      }
    },
    [enabled, limit, currentSort]
  );

  // Initial fetch
  useEffect(() => {
    if (isInitialFetch.current && enabled) {
      isInitialFetch.current = false;
      fetchSkills(null, true);
    }
  }, [enabled, fetchSkills]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !cursor) return;
    await fetchSkills(cursor, false);
  }, [loading, hasMore, cursor, fetchSkills]);

  const refresh = useCallback(async () => {
    setCursor(null);
    setHasMore(true);
    await fetchSkills(null, true);
  }, [fetchSkills]);

  useEffect(() => {
    setCurrentSort(sort);
  }, [sort]);

  useEffect(() => {
    if (!didSortEffectMountRef.current) {
      didSortEffectMountRef.current = true;
      return;
    }

    if (previousSortRef.current === currentSort) {
      return;
    }

    previousSortRef.current = currentSort;

    if (enabled) {
      void refresh();
    }
  }, [currentSort, enabled, refresh]);

  const setSort = useCallback((nextSort: ClawhubSkillSortOption) => {
    setCurrentSort(nextSort);
  }, []);

  return {
    skills,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
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
  const [searchQuery, setSearchQuery] = useState("");

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);

  const executeSearch = useCallback(
    async (query: string) => {
      const requestSeq = ++requestSeqRef.current;
      const isLatestRequest = () => requestSeq === requestSeqRef.current;

      if (!query.trim()) {
        setResults([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const gatewayQuery = buildQuery({
          query,
          limit: Math.min(limit, 100),
          non_suspicious_only: true,
        });
        const response = await getGatewayClient().get<ClawhubSearchResponse>(
          `/api/skill/clawhub/search${gatewayQuery}`
        );

        if (!isLatestRequest()) {
          return;
        }

        // Transform search results to ClawhubSkillDisplay format
        const transformed: ClawhubSkillDisplay[] = response.results.map(
          (result) => ({
            id: result.slug,
            name: result.displayName,
            slug: result.slug,
            version: result.version ?? "0.0.0",
            description: result.summary ?? null,
            ownerHandle: result.ownerHandle ?? result.owner?.handle ?? null,
            ownerName: result.owner?.displayName ?? null,
            ownerAvatar: result.owner?.image ?? null,
            isOfficial: false,
            executesCode: false,
            channel: "community",
            downloads: 0,
            stars: 0,
            createdAt: result.updatedAt ?? 0,
            updatedAt: result.updatedAt ?? 0,
          })
        );

        setResults(transformed);
      } catch (err) {
        if (!isLatestRequest()) {
          return;
        }

        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setResults([]);
      } finally {
        if (isLatestRequest()) {
          setLoading(false);
        }
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
    setSearchQuery("");
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

// ============================================================================
// Combined Hook
// ============================================================================

/**
 * Combined hook for all ClaWHub registry operations
 */
export function useClawhubRegistry(options: UseClawhubRegistryOptions = {}) {
  const {
    limit = 50,
    searchDebounceMs = 300,
    fetchOnMount = true,
    sort = "updated",
  } = options;

  // Skills list hook
  const skillsHook = useClawhubRegistrySkills({
    limit,
    enabled: fetchOnMount,
    sort,
  });

  // Search hook
  const searchHook = useClawhubRegistrySearch({
    debounceMs: searchDebounceMs,
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

  // Combined has more (search results don't have pagination)
  const hasMore = useMemo(() => {
    if (searchHook.searchQuery.trim()) {
      return false;
    }
    return skillsHook.hasMore;
  }, [searchHook.searchQuery, skillsHook.hasMore]);

  // Combined load more
  const loadMore = useCallback(async () => {
    if (searchHook.searchQuery.trim()) {
      // Search results don't support pagination
      return;
    }
    await skillsHook.loadMore();
  }, [searchHook.searchQuery, skillsHook.loadMore]);

  return {
    // Skills list
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
export type {
  ClawhubPackageItem,
  ClawhubSkillDisplay,
  ClawhubSkillSortOption,
} from "@/types/clawhub-registry";
