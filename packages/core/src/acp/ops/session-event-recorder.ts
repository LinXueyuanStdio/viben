import type {
  AcpSessionEvent,
  AcpSessionEventStatus,
} from "../types";
import type {
  AcpSessionEventIdentity,
  AcpSessionEventStore,
} from "./session-event-store";
import type { AcpSessionIndexStore } from "./session-index-store";

export class AcpSessionEventRecorder {
  constructor(
    private readonly events: AcpSessionEventStore,
    private readonly identity: AcpSessionEventIdentity,
    private readonly index?: AcpSessionIndexStore
  ) {}

  getIdentity(): AcpSessionEventIdentity {
    return this.identity;
  }

  async append(event: Omit<AcpSessionEvent, "seq">): Promise<number> {
    const seq = await this.events.appendEvent(this.identity, event);
    await this.index?.updateEventCursor(this.identity.executor_type, this.identity.session_id, seq);
    return seq;
  }

  async updateStatus(seq: number, status: AcpSessionEventStatus): Promise<void> {
    await this.events.updateEventStatus(this.identity, seq, status);
  }

  async loadHistory(): Promise<AcpSessionEvent[]> {
    return await this.events.loadEvents(this.identity);
  }

  async abandonPending(events?: AcpSessionEvent[]): Promise<AcpSessionEvent[]> {
    const targetEvents = events ?? await this.loadHistory();
    await Promise.all(
      targetEvents
        .filter((event) => event.status === "pending")
        .map(async (event) => {
          await this.updateStatus(event.seq, "abandoned");
          event.status = "abandoned";
        })
    );
    return targetEvents;
  }
}
