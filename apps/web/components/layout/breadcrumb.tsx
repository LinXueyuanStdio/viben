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
import { Separator } from "@/components/ui/separator"
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
    // 仅保留根 + 阅读相关段
    return segments.filter((s) => !s.config.mode || s.config.mode === "read")
  }, [segments, variant])

  if (filteredSegments.length === 0) {
    return <div />
  }

  return (
    <nav aria-label="面包屑导航" className={cn("flex items-center gap-0.5 min-w-0", className)}>
      {filteredSegments.map((seg, idx) => (
        <React.Fragment key={seg.href}>
          {idx > 0 && (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <BreadcrumbSegment
            href={seg.href}
            label={seg.config.titleKey ? t(seg.config.titleKey) : seg.config.label}
            icon={seg.config.icon}
            isLast={seg.isLast}
            variant={variant}
          />
        </React.Fragment>
      ))}
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
  const siblings = getSiblingRoutes(href === "/" ? "/" : href)
  const hasDropdown = !isLast && siblings.length > 0

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
      {isLast ? (
        <span className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
      ) : hasDropdown ? (
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
    <Popover>
      <PopoverTrigger asChild>{segment}</PopoverTrigger>
      <PopoverContent
        className="w-[min(292px,calc(100vw-28px))] p-1.5"
        align="start"
        sideOffset={4}
      >
        <ScrollArea className="max-h-[320px]">
          <div className="grid gap-0.5">
            {siblings.map((sib) => (
              <Link
                key={sib.href}
                href={sib.href}
                className={cn(
                  "grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2 py-1 text-left font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground",
                  sib.href === href && "bg-surface-secondary text-foreground"
                )}
              >
                <sib.config.icon className="h-4 w-4" />
                <span className="truncate">
                  {sib.config.titleKey ? sib.config.titleKey : sib.config.label}
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
