"use client";

import { useParams, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ExternalLink, Link2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  type SessionChatListItem,
  useSessionChats,
} from "@/hooks/assistant/use-session-chats";
import type { Session } from "@/lib/db/schema";
import {
  GitPanelProvider,
  useGitPanel,
} from "@/components/assistant/git-panel-context";
import { SessionHeader } from "@/components/assistant/session-header";
import { SessionLayoutContext, useSessionLayout } from "@/components/assistant/session-layout-context";
import { useAppShell } from "@/components/layout/app-shell";

type SessionLayoutShellProps = {
  session: Session;
  initialChatsData?: {
    defaultModelId: string | null;
    chats: SessionChatListItem[];
  };
  children: ReactNode;
};

/**
 * Inner component that reads panelContent from context and renders
 * the horizontal split: left column (header + tabs + page) | right panel.
 */
function SessionLayoutInner({
  activeChatId,
  children,
}: {
  activeChatId: string;
  children: ReactNode;
}) {
  const { panelPortalRef, gitPanelOpen, setGitPanelOpen, setShareRequested } = useGitPanel();
  const { setTopbarCenterContent } = useAppShell();
  const { chats, session } = useSessionLayout();

  // Derive active chat title and inject into Topbar center
  const activeChatTitle = useMemo(() => {
    if (!activeChatId) return session.title;
    const chat = chats.find((c) => c.id === activeChatId);
    return chat?.title || session.title;
  }, [activeChatId, chats, session.title]);

  useEffect(() => {
    setTopbarCenterContent(
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Repo + branch prefix */}
        {session.repoName && (
          <div className="hidden min-w-0 items-center gap-1 sm:flex">
            <Tooltip>
              <TooltipTrigger asChild>
                {session.cloneUrl ? (
                  <a
                    href={`https://github.com/${session.repoOwner}/${session.repoName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 truncate text-sm font-medium text-foreground/70 hover:underline"
                  >
                    {session.repoName}
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </a>
                ) : (
                  <span className="truncate text-sm font-medium text-foreground/70">
                    {session.repoName}
                  </span>
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {session.repoOwner}/{session.repoName}
              </TooltipContent>
            </Tooltip>
            {session.branch && (
              <>
                <span className="text-muted-foreground/40">/</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {session.branch}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{session.branch}</TooltipContent>
                </Tooltip>
              </>
            )}
            <span className="text-muted-foreground/40">/</span>
          </div>
        )}
        <span className="truncate max-w-[200px] text-sm font-medium text-foreground sm:font-normal sm:text-muted-foreground">
          {activeChatTitle}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setShareRequested(true)}
              className="shrink-0 rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-foreground"
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("assistant.session.shareChat")}</TooltipContent>
        </Tooltip>
      </div>
    );
    return () => setTopbarCenterContent(null);
  }, [activeChatTitle, setTopbarCenterContent, setShareRequested, session.repoName, session.repoOwner, session.branch, session.cloneUrl]);

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* Left column: header + page content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <SessionHeader activeChatId={activeChatId} />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>

      {/* Mobile backdrop for outside-click dismissal */}
      {gitPanelOpen && (
        <button
          type="button"
          aria-label="Close right sidebar"
          className="absolute inset-0 z-20 bg-background/20 sm:hidden"
          onClick={() => setGitPanelOpen(false)}
        />
      )}

      {/* Portal target for the git panel — slideover on mobile, sidebar on larger screens */}
      <div
        ref={panelPortalRef}
        className={`absolute right-0 top-0 z-30 flex h-full w-72 flex-col overflow-hidden border-l border-border bg-background shadow-lg transition-transform duration-200 ease-in-out sm:relative sm:right-auto sm:top-auto sm:z-0 sm:shrink-0 sm:translate-x-0 sm:shadow-none sm:transition-[width] ${
          gitPanelOpen
            ? "translate-x-0 sm:w-72 sm:border-l xl:w-80"
            : "translate-x-full sm:w-0 sm:border-l-0"
        }`}
      />
    </div>
  );
}

export function SessionLayoutShell({
  session: initialSession,
  initialChatsData,
  children,
}: SessionLayoutShellProps) {
  const router = useRouter();
  const params = useParams<{ chatId?: string }>();
  const routeChatId = params.chatId ?? "";
  const [optimisticActiveChatId, setOptimisticActiveChatId] = useState<
    string | null
  >(null);
  const [_isNavigatingChat, startChatNavigationTransition] = useTransition();
  const prefetchedChatHrefsRef = useRef(new Set<string>());

  const sessionId = initialSession.id;

  const {
    chats,
    loading: chatsLoading,
    createChat,
    deleteChat,
    renameChat,
  } = useSessionChats(sessionId, { initialData: initialChatsData });

  const getChatHref = useCallback(
    (chatId: string) => `/assistant/${sessionId}/${chatId}`,
    [sessionId],
  );

  const switchChat = useCallback(
    (chatId: string) => {
      if (chatId === (optimisticActiveChatId ?? routeChatId)) {
        return;
      }

      const href = getChatHref(chatId);
      prefetchedChatHrefsRef.current.add(href);
      setOptimisticActiveChatId(chatId);
      startChatNavigationTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [getChatHref, optimisticActiveChatId, routeChatId, router],
  );

  useEffect(() => {
    if (optimisticActiveChatId && optimisticActiveChatId === routeChatId) {
      setOptimisticActiveChatId(null);
    }
  }, [optimisticActiveChatId, routeChatId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const chat of chats.slice(0, 6)) {
        const href = getChatHref(chat.id);
        if (prefetchedChatHrefsRef.current.has(href)) {
          continue;
        }

        prefetchedChatHrefsRef.current.add(href);
        router.prefetch(href);
      }
    }, 150);

    return () => {
      window.clearTimeout(timer);
    };
  }, [chats, getChatHref, router]);

  const activeChatId = optimisticActiveChatId ?? routeChatId;

  const layoutContext = useMemo(
    () => ({
      session: {
        title: initialSession.title,
        repoName: initialSession.repoName,
        repoOwner: initialSession.repoOwner,
        cloneUrl: initialSession.cloneUrl,
        branch: initialSession.branch,
        status: initialSession.status,
        prNumber: initialSession.prNumber,
        prStatus: initialSession.prStatus ?? null,
        linesAdded: initialSession.linesAdded,
        linesRemoved: initialSession.linesRemoved,
      },
      chats,
      chatsLoading,
      createChat,
      switchChat,
      deleteChat,
      renameChat,
    }),
    [
      initialSession,
      chats,
      chatsLoading,
      createChat,
      switchChat,
      deleteChat,
      renameChat,
    ],
  );

  return (
    <SessionLayoutContext.Provider value={layoutContext}>
      <GitPanelProvider>
        <SessionLayoutInner activeChatId={activeChatId}>
          {children}
        </SessionLayoutInner>
      </GitPanelProvider>
    </SessionLayoutContext.Provider>
  );
}
