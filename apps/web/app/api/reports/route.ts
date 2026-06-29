import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { AuthError, requireAuth } from "@/lib/auth/middleware"
import { db } from "@/lib/db"
import { reports } from "@/lib/db/schema"

const VALID_REASONS = ["spam", "inappropriate", "copyright", "security", "other"]

export async function POST(request: NextRequest) {
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
    const { entity_type, entity_id, reason, description } = body

    if (!entity_type || !entity_id) {
      return NextResponse.json({ error: "missing_entity" }, { status: 400 })
    }

    if (!VALID_REASONS.includes(reason)) {
      return NextResponse.json({ error: "invalid_reason" }, { status: 400 })
    }

    const [report] = await db
      .insert(reports)
      .values({
        entityType: entity_type,
        entityId: entity_id,
        reporterId: session.userId,
        reason,
        description: typeof description === "string" ? description.slice(0, 500) : null,
        status: "pending",
      })
      .returning({ id: reports.id, status: reports.status })

    return NextResponse.json({ id: report.id, status: report.status })
  } catch (error) {
    console.error("Report creation failed:", error)
    return NextResponse.json({ error: "report_failed" }, { status: 500 })
  }
}
