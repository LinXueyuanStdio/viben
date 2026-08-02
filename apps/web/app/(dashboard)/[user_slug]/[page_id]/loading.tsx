/**
 * 阅读页加载骨架屏
 * 匹配 flex row 布局：左侧 iframe 内容区 + 右侧嵌入式详情抽屉
 */

export default function PageLoading() {
  return (
    <div className="flex h-full">
      {/* 左侧：iframe 内容区骨架 */}
      <div
        className="flex-1 min-w-0 bg-white dark:bg-[#0a0a0a] flex items-center justify-center"
        style={{ paddingTop: "var(--nav-h, 56px)" }}
      >
        <div className="animate-pulse space-y-4 w-full max-w-2xl px-8">
          {/* 标题 */}
          <div className="h-8 w-3/5 rounded bg-muted/20" />
          {/* 作者行 */}
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-muted/20" />
            <div className="h-4 w-24 rounded bg-muted/20" />
            <div className="h-3 w-16 rounded bg-muted/20" />
          </div>
          {/* 分隔线 */}
          <div className="h-px w-full bg-border/10" />
          {/* 内容段落 */}
          <div className="space-y-2.5">
            <div className="h-4 w-full rounded bg-muted/20" />
            <div className="h-4 w-full rounded bg-muted/20" />
            <div className="h-4 w-4/5 rounded bg-muted/20" />
            <div className="h-4 w-full rounded bg-muted/20" />
            <div className="h-4 w-3/4 rounded bg-muted/20" />
            <div className="h-4 w-full rounded bg-muted/20" />
            <div className="h-4 w-5/6 rounded bg-muted/20" />
            <div className="h-4 w-2/3 rounded bg-muted/20" />
            <div className="h-4 w-full rounded bg-muted/20" />
            <div className="h-4 w-3/5 rounded bg-muted/20" />
          </div>
          {/* 图片占位 */}
          <div className="aspect-video w-full rounded-xl bg-muted/20" />
          {/* 更多段落 */}
          <div className="space-y-2.5">
            <div className="h-4 w-full rounded bg-muted/20" />
            <div className="h-4 w-5/6 rounded bg-muted/20" />
            <div className="h-4 w-full rounded bg-muted/20" />
            <div className="h-4 w-2/3 rounded bg-muted/20" />
          </div>
        </div>
      </div>

      {/* 右侧：详情抽屉骨架 */}
      <div
        className="shrink-0 border-l border-border bg-background grid grid-rows-[auto_1fr]"
        style={{
          width: "var(--drawer-w, 420px)",
          paddingTop: "var(--nav-h, 56px)",
        }}
      >
        {/* Tab bar 骨架 */}
        <div className="flex items-center gap-2.5 h-[58px] px-3 border-b border-border">
          <div className="flex items-center gap-1 flex-1">
            <div className="h-7 w-14 animate-pulse rounded-md bg-muted/30" />
            <div className="h-7 w-14 animate-pulse rounded-md bg-muted/30" />
            <div className="h-7 w-12 animate-pulse rounded-md bg-muted/30" />
          </div>
          <div className="size-8 animate-pulse rounded-lg bg-muted/30" />
        </div>

        {/* 评论列表骨架（默认 tab） */}
        <div className="p-3 space-y-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="size-7 animate-pulse rounded-full bg-muted/30" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted/30" />
                <div className="h-3 w-12 animate-pulse rounded bg-muted/30 ml-auto" />
              </div>
              <div className="h-3.5 w-full animate-pulse rounded bg-muted/30" />
              <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted/30" />
              <div className="flex items-center gap-3">
                <div className="h-3 w-10 animate-pulse rounded bg-muted/30" />
                <div className="h-3 w-10 animate-pulse rounded bg-muted/30" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
