import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";

// GET /api/notes?page_id=xxx
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
  const pageId = searchParams.get("page_id");
  if (!pageId) {
    return NextResponse.json({ error: "missing_page_id" }, { status: 400 });
  }

  const results = await db
    .select()
    .from(notes)
    .where(and(
      eq(notes.pageId, pageId),
      eq(notes.authorUserId, session.userId)
    ))
    .orderBy(desc(notes.isPinned), desc(notes.createdAt));

  return NextResponse.json({ notes: results });
}

// POST /api/notes
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
    const { page_id, content } = body;

    if (!page_id) {
      return NextResponse.json({ error: "missing_page_id" }, { status: 400 });
    }

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "missing_content" }, { status: 400 });
    }

    const uid = `note_${crypto.randomUUID().slice(0, 12)}`;

    const [note] = await db
      .insert(notes)
      .values({
        uid,
        pageId: page_id,
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
