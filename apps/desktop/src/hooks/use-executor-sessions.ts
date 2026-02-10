/**
 * Hook for managing executor sessions
 *
 * Discovers and loads sessions for a specific executor type in a workspace.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getGatewayClient,
  type ExecutorSession,
  type ExecutorUIMessage,
} from "@/lib/gateway";

// ============================================================================
// Types
// ============================================================================

export interface UseExecutorSessionsReturn {
  /** Discovered sessions */
  sessions: ExecutorSession[];
  /** Whether sessions are being loaded */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Refresh sessions from the backend */
  refresh: () => Promise<void>;
}

export interface UseExecutorSessionMessagesReturn {
  /** Messages in the session */
  messages: ExecutorUIMessage[];
  /** Whether messages are being loaded */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Refresh messages from the backend */
  refresh: () => Promise<void>;
}

// ============================================================================
// Hook: useExecutorSessions
// ============================================================================

/**
 * Hook for discovering and loading executor sessions in a workspace
 *
 * @param executorType - The executor type (e.g., "claude-code"), or null to skip loading
 * @param workspacePath - Absolute path to the workspace, or null to skip loading
 * @returns Sessions, loading state, error, and refresh function
 *
 * @example
 * ```tsx
 * const { sessions, isLoading, error, refresh } = useExecutorSessions(
 *   "claude-code",
 *   "/path/to/workspace"
 * );
 * ```
 */
export function useExecutorSessions(
  executorType: string | null,
  workspacePath: string | null
): UseExecutorSessionsReturn {
  const [sessions, setSessions] = useState<ExecutorSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track loading state to prevent concurrent requests
  const isLoadingRef = useRef(false);
  // Track last loaded params to detect changes
  const lastParamsRef = useRef<{ executorType: string | null; workspacePath: string | null }>({
    executorType: null,
    workspacePath: null,
  });

  const loadSessions = useCallback(async () => {
    // Skip if no executor type or workspace path
    if (!executorType || !workspacePath) {
      setSessions([]);
      setError(null);
      return;
    }

    // Prevent concurrent requests
    if (isLoadingRef.current) {
      return;
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();

      // Check if gateway is reachable
      const isReachable = await client.ping();
      if (!isReachable) {
        console.log("[useExecutorSessions] Gateway not reachable");
        setSessions([]);
        return;
      }

      // Discover sessions
      const discovered = await client.discoverExecutorSessions(executorType, workspacePath);

      // Sort by updated_at descending (most recent first)
      discovered.sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      setSessions(discovered);
      console.log(
        `[useExecutorSessions] Discovered ${discovered.length} sessions for ${executorType} in ${workspacePath}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useExecutorSessions] Failed to discover sessions:", message);
      setError(message);
      setSessions([]);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [executorType, workspacePath]);

  // Load sessions when params change
  useEffect(() => {
    const paramsChanged =
      lastParamsRef.current.executorType !== executorType ||
      lastParamsRef.current.workspacePath !== workspacePath;

    if (paramsChanged) {
      lastParamsRef.current = { executorType, workspacePath };
      loadSessions();
    }
  }, [executorType, workspacePath, loadSessions]);

  return {
    sessions,
    isLoading,
    error,
    refresh: loadSessions,
  };
}

// ============================================================================
// Hook: useExecutorSessionMessages
// ============================================================================

/**
 * Hook for loading messages from an executor session
 *
 * @param executorType - The executor type (e.g., "claude-code"), or null to skip loading
 * @param sessionId - The session ID, or null to skip loading
 * @param workspacePath - Absolute path to the workspace, or null to skip loading
 * @param limit - Optional limit on number of messages
 * @returns Messages, loading state, error, and refresh function
 *
 * @example
 * ```tsx
 * const { messages, isLoading, error, refresh } = useExecutorSessionMessages(
 *   "claude-code",
 *   "session-123",
 *   "/path/to/workspace"
 * );
 * ```
 */
export function useExecutorSessionMessages(
  executorType: string | null,
  sessionId: string | null,
  workspacePath: string | null,
  limit?: number
): UseExecutorSessionMessagesReturn {
  const [messages, setMessages] = useState<ExecutorUIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track loading state to prevent concurrent requests
  const isLoadingRef = useRef(false);
  // Track last loaded params to detect changes
  const lastParamsRef = useRef<{
    executorType: string | null;
    sessionId: string | null;
    workspacePath: string | null;
  }>({
    executorType: null,
    sessionId: null,
    workspacePath: null,
  });

  const loadMessages = useCallback(async () => {
    // Skip if missing required params
    if (!executorType || !sessionId || !workspacePath) {
      setMessages([]);
      setError(null);
      return;
    }

    // Prevent concurrent requests
    if (isLoadingRef.current) {
      return;
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();

      // Load messages
      const loaded = await client.getExecutorSessionMessages(
        executorType,
        sessionId,
        workspacePath,
        limit
      );

      setMessages(loaded);
      console.log(
        `[useExecutorSessionMessages] Loaded ${loaded.length} messages for session ${sessionId}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useExecutorSessionMessages] Failed to load messages:", message);
      setError(message);
      setMessages([]);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [executorType, sessionId, workspacePath, limit]);

  // Load messages when params change
  useEffect(() => {
    const paramsChanged =
      lastParamsRef.current.executorType !== executorType ||
      lastParamsRef.current.sessionId !== sessionId ||
      lastParamsRef.current.workspacePath !== workspacePath;

    if (paramsChanged) {
      lastParamsRef.current = { executorType, sessionId, workspacePath };
      loadMessages();
    }
  }, [executorType, sessionId, workspacePath, loadMessages]);

  return {
    messages,
    isLoading,
    error,
    refresh: loadMessages,
  };
}
