"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Send, Heart, MessageCircle, ChevronDown, User } from "lucide-react"
import { useTranslation } from "react-i18next"
import { PageMeta } from "@/components/content/page-meta"
import type { PageMetaData } from "@/components/content/page-meta"
import type { MiniPageCardData } from "@/components/content/mini-page-card"
import { ReadDrawer } from "@/components/layout/read-drawer"
import { BreadcrumbDynamicContext } from "@/components/layout/breadcrumb"
import type { BreadcrumbContextValue } from "@/components/layout/breadcrumb"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// --- Types ---

interface ReadPageClientProps {
  userSlug: string
  pageId: string
  pageHtml: string
  pageTitle: string
  pageDescription?: string | null
  pageUid: string
  pageViewCount: number
  pageFavoriteCount: number
  pageLikeCount: number
  pageCommentCount: number
  pageShareCount: number
  pagePublishedAt: Date | string | null
  pageTags: string[]
  pageCoverUrl?: string
  pageChaptersJson?: unknown
  pageSidePageUid?: string
  authorName: string
  authorAvatarUrl?: string | null
  authorFollowersCount: number
  isAuthenticated: boolean
  sessionUsername?: string
  sessionAvatarUrl?: string
  communityEntityId: string
  recommendations: MiniPageCardData[]
}

interface CommunityComment {
  id: string
  content: string
  created_at: string
  author: {
    id: string
    user_slug: string
    display_name: string
    avatar_url: string | null
  }
  reactions_count: number
  viewer_has_reacted: boolean
}

// --- Helpers ---

function extractChapters(html: string): { number: number; title: string }[] {
  const h2Regex = /<h2[^>]*>(.*?)<\/h2>/gi
  const chapters: { number: number; title: string }[] = []
  let match
  let num = 1
  while ((match = h2Regex.exec(html)) !== null) {
    chapters.push({ number: num++, title: match[1].replace(/<[^>]*>/g, "").trim() })
  }
  return chapters
}

function timeAgo(date: string | Date): string {
  const d = new Date(date)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "刚刚"
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  return `${Math.floor(days / 30)}个月前`
}

// --- Comment Composer (inline) ---

function CommentComposer({
  communityEntityId,
  isAuthenticated,
  sessionUsername,
  sessionAvatarUrl,
  onCommentPosted,
}: {
  communityEntityId: string
  isAuthenticated: boolean
  sessionUsername?: string
  sessionAvatarUrl?: string
  onCommentPosted: () => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!text.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/community/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: "published_page",
          entity_id: communityEntityId,
          content: text.trim(),
        }),
      })
      if (res.ok) {
        setText("")
        onCommentPosted()
      }
    } catch (err) {
      console.error("Failed to post comment:", err)
    } finally {
      setSubmitting(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <p className="py-3 text-center text-[13px] text-muted-foreground">
        {t('community.loginToComment')}
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
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('community.writeComment')}
          className="w-full min-h-[58px] rounded-[10px] border border-border bg-background p-2.5 text-sm resize-y focus:outline-none focus:border-primary placeholder:text-muted-foreground"
        />
        <div className="flex justify-end mt-1.5">
          <Button onClick={handleSubmit} disabled={!text.trim() || submitting} size="sm" className="gap-1.5 min-h-[38px]">
            <Send className="size-3.5" />
            {t('community.published')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// --- Comment Card ---

function CommentCard({ comment, onReaction }: { comment: CommunityComment; onReaction: (id: string) => void }) {
  return (
    <div className="grid gap-2 py-1.5 border-t border-border first:border-t-0" style={{ gridTemplateColumns: "auto 1fr" }}>
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
            onClick={() => onReaction(comment.id)}
            className={cn(
              "inline-flex items-center gap-1 text-[13px]",
              comment.viewer_has_reacted ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Heart className={cn("size-3.5", comment.viewer_has_reacted && "fill-current")} />
            {comment.reactions_count > 0 && <span>{comment.reactions_count}</span>}
          </button>
          <button className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
            <MessageCircle className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Comments Panel ---

function CommentsPanel({
  communityEntityId,
  isAuthenticated,
  sessionUsername,
  sessionAvatarUrl,
}: {
  communityEntityId: string
  isAuthenticated: boolean
  sessionUsername?: string
  sessionAvatarUrl?: string
}) {
  const { t } = useTranslation()
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<"latest" | "oldest">("latest")

  const fetchComments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        entity_type: "published_page",
        entity_id: communityEntityId,
        limit: "20",
      })
      const res = await fetch(`/api/community/comments?${params}`)
      if (res.ok) {
        const data = await res.json()
        setComments(data.comments ?? [])
      }
    } catch (err) {
      console.error("Failed to fetch comments:", err)
    } finally {
      setLoading(false)
    }
  }, [communityEntityId])

  useEffect(() => { fetchComments() }, [fetchComments])

  const sortedComments = [...comments].sort((a, b) => {
    const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    return sort === "latest" ? diff : -diff
  })

  const handleReaction = async (commentId: string) => {
    if (!isAuthenticated) return
    try {
      const res = await fetch(`/api/community/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction: true }),
      })
      if (res.ok) {
        // Optimistically update
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, viewer_has_reacted: !c.viewer_has_reacted, reactions_count: c.reactions_count + (c.viewer_has_reacted ? -1 : 1) }
              : c
          )
        )
      }
    } catch (err) {
      console.error("Failed to toggle reaction:", err)
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <button
          onClick={() => setSort(sort === "latest" ? "oldest" : "latest")}
          className="inline-flex items-center gap-1 h-[30px] px-2.5 rounded-full bg-surface-secondary text-[13px] font-bold text-muted-foreground hover:text-foreground"
        >
          {sort === "latest" ? "最新" : "最早"}
          <ChevronDown className="size-3" />
        </button>
      </div>
      <CommentComposer
        communityEntityId={communityEntityId}
        isAuthenticated={isAuthenticated}
        sessionUsername={sessionUsername}
        sessionAvatarUrl={sessionAvatarUrl}
        onCommentPosted={fetchComments}
      />
      {loading ? (
        <p className="py-4 text-center text-[13px] text-muted-foreground">{t('community.commentsLoading')}</p>
      ) : sortedComments.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-muted-foreground">{t('community.noComments')}</p>
      ) : (
        <div className="grid">
          {sortedComments.map((comment) => (
            <CommentCard key={comment.id} comment={comment} onReaction={handleReaction} />
          ))}
        </div>
      )}
    </div>
  )
}

// --- Main Component ---

export function ReadPageClient({
  userSlug,
  pageId,
  pageHtml,
  pageTitle,
  pageDescription,
  pageUid,
  pageViewCount,
  pageFavoriteCount,
  pageLikeCount,
  pageCommentCount,
  pageShareCount,
  pagePublishedAt,
  pageTags,
  pageCoverUrl,
  pageChaptersJson,
  pageSidePageUid,
  authorName,
  authorAvatarUrl,
  authorFollowersCount,
  isAuthenticated,
  sessionUsername,
  sessionAvatarUrl,
  communityEntityId,
  recommendations,
}: ReadPageClientProps) {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const isDrawerOpen = searchParams.get("drawer") === "open"

  // 参考 index.html: updateReaderHeaderSafe() — 动态测量 topbar 高度
  React.useEffect(() => {
    const measure = () => {
      const topbar = document.querySelector("header")
      const h = topbar ? Math.ceil(topbar.getBoundingClientRect().height) : 0
      document.documentElement.style.setProperty("--reader-header-safe", `${h}px`)
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  const chapters =
    Array.isArray(pageChaptersJson) && pageChaptersJson.length > 0
      ? (pageChaptersJson as { number: number; title: string }[])
      : extractChapters(pageHtml)

  const pageMeta: PageMetaData = {
    author: {
      name: authorName,
      fallbackText: authorName?.[0] ?? "?",
      avatarUrl: authorAvatarUrl ?? undefined,
      followerCount: authorFollowersCount,
    },
    title: pageTitle,
    uid: pageUid,
    sidePageUid: pageSidePageUid ?? undefined,
    description: pageDescription ? [pageDescription] : [],
    tags: pageTags,
    stats: {
      views: pageViewCount,
      bookmarks: pageFavoriteCount,
      date: pagePublishedAt
        ? new Date(pagePublishedAt).toISOString().slice(0, 10)
        : "",
    },
    actions: {
      likes: pageLikeCount,
      bookmarks: pageFavoriteCount,
      shares: pageShareCount,
    },
    chapters:
      chapters.length > 0
        ? chapters.map((ch) => ({
            number: ch.number,
            title: ch.title,
          }))
        : undefined,
    chapterProgress:
      chapters.length > 0
        ? { current: 0, total: chapters.length }
        : undefined,
    recommendations: recommendations.length > 0 ? recommendations : undefined,
  }

  const detailsTab = <PageMeta data={pageMeta} />
  const commentsTab = (
    <CommentsPanel
      communityEntityId={communityEntityId}
      isAuthenticated={isAuthenticated}
      sessionUsername={sessionUsername}
      sessionAvatarUrl={sessionAvatarUrl}
    />
  )
  const notesTab = (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-['Lexend'] text-[17px] font-bold">{t('community.notes')}</h2>
        <button className="text-[14px] font-bold text-primary hover:underline">{t('community.newNote')}</button>
      </div>
      <p className="py-4 text-center text-[13px] text-muted-foreground">{t('community.notesFeatureSoon')}</p>
    </div>
  )

  const breadcrumbContextValue: BreadcrumbContextValue = {
    labels: {
      [`/read/${userSlug}`]: { label: authorName, icon: User, href: `/author/${userSlug}` },
      [`/read/${userSlug}/${pageId}`]: { label: pageTitle },
    },
  }

  return (
    <BreadcrumbDynamicContext.Provider value={breadcrumbContextValue}>
      {isDrawerOpen && (
        <ReadDrawer
          tabs={[
            { value: "details", label: "详情", content: detailsTab },
            { value: "comments", label: "评论", badge: pageCommentCount, content: commentsTab },
            { value: "notes", label: "笔记", badge: 2, content: notesTab },
          ]}
          defaultTab="details"
        />
      )}

      {/* 参考 index.html .read-shell + .read-viewport + .read-iframe */}
      <div style={{ marginLeft: "calc(-50vw + 50%)", marginRight: "calc(-50vw + 50%)" }}>
        <div
          className="w-full bg-white dark:bg-[#0a0a0a] overflow-x-hidden"
          style={{
            height: "100vh",
            paddingTop: "var(--reader-header-safe, var(--nav-h, 56px))",
            transition: "padding-top 180ms ease",
          }}
        >
          <iframe
            title={pageTitle}
            srcDoc={pageHtml}
            onLoad={() => {
              // 参考 index.html: attachIframeScrollSignal — iframe 加载后重测 topbar
              const topbar = document.querySelector("header")
              const h = topbar ? Math.ceil(topbar.getBoundingClientRect().height) : 0
              document.documentElement.style.setProperty("--reader-header-safe", `${h}px`)
            }}
            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
            className="w-full border-0 bg-white dark:bg-[#0a0a0a]"
            style={{
              height: "calc(100vh - var(--reader-header-safe, var(--nav-h, 56px)))",
              minHeight: "calc(100vh - var(--reader-header-safe, var(--nav-h, 56px)))",
            }}
          />
        </div>
      </div>
    </BreadcrumbDynamicContext.Provider>
  )
}
