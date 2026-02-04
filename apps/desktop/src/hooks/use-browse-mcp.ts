/**
 * React Hooks for Browse MCP Platform Integration
 *
 * Provides hooks for searching, installing, and managing packages
 * from the Browse MCP platform in the desktop app.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getClient,
  searchPackages,
  listPackages,
  installMcpPackage,
  installSkillPackage,
  syncWorkspace,
  setApiKey,
  clearApiKey,
  hasApiKey,
  type McpPackage,
  type SkillPackage,
  type Workspace,
  type WorkspaceSyncResult,
} from '@/lib/browse-mcp';

// ============================================
// MCP Search Hook
// ============================================

/**
 * Hook for searching MCP packages
 *
 * Provides debounced search functionality with loading and error states.
 *
 * @param initialQuery - Initial search query (default: '')
 * @returns Search state and controls
 *
 * @example
 * ```tsx
 * function McpSearch() {
 *   const { query, setQuery, results, loading, error, search } = useMcpSearch();
 *
 *   return (
 *     <div>
 *       <input
 *         value={query}
 *         onChange={(e) => setQuery(e.target.value)}
 *         placeholder="Search MCP packages..."
 *       />
 *       {loading && <Spinner />}
 *       {error && <ErrorMessage>{error}</ErrorMessage>}
 *       <ul>
 *         {results.map((pkg) => (
 *           <li key={pkg.id}>{pkg.name}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useMcpSearch(initialQuery = '') {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<McpPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await searchPackages(q, 'mcp');
      setResults(response.packages as McpPackage[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search on query change
  useEffect(() => {
    const debounce = setTimeout(() => {
      if (query) search(query);
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, search]);

  return { query, setQuery, results, loading, error, search };
}

// ============================================
// Skill Search Hook
// ============================================

/**
 * Hook for searching skill packages
 *
 * @param initialQuery - Initial search query (default: '')
 * @returns Search state and controls
 */
export function useSkillSearch(initialQuery = '') {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SkillPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await searchPackages(q, 'skill');
      setResults(response.packages as SkillPackage[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (query) search(query);
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, search]);

  return { query, setQuery, results, loading, error, search };
}

// ============================================
// Package List Hook
// ============================================

/**
 * Hook for listing packages with pagination
 *
 * @param type - Package type ('mcp' or 'skill')
 * @param params - Initial list parameters
 * @returns Package list state and controls
 *
 * @example
 * ```tsx
 * function McpList() {
 *   const {
 *     packages,
 *     pagination,
 *     loading,
 *     error,
 *     setPage,
 *     setCategory,
 *     setSort,
 *     refresh,
 *   } = usePackageList('mcp');
 *
 *   return (
 *     <div>
 *       <select onChange={(e) => setSort(e.target.value)}>
 *         <option value="latest">Latest</option>
 *         <option value="popular">Popular</option>
 *       </select>
 *       {packages.map((pkg) => (
 *         <PackageCard key={pkg.id} pkg={pkg} />
 *       ))}
 *       <Pagination
 *         page={pagination.page}
 *         totalPages={pagination.totalPages}
 *         onPageChange={setPage}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function usePackageList(
  type: 'mcp' | 'skill' = 'mcp',
  initialParams?: {
    page?: number;
    limit?: number;
    category?: string;
    sort?: 'latest' | 'popular' | 'downloads';
  }
) {
  const [packages, setPackages] = useState<(McpPackage | SkillPackage)[]>([]);
  const [pagination, setPagination] = useState({
    page: initialParams?.page || 1,
    limit: initialParams?.limit || 20,
    total: 0,
    totalPages: 0,
  });
  const [category, setCategory] = useState(initialParams?.category);
  const [sort, setSort] = useState<'latest' | 'popular' | 'downloads'>(
    initialParams?.sort || 'latest'
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await listPackages(type, {
        page: pagination.page,
        limit: pagination.limit,
        category,
        sort,
      });
      setPackages(response.packages);
      setPagination((prev) => ({
        ...prev,
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load packages');
    } finally {
      setLoading(false);
    }
  }, [type, pagination.page, pagination.limit, category, sort]);

  // Load on mount and when params change
  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const setPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  return {
    packages,
    pagination,
    loading,
    error,
    setPage,
    setCategory,
    setSort,
    refresh: fetchPackages,
  };
}

// ============================================
// Install Package Hook
// ============================================

/**
 * Hook for installing packages
 *
 * Provides installation progress and error handling.
 *
 * @returns Install state and methods
 *
 * @example
 * ```tsx
 * function InstallButton({ pkg }: { pkg: McpPackage }) {
 *   const { installing, progress, error, installMcp } = useInstallPackage();
 *
 *   return (
 *     <button
 *       onClick={() => installMcp(pkg)}
 *       disabled={installing}
 *     >
 *       {installing ? `Installing ${progress}%` : 'Install'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useInstallPackage() {
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const installMcp = useCallback(async (pkg: McpPackage): Promise<string> => {
    setInstalling(true);
    setProgress(0);
    setError(null);

    try {
      setProgress(25);
      const path = await installMcpPackage(pkg);
      setProgress(100);
      return path;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Install failed';
      setError(message);
      throw new Error(message);
    } finally {
      setInstalling(false);
    }
  }, []);

  const installSkill = useCallback(
    async (pkg: SkillPackage): Promise<string> => {
      setInstalling(true);
      setProgress(0);
      setError(null);

      try {
        setProgress(25);
        const path = await installSkillPackage(pkg);
        setProgress(100);
        return path;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Install failed';
        setError(message);
        throw new Error(message);
      } finally {
        setInstalling(false);
      }
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);

  return { installing, progress, error, installMcp, installSkill, clearError };
}

// ============================================
// Workspaces Hook
// ============================================

/**
 * Hook for managing workspaces
 *
 * @returns Workspace list and sync functionality
 *
 * @example
 * ```tsx
 * function WorkspaceSelector() {
 *   const { workspaces, loading, error, sync, refresh } = useWorkspaces();
 *
 *   const handleSync = async (id: string) => {
 *     const { mcps, skills } = await sync(id);
 *     console.log('Synced:', mcps.length, 'MCPs,', skills.length, 'skills');
 *   };
 *
 *   return (
 *     <div>
 *       {workspaces.map((ws) => (
 *         <div key={ws.id}>
 *           <span>{ws.name}</span>
 *           <button onClick={() => handleSync(ws.id)}>Sync</button>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getClient().workspaces.list();
      setWorkspaces(response.workspaces);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const sync = useCallback(
    async (workspaceId: string): Promise<WorkspaceSyncResult> => {
      return syncWorkspace(workspaceId);
    },
    []
  );

  return {
    workspaces,
    loading,
    error,
    sync,
    refresh: fetchWorkspaces,
  };
}

// ============================================
// Platform Auth Hook
// ============================================

/**
 * Hook for platform authentication
 *
 * Manages API key state for the Browse MCP platform.
 *
 * @returns Auth state and methods
 *
 * @example
 * ```tsx
 * function ApiKeyForm() {
 *   const {
 *     isAuthenticated,
 *     loading,
 *     error,
 *     authenticate,
 *     logout,
 *   } = usePlatformAuth();
 *
 *   const [apiKey, setApiKey] = useState('');
 *
 *   const handleSubmit = async () => {
 *     await authenticate(apiKey);
 *   };
 *
 *   if (isAuthenticated) {
 *     return <button onClick={logout}>Disconnect</button>;
 *   }
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input
 *         value={apiKey}
 *         onChange={(e) => setApiKey(e.target.value)}
 *         placeholder="Enter API key"
 *       />
 *       <button disabled={loading}>Connect</button>
 *     </form>
 *   );
 * }
 * ```
 */
export function usePlatformAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(hasApiKey());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authenticate = useCallback(async (apiKey: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const success = await setApiKey(apiKey);
      setIsAuthenticated(success);
      if (!success) {
        setError('Invalid API key');
      }
      return success;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearApiKey();
    setIsAuthenticated(false);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    isAuthenticated,
    loading,
    error,
    authenticate,
    logout,
    clearError,
  };
}

// ============================================
// User Profile Hook
// ============================================

/**
 * Hook for fetching platform user profile
 *
 * @returns User profile state
 */
export function usePlatformUser() {
  const [user, setUser] = useState<{
    id: string;
    username: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    if (!hasApiKey()) {
      setUser(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getClient().user.me();
      setUser(response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return { user, loading, error, refresh: fetchUser };
}

// ============================================
// Favorites Hook
// ============================================

/**
 * Hook for managing package favorites
 *
 * @param entityType - Type of entity ('mcp' or 'skill')
 * @param entityId - ID of the entity
 * @returns Favorite state and toggle method
 */
export function useFavorite(entityType: 'mcp' | 'skill', entityId: string) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const api = getClient();
      const response =
        entityType === 'mcp'
          ? await api.mcp.toggleFavorite(entityId)
          : await api.skills.toggleFavorite(entityId);
      setIsFavorited(response.favorited);
      return response.favorited;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to toggle favorite';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  return { isFavorited, loading, error, toggle };
}
