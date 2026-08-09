"use client";

import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import {
  getValidRenameTitle,
  isRenameSaveDisabled,
} from "@/components/assistant/inbox-sidebar-rename";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SessionWithUnread } from "@/hooks/assistant/use-sessions";

type InboxSidebarRenameDialogProps = {
  session: SessionWithUnread | null;
  onClose: () => void;
  onRenameSession: (sessionId: string, title: string) => Promise<void>;
  onRenamed?: (sessionId: string, title: string) => void;
};

export function InboxSidebarRenameDialog({
  session,
  onClose,
  onRenameSession,
  onRenamed,
}: InboxSidebarRenameDialogProps) {
  const { t } = useTranslation();
  const [draftTitle, setDraftTitle] = useState("");
  const [renaming, setRenaming] = useState(false);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!session) {
      setDraftTitle("");
      setRenaming(false);
      return;
    }

    setDraftTitle(session.title);
    setRenaming(false);
  }, [session]);

  useEffect(() => {
    if (!session || !renameInputRef.current) {
      return;
    }

    renameInputRef.current.focus();
    renameInputRef.current.select();
  }, [session]);

  const isSaveDisabled = isRenameSaveDisabled({
    renaming,
    hasTargetSession: Boolean(session),
    draftTitle,
    originalTitle: session?.title ?? null,
  });

  const handleRenameSubmit = async () => {
    if (!session) {
      return;
    }

    const nextTitle = getValidRenameTitle({
      draftTitle,
      originalTitle: session.title,
    });
    if (!nextTitle) {
      onClose();
      return;
    }

    setRenaming(true);
    try {
      await onRenameSession(session.id, nextTitle);
      onRenamed?.(session.id, nextTitle);
      onClose();
    } catch (error) {
      console.error("Failed to rename session:", error);
      setRenaming(false);
    }
  };

  return (
    <Dialog
      open={Boolean(session)}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("assistant.renameDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("assistant.renameDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleRenameSubmit();
          }}
          className="space-y-4"
        >
          <Input
            ref={renameInputRef}
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder={t("assistant.renameDialog.placeholder")}
            maxLength={120}
            disabled={renaming}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={renaming}
            >
              {t("assistant.renameDialog.cancel")}
            </Button>
            <Button type="submit" disabled={isSaveDisabled}>
              {renaming
                ? t("assistant.renameDialog.saving")
                : t("assistant.renameDialog.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
