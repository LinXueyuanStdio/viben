import type { SessionState } from "./types";
import { readAllEvents } from "./session-store";
import { computeMetrics } from "./metrics";
import { createEmptyState, reduceEvent } from "./state-reducer";

export { createEmptyState, reduceEvent } from "./state-reducer";

export async function restoreSessionState(sessionId: string): Promise<SessionState> {
  const events = await readAllEvents(sessionId);
  let state = createEmptyState();

  for (const event of events) {
    state = reduceEvent(state, event);
  }

  state.metrics = computeMetrics(state);

  return state;
}
