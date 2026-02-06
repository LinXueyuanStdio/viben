import { cn } from "../lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className,
  variant = "rectangular",
  width,
  height,
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "skeleton animate-shimmer",
        variant === "circular" && "rounded-full",
        variant === "text" && "rounded-md",
        variant === "rectangular" && "rounded-lg",
        className
      )}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
    />
  );
}

export function SkeletonText({ className, lines = 1 }: { className?: string; lines?: number }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={cn("h-4", i === lines - 1 && lines > 1 ? "w-3/4" : "w-full")}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" variant="circular" />
      </div>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

const skeletonBarHeights = ["h-[60%]", "h-[75%]", "h-[45%]", "h-[90%]", "h-[55%]", "h-[80%]", "h-[70%]"];

export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card p-6 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="h-48 flex items-end gap-2">
        {skeletonBarHeights.map((heightClass, i) => (
          <Skeleton
            key={i}
            className={cn("flex-1", heightClass)}
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonHeatmap({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-0.5">
        {Array.from({ length: 12 }).map((_, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-0.5">
            {Array.from({ length: 7 }).map((_, dayIndex) => (
              <Skeleton key={dayIndex} className="w-3 h-3" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
