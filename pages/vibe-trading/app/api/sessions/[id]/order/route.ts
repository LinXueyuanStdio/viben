import { executeOrder } from "@/lib/order";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const result = await executeOrder(id, {
    symbol: body.symbol,
    side: body.side,
    type: body.type ?? "market",
    quantity: body.quantity,
    price: body.price,
    source: body.source ?? "agent",
  });
  return NextResponse.json(result);
}
