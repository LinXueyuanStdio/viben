"use client"

import React, { useState } from "react"
import Link from "next/link"
import { ChevronRight, Eye, Bookmark, Share2, Heart, Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FollowButton } from "./follow-button"
import { Pill } from "./pill"
import { Stat } from "./stats-row"
import { SectionHead } from "./section-head"
import { MiniPageCard } from "./mini-page-card"
import type { MiniPageCardData } from "./mini-page-card"
import { cn } from "@/lib/utils"
import { formatCount } from "@/lib/utils/format"

export interface PageMetaData {
  author: {
    name: string
    fallbackText: string
    avatarUrl?: string
    userSlug: string
    followerCount: number
  }
  title: string
  uid: string
  sidePageUid?: string
  description: string[]
  tags: string[]
  stats: {
    views: number
    bookmarks: number
    date: string
  }
  actions: {
    likes: number
    bookmarks: number
    shares: number
  }
  chapters?: {
    number: number
    title: string
    status?: string
    /** href for navigating to this chapter's page (合集内其他页面) */
    href?: string
  }[]
  chapterProgress?: {
    current: number
    total: number
  }
  /** 合集名称 */
  collectionName?: string
  /** 合集 slug（用于订阅等操作） */
  collectionSlug?: string
  recommendations?: Array<{ data: MiniPageCardData; href: string }>
  // Viewer state for action buttons
  viewerHasReacted: boolean
  viewerHasFavorited: boolean
  isAuthenticated: boolean
  communityEntityId: string
  /** 页面在 published_pages 表中的 DB ID，用于 reactions/favorites API */
  pageDbId: string
  userSlug: string
  pageId: string
}

interface PageMetaProps {
  data: PageMetaData
  defaultExpanded?: boolean
  className?: string
  currentUserSlug?: string
}

export const PageMeta = React.memo(function PageMeta({ data, defaultExpanded = false, className, currentUserSlug }: PageMetaProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const { author, title, uid, sidePageUid, description, tags, stats, actions, chapters, chapterProgress, collectionName, collectionSlug, recommendations } = data

  // Optimistic state for action buttons
  const [hasReacted, setHasReacted] = useState(data.viewerHasReacted)
  const [hasFavorited, setHasFavorited] = useState(data.viewerHasFavorited)
  const [likeCount, setLikeCount] = useState(actions.likes)
  const [bookmarkCount, setBookmarkCount] = useState(actions.bookmarks)
  const [shareCount, setShareCount] = useState(actions.shares)
  const [likePending, setLikePending] = useState(false)
  const [bookmarkPending, setBookmarkPending] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleLike = async () => {
    if (!data.isAuthenticated) {
      toast.error(t("community.loginRequired"))
      return
    }
    if (likePending) return
    setLikePending(true)
    const wasReacted = hasReacted
    setHasReacted(!wasReacted)
    setLikeCount(c => c + (wasReacted ? -1 : 1))
    try {
      const res = await fetch("/api/community/reactions/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: "published_page",
          entity_id: data.pageDbId,
          reaction_type: "like",
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error("Like failed:", res.status, err)
        throw new Error(err?.error?.message ?? "failed")
      }
      const result = await res.json()
      setHasReacted(result.has_reacted)
      setLikeCount(result.reactions_count)
    } catch (e) {
      console.error("Like error:", e)
      setHasReacted(wasReacted)
      setLikeCount(c => c + (wasReacted ? 1 : -1))
      toast.error(t("community.likeFailed"))
    } finally {
      setLikePending(false)
    }
  }

  const handleBookmark = async () => {
    if (!data.isAuthenticated) {
      toast.error(t("community.loginRequired"))
      return
    }
    if (bookmarkPending) return
    setBookmarkPending(true)
    const wasFavorited = hasFavorited
    setHasFavorited(!wasFavorited)
    setBookmarkCount(c => c + (wasFavorited ? -1 : 1))
    try {
      const res = await fetch("/api/community/favorites/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: "published_page",
          entity_id: data.pageDbId,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error("Bookmark failed:", res.status, err)
        throw new Error(err?.error?.message ?? "failed")
      }
      const result = await res.json()
      setHasFavorited(result.has_favorited)
      setBookmarkCount(result.favorites_count)
    } catch (e) {
      console.error("Bookmark error:", e)
      setHasFavorited(wasFavorited)
      setBookmarkCount(c => c + (wasFavorited ? 1 : -1))
      toast.error(t("community.bookmarkFailed"))
    } finally {
      setBookmarkPending(false)
    }
  }

  const handleShare = async () => {
    try {
      const res = await fetch("/api/community/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: "published_page",
          user_slug: data.userSlug,
          page_id: data.pageId,
          channel: "copy_link",
        }),
      })
      if (!res.ok) throw new Error("failed")
      const result = await res.json()
      const absoluteUrl = new URL(result.share_link.url, window.location.origin).toString()
      await navigator.clipboard.writeText(absoluteUrl)
      setShareCount(c => c + 1)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t("community.copyFailed"))
    }
  }

  // Collection subscribe state
  const [subscribed, setSubscribed] = useState(false)
  const [subscribePending, setSubscribePending] = useState(false)

  const handleSubscribeCollection = async () => {
    if (!data.isAuthenticated) {
      toast.error(t("community.loginRequired"))
      return
    }
    if (subscribePending) return
    setSubscribePending(true)
    try {
      // Subscribe via the current page's subscription endpoint
      const res = await fetch(`/api/read/${encodeURIComponent(data.userSlug)}/${encodeURIComponent(data.pageId)}/subscription`, {
        method: subscribed ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notify_level: "major" }),
      })
      if (res.ok) {
        setSubscribed(!subscribed)
      }
    } catch {
      // silently ignore
    } finally {
      setSubscribePending(false)
    }
  }

  return (
    <div className={cn("grid gap-[11px]", className)}>
      {/* Author */}
      <div className="grid grid-cols-[auto_1fr_auto] gap-[9px] items-center">
        <Link href={`/${encodeURIComponent(author.userSlug)}`} className="shrink-0">
          <Avatar className="size-[34px]">
            <AvatarImage src={author.avatarUrl} alt={author.name} />
            <AvatarFallback>{author.fallbackText}</AvatarFallback>
          </Avatar>
        </Link>
        <Link href={`/${encodeURIComponent(author.userSlug)}`} className="grid gap-[3px] min-w-0 hover:opacity-80 transition-opacity">
          <div className="font-bold text-sm truncate">{author.name}</div>
          <div className="text-[12.5px] text-muted-foreground">
            {t("community.followersCountUnit", { formattedCount: formatCount(author.followerCount) })}
          </div>
        </Link>
        <FollowButton
          userSlug={author.userSlug}
          currentUserSlug={currentUserSlug}
          className="h-9 shrink-0 gap-1 border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
        />
      </div>

      {/* Title Row */}
      <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
        <h3 className="font-['Lexend'] text-xl font-bold leading-tight">{title}</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center justify-center size-8 rounded-[9px] hover:bg-surface-secondary text-muted-foreground shrink-0"
          aria-label={expanded ? t("community.collapseMore") : t("community.expandMore")}
        >
          <ChevronRight className={cn("size-5 transition-transform", expanded && "rotate-90")} />
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Stat icon={Eye} value={stats.views} format />
        <Stat icon={Bookmark} value={stats.bookmarks} format />
        <span>{stats.date}</span>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-[7px]">
        <button
          onClick={handleLike}
          disabled={likePending}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 min-h-[62px] rounded-[13px] transition-colors",
            hasReacted
              ? "bg-red-50 dark:bg-red-950/20 text-red-500"
              : "bg-surface-secondary hover:bg-primary/10 text-muted-foreground hover:text-primary"
          )}
        >
          <Heart className={cn("size-5", hasReacted && "fill-current")} />
          <span className="text-[13px] font-bold">{formatCount(likeCount)}</span>
        </button>
        <button
          onClick={handleBookmark}
          disabled={bookmarkPending}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 min-h-[62px] rounded-[13px] transition-colors",
            hasFavorited
              ? "bg-amber-50 dark:bg-amber-950/20 text-amber-500"
              : "bg-surface-secondary hover:bg-primary/10 text-muted-foreground hover:text-primary"
          )}
        >
          <Bookmark className={cn("size-5", hasFavorited && "fill-current")} />
          <span className="text-[13px] font-bold">{formatCount(bookmarkCount)}</span>
        </button>
        <button
          onClick={handleShare}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 min-h-[62px] rounded-[13px] transition-colors",
            copied
              ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500"
              : "bg-surface-secondary hover:bg-primary/10 text-muted-foreground hover:text-primary"
          )}
        >
          {copied ? <Check className="size-5" /> : <Share2 className="size-5" />}
          <span className="text-[13px] font-bold">{copied ? t("community.copied") : formatCount(shareCount)}</span>
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="grid gap-[7px] text-sm text-muted-foreground leading-relaxed">
          <div className="text-[13px]">
            UID: {uid}{sidePageUid && <> · {t("community.sidePage")}: {sidePageUid}</>}
          </div>
          {description.map((p, i) => (
            <p key={i} className="max-w-[760px]">{p}</p>
          ))}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {tags.map((tag) => (
                <Link key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                  <Pill variant="tag">{tag}</Pill>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chapters — 合集内的各页面，点击可导航 */}
      {chapters && chapters.length > 0 && (
        <div className="grid gap-2 pt-0.5">
          <SectionHead
            title={collectionName ?? t("community.collections")}
            actionLabel={chapterProgress ? `${chapterProgress.current} / ${chapterProgress.total}` : undefined}
            actionHref={undefined}
          />
          {collectionSlug && (
            <button
              onClick={handleSubscribeCollection}
              disabled={subscribePending}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 h-[34px] px-3 rounded-[9px] text-[13px] font-bold transition-colors",
                subscribed
                  ? "bg-primary/10 text-primary"
                  : "bg-surface-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {subscribed ? t("community.subscribedCollection") : t("community.subscribeCollection")}
            </button>
          )}
          <div className="grid gap-1.5">
            {chapters.map((ch) => {
              const content = (
                <div
                  className={cn(
                    "grid gap-2 items-center rounded-[9px] px-2.5 min-h-[38px] hover:bg-surface-secondary",
                    ch.href && "cursor-pointer"
                  )}
                  style={{ gridTemplateColumns: "auto 1fr auto" }}
                >
                  <Pill variant="rank">{String(ch.number).padStart(2, "0")}</Pill>
                  <span className="font-bold text-sm truncate">{ch.title}</span>
                  {ch.status && (
                    <span className="text-[12.5px] text-muted-foreground">{ch.status}</span>
                  )}
                </div>
              )
              return ch.href ? (
                <Link key={ch.number} href={ch.href}>
                  {content}
                </Link>
              ) : (
                <React.Fragment key={ch.number}>{content}</React.Fragment>
              )
            })}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="grid gap-2">
          <SectionHead title={t("community.recommended")} />
          <div className="grid gap-2">
            {recommendations.map((entry, i) => (
              <MiniPageCard key={i} data={entry.data} href={entry.href} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
