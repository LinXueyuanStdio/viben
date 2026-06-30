"use client"

import { FeedCard } from "@/components/content/feed-card"
import type { FeedCardData, FeedCardSession } from "@/components/content/feed-card"
import { CommentsPanel } from "@/components/content/comments-panel"
import { useTranslation } from "react-i18next"

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
  const { t } = useTranslation()

  const session: FeedCardSession | null = isAuthenticated && sessionUsername && sessionUserSlug
    ? { username: sessionUsername, userSlug: sessionUserSlug, avatarUrl: sessionAvatarUrl }
    : null

  return (
    <div className="max-w-[640px] mx-auto grid gap-3 py-4">
      <FeedCard data={feedData} variant="rich" session={session} />
      <div className="px-3">
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
    </div>
  )
}
