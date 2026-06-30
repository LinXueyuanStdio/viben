import { getSession } from "@/lib/auth/cookies"
import type { Session } from "@/lib/auth/types"
import { AppShell } from "@/components/layout/app-shell"
import { ErrorBoundary } from "@/components/layout/error-boundary"
import { listNotifications, getBrowseHistory } from "@/lib/services/community"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let session: Session | null = null
  try {
    session = await getSession()
  } catch (error) {
    console.error("[Dashboard] Failed to get session:", error)
  }

  // 通知和浏览历史仅在已登录时获取，失败不影响页面渲染
  let notificationItems: Array<{ title: string; subtitle: string; href: string; thumb: string }> = []
  let historyItems: Array<{ title: string; subtitle: string; href: string; thumb: string }> = []

  if (session) {
    try {
      const [notifs, history] = await Promise.all([
        listNotifications(session, 5, false, null),
        getBrowseHistory(session, 5),
      ])
      notificationItems = notifs.items.map((item) => ({
        title: item.title,
        subtitle: item.actor_name
          ? `${item.actor_name} · ${item.body ?? ""}`
          : (item.body ?? ""),
        href:
          item.page_author_slug && item.page_uid
            ? `/read/${item.page_author_slug}/${item.page_uid}`
            : "#",
        thumb: item.actor_avatar_url ?? "",
      }))
      historyItems = history.items.map((item) => ({
        title: item.title,
        subtitle: item.author_name
          ? `${item.author_name} · ${new Date(item.last_viewed_at).toLocaleDateString("zh-CN")}`
          : "",
        href: `/read/${item.author_slug}/${item.page_id}`,
        thumb: item.cover_url ?? "",
      }))
    } catch {
      // 社区服务失败时保持空列表，不影响页面渲染
    }
  }

  return (
    <AppShell
      session={session}
      notificationItems={notificationItems}
      historyItems={historyItems}
    >
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </AppShell>
  )
}
