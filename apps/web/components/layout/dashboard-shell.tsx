"use client"

import dynamic from "next/dynamic"

const AppShellWrapper = dynamic(
  () => import("@/components/layout/app-shell-wrapper").then(m => ({ default: m.AppShellWrapper })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen">
        {/* Sidebar skeleton */}
        <aside className="hidden w-[240px] shrink-0 border-r bg-card lg:block animate-pulse">
          <div className="flex h-full flex-col gap-3 p-4">
            <div className="h-7 w-28 rounded bg-muted" />
            <div className="space-y-2 mt-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-9 w-full rounded-lg bg-muted" />
              ))}
            </div>
          </div>
        </aside>
        {/* Main content skeleton */}
        <main className="flex flex-1 flex-col">
          <header className="h-14 border-b bg-card/50 flex items-center px-4 gap-3 animate-pulse">
            <div className="size-8 rounded-full bg-muted ml-auto" />
            <div className="h-4 w-24 rounded bg-muted" />
          </header>
          <div className="flex-1 overflow-auto p-4">
            <div className="h-6 w-48 rounded bg-muted animate-pulse" />
          </div>
        </main>
      </div>
    ),
  }
)

export function DashboardShell({ children, isLoggedIn }: { children: React.ReactNode; isLoggedIn?: boolean }) {
  return <AppShellWrapper isLoggedIn={isLoggedIn}>{children}</AppShellWrapper>
}
