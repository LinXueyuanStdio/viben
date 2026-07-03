"use client"

import * as React from "react"
import { createContext, useContext } from "react"
import { usePathname } from "next/navigation"
import { Topbar } from "./topbar"
import { Sidebar } from "./sidebar"
import { DrawerProvider } from "./drawer-context"
import { isPublishedPageRoute } from "@/lib/navigation/page-route"
import { cn } from "@/lib/utils/index"
import type { Session } from "@/lib/auth/types"

// ===== AppShell Context =====
interface AppShellContextType {
  session: Session | null
  // desktop
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  // mobile
  isMobile: boolean
  sidebarOpen: boolean
  openSidebar: () => void
  closeSidebar: () => void
}

const AppShellContext = createContext<AppShellContextType>({
  session: null,
  sidebarCollapsed: false,
  toggleSidebar: () => {},
  isMobile: false,
  sidebarOpen: false,
  openSidebar: () => {},
  closeSidebar: () => {},
})

export function useAppShell() {
  return useContext(AppShellContext)
}

// ===== AppShell Component =====
interface AppShellProps {
  children: React.ReactNode
  session: Session | null
  adminStats?: { pendingPackagesCount: number }
}

export function AppShell({
  children,
  session,
  adminStats,
}: AppShellProps) {
  const pathname = usePathname()
  const { isPage: isRead } = isPublishedPageRoute(pathname)

  // ---- isMobile ----
  const [isMobile, setIsMobile] = React.useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(max-width: 767px)").matches
  })

  React.useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)")
    const handle = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener("change", handle)
    return () => mql.removeEventListener("change", handle)
  }, [])

  // ---- desktop sidebar ----
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("viben-sidebar-collapsed") === "true"
  })

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) return // mobile uses open/close, not toggle
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem("viben-sidebar-collapsed", String(next))
      return next
    })
  }, [isMobile])

  // ---- mobile sidebar overlay ----
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const openSidebar = React.useCallback(() => setSidebarOpen(true), [])
  const closeSidebar = React.useCallback(() => setSidebarOpen(false), [])

  // Close mobile sidebar on route change
  React.useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const contextValue = React.useMemo<AppShellContextType>(
    () => ({
      session,
      sidebarCollapsed,
      toggleSidebar,
      isMobile,
      sidebarOpen,
      openSidebar,
      closeSidebar,
    }),
    [session, sidebarCollapsed, toggleSidebar, isMobile, sidebarOpen, openSidebar, closeSidebar]
  )

  // Determine sidebar visibility for desktop/mobile
  const showDesktopSidebar = !isMobile && !sidebarCollapsed
  const showMobileSidebar = isMobile && sidebarOpen

  return (
    <AppShellContext.Provider value={contextValue}>
      <DrawerProvider>
        <div className="flex h-screen flex-col overflow-hidden">
          <Topbar
            session={session}
            onToggleSidebar={toggleSidebar}
            sidebarCollapsed={sidebarCollapsed}
            isMobile={isMobile}
            onOpenSidebar={openSidebar}
          />
          <div className="relative flex-1 overflow-hidden">
            {/* Sidebar — always fixed overlay */}
            <Sidebar
              collapsed={sidebarCollapsed}
              session={session}
              pendingPackagesCount={adminStats?.pendingPackagesCount}
              isMobile={isMobile}
              open={sidebarOpen}
              onClose={closeSidebar}
            />
            {/* Backdrop for mobile overlay (desktop never shows backdrop) */}
            {isMobile && sidebarOpen && (
              <div
                className="fixed inset-0 z-40 bg-black/40"
                onClick={closeSidebar}
                aria-hidden="true"
              />
            )}
            <main
              className={cn(
                "h-full",
                isRead ? "overflow-hidden" : "overflow-y-auto"
              )}
            >
              <div
                className={cn(
                  isRead
                    ? "p-0 max-w-none"
                    : "w-[min(1280px,100%)] mx-auto px-4 py-4"
                )}
              >
                {children}
              </div>
            </main>
          </div>
        </div>
      </DrawerProvider>
    </AppShellContext.Provider>
  )
}
