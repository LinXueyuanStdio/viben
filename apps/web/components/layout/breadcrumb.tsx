"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Check, type LucideIcon } from "lucide-react"
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
}

export function BreadcrumbNav({ variant = "global", className }: BreadcrumbNavProps) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const ctx = React.useContext(BreadcrumbDynamicContext)
  const dynamicLabels: Record<string, DynamicSegmentLabel> | undefined = ctx.labels

  // 判断是否为 /[user_slug] 及其子路由：第一段不是已知静态路由即为动态用户路由
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? ""
  const showViben = firstSegment === "" || routeRegistry[`/${firstSegment}`] !== undefined

  // 判断是否为已发布页面阅读路由
  const readPageInfo = React.useMemo(
    () => isPublishedPageRoute(pathname),
    [pathname]
  )

  const segments = React.useMemo(
    () => resolveBreadcrumbSegments(pathname, dynamicLabels),
    [pathname, dynamicLabels]
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
      {filteredSegments.map((seg, idx) => {
        const label = seg.config.titleKey ? t(seg.config.titleKey) : seg.config.label
        const isPageSwitcher =
          readPageInfo.isPage && seg.isLast && readPageInfo.userSlug && readPageInfo.pageId
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
}

function BreadcrumbSegment({ href, label, icon: Icon, isLast, variant, customSiblings, pageSwitcher }: BreadcrumbSegmentProps) {
  const { t } = useTranslation()
  const parentPath = href === "/" ? "/" : href
  const siblings = getSiblingRoutes(parentPath, customSiblings)
  const hasDropdown = siblings.length > 1
  const [open, setOpen] = React.useState(false)
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
        pageSwitcher && isLast && "rounded-r-none pr-1.5 max-w-[170px]"
      )}
      asChild={hasDropdown ? false : isLast && !pageSwitcher ? false : true}
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

  // 页面切换下拉：popover 挂在按钮外部
  if (pageSwitcher && isLast) {
    return (
      <span className="inline-flex items-center">
        {segment}
        <PageSwitcherPopover
          userSlug={pageSwitcher.userSlug}
          currentPageId={pageSwitcher.currentPageId}
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
              {siblings.map((sib) => (
                <Link
                  key={sib.href}
                  href={sib.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2 py-1 text-left font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground",
                    sib.href === href && "bg-surface-secondary text-foreground"
                  )}
                >
                  {(() => {
                    const Icon = sib.config.icon
                    return Icon ? <Icon className="h-4 w-4" /> : <span className="w-[18px]" />
                  })()}
                  <span className="truncate">
                    {sib.config.titleKey ? t(sib.config.titleKey) : sib.config.label}
                  </span>
                  {sib.href === href && <Check className="h-3.5 w-3.5 ml-auto" />}
                </Link>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
  )
}
