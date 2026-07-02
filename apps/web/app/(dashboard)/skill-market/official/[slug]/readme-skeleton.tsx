export function ReadmeSectionSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* TOC skeleton */}
      <div className="rounded-lg border border-border p-4">
        <div className="h-5 w-36 bg-muted rounded" />
      </div>

      {/* Content skeleton */}
      <div className="space-y-3 py-2">
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
        </div>
        <div className="space-y-2 mt-4">
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-2/3 bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-3/4 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}
