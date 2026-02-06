'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  OfficialServerDisplay,
  OfficialRegistryApiResponse,
  OfficialPackageRegistryType,
} from '@/lib/types/official-registry';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for useOfficialRegistryServers hook
 */
export interface UseOfficialRegistryServersOptions {
  /** Initial search query */
  search?: string;
  /** Number of results per page */
  limit?: number;
  /** Whether to fetch on mount */
  enabled?: boolean;
}

/**
 * Return type for useOfficialRegistryServers hook
 */
export interface UseOfficialRegistryServersReturn {
  servers: OfficialServerDisplay[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  totalCount: number;
  /** Load the next page of results */
  loadMore: () => Promise<void>;
  /** Refresh the list */
  refresh: () => Promise<void>;
  /** Search for servers */
  search: (query: string) => void;
  /** Current search query */
  searchQuery: string;
  /** Clear search and results */
  clearSearch: () => void;
}

/**
 * Options for useOfficialRegistrySearch hook
 */
export interface UseOfficialRegistrySearchOptions {
  /** Debounce time in ms */
  debounceMs?: number;
  /** Results per page */
  limit?: number;
}

/**
 * Return type for useOfficialRegistrySearch hook
 */
export interface UseOfficialRegistrySearchReturn {
  results: OfficialServerDisplay[];
  loading: boolean;
  error: string | null;
  search: (query: string) => void;
  searchQuery: string;
  clearResults: () => void;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the display name for a package registry type
 */
export function getPackageTypeLabel(type: OfficialPackageRegistryType): string {
  const labels: Record<OfficialPackageRegistryType, string> = {
    npm: 'Node.js (npm)',
    pypi: 'Python (PyPI)',
    oci: 'Docker (OCI)',
    nuget: '.NET (NuGet)',
    mcpb: 'MCP Binary',
  };
  return labels[type] ?? type;
}

/**
 * Fetch from our API proxy
 */
async function fetchFromApi(
  params: Record<string, string | number | undefined>
): Promise<OfficialRegistryApiResponse> {
  const url = new URL('/api/official-registry', window.location.origin);

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
 * Hook for fetching official registry servers with pagination
 */
export function useOfficialRegistryServers(
  options: UseOfficialRegistryServersOptions = {}
): UseOfficialRegistryServersReturn {
  const { search: initialSearch = '', limit = 50, enabled = true } = options;

  const [servers, setServers] = useState<OfficialServerDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  const isInitialFetch = useRef(true);

  const fetchServers = useCallback(
    async (currentCursor: string | null, isRefresh = false) => {
      if (!enabled) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetchFromApi({
          cursor: currentCursor ?? undefined,
          search: searchQuery || undefined,
          limit,
        });

        if (isRefresh || currentCursor === null) {
          setServers(response.servers);
        } else {
          setServers((prev) => [...prev, ...response.servers]);
        }

        setCursor(response.nextCursor);
        setHasMore(response.nextCursor !== null);
        setTotalCount(response.count);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [enabled, searchQuery, limit]
  );

  // Initial fetch
  useEffect(() => {
    if (isInitialFetch.current && enabled) {
      isInitialFetch.current = false;
      fetchServers(null, true);
    }
  }, [enabled, fetchServers]);

  // Refetch when search changes
  useEffect(() => {
    if (!isInitialFetch.current) {
      fetchServers(null, true);
    }
  }, [searchQuery, fetchServers]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !cursor) return;
    await fetchServers(cursor, false);
  }, [loading, hasMore, cursor, fetchServers]);

  const refresh = useCallback(async () => {
    setCursor(null);
    setHasMore(true);
    await fetchServers(null, true);
  }, [fetchServers]);

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

  return {
    servers,
    loading,
    error,
    hasMore,
    totalCount,
    loadMore,
    refresh,
    search,
    searchQuery,
    clearSearch,
  };
}

/**
 * Hook for searching official registry servers with debounce
 */
export function useOfficialRegistrySearch(
  options: UseOfficialRegistrySearchOptions = {}
): UseOfficialRegistrySearchReturn {
  const { debounceMs = 300, limit = 20 } = options;

  const [results, setResults] = useState<OfficialServerDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executeSearch = useCallback(
    async (query: string, cursorValue: string | null = null) => {
      if (!query.trim()) {
        setResults([]);
        setHasMore(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetchFromApi({
          cursor: cursorValue ?? undefined,
          search: query,
          limit,
        });

        if (cursorValue === null) {
          setResults(response.servers);
        } else {
          setResults((prev) => [...prev, ...response.servers]);
        }

        setCursor(response.nextCursor);
        setHasMore(response.nextCursor !== null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setResults([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [limit]
  );

  const search = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setCursor(null);

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
    setCursor(null);
    setHasMore(false);
    setError(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !cursor || !searchQuery.trim()) return;
    await executeSearch(searchQuery, cursor);
  }, [loading, hasMore, cursor, searchQuery, executeSearch]);

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
    hasMore,
    loadMore,
  };
}

/**
 * Combined hook for all official registry operations
 */
export function useOfficialRegistry(options: UseOfficialRegistryServersOptions = {}) {
  const { limit = 50, enabled = true } = options;

  // Server list hook
  const serversHook = useOfficialRegistryServers({
    limit,
    enabled,
  });

  // Search hook
  const searchHook = useOfficialRegistrySearch({
    limit,
  });

  // Computed: determine which servers to display
  const displayServers = useMemo(() => {
    if (searchHook.searchQuery.trim()) {
      return searchHook.results;
    }
    return serversHook.servers;
  }, [searchHook.searchQuery, searchHook.results, serversHook.servers]);

  // Combined loading state
  const isLoading = useMemo(() => {
    return serversHook.loading || searchHook.loading;
  }, [serversHook.loading, searchHook.loading]);

  // Combined has more
  const hasMore = useMemo(() => {
    if (searchHook.searchQuery.trim()) {
      return searchHook.hasMore;
    }
    return serversHook.hasMore;
  }, [searchHook.searchQuery, searchHook.hasMore, serversHook.hasMore]);

  // Combined load more
  const loadMore = useCallback(async () => {
    if (searchHook.searchQuery.trim()) {
      await searchHook.loadMore();
    } else {
      await serversHook.loadMore();
    }
  }, [searchHook, serversHook]);

  return {
    // Server list
    servers: serversHook.servers,
    serversLoading: serversHook.loading,
    serversError: serversHook.error,
    serversHasMore: serversHook.hasMore,
    totalCount: serversHook.totalCount,
    refreshServers: serversHook.refresh,

    // Search
    searchResults: searchHook.results,
    searchLoading: searchHook.loading,
    searchError: searchHook.error,
    search: searchHook.search,
    searchQuery: searchHook.searchQuery,
    clearSearch: searchHook.clearResults,
    searchHasMore: searchHook.hasMore,

    // Combined/computed
    displayServers,
    isLoading,
    isSearching: searchHook.searchQuery.trim().length > 0,
    hasMore,
    loadMore,
  };
}

// Re-export types
export type {
  OfficialServerDisplay,
  OfficialPackageRegistryType,
} from '@/lib/types/official-registry';
