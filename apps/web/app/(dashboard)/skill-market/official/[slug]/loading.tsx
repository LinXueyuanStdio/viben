export default function OfficialSkillDetailLoading() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px] animate-pulse">
      {/* Main content area */}
      <div className="space-y-6">
        {/* Back link skeleton */}
        <div className="h-5 w-32 bg-muted rounded" />

        {/* Header skeleton */}
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="h-16 w-16 rounded-xl bg-muted shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-8 w-64 bg-muted rounded" />
              <div className="h-5 w-full max-w-lg bg-muted rounded" />
              <div className="h-5 w-3/4 bg-muted rounded" />
            </div>
          </div>

          {/* Info bar */}
          <div className="flex gap-4">
            <div className="h-5 w-24 bg-muted rounded" />
            <div className="h-5 w-16 bg-muted rounded" />
            <div className="h-5 w-20 bg-muted rounded" />
          </div>
        </div>

        {/* Installation card skeleton */}
        <div className="rounded-xl border border-border p-6 space-y-4">
          <div className="h-5 w-28 bg-muted rounded" />
          <div className="h-24 bg-muted rounded-lg" />
        </div>

        {/* README content skeleton */}
        <div className="space-y-3 mt-6">
          <div className="h-6 w-48 bg-muted rounded" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-5/6 bg-muted rounded" />
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-4/6 bg-muted rounded" />
          </div>
          <div className="space-y-2 mt-4">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-3/4 bg-muted rounded" />
          </div>
          <div className="space-y-2 mt-4">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-5/6 bg-muted rounded" />
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-2/3 bg-muted rounded" />
          </div>
        </div>
      </div>

      {/* Sidebar skeleton */}
      <div className="space-y-4">
        {/* Install button */}
        <div className="h-10 w-full bg-muted rounded-lg" />

        {/* Owner card */}
        <div className="rounded-xl border border-border p-6 space-y-3">
          <div className="flex flex-col items-center gap-3">
            <div className="h-16 w-16 rounded-full bg-muted" />
            <div className="space-y-1.5 text-center">
              <div className="h-4 w-24 bg-muted rounded mx-auto" />
              <div className="h-3 w-16 bg-muted rounded mx-auto" />
            </div>
          </div>
        </div>

        {/* Info card */}
        <div className="rounded-xl border border-border p-6 space-y-3">
          <div className="h-4 w-12 bg-muted rounded" />
          <div className="space-y-2.5">
            <div className="flex justify-between">
              <div className="h-4 w-16 bg-muted rounded" />
              <div className="h-4 w-12 bg-muted rounded" />
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="h-4 w-10 bg-muted rounded" />
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-16 bg-muted rounded" />
              <div className="h-4 w-10 bg-muted rounded" />
            </div>
          </div>
        </div>

        {/* Two more cards */}
        <div className="rounded-xl border border-border p-6 space-y-3">
          <div className="h-4 w-20 bg-muted rounded" />
          <div className="h-4 w-16 bg-muted rounded" />
        </div>
        <div className="rounded-xl border border-border p-6 space-y-3">
          <div className="h-4 w-16 bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}
