"use client"

import * as React from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import { thumbnailUrl } from "@/components/content/cover"
import { cn } from "@/lib/utils/index"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { IconButton } from "@/components/ui/icon-button"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { LucideIcon } from "lucide-react"

interface PopoverItem {
  thumb?: string
  title: string
  subtitle?: string
  href: string
}

interface NavPopoverProps {
  icon: LucideIcon
  label: string
  badge?: number
  title: string
  items: PopoverItem[]
  onLoadMore?: () => void
  moreLabel?: string
}

export function NavPopover({
  icon: Icon,
  label,
  badge,
  title,
  items,
  onLoadMore,
  moreLabel,
}: NavPopoverProps) {
  const { t } = useTranslation()
  const defaultMoreLabel = moreLabel ?? t("community.more")
  const [loaded, setLoaded] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const openTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // 260ms 延迟打开（匹配 index.html 参考设计）
  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    openTimeoutRef.current = setTimeout(() => {
      setOpen(true)
      if (!loaded) setLoaded(true)
    }, 260)
  }

  // 180ms 延迟关闭
  const handleMouseLeave = () => {
    if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current)
    closeTimeoutRef.current = setTimeout(() => setOpen(false), 180)
  }

  React.useEffect(() => {
    return () => {
      if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current)
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    }
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="relative inline-flex"
        >
          <IconButton size="default" label={label}>
            <Icon className="h-[18px] w-[18px]" />
          </IconButton>
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive" />
          )}
        </span>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(340px,calc(100vw-28px))] p-2.5"
        align="end"
        sideOffset={8}
        onMouseEnter={() => {
          if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
        }}
        onMouseLeave={handleMouseLeave}
      >
        <div className="grid gap-2">
          {/* 标题行 */}
          <div className="flex items-center justify-between min-h-[28px]">
            <span className="font-black text-sm">{title}</span>
          </div>

          {/* 懒加载：首次展开后才渲染内容 */}
          {!loaded ? (
            <div className="flex items-center justify-center min-h-[58px] text-sm font-extrabold text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center min-h-[58px] text-sm font-extrabold text-muted-foreground">
              {t("community.noData")}
            </div>
          ) : (
            <ScrollArea className="max-h-[320px]">
              <div className="grid gap-1.5">
                {items.map((item, idx) => (
                  <Link
                    key={idx}
                    href={item.href}
                    className="grid grid-cols-[46px_1fr_auto] gap-2 items-center min-h-[56px] rounded-[10px] p-1.5 hover:bg-surface-secondary"
                  >
                    <div
                      className="aspect-square rounded-lg bg-cover bg-center"
                      style={
                        item.thumb
                          ? { backgroundImage: `url(${thumbnailUrl(item.thumb)})` }
                          : { background: "linear-gradient(135deg, var(--primary), var(--accent))" }
                      }
                    />
                    <div className="min-w-0 grid gap-0.5">
                      <strong className="text-[13.5px] truncate">{item.title}</strong>
                      {item.subtitle && (
                        <span className="text-xs text-muted-foreground truncate">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* 加载更多 */}
          {loaded && onLoadMore && (
            <Button
              variant="ghost"
              className="min-h-[34px] w-full rounded-[9px] bg-surface-secondary font-black text-[13px]"
              onClick={onLoadMore}
            >
              {defaultMoreLabel}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
