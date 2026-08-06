"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { Send, ThumbsUp, MessageCircle, ChevronDown, Trash2, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createComment } from "@/lib/api/community"
import { useToggleLike } from "@/hooks/use-toggle-like"
import { timeAgo } from "@/lib/services/moment-mapper"

/** Parse @mentions in comment text and render as blue links */
function renderMentionText(text: string): React.ReactNode {
  const parts = text.split(/(@\S+)/g)
  return parts.map((part, i) => {
    if (part.startsWith("@") && part.length > 1) {
      const name = part.slice(1)
      const href = `/${encodeURIComponent(name)}`
      return (
        <Link key={i} href={href} className="text-primary hover:underline font-medium">
          {part}
        </Link>
      )
    }
    return part
  })
}

// --- Types ---

export interface CommunityComment {
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
  entityType?: "published_page" | "moment" | "project"
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
  entityType?: "published_page" | "moment" | "project"
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
            {t("community.send")}
          </Button>
        </div>
      </div>
    </div>
  )
}

// --- Comment Card ---

function CommentCard({
  comment,
  entityType,
  pageDbId,
  isAuthenticated,
  onReply,
  onDelete,
  sessionUserId,
}: {
  comment: CommunityComment
  entityType?: "published_page" | "moment" | "project"
  pageDbId?: string
  isAuthenticated?: boolean
  onReply?: (username: string, commentId: string) => void
  onDelete?: (id: string) => void
  sessionUserId?: string
}) {
  const { t } = useTranslation()
  const isOwnComment = sessionUserId ? comment.author.id === sessionUserId : false
  const queryClient = useQueryClient()
  const [threadOpen, setThreadOpen] = useState(false)
  const [replyPage, setReplyPage] = useState(0)
  const [threadText, setThreadText] = useState("")
  const [threadSubmitting, setThreadSubmitting] = useState(false)
  const [replyToUser, setReplyToUser] = useState<string | null>(null)
  const [inlineReplyOpen, setInlineReplyOpen] = useState(false)
  const [inlineReplyText, setInlineReplyText] = useState("")
  const [inlineReplySubmitting, setInlineReplySubmitting] = useState(false)
  const [optimisticRepliesCount, setOptimisticRepliesCount] = useState(comment.replies_count)

  useEffect(() => { setOptimisticRepliesCount(comment.replies_count) }, [comment.replies_count])

  // Preload replies (max 2) — cached by react-query
  const preloadQuery = useQuery({
    queryKey: ["replies", entityType, pageDbId, comment.id, "preload"],
    queryFn: async () => {
      const r = await fetch(`/api/community/comments?entity_type=${entityType}&entity_id=${pageDbId}&parent_comment_id=${comment.id}&limit=2`)
      const d = await r.json()
      return (d.comments ?? []) as CommunityComment[]
    },
    enabled: comment.replies_count > 0 && !!pageDbId,
    staleTime: 60_000,
  })

  // Thread current page — cached by react-query
  const threadQuery = useQuery({
    queryKey: ["replies", entityType, pageDbId, comment.id, "thread", replyPage],
    queryFn: async () => {
      // For page 0, fetch first page directly
      if (replyPage === 0) {
        const r = await fetch(`/api/community/comments?entity_type=${entityType}&entity_id=${pageDbId}&parent_comment_id=${comment.id}&limit=10`)
        const d = await r.json()
        // Store cursor for next page in cache metadata
        queryClient.setQueryData(["replies-cursor", entityType, pageDbId, comment.id, replyPage], d.next_cursor ?? null)
        return d as { comments: CommunityComment[]; has_more: boolean }
      }
      // For subsequent pages, use cursor from previous page
      const cursor = queryClient.getQueryData(["replies-cursor", entityType, pageDbId, comment.id, replyPage - 1]) as string | null | undefined
      if (!cursor) return { comments: [], has_more: false }
      const params = new URLSearchParams({ entity_type: entityType!, entity_id: pageDbId!, parent_comment_id: comment.id, limit: "10", cursor })
      const r = await fetch(`/api/community/comments?${params}`)
      const d = await r.json()
      queryClient.setQueryData(["replies-cursor", entityType, pageDbId, comment.id, replyPage], d.next_cursor ?? null)
      return d as { comments: CommunityComment[]; has_more: boolean }
    },
    enabled: threadOpen && !!pageDbId,
    staleTime: 60_000,
  })

  const replies = preloadQuery.data ?? []
  const threadData = threadQuery.data
  const threadComments = threadData?.comments ?? []
  const threadHasMore = threadData?.has_more ?? false
  const threadLoading = threadQuery.isFetching

  const handleInlineReplySubmit = async () => {
    if (!inlineReplyText.trim() || inlineReplySubmitting) return
    setInlineReplySubmitting(true)
    try {
      await createComment({ entityType: entityType as "published_page" | "moment", entityId: pageDbId!, content: inlineReplyText.trim(), parentCommentId: comment.id })
      setInlineReplyText("")
      setInlineReplyOpen(false)
      setOptimisticRepliesCount((c) => c + 1)
      queryClient.invalidateQueries({ queryKey: ["replies", entityType, pageDbId, comment.id] })
    } catch {
      toast.error(t("community.commentFailed"))
    } finally {
      setInlineReplySubmitting(false)
    }
  }

  const handleThreadSubmit = async () => {
    if (!threadText.trim() || threadSubmitting) return
    setThreadSubmitting(true)
    try {
      await createComment({
        entityType: entityType as "published_page" | "moment",
        entityId: pageDbId!,
        content: threadText.trim(),
        parentCommentId: comment.id,
      })
      setThreadText("")
      setReplyToUser(null)
      setOptimisticRepliesCount((c) => c + 1)
      // Invalidate and refetch cached replies
      queryClient.invalidateQueries({ queryKey: ["replies", entityType, pageDbId, comment.id] })
      setReplyPage(0)
    } catch {
      toast.error(t("community.commentFailed"))
    } finally {
      setThreadSubmitting(false)
    }
  }

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
          <Link href={`/${encodeURIComponent(comment.author.user_slug)}`} className="font-bold hover:underline">
            {comment.author.display_name}
          </Link>
          <span className="inline-block size-[3px] rounded-full bg-[#9bb8c2] dark:bg-muted-foreground/40 shrink-0" />
          <span className="text-muted-foreground">{timeAgo(comment.created_at)}</span>
        </div>
        <p className="text-[#173f4c] dark:text-foreground leading-relaxed text-sm mt-1">{renderMentionText(comment.content)}</p>
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
            onClick={() => {
              if (!isAuthenticated) { toast.error(t("community.loginToInteract")); return }
              setInlineReplyOpen(!inlineReplyOpen)
              if (!inlineReplyOpen) setInlineReplyText(`@${comment.author.display_name} `)
            }}
            className={cn(
              "inline-flex items-center gap-1 text-[13px] transition-colors",
              inlineReplyOpen ? "text-sky-500" : "text-muted-foreground hover:text-foreground"
            )}
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

        {/* Inline reply composer */}
        {inlineReplyOpen && (
          <div className="flex items-center gap-2 mt-2">
            <input
              value={inlineReplyText}
              onChange={(e) => setInlineReplyText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleInlineReplySubmit() } }}
              placeholder={t("community.writeComment")}
              disabled={inlineReplySubmitting}
              className="flex-1 min-w-0 rounded-full border border-border bg-surface-secondary px-3 py-1.5 text-[13px] outline-none focus:border-primary/50 placeholder:text-muted-foreground"
            />
            <button
              onClick={handleInlineReplySubmit}
              disabled={!inlineReplyText.trim() || inlineReplySubmitting}
              className="shrink-0 text-[13px] text-primary font-bold hover:underline disabled:opacity-40"
            >
              {inlineReplySubmitting ? <Loader2 className="size-3.5 animate-spin" /> : t("community.send")}
            </button>
          </div>
        )}

        {/* Preloaded replies — hidden when thread is open to avoid duplication */}
        {!threadOpen && replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {replies.map((r) => (
              <div key={r.id} className="grid gap-2 text-[13px]" style={{ gridTemplateColumns: "auto 1fr" }}>
                <Avatar className="size-[20px] shrink-0">
                  <AvatarImage src={r.author.avatar_url ?? undefined} alt={r.author.display_name} />
                  <AvatarFallback className="text-[10px]">{r.author.display_name?.[0] ?? "?"}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Link href={`/${encodeURIComponent(r.author.user_slug)}`} className="font-bold hover:underline">
                      {r.author.display_name}
                    </Link>
                    <span className="text-muted-foreground text-[12px]">{timeAgo(r.created_at)}</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed mt-0.5">{renderMentionText(r.content)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* "查看全部 N 条回复" button */}
        {optimisticRepliesCount > 2 && (
          <button
            onClick={() => setThreadOpen(!threadOpen)}
            className="mt-1.5 text-[13px] text-primary hover:underline font-bold"
          >
            {threadOpen
              ? t("community.collapseReplies")
              : t("community.viewReplies", { count: optimisticRepliesCount })}
          </button>
        )}

        {/* Thread sub-panel */}
        {threadOpen && (
          <div className="mt-2 space-y-2">
            {threadLoading && threadComments.length === 0 ? (
              <p className="text-[13px] text-muted-foreground py-2">{t("community.commentsLoading")}</p>
            ) : (
              threadComments.map((r) => (
                <ThreadReply
                  key={r.id}
                  reply={r}
                  onReply={(username) => { setReplyToUser(username); setThreadText(`@${username} `) }}
                />
              ))
            )}
            {threadHasMore && (
              <div className="flex items-center justify-between pt-1 text-[13px]">
                <button
                  onClick={() => setReplyPage((p) => Math.max(0, p - 1))}
                  disabled={replyPage === 0 || threadLoading}
                  className="text-primary hover:underline disabled:opacity-40 disabled:no-underline"
                >
                  {t("community.prevPage")}
                </button>
                <span className="text-muted-foreground">{replyPage + 1}</span>
                <button
                  onClick={() => setReplyPage((p) => p + 1)}
                  disabled={threadLoading}
                  className="text-primary hover:underline disabled:opacity-40 disabled:no-underline"
                >
                  {t("community.nextPage")}
                </button>
              </div>
            )}
            {/* Mini composer */}
            {isAuthenticated ? (
              <div className="pt-1 space-y-1.5">
                {replyToUser && (
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <span>{t("community.replyingTo", { name: replyToUser })}</span>
                    <button
                      onClick={() => { setReplyToUser(null); setThreadText("") }}
                      className="text-primary hover:underline"
                    >
                      {t("community.cancel")}
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    value={threadText}
                    onChange={(e) => setThreadText(e.target.value)}
                    placeholder={t("community.writeComment")}
                    className="flex-1 min-w-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-primary placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={handleThreadSubmit}
                    disabled={!threadText.trim() || threadSubmitting}
                    className="shrink-0 inline-flex items-center gap-1 text-[13px] text-primary font-bold hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {threadSubmitting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    {t("community.published")}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">{t("community.loginToComment")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Thread Reply ---

function ThreadReply({
  reply,
  onReply,
}: {
  reply: CommunityComment
  onReply?: (username: string) => void
}) {
  const { t } = useTranslation()
  const threadLike = useToggleLike({
    entityType: "comment",
    entityId: reply.id,
    initialLiked: reply.viewer_has_reacted,
    initialCount: reply.reactions_count,
  })

  return (
    <div className="grid gap-2 text-[13px] py-1" style={{ gridTemplateColumns: "auto 1fr" }}>
      <Avatar className="size-[20px] shrink-0">
        <AvatarImage src={reply.author.avatar_url ?? undefined} alt={reply.author.display_name} />
        <AvatarFallback className="text-[10px]">{reply.author.display_name?.[0] ?? "?"}</AvatarFallback>
      </Avatar>
      <div>
        <div className="flex items-center gap-1.5">
          <Link href={`/${encodeURIComponent(reply.author.user_slug)}`} className="font-bold hover:underline">
            {reply.author.display_name}
          </Link>
          <span className="text-muted-foreground text-[12px]">{timeAgo(reply.created_at)}</span>
        </div>
        <p className="text-foreground leading-relaxed mt-0.5">{renderMentionText(reply.content)}</p>
        <div className="flex items-center gap-4 mt-1.5">
          <button
            onClick={() => threadLike.toggle().catch(() => {})}
            disabled={threadLike.pending}
            className={cn(
              "inline-flex items-center gap-1 text-[12px] transition-colors",
              threadLike.liked ? "text-red-500 font-bold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {threadLike.pending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <ThumbsUp className={cn("size-3 transition-transform duration-200", threadLike.liked && "fill-current scale-110")} />
            )}
            {threadLike.count > 0 && <span>{threadLike.count}</span>}
          </button>
          <button
            onClick={() => onReply?.(reply.author.display_name)}
            className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageCircle className="size-3" />
            {reply.replies_count > 0 && <span>{reply.replies_count}</span>}
          </button>
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
                entityType={entityType}
                pageDbId={pageDbId}
                isAuthenticated={isAuthenticated}
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
