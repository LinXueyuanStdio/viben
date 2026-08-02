"use client"

import * as React from "react"
import { createContext, useContext } from "react"
import { usePathname } from "next/navigation"
import { Topbar } from "./topbar"
import { Sidebar } from "./sidebar"
import { DrawerProvider, useDrawer } from "./drawer-context"
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

// ===== Body (inner content with drawer context access) =====

function Body({
  children,
  desktopSidebarVisible,
  isRead,
  isMobile,
  session,
  adminStats,
  sidebarCollapsed,
  sidebarOpen,
  onClose,
}: {
  children: React.ReactNode
  desktopSidebarVisible: boolean
  isRead: boolean
  isMobile: boolean
  session: Session | null
  adminStats?: { pendingPackagesCount: number }
  sidebarCollapsed: boolean
  sidebarOpen: boolean
  onClose: () => void
}) {
  const { open: drawerOpen } = useDrawer()

  return (
    <div className="relative flex-1 overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        session={session}
        pendingPackagesCount={adminStats?.pendingPackagesCount}
        isMobile={isMobile}
        open={sidebarOpen}
        onClose={onClose}
      />
      {/* Drawer slot — portal target, width syncs with drawer open state */}
      <div
        id="viben-drawer-slot"
        className="absolute right-0 top-0 bottom-0 z-50 transition-[width] duration-[220ms] ease-out"
        style={{ width: drawerOpen ? "var(--drawer-w, 420px)" : 0 }}
      />

      <main
        className={cn(
          "h-full",
          "transition-[margin] duration-[220ms] ease-out",
          desktopSidebarVisible && "ml-[var(--sidebar-w)]",
          isRead && drawerOpen && "mr-[var(--drawer-w,420px)]",
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
  )
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
  // Default: collapsed. Only when user explicitly expands sidebar does localStorage store "false".
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
    if (typeof window === "undefined") return true
    return localStorage.getItem("viben-sidebar-collapsed") !== "false"
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

  // Desktop: sidebar is fixed overlay — main content needs left margin when expanded.
  // The margin transitions in sync with the sidebar's transform (both 200ms ease-out).
  const desktopSidebarVisible = !isMobile && !sidebarCollapsed

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
          <Body
            sidebarCollapsed={sidebarCollapsed}
            desktopSidebarVisible={desktopSidebarVisible}
            isRead={isRead}
            isMobile={isMobile}
            session={session}
            adminStats={adminStats}
            sidebarOpen={sidebarOpen}
            onClose={closeSidebar}
          >
            {children}
          </Body>
        </div>
      </DrawerProvider>
    </AppShellContext.Provider>
  )
}
