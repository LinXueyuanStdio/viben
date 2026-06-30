"use client"

import { useCallback, useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Eye, MessageCircle, Bookmark, Heart, Repeat2, Share2 } from "lucide-react"
import { toast } from "sonner"
import { FeedHead } from "./feed-head"
import type { FeedHeadData } from "./feed-head"
import { Attachment } from "./attachment"
import type { AttachmentData } from "./attachment"
import { StatsRow } from "./stats-row"
import type { StatProps } from "./stats-row"
import { cn } from "@/lib/utils"

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
  }
}

interface FeedCardProps {
  data: FeedCardData
  variant?: "preloaded" | "rich"
  className?: string
  onAction?: (action: string) => void
}

async function callCommunityApi(action: string, momentId: string) {
  let url = ""
  let body: Record<string, string> = {}

  if (action === "like") {
    url = "/api/community/reactions/toggle"
    body = { entity_type: "moment", entity_id: momentId, reaction_type: "like" }
  } else if (action === "bookmark") {
    url = "/api/community/favorites/toggle"
    body = { entity_type: "moment", entity_id: momentId }
  } else {
    return null
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (res.status === 401) throw new Error("login_required")
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.code ?? "api_error")
  }
  return res.json()
}

export function FeedCard({ data, variant = "preloaded", className, onAction }: FeedCardProps) {
  const { t } = useTranslation()

  const [optimisticLikes, setOptimisticLikes] = useState(data.actions.likes)
  const [optimisticBookmarks, setOptimisticBookmarks] = useState(data.actions.bookmarks)
  const [likedActive, setLikedActive] = useState(false)
  const [bookmarkedActive, setBookmarkedActive] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  // Sync state when data prop changes (e.g., after page re-render with fresh data)
  useEffect(() => {
    setOptimisticLikes(data.actions.likes)
    setOptimisticBookmarks(data.actions.bookmarks)
    setLikedActive(false)
    setBookmarkedActive(false)
  }, [data.actions.likes, data.actions.bookmarks])

  const handleShare = useCallback(() => {
    const text = `${data.head.name}: ${data.text.slice(0, 60)}${data.text.length > 60 ? "..." : ""}`
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title: text, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`).catch(() => {})
    }
  }, [data.head.name, data.text])

  const handleAction = useCallback(async (action: string) => {
    // If parent provides onAction, delegate to it
    if (onAction) {
      onAction(action)
      return
    }

    const momentId = data.actions.momentId
    if (!momentId) {
      toast.info(t("community.interactSoon"))
      return
    }

    // Comment and repost are not yet supported via API for moments
    if (action === "comment" || action === "repost") {
      toast.info(t("community.interactSoon"))
      return
    }

    // Optimistic update
    setPendingAction(action)
    if (action === "like") {
      const wasActive = likedActive
      setLikedActive(!wasActive)
      setOptimisticLikes((c) => wasActive ? Math.max(0, c - 1) : c + 1)
    } else if (action === "bookmark") {
      const wasActive = bookmarkedActive
      setBookmarkedActive(!wasActive)
      setOptimisticBookmarks((c) => wasActive ? Math.max(0, c - 1) : c + 1)
    }

    try {
      const result = await callCommunityApi(action, momentId)

      if (action === "like" && result) {
        // Sync with actual server state
        setLikedActive(result.has_reacted)
        setOptimisticLikes(result.reactions_count)
      } else if (action === "bookmark" && result) {
        setBookmarkedActive(result.has_favorited)
        setOptimisticBookmarks(result.favorites_count)
      }
    } catch (err: unknown) {
      // Revert optimistic update
      if (action === "like") {
        setLikedActive((prev) => !prev)
        setOptimisticLikes(data.actions.likes)
      } else if (action === "bookmark") {
        setBookmarkedActive((prev) => !prev)
        setOptimisticBookmarks(data.actions.bookmarks)
      }

      const msg = err instanceof Error ? err.message : ""
      if (msg === "login_required") {
        toast.error(t("community.loginToInteract"))
      } else if (msg === "community_entity_not_found") {
        toast.info(t("community.interactSoon"))
      } else {
        toast.error(action === "like" ? t("community.likeFailed") : t("community.bookmarkFailed"))
      }
    } finally {
      setPendingAction(null)
    }
  }, [data.actions.momentId, data.actions.likes, data.actions.bookmarks, likedActive, bookmarkedActive, onAction, t])

  const { head, text, quote, attachment, actions } = data

  const actionStats: StatProps[] = variant === "rich"
    ? [
        { icon: Heart, value: optimisticLikes, format: true, dataAction: "like", onClick: handleAction },
        { icon: MessageCircle, value: actions.comments, format: true, dataAction: "comment", onClick: handleAction },
        { icon: Repeat2, value: actions.reposts ?? 0, format: true, dataAction: "repost", onClick: handleAction },
        { icon: Bookmark, value: optimisticBookmarks, format: true, dataAction: "bookmark", onClick: handleAction },
      ]
    : [
        { icon: Eye, value: actions.views, format: true },
        { icon: MessageCircle, value: actions.comments, format: true, dataAction: "comment", onClick: handleAction },
        { icon: Bookmark, value: optimisticBookmarks, format: true, dataAction: "bookmark", onClick: handleAction },
      ]

  return (
    <article className={cn(
      "border border-border rounded-[12px] bg-background shadow-sm p-2.5",
      variant === "rich" && "grid gap-[9px]",
      className
    )}>
      <FeedHead data={head} />
      <div className="ml-[42px] space-y-[9px]">
        <p className="text-[#173f4c] dark:text-foreground leading-relaxed text-sm">
          {text}
        </p>
        {quote && (
          <blockquote className="border-l-[3px] border-primary/30 rounded-r-md bg-primary/5 px-3 py-2 text-[13px] text-[#173f4c] dark:text-foreground">
            {quote}
          </blockquote>
        )}
        {attachment && <Attachment data={attachment} />}
        <div className="flex items-center justify-between mt-[5px]">
          <StatsRow stats={actionStats} />
          <button
            className="inline-flex items-center justify-center size-[30px] rounded-[9px] hover:bg-surface-secondary text-muted-foreground"
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
