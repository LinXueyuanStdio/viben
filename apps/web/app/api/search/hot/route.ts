import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getHotSearches } from "@/lib/services/search"

/**
 * GET /api/search/hot — 获取热门搜索词（公开接口）
 */
export async function GET(request: NextRequest) {
  try {
    const rawLimit = Number(request.nextUrl.searchParams.get("limit"))
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 20) : 8
    const searches = await getHotSearches(limit)
    return NextResponse.json(searches)
  } catch (error) {
    console.error("[API] Failed to fetch hot searches:", error)
    return NextResponse.json([], { status: 200 }) // 降级返回空数组
  }
}
