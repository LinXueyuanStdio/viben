"use client";

import { Link2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAppShell } from "@/components/layout/app-shell";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Session } from "@/lib/db/schema";
import { ChatShareDialog } from "./chat-share-dialog";
import { PagePreviewPanel } from "./page-preview-panel";
import { PagePreviewProvider } from "./page-preview-context";
import { PageSessionHeader } from "./page-session-header";
import { useSessionLayout } from "./session-layout-context";

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
    <PagePreviewProvider publishedPageId={session.publishedPageId}>
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
  const { setTopbarCenterContent } = useAppShell();
  const { chats, session: layoutSession } = useSessionLayout();
  const { t } = useTranslation();
  const [shareOpen, setShareOpen] = useState(false);

  // Mirror the work-chat layout: inject the active chat title + share link
  // into the app shell topbar's center slot.
  const activeChatTitle = useMemo(() => {
    if (!activeChatId) return layoutSession.title;
    const chat = chats.find((candidate) => candidate.id === activeChatId);
    return chat?.title || layoutSession.title;
  }, [activeChatId, chats, layoutSession.title]);

  useEffect(() => {
    setTopbarCenterContent(
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="max-w-[200px] truncate text-sm font-medium text-foreground sm:font-normal sm:text-muted-foreground">
          {activeChatTitle}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="shrink-0 rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-foreground"
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t("assistant.session.shareChat")}
          </TooltipContent>
        </Tooltip>
      </div>,
    );
    return () => setTopbarCenterContent(null);
  }, [activeChatTitle, setTopbarCenterContent, setShareOpen, t]);

  return (
    <div className="relative flex h-full overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <PageSessionHeader
          session={session}
          activeChatId={activeChatId}
        />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>

      <ChatShareDialog
        sessionId={session.id}
        chatId={activeChatId}
        initialShareId={null}
        externalOpen={shareOpen}
        onExternalOpenChange={setShareOpen}
      />

      {previewPanel ?? <PagePreviewPanel session={session} />}
    </div>
  );
}
