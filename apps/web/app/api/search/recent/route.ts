import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { AuthError, requireAuth } from "@/lib/auth/middleware"
import { getRecentSearches } from "@/lib/services/search"

/**
 * 获取用户最近搜索词
 * @description 返回当前登录用户的去重最近搜索词列表，按搜索时间降序排列。通过 limit 参数控制返回条数（默认 5，最大 20）。未登录或认证失败时降级返回空数组，不报错。
 * @params RecentSearchQuery
 * @response 200:RecentSearchesResponse:最近搜索词字符串数组
 * @responseSet auth
 * @auth bearer
 * @tag Search
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    const rawLimit = Number(request.nextUrl.searchParams.get("limit"))
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 20) : 5
    const searches = await getRecentSearches(session.userId, limit)
    return NextResponse.json(searches, {
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json([], { status: 200 }) // 未登录时返回空数组
    }
    console.error("[API] Failed to fetch recent searches:", error)
    return NextResponse.json([], { status: 200 })
  }
}
