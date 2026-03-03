/**
 * GitHub Hooks
 *
 * React hooks for GitHub integration.
 */

import { useState, useCallback, useEffect } from "react";
import {
  getGitHubClient,
  type GitHubAuthStatus,
  type GitHubUser,
  type GitHubRepository,
  type GitHubRepositoryConfig,
  type GitHubIssue,
  type GitHubPullRequest,
  type GitHubRelease,
  type GitHubIssueInvestigation,
  type GitHubImportResult,
} from "@/lib/github-client";

// ============================================================================
// useGitHubAuth
// ============================================================================

export interface UseGitHubAuthResult {
  /** Authentication status */
  status: GitHubAuthStatus | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh status */
  refresh: () => Promise<void>;
  /** Authenticate with gh CLI */
  authenticateWithGhCli: () => Promise<GitHubUser | null>;
  /** Authenticate with PAT */
  authenticateWithPAT: (token: string) => Promise<GitHubUser | null>;
  /** Sign out */
  signOut: () => Promise<void>;
}

/**
 * Hook for GitHub authentication management
 */
export function useGitHubAuth(workspacePath: string | null): UseGitHubAuthResult {
  const [status, setStatus] = useState<GitHubAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspacePath) {
      setStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getGitHubClient();
      const result = await client.getAuthStatus(workspacePath);
      setStatus(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get auth status");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  const authenticateWithGhCli = useCallback(async (): Promise<GitHubUser | null> => {
    if (!workspacePath) return null;

    setLoading(true);
    setError(null);

    try {
      const client = getGitHubClient();
      const { user } = await client.authenticateWithGhCli(workspacePath);
      await refresh();
      return user;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, [workspacePath, refresh]);

  const authenticateWithPAT = useCallback(async (token: string): Promise<GitHubUser | null> => {
    if (!workspacePath) return null;

    setLoading(true);
    setError(null);

    try {
      const client = getGitHubClient();
      const { user } = await client.authenticateWithPAT(workspacePath, token);
      await refresh();
      return user;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, [workspacePath, refresh]);

  const signOut = useCallback(async (): Promise<void> => {
    if (!workspacePath) return;

    setLoading(true);
    setError(null);

    try {
      const client = getGitHubClient();
      await client.signOut(workspacePath);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign out failed");
    } finally {
      setLoading(false);
    }
  }, [workspacePath, refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    status,
    loading,
    error,
    refresh,
    authenticateWithGhCli,
    authenticateWithPAT,
    signOut,
  };
}

// ============================================================================
// useGitHubRepository
// ============================================================================

export interface UseGitHubRepositoryResult {
  /** Connected repository */
  repository: GitHubRepositoryConfig | null;
  /** Detected repository from .git */
  detectedRepository: GitHubRepository | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh repository info */
  refresh: () => Promise<void>;
  /** Detect repository from workspace */
  detectRepository: () => Promise<GitHubRepository | null>;
  /** Connect to a repository */
  connectRepository: (owner: string, name: string) => Promise<GitHubRepository | null>;
  /** Disconnect from repository */
  disconnectRepository: () => Promise<void>;
}

/**
 * Hook for GitHub repository management
 */
export function useGitHubRepository(workspacePath: string | null): UseGitHubRepositoryResult {
  const [repository, setRepository] = useState<GitHubRepositoryConfig | null>(null);
  const [detectedRepository, setDetectedRepository] = useState<GitHubRepository | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspacePath) {
      setRepository(null);
      setDetectedRepository(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getGitHubClient();
      const [connected, detected] = await Promise.all([
        client.getConnectedRepository(workspacePath),
        client.detectRepository(workspacePath),
      ]);
      setRepository(connected.repository);
      setDetectedRepository(detected.repository);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get repository info");
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  const detectRepository = useCallback(async (): Promise<GitHubRepository | null> => {
    if (!workspacePath) return null;

    setLoading(true);
    setError(null);

    try {
      const client = getGitHubClient();
      const { repository } = await client.detectRepository(workspacePath);
      setDetectedRepository(repository);
      return repository;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to detect repository");
      return null;
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  const connectRepository = useCallback(async (owner: string, name: string): Promise<GitHubRepository | null> => {
    if (!workspacePath) return null;

    setLoading(true);
    setError(null);

    try {
      const client = getGitHubClient();
      const { repository } = await client.connectRepository(workspacePath, owner, name);
      await refresh();
      return repository;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect repository");
      return null;
    } finally {
      setLoading(false);
    }
  }, [workspacePath, refresh]);

  const disconnectRepository = useCallback(async (): Promise<void> => {
    if (!workspacePath) return;

    setLoading(true);
    setError(null);

    try {
      const client = getGitHubClient();
      await client.disconnectRepository(workspacePath);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect repository");
    } finally {
      setLoading(false);
    }
  }, [workspacePath, refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    repository,
    detectedRepository,
    loading,
    error,
    refresh,
    detectRepository,
    connectRepository,
    disconnectRepository,
  };
}

// ============================================================================
// useGitHubIssues
// ============================================================================

export interface UseGitHubIssuesOptions {
  /** External state filter - if provided, internal state is not used */
  stateFilter?: "open" | "closed" | "all";
}

export interface UseGitHubIssuesResult {
  /** Issues list */
  issues: GitHubIssue[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Current page */
  page: number;
  /** Has more pages */
  hasMore: boolean;
  /** Refresh issues */
  refresh: () => Promise<void>;
  /** Load more issues */
  loadMore: () => Promise<void>;
  /** Set state filter (only works when external stateFilter is not provided) */
  setStateFilter: (state: "open" | "closed" | "all") => void;
  /** Current state filter */
  stateFilter: "open" | "closed" | "all";
  /** Investigate an issue */
  investigateIssue: (issueNumber: number, saveSpec?: boolean) => Promise<GitHubIssueInvestigation | null>;
  /** Import issues */
  importIssues: (issueNumbers: number[]) => Promise<GitHubImportResult | null>;
}

/**
 * Hook for GitHub issues management
 */
export function useGitHubIssues(
  workspacePath: string | null,
  options?: UseGitHubIssuesOptions
): UseGitHubIssuesResult {
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [internalStateFilter, setInternalStateFilter] = useState<"open" | "closed" | "all">("open");

  // Use external stateFilter if provided, otherwise use internal state
  const stateFilter = options?.stateFilter ?? internalStateFilter;
  const setStateFilter = setInternalStateFilter;

  const refresh = useCallback(async () => {
    if (!workspacePath) {
      setIssues([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setPage(1);

    try {
      const client = getGitHubClient();
      const result = await client.listIssues(workspacePath, {
        state: stateFilter,
        page: 1,
        per_page: 20,
      });
      setIssues(result.items);
      setHasMore(result.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load issues");
    } finally {
      setLoading(false);
    }
  }, [workspacePath, stateFilter]);

  const loadMore = useCallback(async () => {
    if (!workspacePath || !hasMore || loading) return;

    setLoading(true);
    const nextPage = page + 1;

    try {
      const client = getGitHubClient();
      const result = await client.listIssues(workspacePath, {
        state: stateFilter,
        page: nextPage,
        per_page: 20,
      });
      setIssues((prev) => [...prev, ...result.items]);
      setPage(nextPage);
      setHasMore(result.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more issues");
    } finally {
      setLoading(false);
    }
  }, [workspacePath, page, hasMore, loading, stateFilter]);

  const investigateIssue = useCallback(async (
    issueNumber: number,
    saveSpec: boolean = false
  ): Promise<GitHubIssueInvestigation | null> => {
    if (!workspacePath) return null;

    try {
      const client = getGitHubClient();
      const { investigation } = await client.investigateIssue(workspacePath, issueNumber, saveSpec);
      return investigation;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to investigate issue");
      return null;
    }
  }, [workspacePath]);

  const importIssues = useCallback(async (issueNumbers: number[]): Promise<GitHubImportResult | null> => {
    if (!workspacePath) return null;

    try {
      const client = getGitHubClient();
      return await client.importIssues(workspacePath, issueNumbers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import issues");
      return null;
    }
  }, [workspacePath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    issues,
    loading,
    error,
    page,
    hasMore,
    refresh,
    loadMore,
    setStateFilter,
    stateFilter,
    investigateIssue,
    importIssues,
  };
}

// ============================================================================
// useGitHubPRs
// ============================================================================

export interface UseGitHubPRsResult {
  /** PRs list */
  prs: GitHubPullRequest[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Current page */
  page: number;
  /** Has more pages */
  hasMore: boolean;
  /** Refresh PRs */
  refresh: () => Promise<void>;
  /** Load more PRs */
  loadMore: () => Promise<void>;
  /** Set state filter */
  setStateFilter: (state: "open" | "closed" | "all") => void;
  /** Current state filter */
  stateFilter: "open" | "closed" | "all";
  /** Create a PR */
  createPR: (params: {
    title: string;
    body?: string;
    head: string;
    base: string;
    draft?: boolean;
  }) => Promise<GitHubPullRequest | null>;
}

/**
 * Hook for GitHub PRs management
 */
export function useGitHubPRs(workspacePath: string | null): UseGitHubPRsResult {
  const [prs, setPrs] = useState<GitHubPullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [stateFilter, setStateFilter] = useState<"open" | "closed" | "all">("open");

  const refresh = useCallback(async () => {
    if (!workspacePath) {
      setPrs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setPage(1);

    try {
      const client = getGitHubClient();
      const result = await client.listPullRequests(workspacePath, {
        state: stateFilter,
        page: 1,
        per_page: 20,
      });
      setPrs(result.items);
      setHasMore(result.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PRs");
    } finally {
      setLoading(false);
    }
  }, [workspacePath, stateFilter]);

  const loadMore = useCallback(async () => {
    if (!workspacePath || !hasMore || loading) return;

    setLoading(true);
    const nextPage = page + 1;

    try {
      const client = getGitHubClient();
      const result = await client.listPullRequests(workspacePath, {
        state: stateFilter,
        page: nextPage,
        per_page: 20,
      });
      setPrs((prev) => [...prev, ...result.items]);
      setPage(nextPage);
      setHasMore(result.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more PRs");
    } finally {
      setLoading(false);
    }
  }, [workspacePath, page, hasMore, loading, stateFilter]);

  const createPR = useCallback(async (params: {
    title: string;
    body?: string;
    head: string;
    base: string;
    draft?: boolean;
  }): Promise<GitHubPullRequest | null> => {
    if (!workspacePath) return null;

    try {
      const client = getGitHubClient();
      const { pr } = await client.createPullRequest(workspacePath, params);
      await refresh();
      return pr;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create PR");
      return null;
    }
  }, [workspacePath, refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    prs,
    loading,
    error,
    page,
    hasMore,
    refresh,
    loadMore,
    setStateFilter,
    stateFilter,
    createPR,
  };
}

// ============================================================================
// useGitHubReleases
// ============================================================================

export interface UseGitHubReleasesResult {
  /** Releases list */
  releases: GitHubRelease[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Current page */
  page: number;
  /** Has more pages */
  hasMore: boolean;
  /** Refresh releases */
  refresh: () => Promise<void>;
  /** Load more releases */
  loadMore: () => Promise<void>;
  /** Create a release */
  createRelease: (params: {
    tag_name: string;
    name?: string;
    body?: string;
    draft?: boolean;
    prerelease?: boolean;
  }) => Promise<GitHubRelease | null>;
}

/**
 * Hook for GitHub releases management
 */
export function useGitHubReleases(workspacePath: string | null): UseGitHubReleasesResult {
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspacePath) {
      setReleases([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setPage(1);

    try {
      const client = getGitHubClient();
      const result = await client.listReleases(workspacePath, 1, 20);
      setReleases(result.items);
      setHasMore(result.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load releases");
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  const loadMore = useCallback(async () => {
    if (!workspacePath || !hasMore || loading) return;

    setLoading(true);
    const nextPage = page + 1;

    try {
      const client = getGitHubClient();
      const result = await client.listReleases(workspacePath, nextPage, 20);
      setReleases((prev) => [...prev, ...result.items]);
      setPage(nextPage);
      setHasMore(result.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more releases");
    } finally {
      setLoading(false);
    }
  }, [workspacePath, page, hasMore, loading]);

  const createRelease = useCallback(async (params: {
    tag_name: string;
    name?: string;
    body?: string;
    draft?: boolean;
    prerelease?: boolean;
  }): Promise<GitHubRelease | null> => {
    if (!workspacePath) return null;

    try {
      const client = getGitHubClient();
      const { release } = await client.createRelease(workspacePath, params);
      await refresh();
      return release;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create release");
      return null;
    }
  }, [workspacePath, refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    releases,
    loading,
    error,
    page,
    hasMore,
    refresh,
    loadMore,
    createRelease,
  };
}
