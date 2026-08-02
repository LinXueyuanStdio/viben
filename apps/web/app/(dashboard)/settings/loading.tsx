/**
 * 设置页路由组加载骨架屏
 */
export default function SettingsLoading() {
  return (
    <div className="container max-w-4xl py-8">
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
        {/* 左侧导航骨架 */}
        <div className="space-y-1">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-muted" />
          ))}
        </div>

        {/* 右侧内容骨架 */}
        <div className="space-y-6">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
          <div className="rounded-xl border border-border p-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
