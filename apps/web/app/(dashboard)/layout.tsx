import { getSession } from "@/lib/auth/cookies"
import { AppShell } from "@/components/layout/app-shell"
import { ErrorBoundary } from "@/components/layout/error-boundary"
import { listNotifications, getBrowseHistory } from "@/lib/services/community"
import { getHotSearches, getRecentSearches } from "@/lib/services/search"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  const [hotSearches, recentSearches] = await Promise.all([
    getHotSearches(8),
    getRecentSearches(session?.userId ?? null, 5),
  ])

  // Build notification preview items (only if session exists)
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
      // If community services fail, leave notificationItems and historyItems empty
    }
  }

  return (
    <AppShell
      session={session}
      notificationItems={notificationItems}
      historyItems={historyItems}
      hotSearches={hotSearches}
      recentSearches={recentSearches}
    >
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </AppShell>
  )
}
