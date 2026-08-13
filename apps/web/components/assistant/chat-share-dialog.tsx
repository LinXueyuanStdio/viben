"use client";

import { Check, Copy, Link2, Loader2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ChatShareDialog({
  sessionId,
  chatId,
  initialShareId,
  externalOpen,
  onExternalOpenChange,
  trigger,
}: {
  sessionId: string;
  chatId: string;
  initialShareId: string | null;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = onExternalOpenChange ?? setInternalOpen;
  const [shareId, setShareId] = useState(initialShareId);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState<string | null>(
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
      : null,
  );

  useEffect(() => {
    if (!baseUrl) {
      setBaseUrl(window.location.origin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const shareUrl = shareId && baseUrl ? `${baseUrl}/shared/${shareId}` : null;

  useEffect(() => {
    let active = true;
    setShareId(initialShareId);
    setCopied(false);
    setError(null);

    const loadShareId = async () => {
      try {
        const res = await fetch(
          `/api/sessions/${sessionId}/chats/${chatId}/share`,
        );
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as { shareId: string | null };
        if (!active) {
          return;
        }
        setShareId(data.shareId);
      } catch {
        // Ignore silent refresh errors in dialog state; user action still works.
      }
    };

    void loadShareId();

    return () => {
      active = false;
    };
  }, [sessionId, chatId, initialShareId]);

  async function enableSharing() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/chats/${chatId}/share`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        setError(t("assistant.chatContent.shareEnableError"));
        return;
      }
      const data = (await res.json()) as { shareId: string };
      setShareId(data.shareId);
    } catch {
      setError(t("assistant.chatContent.shareEnableError"));
    } finally {
      setIsLoading(false);
    }
  }

  async function disableSharing() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/chats/${chatId}/share`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) {
        setError(t("assistant.chatContent.shareDisableError"));
        return;
      }
      setShareId(null);
      setCopied(false);
    } catch {
      setError(t("assistant.chatContent.shareDisableError"));
    } finally {
      setIsLoading(false);
    }
  }

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isExternallyControlled = externalOpen !== undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isExternallyControlled && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="ghost" size="sm">
              <Share2 className="mr-2 h-4 w-4" />
              {t("assistant.chatContent.share")}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("assistant.chatContent.shareChatTitle")}</DialogTitle>
          <DialogDescription>
            {t("assistant.chatContent.shareChatDescription")}
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {shareId ? (
          <>
            <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-md border bg-muted px-3 py-2 text-sm">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{shareUrl}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={copyLink}
                className="w-full sm:w-auto sm:shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    {t("assistant.chatContent.copied")}
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    {t("assistant.chatContent.copyLink")}
                  </>
                )}
              </Button>
            </div>
            <DialogFooter className="sm:justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => void disableSharing()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("assistant.chatContent.revokeLink")}
              </Button>
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  {t("assistant.chatContent.close")}
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <DialogFooter>
            <Button
              onClick={() => void enableSharing()}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              {t("assistant.chatContent.createShareLink")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
