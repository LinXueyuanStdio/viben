import type { ContextProvider, ContextQuery, ContextOptions, ContextResult, SessionListResult } from "./context-provider.js";
import type { HistoryStore } from "./history/history-store.js";
import type { SessionHistory } from "./history/types.js";
import { ContextCache } from "./context-cache.js";

/**
 * Orchestrates context providers and caching.
 *
 * Providers are tried in registration order — the first one that is available
 * and returns non-empty markdown wins. This lets the "local" history provider
 * take priority over the "entire" checkpoint provider for sessions that are
 * still in progress (not yet checkpointed).
 *
 * The context service is registered under the `"context"` key in the
 * ServiceRegistry so other plugins (e.g. the git-pilot plugin) can call
 * `buildContext()` before injecting context into a new agent.
 */
export class ContextManager {
  private providers: ContextProvider[] = [];
  private cache: ContextCache;
  private historyStore?: HistoryStore;
  private sessionFlusher?: (sessionId: string) => Promise<void>;

  constructor(cachePath: string) {
    this.cache = new ContextCache(cachePath);
  }

  /**
   * Wire in the history store after construction.
   *
   * Injected separately because the history store (backed by the context plugin's
   * recorder) may not be ready when ContextManager is first instantiated.
   */
  setHistoryStore(store: HistoryStore): void {
    this.historyStore = store;
  }

  /** Register a callback that flushes in-memory recorder state for a session to disk. */
  registerFlusher(fn: (sessionId: string) => Promise<void>): void {
    this.sessionFlusher = fn;
  }

  /**
   * Flush the recorder state for a session to disk before reading its context.
   * Call this before buildContext() when switching agents to avoid a race
   * where the last turn hasn't been persisted yet.
   */
  async flushSession(sessionId: string): Promise<void> {
    if (this.sessionFlusher) await this.sessionFlusher(sessionId);
  }

  /**
   * Read the raw history for a session directly from the history store.
   *
   * Returns null if no historyStore has been configured via `setHistoryStore()`,
   * or if the session has no recorded history.
   */
  async getHistory(sessionId: string): Promise<SessionHistory | null> {
    if (!this.historyStore) return null;
    return this.historyStore.read(sessionId);
  }

  /**
   * Register a provider. Providers are queried in insertion order.
   * Register higher-priority sources (e.g. local history) before lower-priority ones (e.g. entire).
   */
  register(provider: ContextProvider): void {
    this.providers.push(provider);
  }

  /**
   * Return the first provider that reports itself available for the given repo.
   *
   * This is a availability check — it returns the highest-priority available provider
   * (i.e. the first registered one that passes `isAvailable`), not necessarily the
   * one that would yield the richest context for a specific query.
   */
  async getProvider(repoPath: string): Promise<ContextProvider | null> {
    for (const provider of this.providers) {
      if (await provider.isAvailable(repoPath)) return provider;
    }
    return null;
  }

  /**
   * List sessions using the same provider-waterfall logic as `buildContext`.
   *
   * Tries each registered provider in order, returning the first non-empty result.
   * Unlike `buildContext`, results are not cached — callers should avoid calling
   * this in hot paths.
   */
  async listSessions(query: ContextQuery): Promise<SessionListResult | null> {
    for (const provider of this.providers) {
      if (!(await provider.isAvailable(query.repoPath))) continue;
      const result = await provider.listSessions(query);
      if (result.sessions.length > 0) return result;
    }
    return null;
  }

  /**
   * Build a context block for injection into an agent prompt.
   *
   * Tries each registered provider in order. Results are cached by (repoPath + queryKey)
   * to avoid redundant disk reads. Pass `options.noCache = true` when the caller knows
   * the history just changed (e.g. immediately after an agent switch + flush).
   */
  async buildContext(query: ContextQuery, options?: ContextOptions): Promise<ContextResult | null> {
    const queryKey = `${query.type}:${query.value}:${options?.limit ?? ""}:${options?.maxTokens ?? ""}:${options?.labelAgent ?? ""}`;

    if (!options?.noCache) {
      const cached = this.cache.get(query.repoPath, queryKey);
      if (cached) return cached;
    }

    for (const provider of this.providers) {
      if (!(await provider.isAvailable(query.repoPath))) continue;
      const result = await provider.buildContext(query, options);
      if (result && result.markdown) {
        if (!options?.noCache) {
          this.cache.set(query.repoPath, queryKey, result);
        }
        return result;
      }
    }
    return null;
  }
}
