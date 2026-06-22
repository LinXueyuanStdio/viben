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
