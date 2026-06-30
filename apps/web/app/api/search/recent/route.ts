import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { AuthError, requireAuth } from "@/lib/auth/middleware"
import { getRecentSearches } from "@/lib/services/search"

/**
 * GET /api/search/recent — 获取用户最近搜索词（需登录）
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    const rawLimit = Number(request.nextUrl.searchParams.get("limit"))
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 20) : 5
    const searches = await getRecentSearches(session.userId, limit)
    return NextResponse.json(searches)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json([], { status: 200 }) // 未登录时返回空数组
    }
    console.error("[API] Failed to fetch recent searches:", error)
    return NextResponse.json([], { status: 200 })
  }
}
