import { mkdtemp, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { AcpSessionEvent } from "../types";
import {
  InMemoryAcpSessionEventStore,
  JsonlAcpSessionEventStore,
  type AcpSessionEventIdentity,
} from "./session-event-store";

const identity: AcpSessionEventIdentity = {
  executor_type: "CLAUDE_CODE",
  session_id: "session-1",
};

function testEvent(text: string, status?: AcpSessionEvent["status"]): Omit<AcpSessionEvent, "seq"> {
  return {
    ts: `2026-06-23T00:00:0${text.length}.000Z`,
    type: "session_update",
    status,
    data: { text },
  };
}

describe("JsonlAcpSessionEventStore", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "viben-acp-events-"));
  });

  it("appends and loads events roundtrip", async () => {
    const store = new JsonlAcpSessionEventStore(root);

    const seq = await store.appendEvent(identity, testEvent("hello"));
    const events = await store.loadEvents(identity);

    expect(seq).toBe(0);
    expect(events).toEqual([{ ...testEvent("hello"), seq: 0 }]);
  });

  it("patches the original event status without creating another business event", async () => {
    const store = new JsonlAcpSessionEventStore(root);

    const seq = await store.appendEvent(identity, testEvent("permission", "pending"));
    await store.updateEventStatus(identity, seq, "resolved");

    const events = await store.loadEvents(identity);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ seq, status: "resolved" });
  });

  it("increments seq and continues from existing max seq after rebuilding the store", async () => {
    const firstStore = new JsonlAcpSessionEventStore(root);

    await firstStore.appendEvent(identity, testEvent("one"));
    await firstStore.appendEvent(identity, testEvent("two"));

    const rebuiltStore = new JsonlAcpSessionEventStore(root);
    const seq = await rebuiltStore.appendEvent(identity, testEvent("three"));

    expect(seq).toBe(2);
    await expect(rebuiltStore.loadEvents(identity)).resolves.toMatchObject([
      { seq: 0 },
      { seq: 1 },
      { seq: 2 },
    ]);
  });

  it("skips malformed JSONL lines and logs a warning", async () => {
    const store = new JsonlAcpSessionEventStore(root);

    await store.appendEvent(identity, testEvent("valid"));
    await appendFile(join(root, store.getEventStoreUri(identity)), "{bad json\n", "utf8");
    await appendFile(join(root, store.getEventStoreUri(identity)), `${JSON.stringify({ ...testEvent("valid-two"), seq: 1 })}\n`, "utf8");

    const events = await store.loadEvents(identity);

    expect(events.map((event) => event.seq)).toEqual([0, 1]);
  });

  it("uses executor_type and session_id relative event store URIs", () => {
    const store = new JsonlAcpSessionEventStore(root);

    expect(store.getEventStoreUri(identity)).toBe("CLAUDE_CODE/session-1/events.jsonl");
  });

  it("keeps executor_type and session_id as a composite identity", async () => {
    const store = new JsonlAcpSessionEventStore(root);

    const claudeSeq = await store.appendEvent({ executor_type: "CLAUDE_CODE", session_id: "shared" }, testEvent("claude"));
    const codexSeq = await store.appendEvent({ executor_type: "CODEX", session_id: "shared" }, testEvent("codex"));

    await expect(store.loadEvents({ executor_type: "CLAUDE_CODE", session_id: "shared" })).resolves.toMatchObject([
      { seq: 0, data: { text: "claude" } },
    ]);
    await expect(store.loadEvents({ executor_type: "CODEX", session_id: "shared" })).resolves.toMatchObject([
      { seq: 0, data: { text: "codex" } },
    ]);
    expect([claudeSeq, codexSeq]).toEqual([0, 0]);
  });

  it("rejects session_id containing slash", async () => {
    const store = new JsonlAcpSessionEventStore(root);
    const slashIdentity = { executor_type: "CODEX", session_id: "workspace/session" };

    await expect(store.appendEvent(slashIdentity, testEvent("slash"))).rejects.toThrow("session_id must match");
    expect(() => store.getEventStoreUri(slashIdentity)).toThrow("session_id must match");
  });

  it("rejects traversal-shaped identity segments", async () => {
    const store = new JsonlAcpSessionEventStore(root);
    const traversalIdentity = { executor_type: "../CODEX", session_id: "../outside" };

    await expect(store.appendEvent(traversalIdentity, testEvent("safe"))).rejects.toThrow("executor_type must match");
    expect(() => store.getEventStoreUri(traversalIdentity)).toThrow("executor_type must match");
  });

  it("serializes concurrent append operations for the same identity", async () => {
    const store = new JsonlAcpSessionEventStore(root);

    const seqs = await Promise.all(
      Array.from({ length: 100 }, (_, index) => store.appendEvent(identity, testEvent(`event-${index}`)))
    );

    expect(new Set(seqs).size).toBe(100);
    expect([...seqs].sort((left, right) => left - right)).toEqual(Array.from({ length: 100 }, (_, index) => index));
  });

  it("returns no events after deleteEvents", async () => {
    const store = new JsonlAcpSessionEventStore(root);

    await store.appendEvent(identity, testEvent("delete"));
    await store.deleteEvents(identity);

    await expect(store.loadEvents(identity)).resolves.toEqual([]);
  });
});

describe("InMemoryAcpSessionEventStore", () => {
  it("uses executor_type and session_id relative event store URIs", () => {
    const store = new InMemoryAcpSessionEventStore();

    expect(store.getEventStoreUri(identity)).toBe("CLAUDE_CODE/session-1/events.jsonl");
  });

  it("rejects invalid identity segments when creating event store URIs", () => {
    const store = new InMemoryAcpSessionEventStore();

    expect(() => store.getEventStoreUri({ executor_type: "CODEX", session_id: "workspace/session" })).toThrow("session_id must match");
  });

  it("patches status and deletes events", async () => {
    const store = new InMemoryAcpSessionEventStore();

    const seq = await store.appendEvent(identity, testEvent("memory", "pending"));
    await store.updateEventStatus(identity, seq, "abandoned");
    await expect(store.loadEvents(identity)).resolves.toMatchObject([{ seq: 0, status: "abandoned" }]);

    await store.deleteEvents(identity);
    await expect(store.loadEvents(identity)).resolves.toEqual([]);
  });
});
