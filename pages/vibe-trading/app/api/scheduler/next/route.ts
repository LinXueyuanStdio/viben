import { getNextCycleAt, isAutoTradingActive } from "@/lib/scheduler";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }
  const nextCycleAt = getNextCycleAt(sessionId);
  const active = isAutoTradingActive(sessionId);
  return NextResponse.json({ next_cycle_at: nextCycleAt, active });
}
