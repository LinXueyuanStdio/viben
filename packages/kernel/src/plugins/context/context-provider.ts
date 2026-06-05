// NOTE: This interface is designed around Entire as the first provider.
// It may evolve when additional providers (Cursor history, Zed, etc.) are added.
// Providers may only support a subset of query types and should return empty results
// for unsupported types rather than throwing.

/**
 * Abstract interface for conversation context sources.
 *
 * Two providers are built-in: "local" (history recorder) and "entire" (Claude Code checkpoints).
 * ContextManager iterates providers in priority order and returns the first non-empty result.
 */
export interface ContextProvider {
  readonly name: string;
  isAvailable(repoPath: string): Promise<boolean>;
  listSessions(query: ContextQuery): Promise<SessionListResult>;
  buildContext(query: ContextQuery, options?: ContextOptions): Promise<ContextResult>;
}

/**
 * Describes which sessions to include in a context build.
 *
 * - `type: "latest"` with `value: "5"` returns the 5 most recent sessions.
 * - `type: "session"` with a UUID returns exactly that session.
 * - `type: "branch"` / `"commit"` / `"pr"` are only supported by the "entire" provider
 *   which reads Claude Code checkpoints stored in the git repo.
 */
export interface ContextQuery {
  repoPath: string;
  type: "branch" | "commit" | "pr" | "latest" | "checkpoint" | "session";
  value: string;
}

export interface ContextOptions {
  maxTokens?: number;
  limit?: number;
  /** When true, insert `## [agentName]` headers at agent boundaries in merged history */
  labelAgent?: boolean;
  /** When true, skip the context cache (use for live switches where history just changed) */
  noCache?: boolean;
}

/**
 * Metadata for a single recorded session, used when listing available context.
 * Fields like `checkpointId` and `transcriptPath` are populated by the "entire" provider;
 * the "local" provider leaves them empty since it stores sessions in its own HistoryStore.
 */
export interface SessionInfo {
  checkpointId: string;
  sessionIndex: string;
  transcriptPath: string;
  createdAt: string;
  endedAt: string;
  branch: string;
  agent: string;
  turnCount: number;
  filesTouched: string[];
  sessionId: string;
}

export interface SessionListResult {
  sessions: SessionInfo[];
  estimatedTokens: number;
}

/**
 * Controls how much detail is rendered per turn in the context markdown.
 * - `full`: full diffs, tool call outputs, thinking blocks, usage stats
 * - `balanced`: diffs truncated, thinking omitted
 * - `compact`: single-line summary per turn pair (user + tools used)
 */
export type ContextMode = "full" | "balanced" | "compact";

/**
 * The built context block to be prepended to an agent prompt.
 * `markdown` is the formatted text; `truncated` is true when oldest sessions
 * were dropped to fit within `maxTokens`.
 */
export interface ContextResult {
  markdown: string;
  tokenEstimate: number;
  sessionCount: number;
  totalTurns: number;
  mode: ContextMode;
  truncated: boolean;
  timeRange: { start: string; end: string };
}

export const DEFAULT_MAX_TOKENS = 30_000;
export const TOKENS_PER_TURN_ESTIMATE = 400;
