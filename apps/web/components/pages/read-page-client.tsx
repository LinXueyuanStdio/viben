"use client"

import React, { useMemo, useRef, useState, useCallback, useEffect } from "react"
import { User, FileText, Columns2, Settings, PanelRight, Maximize2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { PageMeta } from "@/components/content/page-meta"
import type { PageMetaData } from "@/components/content/page-meta"
import { ReadDrawer } from "@/components/layout/read-drawer"
import { NotesPanel } from "@/components/content/notes-panel"
import { CommentsPanel } from "@/components/content/comments-panel"
import { PageSettingsPanel } from "@/components/pages/page-settings-panel"
import { BreadcrumbDynamicContext } from "@/components/layout/breadcrumb"
import type { BreadcrumbContextValue } from "@/components/layout/breadcrumb"
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from "@/components/ui/viben-tabs"
import { IconButton } from "@/components/ui/icon-button"
import { useTopbarContent } from "@/components/layout/topbar-content-context"
import { useDrawer } from "@/components/layout/drawer-context"
import { ReadMoreMenu } from "@/components/pages/read-more-menu"
import {
  useCommunitySummary,
  useRecommendations,
  usePrefetchCommunitySummary,
  usePrefetchComments,
  usePrefetchRecommendations,
} from "@/hooks/use-page-data"

// --- Types ---

interface ChapterEntry {
  number: number
  title: string
  status?: string
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
  pageLikeCount: number
  pageBookmarkCount: number
  pageCommentCount: number
  pageShareCount: number
  pagePublishedAt: Date | string | null
  pageTags: string[]
  pageCoverUrl?: string
  pageChaptersJson?: unknown
  pageSidePageUid?: string
  pageVisibility?: string
  authorName: string
  authorAvatarUrl?: string | null
  authorFollowersCount: number
  isAuthenticated: boolean
  sessionUsername?: string
  sessionAvatarUrl?: string
  sessionUserSlug?: string
  sessionUserId?: string
  communityEntityId: string
  pageDbId: string
  pageCategoryId?: string | null
  authorDbId: string
  activeTab?: string
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

// --- Main Component ---

export function ReadPageClient({
  userSlug,
  pageId,
  pageHtml,
  pageTitle,
  pageDescription,
  pageUid,
  pageViewCount,
  pageLikeCount,
  pageBookmarkCount,
  pageCommentCount,
  pageShareCount,
  pagePublishedAt,
  pageTags,
  pageCoverUrl,
  pageChaptersJson,
  pageSidePageUid,
  pageVisibility = "public",
  authorName,
  authorAvatarUrl,
  authorFollowersCount,
  isAuthenticated,
  sessionUsername,
  sessionAvatarUrl,
  sessionUserSlug,
  sessionUserId,
  communityEntityId,
  pageDbId,
  pageCategoryId,
  authorDbId,
  activeTab,
  isAuthor = false,
}: ReadPageClientProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { setIsRead, setImmersive, setCenter, setRight } = useTopbarContent()
  const { toggle: toggleDrawer } = useDrawer()

  // 阅读模式 tab 切换
  const tabParam = searchParams.get("tab")
  const [sideActive, setSideActive] = useState(false)
  const readActiveTab = useMemo(() => {
    if (sideActive) return "side"
    if (tabParam === "settings") return "settings"
    return "page"
  }, [sideActive, tabParam])

  const handleReadTabChange = useCallback((value: string) => {
    if (value === "side") {
      setSideActive(true)
    } else if (value === "settings") {
      setSideActive(false)
      router.push(`${pathname}?tab=settings`, { scroll: false })
    } else {
      setSideActive(false)
      router.push(`${pathname}?tab=read`, { scroll: false })
    }
  }, [router, pathname])

  const hasSidePage = !!pageSidePageUid

  // render 阶段同步注入 context（仅 tab 数量变化时重建 tablist，tab 切换由 VibenTabs 内部控制）
  const prev = useRef({ side: hasSidePage, author: isAuthor })
  if (prev.current.side !== hasSidePage || prev.current.author !== isAuthor) {
    prev.current = { side: hasSidePage, author: isAuthor }
    setIsRead(true)
    if (hasSidePage || isAuthor) {
      setCenter(
        <VibenTabs value={readActiveTab} onValueChange={(v) => v && handleReadTabChange(v)}>
          <VibenTabsList variant="pill">
            <VibenTabsTrigger value="page" variant="pill">
              <FileText className="h-4 w-4" /> {t("community.page")}
            </VibenTabsTrigger>
            {hasSidePage && (
              <VibenTabsTrigger value="side" variant="pill">
                <Columns2 className="h-4 w-4" /> {t("community.sidePage")}
              </VibenTabsTrigger>
            )}
            {isAuthor && (
              <VibenTabsTrigger value="settings" variant="pill">
                <Settings className="h-4 w-4" /> {t("community.settings")}
              </VibenTabsTrigger>
            )}
          </VibenTabsList>
        </VibenTabs>
      )
    } else {
      setCenter(null)
    }
    setRight(
      <>
        <IconButton size="compact" label={t("community.expandDetails")} onClick={toggleDrawer}>
          <PanelRight className="h-4 w-4" />
        </IconButton>
        <IconButton size="compact" label={t("community.immersiveReading")} onClick={() => setImmersive(true)}>
          <Maximize2 className="h-4 w-4" />
        </IconButton>
        <ReadMoreMenu />
      </>
    )
  }
  // 卸载清理
  // 卸载清理
  React.useEffect(() => {
    return () => {
      setIsRead(false)
      setCenter(null)
      setRight(null)
    }
  }, [setIsRead, setCenter, setRight])

  // ==========================================================================
  // react-query：懒加载社区数据
  // ==========================================================================
  const { data: summary } = useCommunitySummary("published_page", communityEntityId)
  const { data: recommendations } = useRecommendations(pageDbId, pageCategoryId, authorDbId)

  // 预加载侧滑栏数据（页面渲染后再加载）
  const prefetchSummary = usePrefetchCommunitySummary()
  const prefetchComments = usePrefetchComments()
  const prefetchRecs = usePrefetchRecommendations()
  useEffect(() => {
    prefetchSummary("published_page", communityEntityId)
    prefetchComments("published_page", communityEntityId)
    prefetchRecs(pageDbId)
  }, [prefetchSummary, prefetchComments, prefetchRecs, communityEntityId, pageDbId])

  const viewerHasReacted = summary?.viewer.has_reacted ?? false
  const viewerHasBookmarked = summary?.viewer.has_bookmarked ?? false

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
    collectionName,
    collectionSlug,
    recommendations: recommendations as any,
    viewerHasReacted,
    viewerHasBookmarked,
    isAuthenticated,
    communityEntityId,
    pageDbId,
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
      pageDbId={pageDbId}
      isAuthenticated={isAuthenticated}
      sessionUsername={sessionUsername}
      sessionAvatarUrl={sessionAvatarUrl}
      sessionUserId={sessionUserId}
    />
  ), [communityEntityId, pageDbId, isAuthenticated, sessionUsername, sessionAvatarUrl, sessionUserId])

  const notesTab = useMemo(() => <NotesPanel pageId={pageUid} />, [pageUid])

  const settingsTab = useMemo(() => (
    <PageSettingsPanel
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
    />
  ), [userSlug, pageId, pageTitle, pageDescription, pageUid, pageTags, pageVisibility, pagePublishedAt, pageHtml, pageViewCount, pageLikeCount, pageCommentCount])

  const breadcrumbContextValue: BreadcrumbContextValue = {
    labels: {
      [`/${userSlug}`]: { label: authorName, icon: User, href: `/${userSlug}` },
      [`/${userSlug}/${pageId}`]: { label: pageTitle },
    },
  }

  return (
    <BreadcrumbDynamicContext.Provider value={breadcrumbContextValue}>
      <ReadDrawer
        tabs={[
          { value: "details", label: t("community.read"), content: detailsTab },
          { value: "comments", label: t("community.comments"), badge: pageCommentCount, content: commentsTab },
          { value: "notes", label: t("community.notes"), content: notesTab },
        ]}
        defaultTab={activeTab === "settings" && isAuthor ? "details" : "details"}
      />

      {/* 参考 index.html .read-shell + .read-viewport + .read-iframe */}
      {activeTab === "settings" && isAuthor ? (
        <div
          className="w-full overflow-auto"
          style={{
            height: "100vh",
            paddingTop: "var(--reader-header-safe, var(--nav-h, 56px))",
            transition: "padding-top 180ms ease",
          }}
        >
          <div className="max-w-2xl mx-auto px-4 py-8">
            {settingsTab}
          </div>
        </div>
      ) : (
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
      )}
    </BreadcrumbDynamicContext.Provider>
  )
}
