import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { and, eq } from "drizzle-orm"
import { db, publishedPages } from "@/lib/db"
import { ensurePublishedPagesTable } from "@/lib/db/published-pages"
import { requireAuth, AuthError } from "@/lib/auth/middleware"

function getErrorDetails(error: unknown): string | undefined {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error)
  } catch {
    return undefined
  }
}

/**
 * 保存页面 SEO 设置
 * @summary 保存页面 SEO 配置
 * @description 保存已发布页面的 SEO 设置（标题、描述、关键词）及可发现性（is_discoverable），需登录。仅更新提供的字段，无字段更新时返回 400
 * @body PagesSettingsBody
 * @response 200:SuccessResponse:保存成功
 * @response 400:ErrorResponse:缺少 uid 或无字段更新
 * @response 404:ErrorResponse:页面不存在
 * @responseSet auth
 * @auth bearer
 * @tag Pages
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    const body = await request.json()

    const { uid, seo_title, seo_description, seo_keywords, is_discoverable } = body

    if (typeof uid !== "string" || !uid.trim()) {
      return NextResponse.json(
        { success: false, error: "uid is required" },
        { status: 400 },
      )
    }

    await ensurePublishedPagesTable()

    const { findEditablePage } = await import("@/lib/db/page-auth")
    const page = await findEditablePage(uid, session.userId)

    if (!page) {
      return NextResponse.json(
        { success: false, error: "Published page not found" },
        { status: 404 },
      )
    }

    const updates: Record<string, unknown> = {}

    if (seo_title !== undefined) {
      updates.seoTitle = typeof seo_title === "string" ? seo_title : null
    }
    if (seo_description !== undefined) {
      updates.seoDescription = typeof seo_description === "string" ? seo_description : null
    }
    if (seo_keywords !== undefined) {
      updates.seoKeywords = typeof seo_keywords === "string" ? seo_keywords : null
    }
    if (is_discoverable !== undefined) {
      updates.isDiscoverable = Boolean(is_discoverable)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 },
      )
    }

    await db
      .update(publishedPages)
      .set(updates)
      .where(
        and(
          eq(publishedPages.userId, page.userId),
          eq(publishedPages.uid, uid),
        ),
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("Page settings error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save page settings",
        details: getErrorDetails(error),
      },
      { status: 500 },
    )
  }
}
