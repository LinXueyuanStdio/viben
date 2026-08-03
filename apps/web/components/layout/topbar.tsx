"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"
import { usePathname, useSearchParams, useRouter } from "next/navigation"
import { FileText, Columns2, PanelRight, PanelRightClose, Settings, PanelLeftOpen, PanelLeftClose } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils/index"
import { trackAnalytics } from "@/lib/analytics/track"
import { trackEngagement } from "@/lib/analytics/behavior"
import { setUserSlug } from "@/lib/analytics/behavior"
import { getTopbarMode } from "./topbar-mode"
import { isPublishedPageRoute } from "@/lib/navigation/page-route"
import { useDrawer } from "./drawer-context"
import { useAppShell } from "./app-shell"
import { useTopbarSlots } from "./topbar-slots"
import { BreadcrumbNav } from "./breadcrumb"
import { GlobalSearch } from "./global-search"
import { NotificationPopover } from "./notification-popover"
import { MomentPopover } from "./moment-popover"
import { HistoryPopover } from "./history-popover"

import { VibenTabs, VibenTabsList, VibenTabsTrigger } from "@/components/ui/viben-tabs"
import { UserMenu } from "./user-menu"
import { CreateDropdown } from "./create-dropdown"
import { HeaderAuthButtons } from "./header-auth-buttons"
import type { Session } from "@/lib/auth/types"

interface TopbarProps {
  session: Session | null
  onToggleSidebar: () => void
  sidebarCollapsed?: boolean
  isMobile?: boolean
  onOpenSidebar?: () => void
  centerContent?: React.ReactNode
  rightContent?: React.ReactNode
}

// hasSidePage: 从服务端注入的 <script id="viben-page-meta"> 同步读取
// 首次渲染时可用（服务端已在 HTML 中输出），0ms
function getPageMeta(): { hasSidePage?: boolean } | null {
  if (typeof window === "undefined") return null
  const el = document.getElementById("viben-page-meta")
  if (!el) return null
  try { return JSON.parse(el.textContent ?? "") } catch { return null }
}

export function Topbar({
  session,
  onToggleSidebar,
  sidebarCollapsed = false,
  isMobile = false,
  onOpenSidebar,
  centerContent,
  rightContent,
}: TopbarProps) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const mode = getTopbarMode(pathname)
  const { toggle: toggleDrawer, open: drawerOpen, immersive, setImmersive } = useDrawer()
  const { sidebarOpen, closeSidebar } = useAppShell()

  // URL 同步判定阅读模式（0ms，不等任何异步数据）
  const { isPage: isReadPageFromUrl, userSlug: urlUserSlug, pageId: urlPageId } =
    isPublishedPageRoute(pathname)

  const topbarSlots = useTopbarSlots()

  // isAuthor: session 未就绪时为 false，就绪后 React re-render 自动更新
  // session 由 AppShellWrapper 异步 fetch，到达后 AppShell 重渲染 → Topbar 收到新 session
  const isAuthor = isReadPageFromUrl && session?.userSlug === urlUserSlug

  const [pageMeta] = React.useState(() => getPageMeta())
  const hasSidePage = pageMeta?.hasSidePage ?? false

  // 阅读模式：仅通过 URL 判定
  const isRead = isReadPageFromUrl

  // 本地 state 优先，UI 立即响应；URL 异步同步
  const [readActiveTab, setReadActiveTab] = React.useState(() =>
    searchParams.get("tab") === "settings" ? "settings" : "page"
  )

  const handleReadTabChange = React.useCallback((value: string) => {
    setReadActiveTab(value)
    trackAnalytics("read_tab_switch", { tab: value })
    trackEngagement("tab_switch", { tab: value, page_id: urlPageId })
    if (value === "settings") {
      router.replace(`${pathname}?tab=settings`, { scroll: false })
    } else {
      router.replace(`${pathname}?tab=read`, { scroll: false })
    }
  }, [router, pathname, urlPageId])

  // 客户端按需加载搜索数据（搜索框聚焦时才请求，避免阻塞首屏渲染）
  const [lazyHotSearches, setLazyHotSearches] = React.useState<Array<{ query: string; count: number }>>([])
  const [lazyRecentSearches, setLazyRecentSearches] = React.useState<string[]>([])
  const searchDataLoadedRef = React.useRef(false)

  const loadSearchData = React.useCallback(() => {
    if (searchDataLoadedRef.current) return
    searchDataLoadedRef.current = true
    const abort = new AbortController()
    Promise.all([
      fetch("/api/search/hot?limit=8", { signal: abort.signal }).then(r => r.ok ? r.json() : []).catch(() => []),
      session
        ? fetch("/api/search/recent?limit=5", { signal: abort.signal }).then(r => r.ok ? r.json() : []).catch(() => [])
        : Promise.resolve([]),
    ]).then(([hot, recent]) => {
      setLazyHotSearches(hot)
      setLazyRecentSearches(recent)
    }).catch(() => {})
  }, [session])

  // 同步 user_slug 到行为追踪
  React.useEffect(() => {
    setUserSlug(session?.userSlug ?? null)
  }, [session?.userSlug])

  // --reader-header-safe 单一数据源（参考 index.html: updateReaderHeaderSafe）
  // 沉浸模式 → 0；非阅读模式 → 移除；阅读模式非沉浸 → 测量 header 实际高度
  React.useEffect(() => {
    const measure = () => {
      if (immersive) {
        document.documentElement.style.setProperty("--reader-header-safe", "0px")
        return
      }
      if (!isRead) {
        document.documentElement.style.removeProperty("--reader-header-safe")
        return
      }
      const h = document.querySelector("header")?.getBoundingClientRect().height
      document.documentElement.style.setProperty("--reader-header-safe", `${Math.ceil(h || 0)}px`)
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [isRead, immersive])

  // Escape 键退出沉浸模式
  React.useEffect(() => {
    if (!immersive) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setImmersive(false)
        trackAnalytics("immersive_exit")
        trackEngagement("immersive_toggle", { action: "exit", page_id: urlPageId })
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [immersive, urlPageId])

  if (mode === "landing") return null

  // 汉堡按钮状态: 桌面端 sidebarCollapsed → 汉堡; 移动端 !sidebarOpen → 汉堡
  const hamburgerClosed = isMobile ? !sidebarOpen : sidebarCollapsed

  return (
    <header
      className={cn(
        "top-0 z-50 h-[var(--nav-h)] border-b border-border transition-transform duration-[220ms] ease-out",
        isRead
          ? "fixed left-0 right-0 bg-background/68 backdrop-blur-[18px] saturate-[1.18] border-border/52"
          : "sticky bg-background/88 backdrop-blur-[14px]",
        immersive && "-translate-y-full"
      )}
      style={isRead && !isMobile ? { right: drawerOpen ? "var(--drawer-w, 420px)" : 0 } : undefined}
    >
      <div
        className={cn(
          "relative h-full mx-auto grid items-center gap-3",
          isMobile
            ? isRead ? "w-full pl-3 pr-2.5" : "w-full px-3"
            : isRead
              ? "w-full pl-4 pr-3"
              : "w-[min(1280px,calc(100%-28px))]"
        )}
        style={{
          gridTemplateColumns: isMobile
            ? "auto 1fr auto"
            : isRead
              ? "minmax(430px, 1.45fr) minmax(160px, 260px) auto"
              : "minmax(180px, 1fr) minmax(260px, 520px) minmax(180px, 1fr)",
        }}
      >
        {/* ===== Left ===== */}
        <div className="flex items-center gap-0 min-w-0">
          {/* 侧边栏切换按钮 — 动画汉堡图标（桌面+移动端共用） */}
          <button
            aria-label={t("community.toggleSidebar")}
            onClick={() => {
              if (isMobile) {
                sidebarOpen ? closeSidebar() : onOpenSidebar?.()
              } else {
                onToggleSidebar()
              }
            }}
            className="inline-flex items-center justify-center size-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors"
          >
            {hamburgerClosed ? (
              <PanelLeftOpen className="size-[18px]" />
            ) : (
              <PanelLeftClose className="size-[18px]" />
            )}
          </button>

          {/* 面包屑 — 移动端隐藏 */}
          {!isMobile && <BreadcrumbNav variant={isRead ? "read" : "global"} />}
        </div>

        {/* ===== Center ===== */}
        <div
          className={
            isRead
              ? "absolute left-1/2 -translate-x-1/2 inset-y-0 z-2 pointer-events-none w-max grid place-items-center"
              : cn("flex items-center justify-center min-w-0", isMobile ? "flex-1" : "")
          }
        >
          {isRead ? (
            topbarSlots?.centerContent ?? centerContent ?? (
              <div className="pointer-events-auto h-full">
                {/* 仅在有 sidePage 或是作者时渲染 TabList（否则只有一个 tab 不展示） */}
                {(hasSidePage || isAuthor) && (
                  <VibenTabs value={readActiveTab} onValueChange={(v) => v && handleReadTabChange(v)} className="h-full">
                    <VibenTabsList variant="underline" className="h-full">
                      <VibenTabsTrigger value="page" variant="underline">
                        <FileText className="h-4 w-4" />
                        <span className={cn("ml-1.5", isMobile && "hidden")}>{t("community.page")}</span>
                      </VibenTabsTrigger>
                      {hasSidePage && (
                        <VibenTabsTrigger value="side" variant="underline">
                          <Columns2 className="h-4 w-4" />
                          <span className={cn("ml-1.5", isMobile && "hidden")}>{t("community.sidePage")}</span>
                        </VibenTabsTrigger>
                      )}
                      {isAuthor && (
                        <VibenTabsTrigger value="settings" variant="underline">
                          <Settings className="h-4 w-4" />
                          <span className={cn("ml-1.5", isMobile && "hidden")}>{t("community.settings")}</span>
                        </VibenTabsTrigger>
                      )}
                    </VibenTabsList>
                  </VibenTabs>
                )}
              </div>
            )
          ) : (
            <GlobalSearch
              recentSearches={lazyRecentSearches}
              hotSearches={lazyHotSearches}
              onFocus={loadSearchData}
            />
          )}
        </div>

        {/* ===== Right ===== */}
        <div className="flex items-center justify-end gap-1.5 min-w-0">
          {isRead ? (
            // 阅读模式
            rightContent ?? topbarSlots?.rightContent ?? (
              isMobile ? (
                // 移动端阅读模式 — 展开详情按钮
                <button
                  className="inline-flex items-center justify-center size-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors"
                  aria-label={t("community.expandDetails")}
                  onClick={() => { toggleDrawer(); trackAnalytics("drawer_open") }}
                >
                  {drawerOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
                </button>
              ) : (
                // 桌面端阅读模式 — 创建/动态/通知/历史/头像 + 展开侧栏
                <>
                  {session ? (
                    <>
                      <CreateDropdown />
                      <MomentPopover />
                      <NotificationPopover />
                      <HistoryPopover />
                      <UserMenu session={session} isRead={isRead} />
                    </>
                  ) : (
                    <HeaderAuthButtons />
                  )}
                  <button
                    className="inline-flex items-center justify-center size-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors"
                    aria-label={t("community.expandDetails")}
                    onClick={() => { toggleDrawer(); trackAnalytics("drawer_open") }}
                  >
                    {drawerOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
                  </button>
                </>
              )
            )
          ) : isMobile ? (
            // 移动端非阅读模式 — 仅显示用户菜单（整合了创建/通知/动态/历史）
            <>
              {session ? (
                <UserMenu session={session} isMobile isRead={isRead} />
              ) : (
                <HeaderAuthButtons />
              )}
            </>
          ) : (
            // 桌面端非阅读模式 — 保持不变
            <>
              {session ? (
                <>
                  <CreateDropdown />
                  <MomentPopover />
                  <NotificationPopover />
                  <HistoryPopover />
                  <UserMenu session={session} isRead={isRead} />
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
