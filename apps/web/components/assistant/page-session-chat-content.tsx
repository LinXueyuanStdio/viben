"use client";

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
