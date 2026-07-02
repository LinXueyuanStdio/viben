"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"
import { usePathname, useSearchParams, useRouter } from "next/navigation"
import { Bell, Clock, Maximize2, FileText, Columns2, PanelRight, Settings } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils/index"
import { getTopbarMode } from "./topbar-mode"
import { isPublishedPageRoute } from "@/lib/navigation/page-route"
import { useDrawer } from "./drawer-context"
import { useTopbarSlots } from "./topbar-slots"
import { BreadcrumbNav } from "./breadcrumb"
import { GlobalSearch } from "./global-search"
import { NavPopover } from "./nav-popover"
import { IconButton } from "@/components/ui/icon-button"
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from "@/components/ui/viben-tabs"
import { UserMenu } from "./user-menu"
import { CreateDropdown } from "./create-dropdown"
import { ReadMoreMenu } from "@/components/pages/read-more-menu"
import { HeaderAuthButtons } from "./header-auth-buttons"
import { ThemeToggle } from "./theme-toggle"
import { LanguageSwitcher } from "./language-switcher"
import type { Session } from "@/lib/auth/types"

interface TopbarProps {
  session: Session | null
  onToggleSidebar: () => void
  centerContent?: React.ReactNode
  rightContent?: React.ReactNode
  // NavPopover + GlobalSearch 数据
  notificationItems?: Array<{ title: string; subtitle: string; href: string; thumb: string }>
  historyItems?: Array<{ title: string; subtitle: string; href: string; thumb: string }>
  hotSearches?: Array<{ query: string; count: number }>
  recentSearches?: string[]
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
  centerContent,
  rightContent,
  notificationItems = [],
  historyItems = [],
  hotSearches = [],
  recentSearches = [],
}: TopbarProps) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const mode = getTopbarMode(pathname)
  const { toggle: toggleDrawer } = useDrawer()

  // URL 同步判定阅读模式（0ms，不等任何异步数据）
  const { isPage: isReadPageFromUrl, userSlug: urlUserSlug, pageId: urlPageId } =
    isPublishedPageRoute(pathname)

  const topbarSlots = useTopbarSlots()

  // isAuthor: session 未就绪时为 false，就绪后 React re-render 自动更新
  // session 由 AppShellWrapper 异步 fetch，到达后 AppShell 重渲染 → Topbar 收到新 session
  const isAuthor = isReadPageFromUrl && session?.userSlug === urlUserSlug

  const [pageMeta] = React.useState(() => getPageMeta())
  const hasSidePage = pageMeta?.hasSidePage ?? false

  const [immersive, setImmersive] = React.useState(false)

  // 阅读模式：仅通过 URL 判定
  const isRead = isReadPageFromUrl

  // Derive active tab from URL param (read→"page", settings→"settings")
  const tabParam = searchParams.get("tab")
  const readActiveTab = React.useMemo(() => {
    if (tabParam === "settings") return "settings"
    return "page"
  }, [tabParam])

  const handleReadTabChange = React.useCallback((value: string) => {
    if (value === "settings") {
      router.replace(`${pathname}?tab=settings`, { scroll: false })
    } else {
      router.replace(`${pathname}?tab=read`, { scroll: false })
    }
  }, [router, pathname])

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
            topbarSlots?.centerContent ?? centerContent ?? (
              <div className="pointer-events-auto">
                <VibenTabs value={readActiveTab} onValueChange={(v) => v && handleReadTabChange(v)}>
                  <VibenTabsList variant="pill">
                    <VibenTabsTrigger value="page" variant="pill"><FileText className="h-4 w-4" /> {t("community.page")}</VibenTabsTrigger>
                    {hasSidePage && (
                      <VibenTabsTrigger value="side" variant="pill"><Columns2 className="h-4 w-4" /> {t("community.sidePage")}</VibenTabsTrigger>
                    )}
                    <VibenTabsTrigger value="settings" variant="pill"
                      className={cn(!isAuthor && "invisible")}>
                      <Settings className="h-4 w-4" />
                      <span className="ml-1.5">{t("community.settings")}</span>
                    </VibenTabsTrigger>
                  </VibenTabsList>
                </VibenTabs>
              </div>
            )
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
            rightContent ?? topbarSlots?.rightContent ?? (
              <>
                {/* 阅读模式操作 */}
                <IconButton size="compact" label={t("community.expandDetails")} onClick={toggleDrawer}>
                  <PanelRight className="h-4 w-4" />
                </IconButton>
                <IconButton size="compact" label={t("community.immersiveReading")} onClick={() => setImmersive(true)}>
                  <Maximize2 className="h-4 w-4" />
                </IconButton>
                <ReadMoreMenu pageId={urlPageId ?? ""} userSlug={urlUserSlug ?? ""} />
              </>
            )
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
