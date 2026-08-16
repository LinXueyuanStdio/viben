"use client";

import { useMemo } from "react";
import useSWR from "swr";
import type { DailyUsage, HourlyUsage } from "@/lib/db/usage";
import { fetcher } from "@/lib/swr";
import {
  computeUsageWindows,
  type UsageWindows,
} from "@/lib/usage/window";

interface UsageSummaryResponse {
  usage: DailyUsage[];
  hourlyUsage: HourlyUsage[] | null;
  insights?: unknown;
  domainLeaderboard?: unknown;
}

/**
 * Fetches hour-level + day-level usage and computes the session (5h) and
 * week (7d) rolling windows for the usage card.
 */
export function useUsageSummary() {
  const { data, isLoading, error } = useSWR<UsageSummaryResponse>(
    "/api/usage?granularity=hour",
    fetcher,
    { dedupingInterval: 30_000 },
  );

  const windows: UsageWindows = useMemo(
    () =>
      computeUsageWindows(data?.hourlyUsage ?? [], data?.usage ?? []),
    [data],
  );

  return {
    windows,
    loading: isLoading,
    error,
  };
}
