"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Check, ExternalLink, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils/index"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { VibenLogo } from "@/components/shared/viben-logo"
import {
  resolveBreadcrumbSegments,
  getSiblingRoutes,
  routeRegistry,
  type DynamicSegmentLabel,
  type RouteConfig,
} from "@/lib/navigation/route-registry"
import { isPublishedPageRoute } from "@/lib/navigation/page-route"
import { PageSwitcherPopover } from "@/components/layout/page-switcher-popover"
import { ProjectSwitcherPopover } from "@/components/layout/project-switcher-popover"
import { TeamSwitcherPopover } from "@/components/layout/team-switcher-popover"
import type { RouteResolution } from "@/lib/navigation/route-resolver"

// --- Context ---

interface BreadcrumbLabelEntry {
  label: string
  icon?: LucideIcon
  href?: string
}

export interface BreadcrumbContextValue {
  labels?: Record<string, BreadcrumbLabelEntry>
  /** 自定义下拉项（按 accumulated path 映射） */
  dropdownItems?: Record<string, Array<{ href: string; config: RouteConfig }>>
}

export const BreadcrumbDynamicContext = React.createContext<BreadcrumbContextValue>({})

// --- Component ---

interface BreadcrumbNavProps {
  variant?: "global" | "read"
  className?: string
  resolution?: RouteResolution | null
}

export function BreadcrumbNav({ variant = "global", className, resolution }: BreadcrumbNavProps) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const ctx = React.useContext(BreadcrumbDynamicContext)
  const dynamicLabels: Record<string, DynamicSegmentLabel> | undefined = ctx.labels

  // 判断是否为 /[user_slug] 及其子路由：第一段不是已知静态路由即为动态用户路由
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? ""
  const showViben = firstSegment === "" || routeRegistry[`/${firstSegment}`] !== undefined

  // 从 resolution 推导面包屑决策
  const rType = resolution?.type
  // read-page 且带 projectSlug = 3 段 project-scoped page URL（/{team}/{project}/{page}）
  const isProjectScopedRead = rType === "read-page" && !!resolution?.projectSlug
  const isProjectPage = rType === "project-overview" || rType === "project-page" || isProjectScopedRead
  const isTeamOrProjectPage = rType === "team-overview" || rType === "team-sub" || isProjectPage
  const currentTeamSlug = resolution?.teamSlug
    ?? (pathname.startsWith("/team/") ? pathname.split("/")[2] : "")
    ?? ""

  // readPageInfo 用于 PageSwitcherPopover（read-page 类型）
  const readPageInfo = React.useMemo(() => {
    if (rType === "read-page" && resolution?.userSlug && resolution?.pageSlug) {
      return { isPage: true, userSlug: resolution.userSlug, pageId: resolution.pageSlug }
    }
    if (rType === "project-page" && resolution?.teamSlug && resolution?.pageSlug) {
      return { isPage: true, userSlug: resolution.teamSlug, pageId: resolution.pageSlug }
    }
    return isPublishedPageRoute(pathname)
  }, [pathname, rType, resolution])

  const segments = React.useMemo(
    () => resolveBreadcrumbSegments(pathname, dynamicLabels, {
      teamDisplayName: resolution?.teamDisplayName,
      projectDisplayName: resolution?.projectDisplayName,
    }),
    [pathname, dynamicLabels, resolution?.teamDisplayName, resolution?.projectDisplayName]
  )

  // 过滤：read 模式只显示 mode="read" 的路由
  const filteredSegments = React.useMemo(() => {
    if (variant !== "read") return segments
    return segments.filter((s) => !s.config.mode || s.config.mode === "read")
  }, [segments, variant])

  if (filteredSegments.length === 0) {
    return <div />
  }

  return (
    <nav aria-label={t("community.breadcrumb")} className={cn("flex items-center gap-0 min-w-0", className)}>
      {/* 品牌标记 — icon 始终显示（点击回首页），/[user_slug] 路由隐藏文字 */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 h-8 px-2 rounded-lg hover:bg-transparent shrink-0"
        aria-label={t("community.viben")}
      >
        <VibenLogo size={22} />
        {showViben && (
          <span className="font-extrabold text-foreground">Viben</span>
        )}
      </Link>
      {filteredSegments.map((seg) => {
        const label = seg.config.titleKey ? t(seg.config.titleKey) : seg.config.label
        // href 匹配：用 segment href 与 resolution 中的 team/project/page URL 精确匹配
        const teamSegHref = resolution?.teamSlug ? `/${resolution.teamSlug}` : ""
        const projectSegHref = resolution?.teamSlug && resolution?.projectSlug
          ? `/${resolution.teamSlug}/${resolution.projectSlug}` : ""
        const pageSegHref = (resolution?.userSlug || resolution?.teamSlug) && resolution?.pageSlug
          ? `/${resolution?.userSlug ?? resolution?.teamSlug}/${resolution.pageSlug}` : ""

        const isTeamSwitcher = isTeamOrProjectPage && teamSegHref && seg.href === teamSegHref
        const isProjectSwitcher = (rType === "project-overview" || isProjectScopedRead) && projectSegHref && seg.href === projectSegHref
        const isPageSwitcher = readPageInfo.userSlug && readPageInfo.pageId && seg.href === pageSegHref && (
          rType === "read-page" || rType === "project-page" || rType === null
        )

        return (
          <React.Fragment key={seg.href}>
            <span className="text-[#93b4bf] dark:text-muted-foreground shrink-0">/</span>
            <BreadcrumbSegment
              href={seg.href}
              label={label}
              icon={seg.config.icon}
              isLast={seg.isLast}
              variant={variant}
              customSiblings={ctx.dropdownItems?.[seg.href]}
              pageSwitcher={
                isPageSwitcher
                  ? { userSlug: readPageInfo.userSlug!, currentPageId: readPageInfo.pageId! }
                  : undefined
              }
              projectSwitcher={
                isProjectSwitcher && resolution
                  ? { teamSlug: resolution.teamSlug!, currentProjectSlug: resolution.projectSlug! }
                  : undefined
              }
              teamSwitcher={
                isTeamSwitcher
                  ? { currentTeamSlug }
                  : undefined
              }
            />
          </React.Fragment>
        )
      })}
    </nav>
  )
}

interface BreadcrumbSegmentProps {
  href: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  isLast: boolean
  variant: "global" | "read"
  customSiblings?: Array<{ href: string; config: RouteConfig }>
  pageSwitcher?: { userSlug: string; currentPageId: string }
  projectSwitcher?: { teamSlug: string; currentProjectSlug: string }
  teamSwitcher?: { currentTeamSlug: string }
}

function BreadcrumbSegment({ href, label, icon: Icon, isLast, variant, customSiblings, pageSwitcher, projectSwitcher, teamSwitcher }: BreadcrumbSegmentProps) {
  const { t } = useTranslation()
  const parentPath = href === "/" ? "/" : href
  const siblings = getSiblingRoutes(parentPath, customSiblings)
  const hasDropdown = siblings.length > 1
  const hasAnySwitcher = !!(pageSwitcher || projectSwitcher || teamSwitcher)
  const [open, setOpen] = React.useState(false)
  const [groupHovered, setGroupHovered] = React.useState(false)
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hover 触发：立即打开，120ms 延迟关闭（参考桌面版 breadcrumb-dropdown.tsx）
  const handleMouseEnter = React.useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
    if (!open) {
      setOpen(true)
    }
  }, [open, setOpen])

  const handleMouseLeave = React.useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }, [setOpen])

  React.useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  const segmentContent = (
    <>
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span className="truncate">{label}</span>
    </>
  )

  const segment = (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-8 max-w-[220px] gap-1.5 rounded-lg px-2 font-extrabold",
        variant === "read" && "max-w-[170px]",
        isLast && variant === "read" && "max-w-[210px]",
        hasAnySwitcher && "rounded-r-none pr-1.5 max-w-[170px]",
        hasAnySwitcher && groupHovered && "bg-accent text-accent-foreground"
      )}
      asChild={hasDropdown ? false : isLast && !hasAnySwitcher ? false : true}
    >
      {hasDropdown ? (
        <span className="flex items-center gap-1.5 min-w-0">{segmentContent}</span>
      ) : isLast ? (
        <span className="flex items-center gap-1.5 min-w-0">{segmentContent}</span>
      ) : (
        <Link href={href} className="flex items-center gap-1.5 min-w-0">{segmentContent}</Link>
      )}
    </Button>
  )

  // 页面切换下拉：popover 挂在按钮外部，hover 状态联动
  if (pageSwitcher) {
    return (
      <span
        className="inline-flex items-center"
        onMouseEnter={() => setGroupHovered(true)}
        onMouseLeave={() => setGroupHovered(false)}
      >
        {segment}
        <PageSwitcherPopover
          userSlug={pageSwitcher.userSlug}
          currentPageId={pageSwitcher.currentPageId}
          groupHovered={groupHovered}
        />
      </span>
    )
  }

  // 项目切换下拉：popover 挂在按钮外部，hover 时异步加载项目列表
  if (projectSwitcher) {
    return (
      <span
        className="inline-flex items-center"
        onMouseEnter={() => setGroupHovered(true)}
        onMouseLeave={() => setGroupHovered(false)}
      >
        {segment}
        <ProjectSwitcherPopover
          teamSlug={projectSwitcher.teamSlug}
          currentProjectSlug={projectSwitcher.currentProjectSlug}
          groupHovered={groupHovered}
        />
      </span>
    )
  }

  // 团队切换下拉：hover 时异步加载用户所属团队列表
  if (teamSwitcher) {
    return (
      <span
        className="inline-flex items-center"
        onMouseEnter={() => setGroupHovered(true)}
        onMouseLeave={() => setGroupHovered(false)}
      >
        {segment}
        <TeamSwitcherPopover
          currentTeamSlug={teamSwitcher.currentTeamSlug}
          groupHovered={groupHovered}
        />
      </span>
    )
  }

  if (!hasDropdown) return segment

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          className="inline-flex"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {segment}
        </span>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(292px,calc(100vw-28px))] p-1.5"
        align="start"
        sideOffset={4}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
          <ScrollArea className="max-h-[320px]">
            <div className="grid gap-0.5">
              {siblings.map((sib) => {
                const isExternal = sib.config.external ?? false;
                const Comp = isExternal ? "a" : Link;
                const isCurrent = sib.href === href;
                return (
                  <Comp
                    key={sib.href}
                    href={sib.href}
                    {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "grid grid-cols-[18px_1fr_auto] items-center gap-2 min-h-[38px] rounded-[9px] px-2 py-1 text-left font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground",
                      isCurrent && "bg-surface-secondary text-foreground"
                    )}
                  >
                    {(() => {
                      const Icon = sib.config.icon
                      return Icon ? <Icon className="h-4 w-4" /> : <span className="w-[18px]" />
                    })()}
                    <span className="truncate">
                      {sib.config.titleKey ? t(sib.config.titleKey) : sib.config.label}
                    </span>
                    {isCurrent ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : isExternal ? (
                      <ExternalLink className="h-3 w-3 text-muted-foreground/50" />
                    ) : null}
                  </Comp>
                );
              })}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
  )
}
