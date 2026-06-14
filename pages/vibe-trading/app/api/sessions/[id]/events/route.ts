import { readEventsFrom, appendEvent, countLines } from "@/lib/session-store";
import { NextResponse } from "next/server";
import type { SessionEvent } from "@/lib/types";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const fromLine = parseInt(url.searchParams.get("from_line") ?? "0");
  const events = await readEventsFrom(id, fromLine);
  const total = await countLines(id);
  return NextResponse.json({ events, total_lines: total });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = (await req.json()) as SessionEvent;
  await appendEvent(id, event);
  return NextResponse.json({ ok: true });
}
