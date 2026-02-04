import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types
// ============================================================================

/**
 * Author information for a cloud MCP package
 */
export interface CloudPackageAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

/**
 * Cloud MCP package information
 */
export interface CloudMcpPackage {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string | null;
  category: string | null;
  transport: "stdio" | "sse";
  tags: string[] | null;
  repositoryUrl: string | null;
  favoritesCount: number;
  downloadsCount: number;
  ratingAvg: number;
  author: CloudPackageAuthor | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Pagination information for list responses
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Response for list/search MCP packages
 */
export interface CloudMcpListResponse {
  data: CloudMcpPackage[];
  pagination: PaginationInfo;
}

/**
 * MCP package category
 */
export interface CloudMcpCategory {
  id: string;
  name: string;
  description: string | null;
  packageCount: number | null;
}

// ============================================================================
// Hook Options
// ============================================================================

/**
 * Options for useCloudMcpPackages hook
 */
export interface UseCloudMcpPackagesOptions {
  page?: number;
  limit?: number;
  category?: string;
  sort?: "latest" | "popular" | "downloads";
  enabled?: boolean;
}

/**
 * Return type for useCloudMcpPackages hook
 */
export interface UseCloudMcpPackagesReturn {
  packages: CloudMcpPackage[];
  pagination: PaginationInfo | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Options for useCloudMcpSearch hook
 */
export interface UseCloudMcpSearchOptions {
  debounceMs?: number;
  limit?: number;
}

/**
 * Return type for useCloudMcpSearch hook
 */
export interface UseCloudMcpSearchReturn {
  results: CloudMcpPackage[];
  pagination: PaginationInfo | null;
  loading: boolean;
  error: string | null;
  search: (query: string) => void;
  searchQuery: string;
  clearResults: () => void;
}

/**
 * Return type for useCloudMcpPackage hook
 */
export interface UseCloudMcpPackageReturn {
  package: CloudMcpPackage | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Return type for useCloudMcpCategories hook
 */
export interface UseCloudMcpCategoriesReturn {
  categories: CloudMcpCategory[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for fetching cloud MCP packages with pagination and filtering
 */
export function useCloudMcpPackages(
  options: UseCloudMcpPackagesOptions = {}
): UseCloudMcpPackagesReturn {
  const { page = 1, limit = 20, category, sort, enabled = true } = options;

  const [packages, setPackages] = useState<CloudMcpPackage[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await invoke<CloudMcpListResponse>(
        "list_cloud_mcp_packages",
        {
          page,
          limit,
          category: category ?? null,
          sort: sort ?? null,
        }
      );

      setPackages(response.data);
      setPagination(response.pagination);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setPackages([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, page, limit, category, sort]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  return {
    packages,
    pagination,
    loading,
    error,
    refetch: fetchPackages,
  };
}

/**
 * Hook for searching cloud MCP packages with debounce
 */
export function useCloudMcpSearch(
  options: UseCloudMcpSearchOptions = {}
): UseCloudMcpSearchReturn {
  const { debounceMs = 300, limit = 20 } = options;

  const [results, setResults] = useState<CloudMcpPackage[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const executeSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        setPagination(null);
        setError(null);
        return;
      }

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);

      try {
        const response = await invoke<CloudMcpListResponse>(
          "search_cloud_mcp_packages",
          {
            query,
            page: 1,
            limit,
          }
        );

        setResults(response.data);
        setPagination(response.pagination);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setResults([]);
        setPagination(null);
      } finally {
        setLoading(false);
      }
    },
    [limit]
  );

  const search = useCallback(
    (query: string) => {
      setSearchQuery(query);

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set up debounced search
      debounceTimerRef.current = setTimeout(() => {
        executeSearch(query);
      }, debounceMs);
    },
    [debounceMs, executeSearch]
  );

  const clearResults = useCallback(() => {
    setSearchQuery("");
    setResults([]);
    setPagination(null);
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
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    results,
    pagination,
    loading,
    error,
    search,
    searchQuery,
    clearResults,
  };
}

/**
 * Hook for fetching a single cloud MCP package by ID
 * Includes simple caching for recently viewed packages
 */
export function useCloudMcpPackage(
  id: string | null
): UseCloudMcpPackageReturn {
  const [pkg, setPkg] = useState<CloudMcpPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simple cache for recently viewed packages
  const cacheRef = useRef<Map<string, CloudMcpPackage>>(new Map());

  const fetchPackage = useCallback(async () => {
    if (!id) {
      setPkg(null);
      return;
    }

    // Check cache first
    const cached = cacheRef.current.get(id);
    if (cached) {
      setPkg(cached);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await invoke<CloudMcpPackage>("get_cloud_mcp_package", {
        id,
      });

      // Store in cache (limit cache size to 50 items)
      if (cacheRef.current.size >= 50) {
        const firstKey = cacheRef.current.keys().next().value;
        if (firstKey) {
          cacheRef.current.delete(firstKey);
        }
      }
      cacheRef.current.set(id, result);

      setPkg(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setPkg(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPackage();
  }, [fetchPackage]);

  const refetch = useCallback(async () => {
    if (id) {
      // Clear cache for this ID to force refetch
      cacheRef.current.delete(id);
      await fetchPackage();
    }
  }, [id, fetchPackage]);

  return {
    package: pkg,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching cloud MCP categories
 * Categories are cached for the lifetime of the component
 */
export function useCloudMcpCategories(): UseCloudMcpCategoriesReturn {
  const [categories, setCategories] = useState<CloudMcpCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await invoke<CloudMcpCategory[]>(
        "get_cloud_mcp_categories"
      );
      setCategories(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories,
  };
}

// ============================================================================
// Combined Hook (Optional convenience hook)
// ============================================================================

/**
 * Options for useCloudMcp hook
 */
export interface UseCloudMcpOptions {
  /** Initial page for package list */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Category filter */
  category?: string;
  /** Sort order */
  sort?: "latest" | "popular" | "downloads";
  /** Debounce time for search in ms */
  searchDebounceMs?: number;
  /** Whether to fetch packages on mount */
  fetchOnMount?: boolean;
}

/**
 * Combined hook for all cloud MCP operations
 * Provides a unified interface for marketplace functionality
 */
export function useCloudMcp(options: UseCloudMcpOptions = {}) {
  const {
    page = 1,
    limit = 20,
    category,
    sort,
    searchDebounceMs = 300,
    fetchOnMount = true,
  } = options;

  // Package list hook
  const packagesHook = useCloudMcpPackages({
    page,
    limit,
    category,
    sort,
    enabled: fetchOnMount,
  });

  // Search hook
  const searchHook = useCloudMcpSearch({
    debounceMs: searchDebounceMs,
    limit,
  });

  // Categories hook
  const categoriesHook = useCloudMcpCategories();

  // Selected package state
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    null
  );
  const selectedPackageHook = useCloudMcpPackage(selectedPackageId);

  // Computed: determine which packages to display (list or search results)
  const displayPackages = useMemo(() => {
    if (searchHook.searchQuery.trim()) {
      return searchHook.results;
    }
    return packagesHook.packages;
  }, [searchHook.searchQuery, searchHook.results, packagesHook.packages]);

  const displayPagination = useMemo(() => {
    if (searchHook.searchQuery.trim()) {
      return searchHook.pagination;
    }
    return packagesHook.pagination;
  }, [searchHook.searchQuery, searchHook.pagination, packagesHook.pagination]);

  // Combined loading state
  const isLoading = useMemo(() => {
    return (
      packagesHook.loading ||
      searchHook.loading ||
      categoriesHook.loading ||
      selectedPackageHook.loading
    );
  }, [
    packagesHook.loading,
    searchHook.loading,
    categoriesHook.loading,
    selectedPackageHook.loading,
  ]);

  return {
    // Package list
    packages: packagesHook.packages,
    packagesLoading: packagesHook.loading,
    packagesError: packagesHook.error,
    packagesPagination: packagesHook.pagination,
    refetchPackages: packagesHook.refetch,

    // Search
    searchResults: searchHook.results,
    searchLoading: searchHook.loading,
    searchError: searchHook.error,
    searchPagination: searchHook.pagination,
    search: searchHook.search,
    searchQuery: searchHook.searchQuery,
    clearSearch: searchHook.clearResults,

    // Categories
    categories: categoriesHook.categories,
    categoriesLoading: categoriesHook.loading,
    categoriesError: categoriesHook.error,
    refetchCategories: categoriesHook.refetch,

    // Selected package
    selectedPackage: selectedPackageHook.package,
    selectedPackageLoading: selectedPackageHook.loading,
    selectedPackageError: selectedPackageHook.error,
    selectPackage: setSelectedPackageId,
    refetchSelectedPackage: selectedPackageHook.refetch,

    // Combined/computed
    displayPackages,
    displayPagination,
    isLoading,
    isSearching: searchHook.searchQuery.trim().length > 0,
  };
}
