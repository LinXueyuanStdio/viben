import { NotificationItem } from "@/components/content/notification-item"
import { AuthorCard } from "@/components/content/author-card"
import { SectionHead } from "@/components/content/section-head"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { MarkAllReadButton } from "@/components/content/mark-all-read-button"
import { NotificationSettings } from "@/components/content/notification-settings"
import { listNotifications } from "@/lib/services/community"
import { EmptyState, T } from "@/components/content/i18n-text"
import { getSession } from "@/lib/auth/cookies"
import { redirect } from "next/navigation"
import { db, users } from "@/lib/db"
import { desc, ne } from "drizzle-orm"
import { FileText, MessageCircle, UserPlus, Bell } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { NotificationItemData } from "@/components/content/notification-item"
import type { AuthorCardData } from "@/components/content/author-card"

export const dynamic = "force-dynamic"

const NOTIF_TABS = [
  { value: "全部", labelKey: "community.all", fallback: "全部" },
  { value: "评论", labelKey: "community.comments", fallback: "评论" },
  { value: "关注", labelKey: "community.follows", fallback: "关注" },
  { value: "订阅", labelKey: "community.subscriptions", fallback: "订阅" },
]

const TYPE_ICON_MAP: Record<string, LucideIcon> = {
  page_published: FileText,
  page_updated: FileText,
  page_update: FileText,
  comment: MessageCircle,
  comment_reply: MessageCircle,
  follow: UserPlus,
}

function timeAgo(date: Date | string | null | undefined): string {
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

export default async function NotificationsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const [notifResult, topAuthors] = await Promise.all([
    listNotifications(session, 50, false, null),
    db.select({ id: users.id, userSlug: users.userSlug, displayName: users.displayName, avatarUrl: users.avatarUrl, bio: users.bio, pageCount: users.pageCount, followersCount: users.followersCount }).from(users).where(ne(users.id, session.userId)).orderBy(desc(users.followersCount)).limit(2),
  ])

  const rawNotifs = notifResult.items

  const allNotifications: NotificationItemData[] = rawNotifs.map((item) => {
    const icon = TYPE_ICON_MAP[item.type] ?? Bell
    const notifType: "update" | "notification" =
      item.type === "page_published" || item.type === "page_updated" || item.type === "page_update"
        ? "update"
        : "notification"

    const readUrl =
      item.page_author_slug && item.page_uid
        ? `/${item.page_author_slug}/${item.page_uid}?tab=read`
        : undefined

    return {
      type: notifType,
      icon,
      title: item.title,
      author: item.actor_name ?? undefined,
      detail: item.body ?? undefined,
      timeAgo: timeAgo(item.created_at),
      notificationId: item.id,
      action: item.read_at
        ? undefined
        : readUrl
          ? { label: "查看", labelKey: "community.notifView", variant: "arrow" as const, href: readUrl }
          : { label: "标记已读", labelKey: "community.markRead", variant: "read" as const },
    }
  })

  const filterNotifications = (tabValue: string): NotificationItemData[] => {
    if (tabValue === "全部") return allNotifications
    if (tabValue === "评论")
      return allNotifications.filter(
        (_, i) =>
          rawNotifs[i].type === "comment" || rawNotifs[i].type === "comment_reply"
      )
    if (tabValue === "关注")
      return allNotifications.filter((_, i) => rawNotifs[i].type === "follow")
    if (tabValue === "订阅")
      return allNotifications.filter(
        (_, i) =>
          rawNotifs[i].type === "page_published" ||
          rawNotifs[i].type === "page_updated" ||
          rawNotifs[i].type === "page_update"
      )
    return allNotifications
  }

  const authorCards: AuthorCardData[] = topAuthors.map((u) => ({
    fallbackText: u.displayName ?? u.userSlug,
    avatarUrl: u.avatarUrl ?? undefined,
    name: u.displayName,
    handle: `@${u.userSlug}`,
    userSlug: u.userSlug,
    description: u.bio ?? "",
    pageCount: u.pageCount ?? 0,
    followerCount: u.followersCount,
  }))

  return (
    <div className="grid gap-[14px] grid-cols-1 md:grid-cols-[1fr_240px] lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_330px]">
      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <SectionHead title={<T tKey="nav.notifications" fallback="通知" />} />
          <MarkAllReadButton />
        </div>
        <VibenTabs defaultValue="全部">
          <VibenTabsList>
            {NOTIF_TABS.map((tab) => (
              <VibenTabsTrigger key={tab.value} value={tab.value}>
                <T tKey={tab.labelKey} fallback={tab.fallback} />
              </VibenTabsTrigger>
            ))}
          </VibenTabsList>
          {NOTIF_TABS.map((tab) => (
            <VibenTabsContent key={tab.value} value={tab.value} className="mt-2">
              <div className="grid gap-2">
                {filterNotifications(tab.value).length === 0 ? (
                  <EmptyState tKey="community.noNotifications" fallback="暂无通知" />
                ) : (
                  filterNotifications(tab.value).map((item, i) => (
                    <NotificationItem key={i} data={item} />
                  ))
                )}
              </div>
            </VibenTabsContent>
          ))}
        </VibenTabs>
      </div>
      <aside className="grid gap-3 content-start">
        <NotificationSettings />
        <SectionHead title={<T tKey="community.subscribedAuthors" fallback="订阅作者" />} />
        {authorCards.map((author, i) => (
          <AuthorCard key={i} data={author} currentUserSlug={session?.userSlug} />
        ))}
      </aside>
    </div>
  )
}
