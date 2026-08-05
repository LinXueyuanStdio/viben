import { Skeleton } from "@/components/ui/skeleton";

function ModelPreferencesSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-3.5 w-28" />
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-44" />
        </div>
      </div>
      <div className="grid gap-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-14" />
          </div>
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

function ModelVariantsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-3.5 w-28" />
      <div className="space-y-1">
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-10 w-32" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}

function SkillsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-3.5 w-16" />
      <div className="space-y-3">
        <div className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-5 w-80" />
      </div>

      <ModelPreferencesSkeleton />

      <div className="border-t border-border/50" />

      <ModelVariantsSkeleton />

      <div className="border-t border-border/50" />

      <SkillsSkeleton />
    </div>
  );
}
