import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types
// ============================================================================

/**
 * Author information for a cloud skill package
 */
export interface CloudPackageAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

/**
 * A skill package from the cloud marketplace
 */
export interface CloudSkillPackage {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string | null;
  category: string | null;
  skillType: string;
  triggerPatterns: string[] | null;
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
 * Response structure for skill package list endpoints
 */
export interface CloudSkillListResponse {
  data: CloudSkillPackage[];
  pagination: PaginationInfo;
}

/**
 * A skill category
 */
export interface SkillCategory {
  id: string;
  name: string;
  description: string | null;
  count: number;
}

/**
 * Options for fetching cloud skill packages
 */
export interface UseCloudSkillPackagesOptions {
  page?: number;
  limit?: number;
  category?: string;
  sort?: "latest" | "popular" | "downloads";
}

// ============================================================================
// useCloudSkillPackages - List packages with pagination
// ============================================================================

/**
 * Hook for fetching cloud skill packages with pagination and filtering
 */
export function useCloudSkillPackages(options: UseCloudSkillPackagesOptions = {}) {
  const { page = 1, limit = 20, category, sort } = options;

  const [packages, setPackages] = useState<CloudSkillPackage[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch packages from the cloud API
   */
  const fetchPackages = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await invoke<CloudSkillListResponse>(
        "list_cloud_skill_packages",
        {
          page,
          limit,
          category: category ?? null,
          sort: sort ?? null,
        }
      );

      setPackages(result.data);
      setPagination(result.pagination);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [page, limit, category, sort]);

  // Fetch on mount and when options change
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

// ============================================================================
// useCloudSkillSearch - Debounced search
// ============================================================================

/**
 * Hook for searching cloud skill packages with debounce
 */
export function useCloudSkillSearch(query: string, debounceMs = 300) {
  const [results, setResults] = useState<CloudSkillPackage[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the latest query to avoid race conditions
  const latestQuery = useRef(query);
  latestQuery.current = query;

  /**
   * Execute search against the cloud API
   */
  const executeSearch = useCallback(
    async (searchQuery: string, page = 1, limit = 20) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setPagination({
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        });
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await invoke<CloudSkillListResponse>(
          "search_cloud_skill_packages",
          {
            query: searchQuery,
            page,
            limit,
          }
        );

        // Only update state if this is still the latest query
        if (latestQuery.current === searchQuery) {
          setResults(result.data);
          setPagination(result.pagination);
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Only update error if this is still the latest query
        if (latestQuery.current === searchQuery) {
          setError(message);
        }
        return null;
      } finally {
        // Only update loading if this is still the latest query
        if (latestQuery.current === searchQuery) {
          setLoading(false);
        }
      }
    },
    []
  );

  // Debounced search effect
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeoutId = setTimeout(() => {
      executeSearch(query);
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [query, debounceMs, executeSearch]);

  /**
   * Clear search results
   */
  const clearResults = useCallback(() => {
    setResults([]);
    setPagination({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
    setError(null);
  }, []);

  return {
    results,
    pagination,
    loading,
    error,
    search: executeSearch,
    clearResults,
  };
}

// ============================================================================
// useCloudSkillPackage - Single package detail
// ============================================================================

// Simple in-memory cache for recently viewed packages
const packageCache = new Map<string, { data: CloudSkillPackage; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Hook for fetching a single cloud skill package by ID
 */
export function useCloudSkillPackage(id: string | null) {
  const [data, setData] = useState<CloudSkillPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch package details from the cloud API
   */
  const fetchPackage = useCallback(async (packageId: string) => {
    if (!packageId.trim()) {
      setError("Package ID cannot be empty");
      return null;
    }

    // Check cache first
    const cached = packageCache.get(packageId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setData(cached.data);
      return cached.data;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await invoke<CloudSkillPackage>("get_cloud_skill_package", {
        id: packageId,
      });

      // Update cache
      packageCache.set(packageId, {
        data: result,
        timestamp: Date.now(),
      });

      setData(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and when ID changes
  useEffect(() => {
    if (id) {
      fetchPackage(id);
    } else {
      setData(null);
    }
  }, [id, fetchPackage]);

  /**
   * Invalidate cache for a specific package
   */
  const invalidateCache = useCallback((packageId?: string) => {
    if (packageId) {
      packageCache.delete(packageId);
    } else {
      packageCache.clear();
    }
  }, []);

  return {
    data,
    loading,
    error,
    refetch: () => (id ? fetchPackage(id) : Promise.resolve(null)),
    invalidateCache,
  };
}

// ============================================================================
// useCloudSkillCategories - Category list
// ============================================================================

// Cache for categories (longer TTL since they change less frequently)
let categoriesCache: { data: SkillCategory[]; timestamp: number } | null = null;
const CATEGORIES_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Hook for fetching cloud skill categories
 */
export function useCloudSkillCategories() {
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch categories from the cloud API
   */
  const fetchCategories = useCallback(async (forceRefresh = false) => {
    // Check cache first (unless force refresh)
    if (
      !forceRefresh &&
      categoriesCache &&
      Date.now() - categoriesCache.timestamp < CATEGORIES_CACHE_TTL_MS
    ) {
      setCategories(categoriesCache.data);
      return categoriesCache.data;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await invoke<SkillCategory[]>("get_cloud_skill_categories");

      // Update cache
      categoriesCache = {
        data: result,
        timestamp: Date.now(),
      };

      setCategories(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  /**
   * Get a category by ID
   */
  const getCategory = useCallback(
    (categoryId: string): SkillCategory | undefined => {
      return categories.find((c) => c.id === categoryId);
    },
    [categories]
  );

  /**
   * Categories sorted by count (most packages first)
   */
  const categoriesByCount = useMemo(
    () => [...categories].sort((a, b) => b.count - a.count),
    [categories]
  );

  /**
   * Categories sorted by name
   */
  const categoriesByName = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  /**
   * Invalidate categories cache
   */
  const invalidateCache = useCallback(() => {
    categoriesCache = null;
  }, []);

  return {
    categories,
    categoriesByCount,
    categoriesByName,
    loading,
    error,
    refetch: fetchCategories,
    getCategory,
    invalidateCache,
  };
}
