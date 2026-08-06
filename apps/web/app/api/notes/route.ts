import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import { NotesListQuery, NoteCreateBody } from "@/lib/validations/notes";

/**
 * 获取笔记列表
 * @summary 获取页面笔记列表
 * @description 获取当前用户在某页面下的所有笔记，按置顶优先、创建时间倒序排列。需要 page_id 查询参数指定页面。需登录，仅返回当前用户的笔记。响应为 { notes: NoteResponse[] }
 * @params NotesListQuery — page_id（必填）指定页面
 * @response 200:NoteListResponse:笔记列表
 * @response 400:ErrorResponse:缺少 page_id 参数
 * @response 401:ErrorResponse:未登录
 * @responseSet auth
 * @auth bearer
 * @tag Notes
 */
export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireAuth(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entity_type") ?? "published_page";
  const entityId = searchParams.get("entity_id") ?? searchParams.get("page_id");
  if (!entityId) {
    return NextResponse.json({ error: "missing_entity_id" }, { status: 400 });
  }

  const results = await db
    .select()
    .from(notes)
    .where(and(
      eq(notes.entityType, entityType),
      eq(notes.entityId, entityId),
      eq(notes.authorUserId, session.userId)
    ))
    .orderBy(desc(notes.isPinned), desc(notes.createdAt));

  return NextResponse.json({ notes: results });
}

/**
 * 创建笔记
 * @summary 创建新笔记
 * @description 在指定页面下创建一条新笔记，需登录。内容为 markdown 格式，生成 note_ 前缀的唯一 ID。成功返回 201，响应体为 { note: NoteResponse }
 * @body NoteCreateBody
 * @response 201:NoteWrapperResponse:创建成功，返回新笔记（note 字段包裹）
 * @response 400:ErrorResponse:缺少 page_id 或 content 为空
 * @response 401:ErrorResponse:未登录
 * @responseSet auth
 * @auth bearer
 * @tag Notes
 */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAuth(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const entityType = body.entity_type ?? "published_page";
    const entityId = body.entity_id ?? body.page_id;
    const { content } = body;

    if (!entityId) {
      return NextResponse.json({ error: "missing_entity_id" }, { status: 400 });
    }

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "missing_content" }, { status: 400 });
    }

    const uid = `note_${crypto.randomUUID().slice(0, 12)}`;

    const [note] = await db
      .insert(notes)
      .values({
        uid,
        pageId: entityId,
        entityType: entityType,
        entityId: entityId,
        authorUserId: session.userId,
        content: content.trim(),
        contentFormat: "markdown",
      })
      .returning();

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Note create failed:", error);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
