"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { IconButton } from "@/components/ui/icon-button"
import { MoreHorizontal, Flag, Share2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type FeedKind = "更新" | "发布" | "转发" | "评论" | "收藏" | "模板" | "数据" | "合集" | "论文" | "笔记"

export interface FeedHeadData {
  fallbackText: string
  avatarUrl?: string
  name: string
  handle: string
  userSlug: string
  kind: FeedKind
  timeAgo: string
  source?: string
}

interface FeedHeadProps {
  data: FeedHeadData
  className?: string
}

export function FeedHead({ data, className }: FeedHeadProps) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { fallbackText, avatarUrl, name, handle, userSlug, timeAgo, source } = data
  const authorHref = `/${encodeURIComponent(userSlug)}`

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [menuOpen])

  // Close menu on Escape
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setMenuOpen(false)
      triggerRef.current?.focus()
    }
  }, [])

  const handleCopyLink = () => {
    setMenuOpen(false)
    const url = `${window.location.origin}/${encodeURIComponent(userSlug)}`
    navigator.clipboard.writeText(url).then(
      () => toast.success(t("common.copied")),
      () => toast.error(t("community.copyLinkFailed"))
    )
  }

  const toggleMenu = () => setMenuOpen((prev) => !prev)

  return (
    <div className={cn("grid grid-cols-[auto_1fr_auto] gap-[9px] items-center", className)}>
      <Link href={authorHref} className="shrink-0">
        <Avatar className="size-[34px]">
          <AvatarImage src={avatarUrl} alt={name} />
          <AvatarFallback>{fallbackText}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Link href={authorHref} className="font-bold text-sm truncate hover:underline">
            {name}
          </Link>
        </div>
        <div className="text-[13px] text-muted-foreground truncate">
          {handle}
          <span className="mx-[7px]">·</span>
          {timeAgo}
          {source && (
            <>
              <span className="mx-[7px]">·</span>
              {t("community.fromSource", { source })}
            </>
          )}
        </div>
      </div>
      <div className="relative" ref={menuRef}>
        <button
          ref={triggerRef}
          type="button"
          onClick={toggleMenu}
          aria-expanded={menuOpen}
          aria-haspopup="true"
          aria-label={t("community.moreActions")}
          className="inline-flex items-center justify-center size-[30px] rounded-[9px] hover:bg-surface-secondary text-muted-foreground"
        >
          <MoreHorizontal className="size-4" />
        </button>
        {menuOpen && (
          <div
            role="menu"
            onKeyDown={handleKeyDown}
            className="absolute top-full right-0 z-70 w-[min(180px,calc(100vw-28px))] grid gap-1 p-1.5 rounded-xl border border-border bg-popover/98 backdrop-blur-[14px] shadow-md"
          >
            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                toast.info(t("community.reportFeatureSoon"))
              }}
              className="grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2.5 text-left font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
            >
              <Flag className="h-4 w-4" /> {t("community.report")}
            </button>
            <button
              role="menuitem"
              onClick={handleCopyLink}
              className="grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2.5 text-left font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
            >
              <Share2 className="h-4 w-4" /> {t("community.copyLink")}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
