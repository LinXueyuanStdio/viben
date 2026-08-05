import { Skeleton } from "@/components/ui/skeleton";

export default function AssistantLoading() {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar skeleton — matches SessionsRouteShell aside */}
      <aside className="flex w-[18rem] shrink-0 flex-col border-r border-border bg-muted/20">
        {/* Header area */}
        <div className="flex items-center justify-between px-3 py-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
        {/* Search / tabs */}
        <div className="px-3 pb-3">
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        {/* Session list */}
        <div className="flex-1 space-y-0.5 px-2 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-2.5">
              <Skeleton className="h-4 w-4 shrink-0 rounded" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
        {/* Footer */}
        <div className="border-t border-border px-3 py-3">
          <Skeleton className="h-4 w-20" />
        </div>
      </aside>

      {/* Main content — matches empty state */}
      <main className="flex min-w-0 flex-1 flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2 text-center">
            <Skeleton className="h-6 w-28 mx-auto" />
            <Skeleton className="h-4 w-56 mx-auto" />
          </div>
          <Skeleton className="h-10 w-24 rounded-md" />
        </div>
      </main>
    </div>
  );
}
