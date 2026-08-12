"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import type { Session } from "@/lib/db/schema";
import { PageSessionHeader } from "./page-session-header";

export type PageSessionLayoutProps = {
  session: Session;
  activeChatId: string;
  children: ReactNode;
  previewPanel?: ReactNode;
};

export function PageSessionLayout({
  session,
  activeChatId,
  children,
  previewPanel,
}: PageSessionLayoutProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div className="relative flex h-full overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <PageSessionHeader
          session={session}
          activeChatId={activeChatId}
          previewOpen={previewOpen}
          onPreviewOpenChange={setPreviewOpen}
        />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>

      {previewOpen ? (
        <aside
          data-testid="page-preview-slot"
          className="absolute right-0 top-0 z-30 flex h-full w-[min(28rem,90vw)] flex-col overflow-hidden border-l border-border bg-background shadow-lg sm:relative sm:z-0 sm:w-[24rem] sm:shrink-0 sm:shadow-none xl:w-[30rem]"
        >
          {previewPanel}
        </aside>
      ) : null}
    </div>
  );
}
