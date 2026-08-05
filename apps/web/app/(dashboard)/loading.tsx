/**
 * Dashboard 路由组加载骨架屏
 * 在客户端导航时立即显示，提供即时视觉反馈
 * 注意：HomeTabBar 已移至 topbar，此处不再渲染 tab bar 骨架
 */

export default function DashboardLoading() {
  return (
    <>
      <div className="grid gap-[14px] grid-cols-1 md:grid-cols-[1fr_240px] lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_330px]">
      {/* 主内容区 */}
      <div className="grid gap-3">
        {/* Hero / 页面头部骨架 */}
        <div className="h-[200px] animate-pulse rounded-xl bg-muted" />

        {/* 卡片网格骨架 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border p-4 space-y-3">
              <div className="aspect-video animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="flex gap-3">
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>

        {/* 列表骨架 */}
        <div className="grid gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="size-8 animate-pulse rounded-full bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>

      {/* 侧边栏骨架 */}
      <aside className="grid gap-3 content-start">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="size-6 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
          </div>
        ))}
      </aside>
    </div>
    </>
  )
}
