/**
 * 用户资料页加载骨架屏
 * 匹配左侧边栏 + 右侧 tab 区的双栏布局
 */

export default function UserSlugLoading() {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* ====== 左侧边栏骨架 ====== */}
        <div className="space-y-3 px-3">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-full aspect-square rounded-full animate-pulse bg-muted" />
            <div className="space-y-1.5 text-center w-full flex flex-col items-center">
              <div className="h-6 w-24 animate-pulse rounded bg-muted" />
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <div className="h-3.5 w-full animate-pulse rounded bg-muted" />
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3">
            <div className="h-5 w-16 animate-pulse rounded bg-muted" />
            <div className="h-5 w-16 animate-pulse rounded bg-muted" />
            <div className="h-5 w-12 animate-pulse rounded bg-muted" />
          </div>

          {/* Follow / Edit button */}
          <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
        </div>

        {/* ====== 右侧内容区骨架 ====== */}
        <div className="min-w-0">
          {/* Tab bar */}
          <div className="flex items-center gap-1 h-9 mb-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-7 w-14 animate-pulse rounded-md bg-muted" />
            ))}
          </div>

          {/* Overview content skeleton (default tab) */}
          <div className="space-y-4">
            {/* Pinned section skeleton */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="h-5 w-10 animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="rounded-[12px] border border-border p-2.5 space-y-2">
                    <div className="aspect-video animate-pulse rounded-[9px] bg-muted" />
                    <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-full animate-pulse rounded bg-muted" />
                    <div className="flex gap-2">
                      <div className="h-3 w-12 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-12 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-12 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Activity heatmap skeleton */}
            <section>
              <div className="h-[120px] animate-pulse rounded-xl bg-muted" />
            </section>

            {/* Moments skeleton */}
            <section>
              <div className="h-5 w-16 animate-pulse rounded bg-muted mb-2" />
              <div className="grid gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="size-7 animate-pulse rounded-full bg-muted" />
                      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-16 animate-pulse rounded bg-muted ml-auto" />
                    </div>
                    <div className="h-3.5 w-full animate-pulse rounded bg-muted" />
                    <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="flex gap-2">
                      <div className="h-3 w-12 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-12 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
