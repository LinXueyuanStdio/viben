"use client";

import { ExternalLink, Eye, PanelLeft } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PageChatTabs } from "@/components/assistant/chat-tabs";
import { usePagePreview } from "@/components/assistant/page-preview-context";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Session } from "@/lib/db/schema";

export type PageSessionHeaderProps = {
  session: Session;
  activeChatId: string;
};

function getPageHref(session: Session) {
  if (!session.pageUserSlug || !session.pageSlug) {
    return null;
  }

  return `/${session.pageUserSlug}/${session.pageSlug}?tab=read`;
}

export function PageSessionHeader({
  session,
  activeChatId,
}: PageSessionHeaderProps) {
  const { t } = useTranslation();
  const { toggleSidebar } = useSidebar();
  const { open, setOpen, previewData, previewUnavailable } = usePagePreview();
  const fallbackPageHref = useMemo(() => getPageHref(session), [session]);
  const pageHref = previewData?.url ?? fallbackPageHref;

  return (
    <header className="flex min-h-10 items-center gap-2 border-b border-border px-2">
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={toggleSidebar}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t("assistant.drawer.toggleLeftSidebar")}
          </TooltipContent>
        </Tooltip>

        <PageChatTabs activeChatId={activeChatId} variant="inline" />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant={open ? "secondary" : "ghost"}
          size="sm"
          className="h-7 gap-1.5 px-2"
          onClick={() => setOpen(!open)}
        >
          <Eye className="h-3.5 w-3.5" />
          {t("assistant.pageChat.preview")}
        </Button>

        {pageHref && !previewUnavailable ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={pageHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("assistant.pageChat.openPage")}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("assistant.pageChat.openPage")}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </header>
  );
}
