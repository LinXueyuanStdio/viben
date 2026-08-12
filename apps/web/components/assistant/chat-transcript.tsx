"use client";

import {
  isReasoningUIPart,
  isToolUIPart,
  type FileUIPart,
} from "ai";
import {
  ArrowDown,
  Check,
  Copy,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import type {
  WebAgentCommitDataPart,
  WebAgentPrDataPart,
  WebAgentSnippetDataPart,
  WebAgentUIMessage,
  WebAgentUIMessagePart,
  WebAgentUIToolPart,
} from "@/app/types";
import {
  AssistantFileLink,
  type AssistantFileLinkProps,
} from "@/components/assistant/assistant-file-link";
import { AssistantMessageGroups } from "@/components/assistant/assistant-message-groups";
import { LazyStreamdown } from "@/components/assistant/lazy-streamdown";
import { MessageModelPill } from "@/components/assistant/message-model-pill";
import { SnippetChip } from "@/components/assistant/snippet-chip";
import { ThinkingBlock } from "@/components/assistant/thinking-block";
import { ToolCall } from "@/components/assistant/tool-call";
import { OpenFileProvider } from "@/components/assistant/tool-call/open-file-context";
import { Button } from "@/components/ui/button";
import { useScrollToBottom } from "@/hooks/assistant/use-scroll-to-bottom";
import {
  hasRenderableAssistantPart,
  isChatInFlight as isChatInFlightStatus,
  isGitDataPart,
  shouldKeepCollapsedReasoningStreaming,
  shouldRenderGitDataPart,
} from "@/lib/chat-streaming-state";
import type { ModelOption } from "@/lib/model-options";
import {
  type PageContentChangedDetail,
  emitPageContentChanged,
} from "@/lib/page-chat/page-content-events";
import { cn } from "@/lib/utils";

type ReasoningMessagePart = Extract<
  WebAgentUIMessagePart,
  { type: "reasoning" }
>;

type MessageRenderGroup =
  | {
      type: "part";
      part: WebAgentUIMessagePart;
      index: number;
      renderKey: string;
    }
  | {
      type: "reasoning-group";
      parts: ReasoningMessagePart[];
      startIndex: number;
      renderKey: string;
    };

type GroupedRenderMessage = {
  message: WebAgentUIMessage;
  groups: MessageRenderGroup[];
  isStreaming: boolean;
};

export type ChatTranscriptProps = {
  messages: WebAgentUIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
  error: Error | undefined;
  compact?: boolean;
  emptyState?: ReactNode;
  onCopyMessage: (message: WebAgentUIMessage) => void;
  onRetryMessage: (message: WebAgentUIMessage) => void;
  onForkMessage?: (message: WebAgentUIMessage) => void;
  onOpenFile?: (path: string) => void;
  onDeleteMessage?: (message: WebAgentUIMessage) => void;
  onApproveTool?: (id: string) => void;
  onDenyTool?: (id: string, reason?: string) => void;
  onPageContentChanged?: (detail: PageContentChangedDetail) => void;
  messageDurationMap: Record<string, number>;
  messageStartedAtMap: Record<string, string>;
  lastUserMessageSentAt: string | null;
  isChatInFlight?: boolean;
  showThinkingIndicator?: boolean;
  thinkingMessage?: string;
  modelOptions?: ModelOption[];
  lastSendStartedAt?: string | null;
  actionDisabled?: boolean;
  deletingMessageId?: string | null;
  resendingMessageId?: string | null;
  forkingMessageId?: string | null;
};

function getPartIdentity(part: WebAgentUIMessagePart): string {
  if (isToolUIPart(part)) {
    return part.toolCallId ? `tool:${part.toolCallId}` : `tool:${part.type}`;
  }

  if (isReasoningUIPart(part)) {
    return "reasoning";
  }

  if (part.type === "text") {
    return "text";
  }

  if (part.type === "file") {
    if (part.url) return `file:${part.url}`;
    if (part.filename) return `file:${part.filename}`;
    return "file";
  }

  if (isGitDataPart(part)) {
    return part.id ? `data:${part.type}:${part.id}` : `data:${part.type}`;
  }

  return `part:${part.type}`;
}

function getReasoningGroupText(parts: ReasoningMessagePart[]): string {
  return parts
    .map((part) => part.text)
    .filter((text) => text.trim().length > 0)
    .join("\n\n");
}

function getAssistantText(message: WebAgentUIMessage): string {
  return message.parts
    .filter(
      (part): part is Extract<WebAgentUIMessagePart, { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}

function parseToolOutput(output: unknown): Record<string, unknown> | null {
  if (typeof output === "string") {
    try {
      const parsed = JSON.parse(output);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  if (output && typeof output === "object" && !Array.isArray(output)) {
    return output as Record<string, unknown>;
  }

  return null;
}

function getPageContentChangedDetail(
  part: WebAgentUIMessagePart,
): PageContentChangedDetail | null {
  if (!isToolUIPart(part)) {
    return null;
  }

  const toolName =
    "toolName" in part && typeof part.toolName === "string"
      ? part.toolName
      : part.type.replace(/^tool-/, "");
  if (toolName !== "update_page" || part.state !== "output-available") {
    return null;
  }

  const output = "output" in part ? parseToolOutput(part.output) : null;
  if (!output || output.success !== true) {
    return null;
  }

  const publishedPageId =
    typeof output.published_page_id === "string"
      ? output.published_page_id
      : typeof output.publishedPageId === "string"
        ? output.publishedPageId
        : null;
  const chatId =
    typeof output.chat_id === "string"
      ? output.chat_id
      : typeof output.chatId === "string"
        ? output.chatId
        : null;

  if (!publishedPageId || !chatId) {
    return null;
  }

  return { publishedPageId, chatId };
}

function GitDataPartCard({
  part,
}: {
  part: WebAgentCommitDataPart | WebAgentPrDataPart;
}) {
  const { t } = useTranslation();
  const isCommit = part.type === "data-commit";
  const { status } = part.data;
  const isPending = status === "pending";
  const isSuccess = status === "success";
  const isError = status === "error";
  const url = part.data.url;
  const shortSha =
    isCommit && part.data.commitSha
      ? part.data.commitSha.slice(0, 7)
      : undefined;
  const commitMessage = isCommit ? part.data.commitMessage : undefined;
  const prNumber = !isCommit ? part.data.prNumber : undefined;

  let label: string;
  if (isCommit) {
    if (isPending) label = t("assistant.chatContent.commitCreating");
    else if (isSuccess) {
      if (part.data.committed && part.data.pushed) {
        label = t("assistant.chatContent.commitCommittedAndPushed");
      } else if (part.data.committed) {
        label = t("assistant.chatContent.commitCommitted");
      } else if (part.data.pushed) {
        label = t("assistant.chatContent.commitPushed");
      } else {
        label = t("assistant.chatContent.commitComplete");
      }
    } else if (isError)
      label = part.data.error ?? t("assistant.chatContent.commitFailed");
    else label = t("assistant.chatContent.commitNoChanges");
  } else {
    if (isPending) label = t("assistant.chatContent.prCreating");
    else if (isSuccess) {
      if (part.data.requiresManualCreation) {
        label = t("assistant.chatContent.prReadyToCreate");
      } else if (part.data.syncedExisting && prNumber) {
        label = t("assistant.chatContent.prSyncedToExisting", { prNumber });
      } else if (prNumber) {
        label = t("assistant.chatContent.prOpened", { prNumber });
      } else {
        label = t("assistant.chatContent.prReady");
      }
    } else if (isError)
      label = part.data.error ?? t("assistant.chatContent.prFailed");
    else label = part.data.skipReason ?? t("assistant.chatContent.prSkipped");
  }

  const detail = isCommit ? (shortSha ?? commitMessage) : undefined;
  const IconEl = isPending ? (
    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/50" />
  ) : isError ? (
    <X className="h-3 w-3 text-red-500/70" />
  ) : isCommit ? (
    <GitCommitHorizontal className="h-3 w-3 text-muted-foreground/50" />
  ) : (
    <GitPullRequest className="h-3 w-3 text-muted-foreground/50" />
  );
  const subtitle =
    isCommit && shortSha && commitMessage ? commitMessage : undefined;
  const textColor = isError
    ? "text-red-500/70 dark:text-red-400/70"
    : "text-muted-foreground/70";
  const Wrapper = url && !isPending ? "a" : "div";
  const wrapperProps =
    url && !isPending
      ? ({
          href: url,
          target: "_blank",
          rel: "noreferrer",
        } as const)
      : {};

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-border/60" />
      <Wrapper
        {...wrapperProps}
        className={cn(
          "group/sep flex max-w-[80%] items-center gap-1.5",
          url && !isPending && "cursor-pointer",
        )}
      >
        {IconEl}
        <span
          className={cn(
            "truncate text-xs font-medium",
            textColor,
            url &&
              !isPending &&
              "group-hover/sep:text-foreground transition-colors",
          )}
        >
          {label}
        </span>
        {detail && (
          <>
            <span className="text-muted-foreground/30">·</span>
            <span
              className={cn(
                "truncate font-mono text-[11px]",
                textColor,
                url &&
                  !isPending &&
                  "group-hover/sep:text-foreground transition-colors",
              )}
            >
              {detail}
            </span>
          </>
        )}
        {url && !isPending && (
          <ExternalLink
            className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground/0 transition-colors",
              "group-hover/sep:text-muted-foreground",
            )}
          />
        )}
      </Wrapper>
      <div className="h-px flex-1 bg-border/60" />
      {subtitle && <p className="sr-only">{subtitle}</p>}
    </div>
  );
}

export function ChatTranscript({
  messages,
  status,
  compact,
  emptyState,
  onCopyMessage,
  onRetryMessage,
  onForkMessage,
  onOpenFile,
  onDeleteMessage,
  onApproveTool,
  onDenyTool,
  onPageContentChanged,
  messageDurationMap,
  messageStartedAtMap,
  lastUserMessageSentAt,
  isChatInFlight,
  showThinkingIndicator,
  thinkingMessage,
  modelOptions,
  lastSendStartedAt,
  actionDisabled,
  deletingMessageId,
  resendingMessageId,
  forkingMessageId,
}: ChatTranscriptProps) {
  const { t } = useTranslation();
  const [copiedAssistantMessageId, setCopiedAssistantMessageId] = useState<
    string | null
  >(null);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const notifiedToolCallsRef = useRef<Set<string>>(new Set());
  const { containerRef, isAtBottom, scrollToBottom } =
    useScrollToBottom<HTMLDivElement>();

  const streaming =
    isChatInFlight ?? isChatInFlightStatus(status as Parameters<typeof isChatInFlightStatus>[0]);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!onPageContentChanged) {
      return;
    }

    for (const message of messages) {
      if (message.role !== "assistant") {
        continue;
      }
      for (const part of message.parts) {
        if (!isToolUIPart(part)) {
          continue;
        }
        const toolCallId = part.toolCallId;
        if (!toolCallId || notifiedToolCallsRef.current.has(toolCallId)) {
          continue;
        }
        const detail = getPageContentChangedDetail(part);
        if (!detail) {
          continue;
        }
        notifiedToolCallsRef.current.add(toolCallId);
        onPageContentChanged(detail);
        emitPageContentChanged(detail);
      }
    }
  }, [messages, onPageContentChanged]);

  const groupedRenderMessages = useMemo<GroupedRenderMessage[]>(() => {
    return messages.map((message, messageIndex) => {
      const groups: MessageRenderGroup[] = [];
      let currentReasoningGroup: ReasoningMessagePart[] = [];
      let reasoningGroupStartIndex = 0;
      const partIdentityCounts = new Map<string, number>();

      const getStablePartRenderKey = (part: WebAgentUIMessagePart): string => {
        const identity = getPartIdentity(part);

        if (isToolUIPart(part) && part.toolCallId) {
          return identity;
        }

        const count = partIdentityCounts.get(identity) ?? 0;
        partIdentityCounts.set(identity, count + 1);
        return `${identity}:${count}`;
      };

      const flushReasoningGroup = () => {
        if (currentReasoningGroup.length === 0) return;

        groups.push({
          type: "reasoning-group",
          parts: currentReasoningGroup,
          startIndex: reasoningGroupStartIndex,
          renderKey: `reasoning-group:${getStablePartRenderKey(currentReasoningGroup[0])}`,
        });
        currentReasoningGroup = [];
      };

      message.parts.forEach((part, index) => {
        if (isReasoningUIPart(part)) {
          if (currentReasoningGroup.length === 0) {
            reasoningGroupStartIndex = index;
          }
          currentReasoningGroup.push(part);
          return;
        }

        flushReasoningGroup();
        groups.push({
          type: "part",
          part,
          index,
          renderKey: getStablePartRenderKey(part),
        });
      });

      flushReasoningGroup();

      return {
        message,
        groups,
        isStreaming: streaming && messageIndex === messages.length - 1,
      };
    });
  }, [messages, streaming]);

  const streamdownComponents = useMemo(
    () => ({
      a: (props: AssistantFileLinkProps) => (
        <AssistantFileLink {...props} onOpenFile={onOpenFile} />
      ),
    }),
    [onOpenFile],
  );

  const handleCopyAssistantMessage = useCallback(
    async (message: WebAgentUIMessage) => {
      onCopyMessage(message);
      const text = getAssistantText(message).trim();
      if (text.length === 0) {
        return;
      }

      if (typeof navigator === "undefined" || !navigator.clipboard) {
        return;
      }

      try {
        await navigator.clipboard.writeText(text);
        setCopiedAssistantMessageId(message.id);
        if (copyResetTimeoutRef.current !== null) {
          window.clearTimeout(copyResetTimeoutRef.current);
        }
        copyResetTimeoutRef.current = window.setTimeout(() => {
          setCopiedAssistantMessageId((currentMessageId) =>
            currentMessageId === message.id ? null : currentMessageId,
          );
          copyResetTimeoutRef.current = null;
        }, 2000);
      } catch (copyError) {
        console.error("Failed to copy assistant message:", copyError);
      }
    },
    [onCopyMessage],
  );

  const renderContainerClassName = compact
    ? "mx-auto max-w-full overflow-hidden px-3 py-4"
    : "mx-auto max-w-4xl overflow-hidden px-4 py-8";

  return (
    <div className="relative flex-1 overflow-hidden">
      <div ref={containerRef} className="h-full overflow-y-auto">
        <div className={renderContainerClassName}>
          <OpenFileProvider onOpenFile={onOpenFile ?? (() => {})}>
            <div className="space-y-6">
              {groupedRenderMessages.length === 0 &&
                showThinkingIndicator !== true &&
                (emptyState ?? (
                  <div className="flex h-full min-h-[40vh] items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                      {t("assistant.chatContent.emptyState")}
                    </p>
                  </div>
                ))}
              {groupedRenderMessages.map(
                ({ message: m, groups, isStreaming: isMessageStreaming }) => {
                  const renderGroups = (isToolCallsExpanded: boolean) =>
                    groups.map((group) => {
                      if (group.type === "reasoning-group") {
                        if (!isToolCallsExpanded) return null;
                        const hasRenderableContentAfterGroup = m.parts
                          .slice(group.startIndex + group.parts.length)
                          .some(hasRenderableAssistantPart);

                        return (
                          <div
                            key={`${m.id}-${group.renderKey}`}
                            className="max-w-full pl-[22px]"
                          >
                            <ThinkingBlock
                              text={getReasoningGroupText(group.parts)}
                              isStreaming={shouldKeepCollapsedReasoningStreaming(
                                {
                                  isMessageStreaming,
                                  hasStreamingReasoningPart: group.parts.some(
                                    (part) => part.state === "streaming",
                                  ),
                                  hasRenderableContentAfterGroup,
                                },
                              )}
                              partCount={group.parts.length}
                            />
                          </div>
                        );
                      }

                      const p = group.part;

                      if (isReasoningUIPart(p)) {
                        if (!isToolCallsExpanded) return null;
                        const hasRenderableContentAfterGroup = m.parts
                          .slice(group.index + 1)
                          .some(hasRenderableAssistantPart);

                        return (
                          <div
                            key={`${m.id}-${group.renderKey}`}
                            className="max-w-full pl-[22px]"
                          >
                            <ThinkingBlock
                              text={p.text}
                              isStreaming={shouldKeepCollapsedReasoningStreaming(
                                {
                                  isMessageStreaming,
                                  hasStreamingReasoningPart:
                                    p.state === "streaming",
                                  hasRenderableContentAfterGroup,
                                },
                              )}
                            />
                          </div>
                        );
                      }

                      if (p.type === "text") {
                        if (p.text.length === 0) {
                          return null;
                        }

                        const isFinalAssistantTextPart =
                          m.role === "assistant" &&
                          !m.parts
                            .slice(group.index + 1)
                            .some((messagePart) => messagePart.type === "text");

                        if (
                          !isToolCallsExpanded &&
                          m.role === "assistant" &&
                          !isFinalAssistantTextPart
                        ) {
                          return null;
                        }

                        const canCopyAssistantMessage =
                          isFinalAssistantTextPart &&
                          !isMessageStreaming &&
                          p.text.trim().length > 0;

                        return (
                          <div
                            key={`${m.id}-${group.renderKey}`}
                            className={cn(
                              "flex min-w-0 py-2",
                              m.role === "user"
                                ? "justify-end"
                                : "justify-start",
                              isFinalAssistantTextPart &&
                                group.index > 0 &&
                                "mt-4",
                              m.role === "assistant" &&
                                !isFinalAssistantTextPart &&
                                "pl-[22px]",
                            )}
                          >
                            {m.role === "user" ? (
                              <div className="group relative w-fit min-w-0 max-w-[80%]">
                                <div className="rounded-3xl bg-secondary px-4 py-2">
                                  <p className="whitespace-pre-wrap break-words">
                                    {p.text}
                                  </p>
                                </div>
                                {group.index === 0 &&
                                  (onRetryMessage || onDeleteMessage) && (
                                    <div className="absolute -left-20 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md bg-background/80 p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100">
                                      {onRetryMessage && (
                                        <button
                                          type="button"
                                          onClick={() => onRetryMessage(m)}
                                          disabled={actionDisabled}
                                          aria-label={t(
                                            "assistant.chatContent.resendMessageAria",
                                          )}
                                          className="rounded p-1 transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                          {resendingMessageId === m.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <RotateCcw className="h-4 w-4" />
                                          )}
                                        </button>
                                      )}
                                      {onDeleteMessage && (
                                        <button
                                          type="button"
                                          onClick={() => onDeleteMessage(m)}
                                          disabled={actionDisabled}
                                          aria-label={t(
                                            "assistant.chatContent.deleteMessageAria",
                                          )}
                                          className="rounded p-1 transition hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                          {deletingMessageId === m.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Trash2 className="h-4 w-4" />
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  )}
                              </div>
                            ) : (
                              <div className="group min-w-0 w-full overflow-hidden">
                                <LazyStreamdown
                                  animated={
                                    isMessageStreaming
                                      ? {
                                          animation: "fadeIn",
                                          duration: 250,
                                          easing: "ease-out",
                                        }
                                      : undefined
                                  }
                                  mode={isMessageStreaming ? "streaming" : "static"}
                                  isAnimating={isMessageStreaming}
                                  components={streamdownComponents}
                                >
                                  {p.text}
                                </LazyStreamdown>
                                {(canCopyAssistantMessage ||
                                  (!isMessageStreaming &&
                                    isFinalAssistantTextPart &&
                                    m.metadata)) && (
                                  <div className="mt-1 flex items-center justify-start">
                                    {canCopyAssistantMessage && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void handleCopyAssistantMessage(m)
                                          }
                                          aria-label={t(
                                            "assistant.chatContent.copyAssistantResponseAria",
                                          )}
                                          className="rounded p-1 text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                                        >
                                          {copiedAssistantMessageId === m.id ? (
                                            <Check className="h-4 w-4" />
                                          ) : (
                                            <Copy className="h-4 w-4" />
                                          )}
                                        </button>
                                        {onForkMessage && (
                                          <button
                                            type="button"
                                            onClick={() => onForkMessage(m)}
                                            disabled={forkingMessageId !== null}
                                            aria-label={t(
                                              "assistant.chatContent.forkConversationAria",
                                            )}
                                            className={cn(
                                              "rounded p-1 text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-40",
                                              forkingMessageId === m.id &&
                                                "opacity-100",
                                            )}
                                          >
                                            {forkingMessageId === m.id ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <GitBranch className="h-4 w-4" />
                                            )}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                    {!isMessageStreaming &&
                                      isFinalAssistantTextPart &&
                                      m.metadata && (
                                        <span className="opacity-0 transition group-hover:opacity-100">
                                          <MessageModelPill
                                            metadata={m.metadata}
                                            modelOptions={modelOptions ?? []}
                                          />
                                        </span>
                                      )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (isToolUIPart(p)) {
                        if (!isToolCallsExpanded) return null;
                        return (
                          <div
                            key={`${m.id}-${group.renderKey}`}
                            className="max-w-full pl-[22px]"
                          >
                            <ToolCall
                              part={p as WebAgentUIToolPart}
                              isStreaming={isMessageStreaming}
                              onApprove={(id: string) => onApproveTool?.(id)}
                              onDeny={(id: string, reason?: string) =>
                                onDenyTool?.(id, reason)
                              }
                            />
                          </div>
                        );
                      }

                      if (isGitDataPart(p)) {
                        if (!shouldRenderGitDataPart(p)) {
                          return null;
                        }

                        return (
                          <div
                            key={`${m.id}-${group.renderKey}`}
                            className="max-w-full"
                          >
                            <GitDataPartCard part={p} />
                          </div>
                        );
                      }

                      if (
                        p.type === "file" &&
                        p.mediaType?.startsWith("image/")
                      ) {
                        if (!isToolCallsExpanded && m.role === "assistant") {
                          return null;
                        }
                        return (
                          <div
                            key={`${m.id}-${group.renderKey}`}
                            className="flex justify-end"
                          >
                            <div className="group relative w-fit max-w-[80%]">
                              {/* eslint-disable-next-line @next/next/no-img-element -- Data URLs are user attachments. */}
                              <img
                                src={p.url}
                                alt={
                                  p.filename ??
                                  t("assistant.chatContent.attachedImageAlt")
                                }
                                className="max-h-64 rounded-lg"
                              />
                              {m.role === "user" && onDeleteMessage && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteMessage(m)}
                                  disabled={actionDisabled}
                                  aria-label={t(
                                    "assistant.chatContent.deleteMessageAria",
                                  )}
                                  className="absolute -left-10 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  {deletingMessageId === m.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      }

                      if (p.type === "data-snippet") {
                        if (!isToolCallsExpanded && m.role === "assistant") {
                          return null;
                        }
                        return (
                          <div
                            key={`${m.id}-${group.renderKey}`}
                            className={cn(
                              "flex",
                              m.role === "user" ? "justify-end" : "justify-start",
                            )}
                          >
                            <div className="group relative w-fit max-w-[80%]">
                              <SnippetChip
                                filename={(p as WebAgentSnippetDataPart).data.filename}
                                content={(p as WebAgentSnippetDataPart).data.content}
                              />
                              {m.role === "user" && onDeleteMessage && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteMessage(m)}
                                  disabled={actionDisabled}
                                  aria-label={t(
                                    "assistant.chatContent.deleteMessageAria",
                                  )}
                                  className="absolute -left-10 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  {deletingMessageId === m.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      }

                      return null;
                    });

                  if (m.role === "assistant") {
                    return (
                      <AssistantMessageGroups
                        key={m.id}
                        message={m}
                        isStreaming={isMessageStreaming}
                        durationMs={messageDurationMap[m.id] ?? null}
                        startedAt={
                          messageStartedAtMap[m.id] ??
                          (isMessageStreaming
                            ? (lastSendStartedAt ?? lastUserMessageSentAt)
                            : null)
                        }
                      >
                        {renderGroups}
                      </AssistantMessageGroups>
                    );
                  }

                  return (
                    <div key={m.id} className="flex flex-col gap-1">
                      {renderGroups(true)}
                    </div>
                  );
                },
              )}
              {showThinkingIndicator && (
                <div className="my-1.5 border border-transparent py-0.5">
                  <div className="inline-flex items-center gap-2 rounded-md py-px text-sm text-muted-foreground">
                    <span className="flex size-3.5 shrink-0 items-center justify-center">
                      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-muted-foreground" />
                    </span>
                    <span className="leading-none">
                      {thinkingMessage ?? t("assistant.chatContent.thinking")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </OpenFileProvider>
        </div>
      </div>
      {!isAtBottom && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-secondary text-secondary-foreground hover:bg-accent"
          onClick={scrollToBottom}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
