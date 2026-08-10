"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SessionStarter } from "@/components/assistant/session-starter";
import type { SessionStarterSubmitInput } from "@/components/assistant/session-starter";
import { putStarterMessage } from "@/components/assistant/starter-message-handoff";
import { useSessionsShell } from "./sessions-shell-context";

export function SessionsIndexShell() {
  const { createSession, lastRepo } = useSessionsShell();
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
      router.push(`/assistant/${createdSession.id}/chats/${chat.id}`);
    } catch (error) {
      console.error("Failed to create session:", error);
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-4">
      <SessionStarter
        onSubmit={handleCreateSession}
        isLoading={isCreating}
        lastRepo={lastRepo}
      />
    </div>
  );
}
