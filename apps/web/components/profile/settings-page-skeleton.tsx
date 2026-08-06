"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ModelPreferencesSectionSkeleton } from "@/app/(dashboard)/settings/assistant/preferences-section";
import { ModelVariantsSectionSkeleton } from "@/app/(dashboard)/settings/assistant/model-variants-section";

/** /settings/assistant 的骨架屏 */
export function AssistantSettingsPageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <ModelPreferencesSectionSkeleton />
      <div className="border-t border-border/50" />
      <ModelVariantsSectionSkeleton />
    </div>
  );
}

/** /settings/sandbox 的骨架屏 */
export function SandboxSettingsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-4 rounded-lg border p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 通用设置页骨架屏（用于未知的设置子页面） */
export function GenericSettingsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-4 rounded-lg border p-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
