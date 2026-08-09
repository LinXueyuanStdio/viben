"use client";

import { useTranslation } from "react-i18next";
import Link from "next/link";
import type { GitHubConnectionReason } from "@/lib/github/status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function getReconnectDescriptionKey(
  reason: GitHubConnectionReason | null,
): string {
  switch (reason) {
    case "installations_missing":
      return "assistant.githubReconnect.descriptionInstallationsMissing";
    case "sync_auth_failed":
      return "assistant.githubReconnect.descriptionSyncAuthFailed";
    case "token_unavailable":
      return "assistant.githubReconnect.descriptionTokenUnavailable";
    default:
      return "assistant.githubReconnect.descriptionDefault";
  }
}

export function GitHubReconnectDialog({
  open,
  reason,
}: {
  open: boolean;
  reason: GitHubConnectionReason | null;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("assistant.githubReconnect.title")}</DialogTitle>
          <DialogDescription>
            {t(getReconnectDescriptionKey(reason))}{" "}
            {t("assistant.githubReconnect.restoreAccess")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button asChild>
            <Link href="/settings/connections">
              {t("assistant.githubReconnect.action")}
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
