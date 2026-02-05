import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  OfficialServerDisplay,
  OfficialPackage,
  OfficialPackageRegistryType,
} from "@/types/official-registry";

// ============================================================================
// Types
// ============================================================================

/**
 * Response from list_official_servers command
 */
export interface OfficialServerListDisplay {
  servers: OfficialServerDisplay[];
  nextCursor: string | null;
  count: number;
}

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
  /** Refresh the list (clears cache) */
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

/**
 * Return type for useOfficialRegistryServer hook
 */
export interface UseOfficialRegistryServerReturn {
  server: OfficialServerDisplay | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Available versions for the server */
  versions: string[];
  versionsLoading: boolean;
  /** Select a specific version */
  selectVersion: (version: string) => void;
  /** Currently selected version */
  selectedVersion: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the display name for a package registry type
 */
export function getPackageTypeLabel(type: OfficialPackageRegistryType): string {
  switch (type) {
    case "npm":
      return "Node.js (npm)";
    case "pypi":
      return "Python (PyPI)";
    case "oci":
      return "Docker (OCI)";
    case "nuget":
      return ".NET (NuGet)";
    case "mcpb":
      return "MCP Binary";
    default:
      return type;
  }
}

/**
 * Get the install command for a package
 */
export function getInstallCommand(pkg: OfficialPackage): string {
  switch (pkg.registryType) {
    case "npm":
      return `npx ${pkg.identifier}${pkg.version ? `@${pkg.version}` : ""}`;
    case "pypi":
      return `uvx ${pkg.identifier}${pkg.version ? `==${pkg.version}` : ""}`;
    case "oci":
      return `docker run ${pkg.identifier}${pkg.version ? `:${pkg.version}` : ""}`;
    case "nuget":
      return `dotnet tool install ${pkg.identifier}${pkg.version ? ` --version ${pkg.version}` : ""}`;
    case "mcpb":
      return `# Download from registry: ${pkg.identifier}`;
    default:
      return pkg.identifier;
  }
}

/**
 * Get the primary icon URL from a server
 */
export function getServerIconUrl(
  server: OfficialServerDisplay,
  theme?: "light" | "dark"
): string | null {
  const original = server._original?.server;
  if (!original?.icons || original.icons.length === 0) {
    return server.iconUrl;
  }

  // Try to find a theme-matching icon
  if (theme) {
    const themedIcon = original.icons.find((i) => i.theme === theme);
    if (themedIcon) {
      return themedIcon.src;
    }
  }

  // Return first icon
  return original.icons[0].src;
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
  const { search: initialSearch = "", limit = 50, enabled = true } = options;

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
        const response = await invoke<OfficialServerListDisplay>(
          "list_official_servers",
          {
            cursor: currentCursor,
            search: searchQuery || null,
            limit,
          }
        );

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
    // Clear cache first
    await invoke("clear_official_registry_cache");
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
    setSearchQuery("");
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
  const [searchQuery, setSearchQuery] = useState("");
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
        const response = await invoke<OfficialServerListDisplay>(
          "list_official_servers",
          {
            cursor: cursorValue,
            search: query,
            limit,
          }
        );

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
    setSearchQuery("");
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
 * Hook for fetching a single official registry server
 */
export function useOfficialRegistryServer(
  serverName: string | null
): UseOfficialRegistryServerReturn {
  const [server, setServer] = useState<OfficialServerDisplay | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<string[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  const fetchServer = useCallback(async () => {
    if (!serverName) {
      setServer(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await invoke<OfficialServerDisplay>("get_official_server", {
        name: serverName,
        version: selectedVersion,
      });
      setServer(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setServer(null);
    } finally {
      setLoading(false);
    }
  }, [serverName, selectedVersion]);

  const fetchVersions = useCallback(async () => {
    if (!serverName) {
      setVersions([]);
      return;
    }

    setVersionsLoading(true);

    try {
      const result = await invoke<string[]>("get_official_server_versions", {
        name: serverName,
      });
      setVersions(result);
    } catch {
      // Versions fetch failure is not critical
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  }, [serverName]);

  // Fetch server when name or version changes
  useEffect(() => {
    fetchServer();
  }, [fetchServer]);

  // Fetch versions when name changes
  useEffect(() => {
    fetchVersions();
    setSelectedVersion(null);
  }, [serverName, fetchVersions]);

  const refetch = useCallback(async () => {
    if (serverName) {
      await invoke("invalidate_official_server_cache", { name: serverName });
    }
    await fetchServer();
  }, [serverName, fetchServer]);

  const selectVersion = useCallback((version: string) => {
    setSelectedVersion(version);
  }, []);

  return {
    server,
    loading,
    error,
    refetch,
    versions,
    versionsLoading,
    selectVersion,
    selectedVersion,
  };
}

// ============================================================================
// Combined Hook
// ============================================================================

/**
 * Options for useOfficialRegistry hook
 */
export interface UseOfficialRegistryOptions {
  /** Results per page */
  limit?: number;
  /** Debounce time for search in ms */
  searchDebounceMs?: number;
  /** Whether to fetch on mount */
  fetchOnMount?: boolean;
}

/**
 * Combined hook for all official registry operations
 */
export function useOfficialRegistry(options: UseOfficialRegistryOptions = {}) {
  const { limit = 50, searchDebounceMs = 300, fetchOnMount = true } = options;

  // Server list hook
  const serversHook = useOfficialRegistryServers({
    limit,
    enabled: fetchOnMount,
  });

  // Search hook
  const searchHook = useOfficialRegistrySearch({
    debounceMs: searchDebounceMs,
    limit,
  });

  // Selected server state
  const [selectedServerName, setSelectedServerName] = useState<string | null>(
    null
  );
  const selectedServerHook = useOfficialRegistryServer(selectedServerName);

  // Computed: determine which servers to display
  const displayServers = useMemo(() => {
    if (searchHook.searchQuery.trim()) {
      return searchHook.results;
    }
    return serversHook.servers;
  }, [searchHook.searchQuery, searchHook.results, serversHook.servers]);

  // Combined loading state
  const isLoading = useMemo(() => {
    return (
      serversHook.loading ||
      searchHook.loading ||
      selectedServerHook.loading
    );
  }, [serversHook.loading, searchHook.loading, selectedServerHook.loading]);

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

    // Selected server
    selectedServer: selectedServerHook.server,
    selectedServerLoading: selectedServerHook.loading,
    selectedServerError: selectedServerHook.error,
    selectServer: setSelectedServerName,
    refetchSelectedServer: selectedServerHook.refetch,
    serverVersions: selectedServerHook.versions,
    versionsLoading: selectedServerHook.versionsLoading,
    selectServerVersion: selectedServerHook.selectVersion,
    selectedVersion: selectedServerHook.selectedVersion,

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
  OfficialPackage,
  OfficialPackageRegistryType,
} from "@/types/official-registry";

export type { OfficialServerResponse } from "@/types/official-registry";
