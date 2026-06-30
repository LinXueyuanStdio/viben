/**
 * 可复用的骨架屏组件
 * 用于 Suspense fallback，在数据加载期间展示
 */
export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border p-4 space-y-3">
          <div className="aspect-video animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="flex gap-3">
            <div className="h-3 w-14 animate-pulse rounded bg-muted" />
            <div className="h-3 w-14 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="size-8 animate-pulse rounded-full bg-muted" />
            <div className="space-y-1 flex-1">
              <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <div className="size-8 animate-pulse rounded-full bg-muted" />
          <div className="space-y-1 flex-1">
            <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function HeroSkeleton() {
  return (
    <div className="rounded-xl border border-border p-6 space-y-4">
      <div className="flex items-center gap-4">
        <div className="size-16 animate-pulse rounded-full bg-muted" />
        <div className="space-y-2 flex-1">
          <div className="h-5 w-36 animate-pulse rounded bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
    </div>
  )
}
