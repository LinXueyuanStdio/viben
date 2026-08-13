"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ExternalLink, Plus, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { WebAgentUIMessage } from "@/app/types"
import {
  PageChatProvider,
} from "@/components/assistant/page-chat-provider"
import {
  SharedChatCore,
} from "@/components/assistant/shared-chat-core"
import type { ChatComposerHandle } from "@/components/assistant/chat-composer"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useModelOptions } from "@/hooks/assistant/use-model-options"
import {
  useSessionChats,
  type SessionChatListItem,
} from "@/hooks/assistant/use-session-chats"
import { usePageSession } from "@/hooks/assistant/use-page-session"
import type { Chat } from "@/lib/db/schema"
import { cn } from "@/lib/utils"

export type PageAssistantPanelProps = {
  pageDbId: string
  userSlug: string
  pageSlug: string
}

type ChatSnapshot = {
  chat: {
    id: string
    modelId: string | null
    activeStreamId: string | null
  }
  isStreaming: boolean
  messages: WebAgentUIMessage[]
}

const AUTHOR_SUGGESTIONS = [
  "assistant.pageChat.authorPrompts.multilingual",
  "assistant.pageChat.authorPrompts.seo",
  "assistant.pageChat.authorPrompts.accessibility",
]

const READER_SUGGESTIONS = [
  "assistant.pageChat.readerPrompts.summary",
  "assistant.pageChat.readerPrompts.keyPoints",
  "assistant.pageChat.readerPrompts.explain",
]

function toSessionChatListItem(chat: Chat): SessionChatListItem {
  return {
    ...chat,
    hasUnread: false,
    isStreaming: chat.activeStreamId !== null,
  }
}

function dedupeChats(chats: Chat[]): Chat[] {
  const seen = new Set<string>()
  const result: Chat[] = []
  for (const chat of chats) {
    if (seen.has(chat.id)) continue
    seen.add(chat.id)
    result.push(chat)
  }
  return result
}

function useChatSnapshot(
  sessionId: string | null,
  chatId: string | null,
  reloadKey: number,
) {
  const [data, setData] = useState<ChatSnapshot>()
  const [error, setError] = useState<Error>()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!sessionId || !chatId) {
      setData(undefined)
      setError(undefined)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError(undefined)

    async function loadSnapshot() {
      try {
        const response = await fetch(
          `/api/sessions/${sessionId}/chats/${chatId}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        )
        if (!response.ok) {
          throw new Error(await response.text())
        }
        const nextData = (await response.json()) as ChatSnapshot
        if (!controller.signal.aborted) {
          setData(nextData)
        }
      } catch (caught) {
        if (controller.signal.aborted) return
        setError(caught instanceof Error ? caught : new Error(String(caught)))
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadSnapshot()
    return () => controller.abort()
  }, [chatId, reloadKey, sessionId])

  return { data, error, isLoading }
}

function PageAssistantLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="h-9 rounded-md bg-muted/40 animate-pulse" />
      <div className="min-h-0 flex-1 rounded-md bg-muted/25 animate-pulse" />
      <div className="h-28 rounded-md bg-muted/35 animate-pulse" />
    </div>
  )
}

function PageAssistantError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 p-4 text-center">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {t("assistant.pageChat.pageUnavailable")}
        </p>
        <p className="max-w-[24rem] text-xs text-muted-foreground">{message}</p>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" />
        {t("assistant.pageChat.retry")}
      </Button>
    </div>
  )
}

function PageAssistantEmptyState({
  suggestions,
  onUseSuggestion,
}: {
  suggestions: string[]
  onUseSuggestion: (suggestion: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-4 py-8 text-center">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {t("assistant.pageChat.emptyTitle")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("assistant.pageChat.emptyDescription")}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((suggestion) => (
          <Button
            key={suggestion}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onUseSuggestion(suggestion)}
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  )
}

function PageAssistantToolbar({
  chats,
  currentChat,
  sessionId,
  onSelectChat,
  onCreateChat,
}: {
  chats: Chat[]
  currentChat: Chat
  sessionId: string
  onSelectChat: (chatId: string) => void
  onCreateChat: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-w-0 items-center gap-2 border-b border-border/60 px-2 py-2">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-w-0 flex-1 justify-between px-2"
            onClick={() => setOpen((current) => !current)}
          >
            <span className="truncate">{currentChat.title}</span>
            <ChevronDown className="h-4 w-4 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {chats.map((chat) => (
            <DropdownMenuItem
              key={chat.id}
              onClick={() => {
                onSelectChat(chat.id)
                setOpen(false)
              }}
              className={cn(chat.id === currentChat.id && "font-medium")}
            >
              <span className="truncate">{chat.title}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={t("assistant.pageChat.newConversation")}
        onClick={onCreateChat}
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button asChild size="icon" variant="ghost">
        <a
          href={`/assistant/${sessionId}/chats/${currentChat.id}`}
          aria-label={t("assistant.pageChat.openFullConversation")}
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </Button>
    </div>
  )
}

function isPageUnavailableMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return normalized === "page not found" || normalized === "page unavailable"
}

export function PageAssistantPanel({
  userSlug,
  pageSlug,
}: PageAssistantPanelProps) {
  const { t } = useTranslation()
  const pageSession = usePageSession({ userSlug, pageSlug })
  const { modelOptions, loading: modelOptionsLoading } = useModelOptions()
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [localChats, setLocalChats] = useState<Chat[]>([])
  const [draft, setDraft] = useState("")
  const [snapshotReloadKey, setSnapshotReloadKey] = useState(0)
  const composerRef = useRef<ChatComposerHandle>(null)

  const initialChatsData = useMemo(() => {
    if (!pageSession.data) return undefined
    return {
      defaultModelId: pageSession.data.chat.modelId,
      chats: [toSessionChatListItem(pageSession.data.chat)],
    }
  }, [pageSession.data])

  const sessionChats = useSessionChats(
    pageSession.data?.session.id ?? null,
    initialChatsData ? { initialData: initialChatsData } : undefined,
  )

  useEffect(() => {
    if (pageSession.data && !activeChatId) {
      setActiveChatId(pageSession.data.chat.id)
    }
  }, [activeChatId, pageSession.data])

  const chats = useMemo(
    () =>
      dedupeChats([
        ...localChats,
        ...sessionChats.chats,
        ...(pageSession.data ? [pageSession.data.chat] : []),
      ]),
    [localChats, pageSession.data, sessionChats.chats],
  )

  const currentChat = useMemo(() => {
    const fallbackChat = pageSession.data?.chat ?? null
    if (!activeChatId) return fallbackChat
    return chats.find((chat) => chat.id === activeChatId) ?? fallbackChat
  }, [activeChatId, chats, pageSession.data?.chat])

  const chatSnapshot = useChatSnapshot(
    pageSession.data?.session.id ?? null,
    currentChat?.id ?? null,
    snapshotReloadKey,
  )

  const handleCreateChat = useCallback(() => {
    const result = sessionChats.createChat()
    setLocalChats((current) => dedupeChats([result.chat, ...current]))
    setActiveChatId(result.chat.id)
    void result.persisted.then((persistedChat) => {
      setLocalChats((current) =>
        dedupeChats([
          persistedChat,
          ...current.filter((chat) => chat.id !== result.chat.id),
        ]),
      )
      setActiveChatId(persistedChat.id)
    })
  }, [sessionChats])

  const handleUseSuggestion = useCallback((suggestion: string) => {
    setDraft(suggestion)
    requestAnimationFrame(() => composerRef.current?.focus())
  }, [])

  if (pageSession.isLoading) {
    return <PageAssistantLoading />
  }

  if (pageSession.error || !pageSession.data) {
    const message = pageSession.error?.message
    const detail =
      message && !isPageUnavailableMessage(message)
        ? message
        : t("assistant.pageChat.restoreError")
    return (
      <PageAssistantError
        message={detail}
        onRetry={() => void pageSession.retry()}
      />
    )
  }

  if (!currentChat || modelOptionsLoading || chatSnapshot.isLoading) {
    return <PageAssistantLoading />
  }

  if (chatSnapshot.error) {
    return (
      <PageAssistantError
        message={chatSnapshot.error.message || t("assistant.pageChat.loadConversationError")}
        onRetry={() => setSnapshotReloadKey((key) => key + 1)}
      />
    )
  }

  const currentChatWithSnapshot = {
    ...currentChat,
    modelId: chatSnapshot.data?.chat.modelId ?? currentChat.modelId,
    activeStreamId:
      chatSnapshot.data?.chat.activeStreamId ?? currentChat.activeStreamId,
  }
  const suggestions = (pageSession.data.page.can_edit
    ? AUTHOR_SUGGESTIONS
    : READER_SUGGESTIONS
  ).map((key) => t(key))

  return (
    <PageChatProvider
      session={pageSession.data.session}
      chat={currentChatWithSnapshot}
      initialMessages={chatSnapshot.data?.messages ?? []}
      initialModelOptions={modelOptions}
    >
      <SharedChatCore
        key={currentChatWithSnapshot.id}
        session={pageSession.data.session}
        chat={currentChatWithSnapshot}
        initialMessages={chatSnapshot.data?.messages ?? []}
        modelOptions={modelOptions}
        mode="page"
        density="compact"
        toolbar={
          <PageAssistantToolbar
            chats={chats}
            currentChat={currentChatWithSnapshot}
            sessionId={pageSession.data.session.id}
            onSelectChat={setActiveChatId}
            onCreateChat={handleCreateChat}
          />
        }
        emptyState={
          <PageAssistantEmptyState
            suggestions={suggestions}
            onUseSuggestion={handleUseSuggestion}
          />
        }
        composerRef={composerRef}
        composerProps={{
          draft,
          onDraftChange: setDraft,
          placeholder: t("assistant.pageChat.placeholder"),
        }}
        composerContainerClassName="border-t border-border/60"
      />
    </PageChatProvider>
  )
}
