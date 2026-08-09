"use client";

import { GitPullRequestClosed, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { closePr, type ClosePullRequestResult } from "@/lib/github/actions/pr";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Session } from "@/lib/db/schema";

interface ClosePrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: Session;
  onClosed?: (result: ClosePullRequestResult) => Promise<void> | void;
}

export function ClosePrDialog({
  open,
  onOpenChange,
  session,
  onClosed,
}: ClosePrDialogProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const closeResult = await closePr({ sessionId: session.id });
      if (!closeResult.closed) {
        throw new Error(t("assistant.commit.closePrError"));
      }

      await onClosed?.(closeResult);

      onOpenChange(false);
    } catch (closeError) {
      setError(
        closeError instanceof Error
          ? closeError.message
          : t("assistant.commit.closePrError"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitPullRequestClosed className="h-5 w-5" />
            {t("assistant.commit.closeAndArchiveTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("assistant.commit.closeAndArchiveDescription", {
              prNumber: session.prNumber,
            })}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("assistant.commit.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("assistant.commit.closing")}
              </>
            ) : (
              t("assistant.commit.closeAndArchiveConfirm")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
