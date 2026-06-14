import { restoreSessionState } from "@/lib/state-machine";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = await restoreSessionState(id);
  return NextResponse.json(state);
}
