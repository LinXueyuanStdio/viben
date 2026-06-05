import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ContextManager } from "../context-manager.js";
import { HistoryStore } from "../history/history-store.js";
import type { SessionHistory } from "../history/types.js";

function makeHistory(sessionId: string): SessionHistory {
  return {
    version: 1,
    sessionId,
    turns: [
      {
        index: 0,
        role: "user",
        timestamp: "2026-01-01T00:00:00.000Z",
        content: "Hello",
      },
    ],
  };
}

describe("ContextManager.getHistory", () => {
  let tmpDir: string;
  let store: HistoryStore;
  let manager: ContextManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctx-mgr-history-test-"));
    store = new HistoryStore(path.join(tmpDir, "history"));
    manager = new ContextManager(path.join(tmpDir, "cache"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null when no history store is set", async () => {
    const result = await manager.getHistory("session-1");
    expect(result).toBeNull();
  });

  it("returns history when store is set and session exists", async () => {
    const history = makeHistory("session-1");
    await store.write(history);
    manager.setHistoryStore(store);

    const result = await manager.getHistory("session-1");
    expect(result).toEqual(history);
  });

  it("returns null when session has no history", async () => {
    manager.setHistoryStore(store);
    const result = await manager.getHistory("nonexistent");
    expect(result).toBeNull();
  });
});
