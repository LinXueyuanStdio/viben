"use client"

import dynamic from "next/dynamic"

const AppShellWrapper = dynamic(
  () => import("@/components/layout/app-shell-wrapper").then(m => ({ default: m.AppShellWrapper })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen flex-col">
        {/* Topbar skeleton — 匹配新的 header 布局（左侧汉堡+面包屑，居中 tabs，右侧操作按钮） */}
        <header className="h-[var(--nav-h)] border-b bg-card/50 flex items-center px-3 gap-3 animate-pulse">
          {/* 汉堡按钮 */}
          <div className="size-9 rounded-lg bg-muted shrink-0" />
          {/* 面包屑 */}
          <div className="h-5 w-20 rounded bg-muted shrink-0 hidden sm:block" />
          {/* 居中 tabs 占位（flex-1 填充） */}
          <div className="flex-1 flex items-center justify-center gap-2">
            <div className="h-7 w-14 rounded bg-muted" />
            <div className="h-7 w-14 rounded bg-muted" />
            <div className="h-7 w-14 rounded bg-muted" />
            <div className="h-7 w-14 rounded bg-muted hidden sm:block" />
            <div className="h-7 w-14 rounded bg-muted hidden sm:block" />
          </div>
          {/* 右侧按钮占位（搜索 + 创建 + 头像） */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <div className="size-9 rounded-lg bg-muted" />
            <div className="size-9 rounded-lg bg-muted" />
            <div className="size-8 rounded-full bg-muted" />
          </div>
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
