import { describe, it, expect, vi } from "vitest";
import { CheckpointReader } from "../entire/checkpoint-reader.js";

describe("CheckpointReader", () => {
  describe("static helpers", () => {
    it("shardPath converts ID", () => {
      expect(CheckpointReader.shardPath("f634acf05138")).toBe("f6/34acf05138");
    });

    it("isCheckpointId detects 12 hex chars", () => {
      expect(CheckpointReader.isCheckpointId("f634acf05138")).toBe(true);
      expect(CheckpointReader.isCheckpointId("abc123")).toBe(false);
      expect(CheckpointReader.isCheckpointId("not-hex-chars")).toBe(false);
    });

    it("isCheckpointId rejects 13-char hex string", () => {
      expect(CheckpointReader.isCheckpointId("f634acf05138a")).toBe(false);
    });

    it("isCheckpointId rejects uppercase hex", () => {
      // IDs in git output are lowercase
      expect(CheckpointReader.isCheckpointId("F634ACF05138")).toBe(false);
    });

    it("isSessionId detects UUID format", () => {
      expect(
        CheckpointReader.isSessionId("1d9503b8-0134-419a-a3a7-019b312dd12c")
      ).toBe(true);
      expect(CheckpointReader.isSessionId("not-a-uuid")).toBe(false);
      expect(CheckpointReader.isSessionId("f634acf05138")).toBe(false);
    });

    it("isSessionId rejects UUID missing segments", () => {
      expect(
        CheckpointReader.isSessionId("1d9503b8-0134-419a-a3a7")
      ).toBe(false);
    });

    it("parseCheckpointMeta parses valid JSON", () => {
      const json =
        '{"checkpoint_id":"f634acf05138","branch":"main","files_touched":["a.ts"],"sessions":[{"metadata":"/f6/34acf05138/0/metadata.json","transcript":"/f6/34acf05138/0/full.jsonl"}]}';
      const result = CheckpointReader.parseCheckpointMeta(json);
      expect(result?.branch).toBe("main");
      expect(result?.sessions.length).toBe(1);
    });

    it("parseCheckpointMeta returns null for invalid JSON", () => {
      expect(CheckpointReader.parseCheckpointMeta("not json")).toBeNull();
    });

    it("parseCheckpointMeta returns null for non-object JSON", () => {
      expect(CheckpointReader.parseCheckpointMeta("null")).toBeNull();
      expect(CheckpointReader.parseCheckpointMeta('"string"')).toBeNull();
    });

    it("parseCheckpointMeta returns null when sessions is missing", () => {
      expect(
        CheckpointReader.parseCheckpointMeta('{"branch":"main"}')
      ).toBeNull();
    });

    it("parseCheckpointTrailers extracts IDs from git log", () => {
      const output =
        "abc123def456|feat: something|f634acf05138\ndef789ghi012|fix: other|";
      expect(
        CheckpointReader.parseCheckpointTrailers(output)
      ).toEqual(["f634acf05138"]);
    });

    it("parseCheckpointTrailers returns empty array when no trailers", () => {
      const output = "abc123def456|\ndef789ghi012|";
      expect(CheckpointReader.parseCheckpointTrailers(output)).toEqual([]);
    });

    it("parseCheckpointTrailers handles multiple trailer IDs", () => {
      const output = "aaa|id1\nbbb|id2\nccc|";
      expect(CheckpointReader.parseCheckpointTrailers(output)).toEqual([
        "id1",
        "id2",
      ]);
    });

    it("parseCheckpointTrailers handles lines without pipe", () => {
      const output = "abc123def456\nbbb|id2";
      expect(CheckpointReader.parseCheckpointTrailers(output)).toEqual(["id2"]);
    });

    it("shardPath always takes first 2 chars as shard prefix", () => {
      expect(CheckpointReader.shardPath("ab1234567890")).toBe("ab/1234567890");
    });
  });

  describe("hasEntireBranch", () => {
    it("returns true when branch exists", async () => {
      const reader = new CheckpointReader("/repo");
      vi.spyOn(reader as any, "git").mockReturnValue(
        "  origin/entire/checkpoints/v1\n  origin/main"
      );
      expect(await reader.hasEntireBranch()).toBe(true);
    });

    it("returns false when branch missing", async () => {
      const reader = new CheckpointReader("/repo");
      vi.spyOn(reader as any, "git").mockReturnValue("  origin/main");
      expect(await reader.hasEntireBranch()).toBe(false);
    });

    it("returns false when git returns empty string", async () => {
      const reader = new CheckpointReader("/repo");
      vi.spyOn(reader as any, "git").mockReturnValue("");
      expect(await reader.hasEntireBranch()).toBe(false);
    });
  });

  describe("resolveByCheckpoint with mocked git", () => {
    it("resolves checkpoint to sessions", async () => {
      const cpMeta =
        '{"checkpoint_id":"f634acf05138","branch":"main","files_touched":["src/app.ts"],"sessions":[{"metadata":"/f6/34acf05138/0/metadata.json","transcript":"/f6/34acf05138/0/full.jsonl"}]}';
      const sessMeta =
        '{"session_id":"082e8393-b2a5-4eb4-b70a-4338c754da64","created_at":"2026-03-12T06:59:39.787Z","branch":"main","files_touched":["src/app.ts"],"agent":"Claude Code","session_metrics":{"turn_count":5}}';

      const reader = new CheckpointReader("/repo");
      vi.spyOn(reader as any, "git").mockImplementation((...args: unknown[]) => {
        const cmd = (args as string[]).join(" ");
        if (
          cmd.includes("f6/34acf05138/metadata.json") &&
          !cmd.includes("/0/")
        )
          return cpMeta;
        if (cmd.includes("/0/metadata.json")) return sessMeta;
        return "";
      });

      const sessions = await reader.resolveByCheckpoint("f634acf05138");
      expect(sessions.length).toBe(1);
      expect(sessions[0].agent).toBe("Claude Code");
      expect(sessions[0].branch).toBe("main");
      expect(sessions[0].turnCount).toBe(5);
      expect(sessions[0].sessionId).toBe("082e8393-b2a5-4eb4-b70a-4338c754da64");
    });

    it("returns empty array when checkpoint metadata missing", async () => {
      const reader = new CheckpointReader("/repo");
      vi.spyOn(reader as any, "git").mockReturnValue("");
      const sessions = await reader.resolveByCheckpoint("f634acf05138");
      expect(sessions).toEqual([]);
    });

    it("sets endedAt equal to createdAt when session metadata lacks endedAt", async () => {
      const cpMeta =
        '{"branch":"main","sessions":[{"metadata":"/f6/34acf05138/0/metadata.json","transcript":"/f6/34acf05138/0/full.jsonl"}]}';
      const sessMeta =
        '{"created_at":"2026-03-12T06:59:39.787Z","agent":"X","session_metrics":{"turn_count":2}}';

      const reader = new CheckpointReader("/repo");
      vi.spyOn(reader as any, "git").mockImplementation((...args: unknown[]) => {
        const cmd = (args as string[]).join(" ");
        if (
          cmd.includes("f6/34acf05138/metadata.json") &&
          !cmd.includes("/0/")
        )
          return cpMeta;
        if (cmd.includes("/0/metadata.json")) return sessMeta;
        return "";
      });

      const sessions = await reader.resolveByCheckpoint("f634acf05138");
      expect(sessions[0].endedAt).toBe("2026-03-12T06:59:39.787Z");
      expect(sessions[0].endedAt).toBe(sessions[0].createdAt);
    });

    it("sets sessionIndex from position in sessions array", async () => {
      const cpMeta =
        '{"branch":"main","sessions":[{"metadata":"/f6/34acf05138/0/metadata.json","transcript":"/f6/34acf05138/0/full.jsonl"},{"metadata":"/f6/34acf05138/1/metadata.json","transcript":"/f6/34acf05138/1/full.jsonl"}]}';
      const sessMeta = '{"created_at":"2026-01-01T00:00:00.000Z","agent":"A"}';

      const reader = new CheckpointReader("/repo");
      vi.spyOn(reader as any, "git").mockImplementation((...args: unknown[]) => {
        const cmd = (args as string[]).join(" ");
        if (
          cmd.includes("f6/34acf05138/metadata.json") &&
          !cmd.includes("/0/") &&
          !cmd.includes("/1/")
        )
          return cpMeta;
        if (cmd.includes("/metadata.json")) return sessMeta;
        return "";
      });

      const sessions = await reader.resolveByCheckpoint("f634acf05138");
      expect(sessions.length).toBe(2);
      expect(sessions[0].sessionIndex).toBe("0");
      expect(sessions[1].sessionIndex).toBe("1");
    });
  });

  describe("resolveByCommit with mocked git", () => {
    it("resolves commit to sessions via trailer", async () => {
      const cpMeta =
        '{"branch":"main","sessions":[{"metadata":"/f6/34acf05138/0/metadata.json","transcript":"/f6/34acf05138/0/full.jsonl"}]}';
      const sessMeta =
        '{"session_id":"082e8393-b2a5-4eb4-b70a-4338c754da64","created_at":"2026-01-01T00:00:00.000Z","agent":"X","session_metrics":{"turn_count":1}}';

      const reader = new CheckpointReader("/repo");
      vi.spyOn(reader as any, "git").mockImplementation((...args: unknown[]) => {
        const cmd = (args as string[]).join(" ");
        if (cmd.includes("rev-parse")) return "abcdef1234567890";
        if (cmd.includes("trailers:key=Entire-Checkpoint")) return "f634acf05138";
        if (
          cmd.includes("f6/34acf05138/metadata.json") &&
          !cmd.includes("/0/")
        )
          return cpMeta;
        if (cmd.includes("/0/metadata.json")) return sessMeta;
        return "";
      });

      const sessions = await reader.resolveByCommit("abcdef1234567890");
      expect(sessions.length).toBe(1);
      expect(sessions[0].checkpointId).toBe("f634acf05138");
    });

    it("returns empty array when commit not found", async () => {
      const reader = new CheckpointReader("/repo");
      vi.spyOn(reader as any, "git").mockReturnValue("");
      const sessions = await reader.resolveByCommit("nonexistent");
      expect(sessions).toEqual([]);
    });

    it("returns empty array when commit has no checkpoint trailer", async () => {
      const reader = new CheckpointReader("/repo");
      vi.spyOn(reader as any, "git").mockImplementation((...args: unknown[]) => {
        const cmd = (args as string[]).join(" ");
        if (cmd.includes("rev-parse")) return "abcdef1234567890";
        return ""; // no trailer
      });
      const sessions = await reader.resolveByCommit("abcdef1234567890");
      expect(sessions).toEqual([]);
    });
  });

  describe("resolveByPr with mocked git", () => {
    it("accepts numeric PR number string", async () => {
      const reader = new CheckpointReader("/repo");
      const gitSpy = vi.spyOn(reader as any, "git").mockReturnValue("");
      await reader.resolveByPr("42");
      // First call should be log --grep "Merge pull request #42"
      const firstCall = gitSpy.mock.calls[0] as string[];
      expect(firstCall.join(" ")).toContain("Merge pull request #42");
    });

    it("parses PR number from GitHub URL", async () => {
      const reader = new CheckpointReader("/repo");
      const gitSpy = vi.spyOn(reader as any, "git").mockReturnValue("");
      await reader.resolveByPr("https://github.com/org/repo/pull/19");
      const firstCall = gitSpy.mock.calls[0] as string[];
      expect(firstCall.join(" ")).toContain("Merge pull request #19");
    });

    it("returns empty array for unparseable PR input", async () => {
      const reader = new CheckpointReader("/repo");
      const sessions = await reader.resolveByPr("not-a-pr");
      expect(sessions).toEqual([]);
    });

    it("returns empty array when no merge commit found", async () => {
      const reader = new CheckpointReader("/repo");
      vi.spyOn(reader as any, "git").mockReturnValue("");
      const sessions = await reader.resolveByPr("42");
      expect(sessions).toEqual([]);
    });
  });

  describe("resolveByBranch with mocked git", () => {
    it("filters sessions by branch and sorts by createdAt", async () => {
      const lsTree = "f6/34acf05138/metadata.json\naa/bbbbbbbbbb/metadata.json";
      const cpMetaMain =
        '{"branch":"main","sessions":[{"metadata":"/f6/34acf05138/0/metadata.json","transcript":"/f6/34acf05138/0/full.jsonl"}]}';
      const cpMetaDev =
        '{"branch":"dev","sessions":[{"metadata":"/aa/bbbbbbbbbb/0/metadata.json","transcript":"/aa/bbbbbbbbbb/0/full.jsonl"}]}';
      const sessMetaA =
        '{"created_at":"2026-01-02T00:00:00.000Z","agent":"A","session_metrics":{"turn_count":1}}';

      const reader = new CheckpointReader("/repo");
      vi.spyOn(reader as any, "git").mockImplementation((...args: unknown[]) => {
        const cmd = (args as string[]).join(" ");
        if (cmd.includes("ls-tree")) return lsTree;
        if (cmd.includes("f6/34acf05138/metadata.json") && !cmd.includes("/0/")) return cpMetaMain;
        if (cmd.includes("aa/bbbbbbbbbb/metadata.json") && !cmd.includes("/0/")) return cpMetaDev;
        if (cmd.includes("/0/metadata.json")) return sessMetaA;
        return "";
      });

      const sessions = await reader.resolveByBranch("main");
      expect(sessions.length).toBe(1);
      expect(sessions[0].branch).toBe("main");
    });
  });

  describe("resolveLatest with mocked git", () => {
    it("returns at most N sessions sorted newest first", async () => {
      const lsTree = "f6/34acf05138/metadata.json";
      const cpMeta =
        '{"branch":"main","sessions":[{"metadata":"/f6/34acf05138/0/metadata.json","transcript":"/f6/34acf05138/0/full.jsonl"},{"metadata":"/f6/34acf05138/1/metadata.json","transcript":"/f6/34acf05138/1/full.jsonl"}]}';
      const sessMetaOld =
        '{"created_at":"2026-01-01T00:00:00.000Z","agent":"A","session_metrics":{"turn_count":1}}';
      const sessMetaNew =
        '{"created_at":"2026-03-01T00:00:00.000Z","agent":"B","session_metrics":{"turn_count":2}}';

      const reader = new CheckpointReader("/repo");
      let sessionCallCount = 0;
      vi.spyOn(reader as any, "git").mockImplementation((...args: unknown[]) => {
        const cmd = (args as string[]).join(" ");
        if (cmd.includes("ls-tree")) return lsTree;
        if (cmd.includes("f6/34acf05138/metadata.json") && !cmd.includes("/0/") && !cmd.includes("/1/")) return cpMeta;
        if (cmd.includes("/metadata.json")) {
          return sessionCallCount++ === 0 ? sessMetaOld : sessMetaNew;
        }
        return "";
      });

      const sessions = await reader.resolveLatest(1);
      expect(sessions.length).toBe(1);
      // Should be sorted newest first
      expect(sessions[0].createdAt >= "2026-03-01").toBe(true);
    });
  });

  describe("getTranscript", () => {
    it("calls git show with normalized path", () => {
      const reader = new CheckpointReader("/repo");
      const gitSpy = vi
        .spyOn(reader as any, "git")
        .mockReturnValue("jsonl content");

      const result = reader.getTranscript("/f6/34acf05138/0/full.jsonl");
      expect(result).toBe("jsonl content");
      const args = gitSpy.mock.calls[0] as string[];
      expect(args.join(" ")).toContain("f6/34acf05138/0/full.jsonl");
      // Leading slash should be stripped
      expect(args.join(" ")).not.toContain(":/f6");
    });

    it("handles path without leading slash", () => {
      const reader = new CheckpointReader("/repo");
      vi.spyOn(reader as any, "git").mockReturnValue("content");
      const result = reader.getTranscript("f6/34acf05138/0/full.jsonl");
      expect(result).toBe("content");
    });
  });
});
