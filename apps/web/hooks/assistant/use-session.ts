"use client";

import useSWR from "swr";
import type { SessionUserInfo } from "@/lib/session/types";
import { fetcher } from "@/lib/swr";

interface VibenUserResponse {
  user: {
    id: string;
    username: string;
    userSlug: string;
    displayName?: string;
    email: string;
    avatarUrl?: string;
    role: string;
  };
}

export function useSession() {
  const { data, isLoading } = useSWR<VibenUserResponse>(
    "/api/users/me",
    fetcher,
    {
      revalidateOnFocus: true,
    },
  );

  const vibenUser = data?.user;

  // Map viben user → open-agents SessionUserInfo format
  const sessionInfo: SessionUserInfo | undefined = vibenUser
    ? {
        user: {
          id: vibenUser.id,
          username: vibenUser.username,
          email: vibenUser.email ?? undefined,
          avatar: vibenUser.avatarUrl ?? "",
          name: vibenUser.displayName,
        },
        authProvider: "vercel",
        isAdmin: vibenUser.role === "admin" || vibenUser.role === "super_admin",
      }
    : undefined;

  return {
    session: data ? sessionInfo ?? null : null,
    loading: isLoading,
    isAuthenticated: !!sessionInfo?.user,
    isAdmin: sessionInfo?.isAdmin ?? false,
    hasGitHub: false,
    hasGitHubAccount: false,
    hasGitHubInstallations: false,
  };
}
