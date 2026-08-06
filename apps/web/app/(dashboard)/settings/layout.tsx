"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { SettingsSidebar } from "@/components/profile/settings-sidebar";
import {
  AssistantSettingsPageSkeleton,
  SandboxSettingsPageSkeleton,
  GenericSettingsPageSkeleton,
} from "@/components/profile/settings-page-skeleton";

/** 根据当前路径匹配对应的骨架屏 */
function getPageSkeleton(pathname: string) {
  if (pathname.startsWith("/settings/assistant")) {
    return <AssistantSettingsPageSkeleton />;
  }
  if (pathname.startsWith("/settings/sandbox")) {
    return <SandboxSettingsPageSkeleton />;
  }
  return <GenericSettingsPageSkeleton />;
}

function SettingsLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AuthGuard
      loadingFallback={
        <div className="container max-w-4xl py-8">
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
            <Suspense>
              <SettingsSidebar />
            </Suspense>
            <div className="min-w-0">
              {getPageSkeleton(pathname)}
            </div>
          </div>
        </div>
      }
    >
      <div className="container max-w-4xl py-8">
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
          <SettingsSidebar />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </AuthGuard>
  );
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="container max-w-4xl py-8">
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
            <div className="space-y-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
            <div className="min-w-0">
              <GenericSettingsPageSkeleton />
            </div>
          </div>
        </div>
      }
    >
      <SettingsLayoutInner>{children}</SettingsLayoutInner>
    </Suspense>
  );
}
