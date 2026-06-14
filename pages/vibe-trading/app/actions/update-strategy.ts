"use server";

import { appendEvent } from "@/lib/session-store";
import { revalidatePath } from "next/cache";
import type { ConfigUpdateEvent } from "@/lib/types";

export async function updateStrategyConfig(
  sessionId: string,
  updates: Record<string, unknown>
) {
  for (const [field, newValue] of Object.entries(updates)) {
    const event: ConfigUpdateEvent = {
      type: "config_update",
      ts: new Date().toISOString(),
      field,
      old_value: null,
      new_value: newValue,
      reason: "user_manual",
    };
    await appendEvent(sessionId, event);
  }
  revalidatePath("/");
}
