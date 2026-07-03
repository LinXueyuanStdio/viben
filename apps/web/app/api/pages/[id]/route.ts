import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { db, publishedPages } from "@/lib/db"
import { requireAuth, AuthError } from "@/lib/auth/middleware"
import { eq } from "drizzle-orm"

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
      return NextResponse.json(
        { error: { code: "forbidden", message: "You can only delete your own pages" } },
        { status: 403 }
      )
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
