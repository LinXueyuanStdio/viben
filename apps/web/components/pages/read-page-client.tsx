"use client"

import { useMemo } from "react"
import dynamic from "next/dynamic"
import { User } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { PageMetaData } from "@/components/content/page-meta"
import type { MiniPageCardData } from "@/components/content/mini-page-card"
import { ReadDrawer } from "@/components/layout/read-drawer"
import { useAppShell } from "@/components/layout/app-shell"
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
  pageBookmarkCount: number
  pageLikeCount: number
  pageCommentCount: number
  pageShareCount: number
  pagePublishedAt: Date | string | null
  pageTags: string[]
  pageCoverUrl?: string
  pageChaptersJson?: unknown
  pageSidePageUid?: string
  pageVisibility?: string
  // SEO fields
  pageSeoTitle?: string | null
  pageSeoDescription?: string | null
  pageSeoKeywords?: string | null
  pageIsDiscoverable?: boolean
  authorDisplayName: string
  authorAvatarUrl?: string | null
  authorFollowersCount: number
  isAuthenticated: boolean
  sessionUsername?: string
  sessionAvatarUrl?: string
  sessionUserSlug?: string
  sessionUserId?: string
  communityEntityId: string
  pageDbId: string
  recommendationEntries: Array<{ data: MiniPageCardData; href: string }>
  viewerHasReacted: boolean
  viewerHasBookmarked: boolean
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
  /** Active tab (from URL search params) */
  activeTab?: string
  /** Whether the current viewer is the page author */
  isAuthor?: boolean
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
    const chapters: ChapterEntry[] = []
    for (const ch of obj.chapters as Array<Record<string, unknown>>) {
      if (ch && typeof ch === "object" && typeof ch.number === "number" && typeof ch.title === "string") {
        chapters.push({
          number: ch.number,
          title: ch.title,
          status: typeof ch.status === "string" ? ch.status : undefined,
          page_slug: typeof ch.page_slug === "string" ? ch.page_slug : undefined,
        })
      }
    }
    return {
      chapters,
      collectionSlug: typeof obj.collection_slug === "string" ? obj.collection_slug : undefined,
      collectionName: typeof obj.collection_name === "string" ? obj.collection_name : undefined,
    }
  }

  // Old format: [{ number, title, page_slug }]
  if (Array.isArray(raw)) {
    const chapters: ChapterEntry[] = []
    for (const ch of raw as Array<Record<string, unknown>>) {
      if (ch && typeof ch === "object" && typeof ch.number === "number" && typeof ch.title === "string") {
        chapters.push({
          number: ch.number,
          title: ch.title,
          status: typeof ch.status === "string" ? ch.status : undefined,
          page_slug: typeof ch.page_slug === "string" ? ch.page_slug : undefined,
        })
      }
    }
    return { chapters }
  }

  return { chapters: [] }
}

// --- Lazy PageSettingsPanel ---

const LazyPageSettingsPanel = dynamic(
  () => import("@/components/pages/page-settings-panel").then((m) => ({ default: m.PageSettingsPanel })),
  {
    loading: () => (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-3/4 rounded bg-muted" />
      </div>
    ),
  },
)

// --- Main Component ---

export function ReadPageClient({
  userSlug,
  pageId,
  pageHtml,
  pageTitle,
  pageDescription,
  pageUid,
  pageViewCount,
  pageBookmarkCount,
  pageLikeCount,
  pageCommentCount,
  pageShareCount,
  pagePublishedAt,
  pageTags,
  pageCoverUrl,
  pageChaptersJson,
  pageSidePageUid,
  pageVisibility = "public",
  pageSeoTitle,
  pageSeoDescription,
  pageSeoKeywords,
  pageIsDiscoverable,
  authorDisplayName,
  authorAvatarUrl,
  authorFollowersCount,
  isAuthenticated,
  sessionUsername,
  sessionAvatarUrl,
  sessionUserSlug,
  sessionUserId,
  communityEntityId,
  pageDbId,
  recommendationEntries,
  viewerHasReacted,
  viewerHasBookmarked,
  initialComments,
  initialCommentsNextCursor,
  activeTab,
  isAuthor = false,
}: ReadPageClientProps) {
  const { t } = useTranslation()
  const { isMobile } = useAppShell()

  // 包装 pageHtml 为完整 HTML 文档，确保样式和结构正常渲染
  // - 已有 <!DOCTYPE 或 <html 开头的完整文档不重复包装
  // - 否则包裹基础文档模板（charset + viewport + 基础样式），兜底旧数据
  const wrappedHtml = useMemo(() => {
    const trimmed = pageHtml.trim()
    if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
      return pageHtml
    }
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:system-ui,sans-serif;line-height:1.6;padding:1rem;color:#333;max-width:100%;overflow-x:hidden}
  img{max-width:100%;height:auto}
  pre{overflow-x:auto;background:#f5f5f5;padding:1rem;border-radius:4px}
  code{font-size:0.9em}
</style>
</head>
<body>${pageHtml}</body>
</html>`
  }, [pageHtml])

  // 合集章节数据：仅来自 pageChaptersJson，不从 HTML H2 提取
  const { chapters, collectionSlug, collectionName } = parseChapters(pageChaptersJson)

  // 找出当前页面在合集中的位置（通过 pageId 匹配 page_slug）
  const currentChapterIndex = chapters.findIndex((ch) => ch.page_slug === pageId)
  const currentChapter = currentChapterIndex >= 0 ? currentChapterIndex + 1 : 0 // 1-indexed

  const pageMeta: PageMetaData = {
    author: {
      name: authorDisplayName,
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
      bookmarks: pageBookmarkCount,
      date: pagePublishedAt
        ? new Date(pagePublishedAt).toISOString().slice(0, 10)
        : "",
    },
    actions: {
      likes: pageLikeCount,
      bookmarks: pageBookmarkCount,
      shares: pageShareCount,
    },
    chapters: chapters.length > 0
      ? chapters.map((ch) => ({
          number: ch.number,
          title: ch.title,
          status: ch.status,
          href: ch.page_slug ? `/${encodeURIComponent(userSlug)}/${encodeURIComponent(ch.page_slug)}?tab=read` : undefined,
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
    viewerHasBookmarked,
    isAuthenticated,
    communityEntityId,
    pageDbId,
    userSlug,
    pageId,
  }

  const breadcrumbContextValue: BreadcrumbContextValue = {
    labels: {
      [`/${userSlug}`]: { label: authorDisplayName, icon: User, href: `/${userSlug}` },
      [`/${userSlug}/${pageId}`]: { label: pageTitle },
    },
  }

  return (
    <BreadcrumbDynamicContext.Provider value={breadcrumbContextValue}>
      <div className="flex h-full">
        {/* 参考 index.html .read-shell + .read-viewport + .read-iframe */}
        {activeTab === "settings" && isAuthor ? (
          <div className="flex-1 min-w-0 min-h-0" style={{ paddingTop: "var(--reader-header-safe, var(--nav-h, 56px))" }}>
            <div
              className="overflow-y-auto"
              style={{ height: "calc(100vh - var(--reader-header-safe, var(--nav-h, 56px)))" }}
            >
              <div className="max-w-2xl mx-auto px-4 py-8">
                <LazyPageSettingsPanel
                userSlug={userSlug}
                pageId={pageId}
                pageTitle={pageTitle}
                pageDescription={pageDescription ?? ""}
                pageUid={pageUid}
                pageTags={pageTags}
                pageVisibility={pageVisibility}
                pagePublishedAt={pagePublishedAt}
                pageHtml={pageHtml}
                pageViewCount={pageViewCount}
                pageLikeCount={pageLikeCount}
                pageCommentCount={pageCommentCount}
                pageSeoTitle={pageSeoTitle}
                pageSeoDescription={pageSeoDescription}
                pageSeoKeywords={pageSeoKeywords}
                pageIsDiscoverable={pageIsDiscoverable}
                pageDbId={pageDbId}
              />
            </div>
            </div>
          </div>
        ) : (
          <div
            className="flex-1 min-w-0 bg-white dark:bg-[#0a0a0a] overflow-x-hidden"
            style={{
              paddingTop: "var(--reader-header-safe, var(--nav-h, 56px))",
              transition: "padding-top 180ms ease",
            }}
          >
            <iframe
              title={pageTitle}
              srcDoc={wrappedHtml}
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
        )}

        <ReadDrawer
          tabs={[
            { value: "details", label: t("community.read"), type: "meta" as const, pageMeta, currentUserSlug: sessionUserSlug },
            { value: "comments", label: t("community.comments"), badge: pageCommentCount, type: "comments" as const, communityEntityId, pageDbId, isAuthenticated, sessionUsername, sessionAvatarUrl, sessionUserId, initialComments, initialNextCursor: initialCommentsNextCursor },
            { value: "notes", label: t("community.notes"), type: "notes" as const, pageId: pageUid },
          ]}
          defaultTab={activeTab === "settings" && isAuthor ? "details" : "comments"}
          pageId={pageId}
          userSlug={userSlug}
          isMobile={isMobile}
        />
      </div>
    </BreadcrumbDynamicContext.Provider>
  )
}
