"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { nanoid } from "nanoid";
import type { FileUIPart } from "ai";
import type { WebAgentUIMessage } from "@/app/types";
import {
  buildChatMessagePayload,
  type ChatMessagePayload,
} from "@/components/assistant/chat-message-payload";
import {
  ChatComposer,
  type ChatComposerProps,
  type ChatComposerSubmit,
} from "@/components/assistant/chat-composer";
import {
  ChatTranscript,
  type ChatTranscriptProps,
} from "@/components/assistant/chat-transcript";
import { useSessionChatRuntime } from "@/hooks/assistant/chat/use-session-chat-runtime";
import type { Chat, Session } from "@/lib/db/schema";
import type { ModelOption } from "@/lib/model-options";
import type { PageContentChangedDetail } from "@/lib/page-chat/page-content-events";
import { cn } from "@/lib/utils";

export type SharedChatCoreProps = {
  session: Session;
  chat: Chat;
  initialMessages: WebAgentUIMessage[];
  modelOptions: ModelOption[];
  mode: "work" | "page";
  density: "full" | "compact";
  emptyState?: ReactNode;
  toolbar?: ReactNode;
  transcriptActions?: Pick<ChatTranscriptProps, "onForkMessage" | "onOpenFile">;
  workExtensions?: ChatComposerProps["workExtensions"];
  onPageContentChanged?: (detail: PageContentChangedDetail) => void;
  onChatActivity?: () => void;
};

function getContextLimit(modelOptions: ModelOption[], modelId: string | null) {
  if (!modelId) return null;
  const contextWindow = modelOptions.find(
    (option) => option.id === modelId,
  )?.contextWindow;
  return typeof contextWindow === "number" && Number.isFinite(contextWindow)
    ? contextWindow
    : null;
}

function toFilePart(
  image: ChatComposerSubmit["images"][number],
  index: number,
): FileUIPart {
  const extension = image.mediaType.split("/")[1] ?? "png";
  return {
    type: "file",
    filename: image.filename ?? `image-${index + 1}.${extension}`,
    mediaType: image.mediaType,
    url: image.url,
  };
}

function toMessagePayload(draft: ChatComposerSubmit): ChatMessagePayload {
  return buildChatMessagePayload({
    text: draft.text,
    files: draft.images.map(toFilePart),
    textAttachments: draft.textAttachments.map((attachment) => ({
      id: nanoid(),
      filename: attachment.filename,
      content: attachment.content,
      lineCount: attachment.content.split("\n").length,
      byteSize: new Blob([attachment.content]).size,
    })),
  });
}

export function SharedChatCore({
  session,
  chat,
  initialMessages,
  modelOptions,
  mode,
  density,
  emptyState,
  toolbar,
  transcriptActions,
  workExtensions,
  onPageContentChanged,
  onChatActivity,
}: SharedChatCoreProps) {
  const contextLimit = useMemo(
    () => getContextLimit(modelOptions, chat.modelId),
    [chat.modelId, modelOptions],
  );
  const runtime = useSessionChatRuntime({
    sessionId: session.id,
    chatId: chat.id,
    initialMessages,
    initialChatActiveStreamId: chat.activeStreamId,
    contextLimit,
  });
  const { chat: chatRuntime } = runtime;

  const handleSubmit = useCallback(
    async (draft: ChatComposerSubmit) => {
      await chatRuntime.sendMessage(toMessagePayload(draft));
      onChatActivity?.();
    },
    [chatRuntime, onChatActivity],
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {toolbar ? <div className="shrink-0">{toolbar}</div> : null}
      <div className="min-h-0 flex-1">
        <ChatTranscript
          messages={chatRuntime.messages}
          status={chatRuntime.status}
          error={chatRuntime.error}
          compact={density === "compact"}
          emptyState={emptyState}
          onCopyMessage={() => undefined}
          onRetryMessage={() => runtime.retryChatStream()}
          onForkMessage={transcriptActions?.onForkMessage}
          onOpenFile={transcriptActions?.onOpenFile}
          onPageContentChanged={onPageContentChanged}
          messageDurationMap={{}}
          messageStartedAtMap={{}}
          lastUserMessageSentAt={null}
        />
      </div>
      <ChatComposer
        mode={mode}
        density={density}
        modelId={chat.modelId ?? ""}
        modelOptions={modelOptions}
        contextUsage={null}
        status={chatRuntime.status}
        onModelChange={async () => undefined}
        onSubmit={handleSubmit}
        onStop={runtime.stopChatStream}
        workExtensions={mode === "work" ? workExtensions : undefined}
        className={cn(density === "compact" && "border-t border-border/60")}
      />
    </div>
  );
}
