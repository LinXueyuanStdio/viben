import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCachedLeaderboard } from "@/lib/services/community";

/**
 * 获取排行榜
 * @summary 按时间窗口获取排行数据
 * @description 返回指定时间窗口的排行，服务端 unstable_cache 缓存，浏览器端 useQuery staleTime 缓存
 * @params timeWindow — 默认为 "7d"
 * @tag Rankings
 */
export async function GET(request: NextRequest) {
  const timeWindow = request.nextUrl.searchParams.get("timeWindow") ?? "7d";
  const items = await getCachedLeaderboard(timeWindow);
  return NextResponse.json({ timeWindow, items });
}
