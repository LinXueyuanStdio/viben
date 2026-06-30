"use client"

import { useCallback, useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Eye, MessageCircle, ThumbsUp, Repeat2, Share2, Send, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { FeedHead } from "./feed-head"
import type { FeedHeadData } from "./feed-head"
import { Attachment } from "./attachment"
import type { AttachmentData } from "./attachment"
import { StatsRow } from "./stats-row"
import type { StatProps } from "./stats-row"
import { cn } from "@/lib/utils"
import { toggleReaction, createComment } from "@/lib/api/community"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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
    momentId?: string
    shareUrl?: string
    hasLiked?: boolean
  }
}

export interface FeedCardSession {
  userId: string
  username: string
  avatarUrl?: string
}

interface FeedCardProps {
  data: FeedCardData
  variant?: "preloaded" | "rich"
  className?: string
  session?: FeedCardSession | null
  onAction?: (action: string) => void
}

export function FeedCard({ data, variant = "preloaded", className, session, onAction }: FeedCardProps) {
  const { t } = useTranslation()

  const [optimisticLikes, setOptimisticLikes] = useState(data.actions.likes)
  const [likedActive, setLikedActive] = useState(data.actions.hasLiked ?? false)
  const [pendingLike, setPendingLike] = useState(false)
  const [bounceLike, setBounceLike] = useState(false)

  // Ref-based guard so useEffect doesn't overwrite in-flight mutations
  const pendingRef = useRef({ like: false })
  // Snapshot refs for safe rollback
  const snapshotRef = useRef({ likes: data.actions.likes })

  // Sync state when data prop changes (e.g., after page re-render with fresh data),
  // but skip if a mutation is in-flight to avoid overwriting optimistic updates.
  useEffect(() => {
    if (pendingRef.current.like) return
    setOptimisticLikes(data.actions.likes)
    setLikedActive(data.actions.hasLiked ?? false)
    snapshotRef.current = { likes: data.actions.likes }
  }, [data.actions.likes, data.actions.hasLiked])

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
          activeColor: "text-red-500",
          bounce: bounceLike,
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
