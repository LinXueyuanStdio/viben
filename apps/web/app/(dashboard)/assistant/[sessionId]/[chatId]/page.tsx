import dynamic from "next/dynamic";

const SessionChatContent = dynamic(
  () => import("@/components/assistant/session-chat-content").then((m) => ({ default: m.SessionChatContent })),
  { ssr: false }
);

interface ChatPageProps {
  params: Promise<{ sessionId: string; chatId: string }>;
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { sessionId, chatId } = await params;
  void sessionId;
  void chatId;
  return <SessionChatContent
    initialIsOnlyChatInSession={false}
    messageDurationMap={{}}
    messageStartedAtMap={{}}
    lastUserMessageSentAt={null}
    codeEditorDisabledReason={null}
  />;
}
