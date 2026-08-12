"use client";

import useSWR from "swr";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PagePreviewResponse } from "@/app/api/page-sessions/[sessionId]/preview/route";
import { useIsMobile } from "@/hooks/assistant/use-mobile";
import type { Session } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePagePreview } from "./page-preview-context";

const IFRAME_SANDBOX =
  "allow-scripts allow-forms allow-popups allow-modals allow-downloads";

async function fetchPreview(url: string): Promise<PagePreviewResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Preview unavailable");
  }
  return response.json();
}

export function wrapPageHtml(html: string) {
  const trimmed = html.trim();
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    return html;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:system-ui,sans-serif;line-height:1.6;padding:1rem;color:#333;max-width:100%;overflow-x:hidden}
  img{max-width:100%;height:auto}
  pre{overflow-x:auto;background:#f5f5f5;padding:1rem;border-radius:4px}
  code{font-size:0.9em}
</style>
</head>
<body>${html}</body>
</html>`;
}

export function PagePreviewPanel({ session }: { session: Session }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const {
    open,
    setOpen,
    revision,
    reload,
    setPreviewData,
    setPreviewUnavailable,
  } = usePagePreview();
  const [desktopWidth, setDesktopWidth] = useState(384);
  const key = open
    ? `/api/page-sessions/${session.id}/preview?revision=${revision}`
    : null;
  const { data, error, isLoading } = useSWR<PagePreviewResponse>(
    key,
    fetchPreview,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );

  useEffect(() => {
    if (data) {
      setPreviewData(data);
      setPreviewUnavailable(false);
    }
  }, [data, setPreviewData, setPreviewUnavailable]);

  useEffect(() => {
    if (error) {
      setPreviewData(null);
      setPreviewUnavailable(true);
    }
  }, [error, setPreviewData, setPreviewUnavailable]);

  const srcDoc = useMemo(() => (data ? wrapPageHtml(data.html) : ""), [data]);

  if (!open) {
    return null;
  }

  const content = (
    <>
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="min-w-0 truncate text-sm font-medium">
          {t("assistant.session.preview")}
        </div>
        {isMobile ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setOpen(false)}
          >
            {t("assistant.chat.closeChat")}
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 bg-white dark:bg-[#0a0a0a]">
        {data ? (
          <iframe
            title={data.title}
            srcDoc={srcDoc}
            sandbox={IFRAME_SANDBOX}
            className="h-full w-full border-0 bg-white dark:bg-[#0a0a0a]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
            <p className="text-sm font-medium text-foreground">
              {error
                ? t("assistant.session.previewUnavailable")
                : t("assistant.session.preview")}
            </p>
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={reload}>
                {t("assistant.session.retryPreview")}
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("assistant.session.preview")}
        data-testid="page-preview-slot"
        data-layout="mobile"
        className="fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-hidden border-l border-border bg-background"
      >
        {content}
      </div>
    );
  }

  return (
    <aside
      role="complementary"
      aria-label={t("assistant.session.preview")}
      data-testid="page-preview-slot"
      data-layout="desktop"
      className="relative flex h-full shrink-0 flex-col overflow-hidden border-l border-border bg-background shadow-lg sm:shadow-none"
      style={{ width: desktopWidth }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn(
          "absolute left-0 top-0 h-full w-1 cursor-col-resize",
          "bg-transparent hover:bg-border",
        )}
        onPointerDown={(event) => {
          const startX = event.clientX;
          const startWidth = desktopWidth;
          const handlePointerMove = (moveEvent: PointerEvent) => {
            const nextWidth = startWidth + startX - moveEvent.clientX;
            setDesktopWidth(Math.min(560, Math.max(320, nextWidth)));
          };
          const handlePointerUp = () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
          };
          window.addEventListener("pointermove", handlePointerMove);
          window.addEventListener("pointerup", handlePointerUp);
        }}
      />
      {content}
    </aside>
  );
}
