import type { DailyUsage, HourlyUsage } from "@/lib/db/usage";

export const SESSION_WINDOW_MS = 5 * 60 * 60 * 1000;
export const WEEK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_TOKEN_LIMIT = 200_000;
export const WEEK_TOKEN_LIMIT = 1_000_000;

export interface UsageWindowSummary {
  key: "session" | "week";
  windowMs: number;
  limit: number;
  used: number;
  percent: number;
  resetsAt: number | null;
}

function tokensOf(row: { inputTokens: number; outputTokens: number }): number {
  return row.inputTokens + row.outputTokens;
}

function percentOf(used: number, limit: number): number {
  if (limit <= 0 || used <= 0) {
    return 0;
  }
  const raw = Math.round((used / limit) * 100);
  return Math.max(1, Math.min(100, raw));
}

function computeRollingWindow(
  rows: Array<{ tsMs: number; tokens: number }>,
  windowMs: number,
  limit: number,
  now: number,
  key: "session" | "week",
): UsageWindowSummary {
  const cutoff = now - windowMs;
  const inWindow = rows.filter((row) => row.tsMs >= cutoff && row.tsMs <= now);
  const used = inWindow.reduce((sum, row) => sum + row.tokens, 0);
  const earliest = inWindow.reduce<number | null>(
    (min, row) => (min === null ? row.tsMs : Math.min(min, row.tsMs)),
    null,
  );

  return {
    key,
    windowMs,
    limit,
    used,
    percent: percentOf(used, limit),
    resetsAt: earliest === null ? null : earliest + windowMs,
  };
}

export interface UsageWindows {
  session: UsageWindowSummary;
  week: UsageWindowSummary;
}

/**
 * Computes the session (5h rolling) and week (7d rolling) usage windows from
 * hour-level and day-level aggregates. `resetsAt` is the earliest event's
 * timestamp plus the window length — the moment the oldest event rolls out.
 */
export function computeUsageWindows(
  hourly: HourlyUsage[],
  daily: DailyUsage[],
  now: number = Date.now(),
): UsageWindows {
  const hourlyRows = hourly.map((h) => ({
    tsMs: h.hourMs,
    tokens: tokensOf(h),
  }));

  const dailyRows = daily.map((d) => {
    const tsMs = Date.parse(`${d.date}T00:00:00.000Z`);
    return {
      tsMs: Number.isNaN(tsMs) ? 0 : tsMs,
      tokens: tokensOf(d),
    };
  });

  return {
    session: computeRollingWindow(
      hourlyRows,
      SESSION_WINDOW_MS,
      SESSION_TOKEN_LIMIT,
      now,
      "session",
    ),
    week: computeRollingWindow(
      dailyRows,
      WEEK_WINDOW_MS,
      WEEK_TOKEN_LIMIT,
      now,
      "week",
    ),
  };
}
