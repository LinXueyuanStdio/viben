import { NextResponse } from "next/server";
import { getCachedLeaderboard } from "@/lib/services/community";

/**
 * 获取排行榜
 * @summary 获取 1d/7d/30d 排行榜数据
 * @description 返回三个时间窗口的排行数据，使用 unstable_cache 服务端缓存 + staleTimes 前端缓存
 * @response 200:LeaderboardResponse
 * @tag Rankings
 */
export async function GET() {
  const items = await getCachedLeaderboard();
  return NextResponse.json({
    tabs: [
      { key: "1d", label: "最新热度", items: items[0] },
      { key: "7d", label: "热门页面", items: items[1] },
      { key: "30d", label: "月度精选", items: items[2] },
    ],
  });
}
