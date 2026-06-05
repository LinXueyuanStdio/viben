import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { JsonFileSessionStore } from "../core/sessions/session-store.js";
import { SessionManager } from "../core/sessions/session-manager.js";
import type { SessionRecord } from "../core/types.js";

describe("Lazy Resume Integration", () => {
  let tmpDir: string;
  let filePath: string;
  let store: JsonFileSessionStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "viben-resume-"));
    filePath = path.join(tmpDir, "sessions.json");
    store = new JsonFileSessionStore(filePath, 30);
  });

  afterEach(() => {
    store.destroy();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("survives restart: save, destroy, reload, find", async () => {
    const record: SessionRecord = {
      sessionId: "sess-resume-1",
      agentSessionId: "agent-uuid-abc",
      agentName: "claude",
      workingDir: "/tmp/ws",
      channelId: "telegram",
      status: "active",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      platform: { topicId: 456 },
    };
    await store.save(record);
    store.flushSync();
    store.destroy();

    // Simulate restart
    const store2 = new JsonFileSessionStore(filePath, 30);
    const found = store2.findByPlatform("telegram", (p) => p.topicId === 456);
    expect(found).toBeDefined();
    expect(found!.sessionId).toBe("sess-resume-1");
    expect(found!.agentSessionId).toBe("agent-uuid-abc");
    store2.destroy();
  });

  it("cancelled sessions are not resumable by lookup convention", async () => {
    const record: SessionRecord = {
      sessionId: "sess-cancelled",
      agentSessionId: "agent-uuid-cancel",
      agentName: "claude",
      workingDir: "/tmp/ws",
      channelId: "telegram",
      status: "cancelled",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      platform: { topicId: 789 },
    };
    await store.save(record);
    const found = store.findByPlatform("telegram", (p) => p.topicId === 789);
    // Record exists, but caller should check status before resuming
    expect(found?.status).toBe("cancelled");
  });

  it("finished sessions persist status correctly", async () => {
    const record: SessionRecord = {
      sessionId: "sess-finished",
      agentSessionId: "agent-uuid-fin",
      agentName: "claude",
      workingDir: "/tmp/ws",
      channelId: "telegram",
      status: "active",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      platform: { topicId: 101 },
    };
    await store.save(record);
    // Simulate status update on session_end
    await store.save({ ...record, status: "finished" });
    store.flushSync();
    store.destroy();

    const store2 = new JsonFileSessionStore(filePath, 30);
    const found = store2.get("sess-finished");
    expect(found?.status).toBe("finished");
    store2.destroy();
  });

  // --- Regression tests for topicId persistence race condition ---

  it("race condition: debounced patchRecord loses topicId on simulated crash", async () => {
    // Reproduces the bug: createSession saves platform:{} immediately, then callers
    // call patchRecord({ platform: { topicId } }) without immediate:true.
    // If the server restarts before the 2-second debounce fires, topicId is lost.
    const manager = new SessionManager(store);

    // Step 1: initial save (no topicId — current createSession behavior when threadId not yet known)
    await manager.patchRecord("sess-race", {
      sessionId: "sess-race",
      agentSessionId: "agent-1",
      agentName: "claude",
      workingDir: "/tmp",
      channelId: "telegram",
      status: "active",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      name: "race-session",
      platform: {},
    }, { immediate: true });

    // Step 2: caller sets topicId via a separate debounced patchRecord (current new-session.ts pattern)
    await manager.patchRecord("sess-race", { platform: { topicId: 24952 } }); // no immediate!

    // Simulate crash: destroy clears the debounce timer WITHOUT flushing to disk
    store.destroy();

    // After restart: reload from disk
    const freshStore = new JsonFileSessionStore(filePath, 30);
    const found = freshStore.findByPlatform("telegram", (p) => p.topicId === 24952);
    expect(found).toBeUndefined(); // BUG: topicId was not persisted to disk
    freshStore.destroy();
  });

  it("fix: topicId survives restart when included in the initial immediate save", async () => {
    // After the fix: handleNewSession passes threadId into createSession, which includes
    // platform.topicId in the initial patchRecord({ immediate: true }) call.
    // No separate debounced patchRecord is needed.
    const manager = new SessionManager(store);

    // Fixed: topicId included in the initial immediate save
    await manager.patchRecord("sess-fixed", {
      sessionId: "sess-fixed",
      agentSessionId: "agent-2",
      agentName: "claude",
      workingDir: "/tmp",
      channelId: "telegram",
      status: "active",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      name: "fixed-session",
      platform: { topicId: 24952 },
    }, { immediate: true });

    // Simulate crash
    store.destroy();

    // After restart
    const freshStore = new JsonFileSessionStore(filePath, 30);
    const found = freshStore.findByPlatform("telegram", (p) => p.topicId === 24952);
    expect(found).toBeDefined(); // FIX: topicId survives
    expect(found!.sessionId).toBe("sess-fixed");
    freshStore.destroy();
  });

  it("platform data lookup matches by topicId", async () => {
    await store.save({
      sessionId: "s1",
      agentSessionId: "a1",
      agentName: "claude",
      workingDir: "/tmp",
      channelId: "telegram",
      status: "active",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      platform: { topicId: 100 },
    });
    await store.save({
      sessionId: "s2",
      agentSessionId: "a2",
      agentName: "claude",
      workingDir: "/tmp",
      channelId: "telegram",
      status: "active",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      platform: { topicId: 200 },
    });

    const found = store.findByPlatform("telegram", (p) => p.topicId === 200);
    expect(found?.sessionId).toBe("s2");
  });
});
