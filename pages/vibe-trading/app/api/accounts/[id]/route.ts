import { removeAccount } from "@/lib/account-store";
import { NextResponse } from "next/server";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const success = await removeAccount(id);
  return NextResponse.json({ success });
}
