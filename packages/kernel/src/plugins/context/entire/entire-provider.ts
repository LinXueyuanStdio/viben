import type { ContextProvider, ContextQuery, ContextOptions, ContextResult, SessionListResult, SessionInfo } from "../context-provider.js";
import type { ContextMode } from "../context-provider.js";
import { DEFAULT_MAX_TOKENS, TOKENS_PER_TURN_ESTIMATE } from "../context-provider.js";
import { CheckpointReader } from "./checkpoint-reader.js";
import { parseJsonlToTurns, buildSessionMarkdown, mergeSessionsMarkdown, selectMode, estimateTokens, type SessionMarkdownInput } from "./conversation-builder.js";

/**
 * Context provider backed by Claude Code checkpoint data stored in the git repo.
 *
 * Only available when the repo has an `origin/entire/checkpoints/v1` branch,
 * which is pushed by the Entire Claude Code extension. Supports all query types
 * (branch, commit, PR, session, latest) by reading checkpoint metadata and
 * reconstructing conversation turns from JSONL transcripts.
 *
 * Used as a lower-priority fallback after HistoryProvider: the live history
 * recorder takes precedence for sessions still in memory, while this provider
 * covers older sessions or cross-branch queries.
 */
export class EntireProvider implements ContextProvider {
  readonly name = "entire";

  async isAvailable(repoPath: string): Promise<boolean> {
    return new CheckpointReader(repoPath).hasEntireBranch();
  }

  async listSessions(query: ContextQuery): Promise<SessionListResult> {
    const reader = new CheckpointReader(query.repoPath);
    const sessions = await this.resolveSessions(reader, query);
    const estimatedTokens = sessions.reduce((sum, s) => sum + s.turnCount * TOKENS_PER_TURN_ESTIMATE, 0);
    return { sessions, estimatedTokens };
  }

  async buildContext(query: ContextQuery, options?: ContextOptions): Promise<ContextResult> {
    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    const reader = new CheckpointReader(query.repoPath);
    let sessions = await this.resolveSessions(reader, query);

    if (options?.limit && sessions.length > options.limit) {
      sessions = sessions.slice(-options.limit);
    }

    if (sessions.length === 0) {
      return { markdown: "", tokenEstimate: 0, sessionCount: 0, totalTurns: 0, mode: "full", truncated: false, timeRange: { start: "", end: "" } };
    }

    // Parse all transcripts upfront so we know total turns before selecting mode.
    // We may need to re-render with a different mode, so we keep the raw JSONL.
    const parsedSessions: { session: SessionInfo; jsonl: string; }[] = [];
    for (const sess of sessions) {
      const jsonl = reader.getTranscript(sess.transcriptPath);
      if (jsonl) parsedSessions.push({ session: sess, jsonl });
    }

    if (parsedSessions.length === 0) {
      return { markdown: "", tokenEstimate: 0, sessionCount: 0, totalTurns: 0, mode: "full", truncated: false, timeRange: { start: "", end: "" } };
    }

    const totalTurns = parsedSessions.reduce((sum, ps) => {
      const parsed = parseJsonlToTurns(ps.jsonl);
      return sum + parsed.turns.length;
    }, 0);

    let mode = selectMode(totalTurns);
    const title = this.buildTitle(query);

    // Build markdown for each session
    let sessionMarkdowns = this.buildSessionMarkdowns(parsedSessions, mode);
    let merged = mergeSessionsMarkdown(sessionMarkdowns, mode, title);
    let tokens = estimateTokens(merged);

    // Auto-downgrade to compact if over budget
    if (tokens > maxTokens && mode !== "compact") {
      mode = "compact";
      sessionMarkdowns = this.buildSessionMarkdowns(parsedSessions, "compact");
      merged = mergeSessionsMarkdown(sessionMarkdowns, "compact", title);
      tokens = estimateTokens(merged);
    }

    // Truncate oldest sessions if still over budget
    let truncated = false;
    while (tokens > maxTokens && sessionMarkdowns.length > 1) {
      sessionMarkdowns = sessionMarkdowns.slice(1);
      truncated = true;
      merged = mergeSessionsMarkdown(sessionMarkdowns, mode, title);
      tokens = estimateTokens(merged);
    }

    const allTimes = sessionMarkdowns.flatMap(s => [s.startTime, s.endTime]).filter(Boolean).sort();
    const finalTurns = sessionMarkdowns.reduce((sum, s) => sum + s.turns, 0);

    return {
      markdown: merged,
      tokenEstimate: tokens,
      sessionCount: sessionMarkdowns.length,
      totalTurns: finalTurns,
      mode,
      truncated,
      timeRange: { start: allTimes[0] ?? "", end: allTimes[allTimes.length - 1] ?? "" },
    };
  }

  private buildSessionMarkdowns(parsedSessions: { session: SessionInfo; jsonl: string }[], mode: ContextMode): SessionMarkdownInput[] {
    return parsedSessions.map(ps => {
      const parsed = parseJsonlToTurns(ps.jsonl);
      return {
        markdown: buildSessionMarkdown(parsed.turns, mode),
        startTime: parsed.firstTimestamp,
        endTime: parsed.lastTimestamp,
        agent: ps.session.agent,
        turns: parsed.turns.length,
        branch: ps.session.branch,
        files: ps.session.filesTouched.map(f => f.split("/").pop() ?? f),
      };
    });
  }

  private async resolveSessions(reader: CheckpointReader, query: ContextQuery): Promise<SessionInfo[]> {
    switch (query.type) {
      case "branch": return reader.resolveByBranch(query.value);
      case "commit": return reader.resolveByCommit(query.value);
      case "pr": return reader.resolveByPr(query.value);
      case "checkpoint": return reader.resolveByCheckpoint(query.value);
      case "session": return reader.resolveBySessionId(query.value);
      case "latest": return reader.resolveLatest(parseInt(query.value) || 5);
      default: return [];
    }
  }

  private buildTitle(query: ContextQuery): string {
    switch (query.type) {
      case "pr": return `PR #${query.value.replace(/.*\/pull\//, "")}`;
      case "branch": return `branch \`${query.value}\``;
      case "commit": return `commit \`${query.value.slice(0, 8)}\``;
      case "checkpoint": return `checkpoint \`${query.value}\``;
      case "session": return `session \`${query.value.slice(0, 8)}...\``;
      case "latest": return `latest ${query.value} sessions`;
      default: return "unknown";
    }
  }
}
