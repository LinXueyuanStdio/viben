/**
 * MCP Completion State Hook
 *
 * Provides auto-completion functionality for MCP resources and prompts.
 * Supports debouncing, caching, and request cancellation.
 *
 * @see https://spec.modelcontextprotocol.io/specification/server/utilities/completion/
 */
import { useState, useCallback, useEffect, useRef, useMemo } from "react";

// =============================================================================
// Types
// =============================================================================

/** Reference to a resource for completion */
export interface ResourceReference {
  type: "ref/resource";
  uri: string;
}

/** Reference to a prompt for completion */
export interface PromptReference {
  type: "ref/prompt";
  name: string;
}

/** Completion reference (either resource or prompt) */
export type CompletionRef = ResourceReference | PromptReference;

/** State managed by the completion hook */
interface CompletionState {
  /** Completions per argument name */
  completions: Record<string, string[]>;
  /** Loading state per argument name */
  loading: Record<string, boolean>;
  /** Error state per argument name */
  errors: Record<string, string | null>;
}

/** Completion handler function signature */
export type CompletionHandler = (
  ref: CompletionRef,
  argName: string,
  value: string,
  context?: Record<string, string>,
  signal?: AbortSignal
) => Promise<string[]>;

/** Options for the useCompletion hook */
export interface UseCompletionOptions {
  /** Function to make completion requests to MCP server */
  handleCompletion: CompletionHandler;
  /** Whether completions are supported by the server */
  completionsSupported?: boolean;
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
}

/** Return type of the useCompletion hook */
export interface UseCompletionReturn {
  /** Completions per argument name */
  completions: Record<string, string[]>;
  /** Loading state per argument name */
  loading: Record<string, boolean>;
  /** Error state per argument name */
  errors: Record<string, string | null>;
  /** Whether completions are supported */
  completionsSupported: boolean;
  /** Trigger completion request for an argument */
  triggerCompletion: (
    ref: CompletionRef,
    argName: string,
    value: string,
    context?: Record<string, string>
  ) => void;
  /** Clear all completions */
  clearCompletions: () => void;
  /** Clear completions for a specific argument */
  clearCompletion: (argName: string) => void;
}

// =============================================================================
// Debounce Utility
// =============================================================================

/**
 * Create a debounced version of an async function
 */
function debounce<T extends (...args: Parameters<T>) => Promise<void>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      void func(...args);
    }, wait);
  };
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for managing MCP auto-completion state
 *
 * Provides debounced completion requests with request cancellation
 * and caching support.
 *
 * @example
 * ```tsx
 * const { completions, loading, triggerCompletion } = useCompletion({
 *   handleCompletion: async (ref, argName, value, context, signal) => {
 *     const result = await makeRequest("completion/complete", {
 *       ref,
 *       argument: { name: argName, value },
 *       context: context ? { arguments: context } : undefined,
 *     });
 *     return result?.completion?.values || [];
 *   },
 *   completionsSupported: true,
 * });
 *
 * // Trigger completion on input change
 * const handleInputChange = (value: string) => {
 *   triggerCompletion(
 *     { type: "ref/prompt", name: "my-prompt" },
 *     "argName",
 *     value,
 *     otherArgs
 *   );
 * };
 * ```
 */
export function useCompletion({
  handleCompletion,
  completionsSupported = true,
  debounceMs = 300,
}: UseCompletionOptions): UseCompletionReturn {
  const [state, setState] = useState<CompletionState>({
    completions: {},
    loading: {},
    errors: {},
  });

  const [isSupported, setIsSupported] = useState(completionsSupported);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Update supported state when prop changes
  useEffect(() => {
    setIsSupported(completionsSupported);
  }, [completionsSupported]);

  // Cleanup function to abort pending requests
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Clear all completions
  const clearCompletions = useCallback(() => {
    cleanup();
    setState({
      completions: {},
      loading: {},
      errors: {},
    });
  }, [cleanup]);

  // Clear completions for a specific argument
  const clearCompletion = useCallback((argName: string) => {
    setState((prev) => {
      const newCompletions = { ...prev.completions };
      const newLoading = { ...prev.loading };
      const newErrors = { ...prev.errors };
      delete newCompletions[argName];
      delete newLoading[argName];
      delete newErrors[argName];
      return {
        completions: newCompletions,
        loading: newLoading,
        errors: newErrors,
      };
    });
  }, []);

  // Debounced completion request
  const triggerCompletion = useMemo(() => {
    return debounce(
      async (
        ref: CompletionRef,
        argName: string,
        value: string,
        context?: Record<string, string>
      ) => {
        if (!isSupported) {
          return;
        }

        // Cancel any pending request
        cleanup();

        // Create new abort controller
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // Set loading state
        setState((prev) => ({
          ...prev,
          loading: { ...prev.loading, [argName]: true },
          errors: { ...prev.errors, [argName]: null },
        }));

        try {
          // Remove the current argument from context to avoid circular references
          const cleanContext = context ? { ...context } : undefined;
          if (cleanContext) {
            delete cleanContext[argName];
          }

          const values = await handleCompletion(
            ref,
            argName,
            value,
            cleanContext,
            abortController.signal
          );

          // Only update state if request wasn't aborted
          if (!abortController.signal.aborted) {
            setState((prev) => ({
              ...prev,
              completions: { ...prev.completions, [argName]: values },
              loading: { ...prev.loading, [argName]: false },
            }));
          }
        } catch (error) {
          // Don't update state for aborted requests
          if (abortController.signal.aborted) {
            return;
          }

          const errorMessage = error instanceof Error ? error.message : String(error);

          // Check if it's a "method not found" error, which means completions aren't supported
          if (
            errorMessage.includes("Method not found") ||
            errorMessage.includes("MethodNotFound") ||
            errorMessage.includes("-32601")
          ) {
            setIsSupported(false);
            setState((prev) => ({
              ...prev,
              loading: { ...prev.loading, [argName]: false },
            }));
            return;
          }

          console.error("Completion request failed:", error);
          setState((prev) => ({
            ...prev,
            loading: { ...prev.loading, [argName]: false },
            errors: { ...prev.errors, [argName]: errorMessage },
          }));
        } finally {
          // Clean up abort controller reference
          if (abortControllerRef.current === abortController) {
            abortControllerRef.current = null;
          }
        }
      },
      debounceMs
    );
  }, [handleCompletion, isSupported, cleanup, debounceMs]);

  // Clear completions when support changes
  useEffect(() => {
    if (!isSupported) {
      clearCompletions();
    }
  }, [isSupported, clearCompletions]);

  return {
    completions: state.completions,
    loading: state.loading,
    errors: state.errors,
    completionsSupported: isSupported,
    triggerCompletion,
    clearCompletions,
    clearCompletion,
  };
}

// =============================================================================
// Helper: Create Completion Handler from makeRequest
// =============================================================================

/**
 * Create a completion handler from a makeRequest function
 *
 * This helper creates a completion handler that uses the standard
 * MCP completion/complete method.
 *
 * @example
 * ```tsx
 * const handleCompletion = createCompletionHandler(makeRequest);
 * const { completions, triggerCompletion } = useCompletion({ handleCompletion });
 * ```
 */
export function createCompletionHandler(
  makeRequest: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>
): CompletionHandler {
  return async (
    ref: CompletionRef,
    argName: string,
    value: string,
    context?: Record<string, string>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _signal?: AbortSignal
  ): Promise<string[]> => {
    const params: Record<string, unknown> = {
      ref,
      argument: {
        name: argName,
        value,
      },
    };

    if (context && Object.keys(context).length > 0) {
      params.context = {
        arguments: context,
      };
    }

    try {
      const result = await makeRequest<{
        completion?: {
          values?: string[];
          hasMore?: boolean;
          total?: number;
        };
      }>("completion/complete", params);

      return result?.completion?.values || [];
    } catch (error) {
      // Re-throw to let the hook handle the error
      throw error;
    }
  };
}

export default useCompletion;
