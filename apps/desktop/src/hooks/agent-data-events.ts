export interface AgentDataChangedDetail {
  workspace_path?: string | null;
}

const AGENT_DATA_CHANGED_EVENT = "viben:agent-data-changed";
const fallbackTarget = typeof EventTarget === "undefined" ? null : new EventTarget();

function getEventTarget(): EventTarget | null {
  if (typeof window !== "undefined") return window;
  return fallbackTarget;
}

function createAgentDataChangedEvent(detail: AgentDataChangedDetail): Event {
  if (typeof CustomEvent !== "undefined") {
    return new CustomEvent(AGENT_DATA_CHANGED_EVENT, { detail });
  }

  const event = new Event(AGENT_DATA_CHANGED_EVENT) as Event & {
    detail: AgentDataChangedDetail;
  };
  event.detail = detail;
  return event;
}

export function emitAgentDataChanged(detail: AgentDataChangedDetail = {}): void {
  getEventTarget()?.dispatchEvent(createAgentDataChangedEvent(detail));
}

export function subscribeAgentDataChanged(
  listener: (detail: AgentDataChangedDetail) => void
): () => void {
  const target = getEventTarget();
  if (!target) return () => {};
  const handler = (event: Event) => {
    listener((event as CustomEvent<AgentDataChangedDetail>).detail);
  };
  target.addEventListener(AGENT_DATA_CHANGED_EVENT, handler);
  return () => target.removeEventListener(AGENT_DATA_CHANGED_EVENT, handler);
}

export function shouldRefreshAgentList(
  detail: AgentDataChangedDetail,
  workspacePath?: string | null
): boolean {
  if (!detail.workspace_path || !workspacePath) return true;
  return detail.workspace_path === workspacePath;
}
