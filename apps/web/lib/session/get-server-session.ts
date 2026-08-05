import { cache } from "react";
import { getSession } from "@/lib/auth/cookies";
import type { Session } from "./types";

export const getServerSession = cache(
  async (): Promise<Session | undefined> => {
    const vibenSession = await getSession();

    if (!vibenSession) {
      return undefined;
    }

    // Map viben session → open-agents compatible Session format
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
  },
);
