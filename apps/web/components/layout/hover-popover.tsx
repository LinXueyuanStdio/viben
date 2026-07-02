"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/services/moment-mapper"
import type { LucideIcon } from "lucide-react"

// ---- shared utilities ----
export { timeAgo }

// ---- hover timer hook ----
function useHoverTimer() {
  const [open, setOpen] = React.useState(false)
  const openRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const onEnter = React.useCallback(() => {
    if (closeRef.current) clearTimeout(closeRef.current)
    openRef.current = setTimeout(() => setOpen(true), 260)
  }, [])

  const onLeave = React.useCallback(() => {
    if (openRef.current) clearTimeout(openRef.current)
    closeRef.current = setTimeout(() => setOpen(false), 180)
  }, [])

  const onContentEnter = React.useCallback(() => {
    if (closeRef.current) clearTimeout(closeRef.current)
  }, [])

  React.useEffect(() => {
    return () => {
      if (openRef.current) clearTimeout(openRef.current)
      if (closeRef.current) clearTimeout(closeRef.current)
    }
  }, [])

  return { open, setOpen, onEnter, onLeave, onContentEnter }
}

// ---- infinite scroll helper ----
// fetchPage: 给定 cursor，返回 { items, next_cursor, has_more }
// 返回 { items, hasMore, loading, loaded, loadFirst, loadMore }
export function useInfiniteFetch<T>(
  fetchPage: (cursor: string | null) => Promise<{ items: T[]; next_cursor: string | null; has_more: boolean }>
) {
  const [items, setItems] = React.useState<T[]>([])
  const [loaded, setLoaded] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const stateRef = React.useRef({ cursor: null as string | null, hasMore: false, loading: false })
  const fetchRef = React.useRef(fetchPage)
  fetchRef.current = fetchPage

  const loadFirst = React.useCallback(async () => {
    if (loaded) return
    setLoaded(true)
    setLoading(true)
    stateRef.current.loading = true
    try {
      const data = await fetchRef.current(null)
      setItems(data?.items ?? [])
      stateRef.current.cursor = data?.next_cursor ?? null
      stateRef.current.hasMore = data?.has_more ?? false
    } finally {
      setLoading(false)
      stateRef.current.loading = false
    }
  }, [loaded])

  const loadMore = React.useCallback(async () => {
    if (stateRef.current.loading || !stateRef.current.hasMore) return
    setLoading(true)
    stateRef.current.loading = true
    try {
      const data = await fetchRef.current(stateRef.current.cursor)
      setItems((prev) => [...prev, ...(data?.items ?? [])])
      stateRef.current.cursor = data?.next_cursor ?? null
      stateRef.current.hasMore = data?.has_more ?? false
    } finally {
      setLoading(false)
      stateRef.current.loading = false
    }
  }, [])

  const hasMore = stateRef.current.hasMore

  return { items, hasMore, loading, loaded, loadFirst, loadMore }
}

// ---- generic popover shell ----
interface HoverPopoverProps {
  icon: LucideIcon
  label: string
  title: string
  viewAllHref: string
  viewAllLabel?: string
  count?: number
  onFirstOpen?: () => void
  children: React.ReactNode
}

export function HoverPopover({
  icon: Icon,
  label,
  title,
  viewAllHref,
  viewAllLabel = "查看全部",
  count,
  onFirstOpen,
  children,
}: HoverPopoverProps) {
  const router = useRouter()
  const { open, setOpen, onEnter, onLeave, onContentEnter } = useHoverTimer()
  const hasOpened = React.useRef(false)

  React.useEffect(() => {
    if (open && !hasOpened.current) {
      hasOpened.current = true
      onFirstOpen?.()
    }
  }, [open, onFirstOpen])

  const handleClick = React.useCallback(() => {
    router.push(viewAllHref)
  }, [router, viewAllHref])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={handleClick}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          aria-label={label}
          className={cn(
            "relative inline-flex items-center justify-center size-[38px] rounded-[9px]",
            "text-muted-foreground hover:bg-surface-secondary hover:text-foreground",
            "transition-colors duration-150 cursor-pointer"
          )}
        >
          <Icon className="size-[18px]" />
          {count != null && count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-[10px] font-bold text-white leading-none">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(360px,calc(100vw-28px))] p-2.5"
        align="end"
        sideOffset={2}
        onMouseEnter={onContentEnter}
        onMouseLeave={onLeave}
      >
        <div className="grid gap-2">
          <div className="flex items-center justify-between min-h-[28px]">
            <span className="font-black text-sm">{title}</span>
            <Link
              href={viewAllHref}
              className="text-xs font-bold text-primary hover:underline"
            >
              {viewAllLabel}
            </Link>
          </div>
          {children}
        </div>
      </PopoverContent>
    </Popover>
  )
}
