"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"
import { usePathname } from "next/navigation"
import { Bell, Clock, Flag, Maximize2, MessageSquare, MoreHorizontal, FileText, Columns2, PanelRight } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils/index"
import { getTopbarMode } from "./topbar-mode"
import { useDrawer } from "./drawer-context"
import { BreadcrumbNav } from "./breadcrumb"
import { GlobalSearch } from "./global-search"
import { NavPopover } from "./nav-popover"
import { IconButton } from "@/components/ui/icon-button"
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from "@/components/ui/viben-tabs"
import { UserMenu } from "./user-menu"
import { CreateDropdown } from "./create-dropdown"
import { ReportDialog } from "@/components/content/report-dialog"
import { FeedbackDialog } from "@/components/content/feedback-dialog"
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
  const { t } = useTranslation()
  const pathname = usePathname()
  const mode = getTopbarMode(pathname)
  const isRead = mode === "read"
  const { toggle: toggleDrawer } = useDrawer()

  const [immersive, setImmersive] = React.useState(false)
  const [readHasSidePage, setReadHasSidePage] = React.useState(true)
  const [readActiveTab, setReadActiveTab] = React.useState("page")

  // 客户端按需加载搜索数据（避免阻塞服务端布局渲染）
  const [lazyHotSearches, setLazyHotSearches] = React.useState<Array<{ query: string; count: number }>>([])
  const [lazyRecentSearches, setLazyRecentSearches] = React.useState<string[]>([])

  React.useEffect(() => {
    // 如果布局已提供数据则跳过
    if (hotSearches.length > 0 && recentSearches.length > 0) return

    const abort = new AbortController()
    Promise.all([
      hotSearches.length === 0
        ? fetch("/api/search/hot?limit=8", { signal: abort.signal }).then(r => r.ok ? r.json() : []).catch(() => [])
        : Promise.resolve(hotSearches),
      recentSearches.length === 0 && session
        ? fetch("/api/search/recent?limit=5", { signal: abort.signal }).then(r => r.ok ? r.json() : []).catch(() => [])
        : Promise.resolve(recentSearches),
    ]).then(([hot, recent]) => {
      setLazyHotSearches(hot)
      setLazyRecentSearches(recent)
    }).catch(() => {})

    return () => abort.abort()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveHotSearches = hotSearches.length > 0 ? hotSearches : lazyHotSearches
  const effectiveRecentSearches = recentSearches.length > 0 ? recentSearches : lazyRecentSearches

  // 监听 ReadPageClient 通过 data 属性传递的副页状态
  React.useEffect(() => {
    if (!isRead) return
    const el = document.documentElement
    const check = () => setReadHasSidePage(el.getAttribute("data-read-has-side-page") !== "0")
    check()
    const observer = new MutationObserver(check)
    observer.observe(el, { attributes: true, attributeFilter: ["data-read-has-side-page"] })
    return () => observer.disconnect()
  }, [isRead])

  // 同步阅读页活动标签到 data 属性，供 ReadPageClient 读取
  React.useEffect(() => {
    if (!isRead) return
    document.documentElement.setAttribute("data-read-active-tab", readActiveTab)
  }, [isRead, readActiveTab])

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
          <IconButton size="compact" label={t("community.toggleSidebar")} onClick={onToggleSidebar}>
            <svg className="h-[18px] w-[18px]" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 4h12M3 9h12M3 14h12" />
            </svg>
          </IconButton>

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
            <div
              className={cn(
                "pointer-events-auto transition-all duration-300 ease-out",
                readHasSidePage
                  ? "opacity-100 scale-100 translate-y-0"
                  : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
              )}
            >
              <VibenTabs value={readActiveTab} onValueChange={(v) => v && setReadActiveTab(v)}>
                <VibenTabsList variant="pill">
                  <VibenTabsTrigger value="page" variant="pill"><FileText className="h-4 w-4" /> {t("community.page")}</VibenTabsTrigger>
                  {readHasSidePage && (
                    <VibenTabsTrigger value="side" variant="pill"><Columns2 className="h-4 w-4" /> {t("community.sidePage")}</VibenTabsTrigger>
                  )}
                </VibenTabsList>
              </VibenTabs>
            </div>
          ) : (
            <GlobalSearch
              recentSearches={effectiveRecentSearches}
              hotSearches={effectiveHotSearches}
            />
          )}
        </div>

        {/* ===== Right ===== */}
        <div className="flex items-center justify-end gap-1.5 min-w-0">
          {isRead ? (
            <>
              {/* 阅读模式操作 */}
              <IconButton size="compact" label={t("community.expandDetails")} onClick={toggleDrawer}>
                <PanelRight className="h-4 w-4" />
              </IconButton>
              <IconButton size="compact" label={t("community.immersiveReading")} onClick={() => setImmersive(true)}>
                <Maximize2 className="h-4 w-4" />
              </IconButton>
              <ReadMoreMenu />
            </>
          ) : (
            <>
              {/* 默认模式操作 */}
              {session && <CreateDropdown />}
              <LanguageSwitcher />
              <ThemeToggle />
              {session ? (
                <>
                  <NavPopover
                    icon={Bell}
                    label={t("community.notifications")}
                    badge={2}
                    title={t("community.feed")}
                    items={notificationItems}
                    moreLabel={t("community.loadMoreMoments")}
                  />
                  <NavPopover
                    icon={Clock}
                    label={t("community.history")}
                    title={t("community.history")}
                    items={historyItems}
                    moreLabel={t("community.viewAllHistory")}
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
  const { t } = useTranslation()
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [reportOpen, setReportOpen] = React.useState(false)
  const [feedbackOpen, setFeedbackOpen] = React.useState(false)

  // 从 pathname 解析 pageId：/read/[user_slug]/[page_id]
  const pageId = React.useMemo(() => {
    const parts = pathname.split("/")
    // 例如 pathname = "/read/alice/my-article"
    if (parts[1] === "read" && parts.length >= 4) {
      return parts[3]
    }
    return ""
  }, [pathname])

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <IconButton size="compact" label={t("community.moreActions")}>
        <MoreHorizontal className="h-4 w-4" />
      </IconButton>
      {open && (
        <div className="absolute top-full right-0 z-70 w-[min(180px,calc(100vw-28px))] grid gap-1 p-1.5 rounded-xl border border-border bg-popover/98 backdrop-blur-[14px] shadow-md">
          <button
            onClick={() => {
              setOpen(false)
              setReportOpen(true)
            }}
            className="grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2.5 text-left font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
          >
            <Flag className="h-4 w-4" /> {t("community.report")}
          </button>
          <button
            onClick={() => {
              setOpen(false)
              setFeedbackOpen(true)
            }}
            className="grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2.5 text-left font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
          >
            <MessageSquare className="h-4 w-4" /> {t("community.feedback")}
          </button>
        </div>
      )}
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        entityType="published_page"
        entityId={pageId}
      />
      <FeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        pageId={pageId}
      />
    </div>
  )
}
