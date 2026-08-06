"use client";

import useSWR from "swr";

interface SessionUser {
  id: string;
  username: string;
  userSlug: string;
  email: string;
  displayName?: string;
  role?: string;
  avatarUrl?: string | null;
}

interface AuthInfo {
  user?: SessionUser;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** 客户端会话 hook — 不阻塞渲染，SWR 在后台获取 */
export function useAuthSession() {
  const { data, isLoading } = useSWR<AuthInfo>("/api/auth/info", fetcher, {
    revalidateOnFocus: true,
    // 初始时用缓存避免不必要的请求
    dedupingInterval: 2000,
  });

  return {
    user: data?.user ?? null,
    loading: isLoading,
    isAuthenticated: !!data?.user,
  };
}
