import type { MomentFeedItem } from "@/lib/services/community"
import type { FeedCardData } from "@/components/content/feed-card"
import type { FeedKind } from "@/components/content/feed-head"
import type { Moment } from "@/lib/db/types"

export const FEED_KIND_MAP: Record<string, FeedKind> = {
  post: "发布",
  page_update: "更新",
  repost: "转发",
  system: "更新",
}

export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return ""
  const d = new Date(date)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "刚刚"
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`
  if (days < 365) return `${Math.floor(days / 30)}个月前`
  return `${Math.floor(days / 365)}年前`
}

export interface MapMomentOptions {
  timeFormatter?: (date: string) => string
}

/**
 * Maps a rich MomentFeedItem from listMoments() to FeedCardData.
 * Includes attachment data and viewer interaction state.
 */
export function mapRichMomentToFeedCard(
  item: MomentFeedItem,
  options?: MapMomentOptions,
): FeedCardData {
  const fmt = options?.timeFormatter ?? timeAgo
  const firstAttachment = item.attachments?.[0]

  return {
    head: {
      fallbackText: item.author.display_name?.[0] ?? "?",
      avatarUrl: item.author.avatar_url ?? undefined,
      name: item.author.display_name ?? "?",
      handle: `@${item.author.user_slug}`,
      userSlug: item.author.user_slug,
      kind: FEED_KIND_MAP[item.moment.kind] ?? "发布",
      timeAgo: fmt(item.moment.created_at),
      source: item.moment.source ?? undefined,
    },
    text: item.moment.body ?? "",
    quote: item.moment.quote_text ?? undefined,
    attachment: firstAttachment
      ? {
          coverUrl: firstAttachment.cover_url,
          title: firstAttachment.title ?? "",
          authorDisplayName: firstAttachment.author_name_snapshot ?? "",
          timeAgo: "",
          stats: {
            views: firstAttachment.view_count_snapshot ?? 0,
            comments: firstAttachment.comment_count_snapshot ?? 0,
          },
        }
      : undefined,
    actions: {
      views: item.moment.view_count ?? 0,
      likes: item.moment.like_count,
      comments: item.moment.comment_count,
      reposts: item.moment.repost_count,
      momentId: item.moment.id,
      shareUrl: `/moment/${item.moment.id}`,
      hasLiked: item.viewer_state.has_liked,
    },
  }
}

export interface MapMomentRowOptions {
  timeFormatter?: (date: Date | string) => string
}

export interface MomentAttachmentData {
  cover_url: string | null
  title: string
  author_name: string | null
  view_count: number | null
  comment_count: number | null
}

/**
 * Maps a direct Drizzle `moments` row to FeedCardData.
 * Used where only the moments table is queried directly
 * (profile-moments-section, [user_slug] page).
 *
 * Accepts optional attachment data so caller can provide
 * cover images when available.
 */
export function mapMomentRowToFeedCard(
  row: Moment,
  author: {
    displayName: string | null
    userSlug: string
    avatarUrl: string | null
  },
  options?: MapMomentRowOptions & { attachments?: MomentAttachmentData[] },
): FeedCardData {
  const fmt = options?.timeFormatter ?? timeAgo
  const firstAttachment = options?.attachments?.[0]

  return {
    head: {
      fallbackText: author.displayName?.[0] ?? "?",
      avatarUrl: author.avatarUrl ?? undefined,
      name: author.displayName ?? "?",
      handle: `@${author.userSlug}`,
      userSlug: author.userSlug,
      kind: FEED_KIND_MAP[row.kind] ?? "发布",
      timeAgo: fmt(row.createdAt),
      source: row.source ?? undefined,
    },
    text: row.body ?? "",
    quote: row.quoteText ?? undefined,
    attachment: firstAttachment
      ? {
          coverUrl: firstAttachment.cover_url,
          title: firstAttachment.title,
          authorDisplayName: firstAttachment.author_name ?? "",
          timeAgo: "",
          stats: {
            views: firstAttachment.view_count ?? 0,
            comments: firstAttachment.comment_count ?? 0,
          },
        }
      : undefined,
    actions: {
      views: row.viewCount ?? 0,
      likes: row.likeCount,
      comments: row.commentCount,
      reposts: row.repostCount,
      momentId: row.id,
      shareUrl: `/moment/${row.id}`,
      hasLiked: false,
    },
  }
}
