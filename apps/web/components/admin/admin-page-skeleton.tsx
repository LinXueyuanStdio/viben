export function AdminPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-36 rounded-lg bg-muted" />
          <div className="mt-2 h-4 w-64 rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-16 rounded-md bg-muted" />
          <div className="h-9 w-16 rounded-md bg-muted" />
          <div className="h-9 w-24 rounded-md bg-muted" />
        </div>
      </div>
      <div className="rounded-xl border">
        <div className="border-b bg-muted/50 px-4 py-3">
          <div className="flex gap-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-4 w-16 rounded bg-muted-foreground/20" />
            ))}
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-8 border-b px-4 py-3 last:border-0">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="h-4 w-24 rounded bg-muted" style={{ width: `${60 + Math.random() * 80}px` }} />
            ))}
          </div>
        ))}
      </div>
      <div className="h-4 w-32 rounded bg-muted" />
    </div>
  );
}
