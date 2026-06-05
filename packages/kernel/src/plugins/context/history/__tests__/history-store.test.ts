import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HistoryStore } from "../history-store.js";
import type { SessionHistory } from "../types.js";

function makeHistory(sessionId: string, overrides?: Partial<SessionHistory>): SessionHistory {
  return {
    version: 1,
    sessionId,
    turns: [],
    ...overrides,
  };
}

describe("HistoryStore", () => {
  let tmpDir: string;
  let store: HistoryStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "history-store-test-"));
    store = new HistoryStore(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("write and read", () => {
    it("writes a session history and reads it back", async () => {
      const history = makeHistory("session-1", {
        turns: [
          {
            index: 0,
            role: "user",
            timestamp: "2026-01-01T00:00:00.000Z",
            content: "Hello",
          },
        ],
      });

      await store.write(history);
      const result = await store.read("session-1");

      expect(result).toEqual(history);
    });

    it("returns null for a non-existent session", async () => {
      const result = await store.read("does-not-exist");
      expect(result).toBeNull();
    });

    it("overwrites existing history", async () => {
      const original = makeHistory("session-overwrite", {
        turns: [{ index: 0, role: "user", timestamp: "2026-01-01T00:00:00.000Z", content: "first" }],
      });
      const updated = makeHistory("session-overwrite", {
        turns: [
          { index: 0, role: "user", timestamp: "2026-01-01T00:00:00.000Z", content: "first" },
          { index: 1, role: "assistant", timestamp: "2026-01-01T00:00:01.000Z", steps: [] },
        ],
      });

      await store.write(original);
      await store.write(updated);

      const result = await store.read("session-overwrite");
      expect(result).toEqual(updated);
      expect(result?.turns).toHaveLength(2);
    });
  });

  describe("exists", () => {
    it("returns true when history file exists", async () => {
      await store.write(makeHistory("session-exists"));
      expect(await store.exists("session-exists")).toBe(true);
    });

    it("returns false when history file does not exist", async () => {
      expect(await store.exists("session-no-file")).toBe(false);
    });
  });

  describe("list", () => {
    it("lists all session IDs from the directory", async () => {
      await store.write(makeHistory("session-a"));
      await store.write(makeHistory("session-b"));
      await store.write(makeHistory("session-c"));

      const ids = await store.list();
      expect(ids.sort()).toEqual(["session-a", "session-b", "session-c"]);
    });

    it("returns empty array when directory is empty", async () => {
      const ids = await store.list();
      expect(ids).toEqual([]);
    });

    it("returns empty array when directory does not exist", async () => {
      const nonExistentDir = path.join(tmpDir, "nonexistent");
      const emptyStore = new HistoryStore(nonExistentDir);
      const ids = await emptyStore.list();
      expect(ids).toEqual([]);
    });

    it("ignores non-JSON files in the directory", async () => {
      await store.write(makeHistory("session-listed"));
      fs.writeFileSync(path.join(tmpDir, "not-a-history.txt"), "ignored");
      fs.writeFileSync(path.join(tmpDir, "also-ignored"), "ignored");

      const ids = await store.list();
      expect(ids).toEqual(["session-listed"]);
    });
  });

  describe("delete", () => {
    it("deletes an existing history file", async () => {
      await store.write(makeHistory("session-to-delete"));
      expect(await store.exists("session-to-delete")).toBe(true);

      await store.delete("session-to-delete");
      expect(await store.exists("session-to-delete")).toBe(false);
    });

    it("is safe when the file does not exist", async () => {
      await expect(store.delete("nonexistent-session")).resolves.toBeUndefined();
    });

    it("removes only the targeted session, leaving others intact", async () => {
      await store.write(makeHistory("session-keep"));
      await store.write(makeHistory("session-remove"));

      await store.delete("session-remove");

      expect(await store.exists("session-keep")).toBe(true);
      expect(await store.exists("session-remove")).toBe(false);
    });
  });

  describe("directory creation", () => {
    it("creates the directory if it does not exist before writing", async () => {
      const newDir = path.join(tmpDir, "deep", "nested", "dir");
      const newStore = new HistoryStore(newDir);

      await newStore.write(makeHistory("session-new-dir"));

      expect(fs.existsSync(newDir)).toBe(true);
      const result = await newStore.read("session-new-dir");
      expect(result?.sessionId).toBe("session-new-dir");
    });
  });

  describe("path traversal protection", () => {
    it("strips directory components from session ID on read", async () => {
      await store.write(makeHistory("legit-session"));
      const result = await store.read("../../../etc/passwd");
      expect(result).toBeNull();
    });

    it("strips directory components from session ID on exists", async () => {
      const result = await store.exists("../../etc/passwd");
      expect(result).toBe(false);
    });

    it("uses only basename when session ID contains path separators", async () => {
      await store.write(makeHistory("safe-id"));
      // path.basename("foo/bar/safe-id") => "safe-id", so reading with traversal won't reach it
      const result = await store.read("../other-dir/safe-id");
      // Should read basename "safe-id" from the store dir, which exists
      expect(result?.sessionId).toBe("safe-id");
    });

    it("rejects session ID that resolves outside store directory", async () => {
      // path.basename strips traversal, but double-check the resolved path stays within dir
      const result = await store.read("..%2F..%2Fetc%2Fpasswd");
      expect(result).toBeNull();
    });
  });

  describe("corrupt JSON handling", () => {
    it("returns null when the file contains invalid JSON", async () => {
      const corruptPath = path.join(tmpDir, "corrupt-session.json");
      fs.writeFileSync(corruptPath, "{ this is not valid json !!!");

      const result = await store.read("corrupt-session");
      expect(result).toBeNull();
    });
  });
});
