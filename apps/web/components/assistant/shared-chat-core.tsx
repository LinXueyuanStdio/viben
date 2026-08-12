"use client";

import { useCallback, useMemo, type ReactNode, type Ref } from "react";
import { nanoid } from "nanoid";
import type { FileUIPart } from "ai";
import type { WebAgentUIMessage } from "@/app/types";
import {
  buildChatMessagePayload,
  type ChatMessagePayload,
} from "@/components/assistant/chat-message-payload";
import {
  ChatComposer,
  type ChatComposerHandle,
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
  runtime?: SharedChatRuntime;
  transcriptProps?: Partial<ChatTranscriptProps>;
  composerProps?: Partial<ChatComposerProps>;
  composerRef?: Ref<ChatComposerHandle>;
  composerHeader?: ReactNode;
  contextUsage?: ReactNode;
  composerContainerClassName?: string;
  composerInnerClassName?: string;
};

export type SharedChatRuntime = ReturnType<typeof useSessionChatRuntime>;

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

function SharedChatCoreWithRuntime(props: SharedChatCoreProps) {
  const contextLimit = useMemo(
    () => getContextLimit(props.modelOptions, props.chat.modelId),
    [props.chat.modelId, props.modelOptions],
  );
  const runtime = useSessionChatRuntime({
    sessionId: props.session.id,
    chatId: props.chat.id,
    initialMessages: props.initialMessages,
    initialChatActiveStreamId: props.chat.activeStreamId,
    contextLimit,
  });

  return <SharedChatCoreView {...props} runtime={runtime} />;
}

function SharedChatCoreView({
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
  runtime,
  transcriptProps,
  composerProps,
  composerRef,
  composerHeader,
  contextUsage = null,
  composerContainerClassName,
  composerInnerClassName,
}: SharedChatCoreProps & { runtime: SharedChatRuntime }) {
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
          {...transcriptProps}
        />
      </div>
      <div
        className={cn(
          density === "compact" ? "p-2" : "p-4 pb-2 sm:pb-8",
          composerContainerClassName,
        )}
      >
        <div
          className={cn(
            density === "compact" ? "space-y-2" : "mx-auto max-w-4xl space-y-2",
            composerInnerClassName,
          )}
        >
          {composerHeader}
          <ChatComposer
            ref={composerRef}
            mode={mode}
            density={density}
            modelId={chat.modelId ?? ""}
            modelOptions={modelOptions}
            contextUsage={contextUsage}
            status={chatRuntime.status}
            onModelChange={async () => undefined}
            onSubmit={handleSubmit}
            onStop={runtime.stopChatStream}
            workExtensions={mode === "work" ? workExtensions : undefined}
            className={cn(
              density === "compact" && "border-t border-border/60",
            )}
            {...composerProps}
          />
        </div>
      </div>
    </div>
  );
}

export function SharedChatCore(props: SharedChatCoreProps) {
  if (props.runtime) {
    return <SharedChatCoreView {...props} runtime={props.runtime} />;
  }

  return <SharedChatCoreWithRuntime {...props} />;
}
