"use client"

import React, { useMemo } from "react"
import { User } from "lucide-react"
import { useTranslation } from "react-i18next"
import { PageMeta } from "@/components/content/page-meta"
import type { PageMetaData } from "@/components/content/page-meta"
import type { MiniPageCardData } from "@/components/content/mini-page-card"
import { ReadDrawer } from "@/components/layout/read-drawer"
import { NotesPanel } from "@/components/content/notes-panel"
import { CommentsPanel } from "@/components/content/comments-panel"
import { BreadcrumbDynamicContext } from "@/components/layout/breadcrumb"
import type { BreadcrumbContextValue } from "@/components/layout/breadcrumb"

// --- Types ---

interface ChapterEntry {
  number: number
  title: string
  status?: string
  /** page slug for navigating to this chapter's page */
  page_slug?: string
}

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
  sessionUserSlug?: string
  sessionUserId?: string
  communityEntityId: string
  recommendationEntries: Array<{ data: MiniPageCardData; href: string }>
  viewerHasReacted: boolean
  viewerHasFavorited: boolean
  initialComments: Array<{
    id: string
    content: string
    created_at: string
    updated_at: string
    depth: number
    replies_count: number
    reactions_count: number
    viewer_has_reacted: boolean
    author: {
      id: string
      user_slug: string
      display_name: string
      avatar_url: string | null
    }
  }>
  initialCommentsNextCursor: string | null
}

// --- Parse chapters from JSON ---

interface ParsedChapters {
  chapters: ChapterEntry[]
  collectionSlug?: string
  collectionName?: string
}

function parseChapters(raw: unknown): ParsedChapters {
  if (!raw || typeof raw !== "object") return { chapters: [] }

  // New format: { collection_slug, collection_name, chapters: [...] }
  const obj = raw as Record<string, unknown>
  if (obj.collection_slug && Array.isArray(obj.chapters)) {
    const chapters = (obj.chapters as Array<Record<string, unknown>>).filter(
      (ch): ch is ChapterEntry =>
        typeof ch === "object" && ch !== null &&
        typeof (ch as Record<string, unknown>).number === "number" &&
        typeof (ch as Record<string, unknown>).title === "string"
    )
    return {
      chapters,
      collectionSlug: typeof obj.collection_slug === "string" ? obj.collection_slug : undefined,
      collectionName: typeof obj.collection_name === "string" ? obj.collection_name : undefined,
    }
  }

  // Old format: [{ number, title, page_slug }]
  if (Array.isArray(raw)) {
    const chapters = (raw as Array<Record<string, unknown>>).filter(
      (ch): ch is ChapterEntry =>
        typeof ch === "object" && ch !== null &&
        typeof (ch as Record<string, unknown>).number === "number" &&
        typeof (ch as Record<string, unknown>).title === "string"
    )
    return { chapters }
  }

  return { chapters: [] }
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
  sessionUserSlug,
  sessionUserId,
  communityEntityId,
  recommendationEntries,
  viewerHasReacted,
  viewerHasFavorited,
  initialComments,
  initialCommentsNextCursor,
}: ReadPageClientProps) {
  const { t } = useTranslation()

  // 通知 Topbar 当前阅读页是否有副页（side page）
  React.useEffect(() => {
    document.documentElement.setAttribute("data-read-has-side-page", pageSidePageUid ? "1" : "0")
    return () => {
      document.documentElement.removeAttribute("data-read-has-side-page")
    }
  }, [pageSidePageUid])

  // 合集章节数据：仅来自 pageChaptersJson，不从 HTML H2 提取
  const { chapters, collectionSlug, collectionName } = parseChapters(pageChaptersJson)

  // 找出当前页面在合集中的位置（通过 pageId 匹配 page_slug）
  const currentChapterIndex = chapters.findIndex((ch) => ch.page_slug === pageId)
  const currentChapter = currentChapterIndex >= 0 ? currentChapterIndex + 1 : 0 // 1-indexed

  const pageMeta: PageMetaData = {
    author: {
      name: authorName,
      fallbackText: authorName?.[0] ?? "?",
      avatarUrl: authorAvatarUrl ?? undefined,
      userSlug: userSlug,
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
    chapters: chapters.length > 0
      ? chapters.map((ch) => ({
          number: ch.number,
          title: ch.title,
          status: ch.status,
          href: ch.page_slug ? `/read/${encodeURIComponent(userSlug)}/${encodeURIComponent(ch.page_slug)}` : undefined,
        }))
      : undefined,
    chapterProgress:
      chapters.length > 0
        ? { current: currentChapter, total: chapters.length }
        : undefined,
    // Collection metadata
    collectionName,
    collectionSlug,
    recommendations: recommendationEntries.length > 0 ? recommendationEntries : undefined,
    // Viewer and interaction state
    viewerHasReacted,
    viewerHasFavorited,
    isAuthenticated,
    communityEntityId,
    userSlug,
    pageId,
  }

  const detailsTab = useMemo(() => (
    <PageMeta
      data={pageMeta}
      currentUserSlug={sessionUserSlug}
    />
  ), [pageMeta, sessionUserSlug])

  const commentsTab = useMemo(() => (
    <CommentsPanel
      communityEntityId={communityEntityId}
      isAuthenticated={isAuthenticated}
      sessionUsername={sessionUsername}
      sessionAvatarUrl={sessionAvatarUrl}
      sessionUserId={sessionUserId}
      initialComments={initialComments}
      initialNextCursor={initialCommentsNextCursor}
    />
  ), [communityEntityId, isAuthenticated, sessionUsername, sessionAvatarUrl, sessionUserId, initialComments, initialCommentsNextCursor])

  const notesTab = useMemo(() => <NotesPanel pageId={pageUid} />, [pageUid])

  const breadcrumbContextValue: BreadcrumbContextValue = {
    labels: {
      [`/read/${userSlug}`]: { label: authorName, icon: User, href: `/author/${userSlug}` },
      [`/read/${userSlug}/${pageId}`]: { label: pageTitle },
    },
  }

  return (
    <BreadcrumbDynamicContext.Provider value={breadcrumbContextValue}>
      <ReadDrawer
        tabs={[
          { value: "details", label: t("community.details"), content: detailsTab },
          { value: "comments", label: t("community.comments"), badge: pageCommentCount, content: commentsTab },
          { value: "notes", label: t("community.notes"), content: notesTab },
        ]}
        defaultTab="details"
      />

      {/* 参考 index.html .read-shell + .read-viewport + .read-iframe */}
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
            // iframe 加载后触发 topbar 重测 --reader-header-safe
            window.dispatchEvent(new Event("resize"))
          }}
          sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
          className="w-full border-0 bg-white dark:bg-[#0a0a0a]"
          style={{
            height: "calc(100vh - var(--reader-header-safe, var(--nav-h, 56px)))",
            minHeight: "calc(100vh - var(--reader-header-safe, var(--nav-h, 56px)))",
            transition: "height 180ms ease, min-height 180ms ease",
          }}
        />
      </div>
    </BreadcrumbDynamicContext.Provider>
  )
}
