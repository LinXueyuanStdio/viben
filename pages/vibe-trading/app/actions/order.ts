"use server";

import { executeOrder } from "@/lib/order";
import { revalidatePath } from "next/cache";

export async function submitOrder(sessionId: string, formData: FormData) {
  const symbol = formData.get("symbol") as string;
  const side = formData.get("side") as "buy" | "sell";
  const type = formData.get("type") as "market" | "limit";
  const quantity = parseFloat(formData.get("quantity") as string);
  const priceStr = formData.get("price") as string | null;
  const price = priceStr ? parseFloat(priceStr) : undefined;

  const result = await executeOrder(sessionId, {
    symbol,
    side,
    type,
    quantity,
    price,
    source: "manual",
  });

  revalidatePath("/");
  return result;
}
