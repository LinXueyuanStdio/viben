import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { db, publishedPages, users } from "@/lib/db"
import { requireAuth, AuthError } from "@/lib/auth/middleware"
import { and, eq, sql } from "drizzle-orm"

/**
 * 删除已发布页面
 * @summary 删除已发布页面
 * @description 删除指定已发布页面，需登录且仅页面作者可操作。非作者返回 403，页面不存在返回 404。级联删除由数据库层处理
 * @pathParams PagesParams
 * @response 200:SuccessResponse:删除成功
 * @response 401:ErrorResponse:未登录
 * @response 403:ErrorResponse:无权限（非页面作者）
 * @response 404:ErrorResponse:页面不存在
 * @responseSet auth
 * @auth bearer
 * @tag Pages
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request)
    const { id } = await params

    // Verify the page exists and belongs to the current user
    const page = await db.query.publishedPages.findFirst({
      where: eq(publishedPages.id, id),
    })

    if (!page) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Page not found" } },
        { status: 404 }
      )
    }

    if (page.userId !== session.userId) {
      // Allow team members to manage team-owned pages
      const { users: u, teamMembers: tm } = await import("@/lib/db")
      const owner = await db.query.users.findFirst({
        where: eq(u.id, page.userId),
        columns: { type: true },
      })
      if (owner?.type === "team") {
        const membership = await db.query.teamMembers.findFirst({
          where: and(eq(tm.teamId, page.userId), eq(tm.userId, session.userId)),
          columns: { role: true },
        })
        if (!membership) {
          return NextResponse.json(
            { error: { code: "forbidden", message: "You can only delete your own pages" } },
            { status: 403 }
          )
        }
      } else {
        return NextResponse.json(
          { error: { code: "forbidden", message: "You can only delete your own pages" } },
          { status: 403 }
        )
      }
    }

    // 删除前扣减用户 pageCount（仅公开且已审核的页面才计入）
    if (page.visibility === "public" && page.moderationStatus === "approved") {
      await db
        .update(users)
        .set({ pageCount: sql`GREATEST(COALESCE(${users.pageCount}, 0) - 1, 0)` })
        .where(eq(users.id, page.userId));
    }

    // Delete the page (cascading deletes are handled at the DB level)
    await db.delete(publishedPages).where(eq(publishedPages.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: { code: "unauthorized", message: error.message } },
        { status: 401 }
      )
    }
    console.error("Failed to delete page:", error)
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to delete page" } },
      { status: 500 }
    )
  }
}
