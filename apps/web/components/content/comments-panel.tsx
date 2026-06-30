"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Send, ThumbsUp, MessageCircle, ChevronDown, Trash2, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createComment } from "@/lib/api/community"
import { useToggleLike } from "@/hooks/use-toggle-like"
import { timeAgo } from "@/lib/services/moment-mapper"

// --- Types ---

interface CommunityComment {
  id: string
  content: string
  created_at: string
  updated_at: string
  depth: number
  parent_comment_id?: string | null
  replies_count: number
  reactions_count: number
  viewer_has_reacted: boolean
  author: {
    id: string
    user_slug: string
    display_name: string
    avatar_url: string | null
  }
}

interface CommentsPanelProps {
  communityEntityId: string
  /** 页面在 published_pages 表中的 DB ID，用于评论 API 的 entity_id */
  pageDbId: string
  /** entity_type for comments API, defaults to "published_page" */
  entityType?: "published_page" | "moment"
  isAuthenticated: boolean
  sessionUsername?: string
  sessionAvatarUrl?: string
  sessionUserId?: string
  initialComments: CommunityComment[]
  initialNextCursor: string | null
}

// --- Comment Composer ---

function CommentComposer({
  communityEntityId,
  pageDbId,
  entityType = "published_page",
  isAuthenticated,
  sessionUsername,
  sessionAvatarUrl,
  replyTo,
  parentCommentId,
  onCommentPosted,
  onCancelReply,
}: {
  communityEntityId: string
  pageDbId: string
  entityType?: "published_page" | "moment"
  isAuthenticated: boolean
  sessionUsername?: string
  sessionAvatarUrl?: string
  replyTo?: string | null
  parentCommentId?: string | null
  onCommentPosted: () => void
  onCancelReply?: () => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus and pre-fill when replyTo changes
  useEffect(() => {
    if (replyTo) {
      setText(`@${replyTo} `)
      requestAnimationFrame(() => {
        textareaRef.current?.focus()
        const len = textareaRef.current?.value.length ?? 0
        textareaRef.current?.setSelectionRange(len, len)
      })
    }
  }, [replyTo])

  const handleSubmit = async () => {
    if (!text.trim() || submitting) return
    setSubmitting(true)
    try {
      await createComment({
        entityType,
        entityId: pageDbId,
        content: text.trim(),
        parentCommentId: parentCommentId ?? null,
      })
      setText("")
      onCommentPosted()
    } catch {
      toast.error(t("community.commentFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <p className="py-3 text-center text-[13px] text-muted-foreground">
        {t("community.loginToComment")}
      </p>
    )
  }

  return (
    <div className="grid gap-[9px]" style={{ gridTemplateColumns: "auto 1fr" }}>
      <Avatar className="size-[28px] shrink-0 mt-1">
        <AvatarImage src={sessionAvatarUrl ?? undefined} alt={sessionUsername ?? ""} />
        <AvatarFallback>{sessionUsername?.[0] ?? "?"}</AvatarFallback>
      </Avatar>
      <div>
        {replyTo && (
          <div className="flex items-center gap-2 mb-1.5 text-[13px] text-muted-foreground">
            <span>{t("community.replyingTo", { name: replyTo })}</span>
            {onCancelReply && (
              <button onClick={onCancelReply} className="text-primary hover:underline text-[12px]">
                {t("community.cancel")}
              </button>
            )}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("community.writeComment")}
          className="w-full min-h-[58px] rounded-[10px] border border-border bg-background p-2.5 text-sm resize-y focus:outline-none focus:border-primary placeholder:text-muted-foreground"
        />
        <div className="flex justify-end mt-1.5">
          <Button onClick={handleSubmit} disabled={!text.trim() || submitting} size="sm" className="gap-1.5 min-h-[38px]">
            <Send className="size-3.5" />
            {t("community.published")}
          </Button>
        </div>
      </div>
    </div>
  )
}

// --- Comment Card ---

function CommentCard({
  comment,
  onReply,
  onDelete,
  sessionUserId,
}: {
  comment: CommunityComment
  onReply?: (username: string, commentId: string) => void
  onDelete?: (id: string) => void
  sessionUserId?: string
}) {
  const { t } = useTranslation()
  const isOwnComment = sessionUserId ? comment.author.id === sessionUserId : false

  const like = useToggleLike({
    entityType: "comment",
    entityId: comment.id,
    initialLiked: comment.viewer_has_reacted,
    initialCount: comment.reactions_count,
  })

  return (
    <div className={cn("grid gap-2 py-1.5 border-t border-border first:border-t-0", like.bounce && "animate-bounce-in")} style={{ gridTemplateColumns: "auto 1fr" }}>
      <Avatar className="size-[28px] shrink-0">
        <AvatarImage src={comment.author.avatar_url ?? undefined} alt={comment.author.display_name} />
        <AvatarFallback>{comment.author.display_name?.[0] ?? "?"}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
          <span className="font-bold">{comment.author.display_name}</span>
          <span className="inline-block size-[3px] rounded-full bg-[#9bb8c2] dark:bg-muted-foreground/40 shrink-0" />
          <span className="text-muted-foreground">{timeAgo(comment.created_at)}</span>
        </div>
        <p className="text-[#173f4c] dark:text-foreground leading-relaxed text-sm mt-1">{comment.content}</p>
        <div className="flex items-center gap-4 mt-2">
          <button
            onClick={() => like.toggle().catch(() => {})}
            disabled={like.pending}
            className={cn(
              "inline-flex items-center gap-1 text-[13px] transition-colors",
              like.liked ? "text-red-500 font-bold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {like.pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ThumbsUp className={cn("size-3.5 transition-transform duration-200", like.liked && "fill-current scale-110")} />
            )}
            {like.count > 0 && <span>{like.count}</span>}
          </button>
          <button
            onClick={() => onReply?.(comment.author.display_name, comment.id)}
            className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageCircle className="size-3.5" />
          </button>
          {isOwnComment && (
            <button
              onClick={() => onDelete?.(comment.id)}
              className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-destructive transition-colors"
              aria-label={t("community.delete")}
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Comments Panel ---

export function CommentsPanel({
  communityEntityId,
  pageDbId,
  entityType = "published_page",
  isAuthenticated,
  sessionUsername,
  sessionAvatarUrl,
  sessionUserId,
  initialComments,
  initialNextCursor,
}: CommentsPanelProps) {
  const { t } = useTranslation()
  const [comments, setComments] = useState<CommunityComment[]>(initialComments)
  const [loading, setLoading] = useState(false)
  const [sort, setSort] = useState<"latest" | "oldest">("latest")
  const [replyTo, setReplyTo] = useState<{ username: string; commentId: string } | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchComments = useCallback(async (cursor?: string | null) => {
    if (cursor) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    try {
      const params = new URLSearchParams({
        entity_type: entityType,
        entity_id: pageDbId,
        limit: "20",
      })
      if (cursor) params.set("cursor", cursor)
      const res = await fetch(`/api/community/comments?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (cursor) {
          setComments((prev) => [...prev, ...(data.comments ?? [])])
        } else {
          setComments(data.comments ?? [])
        }
        setNextCursor(data.next_cursor ?? null)
      }
    } catch (err) {
      console.error("Failed to fetch comments:", err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [pageDbId])

  // Refresh after posting a new comment
  const refreshComments = useCallback(() => {
    fetchComments()
  }, [fetchComments])

  const sortedComments = [...comments].sort((a, b) => {
    const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    return sort === "latest" ? diff : -diff
  })

  const handleDelete = async (commentId: string) => {
    if (!window.confirm(t("community.deleteConfirm"))) return
    try {
      const res = await fetch(`/api/community/comments/${commentId}`, { method: "DELETE" })
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId))
      } else {
        toast.error(t("community.deleteFailed"))
      }
    } catch {
      toast.error(t("community.deleteFailed"))
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <button
          onClick={() => setSort(sort === "latest" ? "oldest" : "latest")}
          className="inline-flex items-center gap-1 h-[30px] px-2.5 rounded-full bg-surface-secondary text-[13px] font-bold text-muted-foreground hover:text-foreground"
        >
          {sort === "latest" ? t("community.latest") : t("community.oldest")}
          <ChevronDown className="size-3" />
        </button>
      </div>
      <CommentComposer
        communityEntityId={communityEntityId}
        pageDbId={pageDbId}
        entityType={entityType}
        isAuthenticated={isAuthenticated}
        sessionUsername={sessionUsername}
        sessionAvatarUrl={sessionAvatarUrl}
        replyTo={replyTo?.username ?? null}
        parentCommentId={replyTo?.commentId ?? null}
        onCommentPosted={() => {
          setReplyTo(null)
          refreshComments()
        }}
        onCancelReply={() => setReplyTo(null)}
      />
      {loading ? (
        <p className="py-4 text-center text-[13px] text-muted-foreground">{t("community.commentsLoading")}</p>
      ) : sortedComments.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-muted-foreground">{t("community.noComments")}</p>
      ) : (
        <>
          <div className="grid">
            {sortedComments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                onReply={(username, commentId) => setReplyTo({ username, commentId })}
                onDelete={handleDelete}
                sessionUserId={sessionUserId}
              />
            ))}
          </div>
          {nextCursor && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => fetchComments(nextCursor)}
              disabled={loadingMore}
            >
              {loadingMore ? t("community.loading") : t("community.loadMore")}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
