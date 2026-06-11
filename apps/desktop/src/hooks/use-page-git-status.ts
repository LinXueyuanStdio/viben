/**
 * usePageGitStatus Hook
 *
 * Fetches git status and diff data for a page directory via the gateway API.
 * Used by PageDiffPanel to display file changes and diffs.
 */

import { useState, useEffect, useCallback } from "react";
import { getGatewayUrl } from "@/lib/gateway/config";

// ============================================================================
// Types
// ============================================================================

export interface GitFileChange {
  /** Relative path within the page directory */
  path: string;
  /** File change status */
  status: "modified" | "added" | "deleted" | "renamed";
  /** Original path for renamed files */
  oldPath?: string;
}

export interface GitDiffResult {
  /** Old (original) file content */
  oldContent: string;
  /** New (modified) file content */
  newContent: string;
}

interface UsePageGitStatusReturn {
  /** List of changed files */
  changes: GitFileChange[];
  /** Whether data is currently loading */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Re-fetch git status */
  refresh: () => void;
  /** Fetch diff for a specific file */
  fetchDiff: (filePath: string) => Promise<GitDiffResult | null>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function usePageGitStatus(
  workspacePath: string,
  pageSlug: string
): UsePageGitStatusReturn {
  const [changes, setChanges] = useState<GitFileChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!workspacePath || !pageSlug) {
      setChanges([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const baseUrl = getGatewayUrl();
      const params = new URLSearchParams({
        workspace_path: workspacePath,
        dir_path: `pages/${pageSlug}`,
      });

      const response = await fetch(
        `${baseUrl}/api/files/git-status?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch git status: ${response.statusText}`);
      }

      const data = await response.json();
      setChanges(data as GitFileChange[]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch git status";
      setError(message);
      setChanges([]);
    } finally {
      setLoading(false);
    }
  }, [workspacePath, pageSlug]);

  const fetchDiff = useCallback(
    async (filePath: string): Promise<GitDiffResult | null> => {
      if (!workspacePath) return null;

      try {
        const baseUrl = getGatewayUrl();
        const params = new URLSearchParams({
          workspace_path: workspacePath,
          file_path: filePath,
        });

        const response = await fetch(
          `${baseUrl}/api/files/git-diff?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch diff: ${response.statusText}`);
        }

        const data = await response.json();
        return data as GitDiffResult;
      } catch {
        return null;
      }
    },
    [workspacePath]
  );

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    changes,
    loading,
    error,
    refresh: fetchStatus,
    fetchDiff,
  };
}
