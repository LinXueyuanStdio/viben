import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getHotSearches } from "@/lib/services/search"

/**
 * 获取热门搜索词
 * @description 返回近 7 天内搜索次数最高的搜索词列表，按搜索次数降序排列。通过 limit 参数控制返回条数（默认 8，最大 20）。公开接口，无需登录。内部错误时降级返回空数组而非报错。
 * @params HotSearchQuery
 * @response 200:HotSearchesResponse:热门搜索词数组，每项含 query（搜索词）和 count（搜索次数）
 * @tag Search
 */
export async function GET(request: NextRequest) {
  try {
    const rawLimit = Number(request.nextUrl.searchParams.get("limit"))
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 20) : 8
    const searches = await getHotSearches(limit)
    return NextResponse.json(searches, {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" },
    })
  } catch (error) {
    console.error("[API] Failed to fetch hot searches:", error)
    return NextResponse.json([], { status: 200 }) // 降级返回空数组
  }
}
