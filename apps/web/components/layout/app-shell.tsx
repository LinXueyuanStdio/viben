"use client"

import * as React from "react"
import { createContext, useContext } from "react"
import { usePathname } from "next/navigation"
import { Topbar } from "./topbar"
import { Sidebar } from "./sidebar"
import { cn } from "@/lib/utils/index"
import type { Session } from "@/lib/auth/types"

// ===== AppShell Context =====
interface AppShellContextType {
  session: Session | null
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

const AppShellContext = createContext<AppShellContextType>({
  session: null,
  sidebarCollapsed: false,
  toggleSidebar: () => {},
})

export function useAppShell() {
  return useContext(AppShellContext)
}

// ===== AppShell Component =====
interface AppShellProps {
  children: React.ReactNode
  session: Session | null
  adminStats?: { pendingPackagesCount: number }
  // NavPopover + GlobalSearch 数据
  notificationItems?: Array<{ title: string; subtitle: string; href: string; thumb: string }>
  historyItems?: Array<{ title: string; subtitle: string; href: string; thumb: string }>
  hotSearches?: Array<{ query: string; count: number }>
  recentSearches?: string[]
}

export function AppShell({
  children,
  session,
  adminStats,
  notificationItems = [],
  historyItems = [],
  hotSearches = [],
  recentSearches = [],
}: AppShellProps) {
  const pathname = usePathname()
  const isRead = pathname.startsWith("/read/")

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("viben-sidebar-collapsed") === "true"
  })

  const toggleSidebar = React.useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem("viben-sidebar-collapsed", String(next))
      return next
    })
  }, [])

  const contextValue = React.useMemo<AppShellContextType>(
    () => ({ session, sidebarCollapsed, toggleSidebar }),
    [session, sidebarCollapsed, toggleSidebar]
  )

  return (
    <AppShellContext.Provider value={contextValue}>
      <div className="flex h-screen flex-col overflow-hidden">
        <Topbar
          session={session}
          onToggleSidebar={toggleSidebar}
          notificationItems={notificationItems}
          historyItems={historyItems}
          hotSearches={hotSearches}
          recentSearches={recentSearches}
        />
        <div className="flex flex-1 overflow-hidden">
          {!isRead && (
            <Sidebar
              collapsed={sidebarCollapsed}
              session={session}
              pendingPackagesCount={adminStats?.pendingPackagesCount}
            />
          )}
          <main className={cn("flex-1", isRead ? "overflow-hidden" : "overflow-y-auto")}>
            <div className={cn(isRead ? "p-0 max-w-none" : "w-[min(1280px,100%)] mx-auto px-4 py-4")}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </AppShellContext.Provider>
  )
}
