"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SandboxType } from "@/components/assistant/sandbox-selector-compact";
import { SessionStarter } from "@/components/assistant/session-starter";
import type { SessionStarterSubmitInput } from "@/components/assistant/session-starter";
import { putStarterMessage } from "@/components/assistant/starter-message-handoff";
import type { VercelProjectSelection } from "@/lib/vercel/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CreateSessionInput = {
  repoOwner?: string;
  repoName?: string;
  branch?: string;
  cloneUrl?: string;
  isNewBranch: boolean;
  sandboxType: SandboxType;
  autoCommitPush: boolean;
  autoCreatePr: boolean;
  vercelProject?: VercelProjectSelection | null;
};

interface NewSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lastRepo?: { owner: string; repo: string } | null;
  createSession: (input: CreateSessionInput) => Promise<{
    session: { id: string };
    chat: { id: string };
  }>;
}

export function NewSessionDialog({
  open,
  onOpenChange,
  lastRepo,
  createSession,
}: NewSessionDialogProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateSession = async ({
    sessionInput,
    draft,
  }: SessionStarterSubmitInput) => {
    setIsCreating(true);
    try {
      const { session: createdSession, chat } =
        await createSession(sessionInput);
      putStarterMessage(chat.id, draft);
      onOpenChange(false);
      router.push(`/assistant/${createdSession.id}/chats/${chat.id}`);
    } catch (error) {
      console.error("Failed to create session:", error);
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-0 overflow-hidden border-none bg-transparent p-0 shadow-none [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{t("assistant.newSession")}</DialogTitle>
          <DialogDescription>
            {t("assistant.newSessionDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0">
          <SessionStarter
            onSubmit={handleCreateSession}
            isLoading={isCreating}
            lastRepo={lastRepo}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
