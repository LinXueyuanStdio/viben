"use client";

import type { ReactNode } from "react";
import type { Session } from "@/lib/db/schema";
import { PagePreviewPanel } from "./page-preview-panel";
import { PagePreviewProvider } from "./page-preview-context";
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
  return (
    <PagePreviewProvider>
      <PageSessionLayoutInner
        session={session}
        activeChatId={activeChatId}
        previewPanel={previewPanel}
      >
        {children}
      </PageSessionLayoutInner>
    </PagePreviewProvider>
  );
}

function PageSessionLayoutInner({
  session,
  activeChatId,
  children,
  previewPanel,
}: PageSessionLayoutProps) {
  return (
    <div className="relative flex h-full overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <PageSessionHeader
          session={session}
          activeChatId={activeChatId}
        />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>

      {previewPanel ?? <PagePreviewPanel session={session} />}
    </div>
  );
}
