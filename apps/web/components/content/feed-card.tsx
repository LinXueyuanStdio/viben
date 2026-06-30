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
import { createComment } from "@/lib/api/community"
import { useToggleLike } from "@/hooks/use-toggle-like"
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
  username: string
  userSlug: string
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

  const like = useToggleLike({
    entityType: "moment",
    entityId: data.actions.momentId ?? "",
    initialLiked: data.actions.hasLiked ?? false,
    initialCount: data.actions.likes,
  })

  const [optimisticComments, setOptimisticComments] = useState(data.actions.comments)

  // Inline comment composer
  const [commentOpen, setCommentOpen] = useState(false)
  const [commentText, setCommentText] = useState("")
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const commentInputRef = useRef<HTMLInputElement>(null)

  // Sync comment count when data prop changes, skip if submitting
  useEffect(() => {
    if (commentSubmitting) return
    setOptimisticComments(data.actions.comments)
  }, [data.actions.comments, commentSubmitting])

  const handleShare = useCallback(() => {
    const text = `${data.head.name}: ${data.text.slice(0, 60)}${data.text.length > 60 ? "..." : ""}`
    const url = data.actions.shareUrl ?? window.location.href
    if (navigator.share) {
      navigator.share({ title: text, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`).catch(() => {})
    }
  }, [data.head.name, data.text, data.actions.shareUrl])

  const handleLikeWrap = useCallback(() => {
    if (onAction) { onAction("like"); return }
    if (!data.actions.momentId) { toast.info(t("community.interactSoon")); return }
    like.toggle().catch(() => {})
  }, [onAction, data.actions.momentId, like, t])

  const handleToggleComment = useCallback(() => {
    if (onAction) { onAction("comment"); return }
    if (!session) { toast.info(t("community.loginToInteract")); return }
    setCommentOpen((prev) => {
      if (!prev) setTimeout(() => commentInputRef.current?.focus(), 100)
      return !prev
    })
  }, [onAction, session, t])

  const handleSubmitComment = useCallback(async () => {
    const text = commentText.trim()
    if (!text || commentSubmitting) return
    const momentId = data.actions.momentId
    if (!momentId) return

    setCommentSubmitting(true)
    try {
      await createComment({ entityType: "moment", entityId: momentId, content: text })
      setOptimisticComments((c) => c + 1)
      setCommentText("")
      setCommentOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ""
      if (msg === "login_required") {
        toast.error(t("community.loginToInteract"))
      } else {
        toast.error(t("community.commentFailed"))
      }
    } finally {
      setCommentSubmitting(false)
    }
  }, [commentText, commentSubmitting, data.actions.momentId, t])

  const handleRepostPlaceholder = useCallback(() => {
    if (onAction) { onAction("repost"); return }
    toast.info(t("community.interactSoon"))
  }, [onAction, t])

  const { head, text, quote, attachment, actions } = data
  const allAttachments = attachment ? [attachment] : []

  const actionStats: StatProps[] = variant === "rich"
    ? [
        { icon: Eye, value: actions.views, format: true },
        {
          icon: ThumbsUp,
          value: like.count,
          format: true,
          dataAction: "like",
          onClick: handleLikeWrap,
          disabled: like.pending,
          loading: like.pending,
          active: like.liked,
          activeColor: "text-red-500",
          bounce: like.bounce,
        },
        {
          icon: MessageCircle,
          value: optimisticComments,
          format: true,
          dataAction: "comment",
          onClick: handleToggleComment,
          active: commentOpen,
          activeColor: "text-sky-500",
        },
        {
          icon: Repeat2,
          value: actions.reposts ?? 0,
          format: true,
          dataAction: "repost",
          onClick: handleRepostPlaceholder,
          disabled: true,
        },
      ]
    : [
        { icon: Eye, value: actions.views, format: true },
        {
          icon: ThumbsUp,
          value: like.count,
          format: true,
          dataAction: "like",
          onClick: handleLikeWrap,
          disabled: like.pending,
          loading: like.pending,
          active: like.liked,
          activeColor: "text-red-500",
          bounce: like.bounce,
        },
        {
          icon: MessageCircle,
          value: optimisticComments,
          format: true,
          dataAction: "comment",
          onClick: handleToggleComment,
          active: commentOpen,
          activeColor: "text-sky-500",
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
        {commentOpen && session && (
          <div className="flex items-center gap-2.5 pt-1">
            <Avatar className="size-[28px] shrink-0">
              <AvatarImage src={session.avatarUrl} alt={session.username} />
              <AvatarFallback>{session.username[0] ?? "?"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 flex items-center gap-2">
              <input
                ref={commentInputRef}
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmitComment() } }}
                placeholder={t("community.commentPlaceholder")}
                maxLength={500}
                disabled={commentSubmitting}
                className="flex-1 min-w-0 h-[34px] px-3 rounded-full border border-border bg-surface-secondary text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
              />
              <button
                type="button"
                onClick={handleSubmitComment}
                disabled={!commentText.trim() || commentSubmitting}
                className="inline-flex items-center justify-center size-[30px] shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/85 disabled:opacity-40 transition-colors"
                aria-label={t("community.send")}
              >
                {commentSubmitting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
