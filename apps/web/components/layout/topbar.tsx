"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Bell, Clock, PanelRight, Maximize2, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils/index"
import { getTopbarMode } from "./topbar-mode"
import { BreadcrumbNav } from "./breadcrumb"
import { GlobalSearch } from "./global-search"
import { NavPopover } from "./nav-popover"
import { IconButton } from "@/components/ui/icon-button"
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from "@/components/ui/viben-tabs"
import { UserMenu } from "./user-menu"
import { HeaderAuthButtons } from "./header-auth-buttons"
import { ThemeToggle } from "./theme-toggle"
import { LanguageSwitcher } from "./language-switcher"
import type { Session } from "@/lib/auth/types"

interface TopbarProps {
  session: Session | null
  onToggleSidebar: () => void
  // NavPopover + GlobalSearch 数据
  notificationItems?: Array<{ title: string; subtitle: string; href: string; thumb: string }>
  historyItems?: Array<{ title: string; subtitle: string; href: string; thumb: string }>
  hotSearches?: Array<{ query: string; count: number }>
  recentSearches?: string[]
}

export function Topbar({
  session,
  onToggleSidebar,
  notificationItems = [],
  historyItems = [],
  hotSearches = [],
  recentSearches = [],
}: TopbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = getTopbarMode(pathname)
  const isRead = mode === "read"

  const [immersive, setImmersive] = React.useState(false)

  const toggleDrawer = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (params.get("drawer") === "open") {
      params.delete("drawer")
    } else {
      params.set("drawer", "open")
    }
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : pathname, { scroll: false })
  }, [searchParams, router, pathname])

  // Escape 键退出沉浸模式
  React.useEffect(() => {
    if (!immersive) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImmersive(false)
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [immersive])

  if (mode === "landing") return null

  return (
    <header
      className={cn(
        "top-0 z-50 h-[var(--nav-h)] border-b border-border transition-transform duration-[220ms] ease-out",
        isRead
          ? "fixed left-0 right-0 bg-background/68 backdrop-blur-[18px] saturate-[1.18] border-border/52"
          : "sticky bg-background/88 backdrop-blur-[14px]",
        immersive && "-translate-y-full"
      )}
    >
      <div
        className={cn(
          "relative h-full mx-auto flex items-center",
          isRead
            ? "w-full px-4 grid gap-3"
            : "w-[min(1280px,calc(100%-28px))] grid gap-3"
        )}
        style={{
          gridTemplateColumns: isRead
            ? "minmax(430px, 1.45fr) minmax(160px, 260px) auto"
            : "minmax(180px, 1fr) minmax(260px, 520px) minmax(180px, 1fr)",
        }}
      >
        {/* ===== Left ===== */}
        <div className="flex items-center gap-2 min-w-0">
          {/* 侧边栏切换按钮 */}
          <IconButton size="compact" label="切换侧边栏" onClick={onToggleSidebar}>
            <svg className="h-[18px] w-[18px]" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 4h12M3 9h12M3 14h12" />
            </svg>
          </IconButton>

          {/* 品牌 Logo（default 模式） */}
          {!isRead && (
            <span className="inline-flex items-center gap-2 shrink-0">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-linear-to-br from-primary to-accent text-white shadow-sm">
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0L16 8L8 16L0 8Z" />
                </svg>
              </span>
              <span className="font-bold text-foreground font-[Lexend]">Viben</span>
            </span>
          )}

          {/* 面包屑 */}
          <BreadcrumbNav variant={isRead ? "read" : "global"} />
        </div>

        {/* ===== Center ===== */}
        <div
          className={cn(
            "flex items-center",
            isRead
              ? "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-2 pointer-events-none w-max"
              : "justify-center min-w-0"
          )}
        >
          {isRead ? (
            <div className="pointer-events-auto">
              <VibenTabs defaultValue="page">
                <VibenTabsList variant="pill">
                  <VibenTabsTrigger value="page" variant="pill">📄 页面</VibenTabsTrigger>
                  <VibenTabsTrigger value="side" variant="pill">📋 副页</VibenTabsTrigger>
                </VibenTabsList>
              </VibenTabs>
            </div>
          ) : (
            <GlobalSearch
              recentSearches={recentSearches}
              hotSearches={hotSearches}
            />
          )}
        </div>

        {/* ===== Right ===== */}
        <div className="flex items-center justify-end gap-1.5 min-w-0">
          {isRead ? (
            <>
              {/* 阅读模式操作 */}
              <IconButton size="default" label="展开详情侧栏" onClick={toggleDrawer}>
                <PanelRight className="h-[18px] w-[18px]" />
              </IconButton>
              <IconButton size="default" label="沉浸式阅读" onClick={() => setImmersive(true)}>
                <Maximize2 className="h-[18px] w-[18px]" />
              </IconButton>
              <ReadMoreMenu />
            </>
          ) : (
            <>
              {/* 默认模式操作 */}
              <LanguageSwitcher />
              <ThemeToggle />
              {session ? (
                <>
                  <NavPopover
                    icon={Bell}
                    label="通知"
                    badge={2}
                    title="动态"
                    items={notificationItems}
                    moreLabel="加载更多动态"
                  />
                  <NavPopover
                    icon={Clock}
                    label="浏览历史"
                    title="最近阅读"
                    items={historyItems}
                    moreLabel="查看全部历史"
                  />
                  <UserMenu session={session} />
                </>
              ) : (
                <HeaderAuthButtons />
              )}
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function ReadMoreMenu() {
  const [open, setOpen] = React.useState(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <IconButton size="default" label="更多操作">
        <MoreHorizontal className="h-[18px] w-[18px]" />
      </IconButton>
      {open && (
        <div className="absolute top-full right-0 z-70 w-[min(180px,calc(100vw-28px))] grid gap-1 p-1.5 rounded-xl border border-border bg-popover/98 backdrop-blur-[14px] shadow-md">
          <button className="grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2.5 text-left font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground">
            🚩 举报
          </button>
          <button className="grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2.5 text-left font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground">
            💬 反馈
          </button>
        </div>
      )}
    </div>
  )
}
