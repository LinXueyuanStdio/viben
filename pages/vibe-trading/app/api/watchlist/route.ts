import { NextRequest, NextResponse } from "next/server";
import { listWatchlists, createWatchlist } from "@/lib/watchlist-store";

export async function GET(req: NextRequest) {
  const workspacePath = req.nextUrl.searchParams.get("workspace_path") || undefined;
  const lists = await listWatchlists(workspacePath);
  return NextResponse.json({ lists });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { name: string; color?: string; refresh_interval?: number; refresh_prompt?: string; workspace_path?: string };
  const { workspace_path, ...params } = body;
  const list = await createWatchlist(params, workspace_path);
  return NextResponse.json({ list }, { status: 201 });
}
