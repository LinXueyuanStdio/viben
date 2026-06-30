import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { AuthError, requireAuth } from "@/lib/auth/middleware"
import { db } from "@/lib/db"
import { notes } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

// PATCH /api/notes/[id]
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

// DELETE /api/notes/[id]
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
