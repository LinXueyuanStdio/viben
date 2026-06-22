import {
  createDefaultAcpSessionEventStore,
  type AcpSessionEventIdentity,
  type AcpSessionEventStore,
} from "./session-event-store";
import {
  createDefaultAcpSessionIndexStore,
  type AcpSessionIndexStore,
} from "./session-index-store";

export interface AcpSessionStorageAdapter {
  index: AcpSessionIndexStore;
  events: AcpSessionEventStore;
  hardDeleteSession(identity: AcpSessionEventIdentity): Promise<void>;
}

export class DefaultAcpSessionStorageAdapter implements AcpSessionStorageAdapter {
  constructor(
    public readonly index: AcpSessionIndexStore,
    public readonly events: AcpSessionEventStore
  ) {}

  async hardDeleteSession(identity: AcpSessionEventIdentity): Promise<void> {
    await this.index.hardDeleteRecord(identity.executor_type, identity.session_id);
    await this.events.deleteEvents(identity);
  }
}

export function createDefaultAcpSessionStorage(): AcpSessionStorageAdapter {
  return new DefaultAcpSessionStorageAdapter(
    createDefaultAcpSessionIndexStore(),
    createDefaultAcpSessionEventStore()
  );
}

export async function cleanupStaleAcpSessions(
  storage: AcpSessionStorageAdapter,
  parkTTLDays = 7
): Promise<void> {
  const records = await storage.index.listRecords({ statuses: ["parked"] });
  const now = Date.now();
  const finishedAt = new Date(now).toISOString();
  const ttlMs = parkTTLDays * 24 * 60 * 60 * 1000;

  for (const record of records) {
    const lastActiveAt = new Date(record.last_active_at).getTime();
    if (!Number.isFinite(lastActiveAt)) continue;
    if (now - lastActiveAt <= ttlMs) continue;

    await storage.index.updateStatus(record.executor_type, record.session_id, "finished", {
      finished_at: finishedAt,
      last_active_at: finishedAt,
    });
  }
}
