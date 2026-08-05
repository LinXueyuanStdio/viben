import type { NextRequest } from "next/server";
import type { Session } from "./types";
import { getSession } from "@/lib/auth/cookies";

export async function getSessionFromReq(
  _req: NextRequest,
): Promise<Session | undefined> {
  const vibenSession = await getSession();

  if (!vibenSession) {
    return undefined;
  }

  return {
    created: Date.now(),
    authProvider: "vercel",
    user: {
      id: vibenSession.userId,
      username: vibenSession.username,
      email: vibenSession.email ?? undefined,
      avatar: vibenSession.avatarUrl ?? "",
      name: vibenSession.displayName,
    },
  };
}
