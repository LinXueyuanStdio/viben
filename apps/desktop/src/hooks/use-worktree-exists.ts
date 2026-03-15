/**
 * Hook to check if a worktree path exists
 * Used to detect if worktree has been cleaned up after task approval
 */

import { useState, useEffect } from "react";
import { getGatewayClient } from "@/lib/gateway";

interface WorktreeExistsResult {
  exists: boolean | null;  // null = checking, true = exists, false = cleaned up
  isChecking: boolean;
  error: string | null;
}

/**
 * Check if a worktree path exists on the filesystem
 * @param worktreePath - The worktree path to check
 * @returns Object with exists status, loading state, and any error
 */
export function useWorktreeExists(worktreePath: string | null | undefined): WorktreeExistsResult {
  const [exists, setExists] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!worktreePath) {
      setExists(null);
      setIsChecking(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const checkExists = async () => {
      setIsChecking(true);
      setError(null);

      try {
        const client = getGatewayClient();
        // Try to list the directory - if it fails, the path doesn't exist
        await client.listFiles(worktreePath, false);
        if (!cancelled) {
          setExists(true);
        }
      } catch (err) {
        if (!cancelled) {
          // If we get an error, the path likely doesn't exist
          // Check for common "not found" error patterns
          const errorMessage = err instanceof Error ? err.message : String(err);
          if (
            errorMessage.includes("ENOENT") ||
            errorMessage.includes("not found") ||
            errorMessage.includes("does not exist") ||
            errorMessage.includes("No such file")
          ) {
            setExists(false);
          } else {
            // Some other error - could be permission issue, etc.
            setError(errorMessage);
            setExists(null);
          }
        }
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    };

    checkExists();

    return () => {
      cancelled = true;
    };
  }, [worktreePath]);

  return { exists, isChecking, error };
}
