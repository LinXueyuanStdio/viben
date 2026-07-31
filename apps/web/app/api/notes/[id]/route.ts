import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { AuthError, requireAuth } from "@/lib/auth/middleware"
import { db } from "@/lib/db"
import { notes } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { NoteParams, NoteUpdateBody } from "@/lib/validations/notes"

/**
 * 更新笔记
 * @summary 更新笔记内容
 * @description 更新指定笔记的 markdown 内容，仅笔记作者可操作。找不到笔记或非作者操作时返回 404。成功返回 { note: NoteResponse }
 * @pathParams NoteParams — 笔记 ID
 * @body NoteUpdateBody
 * @response 200:NoteWrapperResponse:更新成功，返回更新后的笔记（note 字段包裹）
 * @response 400:ErrorResponse:content 为空
 * @response 401:ErrorResponse:未登录
 * @response 404:ErrorResponse:笔记不存在或无权操作
 * @responseSet auth
 * @auth bearer
 * @tag Notes
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let session
  try {
    session = await requireAuth(request)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { content } = body

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "missing_content" }, { status: 400 })
    }

    const [updated] = await db
      .update(notes)
      .set({ content: content.trim(), updatedAt: new Date() })
      .where(and(
        eq(notes.id, id),
        eq(notes.authorUserId, session.userId)
      ))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }

    return NextResponse.json({ note: updated })
  } catch (error) {
    console.error("Note update failed:", error)
    return NextResponse.json({ error: "update_failed" }, { status: 500 })
  }
}

/**
 * 删除笔记
 * @summary 删除笔记
 * @description 删除指定笔记，仅笔记作者可操作。找不到笔记或非作者操作时返回 404。成功返回 204 No Content（无响应体）
 * @pathParams NoteParams — 笔记 ID
 * @response 204
 * @response 401:ErrorResponse:未登录
 * @response 404:ErrorResponse:笔记不存在或无权操作
 * @responseSet auth
 * @auth bearer
 * @tag Notes
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let session
  try {
    session = await requireAuth(request)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const [deleted] = await db
      .delete(notes)
      .where(and(
        eq(notes.id, id),
        eq(notes.authorUserId, session.userId)
      ))
      .returning({ id: notes.id })

    if (!deleted) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Note delete failed:", error)
    return NextResponse.json({ error: "delete_failed" }, { status: 500 })
  }
}
