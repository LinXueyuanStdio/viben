import { runTradingCycle } from "./trading-engine";
import { restoreSessionState } from "./state-machine";
import { listSessions, readAllEvents } from "./session-store";

interface SchedulerEntry {
  timer: ReturnType<typeof setInterval>;
  intervalMinutes: number;
  running: boolean;
  lastCycleAt: number;
}

const activeSchedulers = new Map<string, SchedulerEntry>();

export function startAutoTrading(sessionId: string, intervalMinutes: number): void {
  stopAutoTrading(sessionId);

  const intervalMs = intervalMinutes * 60 * 1000;

  const timer = setInterval(async () => {
    const entry = activeSchedulers.get(sessionId);
    if (!entry || !entry.running) return;

    try {
      const state = await restoreSessionState(sessionId);
      if (state.status !== "running") {
        stopAutoTrading(sessionId);
        return;
      }
      await runTradingCycle(sessionId);
      entry.lastCycleAt = Date.now();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[scheduler] Cycle failed for ${sessionId}: ${message}`);

      if (message.includes("has ended") || message.includes("is paused")) {
        stopAutoTrading(sessionId);
      }
    }
  }, intervalMs);

  activeSchedulers.set(sessionId, { timer, intervalMinutes, running: true, lastCycleAt: Date.now() });
}

export function stopAutoTrading(sessionId: string): void {
  const entry = activeSchedulers.get(sessionId);
  if (entry) {
    clearInterval(entry.timer);
    activeSchedulers.delete(sessionId);
  }
}

export function isAutoTradingActive(sessionId: string): boolean {
  return activeSchedulers.has(sessionId);
}

export function getSchedulerStatus(): { sessionId: string; intervalMinutes: number }[] {
  const result: { sessionId: string; intervalMinutes: number }[] = [];
  for (const [sessionId, entry] of activeSchedulers) {
    result.push({ sessionId, intervalMinutes: entry.intervalMinutes });
  }
  return result;
}

export function getNextCycleAt(sessionId: string): number | null {
  const entry = activeSchedulers.get(sessionId);
  if (!entry) return null;
  return entry.lastCycleAt + entry.intervalMinutes * 60 * 1000;
}

export async function recoverRunningSchedulers(): Promise<number> {
  const sessions = await listSessions();
  let started = 0;

  for (const sessionId of sessions) {
    if (activeSchedulers.has(sessionId)) continue;

    const events = await readAllEvents(sessionId);
    let status: "running" | "paused" | "ended" = "running";
    let intervalMinutes = 60;

    for (const e of events) {
      if (e.type === "session_init") {
        intervalMinutes = e.agent_config.interval_minutes;
      }
      if (e.type === "session_end") status = "ended";
      else if (e.type === "session_pause") status = "paused";
      else if (e.type === "session_resume") status = "running";
    }

    if (status === "running") {
      startAutoTrading(sessionId, intervalMinutes);
      started++;
    }
  }

  return started;
}
