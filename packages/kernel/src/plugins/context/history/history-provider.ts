import type { SessionRecord } from "../../../core/types.js";
import type {
  ContextProvider,
  ContextQuery,
  ContextOptions,
  ContextResult,
  ContextMode,
  SessionInfo,
  SessionListResult,
} from "../context-provider.js";
import { DEFAULT_MAX_TOKENS, TOKENS_PER_TURN_ESTIMATE } from "../context-provider.js";
import { HistoryStore } from "./history-store.js";
import {
  buildHistoryMarkdown,
  selectLevel,
  estimateTokens,
} from "./history-context-builder.js";

const EMPTY_RESULT: ContextResult = {
  markdown: "",
  tokenEstimate: 0,
  sessionCount: 0,
  totalTurns: 0,
  mode: "full",
  truncated: false,
  timeRange: { start: "", end: "" },
};

/**
 * Context provider backed by the local HistoryStore (recorded by HistoryRecorder).
 *
 * Always available (does not require git or external tools).
 * Supports `type: "session"` (exact match) and `type: "latest"` (N most recent).
 * Branch/commit/PR queries are unsupported — the EntireProvider handles those.
 *
 * Context detail is auto-downgraded from "full" → "balanced" → "compact" and
 * oldest sessions are dropped if the result would exceed `maxTokens`.
 */
export class HistoryProvider implements ContextProvider {
  readonly name = "local";

  constructor(
    private readonly store: HistoryStore,
    private readonly getSessionRecords: () => SessionRecord[]
  ) {}

  async isAvailable(_repoPath: string): Promise<boolean> {
    return true;
  }

  async listSessions(query: ContextQuery): Promise<SessionListResult> {
    if (!this.isSupportedType(query.type)) {
      return { sessions: [], estimatedTokens: 0 };
    }

    const candidates = await this.resolveCandidates(query);
    const sessions: SessionInfo[] = [];
    let estimatedTokens = 0;

    for (const record of candidates) {
      const history = await this.store.read(record.sessionId);
      if (!history) continue;
      const turnCount = history.turns.length;
      const tokenEstimate = turnCount * TOKENS_PER_TURN_ESTIMATE;
      sessions.push(this.toSessionInfo(record, turnCount));
      estimatedTokens += tokenEstimate;
    }

    return { sessions, estimatedTokens };
  }

  async buildContext(query: ContextQuery, options?: ContextOptions): Promise<ContextResult> {
    if (!this.isSupportedType(query.type)) {
      return { ...EMPTY_RESULT };
    }

    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    const candidates = await this.resolveCandidates(query, options?.limit);

    // Load histories for sessions that have files
    type LoadedSession = {
      record: SessionRecord;
      history: import("./types.js").SessionHistory;
    };

    const loaded: LoadedSession[] = [];
    for (const record of candidates) {
      const history = await this.store.read(record.sessionId);
      if (history) {
        loaded.push({ record, history });
      }
    }

    if (loaded.length === 0) {
      return { ...EMPTY_RESULT };
    }

    const totalTurns = loaded.reduce((sum, s) => sum + s.history.turns.length, 0);
    const labelAgent = options?.labelAgent ?? false;

    // Auto-select mode based on total turn count
    let mode: ContextMode = selectLevel(totalTurns);

    // Build markdown with selected mode
    let markdown = this.buildMergedMarkdown(loaded, mode, query, labelAgent);
    let tokenEstimate = estimateTokens(markdown);

    // Downgrade to compact if over budget
    if (tokenEstimate > maxTokens && mode !== "compact") {
      mode = "compact";
      markdown = this.buildMergedMarkdown(loaded, mode, query, labelAgent);
      tokenEstimate = estimateTokens(markdown);
    }

    // Truncate oldest sessions if still over budget
    let truncated = false;
    let activeSessions = [...loaded];
    while (tokenEstimate > maxTokens && activeSessions.length > 1) {
      // Remove the oldest session (last in list, sorted newest-first)
      activeSessions = activeSessions.slice(0, activeSessions.length - 1);
      markdown = this.buildMergedMarkdown(activeSessions, mode, query, labelAgent);
      tokenEstimate = estimateTokens(markdown);
      truncated = true;
    }

    const timeRange = this.computeTimeRange(activeSessions.map((s) => s.record));

    return {
      markdown,
      tokenEstimate,
      sessionCount: activeSessions.length,
      totalTurns: activeSessions.reduce((sum, s) => sum + s.history.turns.length, 0),
      mode,
      truncated,
      timeRange,
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private isSupportedType(type: ContextQuery["type"]): boolean {
    return type === "session" || type === "latest";
  }

  private async resolveCandidates(query: ContextQuery, limit?: number): Promise<SessionRecord[]> {
    const all = this.getSessionRecords();

    if (query.type === "session") {
      const found = all.find((r) => r.sessionId === query.value);
      return found ? [found] : [];
    }

    // latest: sort by lastActiveAt descending, take N
    const n = limit ?? (parseInt(query.value, 10) || 5);
    const sorted = [...all].sort(
      (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );
    return sorted.slice(0, n);
  }

  private toSessionInfo(record: SessionRecord, turnCount: number): SessionInfo {
    return {
      checkpointId: "",
      sessionIndex: "",
      transcriptPath: "",
      createdAt: record.createdAt,
      endedAt: record.lastActiveAt,
      branch: "",
      agent: record.agentName,
      turnCount,
      filesTouched: [],
      sessionId: record.sessionId,
    };
  }

  private buildMergedMarkdown(
    sessions: Array<{ record: SessionRecord; history: import("./types.js").SessionHistory }>,
    mode: ContextMode,
    query: ContextQuery,
    labelAgent = false
  ): string {
    if (sessions.length === 0) return "";

    const totalTurns = sessions.reduce((sum, s) => sum + s.history.turns.length, 0);
    const title = query.type === "session" ? query.value : `latest ${sessions.length} sessions`;

    const parts: string[] = [];
    parts.push(`# Conversation History — ${title}`);
    parts.push(`${sessions.length} sessions | ${totalTurns} turns | mode: ${mode}`);
    parts.push("");

    for (let i = 0; i < sessions.length; i++) {
      const { record, history } = sessions[i];

      parts.push(`## Session ${i + 1} — ${record.agentName} · ${record.sessionId} (${history.turns.length} turns)`);
      parts.push("");

      if (labelAgent && history.turns.length > 0) {
        const agentTimeline = this.buildAgentTimeline(record);
        const labeledMd = this.buildLabeledHistoryMarkdown(history.turns, mode, agentTimeline);
        if (labeledMd) {
          parts.push(labeledMd);
        }
      } else {
        const sessionMd = buildHistoryMarkdown(history.turns, mode);
        if (sessionMd) {
          parts.push(sessionMd);
        }
      }
    }

    parts.push(
      "> **Note:** This conversation history may contain outdated information. Verify current state before acting on past context."
    );

    return parts.join("\n");
  }

  /**
   * Build a timeline of agent boundaries from the session record.
   * Returns sorted entries: [{ agentName, startedAt }] where startedAt is the
   * ISO timestamp when that agent started handling the session.
   *
   * The first agent runs from session creation until the first switch.
   * Each agentSwitchHistory entry records when the *previous* agent was switched away,
   * so the next agent starts at that switchedAt timestamp.
   */
  private buildAgentTimeline(record: SessionRecord): Array<{ agentName: string; switchedAt: number }> {
    const timeline: Array<{ agentName: string; switchedAt: number }> = [];

    // The first agent starts at the beginning of time (0)
    const firstAgentName = record.firstAgent ?? record.agentName;
    timeline.push({ agentName: firstAgentName, switchedAt: 0 });

    if (record.agentSwitchHistory && record.agentSwitchHistory.length > 0) {
      // Each entry in agentSwitchHistory records a *completed* agent stint:
      // { agentName: "claude", switchedAt: "...", ... } means claude was active
      // and was switched away at switchedAt. The next agent in sequence starts at that time.
      //
      // To reconstruct: after the last switchHistory entry, the current record.agentName is active.
      // But we need to map turns to agents, so we build boundaries.

      for (let i = 0; i < record.agentSwitchHistory.length; i++) {
        const entry = record.agentSwitchHistory[i];
        const switchTime = new Date(entry.switchedAt).getTime();

        // Determine which agent comes after this switch
        const nextAgent = i < record.agentSwitchHistory.length - 1
          ? record.agentSwitchHistory[i + 1].agentName
          : record.agentName; // current agent is the last one

        timeline.push({ agentName: nextAgent, switchedAt: switchTime });
      }
    }

    return timeline;
  }

  /**
   * Determine which agent produced a turn based on its timestamp and the agent timeline.
   */
  private resolveAgentForTurn(
    turnTimestamp: string,
    timeline: Array<{ agentName: string; switchedAt: number }>
  ): string {
    const turnTime = new Date(turnTimestamp).getTime();

    // Walk backward through the timeline to find the last boundary before this turn
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (turnTime >= timeline[i].switchedAt) {
        return timeline[i].agentName;
      }
    }

    // Fallback to first agent
    return timeline[0].agentName;
  }

  /**
   * Build history markdown with agent labels inserted at agent boundaries.
   */
  private buildLabeledHistoryMarkdown(
    turns: import("./types.js").Turn[],
    mode: ContextMode,
    agentTimeline: Array<{ agentName: string; switchedAt: number }>
  ): string {
    // If there's only one agent (no switches), just add a single label
    if (agentTimeline.length <= 1) {
      const label = `### [${agentTimeline[0]?.agentName ?? "unknown"}]\n`;
      const md = buildHistoryMarkdown(turns, mode);
      return md ? label + "\n" + md : label;
    }

    // Group turns by agent segments, then render each segment with a label
    const segments: Array<{ agentName: string; turns: import("./types.js").Turn[] }> = [];
    let currentAgent = "";

    for (const turn of turns) {
      const agent = this.resolveAgentForTurn(turn.timestamp, agentTimeline);
      if (agent !== currentAgent) {
        segments.push({ agentName: agent, turns: [] });
        currentAgent = agent;
      }
      segments[segments.length - 1].turns.push(turn);
    }

    const parts: string[] = [];
    for (const segment of segments) {
      parts.push(`### [${segment.agentName}]`);
      parts.push("");
      const md = buildHistoryMarkdown(segment.turns, mode);
      if (md) {
        parts.push(md);
      }
    }

    return parts.join("\n");
  }

  private computeTimeRange(
    records: SessionRecord[]
  ): { start: string; end: string } {
    if (records.length === 0) return { start: "", end: "" };

    const dates = records.map((r) => r.createdAt).filter(Boolean);
    const ends = records.map((r) => r.lastActiveAt).filter(Boolean);

    const start = dates.sort()[0] ?? "";
    const end = ends.sort().reverse()[0] ?? "";

    return { start, end };
  }
}
