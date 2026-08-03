"use client"

import dynamic from "next/dynamic"

const AppShellWrapper = dynamic(
  () => import("@/components/layout/app-shell-wrapper").then(m => ({ default: m.AppShellWrapper })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen flex-col">
        {/* Topbar skeleton — 匹配移动端响应式布局 */}
        <header className="h-[var(--nav-h)] border-b bg-card/50 flex items-center px-3 gap-3 animate-pulse">
          {/* 汉堡按钮 */}
          <div className="size-9 rounded-lg bg-muted shrink-0" />
          {/* 搜索框（flex-1 填充） */}
          <div className="h-9 flex-1 rounded-[10px] bg-muted" />
          {/* 用户头像 */}
          <div className="size-8 rounded-full bg-muted shrink-0 ml-auto" />
        </header>
        {/* Main content — 全宽（侧边栏已是 fixed overlay 不占位） */}
        <main className="flex-1 overflow-auto p-4">
          <div className="h-6 w-48 rounded bg-muted animate-pulse" />
        </main>
      </div>
    ),
  }
)

export function DashboardShell({ children, isLoggedIn }: { children: React.ReactNode; isLoggedIn?: boolean }) {
  return <AppShellWrapper isLoggedIn={isLoggedIn}>{children}</AppShellWrapper>
}
