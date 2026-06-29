"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslation } from "react-i18next"
import { ChevronRight, Check } from "lucide-react"
import { cn } from "@/lib/utils/index"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { VibenLogo } from "@/components/shared/viben-logo"
import {
  resolveBreadcrumbSegments,
  getSiblingRoutes,
} from "@/lib/navigation/route-registry"

interface BreadcrumbNavProps {
  variant?: "global" | "read"
  className?: string
}

export function BreadcrumbNav({ variant = "global", className }: BreadcrumbNavProps) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const segments = React.useMemo(() => resolveBreadcrumbSegments(pathname), [pathname])

  // 过滤：read 模式只显示 mode="read" 的路由
  const filteredSegments = React.useMemo(() => {
    if (variant !== "read") return segments
    return segments.filter((s) => !s.config.mode || s.config.mode === "read")
  }, [segments, variant])

  if (filteredSegments.length === 0) {
    return <div />
  }

  return (
    <nav aria-label="面包屑导航" className={cn("flex items-center gap-0.5 min-w-0", className)}>
      {/* 品牌标记 — 始终显示，参考 index.html */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 h-8 px-2 rounded-lg hover:bg-transparent shrink-0"
        aria-label="Viben"
      >
        <VibenLogo size={22} />
        <span className="font-extrabold text-foreground">Viben</span>
      </Link>
      {filteredSegments.map((seg) => {
        const label = seg.config.titleKey ? t(seg.config.titleKey) : seg.config.label
        return (
          <React.Fragment key={seg.href}>
            <ChevronRight className="h-4 w-4 text-[#93b4bf] shrink-0" />
            <BreadcrumbSegment
              href={seg.href}
              label={label}
              icon={seg.config.icon}
              isLast={seg.isLast}
              variant={variant}
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
  icon: React.ComponentType<{ className?: string }>
  isLast: boolean
  variant: "global" | "read"
}

function BreadcrumbSegment({ href, label, icon: Icon, isLast, variant }: BreadcrumbSegmentProps) {
  const { t } = useTranslation()
  const parentPath = href === "/" ? "/" : href
  const siblings = getSiblingRoutes(parentPath)
  const hasDropdown = siblings.length > 0
  const [open, setOpen] = React.useState(false)
  const openTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hover 触发下拉（参考 index.html + NavPopover 的 260ms/180ms 延迟）
  const handleMouseEnter = React.useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
    if (!open) {
      openTimer.current = setTimeout(() => setOpen(true), 260)
    }
  }, [open])

  const handleMouseLeave = React.useCallback(() => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null }
    closeTimer.current = setTimeout(() => setOpen(false), 180)
  }, [])

  React.useEffect(() => {
    return () => {
      if (openTimer.current) clearTimeout(openTimer.current)
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  const segment = (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-8 max-w-[220px] gap-1.5 rounded-lg px-2 font-extrabold",
        variant === "read" && "max-w-[170px]",
        isLast && variant === "read" && "max-w-[210px]"
      )}
      asChild={isLast ? false : !hasDropdown}
    >
      {(!isLast && hasDropdown) ? (
        <span className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
      ) : isLast ? (
        <span className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
      ) : (
        <Link href={href} className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </Link>
      )}
    </Button>
  )

  if (!hasDropdown) return segment

  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{segment}</PopoverTrigger>
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
                  <sib.config.icon className="h-4 w-4" />
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
    </div>
  )
}
