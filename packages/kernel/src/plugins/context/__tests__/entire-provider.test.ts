import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { SessionInfo } from "../context-provider.js";

// Mock CheckpointReader before importing EntireProvider
vi.mock("../entire/checkpoint-reader.js", () => {
  return {
    CheckpointReader: vi.fn(),
  };
});

// Mock conversation-builder
vi.mock("../entire/conversation-builder.js", () => {
  return {
    parseJsonlToTurns: vi.fn(),
    buildSessionMarkdown: vi.fn(),
    mergeSessionsMarkdown: vi.fn(),
    selectMode: vi.fn(),
    estimateTokens: vi.fn(),
  };
});

import { EntireProvider } from "../entire/entire-provider.js";
import { CheckpointReader } from "../entire/checkpoint-reader.js";
import {
  parseJsonlToTurns,
  buildSessionMarkdown,
  mergeSessionsMarkdown,
  selectMode,
  estimateTokens,
} from "../entire/conversation-builder.js";

const MockCheckpointReader = vi.mocked(CheckpointReader);
const mockParseJsonlToTurns = vi.mocked(parseJsonlToTurns);
const mockBuildSessionMarkdown = vi.mocked(buildSessionMarkdown);
const mockMergeSessionsMarkdown = vi.mocked(mergeSessionsMarkdown);
const mockSelectMode = vi.mocked(selectMode);
const mockEstimateTokens = vi.mocked(estimateTokens);

function makeSession(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    checkpointId: "abc123def456",
    sessionIndex: "0",
    transcriptPath: "ab/c123def456/sessions/0/transcript.jsonl",
    createdAt: "2024-01-01T10:00:00Z",
    endedAt: "2024-01-01T11:00:00Z",
    branch: "main",
    agent: "claude",
    turnCount: 5,
    filesTouched: ["src/foo.ts", "src/bar.ts"],
    sessionId: "11111111-1111-1111-1111-111111111111",
    ...overrides,
  };
}

interface ReaderMock {
  hasEntireBranch: Mock;
  resolveByBranch: Mock;
  resolveByCommit: Mock;
  resolveByPr: Mock;
  resolveByCheckpoint: Mock;
  resolveBySessionId: Mock;
  resolveLatest: Mock;
  getTranscript: Mock;
}

function makeReaderMock(overrides: Partial<ReaderMock> = {}): ReaderMock {
  return {
    hasEntireBranch: vi.fn().mockResolvedValue(true),
    resolveByBranch: vi.fn().mockResolvedValue([]),
    resolveByCommit: vi.fn().mockResolvedValue([]),
    resolveByPr: vi.fn().mockResolvedValue([]),
    resolveByCheckpoint: vi.fn().mockResolvedValue([]),
    resolveBySessionId: vi.fn().mockResolvedValue([]),
    resolveLatest: vi.fn().mockResolvedValue([]),
    getTranscript: vi.fn().mockReturnValue(""),
    ...overrides,
  };
}

describe("EntireProvider", () => {
  let provider: EntireProvider;
  let readerInstance: ReaderMock;

  beforeEach(() => {
    vi.clearAllMocks();
    readerInstance = makeReaderMock();
    // Use a proper constructor function (not arrow) so `new` works
    MockCheckpointReader.mockImplementation(function () {
      return readerInstance;
    } as unknown as typeof CheckpointReader);
    provider = new EntireProvider();
  });

  it("has name 'entire'", () => {
    expect(provider.name).toBe("entire");
  });

  describe("isAvailable", () => {
    it("delegates to CheckpointReader.hasEntireBranch (true)", async () => {
      readerInstance.hasEntireBranch.mockResolvedValue(true);
      const result = await provider.isAvailable("/some/repo");
      expect(result).toBe(true);
      expect(MockCheckpointReader).toHaveBeenCalledWith("/some/repo");
    });

    it("delegates to CheckpointReader.hasEntireBranch (false)", async () => {
      readerInstance.hasEntireBranch.mockResolvedValue(false);
      const result = await provider.isAvailable("/other/repo");
      expect(result).toBe(false);
    });
  });

  describe("listSessions", () => {
    it("returns sessions with token estimate", async () => {
      const sessions = [makeSession({ turnCount: 5 }), makeSession({ turnCount: 10 })];
      readerInstance.resolveLatest.mockResolvedValue(sessions);

      const result = await provider.listSessions({ repoPath: "/repo", type: "latest", value: "2" });

      expect(result.sessions).toEqual(sessions);
      // turnCount * TOKENS_PER_TURN_ESTIMATE (400) = 5*400 + 10*400 = 6000
      expect(result.estimatedTokens).toBe((5 + 10) * 400);
    });

    it("returns empty sessions with 0 token estimate", async () => {
      readerInstance.resolveByBranch.mockResolvedValue([]);

      const result = await provider.listSessions({ repoPath: "/repo", type: "branch", value: "main" });

      expect(result.sessions).toEqual([]);
      expect(result.estimatedTokens).toBe(0);
    });

    it("routes branch query to resolveByBranch", async () => {
      readerInstance.resolveByBranch.mockResolvedValue([makeSession()]);
      await provider.listSessions({ repoPath: "/repo", type: "branch", value: "feat/test" });
      expect(readerInstance.resolveByBranch).toHaveBeenCalledWith("feat/test");
    });

    it("routes commit query to resolveByCommit", async () => {
      readerInstance.resolveByCommit.mockResolvedValue([]);
      await provider.listSessions({ repoPath: "/repo", type: "commit", value: "abc123" });
      expect(readerInstance.resolveByCommit).toHaveBeenCalledWith("abc123");
    });

    it("routes pr query to resolveByPr", async () => {
      readerInstance.resolveByPr.mockResolvedValue([]);
      await provider.listSessions({ repoPath: "/repo", type: "pr", value: "42" });
      expect(readerInstance.resolveByPr).toHaveBeenCalledWith("42");
    });

    it("routes checkpoint query to resolveByCheckpoint", async () => {
      readerInstance.resolveByCheckpoint.mockResolvedValue([]);
      await provider.listSessions({ repoPath: "/repo", type: "checkpoint", value: "abc123def456" });
      expect(readerInstance.resolveByCheckpoint).toHaveBeenCalledWith("abc123def456");
    });

    it("routes session query to resolveBySessionId", async () => {
      readerInstance.resolveBySessionId.mockResolvedValue([]);
      await provider.listSessions({ repoPath: "/repo", type: "session", value: "11111111-1111-1111-1111-111111111111" });
      expect(readerInstance.resolveBySessionId).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111");
    });
  });

  describe("buildContext", () => {
    beforeEach(() => {
      mockSelectMode.mockReturnValue("full");
      mockEstimateTokens.mockReturnValue(1000);
      mockParseJsonlToTurns.mockReturnValue({
        turns: [{ userText: "hello", userTimestamp: "2024-01-01T10:00:00Z", assistantParts: [] }],
        branch: "main",
        firstTimestamp: "2024-01-01T10:00:00Z",
        lastTimestamp: "2024-01-01T10:30:00Z",
      });
      mockBuildSessionMarkdown.mockReturnValue("## Session markdown");
      mockMergeSessionsMarkdown.mockReturnValue("# Merged markdown");
    });

    it("returns empty result when no sessions found", async () => {
      readerInstance.resolveLatest.mockResolvedValue([]);

      const result = await provider.buildContext({ repoPath: "/repo", type: "latest", value: "5" });

      expect(result.markdown).toBe("");
      expect(result.tokenEstimate).toBe(0);
      expect(result.sessionCount).toBe(0);
      expect(result.totalTurns).toBe(0);
      expect(result.mode).toBe("full");
      expect(result.truncated).toBe(false);
    });

    it("returns empty result when transcript is empty", async () => {
      readerInstance.resolveLatest.mockResolvedValue([makeSession()]);
      readerInstance.getTranscript.mockReturnValue("");

      const result = await provider.buildContext({ repoPath: "/repo", type: "latest", value: "5" });

      expect(result.markdown).toBe("");
      expect(result.sessionCount).toBe(0);
    });

    it("returns ContextResult with correct structure", async () => {
      const session = makeSession();
      readerInstance.resolveLatest.mockResolvedValue([session]);
      readerInstance.getTranscript.mockReturnValue('{"type":"user","message":{"role":"user","content":"hi"}}');

      const result = await provider.buildContext({ repoPath: "/repo", type: "latest", value: "1" });

      expect(result.markdown).toBe("# Merged markdown");
      expect(result.tokenEstimate).toBe(1000);
      expect(result.sessionCount).toBe(1);
      expect(result.mode).toBe("full");
      expect(result.truncated).toBe(false);
    });

    it("respects options.limit to slice sessions", async () => {
      const sessions = [makeSession(), makeSession(), makeSession()];
      readerInstance.resolveLatest.mockResolvedValue(sessions);
      readerInstance.getTranscript.mockReturnValue('{"type":"user","message":{"role":"user","content":"hi"}}');

      await provider.buildContext({ repoPath: "/repo", type: "latest", value: "5" }, { limit: 2 });

      // Only 2 sessions should be processed (sliced from end)
      expect(readerInstance.getTranscript).toHaveBeenCalledTimes(2);
    });

    it("auto-downgrades to compact mode when over token budget", async () => {
      const session = makeSession();
      readerInstance.resolveLatest.mockResolvedValue([session]);
      readerInstance.getTranscript.mockReturnValue('{"type":"user","message":{"role":"user","content":"hi"}}');

      mockSelectMode.mockReturnValue("balanced");
      // First call (balanced) is over budget, second call (compact) is under budget
      mockEstimateTokens
        .mockReturnValueOnce(50000)  // balanced: over maxTokens (30000)
        .mockReturnValueOnce(10000); // compact: under budget

      const result = await provider.buildContext({ repoPath: "/repo", type: "latest", value: "1" });

      expect(result.mode).toBe("compact");
      // mergeSessionsMarkdown should be called twice: once for balanced, once for compact
      expect(mockMergeSessionsMarkdown).toHaveBeenCalledTimes(2);
    });

    it("does not downgrade when already in compact mode", async () => {
      const session = makeSession();
      readerInstance.resolveLatest.mockResolvedValue([session]);
      readerInstance.getTranscript.mockReturnValue('{"type":"user","message":{"role":"user","content":"hi"}}');

      mockSelectMode.mockReturnValue("compact");
      mockEstimateTokens.mockReturnValue(50000); // over budget but already compact

      const result = await provider.buildContext(
        { repoPath: "/repo", type: "latest", value: "1" },
        { maxTokens: 30000 }
      );

      expect(result.mode).toBe("compact");
      // Should not try to re-render in compact since already compact
      expect(mockMergeSessionsMarkdown).toHaveBeenCalledTimes(1);
    });

    it("truncates oldest sessions when still over budget in compact mode", async () => {
      const sessions = [makeSession(), makeSession(), makeSession()];
      readerInstance.resolveLatest.mockResolvedValue(sessions);
      readerInstance.getTranscript.mockReturnValue('{"type":"user","message":{"role":"user","content":"hi"}}');

      mockSelectMode.mockReturnValue("compact");
      // First call over budget, second (after removing 1 session) still over, third under
      mockEstimateTokens
        .mockReturnValueOnce(50000)  // 3 sessions: over
        .mockReturnValueOnce(40000)  // 2 sessions: over
        .mockReturnValueOnce(10000); // 1 session: under

      const result = await provider.buildContext(
        { repoPath: "/repo", type: "latest", value: "5" },
        { maxTokens: 30000 }
      );

      expect(result.truncated).toBe(true);
      expect(result.sessionCount).toBe(1);
    });

    it("builds correct title for pr query with full URL", async () => {
      readerInstance.resolveByPr.mockResolvedValue([]);

      await provider.buildContext({ repoPath: "/repo", type: "pr", value: "https://github.com/foo/bar/pull/42" });

      // Empty sessions, no merge call — just verify no crash and correct routing
      expect(readerInstance.resolveByPr).toHaveBeenCalledWith("https://github.com/foo/bar/pull/42");
    });
  });
});
