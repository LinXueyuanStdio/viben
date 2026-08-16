import type { NextRequest } from "next/server";
import { parseUsageQueryRange } from "./_lib/query-range";
import { getUsageDomainLeaderboard } from "@/lib/db/usage-domain-leaderboard";
import { getUsageInsights } from "@/lib/db/usage-insights";
import { getUsageHistory, getUsageHistoryHourly } from "@/lib/db/usage";
import { getSessionFromReq } from "@/lib/session/server";

/**
 * GET /api/usage — Retrieve aggregated usage history + derived insights (cookie auth)
 * Optional query params: from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromReq(req);
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rangeResult = parseUsageQueryRange(req);
  if (!rangeResult.ok) {
    return rangeResult.response;
  }

  try {
    const queryOptions = rangeResult.range
      ? { range: rangeResult.range }
      : undefined;
    const granularity = req.nextUrl.searchParams.get("granularity");
    const [usage, insights, domainLeaderboard, hourlyUsage] = await Promise.all([
      getUsageHistory(session.user.id, queryOptions),
      getUsageInsights(session.user.id, queryOptions),
      getUsageDomainLeaderboard(session.user.email, queryOptions),
      granularity === "hour"
        ? getUsageHistoryHourly(session.user.id)
        : Promise.resolve(null),
    ]);
    return Response.json({ usage, insights, domainLeaderboard, hourlyUsage });
  } catch (error) {
    console.error("Failed to get usage history:", error);
    return Response.json(
      { error: "Failed to get usage history" },
      { status: 500 },
    );
  }
}
