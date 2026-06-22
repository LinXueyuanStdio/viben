import { describe, expect, it } from "vitest";
import { DefaultAcpSessionStorageAdapter } from "./session-storage";
import type { AcpSessionEventIdentity, AcpSessionEventStore } from "./session-event-store";
import type { AcpSessionIndexStore } from "./session-index-store";

describe("DefaultAcpSessionStorageAdapter", () => {
  it("hard deletes the index record before deleting events", async () => {
    const calls: string[] = [];
    const identity: AcpSessionEventIdentity = {
      executor_type: "CLAUDE_CODE",
      session_id: "session-1",
    };
    const index = {
      async hardDeleteRecord(executorType: string, sessionId: string): Promise<void> {
        expect(executorType).toBe(identity.executor_type);
        expect(sessionId).toBe(identity.session_id);
        calls.push("index");
      },
    } as AcpSessionIndexStore;
    const events = {
      async deleteEvents(receivedIdentity: AcpSessionEventIdentity): Promise<void> {
        expect(receivedIdentity).toEqual(identity);
        calls.push("events");
      },
    } as AcpSessionEventStore;

    const storage = new DefaultAcpSessionStorageAdapter(index, events);

    await storage.hardDeleteSession(identity);

    expect(calls).toEqual(["index", "events"]);
  });
});
