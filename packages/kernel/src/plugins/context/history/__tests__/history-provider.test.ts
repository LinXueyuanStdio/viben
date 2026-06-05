import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HistoryProvider } from "../history-provider.js";
import { HistoryStore } from "../history-store.js";
import type { SessionHistory } from "../types.js";
import type { SessionRecord } from "../../../../core/types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeHistory(sessionId: string, turnCount = 3): SessionHistory {
  const turns: SessionHistory["turns"] = [];
  for (let i = 0; i < turnCount * 2; i++) {
    if (i % 2 === 0) {
      turns.push({ index: i, role: "user", timestamp: `2026-01-0${Math.floor(i / 2) + 1}T00:00:00.000Z`, content: `User message ${i / 2 + 1}` });
    } else {
      turns.push({ index: i, role: "assistant", timestamp: `2026-01-0${Math.floor(i / 2) + 1}T00:01:00.000Z`, steps: [{ type: "text", content: `Response ${Math.floor(i / 2) + 1}` }] });
    }
  }
  return { version: 1, sessionId, turns };
}

function makeSessionRecord(sessionId: string, overrides?: Partial<SessionRecord>): SessionRecord {
  return {
    sessionId,
    agentSessionId: `agent-${sessionId}`,
    agentName: "claude",
    workingDir: "/repo",
    channelId: "chan-1",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastActiveAt: "2026-01-01T01:00:00.000Z",
    platform: {},
    ...overrides,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("HistoryProvider", () => {
  let tmpDir: string;
  let store: HistoryStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "history-provider-test-"));
    store = new HistoryStore(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── Basic contract ─────────────────────────────────────────────────────────

  it("has name 'local'", () => {
    const provider = new HistoryProvider(store, () => []);
    expect(provider.name).toBe("local");
  });

  it("isAvailable always returns true", async () => {
    const provider = new HistoryProvider(store, () => []);
    expect(await provider.isAvailable("/any/path")).toBe(true);
  });

  // ─── listSessions ───────────────────────────────────────────────────────────

  describe("listSessions", () => {
    it("returns sessions that have history files", async () => {
      const record = makeSessionRecord("sess-1");
      await store.write(makeHistory("sess-1", 5));

      const provider = new HistoryProvider(store, () => [record]);
      const result = await provider.listSessions({ repoPath: "/repo", type: "session", value: "sess-1" });

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].sessionId).toBe("sess-1");
    });

    it("excludes sessions without history files", async () => {
      const records = [makeSessionRecord("sess-with"), makeSessionRecord("sess-without")];
      await store.write(makeHistory("sess-with", 3));

      const provider = new HistoryProvider(store, () => records);
      const result = await provider.listSessions({ repoPath: "/repo", type: "latest", value: "5" });

      expect(result.sessions.map((s) => s.sessionId)).toEqual(["sess-with"]);
    });

    it("returns estimatedTokens", async () => {
      await store.write(makeHistory("sess-tokens", 4));
      const record = makeSessionRecord("sess-tokens");
      const provider = new HistoryProvider(store, () => [record]);

      const result = await provider.listSessions({ repoPath: "/repo", type: "session", value: "sess-tokens" });
      expect(result.estimatedTokens).toBeGreaterThan(0);
    });

    it("populates SessionInfo fields from session record and history", async () => {
      const record = makeSessionRecord("sess-info", {
        agentName: "gpt-4",
        createdAt: "2026-02-01T00:00:00.000Z",
        lastActiveAt: "2026-02-01T02:00:00.000Z",
        workingDir: "/workspace",
      });
      await store.write(makeHistory("sess-info", 5));

      const provider = new HistoryProvider(store, () => [record]);
      const result = await provider.listSessions({ repoPath: "/repo", type: "session", value: "sess-info" });

      const info = result.sessions[0];
      expect(info.sessionId).toBe("sess-info");
      expect(info.agent).toBe("gpt-4");
      expect(info.createdAt).toBe("2026-02-01T00:00:00.000Z");
      expect(info.turnCount).toBeGreaterThan(0);
    });

    it("returns empty for unsupported query types", async () => {
      const provider = new HistoryProvider(store, () => [makeSessionRecord("sess-1")]);
      await store.write(makeHistory("sess-1", 2));

      for (const type of ["branch", "commit", "pr"] as const) {
        const result = await provider.listSessions({ repoPath: "/repo", type, value: "main" });
        expect(result.sessions).toHaveLength(0);
        expect(result.estimatedTokens).toBe(0);
      }
    });

    it("returns empty result when no sessions have history", async () => {
      const provider = new HistoryProvider(store, () => [makeSessionRecord("no-history")]);
      const result = await provider.listSessions({ repoPath: "/repo", type: "latest", value: "5" });

      expect(result.sessions).toHaveLength(0);
      expect(result.estimatedTokens).toBe(0);
    });
  });

  // ─── buildContext — session query ────────────────────────────────────────────

  describe("buildContext — session type", () => {
    it("returns context for a single session by ID", async () => {
      const record = makeSessionRecord("sess-single");
      await store.write(makeHistory("sess-single", 3));

      const provider = new HistoryProvider(store, () => [record]);
      const result = await provider.buildContext({ repoPath: "/repo", type: "session", value: "sess-single" });

      expect(result.sessionCount).toBe(1);
      expect(result.totalTurns).toBeGreaterThan(0);
      expect(result.markdown).toContain("Conversation History");
      expect(result.tokenEstimate).toBeGreaterThan(0);
      expect(result.truncated).toBe(false);
    });

    it("returns empty result for missing session ID", async () => {
      const provider = new HistoryProvider(store, () => []);
      const result = await provider.buildContext({ repoPath: "/repo", type: "session", value: "nonexistent" });

      expect(result.sessionCount).toBe(0);
      expect(result.totalTurns).toBe(0);
      expect(result.markdown).toBe("");
      expect(result.truncated).toBe(false);
    });

    it("returns empty result for session with no history file", async () => {
      const record = makeSessionRecord("sess-no-file");
      const provider = new HistoryProvider(store, () => [record]);
      const result = await provider.buildContext({ repoPath: "/repo", type: "session", value: "sess-no-file" });

      expect(result.sessionCount).toBe(0);
      expect(result.markdown).toBe("");
    });
  });

  // ─── buildContext — latest query ─────────────────────────────────────────────

  describe("buildContext — latest type", () => {
    it("returns N most recent sessions sorted by lastActiveAt", async () => {
      const records = [
        makeSessionRecord("sess-old", { lastActiveAt: "2026-01-01T01:00:00.000Z" }),
        makeSessionRecord("sess-mid", { lastActiveAt: "2026-01-02T01:00:00.000Z" }),
        makeSessionRecord("sess-new", { lastActiveAt: "2026-01-03T01:00:00.000Z" }),
      ];
      await store.write(makeHistory("sess-old", 2));
      await store.write(makeHistory("sess-mid", 2));
      await store.write(makeHistory("sess-new", 2));

      const provider = new HistoryProvider(store, () => records);
      const result = await provider.buildContext({ repoPath: "/repo", type: "latest", value: "2" });

      expect(result.sessionCount).toBe(2);
      // Markdown should include headers for the two newest sessions
      expect(result.markdown).toContain("sess-new");
      expect(result.markdown).toContain("sess-mid");
      expect(result.markdown).not.toContain("sess-old");
    });

    it("returns all sessions if fewer than limit exist", async () => {
      const records = [makeSessionRecord("s1"), makeSessionRecord("s2")];
      await store.write(makeHistory("s1", 2));
      await store.write(makeHistory("s2", 2));

      const provider = new HistoryProvider(store, () => records);
      const result = await provider.buildContext({ repoPath: "/repo", type: "latest", value: "10" });

      expect(result.sessionCount).toBe(2);
    });

    it("returns correct totalTurns across multiple sessions", async () => {
      const records = [makeSessionRecord("m1"), makeSessionRecord("m2")];
      await store.write(makeHistory("m1", 3)); // 6 turns
      await store.write(makeHistory("m2", 4)); // 8 turns

      const provider = new HistoryProvider(store, () => records);
      const result = await provider.buildContext({ repoPath: "/repo", type: "latest", value: "5" });

      expect(result.totalTurns).toBe(14); // 6 + 8
    });
  });

  // ─── buildContext — unsupported types ────────────────────────────────────────

  describe("buildContext — unsupported query types", () => {
    it("returns empty result for branch query type", async () => {
      const provider = new HistoryProvider(store, () => []);
      const result = await provider.buildContext({ repoPath: "/repo", type: "branch", value: "main" });
      expect(result.sessionCount).toBe(0);
      expect(result.markdown).toBe("");
    });

    it("returns empty result for commit query type", async () => {
      const provider = new HistoryProvider(store, () => []);
      const result = await provider.buildContext({ repoPath: "/repo", type: "commit", value: "abc123" });
      expect(result.sessionCount).toBe(0);
    });

    it("returns empty result for pr query type", async () => {
      const provider = new HistoryProvider(store, () => []);
      const result = await provider.buildContext({ repoPath: "/repo", type: "pr", value: "42" });
      expect(result.sessionCount).toBe(0);
    });

    it("returns empty result for checkpoint query type", async () => {
      const provider = new HistoryProvider(store, () => []);
      const result = await provider.buildContext({ repoPath: "/repo", type: "checkpoint", value: "cp-1" });
      expect(result.sessionCount).toBe(0);
    });
  });

  // ─── buildContext — mode selection ───────────────────────────────────────────

  describe("buildContext — mode selection", () => {
    it("uses full mode for small session (≤10 turns)", async () => {
      const record = makeSessionRecord("sess-full");
      await store.write(makeHistory("sess-full", 4)); // 8 turns total

      const provider = new HistoryProvider(store, () => [record]);
      const result = await provider.buildContext({ repoPath: "/repo", type: "session", value: "sess-full" });

      expect(result.mode).toBe("full");
    });

    it("uses balanced mode for medium session (11–25 turns)", async () => {
      const history = makeHistory("sess-balanced");
      // Build a history with 13 user+assistant turn pairs (26 turns total? No, let's do 6 pairs = 12 turns)
      history.turns = [];
      for (let i = 0; i < 12; i++) {
        if (i % 2 === 0) {
          history.turns.push({ index: i, role: "user", timestamp: `2026-01-01T00:0${i}:00.000Z`, content: `Msg ${i}` });
        } else {
          history.turns.push({ index: i, role: "assistant", timestamp: `2026-01-01T00:0${i}:00.000Z`, steps: [{ type: "text", content: `Resp ${i}` }] });
        }
      }
      await store.write(history);
      const record = makeSessionRecord("sess-balanced");
      const provider = new HistoryProvider(store, () => [record]);
      const result = await provider.buildContext({ repoPath: "/repo", type: "session", value: "sess-balanced" });

      expect(result.mode).toBe("balanced");
    });

    it("uses compact mode for large session (>25 turns)", async () => {
      const history = makeHistory("sess-compact");
      history.turns = [];
      for (let i = 0; i < 52; i++) {
        if (i % 2 === 0) {
          history.turns.push({ index: i, role: "user", timestamp: `2026-01-01T00:00:00.000Z`, content: `Msg ${i}` });
        } else {
          history.turns.push({ index: i, role: "assistant", timestamp: `2026-01-01T00:00:00.000Z`, steps: [{ type: "text", content: `Resp ${i}` }] });
        }
      }
      await store.write(history);
      const record = makeSessionRecord("sess-compact");
      const provider = new HistoryProvider(store, () => [record]);
      const result = await provider.buildContext({ repoPath: "/repo", type: "session", value: "sess-compact" });

      expect(result.mode).toBe("compact");
    });
  });

  // ─── buildContext — token budget ─────────────────────────────────────────────

  describe("buildContext — token budget", () => {
    it("downgrades to compact mode when full mode exceeds maxTokens", async () => {
      // Create a session with small turn count (will select full mode naturally)
      // but set a very low maxTokens to force downgrade
      const history = makeHistory("sess-downgrade");
      history.turns = [];
      for (let i = 0; i < 6; i++) {
        if (i % 2 === 0) {
          history.turns.push({ index: i, role: "user", timestamp: "2026-01-01T00:00:00.000Z", content: `User message with substantial content to increase token count ${i}` });
        } else {
          history.turns.push({ index: i, role: "assistant", timestamp: "2026-01-01T00:00:00.000Z", steps: [{ type: "text", content: `Assistant response with detailed explanation and context ${i}` }] });
        }
      }
      await store.write(history);
      const record = makeSessionRecord("sess-downgrade");
      const provider = new HistoryProvider(store, () => [record]);

      // Use a very low maxTokens to force compact mode
      const result = await provider.buildContext(
        { repoPath: "/repo", type: "session", value: "sess-downgrade" },
        { maxTokens: 1 }
      );

      expect(result.mode).toBe("compact");
    });

    it("truncates oldest sessions when still over budget after compact mode", async () => {
      // Create 3 sessions, oldest first
      const records = [
        makeSessionRecord("t-oldest", { lastActiveAt: "2026-01-01T00:00:00.000Z" }),
        makeSessionRecord("t-middle", { lastActiveAt: "2026-01-02T00:00:00.000Z" }),
        makeSessionRecord("t-newest", { lastActiveAt: "2026-01-03T00:00:00.000Z" }),
      ];
      for (const r of records) {
        await store.write(makeHistory(r.sessionId, 5));
      }

      const provider = new HistoryProvider(store, () => records);

      // Set maxTokens low enough that we can't fit all 3 sessions in compact mode
      // but can fit 1. We use maxTokens=1 to guarantee truncation.
      const result = await provider.buildContext(
        { repoPath: "/repo", type: "latest", value: "3" },
        { maxTokens: 1 }
      );

      // Should be truncated
      expect(result.truncated).toBe(true);
    });

    it("is not truncated when content fits within maxTokens", async () => {
      const record = makeSessionRecord("sess-fits");
      await store.write(makeHistory("sess-fits", 2)); // small history

      const provider = new HistoryProvider(store, () => [record]);
      const result = await provider.buildContext(
        { repoPath: "/repo", type: "session", value: "sess-fits" },
        { maxTokens: 30_000 } // large budget
      );

      expect(result.truncated).toBe(false);
    });
  });

  // ─── buildContext — ContextResult fields ─────────────────────────────────────

  describe("buildContext — result metadata", () => {
    it("includes timeRange with start and end", async () => {
      const record = makeSessionRecord("sess-tr", {
        createdAt: "2026-03-01T00:00:00.000Z",
        lastActiveAt: "2026-03-02T00:00:00.000Z",
      });
      await store.write(makeHistory("sess-tr", 2));

      const provider = new HistoryProvider(store, () => [record]);
      const result = await provider.buildContext({ repoPath: "/repo", type: "session", value: "sess-tr" });

      expect(result.timeRange.start).toBeTruthy();
      expect(result.timeRange.end).toBeTruthy();
    });

    it("includes the disclaimer note in multi-session output", async () => {
      const records = [makeSessionRecord("note-1"), makeSessionRecord("note-2")];
      await store.write(makeHistory("note-1", 2));
      await store.write(makeHistory("note-2", 2));

      const provider = new HistoryProvider(store, () => records);
      const result = await provider.buildContext({ repoPath: "/repo", type: "latest", value: "2" });

      expect(result.markdown).toContain("outdated information");
    });

    it("uses 'latest N sessions' title for latest query type", async () => {
      const records = [makeSessionRecord("title-1"), makeSessionRecord("title-2")];
      await store.write(makeHistory("title-1", 2));
      await store.write(makeHistory("title-2", 2));

      const provider = new HistoryProvider(store, () => records);
      const result = await provider.buildContext({ repoPath: "/repo", type: "latest", value: "2" });

      expect(result.markdown).toContain("latest 2 sessions");
    });

    it("respects limit option from ContextOptions", async () => {
      const records = [
        makeSessionRecord("lim-1", { lastActiveAt: "2026-01-01T00:00:00.000Z" }),
        makeSessionRecord("lim-2", { lastActiveAt: "2026-01-02T00:00:00.000Z" }),
        makeSessionRecord("lim-3", { lastActiveAt: "2026-01-03T00:00:00.000Z" }),
      ];
      for (const r of records) {
        await store.write(makeHistory(r.sessionId, 2));
      }

      const provider = new HistoryProvider(store, () => records);
      const result = await provider.buildContext(
        { repoPath: "/repo", type: "latest", value: "10" },
        { limit: 2 }
      );

      expect(result.sessionCount).toBe(2);
    });
  });
});
