"use client"

import { useSearchParams } from "next/navigation"
import { PageMeta } from "@/components/content/page-meta"
import { ReadDrawer } from "@/components/layout/read-drawer"
import type { PageMetaData } from "@/components/content/page-meta"

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
}

function extractChapters(html: string): { number: number; title: string }[] {
  const h2Regex = /<h2[^>]*>(.*?)<\/h2>/gi
  const chapters: { number: number; title: string }[] = []
  let match
  let num = 1
  while ((match = h2Regex.exec(html)) !== null) {
    chapters.push({
      number: num++,
      title: match[1].replace(/<[^>]*>/g, "").trim(),
    })
  }
  return chapters
}

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
}: ReadPageClientProps) {
  const searchParams = useSearchParams()
  const isDrawerOpen = searchParams.get("drawer") === "open"

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
  }

  const detailsTab = <PageMeta data={pageMeta} />
  const commentsTab = (
    <div className="py-8 text-center text-sm text-muted-foreground">评论加载中...</div>
  )
  const notesTab = (
    <div className="py-8 text-center text-sm text-muted-foreground">笔记功能开发中...</div>
  )

  return (
    <>
      {isDrawerOpen && (
        <ReadDrawer
          tabs={[
            {
              value: "details",
              label: "详情",
              content: detailsTab,
            },
            {
              value: "comments",
              label: "评论",
              badge: pageCommentCount,
              content: commentsTab,
            },
            {
              value: "notes",
              label: "笔记",
              content: notesTab,
            },
          ]}
          defaultTab="details"
        />
      )}

      <div style={{ marginLeft: "calc(-50vw + 50%)", marginRight: "calc(-50vw + 50%)" }}>
        <div
          className="w-full bg-background"
          style={{ minHeight: "calc(100vh - var(--nav-h, 56px))" }}
        >
          <iframe
            title={pageTitle}
            srcDoc={pageHtml}
            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
            className="w-full border-0 bg-white"
            style={{ height: "calc(100vh - var(--nav-h, 56px))" }}
          />
        </div>
      </div>
    </>
  )
}
