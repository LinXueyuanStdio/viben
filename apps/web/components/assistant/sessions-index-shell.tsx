"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SessionStarter } from "@/components/assistant/session-starter";
import { useSessionsShell } from "./sessions-shell-context";

export function SessionsIndexShell() {
  const { createSession, lastRepo } = useSessionsShell();
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateSession = async (input: Parameters<typeof createSession>[0]) => {
    setIsCreating(true);
    try {
      const { session: createdSession, chat } = await createSession(input);
      router.push(`/assistant/${createdSession.id}/${chat.id}`);
    } catch (error) {
      console.error("Failed to create session:", error);
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
