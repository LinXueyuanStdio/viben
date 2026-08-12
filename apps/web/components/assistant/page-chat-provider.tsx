"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { WebAgentUIMessage } from "@/app/types";
import type { Chat, Session } from "@/lib/db/schema";
import type { ModelOption } from "@/lib/model-options";

type PageChatProviderContextValue = {
  session: Session;
  chat: Chat;
  initialMessages: WebAgentUIMessage[];
  modelOptions: ModelOption[];
};

const PageChatProviderContext = createContext<
  PageChatProviderContextValue | undefined
>(undefined);

export function PageChatProvider({
  session,
  chat,
  initialMessages,
  initialModelOptions,
  children,
}: {
  session: Session;
  chat: Chat;
  initialMessages: WebAgentUIMessage[];
  initialModelOptions: ModelOption[];
  children: ReactNode;
}) {
  const value = useMemo<PageChatProviderContextValue>(
    () => ({
      session,
      chat,
      initialMessages,
      modelOptions: initialModelOptions,
    }),
    [chat, initialMessages, initialModelOptions, session],
  );

  return (
    <PageChatProviderContext.Provider value={value}>
      {children}
    </PageChatProviderContext.Provider>
  );
}

export function usePageChatProviderContext() {
  const context = useContext(PageChatProviderContext);
  if (!context) {
    throw new Error(
      "usePageChatProviderContext must be used within a PageChatProvider",
    );
  }
  return context;
}
