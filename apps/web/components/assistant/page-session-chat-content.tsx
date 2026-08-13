"use client";

import { useEffect } from "react";
import type { WebAgentUIMessage } from "@/app/types";
import { PageChatProvider } from "@/components/assistant/page-chat-provider";
import { SharedChatCore } from "@/components/assistant/shared-chat-core";
import type { Chat, Session } from "@/lib/db/schema";
import type { ModelOption } from "@/lib/model-options";

export type PageSessionChatContentProps = {
  session: Session;
  chat: Chat;
  initialMessages: WebAgentUIMessage[];
  initialModelOptions: ModelOption[];
  messageDurationMap: Record<string, number>;
  messageStartedAtMap: Record<string, string>;
  lastUserMessageSentAt: string | null;
};

export function PageSessionChatContent({
  session,
  chat,
  initialMessages,
  initialModelOptions,
  messageDurationMap,
  messageStartedAtMap,
  lastUserMessageSentAt,
}: PageSessionChatContentProps) {
  // Mark the chat as read so the sidebar's unread indicator clears. Page chat
  // previously never marked chats read, leaving the red dot stuck forever.
  useEffect(() => {
    void fetch(`/api/sessions/${session.id}/chats/${chat.id}/read`, {
      method: "POST",
    }).catch(() => undefined);
  }, [session.id, chat.id]);

  return (
    <PageChatProvider
      session={session}
      chat={chat}
      initialMessages={initialMessages}
      initialModelOptions={initialModelOptions}
    >
      <SharedChatCore
        key={chat.id}
        session={session}
        chat={chat}
        initialMessages={initialMessages}
        modelOptions={initialModelOptions}
        mode="page"
        density="full"
        transcriptProps={{
          messageDurationMap,
          messageStartedAtMap,
          lastUserMessageSentAt,
        }}
        composerProps={{
          placeholder: "Ask about this page",
        }}
      />
    </PageChatProvider>
  );
}
