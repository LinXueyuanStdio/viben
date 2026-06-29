import { NotificationItem } from "@/components/content/notification-item"
import { AuthorCard } from "@/components/content/author-card"
import { SectionHead } from "@/components/content/section-head"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { Button } from "@/components/ui/button"
import { listNotifications } from "@/lib/services/community"
import { getSession } from "@/lib/auth/cookies"
import { redirect } from "next/navigation"
import { db, users } from "@/lib/db"
import { desc } from "drizzle-orm"

export const dynamic = "force-dynamic"
import { CheckCheck, FileText, MessageCircle, UserPlus, Bell } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { NotificationItemData } from "@/components/content/notification-item"
import type { AuthorCardData } from "@/components/content/author-card"

const NOTIF_TABS = ["全部", "评论", "关注", "订阅"]

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
    db.select().from(users).orderBy(desc(users.followersCount)).limit(2),
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
        ? `/read/${item.page_author_slug}/${item.page_uid}`
        : undefined

    return {
      type: notifType,
      icon,
      title: item.title,
      author: item.actor_name ?? undefined,
      detail: item.body ?? undefined,
      timeAgo: timeAgo(item.created_at),
      action: item.read_at
        ? { label: "已读", variant: "read" as const }
        : readUrl
          ? { label: "查看", variant: "arrow" as const, href: readUrl }
          : { label: "查看", variant: "arrow" as const },
    }
  })

  const filterNotifications = (tab: string): NotificationItemData[] => {
    if (tab === "全部") return allNotifications
    if (tab === "评论")
      return allNotifications.filter(
        (_, i) =>
          rawNotifs[i].type === "comment" || rawNotifs[i].type === "comment_reply"
      )
    if (tab === "关注")
      return allNotifications.filter((_, i) => rawNotifs[i].type === "follow")
    if (tab === "订阅")
      return allNotifications.filter(
        (_, i) =>
          rawNotifs[i].type === "page_published" ||
          rawNotifs[i].type === "page_updated" ||
          rawNotifs[i].type === "page_update"
      )
    return allNotifications
  }

  const authorCards: AuthorCardData[] = topAuthors.map((u) => ({
    fallbackText: u.displayName?.[0] ?? "?",
    avatarUrl: u.avatarUrl ?? undefined,
    name: u.displayName,
    handle: `@${u.userSlug}`,
    description: u.bio ?? "",
    pageCount: u.pageCount ?? 0,
    followerCount: u.followersCount,
  }))

  return (
    <div className="grid gap-[14px]" style={{ gridTemplateColumns: "minmax(0, 1fr) 330px" }}>
      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <SectionHead title="通知" />
          <Button variant="ghost" size="sm" className="gap-1.5">
            <CheckCheck className="size-3.5" />
            全部已读
          </Button>
        </div>
        <VibenTabs defaultValue="全部">
          <VibenTabsList>
            {NOTIF_TABS.map((tab) => (
              <VibenTabsTrigger key={tab} value={tab}>
                {tab}
              </VibenTabsTrigger>
            ))}
          </VibenTabsList>
          {NOTIF_TABS.map((tab) => (
            <VibenTabsContent key={tab} value={tab} className="mt-2">
              <div className="grid gap-2">
                {filterNotifications(tab).length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">暂无通知</p>
                ) : (
                  filterNotifications(tab).map((item, i) => (
                    <NotificationItem key={i} data={item} />
                  ))
                )}
              </div>
            </VibenTabsContent>
          ))}
        </VibenTabs>
      </div>
      <aside className="grid gap-3 content-start">
        <div className="rounded-[10px] border border-border p-2.5 grid gap-2">
          <div className="font-bold text-sm">通知设置</div>
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground cursor-pointer">
            <input type="checkbox" defaultChecked className="rounded" />
            页面更新
          </label>
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground cursor-pointer">
            <input type="checkbox" defaultChecked className="rounded" />
            评论回复
          </label>
        </div>
        <SectionHead title="订阅作者" />
        {authorCards.map((author, i) => (
          <AuthorCard key={i} data={author} />
        ))}
      </aside>
    </div>
  )
}
