import { NextRequest, NextResponse } from "next/server";
import type { WatchlistConfig } from "@/lib/types";
import { getWatchlist, updateWatchlist, deleteWatchlist, addSymbols, removeSymbols, setAnnotation } from "@/lib/watchlist-store";

export async function GET(req: NextRequest, { params }: { params: Promise<{ list_id: string }> }) {
  const { list_id } = await params;
  const workspacePath = req.nextUrl.searchParams.get("workspace_path") || undefined;
  const list = await getWatchlist(list_id, workspacePath);
  if (!list) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ list });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ list_id: string }> }) {
  const { list_id } = await params;
  const body = await req.json() as Record<string, unknown>;
  const workspacePath = (body.workspace_path as string) || undefined;

  if (body.action === "add_symbols") {
    const result = await addSymbols(list_id, body.symbols as string[], workspacePath);
    if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ list: result });
  }

  if (body.action === "remove_symbols") {
    const result = await removeSymbols(list_id, body.symbols as string[], workspacePath);
    if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ list: result });
  }

  if (body.action === "set_annotation") {
    const ok = await setAnnotation(list_id, body.symbol as string, body.annotation as string, workspacePath);
    if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  const { action, workspace_path: _wp, symbols, symbol, annotation, ...updates } = body;
  const result = await updateWatchlist(list_id, updates as Partial<Pick<WatchlistConfig, "name" | "color" | "refresh_interval" | "refresh_prompt" | "column_config">>, workspacePath);
  if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ list: result });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ list_id: string }> }) {
  const { list_id } = await params;
  const workspacePath = req.nextUrl.searchParams.get("workspace_path") || undefined;
  const ok = await deleteWatchlist(list_id, workspacePath);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
