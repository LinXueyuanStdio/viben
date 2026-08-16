import { describe, expect, test } from "vitest";
import type { DailyUsage, HourlyUsage } from "@/lib/db/usage";
import {
  computeUsageWindows,
  SESSION_TOKEN_LIMIT,
  SESSION_WINDOW_MS,
  WEEK_TOKEN_LIMIT,
} from "./window";

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

function hourly(
  hourMs: number,
  inputTokens: number,
  outputTokens: number,
): HourlyUsage {
  return { hourMs, inputTokens, cachedInputTokens: 0, outputTokens };
}

function daily(
  date: string,
  inputTokens: number,
  outputTokens: number,
): DailyUsage {
  return {
    date,
    source: "web",
    agentType: "main",
    provider: null,
    modelId: null,
    inputTokens,
    cachedInputTokens: 0,
    outputTokens,
    messageCount: 0,
    toolCallCount: 0,
  };
}

describe("computeUsageWindows", () => {
  test("session window only counts events within the last 5h", () => {
    const now = 10 * HOUR;
    const hourlyData = [
      hourly(now - 1 * HOUR, 1000, 500),
      hourly(now - 4 * HOUR, 2000, 500),
      hourly(now - 6 * HOUR, 9999, 9999),
    ];
    const { session } = computeUsageWindows(hourlyData, [], now);
    expect(session.used).toBe(1000 + 500 + 2000 + 500);
  });

  test("week window only counts days within the last 7d", () => {
    const now = Date.parse("2026-08-16T12:00:00.000Z");
    const dailyData = [
      daily("2026-08-16", 100, 0),
      daily("2026-08-14", 200, 0),
      daily("2026-08-01", 9999, 9999),
    ];
    const { week } = computeUsageWindows([], dailyData, now);
    expect(week.used).toBe(300);
  });

  test("percent is clamped to 100 and floors non-zero usage to 1", () => {
    const now = 10 * HOUR;
    const overLimit = [
      hourly(now - 1 * HOUR, SESSION_TOKEN_LIMIT, SESSION_TOKEN_LIMIT),
    ];
    const { session: over } = computeUsageWindows(overLimit, [], now);
    expect(over.percent).toBe(100);

    const tiny = [hourly(now - 1 * HOUR, 1, 0)];
    const { session: tinySession } = computeUsageWindows(tiny, [], now);
    expect(tinySession.percent).toBe(1);

    const none = computeUsageWindows([], [], now);
    expect(none.session.percent).toBe(0);
    expect(none.week.percent).toBe(0);
  });

  test("resetsAt is the earliest event timestamp plus the window length", () => {
    const now = 10 * HOUR;
    const earliest = now - 3 * HOUR;
    const hourlyData = [
      hourly(earliest, 100, 0),
      hourly(now - 1 * HOUR, 100, 0),
    ];
    const { session } = computeUsageWindows(hourlyData, [], now);
    expect(session.resetsAt).toBe(earliest + SESSION_WINDOW_MS);
  });

  test("resetsAt is null when there are no events in the window", () => {
    const windows = computeUsageWindows([], [], Date.now());
    expect(windows.session.resetsAt).toBeNull();
    expect(windows.week.resetsAt).toBeNull();
  });

  test("uses the configured limits for session and week", () => {
    const windows = computeUsageWindows([], [], Date.now());
    expect(windows.session.limit).toBe(SESSION_TOKEN_LIMIT);
    expect(windows.week.limit).toBe(WEEK_TOKEN_LIMIT);
  });
});
