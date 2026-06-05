import { execFileSync } from "child_process";
import type { SessionInfo } from "../context-provider.js";

// ─── Internal types ────────────────────────────────────────────────────────────

interface CheckpointMeta {
  checkpoint_id?: string;
  branch?: string;
  files_touched?: string[];
  sessions: Array<{
    metadata: string;
    transcript: string;
  }>;
}

interface SessionMeta {
  session_id?: string;
  created_at?: string;
  branch?: string;
  agent?: string;
  files_touched?: string[];
  session_metrics?: {
    turn_count?: number;
  };
}

// ─── CheckpointReader ─────────────────────────────────────────────────────────

// The Entire Claude Code extension pushes session data to this branch.
// All git show / ls-tree commands read from this remote branch so we never
// need to check it out locally.
const ENTIRE_BRANCH = "origin/entire/checkpoints/v1";
const CHECKPOINT_ID_RE = /^[0-9a-f]{12}$/;
const SESSION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Reads Claude Code session data from the `origin/entire/checkpoints/v1` git branch.
 *
 * The branch layout is:
 *   `<shard[0:2]>/<shard[2:12]>/metadata.json` — checkpoint-level metadata
 *   `<shard[0:2]>/<shard[2:12]>/<session-idx>/metadata.json` — per-session metadata
 *   `<shard[0:2]>/<shard[2:12]>/<session-idx>/transcript.jsonl` — raw JSONL conversation
 *
 * All git operations use `execFileSync` so errors are caught and returned as
 * empty strings rather than throwing — callers get null/[] on missing data.
 */
export class CheckpointReader {
  constructor(private readonly repoPath: string) {}

  // ─── Git execution ───────────────────────────────────────────────────────────

  /**
   * Run a git command in the repo directory.
   * Returns trimmed stdout on success, empty string on failure.
   */
  private git(...args: string[]): string {
    try {
      return execFileSync("git", ["-C", this.repoPath, ...args], {
        encoding: "utf-8",
      }).trim();
    } catch {
      return "";
    }
  }

  // ─── Static helpers ──────────────────────────────────────────────────────────

  /**
   * Convert a 12-char checkpoint ID to its shard path: "f634acf05138" → "f6/34acf05138"
   */
  static shardPath(cpId: string): string {
    return `${cpId.slice(0, 2)}/${cpId.slice(2)}`;
  }

  /**
   * Returns true when value looks like a 12-char lowercase hex checkpoint ID.
   */
  static isCheckpointId(value: string): boolean {
    return CHECKPOINT_ID_RE.test(value);
  }

  /**
   * Returns true when value looks like a UUID (session ID).
   */
  static isSessionId(value: string): boolean {
    return SESSION_ID_RE.test(value);
  }

  /**
   * Parse checkpoint-level metadata JSON. Returns null on error.
   */
  static parseCheckpointMeta(json: string): CheckpointMeta | null {
    try {
      const parsed = JSON.parse(json) as CheckpointMeta;
      if (!parsed || typeof parsed !== "object") return null;
      if (!Array.isArray(parsed.sessions)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Extract Entire-Checkpoint trailer IDs from `git log --format="%H|%(trailers:...)"` output.
   * Each line is: `<hash>|<trailer_value_or_empty>`. Returns only non-empty trailer values.
   * Uses the last pipe on each line to locate the trailer value, to be robust against
   * subject lines that contain pipes.
   */
  static parseCheckpointTrailers(output: string): string[] {
    const ids: string[] = [];
    for (const line of output.split("\n")) {
      const pipe = line.lastIndexOf("|");
      if (pipe === -1) continue;
      const trailerId = line.slice(pipe + 1).trim();
      if (trailerId) ids.push(trailerId);
    }
    return ids;
  }

  // ─── Branch check ────────────────────────────────────────────────────────────

  async hasEntireBranch(): Promise<boolean> {
    const out = this.git("branch", "-r");
    return out.includes("entire/checkpoints/v1");
  }

  // ─── Core session fetching ───────────────────────────────────────────────────

  private listAllCheckpointIds(): string[] {
    const out = this.git(
      "ls-tree",
      "-r",
      ENTIRE_BRANCH,
      "--name-only"
    );
    if (!out) return [];

    const ids = new Set<string>();
    for (const file of out.split("\n")) {
      const parts = file.split("/");
      // Checkpoint-level metadata lives at depth 3: XX/YYYYYYYYYY/metadata.json
      // Session-level files are deeper — skip them here.
      if (parts.length === 3 && parts[2] === "metadata.json") {
        ids.add(parts[0] + parts[1]);
      }
    }
    return [...ids];
  }

  private fetchCheckpointMeta(cpId: string): CheckpointMeta | null {
    const shard = CheckpointReader.shardPath(cpId);
    const raw = this.git("show", `${ENTIRE_BRANCH}:${shard}/metadata.json`);
    if (!raw) return null;
    return CheckpointReader.parseCheckpointMeta(raw);
  }

  private fetchSessionMeta(metaPath: string): SessionMeta {
    const normalized = metaPath.startsWith("/") ? metaPath.slice(1) : metaPath;
    const raw = this.git("show", `${ENTIRE_BRANCH}:${normalized}`);
    if (!raw) return {};
    try {
      return JSON.parse(raw) as SessionMeta;
    } catch {
      return {};
    }
  }

  /**
   * Build SessionInfo[] from a single checkpoint's metadata.
   */
  private buildSessionsForCheckpoint(
    cpId: string,
    cpMeta: CheckpointMeta
  ): SessionInfo[] {
    const sessions: SessionInfo[] = [];

    for (let idx = 0; idx < cpMeta.sessions.length; idx++) {
      const sess = cpMeta.sessions[idx];
      const transcriptPath = (sess.transcript ?? "").replace(/^\//, "");
      const metaPath = sess.metadata ?? "";

      const smeta = this.fetchSessionMeta(metaPath);
      const createdAt = smeta.created_at ?? "";

      sessions.push({
        checkpointId: cpId,
        sessionIndex: String(idx),
        transcriptPath,
        createdAt,
        // endedAt isn't stored in the checkpoint metadata; EntireProvider fills
        // it from the last turn timestamp when parsing the JSONL transcript.
        endedAt: createdAt,
        branch: smeta.branch ?? cpMeta.branch ?? "",
        agent: smeta.agent ?? "",
        turnCount: smeta.session_metrics?.turn_count ?? 0,
        filesTouched: smeta.files_touched ?? cpMeta.files_touched ?? [],
        sessionId: smeta.session_id ?? "",
      });
    }

    return sessions;
  }

  private getSessionsForCheckpoint(cpId: string): SessionInfo[] {
    const meta = this.fetchCheckpointMeta(cpId);
    if (!meta) return [];
    return this.buildSessionsForCheckpoint(cpId, meta);
  }

  // ─── Public resolvers ────────────────────────────────────────────────────────

  /**
   * All sessions recorded on a given branch, sorted by createdAt ascending.
   */
  async resolveByBranch(branchName: string): Promise<SessionInfo[]> {
    const cpIds = this.listAllCheckpointIds();
    const sessions: SessionInfo[] = [];

    for (const cpId of cpIds) {
      const meta = this.fetchCheckpointMeta(cpId);
      if (!meta) continue;
      if (meta.branch !== branchName) continue;
      sessions.push(...this.buildSessionsForCheckpoint(cpId, meta));
    }

    sessions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return sessions;
  }

  /**
   * Sessions linked to a specific commit via the Entire-Checkpoint git trailer.
   */
  async resolveByCommit(commitHash: string): Promise<SessionInfo[]> {
    const fullHash = this.git("rev-parse", commitHash);
    if (!fullHash) return [];

    const cpId = this.git(
      "log",
      "-1",
      "--format=%(trailers:key=Entire-Checkpoint,valueonly)",
      fullHash
    );
    if (!cpId) return [];

    return this.getSessionsForCheckpoint(cpId.trim());
  }

  /**
   * All sessions from a merged PR (by number or GitHub URL).
   */
  async resolveByPr(prInput: string): Promise<SessionInfo[]> {
    let prNumber: string;

    if (/^\d+$/.test(prInput)) {
      prNumber = prInput;
    } else {
      const m = /\/pull\/(\d+)/.exec(prInput);
      if (!m) return [];
      prNumber = m[1];
    }

    const mergeOut = this.git(
      "log",
      "--all",
      "--oneline",
      "--grep",
      `Merge pull request #${prNumber}`
    );
    if (!mergeOut) return [];

    const mergeCommit = mergeOut.split("\n")[0].split(" ")[0];

    const logOut = this.git(
      "log",
      "--format=%H|%(trailers:key=Entire-Checkpoint,valueonly)",
      `${mergeCommit}^2`,
      "--not",
      `${mergeCommit}^1`
    );
    if (!logOut) return [];

    const cpIds = CheckpointReader.parseCheckpointTrailers(logOut);
    const sessions: SessionInfo[] = [];

    for (const cpId of cpIds) {
      sessions.push(...this.getSessionsForCheckpoint(cpId));
    }

    sessions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return sessions;
  }

  /**
   * Sessions matching a specific checkpoint ID.
   */
  async resolveByCheckpoint(checkpointId: string): Promise<SessionInfo[]> {
    return this.getSessionsForCheckpoint(checkpointId);
  }

  /**
   * Find a session by its UUID.
   */
  async resolveBySessionId(sessionId: string): Promise<SessionInfo[]> {
    const cpIds = this.listAllCheckpointIds();

    for (const cpId of cpIds) {
      const sessions = this.getSessionsForCheckpoint(cpId);
      const match = sessions.find((s) => s.sessionId === sessionId);
      if (match) return [match];
    }

    return [];
  }

  /**
   * Latest N sessions across all checkpoints, sorted by createdAt descending.
   */
  async resolveLatest(count: number): Promise<SessionInfo[]> {
    const cpIds = this.listAllCheckpointIds();
    const all: SessionInfo[] = [];

    for (const cpId of cpIds) {
      all.push(...this.getSessionsForCheckpoint(cpId));
    }

    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return all.slice(0, count);
  }

  /**
   * Read the full JSONL transcript content from the entire branch.
   */
  getTranscript(transcriptPath: string): string {
    const normalized = transcriptPath.startsWith("/")
      ? transcriptPath.slice(1)
      : transcriptPath;
    return this.git("show", `${ENTIRE_BRANCH}:${normalized}`);
  }
}
