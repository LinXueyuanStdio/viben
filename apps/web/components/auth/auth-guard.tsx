"use client";

import { useRef } from "react";
import { redirect, usePathname } from "next/navigation";
import { useAuthSession } from "@/hooks/use-auth-session";

interface AuthGuardProps {
  children: React.ReactNode;
  /** 加载中时显示的骨架屏 */
  loadingFallback: React.ReactNode;
}

/** 客户端认证守卫 — 等待 session 时不阻塞渲染，立即显示骨架屏 */
export function AuthGuard({ children, loadingFallback }: AuthGuardProps) {
  const { loading, isAuthenticated } = useAuthSession();
  const pathname = usePathname();
  // 记录是否已完成初始加载，防止 SWR 重验证时误触发 redirect
  const initialLoadDone = useRef(false);

  // 首次加载完成时标记
  if (!loading) {
    initialLoadDone.current = true;
  }

  // 仅在初始加载完成且确实未认证时才重定向
  // SWR 重验证期间的短暂未认证状态不会触发 redirect
  if (!isAuthenticated && initialLoadDone.current) {
    const loginParams = new URLSearchParams();
    loginParams.set("redirect", pathname);
    redirect(`/login?${loginParams.toString()}`);
  }

  if (!isAuthenticated) {
    return <>{loadingFallback}</>;
  }

  return <>{children}</>;
}
