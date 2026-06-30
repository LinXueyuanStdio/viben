"use client"

import { useCallback, useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Eye, MessageCircle, Bookmark, ThumbsUp, Repeat2, Share2 } from "lucide-react"
import { toast } from "sonner"
import { FeedHead } from "./feed-head"
import type { FeedHeadData } from "./feed-head"
import { Attachment } from "./attachment"
import type { AttachmentData } from "./attachment"
import { StatsRow } from "./stats-row"
import type { StatProps } from "./stats-row"
import { cn } from "@/lib/utils"
import { toggleReaction, toggleBookmark } from "@/lib/api/community"

export interface FeedCardData {
  head: FeedHeadData
  text: string
  quote?: string
  attachment?: AttachmentData
  actions: {
    views: number
    likes: number
    comments: number
    reposts?: number
    bookmarks: number
    momentId?: string
    shareUrl?: string
    hasLiked?: boolean
    hasBookmarked?: boolean
  }
}

interface FeedCardProps {
  data: FeedCardData
  variant?: "preloaded" | "rich"
  className?: string
  onAction?: (action: string) => void
}

export function FeedCard({ data, variant = "preloaded", className, onAction }: FeedCardProps) {
  const { t } = useTranslation()

  const [optimisticLikes, setOptimisticLikes] = useState(data.actions.likes)
  const [optimisticBookmarks, setOptimisticBookmarks] = useState(data.actions.bookmarks)
  const [likedActive, setLikedActive] = useState(data.actions.hasLiked ?? false)
  const [bookmarkedActive, setBookmarkedActive] = useState(data.actions.hasBookmarked ?? false)
  const [pendingLike, setPendingLike] = useState(false)
  const [pendingBookmark, setPendingBookmark] = useState(false)
  const [bounceLike, setBounceLike] = useState(false)
  const [bounceBookmark, setBounceBookmark] = useState(false)

  // Ref-based guard so useEffect doesn't overwrite in-flight mutations
  const pendingRef = useRef({ like: false, bookmark: false })
  // Snapshot refs for safe rollback
  const snapshotRef = useRef({ likes: data.actions.likes, bookmarks: data.actions.bookmarks })

  // Sync state when data prop changes (e.g., after page re-render with fresh data),
  // but skip if a mutation is in-flight to avoid overwriting optimistic updates.
  useEffect(() => {
    if (pendingRef.current.like || pendingRef.current.bookmark) return
    setOptimisticLikes(data.actions.likes)
    setOptimisticBookmarks(data.actions.bookmarks)
    setLikedActive(data.actions.hasLiked ?? false)
    setBookmarkedActive(data.actions.hasBookmarked ?? false)
    snapshotRef.current = { likes: data.actions.likes, bookmarks: data.actions.bookmarks }
  }, [data.actions.likes, data.actions.bookmarks, data.actions.hasLiked, data.actions.hasBookmarked])

  const handleShare = useCallback(() => {
    const text = `${data.head.name}: ${data.text.slice(0, 60)}${data.text.length > 60 ? "..." : ""}`
    const url = data.actions.shareUrl ?? window.location.href
    if (navigator.share) {
      navigator.share({ title: text, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`).catch(() => {})
    }
  }, [data.head.name, data.text, data.actions.shareUrl])

  const handleLike = useCallback(async () => {
    if (onAction) {
      onAction("like")
      return
    }

    const momentId = data.actions.momentId
    if (!momentId) {
      toast.info(t("community.interactSoon"))
      return
    }

    if (pendingRef.current.like) return

    pendingRef.current.like = true
    setPendingLike(true)
    const wasActive = likedActive
    setLikedActive(!wasActive)
    setOptimisticLikes((c) => (wasActive ? Math.max(0, c - 1) : c + 1))
    if (!wasActive) {
      setBounceLike(true)
      setTimeout(() => setBounceLike(false), 600)
    }

    try {
      const result = await toggleReaction(momentId)
      setLikedActive(result.has_reacted)
      setOptimisticLikes(result.reactions_count)
      snapshotRef.current.likes = result.reactions_count
    } catch (err: unknown) {
      // Revert optimistic update
      setLikedActive(wasActive)
      setOptimisticLikes(snapshotRef.current.likes)

      const msg = err instanceof Error ? err.message : ""
      if (msg === "login_required") {
        toast.error(t("community.loginToInteract"))
      } else {
        toast.error(t("community.likeFailed"))
      }
    } finally {
      pendingRef.current.like = false
      setPendingLike(false)
    }
  }, [data.actions.momentId, likedActive, onAction, t])

  const handleBookmark = useCallback(async () => {
    if (onAction) {
      onAction("bookmark")
      return
    }

    const momentId = data.actions.momentId
    if (!momentId) {
      toast.info(t("community.interactSoon"))
      return
    }

    if (pendingRef.current.bookmark) return

    pendingRef.current.bookmark = true
    setPendingBookmark(true)
    const wasActive = bookmarkedActive
    setBookmarkedActive(!wasActive)
    setOptimisticBookmarks((c) => (wasActive ? Math.max(0, c - 1) : c + 1))
    if (!wasActive) {
      setBounceBookmark(true)
      setTimeout(() => setBounceBookmark(false), 600)
    }

    try {
      const result = await toggleBookmark(momentId)
      setBookmarkedActive(result.has_bookmarked)
      setOptimisticBookmarks(result.bookmarks_count)
      snapshotRef.current.bookmarks = result.bookmarks_count
    } catch (err: unknown) {
      // Revert optimistic update
      setBookmarkedActive(wasActive)
      setOptimisticBookmarks(snapshotRef.current.bookmarks)

      const msg = err instanceof Error ? err.message : ""
      if (msg === "login_required") {
        toast.error(t("community.loginToInteract"))
      } else {
        toast.error(t("community.bookmarkFailed"))
      }
    } finally {
      pendingRef.current.bookmark = false
      setPendingBookmark(false)
    }
  }, [data.actions.momentId, bookmarkedActive, onAction, t])

  const handleCommentOrRepost = useCallback((action: string) => {
    if (onAction) {
      onAction(action)
      return
    }
    toast.info(t("community.interactSoon"))
  }, [onAction, t])

  const { head, text, quote, attachment, actions } = data
  const allAttachments = attachment ? [attachment] : []

  const actionStats: StatProps[] = variant === "rich"
    ? [
        {
          icon: ThumbsUp,
          value: optimisticLikes,
          format: true,
          dataAction: "like",
          onClick: handleLike,
          disabled: pendingLike,
          loading: pendingLike,
          active: likedActive,
        },
        {
          icon: MessageCircle,
          value: actions.comments,
          format: true,
          dataAction: "comment",
          onClick: () => handleCommentOrRepost("comment"),
          disabled: true,
        },
        {
          icon: Repeat2,
          value: actions.reposts ?? 0,
          format: true,
          dataAction: "repost",
          onClick: () => handleCommentOrRepost("repost"),
          disabled: true,
        },
        {
          icon: Bookmark,
          value: optimisticBookmarks,
          format: true,
          dataAction: "bookmark",
          onClick: handleBookmark,
          disabled: pendingBookmark,
          loading: pendingBookmark,
          active: bookmarkedActive,
        },
      ]
    : [
        { icon: Eye, value: actions.views, format: true },
        {
          icon: MessageCircle,
          value: actions.comments,
          format: true,
          dataAction: "comment",
          onClick: () => handleCommentOrRepost("comment"),
          disabled: true,
        },
        {
          icon: Bookmark,
          value: optimisticBookmarks,
          format: true,
          dataAction: "bookmark",
          onClick: handleBookmark,
          disabled: pendingBookmark,
          loading: pendingBookmark,
          active: bookmarkedActive,
        },
      ]

  return (
    <article className={cn(
      "border-b border-border/60 last:border-b-0 bg-background px-3 py-2.5 hover:bg-surface-secondary/50 transition-colors duration-150",
      variant === "rich" && "grid gap-[9px]",
      className
    )}>
      <FeedHead data={head} />
      <div className="ml-[42px] space-y-[9px]">
        <p className="text-foreground leading-relaxed text-[15px]">
          {text}
        </p>
        {quote && (
          <blockquote className="border-l-[2px] border-primary/20 rounded-r-md px-3 py-1.5 text-[13px] text-muted-foreground italic">
            {quote}
          </blockquote>
        )}
        {allAttachments.length > 0 && (
          <div className={cn(
            "gap-2",
            allAttachments.length === 1 ? "grid" : "grid grid-cols-2",
          )}>
            {allAttachments.map((att, i) => (
              <Attachment key={i} data={att} />
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-[5px]">
          <StatsRow stats={actionStats} />
          <button
            className="inline-flex items-center justify-center size-[28px] rounded-[8px] hover:bg-surface-secondary text-muted-foreground transition-colors"
            aria-label={t("community.share")}
            onClick={handleShare}
          >
            <Share2 className="size-4" />
          </button>
        </div>
      </div>
    </article>
  )
}
