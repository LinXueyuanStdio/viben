import { computeLeaderboard } from "@/lib/leaderboard";
import { NextResponse } from "next/server";

export async function GET() {
  const entries = await computeLeaderboard();
  return NextResponse.json({ entries });
}
