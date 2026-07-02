"use client"

import { useMemo } from "react"
import { FeedCard } from "@/components/content/feed-card"
import type { FeedCardData, FeedCardSession } from "@/components/content/feed-card"
import { CommentsPanel } from "@/components/content/comments-panel"
import { BreadcrumbDynamicContext } from "@/components/layout/breadcrumb"
import type { BreadcrumbContextValue } from "@/components/layout/breadcrumb"

interface MomentDetailClientProps {
  feedData: FeedCardData
  momentId: string
  isAuthenticated: boolean
  sessionUsername?: string
  sessionAvatarUrl?: string
  sessionUserId?: string
  sessionUserSlug?: string
  initialComments: Array<{
    id: string
    content: string
    created_at: string
    updated_at: string
    depth: number
    parent_comment_id: string | null
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

export function MomentDetailClient({
  feedData,
  momentId,
  isAuthenticated,
  sessionUsername,
  sessionAvatarUrl,
  sessionUserId,
  sessionUserSlug,
  initialComments,
  initialCommentsNextCursor,
}: MomentDetailClientProps) {
  const session: FeedCardSession | null = isAuthenticated && sessionUsername && sessionUserSlug
    ? { username: sessionUsername, userSlug: sessionUserSlug, avatarUrl: sessionAvatarUrl }
    : null

  const breadcrumbLabel = useMemo(() => {
    const name = feedData.head.name
    const text = feedData.text.slice(0, 30) + (feedData.text.length > 30 ? "…" : "")
    return `${name}: ${text}`
  }, [feedData])

  const breadcrumbValue: BreadcrumbContextValue = useMemo(() => ({
    labels: { [`/moment/${momentId}`]: { label: breadcrumbLabel } },
  }), [momentId, breadcrumbLabel])

  return (
    <BreadcrumbDynamicContext.Provider value={breadcrumbValue}>
      <div className="max-w-[640px] mx-auto py-6 space-y-4">
        <FeedCard data={feedData} variant="rich" session={session} preloadComments={false} collapsed={false} />

        <CommentsPanel
          communityEntityId=""
          pageDbId={momentId}
          entityType="moment"
          isAuthenticated={isAuthenticated}
          sessionUsername={sessionUsername}
          sessionAvatarUrl={sessionAvatarUrl}
          sessionUserId={sessionUserId}
          initialComments={initialComments}
          initialNextCursor={initialCommentsNextCursor}
        />
      </div>
    </BreadcrumbDynamicContext.Provider>
  )
}
